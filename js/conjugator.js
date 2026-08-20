/* Konjugacija španskih glagola.
 *
 * Pravilni glagoli se izvode po nastavcima; nepravilni imaju eksplicitnu
 * tabelu oblika po vremenu. Sve što nije u tabeli tretira se kao pravilno,
 * uz pravopisne izmene (-car/-gar/-zar u prvom licu indefinida).
 */
(function (global) {
  "use strict";

  var PERSONS = ["yo", "tú", "él/ella", "nosotros", "vosotros", "ellos/ellas"];

  var REGULAR = {
    presente: {
      ar: ["o", "as", "a", "amos", "áis", "an"],
      er: ["o", "es", "e", "emos", "éis", "en"],
      ir: ["o", "es", "e", "imos", "ís", "en"]
    },
    indefinido: {
      ar: ["é", "aste", "ó", "amos", "asteis", "aron"],
      er: ["í", "iste", "ió", "imos", "isteis", "ieron"],
      ir: ["í", "iste", "ió", "imos", "isteis", "ieron"]
    },
    imperfecto: {
      ar: ["aba", "abas", "aba", "ábamos", "abais", "aban"],
      er: ["ía", "ías", "ía", "íamos", "íais", "ían"],
      ir: ["ía", "ías", "ía", "íamos", "íais", "ían"]
    }
  };

  var FUTURO_ENDINGS = ["é", "ás", "á", "emos", "éis", "án"];

  // nepravilne osnove za futur (na njih se lepe FUTURO_ENDINGS)
  var FUTURE_STEMS = {
    tener: "tendr", poder: "podr", poner: "pondr", venir: "vendr", salir: "saldr",
    saber: "sabr", querer: "querr", hacer: "har", decir: "dir", haber: "habr",
    mantener: "mantendr", prevenir: "prevendr", convenir: "convendr",
    detener: "detendr", posponer: "pospondr",
    "reír": "reir"
  };

  var IRREGULAR_PARTICIPLES = {
    hacer: "hecho", decir: "dicho", ver: "visto", poner: "puesto", volver: "vuelto",
    escribir: "escrito", abrir: "abierto", descubrir: "descubierto", romper: "roto",
    morir: "muerto", cubrir: "cubierto", resolver: "resuelto", devolver: "devuelto",
    posponer: "pospuesto"
  };

  // [yo, tú, él/ella, nosotros, vosotros, ellos/ellas]
  var IRREGULAR = {
    ser: {
      presente: ["soy", "eres", "es", "somos", "sois", "son"],
      indefinido: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
      imperfecto: ["era", "eras", "era", "éramos", "erais", "eran"]
    },
    estar: {
      presente: ["estoy", "estás", "está", "estamos", "estáis", "están"],
      indefinido: ["estuve", "estuviste", "estuvo", "estuvimos", "estuvisteis", "estuvieron"]
    },
    tener: {
      presente: ["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"],
      indefinido: ["tuve", "tuviste", "tuvo", "tuvimos", "tuvisteis", "tuvieron"]
    },
    ir: {
      presente: ["voy", "vas", "va", "vamos", "vais", "van"],
      indefinido: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
      imperfecto: ["iba", "ibas", "iba", "íbamos", "ibais", "iban"]
    },
    hacer: {
      presente: ["hago", "haces", "hace", "hacemos", "hacéis", "hacen"],
      indefinido: ["hice", "hiciste", "hizo", "hicimos", "hicisteis", "hicieron"]
    },
    decir: {
      presente: ["digo", "dices", "dice", "decimos", "decís", "dicen"],
      indefinido: ["dije", "dijiste", "dijo", "dijimos", "dijisteis", "dijeron"]
    },
    poder: {
      presente: ["puedo", "puedes", "puede", "podemos", "podéis", "pueden"],
      indefinido: ["pude", "pudiste", "pudo", "pudimos", "pudisteis", "pudieron"]
    },
    poner: {
      presente: ["pongo", "pones", "pone", "ponemos", "ponéis", "ponen"],
      indefinido: ["puse", "pusiste", "puso", "pusimos", "pusisteis", "pusieron"]
    },
    venir: {
      presente: ["vengo", "vienes", "viene", "venimos", "venís", "vienen"],
      indefinido: ["vine", "viniste", "vino", "vinimos", "vinisteis", "vinieron"]
    },
    salir: {
      presente: ["salgo", "sales", "sale", "salimos", "salís", "salen"]
    },
    saber: {
      presente: ["sé", "sabes", "sabe", "sabemos", "sabéis", "saben"],
      indefinido: ["supe", "supiste", "supo", "supimos", "supisteis", "supieron"]
    },
    querer: {
      presente: ["quiero", "quieres", "quiere", "queremos", "queréis", "quieren"],
      indefinido: ["quise", "quisiste", "quiso", "quisimos", "quisisteis", "quisieron"]
    },
    dar: {
      presente: ["doy", "das", "da", "damos", "dais", "dan"],
      indefinido: ["di", "diste", "dio", "dimos", "disteis", "dieron"]
    },
    ver: {
      presente: ["veo", "ves", "ve", "vemos", "veis", "ven"],
      indefinido: ["vi", "viste", "vio", "vimos", "visteis", "vieron"],
      imperfecto: ["veía", "veías", "veía", "veíamos", "veíais", "veían"]
    },
    haber: {
      presente: ["he", "has", "ha", "hemos", "habéis", "han"],
      indefinido: ["hube", "hubiste", "hubo", "hubimos", "hubisteis", "hubieron"]
    },
    volver: {
      presente: ["vuelvo", "vuelves", "vuelve", "volvemos", "volvéis", "vuelven"]
    },
    encontrar: {
      presente: ["encuentro", "encuentras", "encuentra", "encontramos", "encontráis", "encuentran"]
    },
    pensar: {
      presente: ["pienso", "piensas", "piensa", "pensamos", "pensáis", "piensan"]
    },
    probar: {
      presente: ["pruebo", "pruebas", "prueba", "probamos", "probáis", "prueban"]
    },
    jugar: {
      presente: ["juego", "juegas", "juega", "jugamos", "jugáis", "juegan"]
    },
    empezar: {
      presente: ["empiezo", "empiezas", "empieza", "empezamos", "empezáis", "empiezan"]
    },
    dormir: {
      presente: ["duermo", "duermes", "duerme", "dormimos", "dormís", "duermen"],
      indefinido: ["dormí", "dormiste", "durmió", "dormimos", "dormisteis", "durmieron"]
    },
    sentir: {
      presente: ["siento", "sientes", "siente", "sentimos", "sentís", "sienten"],
      indefinido: ["sentí", "sentiste", "sintió", "sentimos", "sentisteis", "sintieron"]
    },
    pedir: {
      presente: ["pido", "pides", "pide", "pedimos", "pedís", "piden"],
      indefinido: ["pedí", "pediste", "pidió", "pedimos", "pedisteis", "pidieron"]
    },
    seguir: {
      presente: ["sigo", "sigues", "sigue", "seguimos", "seguís", "siguen"],
      indefinido: ["seguí", "seguiste", "siguió", "seguimos", "seguisteis", "siguieron"]
    },
    medir: {
      presente: ["mido", "mides", "mide", "medimos", "medís", "miden"],
      indefinido: ["medí", "mediste", "midió", "medimos", "medisteis", "midieron"]
    },
    crecer: {
      presente: ["crezco", "creces", "crece", "crecemos", "crecéis", "crecen"]
    },
    conocer: {
      presente: ["conozco", "conoces", "conoce", "conocemos", "conocéis", "conocen"]
    },
    parecer: {
      presente: ["parezco", "pareces", "parece", "parecemos", "parecéis", "parecen"]
    },
    proteger: {
      presente: ["protejo", "proteges", "protege", "protegemos", "protegéis", "protegen"]
    },
    traducir: {
      presente: ["traduzco", "traduces", "traduce", "traducimos", "traducís", "traducen"],
      indefinido: ["traduje", "tradujiste", "tradujo", "tradujimos", "tradujisteis", "tradujeron"]
    },
    cerrar: {
      presente: ["cierro", "cierras", "cierra", "cerramos", "cerráis", "cierran"]
    },
    regar: {
      presente: ["riego", "riegas", "riega", "regamos", "regáis", "riegan"]
    },
    encender: {
      presente: ["enciendo", "enciendes", "enciende", "encendemos", "encendéis", "encienden"]
    },
    invertir: {
      presente: ["invierto", "inviertes", "invierte", "invertimos", "invertís", "invierten"],
      indefinido: ["invertí", "invertiste", "invirtió", "invertimos", "invertisteis", "invirtieron"]
    },
    mantener: {
      presente: ["mantengo", "mantienes", "mantiene", "mantenemos", "mantenéis", "mantienen"],
      indefinido: ["mantuve", "mantuviste", "mantuvo", "mantuvimos", "mantuvisteis", "mantuvieron"]
    },
    comprobar: {
      presente: ["compruebo", "compruebas", "comprueba", "comprobamos", "comprobáis", "comprueban"]
    },
    prevenir: {
      presente: ["prevengo", "previenes", "previene", "prevenimos", "prevenís", "previenen"],
      indefinido: ["previne", "previniste", "previno", "previnimos", "previnisteis", "previnieron"]
    },
    convenir: {
      presente: ["convengo", "convienes", "conviene", "convenimos", "convenís", "convienen"],
      indefinido: ["convine", "conviniste", "convino", "convinimos", "convinisteis", "convinieron"]
    },
    leer: {
      indefinido: ["leí", "leíste", "leyó", "leímos", "leísteis", "leyeron"]
    },
    reír: {
      presente: ["río", "ríes", "ríe", "reímos", "reís", "ríen"],
      indefinido: ["reí", "reíste", "rio", "reímos", "reísteis", "rieron"]
    },
    andar: {
      indefinido: ["anduve", "anduviste", "anduvo", "anduvimos", "anduvisteis", "anduvieron"]
    },
    sonar: {
      presente: ["sueno", "suenas", "suena", "sonamos", "sonáis", "suenan"]
    },
    vestir: {
      presente: ["visto", "vistes", "viste", "vestimos", "vestís", "visten"],
      indefinido: ["vestí", "vestiste", "vistió", "vestimos", "vestisteis", "vistieron"]
    },
    posponer: {
      presente: ["pospongo", "pospones", "pospone", "posponemos", "posponéis", "posponen"],
      indefinido: ["pospuse", "pospusiste", "pospuso", "pospusimos", "pospusisteis", "pospusieron"]
    },
    contribuir: {
      presente: ["contribuyo", "contribuyes", "contribuye", "contribuimos", "contribuís", "contribuyen"],
      indefinido: ["contribuí", "contribuiste", "contribuyó", "contribuimos", "contribuisteis", "contribuyeron"]
    },
    concertar: {
      presente: ["concierto", "conciertas", "concierta", "concertamos", "concertáis", "conciertan"]
    },
    detener: {
      presente: ["detengo", "detienes", "detiene", "detenemos", "detenéis", "detienen"],
      indefinido: ["detuve", "detuviste", "detuvo", "detuvimos", "detuvisteis", "detuvieron"]
    }
  };

  var ENDING_ALIASES = { "ár": "ar", "ér": "er", "ír": "ir" };

  function stemAndEnding(infinitive) {
    var raw = infinitive.slice(-2);
    return { stem: infinitive.slice(0, -2), ending: ENDING_ALIASES[raw] || raw };
  }

  // -car → qué, -gar → gué, -zar → cé  (samo prvo lice indefinida)
  function spellingFix(stem, ending, tense, index) {
    if (tense !== "indefinido" || ending !== "ar" || index !== 0) return stem;
    if (/c$/.test(stem)) return stem.slice(0, -1) + "qu";
    if (/g$/.test(stem)) return stem + "u";
    if (/z$/.test(stem)) return stem.slice(0, -1) + "c";
    return stem;
  }

  function participle(infinitive) {
    if (IRREGULAR_PARTICIPLES[infinitive]) return IRREGULAR_PARTICIPLES[infinitive];
    var parts = stemAndEnding(infinitive);
    if (parts.ending === "ar") return parts.stem + "ado";
    // osnova na samoglasnik traži naglasak: leer → leído, reír → reído
    if (/[aeo]$/.test(parts.stem)) return parts.stem + "ído";
    return parts.stem + "ido";
  }

  /** Vraća niz od šest oblika, po licima iz PERSONS. */
  function conjugate(infinitive, tense) {
    var base = infinitive.replace(/se$/, ""); // reírse → reír
    var irregular = IRREGULAR[base];
    if (irregular && irregular[tense]) return irregular[tense].slice();

    if (tense === "perfecto") {
      var part = participle(base);
      return conjugate("haber", "presente").map(function (aux) {
        return aux + " " + part;
      });
    }

    var parts = stemAndEnding(base);
    if (tense === "futuro") {
      var stem = FUTURE_STEMS[base] || base;
      return FUTURO_ENDINGS.map(function (end) { return stem + end; });
    }

    var table = REGULAR[tense];
    if (!table) throw new Error("Nepoznato vreme: " + tense);
    var endings = table[parts.ending];
    if (!endings) throw new Error("Neispravan infinitiv: " + infinitive);

    return endings.map(function (end, i) {
      return spellingFix(parts.stem, parts.ending, tense, i) + end;
    });
  }

  var api = {
    PERSONS: PERSONS,
    TENSES: ["presente", "indefinido", "imperfecto", "futuro", "perfecto"],
    conjugate: conjugate,
    participle: participle,
    isIrregular: function (infinitive) {
      var base = infinitive.replace(/se$/, "");
      return Boolean(IRREGULAR[base] || FUTURE_STEMS[base] || IRREGULAR_PARTICIPLES[base]);
    }
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  else global.Conjugator = api;
})(typeof window !== "undefined" ? window : globalThis);
