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

  /** Ima li reč akcenat ili ñ — tj. ima li smisla upozoriti na pisanje. */
  function hasDiacritics(text) {
    return /[áéíóúüñÁÉÍÓÚÜÑ]/.test(String(text));
  }

  var api = { fold: fold, normalizeAnswer: normalizeAnswer, hasDiacritics: hasDiacritics };

  if (typeof module === "object" && module.exports) module.exports = api;
  else global.TextUtil = api;
})(typeof window !== "undefined" ? window : globalThis);
