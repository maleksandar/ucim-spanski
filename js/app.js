/* UI aplikacije: kviz, rečnik, gramatika, napredak. */
(function (global) {
  "use strict";

  var LANG_KEY = "ucim-spanski/lang";
  var PREFS_KEY = "ucim-spanski/prefs";

  var TYPE_LABELS = {
    "es-sr": "typeEsSr", "sr-es": "typeSrEs", cloze: "typeCloze",
    grammar: "typeGrammar", conjug: "typeConjug"
  };

  // ruta ↔ prikaz; hash je jedini izvor istine za to gde smo
  var ROUTES = { quiz: "#/quiz", vocab: "#/vocab", grammar: "#/grammar", stats: "#/stats" };

  var state = {
    view: "quiz",
    prefs: {
      types: ["es-sr", "sr-es", "cloze", "grammar", "conjug"],
      lessons: [],
      length: 15,
      mode: "srs"
    },
    quiz: null,
    vocab: { search: "", sort: "alpha", topic: "", pos: "", lesson: "" }
  };

  // ---------- pomoćne ----------

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "class") node.className = attrs[key];
      else if (key === "text") node.textContent = attrs[key];
      else if (key === "html") node.innerHTML = attrs[key];
      else if (key.slice(0, 2) === "on") node.addEventListener(key.slice(2), attrs[key]);
      else if (attrs[key] !== null && attrs[key] !== undefined && attrs[key] !== false) {
        node.setAttribute(key, attrs[key]);
      }
    });
    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function viewFromHash() {
    var name = String(global.location.hash || "").replace(/^#\/?/, "").split(/[?&]/)[0];
    return ROUTES[name] ? name : null;
  }

  function onHashChange() {
    var view = viewFromHash() || "quiz";
    if (view === state.view) return;
    state.view = view;
    render();
    global.scrollTo(0, 0);
  }

  function t(key) { return global.I18n.t(key); }
  function pick(obj) { return global.I18n.pick(obj); }

  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs)); } catch (e) { /* ignore */ }
  }

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (Array.isArray(saved.types) && saved.types.length) state.prefs.types = saved.types;
        if (Array.isArray(saved.lessons)) state.prefs.lessons = saved.lessons;
        if (saved.length) state.prefs.length = saved.length;
        if (saved.mode) state.prefs.mode = saved.mode;
      }
    } catch (e) { /* ignore */ }
  }

  var voice = null;
  function speak(text) {
    if (!global.speechSynthesis) return;
    if (!voice) {
      var voices = global.speechSynthesis.getVoices();
      voice = voices.filter(function (v) { return /^es/i.test(v.lang); })[0] || null;
    }
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    if (voice) utterance.voice = voice;
    utterance.rate = 0.92;
    global.speechSynthesis.cancel();
    global.speechSynthesis.speak(utterance);
  }

  function speakButton(text) {
    return el("button", {
      class: "speak", type: "button", title: t("listen"), "aria-label": t("listen"),
      onclick: function (ev) { ev.stopPropagation(); ev.preventDefault(); speak(text); }
    }, ["🔊"]);
  }

  function formatDate(iso) {
    var parts = String(iso).split("-");
    if (parts.length < 3) return iso;
    return parts[2] + "." + parts[1] + "." + parts[0] + ".";
  }

  // ---------- zaglavlje ----------

  function renderHeader() {
    var host = document.getElementById("header");
    host.innerHTML = "";

    var langSwitch = el("div", { class: "lang-switch", role: "group" }, ["es", "sr"].map(function (lang) {
      return el("button", {
        type: "button",
        "aria-pressed": String(global.I18n.lang === lang),
        onclick: function () {
          global.I18n.set(lang);
          try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
          document.documentElement.lang = lang === "es" ? "es" : "sr";
          render();
          trackHeaderHeight();
        }
      }, [lang.toUpperCase()]);
    }));

    var select = el("select", {
      "aria-label": t("profile"),
      onchange: function (ev) { global.SRS.setActive(ev.target.value); render(); }
    }, global.SRS.profiles().map(function (name) {
      return el("option", { value: name, selected: name === global.SRS.active() }, [name]);
    }));

    var addBtn = el("button", {
      class: "icon-btn", type: "button", title: t("addProfile"), "aria-label": t("addProfile"),
      onclick: function () {
        var name = prompt(t("profileName"));
        if (name && global.SRS.addProfile(name)) render();
      }
    }, ["+"]);

    host.appendChild(el("div", { class: "top-inner" }, [
      el("div", { class: "brand" }, [
        el("span", { class: "flag", "aria-hidden": "true" }),
        el("h1", { text: t("appName") })
      ]),
      el("div", { class: "profile-pick" }, [select, addBtn]),
      langSwitch
    ]));

    var tabs = [["quiz", "navQuiz"], ["vocab", "navVocab"], ["grammar", "navGrammar"], ["stats", "navStats"]];
    host.appendChild(el("nav", { class: "tabs" }, tabs.map(function (tab) {
      return el("a", {
        href: ROUTES[tab[0]],
        "aria-current": state.view === tab[0] ? "page" : null
      }, [t(tab[1])]);
    })));
  }

  // ---------- podešavanje kviza ----------

  function chip(label, isOn, onToggle) {
    return el("label", {
      class: "chip" + (isOn ? " on" : ""),
      onclick: function (ev) { ev.preventDefault(); onToggle(); }
    }, [el("span", { class: "dot" }), label]);
  }

  function lessonOptions() {
    return global.Store.lessons.map(function (lesson) {
      return { value: lesson.id, label: formatDate(lesson.date) + " " + pick(lesson.title) };
    });
  }

  function renderQuizSetup() {
    var typeField = el("div", { class: "field" }, [
      el("label", { class: "head", text: t("quizTypes") }),
      el("div", { class: "chips" }, Object.keys(TYPE_LABELS).map(function (type) {
        return chip(t(TYPE_LABELS[type]), state.prefs.types.indexOf(type) !== -1, function () {
          var at = state.prefs.types.indexOf(type);
          if (at === -1) state.prefs.types.push(type);
          else if (state.prefs.types.length > 1) state.prefs.types.splice(at, 1);
          savePrefs();
          render();
        });
      }))
    ]);

    var lessonPicker = global.Dropdown.create({
      multiple: true,
      label: "",
      placeholder: t("allLessons"),
      options: lessonOptions(),
      value: state.prefs.lessons.slice(),
      defaultValue: [],
      countLabel: function (n) { return global.I18n.lessonsCount(n); },
      searchLabel: t("ddSearch"),
      clearLabel: t("ddClear"),
      emptyLabel: t("ddEmpty"),
      onChange: function (chosen) { state.prefs.lessons = chosen; savePrefs(); }
    });

    var lessonField = el("div", { class: "field" }, [
      el("label", { class: "head", text: t("quizSource") }),
      lessonPicker.node
    ]);

    var modeField = el("div", { class: "field" }, [
      el("label", { class: "head", text: t("mode") }),
      el("div", { class: "chips" }, [
        chip(t("modeSrs"), state.prefs.mode === "srs", function () { state.prefs.mode = "srs"; savePrefs(); render(); }),
        chip(t("modeRandom"), state.prefs.mode === "random", function () { state.prefs.mode = "random"; savePrefs(); render(); })
      ]),
      el("p", { class: "small muted", text: state.prefs.mode === "srs" ? t("modeSrsHint") : t("modeRandomHint"), style: "margin:.5rem 0 0" })
    ]);

    var lengthField = el("div", { class: "field" }, [
      el("label", { class: "head", text: t("quizLength") }),
      el("div", { class: "chips" }, [10, 15, 25, 40].map(function (n) {
        return chip(String(n), state.prefs.length === n, function () {
          state.prefs.length = n; savePrefs(); render();
        });
      }))
    ]);

    var startBtn = el("button", {
      class: "btn wide", type: "button",
      onclick: function () { startQuiz(); }
    }, [t("startQuiz")]);

    var counts = el("p", { class: "small muted", style: "margin:.9rem 0 0;text-align:center" }, [
      global.Store.words.length + " " + t("totalWords").toLowerCase() +
      " · " + global.Store.grammarQuestions.length + " " + t("totalGrammar").toLowerCase() +
      " · " + global.Store.verbs.length + " " + t("totalVerbs").toLowerCase()
    ]);

    return el("div", {}, [
      el("h2", { class: "section", text: t("navQuiz") }),
      el("div", { class: "card" }, [typeField, lengthField, modeField, lessonField, startBtn, counts])
    ]);
  }

  // ---------- kviz ----------

  function startQuiz(overrides) {
    var options = {
      types: (overrides && overrides.types) || state.prefs.types,
      lessons: (overrides && overrides.lessons) || state.prefs.lessons,
      length: (overrides && overrides.length) || state.prefs.length,
      mode: (overrides && overrides.mode) || state.prefs.mode
    };
    if (overrides && overrides.topicId) {
      var picked = global.Store.grammarQuestions.filter(function (q) { return q.topicId === overrides.topicId; });
      state.quiz = {
        questions: picked.map(function (q) {
          return {
            srsId: "g:" + q.id, type: "grammar", prompt: q.sentence,
            sub: pick(q.topicTitle), options: global.Quiz.shuffle(q.options),
            answer: q.answer, explain: q.explain, lesson: q.lesson, topicId: q.topicId
          };
        }),
        index: 0, answers: [], done: false
      };
    } else {
      state.quiz = { questions: global.Quiz.build(options), index: 0, answers: [], done: false };
    }
    state.view = "quiz";
    render();
    global.scrollTo(0, 0);
  }

  function renderQuiz() {
    var quiz = state.quiz;
    if (!quiz.questions.length) {
      return el("div", {}, [
        el("h2", { class: "section", text: t("navQuiz") }),
        el("div", { class: "card empty" }, [
          el("p", { text: t("quizEmpty") }),
          el("button", { class: "btn ghost", type: "button", onclick: function () { state.quiz = null; render(); } }, [t("backHome")])
        ])
      ]);
    }
    if (quiz.done) return renderResults();

    var question = quiz.questions[quiz.index];
    var answered = quiz.answers[quiz.index];

    var bar = el("div", { class: "progress" }, [
      el("span", { text: t("question") + " " + (quiz.index + 1) + " " + t("of") + " " + quiz.questions.length }),
      el("div", { class: "bar" }, [el("span", { style: "width:" + ((quiz.index) / quiz.questions.length * 100) + "%" })])
    ]);

    var promptText = question.prompt;
    var promptNode;
    if (question.type === "cloze") {
      promptNode = el("p", { class: "q-prompt" }, promptText.split("_____").reduce(function (acc, part, i) {
        if (i) acc.push(el("span", { class: "blank", text: "_____" }));
        acc.push(document.createTextNode(part));
        return acc;
      }, []));
    } else if (question.type === "conjug") {
      promptNode = el("p", { class: "q-prompt" }, [
        question.prompt, " ",
        el("span", { class: "muted", style: "font-weight:400;font-size:1rem" }, ["→ " + question.person])
      ]);
    } else {
      promptNode = el("p", { class: "q-prompt", text: promptText });
    }

    var subText = question.type === "conjug"
      ? t("tense")[question.tense] + " · " + question.sub
      : question.sub;

    var options = el("div", { class: "options" }, question.options.map(function (option, i) {
      var classes = "option";
      if (answered) {
        if (option === question.answer) classes += " correct";
        else if (option === answered.chosen) classes += " wrong";
        else classes += " dim";
      }
      return el("button", {
        class: classes, type: "button", disabled: answered ? "disabled" : null,
        onclick: function () { answer(option); }
      }, [
        el("span", { class: "key", text: String(i + 1) }),
        el("span", { text: option })
      ]);
    }));

    var body = [bar,
      el("span", { class: "q-type", text: t(TYPE_LABELS[question.type]) }),
      promptNode,
      subText ? el("p", { class: "q-sub", text: subText }) : null,
      options];

    if (answered) {
      var ok = answered.correct;
      var explain = question.explain ? pick(question.explain) : "";
      var verdict = el("div", { class: "verdict " + (ok ? "ok" : "bad") }, [
        el("strong", { text: ok ? t("correct") : t("wrong") + " — " + t("correctAnswer") + ": " + question.answer }),
        explain ? el("span", { text: explain }) : null,
        question.example ? el("div", { class: "ex" }, [
          question.example.es, " ", speakButton(question.example.es),
          question.example.sr ? el("div", { class: "small", text: question.example.sr }) : null
        ]) : null,
        question.word && question.word.def ? el("div", { class: "small muted", style: "margin-top:.3rem", text: question.word.def }) : null
      ]);
      body.push(verdict);
      body.push(el("div", { class: "q-actions" }, [
        el("button", { class: "btn", type: "button", onclick: next }, [
          quiz.index + 1 >= quiz.questions.length ? t("finish") : t("next")
        ])
      ]));
    }

    return el("div", {}, [el("div", { class: "card" }, body)]);
  }

  function answer(chosen) {
    var quiz = state.quiz;
    if (quiz.answers[quiz.index]) return;
    var question = quiz.questions[quiz.index];
    var correct = chosen === question.answer;
    quiz.answers[quiz.index] = { chosen: chosen, correct: correct };
    global.SRS.record(question.srsId, correct);
    render();
  }

  function next() {
    var quiz = state.quiz;
    if (quiz.index + 1 >= quiz.questions.length) {
      quiz.done = true;
      global.SRS.finishQuiz({
        total: quiz.questions.length,
        correct: quiz.answers.filter(function (a) { return a && a.correct; }).length,
        types: state.prefs.types.slice()
      });
    } else {
      quiz.index += 1;
    }
    render();
    global.scrollTo(0, 0);
  }

  function renderResults() {
    var quiz = state.quiz;
    var correct = quiz.answers.filter(function (a) { return a && a.correct; }).length;
    var total = quiz.questions.length;
    var pct = Math.round(correct / total * 100);

    var mistakes = quiz.questions.map(function (q, i) {
      return { q: q, a: quiz.answers[i] };
    }).filter(function (entry) { return entry.a && !entry.a.correct; });

    var review = mistakes.length
      ? el("div", { class: "review" }, mistakes.map(function (entry) {
          return el("div", { class: "review-item" }, [
            el("div", { class: "q", text: entry.q.prompt }),
            el("div", { class: "a" }, [
              entry.a.chosen + " → ", el("b", { text: entry.q.answer })
            ])
          ]);
        }))
      : el("p", { class: "empty", text: t("noMistakes") });

    return el("div", {}, [
      el("h2", { class: "section", text: t("results") }),
      el("div", { class: "card" }, [
        el("div", { class: "score-ring", style: "--pct:" + pct + "%" }, [
          el("div", { class: "inner" }, [
            el("div", {}, [
              el("div", { class: "pct", text: pct + "%" }),
              el("div", { class: "cnt", text: correct + " / " + total })
            ])
          ])
        ]),
        el("div", { class: "q-actions", style: "justify-content:center" }, [
          el("button", { class: "btn", type: "button", onclick: function () { startQuiz(); } }, [t("again")]),
          el("button", { class: "btn ghost", type: "button", onclick: function () { state.quiz = null; render(); } }, [t("backHome")])
        ]),
        el("h3", { class: "group-head", text: t("reviewMistakes"), style: "margin-top:1.2rem" }),
        review
      ])
    ]);
  }

  // ---------- rečnik ----------

  function filterWords() {
    var vocab = state.vocab;
    var query = global.Dropdown.fold(vocab.search.trim());

    var words = global.Store.words.filter(function (w) {
      if (vocab.pos && w.pos !== vocab.pos) return false;
      if (vocab.topic && w.topic.es !== vocab.topic) return false;
      if (vocab.lesson && w.lessons.indexOf(vocab.lesson) === -1) return false;
      if (!query) return true;
      var haystack = [w.es, w.sr, w.def]
        .concat(w.ex.map(function (e) { return e.es + " " + e.sr; }))
        .join(" ");
      return global.Dropdown.fold(haystack).indexOf(query) !== -1;
    });

    if (vocab.sort === "alpha") {
      words.sort(function (a, b) { return a.es.localeCompare(b.es, "es"); });
    } else if (vocab.sort === "topic") {
      words.sort(function (a, b) {
        return pick(a.topic).localeCompare(pick(b.topic)) || a.es.localeCompare(b.es, "es");
      });
    } else {
      words.sort(function (a, b) {
        return a.lessons[0].localeCompare(b.lessons[0]) || a.es.localeCompare(b.es, "es");
      });
    }
    return words;
  }

  function wordCard(word) {
    var posLabel = t("pos")[word.pos] || word.pos;
    return el("div", { class: "word" }, [
      el("div", { class: "word-head" }, [
        el("span", { class: "word-es", text: word.es }),
        speakButton(word.es.replace(/^el\/la\s+/, "").split("/")[0].trim()),
        el("span", { class: "word-sr", text: word.sr }),
        el("span", { class: "tag", text: posLabel })
      ]),
      word.def ? el("div", { class: "word-def", text: word.def }) : null,
      word.ex.length ? el("ul", { class: "word-ex" }, word.ex.map(function (ex) {
        return el("li", {}, [
          el("span", {}, [ex.es, " ", speakButton(ex.es)]),
          ex.sr ? el("div", { class: "sr", text: ex.sr }) : null
        ]);
      })) : null
    ]);
  }

  function renderVocab() {
    var vocab = state.vocab;
    var listHost = el("div", { class: "word-list" });
    var countNode = el("p", { class: "small muted vocab-count" });

    // samo lista se osvežava pri kucanju — inače bi polje za pretragu
    // bilo ponovo napravljeno i izgubilo fokus posle svakog slova
    function update() {
      var words = filterWords();
      countNode.textContent = words.length + " " + t("wordsShown");
      listHost.innerHTML = "";
      if (!words.length) {
        listHost.appendChild(el("p", { class: "empty", text: t("noResults") }));
        return;
      }
      var lastGroup = null;
      words.forEach(function (word) {
        var group = vocab.sort === "topic" ? pick(word.topic)
          : vocab.sort === "lesson"
            ? formatDate((global.Store.lessonById(word.lessons[0]) || {}).date || "") +
              " " + global.Store.lessonTitle(word.lessons[0])
            : null;
        if (group && group !== lastGroup) {
          listHost.appendChild(el("h3", { class: "group-head", text: group }));
          lastGroup = group;
        }
        listHost.appendChild(wordCard(word));
      });
    }

    function picker(config) {
      config.searchLabel = t("ddSearch");
      config.clearLabel = t("ddClear");
      config.emptyLabel = t("ddEmpty");
      return global.Dropdown.create(config).node;
    }

    var filters = el("div", { class: "toolbar-filters" }, [
      picker({
        label: t("filterTopic"), placeholder: t("all"), value: vocab.topic, defaultValue: "",
        options: [{ value: "", label: t("all") }].concat(global.Store.topics.map(function (topic) {
          return { value: topic.es, label: pick(topic) };
        })),
        onChange: function (chosen) { vocab.topic = chosen; update(); }
      }),
      picker({
        label: t("filterLesson"), placeholder: t("all"), value: vocab.lesson, defaultValue: "",
        options: [{ value: "", label: t("all") }].concat(lessonOptions()),
        onChange: function (chosen) { vocab.lesson = chosen; update(); }
      }),
      picker({
        label: t("sortBy"), value: vocab.sort, defaultValue: "alpha",
        options: [
          { value: "alpha", label: t("sortAlpha") },
          { value: "lesson", label: t("sortLesson") },
          { value: "topic", label: t("sortTopic") }
        ],
        onChange: function (chosen) { vocab.sort = chosen; update(); }
      })
    ]);

    var toolbar = el("div", { class: "toolbar" }, [
      el("input", {
        class: "search", type: "search", placeholder: t("searchPlaceholder"), value: vocab.search,
        oninput: function (ev) { vocab.search = ev.target.value; update(); }
      }),
      filters
    ]);

    update();

    return el("div", {}, [
      el("h2", { class: "section", text: t("navVocab") }),
      toolbar,
      countNode,
      listHost
    ]);
  }

  // ---------- gramatika ----------

  function renderGrammar() {
    var items = global.Store.grammar.map(function (topic) {
      return el("details", { class: "gram" }, [
        el("summary", { text: pick(topic.title) }),
        el("div", { class: "body" }, [
          el("p", { text: pick(topic.explanation) }),
          el("p", { class: "from", text: t("lesson") + ": " + global.Store.lessonTitle(topic.lesson) }),
          topic.questions.length ? el("button", {
            class: "btn small ghost", type: "button",
            onclick: function () { startQuiz({ topicId: topic.id }); }
          }, [t("practice") + " (" + topic.questions.length + ")"]) : null
        ])
      ]);
    });

    return el("div", {}, [
      el("h2", { class: "section", text: t("grammarTopics") }),
      el("div", {}, items)
    ]);
  }

  // ---------- napredak ----------

  /** Čitljiva oznaka za bilo koji SRS id (reč, gramatičko pitanje ili glagol). */
  function srsLabel(id) {
    if (id.slice(0, 2) === "g:") {
      var qid = id.slice(2);
      var question = global.Store.grammarQuestions.filter(function (q) { return q.id === qid; })[0];
      if (!question) return qid;
      return question.sentence + "  (" + pick(question.topicTitle) + ")";
    }
    if (id.slice(0, 2) === "c:") {
      var parts = id.slice(2).split(":");
      return parts[0] + " · " + (t("tense")[parts[1]] || parts[1]);
    }
    var word = global.Store.byId[id];
    return word ? word.es + " · " + word.sr : id;
  }

  function renderStats() {
    var ids = global.Store.words.map(function (w) { return w.id; })
      .concat(global.Store.grammarQuestions.map(function (q) { return "g:" + q.id; }));
    var stats = global.SRS.stats(ids);
    var history = global.SRS.history();

    var grid = el("div", { class: "stat-grid" }, [
      [stats.known, t("known")], [stats.learning, t("learning")],
      [stats.due, t("due")], [stats.unseen, t("unseen")]
    ].map(function (pair) {
      return el("div", { class: "stat" }, [
        el("div", { class: "n", text: String(pair[0]) }),
        el("div", { class: "l", text: pair[1] })
      ]);
    }));

    var hardest = global.SRS.hardest(10);
    var hardestNode = hardest.length
      ? el("div", { class: "bars" }, hardest.map(function (row) {
          var label = srsLabel(row.id);
          var max = hardest[0].wrong || 1;
          return el("div", { class: "bar-row" }, [
            el("div", {}, [
              el("div", { text: label }),
              el("div", { class: "track" }, [el("span", { style: "width:" + (row.wrong / max * 100) + "%" })])
            ]),
            el("span", { class: "small muted", text: row.wrong + " " + global.I18n.mistakes(row.wrong) })
          ]);
        }))
      : el("p", { class: "empty", text: t("noStats") });

    var histTable = history.length
      ? el("table", { class: "hist" }, [
          el("thead", {}, [el("tr", {}, [
            el("th", { text: t("date") }), el("th", { text: t("score") }), el("th", { text: t("accuracy") })
          ])]),
          el("tbody", {}, history.slice(0, 12).map(function (row) {
            var when = new Date(row.at);
            return el("tr", {}, [
              el("td", { text: when.toLocaleDateString() + " " + when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }),
              el("td", { text: row.correct + " / " + row.total }),
              el("td", { text: Math.round(row.correct / row.total * 100) + "%" })
            ]);
          }))
        ])
      : el("p", { class: "empty", text: t("noStats") });

    return el("div", {}, [
      el("h2", { class: "section", text: t("navStats") }),
      grid,
      el("div", { class: "card" }, [
        el("h3", { class: "group-head", text: t("hardest") }),
        hardestNode
      ]),
      el("div", { class: "card" }, [
        el("h3", { class: "group-head", text: t("lastQuiz") }),
        histTable
      ]),
      el("div", { class: "card" }, [
        el("div", { class: "small muted", style: "margin-bottom:.6rem" }, [
          t("totalLessons") + ": " + global.Store.lessons.length +
          " · " + t("totalWords") + ": " + global.Store.words.length +
          " · " + t("totalGrammar") + ": " + global.Store.grammarQuestions.length +
          " · " + t("totalVerbs") + ": " + global.Store.verbs.length
        ]),
        el("button", {
          class: "btn ghost small", type: "button",
          onclick: function () { if (confirm(t("resetConfirm"))) { global.SRS.reset(); render(); } }
        }, [t("resetProgress") + " — " + global.SRS.active()])
      ])
    ]);
  }

  // ---------- render ----------

  function renderMain() {
    var host = document.getElementById("main");
    host.innerHTML = "";
    var view;
    if (state.view === "quiz") view = state.quiz ? renderQuiz() : renderQuizSetup();
    else if (state.view === "vocab") view = renderVocab();
    else if (state.view === "grammar") view = renderGrammar();
    else view = renderStats();
    host.appendChild(view);
  }

  function render() {
    renderHeader();
    renderMain();
  }

  function onKey(ev) {
    if (state.view !== "quiz" || !state.quiz || state.quiz.done) return;
    if (ev.target && /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName)) return;
    var quiz = state.quiz;
    var question = quiz.questions[quiz.index];
    if (!question) return;
    if (ev.key >= "1" && ev.key <= "4") {
      var index = Number(ev.key) - 1;
      if (question.options[index]) { ev.preventDefault(); answer(question.options[index]); }
    } else if ((ev.key === "Enter" || ev.key === " ") && quiz.answers[quiz.index]) {
      ev.preventDefault();
      next();
    }
  }

  /** Sticky traka u rečniku mora da zna koliko je zaglavlje visoko. */
  function trackHeaderHeight() {
    var header = document.getElementById("header");
    function apply() {
      document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
    }
    apply();
    if (global.ResizeObserver) new global.ResizeObserver(apply).observe(header);
    else global.addEventListener("resize", apply);
  }

  function init() {
    try {
      var saved = localStorage.getItem(LANG_KEY);
      if (saved) global.I18n.set(saved);
    } catch (e) { /* ignore */ }
    document.documentElement.lang = global.I18n.lang === "es" ? "es" : "sr";
    loadPrefs();

    var initialView = viewFromHash();
    if (initialView) state.view = initialView;
    else if (global.history && global.history.replaceState) {
      global.history.replaceState(null, "", ROUTES[state.view]);
    }

    global.Store.load().then(function () {
      if (global.Store.failed.length) {
        console.warn("Nisu učitane lekcije:", global.Store.failed.join(", "));
      }
      document.addEventListener("keydown", onKey);
      global.addEventListener("hashchange", onHashChange);
      if (global.speechSynthesis) {
        global.speechSynthesis.onvoiceschanged = function () { voice = null; };
      }
      render();
      trackHeaderHeight();
    }).catch(function (err) {
      document.getElementById("main").innerHTML =
        '<div class="card empty">Greška pri učitavanju baze: ' + err.message + "</div>";
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})(window);
