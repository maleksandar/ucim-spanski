/* Normalizacija teksta za pretragu, zajednička za rečnik i padajuće liste. */
(function (global) {
  "use strict";

  /** "sección" → "seccion", "drveće" → "drvece" — pretraga bez dijakritika. */
  function fold(text) {
    return String(text)
      .toLowerCase()
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }

  /**
   * Za poređenje upisanog odgovora: bez akcenata, velikih slova, interpunkcije
   * i viška razmaka. "¿Canción?" i "cancion" postaju isto.
   */
  function normalizeAnswer(text) {
    return fold(text)
      .replace(/[¡¿!?.,;:"'«»…]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Levenštajnovo rastojanje: najmanji broj izmena (dodavanje, brisanje ili
   * zamena jednog slova) koje jednu reč prevode u drugu. Koristi se da se
   * odgovor promašen za jedno slovo prepozna kao „skoro tačno“.
   * Ako pređe `limit`, računanje se prekida i vraća se limit + 1.
   */
  function editDistance(a, b, limit) {
    a = String(a);
    b = String(b);
    if (a === b) return 0;
    var max = typeof limit === "number" ? limit : Infinity;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var previous = [];
    for (var j = 0; j <= b.length; j++) previous[j] = j;
    for (var i = 1; i <= a.length; i++) {
      var current = [i];
      var best = i;
      for (var k = 1; k <= b.length; k++) {
        var cost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
        current[k] = Math.min(current[k - 1] + 1, previous[k] + 1, previous[k - 1] + cost);
        if (current[k] < best) best = current[k];
      }
      // ceo red je već preko granice — dalje može samo da raste
      if (best > max) return max + 1;
      previous = current;
    }
    return previous[b.length];
  }

  /** Ima li reč akcenat ili ñ — tj. ima li smisla upozoriti na pisanje. */
  function hasDiacritics(text) {
    return /[áéíóúüñÁÉÍÓÚÜÑ]/.test(String(text));
  }

  var api = {
    fold: fold,
    normalizeAnswer: normalizeAnswer,
    hasDiacritics: hasDiacritics,
    editDistance: editDistance
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  else global.TextUtil = api;
})(typeof window !== "undefined" ? window : globalThis);
