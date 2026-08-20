# Učim španski

Interaktivni kvizovi napravljeni od beleški sa mojih časova španskog.
Statički sajt — bez servera, bez build koraka, bez zavisnosti.

**Uživo:** https://maleksandar.github.io/ucim-spanski/

## Šta ume

- **Kviz** sa pet tipova pitanja: prevod ŠPA→SRP, prevod SRP→ŠPA, popuni prazninu
  u rečenici iz beleški, gramatika i konjugacija glagola.
- **Pametno ponavljanje (SRS)** — Leitner sistem sa pet nivoa. Reč koju pogrešiš
  vraća se odmah, reč koju znaš tek za tri nedelje. Sve u `localStorage`.
- **Profili** — više osoba na istom browseru, svaka sa svojim napretkom.
- **Rečnik** — sve reči sa prevodom, objašnjenjem i primerima iz časova;
  pretraga, filtriranje po temi i lekciji, izgovor preko sinteze govora.
- **Gramatika** — sve teme iz beleški sa objašnjenjem i dugmetom „vežbaj ovu temu".
- **Napredak** — šta je naučeno, šta čeka ponavljanje, najteže reči, istorija kvizova.
- **Dvojezični interfejs** — prekidač ES/SR menja ceo sajt.

## Struktura

```
index.html            ulazna tačka
css/style.css         stil (svetla i tamna tema)
js/i18n.js            prevodi interfejsa
js/conjugator.js      konjugacija glagola (pravilni + tabela nepravilnih)
js/store.js           učitavanje baze i spajanje duplikata
js/srs.js             Leitner ponavljanje + profili
js/quiz.js            sastavljanje pitanja
js/app.js             UI
data/manifest.js      spisak lekcija (generisan)
data/lessons/*.js     jedna lekcija = jedan fajl
data/verbs.js         glagoli za konjugaciju
tools/extract.py      izvlačenje teksta iz Drive materijala
tools/manifest.py     regenerisanje manifesta
tools/selftest.js     provera baze i kviz motora
staging/*.txt         izvučen tekst, ulaz za nedeljnu sesiju
```

## Nedeljni ritual

```bash
python3 tools/extract.py     # nađi nove materijale u Drive folderu
# → pokreni sesiju sa Claude-om (vidi CLAUDE.md)
node tools/selftest.js       # provera
git add -A && git commit -m "lekcija: ..." && git push
```

Detalji su u [CLAUDE.md](CLAUDE.md).

## Lokalno pokretanje

```bash
python3 -m http.server 8777
open http://localhost:8777/
```

## Podešavanje

`tools/config.json` (nije u gitu) pokazuje na Drive folder sa materijalima:

```bash
cp tools/config.example.json tools/config.json
# pa upiši putanju u "source_dir"
```
