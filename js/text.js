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

  var api = { fold: fold };

  if (typeof module === "object" && module.exports) module.exports = api;
  else global.TextUtil = api;
})(typeof window !== "undefined" ? window : globalThis);
