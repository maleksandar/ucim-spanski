/* Učitavanje baze i spajanje duplikata između lekcija. */
(function (global) {
  "use strict";

  var lessons = [];
  var rawVerbs = [];

  var ARTICLE = /^(el\/la|la\/el|el|la|los|las|un|una|unos|unas)\s+/i;
  // sve što nije slovo ili cifra na početku (¡, ¿, navodnici…) ne sme u ključ za sortiranje
  var LEADING_JUNK = /^[^0-9A-Za-zÀ-ÖØ-öø-ÿ]+/;

  /** Član se odvaja samo kod imenica; kod izraza je "una vez" deo samog izraza. */
  function splitArticle(word) {
    if (word.pos !== "sustantivo") return { article: "", rest: word.es };
    var match = ARTICLE.exec(word.es);
    if (!match) return { article: "", rest: word.es };
    return { article: match[1], rest: word.es.slice(match[0].length) };
  }

  function firstAlternative(text) {
    return text.split("/")[0].trim();
  }

  /** Dopunjuje reč poljima za prikaz, sortiranje i izgovor. */
  function decorate(word) {
    var parts = splitArticle(word);
    word.article = parts.article;
    word.root = parts.rest;
    word.sortKey = parts.rest.replace(LEADING_JUNK, "");
    word.speakText = parts.article
      ? firstAlternative(parts.article) + " " + firstAlternative(parts.rest)
      : firstAlternative(word.es);
    return word;
  }

  // data/lessons/*.js zovu lesson(), data/verbs.js zove verbs()
  global.lesson = function (data) { lessons.push(data); };
  global.verbs = function (list) { rawVerbs = list; };

  function loadScript(src) {
    return new Promise(function (resolve) {
      var el = document.createElement("script");
      el.src = src;
      el.onload = function () { resolve(true); };
      el.onerror = function () { resolve(false); };
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

    failed: [],

    load: function () {
      // ista verzija kao ostali fajlovi, da se iz keša ne pokupi pola stare baze
      var version = global.ASSET_VERSION ? "?v=" + global.ASSET_VERSION : "";
      var files = (global.LESSON_FILES || []).map(function (f) { return "data/" + f + version; });
      files.push("data/verbs.js" + version);
      // jedan lekcijski fajl koji ne stigne ne sme da obori ceo sajt
      return files.reduce(function (chain, src) {
        return chain.then(function () {
          return loadScript(src).then(function (ok) {
            if (!ok) Store.failed.push(src);
          });
        });
      }, Promise.resolve()).then(function () {
        if (!lessons.length) throw new Error("nijedna lekcija nije učitana");
        Store.index();
        return Store;
      });
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

      Store.words = Object.keys(wordMap).map(function (k) { return decorate(wordMap[k]); });
      Store.words.sort(function (a, b) { return a.sortKey.localeCompare(b.sortKey, "es"); });
      Store.topics = Object.keys(topicSet).sort().map(function (k) { return topicSet[k]; });

      Store.verbs = rawVerbs.map(function (v) {
        var forms = {};
        v.tenses.forEach(function (t) { forms[t] = global.Conjugator.conjugate(v.inf, t); });
        return { inf: v.inf, sr: v.sr, tenses: v.tenses, forms: forms };
      });

      Store.byId = wordMap;
      return Store;
    },

    /**
     * Pretraga gleda reč, njene oblike i srpski prevod — ali ne i primere.
     * Inače bi "algun" izlistao i bosque, zato što mu je u primeru
     * "Algunas personas van a plantar árboles…".
     */
    matchesSearch: function (word, query) {
      var needle = global.TextUtil.fold(String(query || "").trim());
      if (!needle) return true;
      var haystack = [word.es, word.sr].concat(word.forms).join(" ");
      return global.TextUtil.fold(haystack).indexOf(needle) !== -1;
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
