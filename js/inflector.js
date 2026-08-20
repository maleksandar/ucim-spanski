/* Promena imenica (jednina/množina) i prideva (rod i broj).
 *
 * Radi po pravilima, uz tabelu izuzetaka za reči gde pravilo ne važi.
 * Ako oblik nije siguran, bolje je ne prikazati ga nego prikazati pogrešan —
 * zato `exceptions` ume i da isključi reč (`null`).
 */
(function (global) {
  "use strict";

  var PLAIN = { "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u" };
  // iza ovih reči se ništa ne menja: "mostrador de facturación" → "mostradores de facturación"
  var STOP = ["de", "del", "a", "al", "con", "en", "por", "para", "y", "o", "que", "sin", "sobre"];

  var PLURAL_ARTICLE = { el: "los", la: "las", "el/la": "los/las", un: "unos", una: "unas" };

  // reči kod kojih mehaničko pravilo ne daje dobar oblik; null = ne prikazuj promenu
  var EXCEPTIONS = {
    "numeros-cinco-quince": null,          // unos je spisak brojeva, ne jedna imenica
    "sur": null,                           // strana sveta, množina nema smisla
    "extrema-derecha": null,               // politički pojam, ne broji se
    "primera-clase": null,                 // ustaljen izraz, ostaje u jednini
    "curriculum": { singular: "el currículum", plural: "los currículums" },
    "reel": { singular: "el reel", plural: "los reels" },
    "clase-turista": { singular: "la clase turista", plural: "las clases turista" }
  };

  function hasFinalAccent(word) {
    return /[áéíóú][^aeiouáéíóú]*$/.test(word);
  }

  /**
   * Naglasak nestaje kad množina doda slog: avión → aviones, delfín → delfines.
   * Ali ne kod hijata: país → países, jer í tu i dalje razdvaja slogove.
   */
  function dropFinalAccent(word) {
    return word
      .replace(/([áéíóú])n$/, function (all, vowel) { return PLAIN[vowel] + "n"; })
      .replace(/([áéó])s$/, function (all, vowel) { return PLAIN[vowel] + "s"; })
      .replace(/([^aeiouáéíóú])([íú])s$/, function (all, before, vowel) {
        return before + PLAIN[vowel] + "s";
      });
  }

  /** Množina jedne reči po španskim pravilima. */
  function pluralWord(word) {
    if (!word) return word;
    if (/[aeiou]$/i.test(word)) return word + "s";          // casa → casas
    if (/[áéó]$/i.test(word)) return word + "s";            // café → cafés
    if (/[íú]$/i.test(word)) return word + "es";            // rubí → rubíes
    if (/z$/i.test(word)) return word.slice(0, -1) + "ces"; // nuez → nueces
    if (/[sx]$/i.test(word) && !hasFinalAccent(word)) return word; // lunes → lunes
    return dropFinalAccent(word) + "es";                    // avión → aviones
  }

  /** Množina sintagme: menja se glava i pridevi uz nju, ne i ono iza predloga. */
  function pluralPhrase(phrase) {
    var stopped = false;
    return phrase.split(/\s+/).map(function (token) {
      if (!stopped && STOP.indexOf(token.toLowerCase()) !== -1) stopped = true;
      return stopped ? token : pluralWord(token);
    }).join(" ");
  }

  function firstAlternative(text) {
    return String(text).split("/")[0].trim();
  }

  /** {singular, plural} sa članovima, ili null ako oblik nije pouzdan. */
  function noun(word) {
    if (Object.prototype.hasOwnProperty.call(EXCEPTIONS, word.id)) return EXCEPTIONS[word.id];

    var base = firstAlternative(word.root);
    if (!base) return null;

    var article = word.article;
    var pluralArticle = word.gender === "f" ? "las" : (PLURAL_ARTICLE[article] || "los");

    // unos koji je već u množini ne umemo pouzdano da vratimo u jedninu
    if (article === "los" || article === "las") {
      return { singular: null, plural: article + " " + base };
    }
    return {
      singular: (article ? article + " " : "") + base,
      plural: pluralArticle + " " + pluralPhrase(base)
    };
  }

  /** {ms, fs, mp, fp} — neki od njih mogu biti null kad se oblik ne razlikuje. */
  function adjective(word) {
    if (Object.prototype.hasOwnProperty.call(EXCEPTIONS, word.id)) return EXCEPTIONS[word.id];

    var parts = String(word.es).split("/").map(function (p) { return p.trim(); });
    var masculine = parts[0];
    var feminine = parts[1] || null;

    // unos zapisan u množini ("consecutivos / consecutivas") vrati na jedninu
    if (/os$/.test(masculine) && feminine && /as$/.test(feminine)) {
      masculine = masculine.slice(0, -1);
      feminine = feminine.slice(0, -1);
    }

    if (!feminine) {
      if (/o$/.test(masculine)) feminine = masculine.slice(0, -1) + "a";
      // -or dobija -ora (acogedor → acogedora), ali komparativi ostaju isti:
      // anterior, superior, mejor, peor, mayor, menor
      else if (/or$/.test(masculine) && !/(erior|mejor|peor|mayor|menor)$/.test(masculine)) {
        feminine = masculine + "a";
      }
      else if (/a$/.test(masculine)) {
        // oblik dat samo u ženskom rodu (embarazada) — ne izmišljaj muški
        return { ms: null, fs: masculine, mp: null, fp: pluralWord(masculine) };
      } else feminine = masculine; // impresionante, puntual, rural — isti za oba roda
    }

    return {
      ms: masculine,
      fs: feminine,
      mp: pluralWord(masculine),
      fp: pluralWord(feminine)
    };
  }

  var api = {
    noun: noun,
    adjective: adjective,
    pluralWord: pluralWord,
    pluralPhrase: pluralPhrase,
    exceptions: EXCEPTIONS
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  else global.Inflector = api;
})(typeof window !== "undefined" ? window : globalThis);
