# Uputstvo za nedeljnu sesiju

Ovaj repo je statički sajt sa kvizovima iz španskog. Baza pitanja se ne generiše
automatski — ja je pišem jednom nedeljno, na osnovu novih materijala sa časova.

## Postupak

### 1. Nađi šta je novo

```bash
python3 tools/extract.py
```

Skripta skenira Drive folder iz `tools/config.json`, prepoznaje nove i izmenjene
fajlove po sha256 hešu, i izvlači tekst u `staging/`. Čita ODT, DOCX, PPTX i PDF
(PDF preko `pdftotext` iz poppler-a; ako ga nema, pokušava PyMuPDF pa pdfminer).

Fajl bez tekstualnog sloja — skeniran PDF ili slajdovi od slika — dobija `PAZNJA`
u zaglavlju i pojavljuje se pod „Zahtevaju rucno citanje". Takav čitaj direktno
Read alatom; on renderuje strane kao slike i traži `pdftoppm`, takođe iz poppler-a
(`brew install poppler`).

Ako skripta ne prijavi ništa novo, posao je gotov.

**Već pokriveno, ne pravi ponovo:** `9.7 Notas.pdf` je isti sadržaj kao
`9.7 Notas.odt` (lekcija `2026-07-09`), a `23.07 reporte (1).odt` je identična
kopija `23.07 reporte.odt` (lekcija `2026-07-23-reporte`). Skripta ih izvlači jer
su zasebni fajlovi, ali lekcije za njih već postoje.

### 2. Napravi lekciju

Za svaki novi materijal napravi `data/lessons/<GGGG-MM-DD>.js`. Ako je istog
dana bilo više različitih materijala, dodaj sufiks: `2026-07-23-naturaleza.js`.

Fajl poziva globalnu funkciju `lesson({...})`:

```js
lesson({
  id: "2026-08-13",                    // jedinstven, isti kao ime fajla
  date: "2026-08-13",
  source: "notas 13.08.odt",           // originalni fajl iz Drive-a
  title: { es: "…", sr: "…" },
  vocabulary: [
    {
      id: "hace-falta",                // globalno jedinstven slug, bez dijakritika
      es: "hace falta",                // sa članom za imenice: "el techo"
                                       // rečnik ga sam prikaže kao "(el) techo"
                                       // i sortira pod T, a ne pod E
      sr: "potrebno je",
      def: "…",                        // opciono: špansko objašnjenje iz beleški
      pos: "sustantivo|verbo|adjetivo|adverbio|expresión",
      gender: "m|f",                   // opciono, za imenice
      topic: { es: "Expresiones", sr: "Izrazi" },
      forms: ["hace falta"],           // oblici kojima se reč pojavljuje u primerima
      ex: [{ es: "Hace falta estudiar más.", sr: "Potrebno je više učiti." }]
    }
  ],
  grammar: [
    {
      id: "para-por",
      title: { es: "…", sr: "…" },
      explanation: { es: "…", sr: "…" },
      questions: [
        {
          id: "para-por-1",            // globalno jedinstven
          sentence: "Este regalo es ___ ti.",
          options: ["para", "por", "a", "de"],
          answer: "para",
          explain: { es: "…", sr: "…" }
        }
      ]
    }
  ]
});
```

Pravila koja test proverava:

- `id` reči i gramatičkih pitanja su **globalno jedinstveni** kroz sve lekcije.
  Ako se ista reč pojavi u dve lekcije, koristi **isti** `id` — `store.js` će
  spojiti primere i zapamtiti obe lekcije. Tako SRS prati jednu reč, a ne dve.
- Svaka reč ima bar jedan primer, i svaki primer ima srpski prevod.
- Dve reči ne smeju imati **isti srpski prevod** ni **isti španski izraz** —
  inače pitanje o prevodu dobija dva tačna odgovora. Ako su značenja stvarno
  bliska, razdvoj ih (`sudija, žiri` naspram `sudija (u sportu)`) ili ih spoji
  pod jedan `id`.
- `answer` mora biti među `options`, opcije se ne ponavljaju, ima ih bar 2.
- Tačan odgovor se ne sme već videti kao zasebna reč u samoj rečenici.
- `explain` ima i `es` i `sr`.

Za „popuni prazninu" motor traži reč u primeru. Ako se u primeru pojavljuje u
drugom obliku (`caro` → `cara`, `el árbol` → `árboles`), **obavezno** je upiši
u `forms` — inače ta reč neće davati taj tip pitanja.

Primere uzimaj iz beleški. Kad materijal nema primer za neku reč, napiši
kratku rečenicu u duhu ostalih.

### 3. Glagoli

Ako lekcija uvodi glagol koji nije u `data/verbs.js`, dodaj ga:

```js
{ inf: "aterrizar", sr: "sleteti", tenses: ["presente", "indefinido", "perfecto"] }
```

Oblici se **računaju** u `js/conjugator.js` — ne upisuju se ručno. Ako je glagol
nepravilan, dodaj ga u `IRREGULAR` tabelu tamo (redosled lica: yo, tú, él/ella,
nosotros, vosotros, ellos/ellas). Nepravilan futur ide u `FUTURE_STEMS`,
nepravilan particip u `IRREGULAR_PARTICIPLES`. Pravopisne izmene
(-car → qué, -gar → gué, -zar → cé u prvom licu indefinida) se rešavaju pravilom.

Proveri nove oblike pre nego što ih ostaviš — pogrešna konjugacija u kvizu je
gora nego da glagola nema.

### 4. Regeneriši manifest i proveri

```bash
python3 tools/manifest.py
node tools/selftest.js
```

`manifest.py` uz spisak lekcija računa i verziju (heš sadržaja svih js/css/data
fajlova) pa je upisuje kao `?v=…` u `index.html` i kao `ASSET_VERSION` u
`manifest.js`. Zato ga pokreni **posle poslednje izmene** — inače bi browser
mogao da pomeša staru i novu verziju fajlova iz keša. `selftest.js` to proverava
i javlja ako je verzija zastarela.

Test mora da prođe bez ijednog problema. Ispisuje i koliko reči može da da
pitanje tipa „popuni prazninu" — ako taj broj primetno zaostaje za ukupnim
brojem reči, znači da fale `forms`.

### 5. Vizuelna provera i commit

```bash
python3 -m http.server 8777    # pa otvori http://localhost:8777/
git add -A
git commit -m "lekcija 13.08: …"
git push
```

GitHub Pages objavljuje `main` granu automatski.

## Šta ne dirati

- `data/manifest.js` — generiše ga `tools/manifest.py`.
- `tools/state.json` — heševi obrađenih fajlova. Obriši ga samo ako namerno
  hoćeš da se sve ponovo izvuče (`python3 tools/extract.py --all` radi isto,
  bez brisanja).
- `tools/config.json` — lokalna putanja, van gita.

## Stil

- Interfejs je dvojezičan: svaki novi tekst u `js/i18n.js` ide i u `sr` i u `es`.
- Prevodi na srpski: latinica, prirodan jezik, bez doslovnog kalkiranja.
- Kod je ES5 bez build koraka — bez `import`, bez strelica u fajlovima koji se
  učitavaju u browseru samo ako to ne narušava postojeći stil datoteke.
