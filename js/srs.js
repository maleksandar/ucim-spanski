/* Leitner sistem sa profilima. Sve stoji u localStorage, po profilu. */
(function (global) {
  "use strict";

  var KEY = "ucim-spanski/v1";
  var DAY = 24 * 60 * 60 * 1000;
  // razmak u danima po nivou: nivo 1 se vraća odmah, nivo 5 tek za tri nedelje
  var INTERVALS = [0, 0, 1, 3, 7, 21];
  var MAX_LEVEL = 5;

  function today() { return Date.now(); }

  function blank() {
    return { profiles: { "Ja": emptyProfile() }, active: "Ja" };
  }

  function emptyProfile() {
    return { items: {}, history: [], created: today() };
  }

  function read() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return blank();
      var data = JSON.parse(raw);
      if (!data.profiles || !data.active || !data.profiles[data.active]) return blank();
      return data;
    } catch (err) {
      return blank();
    }
  }

  function write(data) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      /* privatni režim ili pun storage — kviz i dalje radi, samo se ne pamti */
    }
  }

  var state = read();

  var SRS = {
    profiles: function () { return Object.keys(state.profiles); },
    active: function () { return state.active; },

    setActive: function (name) {
      if (!state.profiles[name]) state.profiles[name] = emptyProfile();
      state.active = name;
      write(state);
    },

    addProfile: function (name) {
      name = String(name || "").trim();
      if (!name) return false;
      if (state.profiles[name]) { SRS.setActive(name); return true; }
      state.profiles[name] = emptyProfile();
      state.active = name;
      write(state);
      return true;
    },

    removeProfile: function (name) {
      if (Object.keys(state.profiles).length <= 1) return false;
      delete state.profiles[name];
      if (state.active === name) state.active = Object.keys(state.profiles)[0];
      write(state);
      return true;
    },

    current: function () { return state.profiles[state.active]; },

    item: function (id) {
      return SRS.current().items[id] || null;
    },

    /** true ako je stavka spremna za ponavljanje (ili je nikad nismo videli). */
    isDue: function (id) {
      var item = SRS.item(id);
      if (!item) return true;
      return item.due <= today();
    },

    /** Manji broj = veći prioritet u izboru pitanja. */
    priority: function (id) {
      var item = SRS.item(id);
      if (!item) return 1;             // nove reči odmah posle zaostalih
      var overdue = today() - item.due;
      if (overdue < 0) return 100 + item.level;
      return -overdue / DAY;           // što duže kasni, to ranije dolazi
    },

    record: function (id, isCorrect) {
      var profile = SRS.current();
      var item = profile.items[id];
      if (!item) item = profile.items[id] = { level: 1, seen: 0, wrong: 0, due: today() };
      item.seen += 1;
      if (isCorrect) {
        item.level = Math.min(MAX_LEVEL, item.level + 1);
      } else {
        item.wrong += 1;
        item.level = 1;
      }
      item.last = today();
      item.due = today() + INTERVALS[item.level] * DAY;
      write(state);
    },

    finishQuiz: function (summary) {
      var profile = SRS.current();
      profile.history.push({
        at: today(),
        total: summary.total,
        correct: summary.correct,
        types: summary.types
      });
      if (profile.history.length > 200) profile.history = profile.history.slice(-200);
      write(state);
    },

    stats: function (allIds) {
      var profile = SRS.current();
      var counts = { known: 0, learning: 0, due: 0, unseen: 0, answered: 0, wrong: 0 };
      var now = today();
      allIds.forEach(function (id) {
        var item = profile.items[id];
        if (!item) { counts.unseen += 1; return; }
        counts.answered += item.seen;
        counts.wrong += item.wrong;
        if (item.level >= 4) counts.known += 1; else counts.learning += 1;
        if (item.due <= now) counts.due += 1;
      });
      return counts;
    },

    hardest: function (limit) {
      var items = SRS.current().items;
      return Object.keys(items)
        .map(function (id) { return { id: id, wrong: items[id].wrong, seen: items[id].seen, level: items[id].level }; })
        .filter(function (r) { return r.wrong > 0; })
        .sort(function (a, b) { return b.wrong - a.wrong || a.level - b.level; })
        .slice(0, limit || 10);
    },

    history: function () { return SRS.current().history.slice().reverse(); },

    reset: function () {
      state.profiles[state.active] = emptyProfile();
      write(state);
    }
  };

  global.SRS = SRS;
})(window);
