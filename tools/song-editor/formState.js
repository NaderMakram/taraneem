"use strict";

(function exposeFormState() {
  function isDirty(form, baseline) {
    return JSON.stringify(form) !== baseline;
  }

  if (typeof module === "object" && module.exports) module.exports = { isDirty };
  else window.editorFormState = { isDirty };
})();
