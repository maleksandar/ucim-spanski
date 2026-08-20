/* Provera baze i kviz motora bez browsera:  node tools/selftest.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const crypto = require("crypto");

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

["js/text.js", "js/i18n.js", "js/conjugator.js", "js/inflector.js", "js/store.js", "js/srs.js", "js/quiz.js", "data/manifest.js"].forEach(run);
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

// 5b. pretraga gleda reč, oblike i prevod — nikad primere
const nadji = (q) => S.words.filter((w) => sandbox.Store.matchesSearch(w, q)).map((w) => w.id);
const searchCases = [
  { q: "algun", mora: ["algunas-veces", "alguna-vez", "algun-dia", "algunos-dias"], neSme: ["bosque"] },
  { q: "mesa", mora: ["juego-de-mesa"], neSme: ["ajedrez"] },            // "juego de mesa" je u primeru za ajedrez
  { q: "krov", mora: ["techo"], neSme: [] },                            // srpski prevod
  { q: "arboles", mora: ["arbol"], neSme: [] },                         // oblik reči, bez dijakritike
  { q: "granada", mora: [], neSme: ["tapa", "jardin", "mirador"] }      // Granada se javlja samo u primerima
];
searchCases.forEach(({ q, mora, neSme }) => {
  const hits = nadji(q);
  mora.forEach((id) => {
    if (!hits.includes(id)) problems.push(`pretraga "${q}" ne nalazi ${id}`);
  });
  neSme.forEach((id) => {
    if (hits.includes(id)) problems.push(`pretraga "${q}" pogrešno vraća ${id} (poklapanje iz primera)`);
  });
});

// 5c. promene po licima, rodu i broju: svaka reč ili ima ispravnu tabelu ili je nema namerno
const inflector = sandbox.Inflector;
S.words.forEach((w) => {
  if (w.pos === "verbo") {
    const verb = sandbox.Store.verbFor(w);
    if (!verb) {
      problems.push(`glagol bez promene: ${w.id} (${w.es})`);
      return;
    }
    verb.tenses.forEach((tense) => {
      const forms = sandbox.Conjugator.conjugate(verb.infinitive, tense);
      if (forms.length !== 6 || forms.some((f) => !f || /undefined/.test(f))) {
        problems.push(`loši oblici: ${w.id} ${tense} → ${forms.join(", ")}`);
      }
      if (/se$/.test(verb.infinitive) && !/^(me|te|se|nos|os) /.test(forms[0])) {
        problems.push(`povratni glagol bez zamenice: ${w.id} ${tense} → ${forms[0]}`);
      }
    });
    return;
  }

  if (w.pos === "sustantivo") {
    const noun = inflector.noun(w);
    const excluded = Object.prototype.hasOwnProperty.call(inflector.exceptions, w.id);
    if (!noun && !excluded) problems.push(`imenica bez množine: ${w.id} (${w.es})`);
    if (noun && !noun.plural) problems.push(`imenica bez oblika množine: ${w.id}`);
    // naglasak na poslednjem slogu mora da nestane: avión → aviones, delfín → delfines.
    // Izuzetak je hijat (país → países), gde naglašenom samoglasniku prethodi samoglasnik.
    if (noun && noun.plural && /[^aeiouáéíóú][áéíóú][ns]es\b/.test(noun.plural)) {
      problems.push(`naglasak ostao u množini: ${w.id} → ${noun.plural}`);
    }
    return;
  }

  if (w.pos === "adjetivo") {
    const adj = inflector.adjective(w);
    if (!adj || (!adj.ms && !adj.fs)) problems.push(`pridev bez oblika: ${w.id} (${w.es})`);
    return;
  }

  // prilozi i izrazi se ne menjaju — ne smeju da dobiju tabelu
  if (w.pos === "adverbio" || w.pos === "expresión") {
    if (sandbox.Store.verbFor(w)) problems.push(`nepromenljiva reč dobila konjugaciju: ${w.id}`);
  }
});

// 6. verzija fajlova mora da odgovara sadržaju — inače je zaboravljen tools/manifest.py
const versioned = ["css/style.css"]
  .concat(fs.readdirSync(path.join(repo, "js")).sort().map((f) => "js/" + f))
  .concat(["data/verbs.js"])
  .concat(fs.readdirSync(path.join(repo, "data/lessons")).sort().map((f) => "data/lessons/" + f));
const digest = crypto.createHash("sha256");
versioned.forEach((rel) => {
  digest.update(rel);
  digest.update(fs.readFileSync(path.join(repo, rel)));
});
const expected = digest.digest("hex").slice(0, 8);
if (sandbox.ASSET_VERSION !== expected) {
  problems.push(
    `verzija fajlova je zastarela (${sandbox.ASSET_VERSION} umesto ${expected}) — pokreni: python3 tools/manifest.py`
  );
}

if (problems.length) {
  console.log(`\n${problems.length} PROBLEMA:`);
  problems.slice(0, 40).forEach((p) => console.log("  - " + p));
  process.exit(1);
}
console.log("\nSve provere prolaze.");
