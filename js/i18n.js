/* Prevodi interfejsa. Prekidač ES/SR menja ceo UI. */
(function (global) {
  "use strict";

  var STRINGS = {
    sr: {
      appName: "Učim španski",
      tagline: "Kvizovi iz mojih časova španskog",
      navQuiz: "Kviz",
      navVocab: "Rečnik",
      navGrammar: "Gramatika",
      navStats: "Napredak",
      profile: "Profil",
      addProfile: "Novi profil",
      profileName: "Ime profila",
      switchProfile: "Promeni profil",

      startQuiz: "Pokreni kviz",
      quizLength: "Broj pitanja",
      quizTypes: "Tipovi pitanja",
      quizSource: "Iz kojih lekcija",
      allLessons: "Sve lekcije",
      typeEsSr: "Prevod ŠPA → SRP",
      typeSrEs: "Prevod SRP → ŠPA",
      typeCloze: "Popuni prazninu",
      typeGrammar: "Gramatika",
      typeConjug: "Konjugacija",
      mode: "Režim",
      modeSrs: "Pametni izbor (ponavljanje)",
      modeRandom: "Nasumično",
      modeSrsHint: "Prvo vraća reči koje si grešio ili odavno nisi video.",
      modeRandomHint: "Bira potpuno nasumično iz cele baze.",

      question: "Pitanje",
      of: "od",
      correct: "Tačno!",
      wrong: "Netačno",
      correctAnswer: "Tačan odgovor",
      next: "Dalje",
      finish: "Završi",
      skip: "Preskoči",
      showExample: "Primer",
      results: "Rezultat",
      score: "Poeni",
      accuracy: "Tačnost",
      again: "Još jedan kviz",
      backHome: "Nazad",
      reviewMistakes: "Pregled grešaka",
      noMistakes: "Bez grešaka — svaka čast!",
      quizEmpty: "Nema pitanja za izabrane filtere. Uključi još tipova ili lekcija.",

      searchPlaceholder: "Traži reč ili prevod…",
      sortBy: "Redosled",
      ddSearch: "Traži…",
      ddClear: "Poništi izbor",
      ddEmpty: "Nema rezultata.",
      sortAlpha: "Abecedno (ŠPA)",
      sortLesson: "Po lekciji",
      sortTopic: "Po temi",
      filterTopic: "Tema",
      filterPos: "Vrsta reči",
      filterLesson: "Lekcija",
      all: "Sve",
      wordsShown: "prikazano reči",
      noResults: "Nema rezultata.",
      examples: "Primeri",
      noExample: "(nedostaje primer)",
      showFormsVerb: "Pokaži promene po licima i vremenima",
      showFormsNoun: "Pokaži jedninu i množinu",
      showFormsAdj: "Pokaži rod i broj",
      hideForms: "Sakrij promene",
      singular: "jednina",
      plural: "množina",
      masculine: "muški rod",
      feminine: "ženski rod",
      posFilter: "Vrsta reči",
      posPlural: {
        sustantivo: "Imenice", verbo: "Glagoli", adjetivo: "Pridevi",
        adverbio: "Prilozi", "expresión": "Izrazi"
      },
      posShort: {
        sustantivo: "imen.", verbo: "glag.", adjetivo: "prid.",
        adverbio: "pril.", "expresión": "izr."
      },
      typeShort: {
        "es-sr": "ŠPA→SRP", "sr-es": "SRP→ŠPA", cloze: "praznina",
        grammar: "gramatika", conjug: "konjugacija"
      },
      allTypes: "svi tipovi",
      quizColumn: "Kviz",
      menu: "Meni",
      previous: "Nazad",
      definition: "Objašnjenje",
      lesson: "Lekcija",
      listen: "Izgovor",

      totalWords: "Reči u bazi",
      totalGrammar: "Gramatičkih pitanja",
      totalVerbs: "Glagola",
      totalLessons: "Lekcija",
      answered: "Odgovoreno",
      known: "Naučeno",
      learning: "U učenju",
      due: "Za ponavljanje",
      unseen: "Još neviđeno",
      hardest: "Najteže reči",
      resetProgress: "Obriši napredak",
      resetConfirm: "Sigurno? Ovo briše ceo napredak ovog profila.",
      noStats: "Još nema podataka — uradi prvi kviz.",
      streak: "Niz tačnih",
      lastQuiz: "Poslednji kviz",
      level: "Nivo",
      date: "Datum",

      grammarTopics: "Gramatičke teme",
      practice: "Vežbaj ovu temu",
      pos: { sustantivo: "imenica", verbo: "glagol", adjetivo: "pridev", adverbio: "prilog", "expresión": "izraz" },
      tense: { presente: "prezent", indefinido: "indefinido (prosta prošlost)", imperfecto: "imperfekat", futuro: "futur", perfecto: "perfekat" },
      conjugPrompt: "Koji je oblik glagola",
      forPerson: "za lice"
    },

    es: {
      appName: "Aprendo español",
      tagline: "Cuestionarios de mis clases de español",
      navQuiz: "Cuestionario",
      navVocab: "Vocabulario",
      navGrammar: "Gramática",
      navStats: "Progreso",
      profile: "Perfil",
      addProfile: "Nuevo perfil",
      profileName: "Nombre del perfil",
      switchProfile: "Cambiar de perfil",

      startQuiz: "Empezar el cuestionario",
      quizLength: "Número de preguntas",
      quizTypes: "Tipos de pregunta",
      quizSource: "De qué clases",
      allLessons: "Todas las clases",
      typeEsSr: "Traducción ES → SR",
      typeSrEs: "Traducción SR → ES",
      typeCloze: "Completa la frase",
      typeGrammar: "Gramática",
      typeConjug: "Conjugación",
      mode: "Modo",
      modeSrs: "Repaso inteligente",
      modeRandom: "Aleatorio",
      modeSrsHint: "Primero repite las palabras que fallaste o que hace tiempo que no ves.",
      modeRandomHint: "Elige al azar de toda la base.",

      question: "Pregunta",
      of: "de",
      correct: "¡Correcto!",
      wrong: "Incorrecto",
      correctAnswer: "Respuesta correcta",
      next: "Siguiente",
      finish: "Terminar",
      skip: "Saltar",
      showExample: "Ejemplo",
      results: "Resultado",
      score: "Puntos",
      accuracy: "Aciertos",
      again: "Otro cuestionario",
      backHome: "Volver",
      reviewMistakes: "Repasar los fallos",
      noMistakes: "¡Sin fallos, enhorabuena!",
      quizEmpty: "No hay preguntas con estos filtros. Activa más tipos o más clases.",

      searchPlaceholder: "Busca una palabra o traducción…",
      sortBy: "Orden",
      ddSearch: "Buscar…",
      ddClear: "Borrar la selección",
      ddEmpty: "Sin resultados.",
      sortAlpha: "Alfabético (ES)",
      sortLesson: "Por clase",
      sortTopic: "Por tema",
      filterTopic: "Tema",
      filterPos: "Categoría",
      filterLesson: "Clase",
      all: "Todo",
      wordsShown: "palabras mostradas",
      noResults: "Sin resultados.",
      examples: "Ejemplos",
      noExample: "(falta un ejemplo)",
      showFormsVerb: "Mostrar la conjugación",
      showFormsNoun: "Mostrar singular y plural",
      showFormsAdj: "Mostrar género y número",
      hideForms: "Ocultar las formas",
      singular: "singular",
      plural: "plural",
      masculine: "masculino",
      feminine: "femenino",
      posFilter: "Categoría",
      posPlural: {
        sustantivo: "Sustantivos", verbo: "Verbos", adjetivo: "Adjetivos",
        adverbio: "Adverbios", "expresión": "Expresiones"
      },
      posShort: {
        sustantivo: "sust.", verbo: "verb.", adjetivo: "adj.",
        adverbio: "adv.", "expresión": "expr."
      },
      typeShort: {
        "es-sr": "ES→SR", "sr-es": "SR→ES", cloze: "frase",
        grammar: "gramática", conjug: "conjugación"
      },
      allTypes: "todos los tipos",
      quizColumn: "Cuestionario",
      menu: "Menú",
      previous: "Anterior",
      definition: "Explicación",
      lesson: "Clase",
      listen: "Escuchar",

      totalWords: "Palabras en la base",
      totalGrammar: "Preguntas de gramática",
      totalVerbs: "Verbos",
      totalLessons: "Clases",
      answered: "Respondidas",
      known: "Aprendidas",
      learning: "En proceso",
      due: "Para repasar",
      unseen: "Sin ver",
      hardest: "Palabras más difíciles",
      resetProgress: "Borrar el progreso",
      resetConfirm: "¿Seguro? Esto borra todo el progreso de este perfil.",
      noStats: "Todavía no hay datos: haz tu primer cuestionario.",
      streak: "Racha de aciertos",
      lastQuiz: "Último cuestionario",
      level: "Nivel",
      date: "Fecha",

      grammarTopics: "Temas de gramática",
      practice: "Practicar este tema",
      pos: { sustantivo: "sustantivo", verbo: "verbo", adjetivo: "adjetivo", adverbio: "adverbio", "expresión": "expresión" },
      tense: { presente: "presente", indefinido: "pretérito indefinido", imperfecto: "pretérito imperfecto", futuro: "futuro", perfecto: "pretérito perfecto" },
      conjugPrompt: "¿Cuál es la forma del verbo",
      forPerson: "para la persona"
    }
  };

  var current = "sr";

  // srpski menja oblik uz broj: 1 greška, 2-4 greške, 5+ grešaka
  var PLURALS = {
    sr: function (n) {
      var mod10 = n % 10, mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) return "greška";
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "greške";
      return "grešaka";
    },
    es: function (n) { return n === 1 ? "fallo" : "fallos"; }
  };

  var LESSON_PLURALS = {
    sr: function (n) {
      var mod10 = n % 10, mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) return n + " lekcija";
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return n + " lekcije";
      return n + " lekcija";
    },
    es: function (n) { return n + (n === 1 ? " clase" : " clases"); }
  };

  var TOPIC_PLURALS = {
    sr: function (n) {
      var mod10 = n % 10, mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) return n + " tema";
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return n + " teme";
      return n + " tema";
    },
    es: function (n) { return n + (n === 1 ? " tema" : " temas"); }
  };

  var api = {
    get lang() { return current; },
    mistakes: function (n) { return PLURALS[current](n); },
    lessonsCount: function (n) { return LESSON_PLURALS[current](n); },
    topicsCount: function (n) { return TOPIC_PLURALS[current](n); },
    set: function (lang) {
      if (STRINGS[lang]) current = lang;
      return current;
    },
    t: function (key) {
      var value = STRINGS[current][key];
      return value === undefined ? key : value;
    },
    /** Za objekte oblika {es, sr} u podacima. */
    pick: function (obj) {
      if (!obj) return "";
      if (typeof obj === "string") return obj;
      return obj[current] || obj.es || obj.sr || "";
    }
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  else global.I18n = api;
})(typeof window !== "undefined" ? window : globalThis);
