/* Učitavanje baze i spajanje duplikata između lekcija. */
(function (global) {
  "use strict";

  var lessons = [];
  var rawVerbs = [];

  // data/lessons/*.js zovu lesson(), data/verbs.js zove verbs()
  global.lesson = function (data) { lessons.push(data); };
  global.verbs = function (list) { rawVerbs = list; };

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement("script");
      el.src = src;
      el.onload = resolve;
      el.onerror = function () { reject(new Error("Ne mogu da učitam " + src)); };
      document.head.appendChild(el);
    });
  }

  var Store = {
    lessons: [],
    words: [],          // spojen rečnik, jedinstven po id
    grammar: [],        // sve gramatičke teme
    grammarQuestions: [],
    verbs: [],
    topics: [],
    byId: {},

    load: function () {
      var files = (global.LESSON_FILES || []).map(function (f) { return "data/" + f; });
      files.push("data/verbs.js");
      return files.reduce(function (chain, src) {
        return chain.then(function () { return loadScript(src); });
      }, Promise.resolve()).then(function () { Store.index(); return Store; });
    },

    index: function () {
      lessons.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      Store.lessons = lessons;

      var wordMap = Object.create(null);
      var topicSet = Object.create(null);

      lessons.forEach(function (lesson) {
        (lesson.vocabulary || []).forEach(function (item) {
          var existing = wordMap[item.id];
          if (existing) {
            // ista reč u više lekcija: spoji primere i zapamti obe lekcije
            existing.lessons.push(lesson.id);
            (item.ex || []).forEach(function (ex) {
              var dup = existing.ex.some(function (e) { return e.es === ex.es; });
              if (!dup) existing.ex.push(ex);
            });
            (item.forms || []).forEach(function (f) {
              if (existing.forms.indexOf(f) === -1) existing.forms.push(f);
            });
            if (!existing.def && item.def) existing.def = item.def;
            return;
          }
          var word = {
            id: item.id,
            es: item.es,
            sr: item.sr,
            def: item.def || "",
            pos: item.pos || "expresión",
            gender: item.gender || "",
            topic: item.topic || { es: "General", sr: "Opšte" },
            forms: (item.forms || []).slice(),
            ex: (item.ex || []).slice(),
            lessons: [lesson.id]
          };
          wordMap[item.id] = word;
          topicSet[word.topic.es] = word.topic;
        });

        (lesson.grammar || []).forEach(function (topic) {
          Store.grammar.push({
            id: topic.id,
            lesson: lesson.id,
            title: topic.title,
            explanation: topic.explanation,
            questions: topic.questions || []
          });
          (topic.questions || []).forEach(function (q) {
            Store.grammarQuestions.push({
              id: q.id,
              topicId: topic.id,
              topicTitle: topic.title,
              lesson: lesson.id,
              sentence: q.sentence,
              options: q.options,
              answer: q.answer,
              explain: q.explain
            });
          });
        });
      });

      Store.words = Object.keys(wordMap).map(function (k) { return wordMap[k]; });
      Store.words.sort(function (a, b) { return a.es.localeCompare(b.es, "es"); });
      Store.topics = Object.keys(topicSet).sort().map(function (k) { return topicSet[k]; });

      Store.verbs = rawVerbs.map(function (v) {
        var forms = {};
        v.tenses.forEach(function (t) { forms[t] = global.Conjugator.conjugate(v.inf, t); });
        return { inf: v.inf, sr: v.sr, tenses: v.tenses, forms: forms };
      });

      Store.byId = wordMap;
      return Store;
    },

    lessonById: function (id) {
      for (var i = 0; i < Store.lessons.length; i++) {
        if (Store.lessons[i].id === id) return Store.lessons[i];
      }
      return null;
    },

    lessonTitle: function (id) {
      var lesson = Store.lessonById(id);
      return lesson ? global.I18n.pick(lesson.title) : id;
    }
  };

  global.Store = Store;
})(window);
