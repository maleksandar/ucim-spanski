/* Sastavljanje kviza iz baze: pet tipova pitanja, SRS ili nasumičan izbor. */
(function (global) {
  "use strict";

  var ARTICLE = /^(el\/la|la\/el|el|la|los|las|un|una|unos|unas)\s+/i;
  var WORD_CHAR = /[a-zá-úñüA-ZÁ-ÚÑÜ]/;

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }

  function sample(list, count) { return shuffle(list).slice(0, count); }

  function stripArticle(text) { return text.replace(ARTICLE, "").trim(); }

  /** Svi oblici pod kojima reč može da se pojavi u primeru, duži prvo. */
  function surfaceForms(word) {
    var out = [];
    function add(value) {
      var clean = stripArticle(String(value || "").trim());
      if (clean.length < 2 || clean.indexOf("…") !== -1) return;
      if (out.indexOf(clean) === -1) out.push(clean);
    }
    add(word.es);
    word.es.split("/").forEach(add);
    (word.forms || []).forEach(add);
    return out.sort(function (a, b) { return b.length - a.length; });
  }

  /** Nađi oblik reči u rečenici, poštujući granice reči. */
  function findInSentence(sentence, forms) {
    var lower = sentence.toLowerCase();
    for (var i = 0; i < forms.length; i++) {
      var needle = forms[i].toLowerCase();
      var from = 0;
      while (true) {
        var at = lower.indexOf(needle, from);
        if (at === -1) break;
        var before = at === 0 ? "" : sentence[at - 1];
        var afterIndex = at + needle.length;
        var after = afterIndex >= sentence.length ? "" : sentence[afterIndex];
        if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) {
          return { start: at, length: needle.length, surface: sentence.substr(at, needle.length) };
        }
        from = at + 1;
      }
    }
    return null;
  }

  function distractors(pool, isValid, count) {
    var picked = [];
    var candidates = shuffle(pool);
    for (var i = 0; i < candidates.length && picked.length < count; i++) {
      if (isValid(candidates[i]) && picked.indexOf(candidates[i]) === -1) picked.push(candidates[i]);
    }
    return picked;
  }

  function buildTranslation(word, words, direction) {
    var samePos = words.filter(function (w) { return w.pos === word.pos && w.id !== word.id; });
    var pool = (samePos.length >= 6 ? samePos : words.filter(function (w) { return w.id !== word.id; }));
    var key = direction === "es-sr" ? "sr" : "es";
    var answer = word[key];
    var wrong = distractors(
      pool.map(function (w) { return w[key]; }),
      function (value) { return value && value !== answer; },
      3
    );
    if (wrong.length < 3) return null;
    return {
      srsId: word.id,
      type: direction,
      prompt: direction === "es-sr" ? word.es : word.sr,
      sub: direction === "es-sr" ? word.def : "",
      options: shuffle([answer].concat(wrong)),
      answer: answer,
      example: word.ex[0] || null,
      lesson: word.lessons[0],
      word: word
    };
  }

  function buildCloze(word, words) {
    var forms = surfaceForms(word);
    if (!forms.length) return null;
    var usable = [];
    word.ex.forEach(function (ex) {
      var hit = findInSentence(ex.es, forms);
      if (hit) usable.push({ ex: ex, hit: hit });
    });
    if (!usable.length) return null;

    var chosen = usable[Math.floor(Math.random() * usable.length)];
    var sentence = chosen.ex.es;
    var hit = chosen.hit;
    var blanked = sentence.slice(0, hit.start) + "_____" + sentence.slice(hit.start + hit.length);
    var answer = hit.surface;

    var pool = [];
    words.forEach(function (other) {
      if (other.id === word.id) return;
      if (other.pos !== word.pos) return;
      // po jedan oblik od svake reči, da dve opcije ne budu varijante istog pojma
      surfaceForms(other).forEach(function (form) {
        if (form.indexOf("/") !== -1) return;
        pool.push({ value: form, owner: other.id });
      });
    });
    // biraj distraktore koji "pristaju" na to mesto: isti nastavak i isti broj reči,
    // da rešenje ne bude očigledno samo po rodu ili množini
    var lower = answer.toLowerCase();
    var words2 = answer.split(/\s+/).length;
    var scored = pool
      .filter(function (entry) { return entry.value.toLowerCase() !== lower; })
      .map(function (entry) {
        var score = 0;
        if (entry.value.slice(-1).toLowerCase() === lower.slice(-1)) score += 2;
        if (entry.value.slice(-2).toLowerCase() === lower.slice(-2)) score += 2;
        if (entry.value.split(/\s+/).length === words2) score += 1;
        return { value: entry.value, owner: entry.owner, score: score + Math.random() };
      })
      .sort(function (a, b) { return b.score - a.score; });

    var wrong = [];
    var usedOwners = Object.create(null);
    for (var i = 0; i < scored.length && wrong.length < 3; i++) {
      if (usedOwners[scored[i].owner]) continue;
      if (wrong.indexOf(scored[i].value) !== -1) continue;
      usedOwners[scored[i].owner] = true;
      wrong.push(scored[i].value);
    }
    if (wrong.length < 3) return null;

    return {
      srsId: word.id,
      type: "cloze",
      prompt: blanked,
      sub: word.sr,
      options: shuffle([answer].concat(wrong)),
      answer: answer,
      example: { es: sentence, sr: chosen.ex.sr },
      lesson: word.lessons[0],
      word: word
    };
  }

  function buildGrammar(question) {
    return {
      srsId: "g:" + question.id,
      type: "grammar",
      prompt: question.sentence,
      sub: global.I18n.pick(question.topicTitle),
      options: shuffle(question.options),
      answer: question.answer,
      explain: question.explain,
      lesson: question.lesson,
      topicId: question.topicId
    };
  }

  function buildConjugation(verb, tense) {
    var forms = verb.forms[tense];
    var index = Math.floor(Math.random() * forms.length);
    var answer = forms[index];

    var pool = [];
    verb.tenses.forEach(function (other) {
      verb.forms[other].forEach(function (form) { pool.push(form); });
    });
    var wrong = distractors(pool, function (value) { return value !== answer; }, 3);
    if (wrong.length < 3) return null;

    return {
      srsId: "c:" + verb.inf + ":" + tense,
      type: "conjug",
      prompt: verb.inf,
      sub: verb.sr,
      person: global.Conjugator.PERSONS[index],
      tense: tense,
      options: shuffle([answer].concat(wrong)),
      answer: answer,
      lesson: null,
      verb: verb
    };
  }

  /** Sve moguće pitanje-kandidate za date filtere. */
  function pool(options) {
    var types = options.types;
    var lessonFilter = options.lessons;
    var out = [];

    function lessonAllowed(ids) {
      if (!lessonFilter || !lessonFilter.length) return true;
      if (!ids) return true;
      var list = Array.isArray(ids) ? ids : [ids];
      return list.some(function (id) { return lessonFilter.indexOf(id) !== -1; });
    }

    var words = global.Store.words.filter(function (w) { return lessonAllowed(w.lessons); });

    if (types.indexOf("es-sr") !== -1) {
      words.forEach(function (w) { out.push({ kind: "es-sr", word: w, srsId: w.id }); });
    }
    if (types.indexOf("sr-es") !== -1) {
      words.forEach(function (w) { out.push({ kind: "sr-es", word: w, srsId: w.id }); });
    }
    if (types.indexOf("cloze") !== -1) {
      words.forEach(function (w) {
        if (w.ex.length && findInSentence(w.ex[0].es, surfaceForms(w))) {
          out.push({ kind: "cloze", word: w, srsId: w.id });
        }
      });
    }
    if (types.indexOf("grammar") !== -1) {
      global.Store.grammarQuestions.forEach(function (q) {
        if (lessonAllowed(q.lesson)) out.push({ kind: "grammar", question: q, srsId: "g:" + q.id });
      });
    }
    if (types.indexOf("conjug") !== -1) {
      // jedan kandidat po glagolu i vremenu, da SRS ključ odgovara onome što se beleži
      global.Store.verbs.forEach(function (v) {
        v.tenses.forEach(function (tense) {
          out.push({ kind: "conjug", verb: v, tense: tense, srsId: "c:" + v.inf + ":" + tense });
        });
      });
    }
    return out;
  }

  function materialize(candidate, words) {
    switch (candidate.kind) {
      case "es-sr": return buildTranslation(candidate.word, words, "es-sr");
      case "sr-es": return buildTranslation(candidate.word, words, "sr-es");
      case "cloze": return buildCloze(candidate.word, words);
      case "grammar": return buildGrammar(candidate.question);
      case "conjug": return buildConjugation(candidate.verb, candidate.tense);
      default: return null;
    }
  }

  /**
   * options = { types: [...], lessons: [...], length: 10, mode: "srs" | "random" }
   */
  function build(options) {
    var candidates = pool(options);
    if (!candidates.length) return [];

    if (options.mode === "srs") {
      candidates = candidates
        .map(function (c) {
          // mali šum da isti prioritet ne daje uvek isti redosled
          return { c: c, p: global.SRS.priority(c.srsId) + Math.random() * 0.5 };
        })
        .sort(function (a, b) { return a.p - b.p; })
        .map(function (entry) { return entry.c; });
    } else {
      candidates = shuffle(candidates);
    }

    var words = global.Store.words;
    var questions = [];
    var usedSrs = Object.create(null);

    for (var i = 0; i < candidates.length && questions.length < options.length; i++) {
      var candidate = candidates[i];
      // ista reč se ne ponavlja dva puta u istom kvizu
      if (usedSrs[candidate.srsId]) continue;
      var question = materialize(candidate, words);
      if (!question) continue;
      usedSrs[candidate.srsId] = true;
      questions.push(question);
    }
    return questions;
  }

  global.Quiz = {
    build: build,
    surfaceForms: surfaceForms,
    findInSentence: findInSentence,
    shuffle: shuffle,
    sample: sample
  };
})(window);
