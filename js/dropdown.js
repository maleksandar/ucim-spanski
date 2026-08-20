/* Padajuća lista sa pretragom, jednostrukim ili višestrukim izborom i
 * dugmetom za poništavanje. Nema zavisnosti — vraća gotov DOM čvor. */
(function (global) {
  "use strict";

  var openInstance = null;

  /** Za pretragu bez obzira na dijakritike: "sección" nađe "seccion", "čaj" nađe "caj". */
  function fold(text) {
    return String(text)
      .toLowerCase()
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "class") node.className = attrs[key];
      else if (key === "text") node.textContent = attrs[key];
      else if (key.slice(0, 2) === "on") node.addEventListener(key.slice(2), attrs[key]);
      else if (attrs[key] !== null && attrs[key] !== undefined && attrs[key] !== false) {
        node.setAttribute(key, attrs[key]);
      }
    });
    (children || []).forEach(function (child) {
      if (!child && child !== 0) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function sameValue(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      var sortedA = a.slice().sort();
      var sortedB = b.slice().sort();
      return sortedA.every(function (v, i) { return v === sortedB[i]; });
    }
    return a === b;
  }

  /**
   * config = {
   *   label, placeholder, options: [{value, label}], value,
   *   multiple, defaultValue, searchLabel, clearLabel, emptyLabel,
   *   countLabel: function (n) -> string,
   *   onChange: function (value)
   * }
   */
  function create(config) {
    var multiple = Boolean(config.multiple);
    var defaultValue = config.defaultValue !== undefined ? config.defaultValue : (multiple ? [] : "");
    var value = config.value !== undefined ? config.value : defaultValue;
    var activeIndex = -1;
    var visible = config.options.slice();

    var root = el("div", { class: "dd" });
    var toggle = el("button", {
      class: "dd-toggle", type: "button",
      "aria-haspopup": "listbox", "aria-expanded": "false"
    });
    var valueNode = el("span", { class: "dd-value" });
    var clearBtn = el("button", {
      class: "dd-clear", type: "button",
      title: config.clearLabel || "×", "aria-label": config.clearLabel || "×",
      onclick: function (ev) {
        ev.stopPropagation();
        setValue(defaultValue, true);
        close();
      }
    }, ["×"]);

    toggle.appendChild(el("span", { class: "dd-name", text: config.label || "" }));
    toggle.appendChild(valueNode);
    toggle.appendChild(el("span", { class: "dd-caret", "aria-hidden": "true" }));
    toggle.addEventListener("click", function () { root.dataset.open === "true" ? close() : open(); });

    var search = el("input", {
      class: "dd-search", type: "text", autocomplete: "off",
      placeholder: config.searchLabel || "…",
      oninput: function () { activeIndex = -1; renderList(); },
      onkeydown: onSearchKey
    });
    var list = el("ul", { class: "dd-list", role: "listbox" });
    var panel = el("div", { class: "dd-panel" }, [
      el("div", { class: "dd-search-wrap" }, [search]),
      list
    ]);

    root.appendChild(toggle);
    root.appendChild(clearBtn);
    root.appendChild(panel);
    root.dataset.open = "false";

    function isSelected(optionValue) {
      return multiple ? value.indexOf(optionValue) !== -1 : value === optionValue;
    }

    function renderValue() {
      var text;
      if (multiple) {
        if (!value.length) text = config.placeholder || "";
        else if (value.length === 1) {
          var only = config.options.filter(function (o) { return o.value === value[0]; })[0];
          text = only ? only.label : config.placeholder;
        } else {
          text = config.countLabel ? config.countLabel(value.length) : value.length;
        }
      } else {
        var picked = config.options.filter(function (o) { return o.value === value; })[0];
        text = picked ? picked.label : (config.placeholder || "");
      }
      valueNode.textContent = text;
      root.dataset.dirty = String(!sameValue(value, defaultValue));
    }

    function renderList() {
      var query = fold(search.value.trim());
      visible = query
        ? config.options.filter(function (o) { return fold(o.label).indexOf(query) !== -1; })
        : config.options.slice();

      list.innerHTML = "";
      if (!visible.length) {
        list.appendChild(el("li", { class: "dd-empty", text: config.emptyLabel || "—" }));
        return;
      }
      visible.forEach(function (option, index) {
        var selected = isSelected(option.value);
        list.appendChild(el("li", {
          class: "dd-option" + (selected ? " on" : "") + (index === activeIndex ? " active" : ""),
          role: "option", "aria-selected": String(selected),
          onmousedown: function (ev) { ev.preventDefault(); },
          onclick: function () { choose(option.value); }
        }, [
          el("span", { class: "dd-mark", "aria-hidden": "true" }),
          el("span", { text: option.label })
        ]));
      });
    }

    function choose(optionValue) {
      if (multiple) {
        var next = value.slice();
        var at = next.indexOf(optionValue);
        if (at === -1) next.push(optionValue);
        else next.splice(at, 1);
        setValue(next, true);
        renderList();
      } else {
        setValue(optionValue, true);
        close();
      }
    }

    function setValue(next, notify) {
      value = multiple ? next.slice() : next;
      renderValue();
      if (notify && config.onChange) config.onChange(multiple ? value.slice() : value);
    }

    function onSearchKey(ev) {
      if (ev.key === "Escape") { ev.preventDefault(); close(); toggle.focus(); return; }
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        if (!visible.length) return;
        activeIndex += ev.key === "ArrowDown" ? 1 : -1;
        if (activeIndex < 0) activeIndex = visible.length - 1;
        if (activeIndex >= visible.length) activeIndex = 0;
        renderList();
        var activeNode = list.children[activeIndex];
        if (activeNode && activeNode.scrollIntoView) activeNode.scrollIntoView({ block: "nearest" });
        return;
      }
      if (ev.key === "Enter") {
        ev.preventDefault();
        var pick = visible[activeIndex >= 0 ? activeIndex : 0];
        if (pick) choose(pick.value);
      }
    }

    function open() {
      if (openInstance && openInstance !== api) openInstance.close();
      openInstance = api;
      root.dataset.open = "true";
      toggle.setAttribute("aria-expanded", "true");
      search.value = "";
      activeIndex = -1;
      renderList();
      search.focus();
    }

    function close() {
      root.dataset.open = "false";
      toggle.setAttribute("aria-expanded", "false");
      if (openInstance === api) openInstance = null;
    }

    var api = { node: root, close: close, open: open, setValue: function (v) { setValue(v, false); } };

    renderValue();
    renderList();
    return api;
  }

  document.addEventListener("click", function (ev) {
    if (openInstance && !openInstance.node.contains(ev.target)) openInstance.close();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && openInstance) openInstance.close();
  });

  global.Dropdown = { create: create, fold: fold };
})(window);
