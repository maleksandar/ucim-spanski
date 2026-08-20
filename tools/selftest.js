/* Provera baze i kviz motora bez browsera:  node tools/selftest.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repo = path.join(__dirname, "..");
const sandbox = { console, Math, Date, JSON, Promise, setTimeout };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.localStorage = (() => {
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
})();
vm.createContext(sandbox);

function run(rel) {
  vm.runInContext(fs.readFileSync(path.join(repo, rel), "utf8"), sandbox, { filename: rel });
}

["js/i18n.js", "js/conjugator.js", "js/store.js", "js/srs.js", "js/quiz.js", "data/manifest.js"].forEach(run);
sandbox.LESSON_FILES.forEach((f) => run("data/" + f));
run("data/verbs.js");
sandbox.Store.index();

const S = sandbox.Store;
const problems = [];

// 1. jedinstveni id-jevi i obavezna polja
const seenWord = new Set();
S.words.forEach((w) => {
  if (seenWord.has(w.id)) problems.push(`duplikat reči: ${w.id}`);
  seenWord.add(w.id);
  if (!w.es || !w.sr) problems.push(`nepotpuna reč: ${w.id}`);
  if (!w.ex.length) problems.push(`reč bez primera: ${w.id}`);
  w.ex.forEach((ex) => { if (!ex.sr) problems.push(`primer bez prevoda: ${w.id} — ${ex.es}`); });
});

// 1b. dve reči sa istim prevodom napravile bi pitanje sa dva tačna odgovora
const stripArticle = (t) => t.toLowerCase().replace(/^(el\/la|el|la|los|las)\s+/, "").trim();
const byEs = {};
const bySr = {};
S.words.forEach((w) => {
  (byEs[stripArticle(w.es)] = byEs[stripArticle(w.es)] || []).push(w.id);
  (bySr[w.sr.toLowerCase()] = bySr[w.sr.toLowerCase()] || []).push(w.id);
});
Object.keys(byEs).forEach((k) => {
  if (byEs[k].length > 1) problems.push(`isti španski izraz "${k}" pod id: ${byEs[k].join(", ")}`);
});
Object.keys(bySr).forEach((k) => {
  if (bySr[k].length > 1) problems.push(`isti srpski prevod "${k}" za: ${bySr[k].join(", ")}`);
});

// 1c. ključ za sortiranje: bez člana, bez vodeće interpunkcije, i lista stvarno sortirana
S.words.forEach((w) => {
  if (!w.sortKey || !w.sortKey.trim()) problems.push(`prazan ključ za sortiranje: ${w.id}`);
  if (/^[^0-9A-Za-zÀ-ÖØ-öø-ÿ]/.test(w.sortKey)) {
    problems.push(`ključ počinje interpunkcijom: ${w.id} → ${JSON.stringify(w.sortKey)}`);
  }
  if (w.pos === "sustantivo" && /^(el|la|los|las|un|una|unos|unas)\s/i.test(w.sortKey)) {
    problems.push(`član ostao u ključu: ${w.id} → ${JSON.stringify(w.sortKey)}`);
  }
});
for (let i = 1; i < S.words.length; i++) {
  if (S.words[i - 1].sortKey.localeCompare(S.words[i].sortKey, "es") > 0) {
    problems.push(`redosled narušen: ${S.words[i - 1].es} pre ${S.words[i].es}`);
    break;
  }
}

// 2. gramatička pitanja: tačan odgovor mora biti među ponuđenim
const seenQ = new Set();
S.grammarQuestions.forEach((q) => {
  if (seenQ.has(q.id)) problems.push(`duplikat gram. pitanja: ${q.id}`);
  seenQ.add(q.id);
  if (!q.options.includes(q.answer)) problems.push(`odgovor van opcija: ${q.id}`);
  if (new Set(q.options).size !== q.options.length) problems.push(`ponovljena opcija: ${q.id}`);
  if (q.options.length < 2) problems.push(`premalo opcija: ${q.id}`);
  if (!q.explain || !q.explain.sr || !q.explain.es) problems.push(`objašnjenje nepotpuno: ${q.id}`);
  // odgovor ne sme vec da stoji kao zasebna rec u samoj recenici
  if (q.sentence.includes("___")) {
    const stripped = q.sentence.replace("___", " ");
    const escaped = q.answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "iu").test(stripped)) {
      problems.push(`odgovor vidljiv u rečenici: ${q.id} → ${q.answer}`);
    }
  }
});

// 3. koliko reči uopšte može da da "popuni prazninu"
const clozeReady = S.words.filter((w) =>
  w.ex.some((ex) => sandbox.Quiz.findInSentence(ex.es, sandbox.Quiz.surfaceForms(w)))
);

// 4. generiši kvizove svih tipova i proveri strukturu
const types = ["es-sr", "sr-es", "cloze", "grammar", "conjug"];
types.forEach((type) => {
  const qs = sandbox.Quiz.build({ types: [type], lessons: [], length: 40, mode: "random" });
  if (!qs.length) { problems.push(`tip bez pitanja: ${type}`); return; }
  qs.forEach((q) => {
    if (q.options.length !== 4) problems.push(`${type}: nema 4 opcije — ${q.prompt}`);
    if (!q.options.includes(q.answer)) problems.push(`${type}: odgovor van opcija — ${q.prompt}`);
    if (new Set(q.options).size !== 4) problems.push(`${type}: ponovljena opcija — ${q.prompt} [${q.options}]`);
    if (type === "cloze" && !q.prompt.includes("_____")) problems.push(`cloze bez praznine: ${q.prompt}`);
    if (type === "cloze" && q.prompt.toLowerCase().includes(q.answer.toLowerCase())) {
      problems.push(`cloze otkriva odgovor: ${q.prompt} → ${q.answer}`);
    }
  });
  console.log(`${type.padEnd(8)} → ${qs.length} pitanja`);
});

// 5. mešani kviz + SRS
const mixed = sandbox.Quiz.build({ types, lessons: [], length: 25, mode: "srs" });
console.log(`mešani  → ${mixed.length} pitanja`);
mixed.forEach((q, i) => sandbox.SRS.record(q.srsId, i % 3 !== 0));
const ids = S.words.map((w) => w.id).concat(S.grammarQuestions.map((q) => "g:" + q.id));
console.log("SRS:", JSON.stringify(sandbox.SRS.stats(ids)));

console.log(`\nlekcija: ${S.lessons.length}  reči: ${S.words.length}  gram. tema: ${S.grammar.length}  ` +
  `gram. pitanja: ${S.grammarQuestions.length}  glagola: ${S.verbs.length}`);
console.log(`reči spremnih za "popuni prazninu": ${clozeReady.length} / ${S.words.length}`);

if (problems.length) {
  console.log(`\n${problems.length} PROBLEMA:`);
  problems.slice(0, 40).forEach((p) => console.log("  - " + p));
  process.exit(1);
}
console.log("\nSve provere prolaze.");
