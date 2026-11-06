/* =====================================================================
   EcoCampus — Changement de langue (français / arabe / anglais)

   Ce fichier est chargé dans le <head> de TOUTES les pages, avant script.js.

   Ce qu'il fait :
     1. lit la langue choisie dans le navigateur (localStorage) ;
     2. règle tout de suite <html lang="…" dir="rtl|ltr"> (RTL pour l'arabe) ;
     3. traduit toute la page avec le dictionnaire de i18n-dict.js, puis
        surveille la page (MutationObserver) pour traduire aussi ce que
        script.js ajoute plus tard (tableaux, alertes, messages…) ;
     4. ajoute l'icône de traduction avec le menu des trois langues ;
     5. retient la langue : la clé « ecocampus-lang » n'est JAMAIS effacée
        par la déconnexion ni par « Tout réinitialiser ».

   Le français reste la langue de référence : c'est le texte écrit dans le
   HTML et dans script.js. Quand on revient au français, rien n'est traduit.

   Utilisation dans script.js :
     I18N.lang            → "fr", "ar" ou "en"
     I18N.t("Eau")        → texte traduit dans la langue courante
     I18N.numberLocale    → langue pour toLocaleString (nombres)
     I18N.dateLocale      → langue pour toLocaleDateString (dates)
     I18N.srcText(élément)→ texte FRANÇAIS d'origine d'un élément
   ===================================================================== */
(function () {
  "use strict";

  const LANG_KEY = "ecocampus-lang";
  const LANGUAGES = {
    fr: { name: "Français", dir: "ltr", numbers: "fr-FR", dates: "fr-FR" },
    ar: {
      name: "العربية",
      dir: "rtl",
      numbers: "ar-u-nu-latn",
      dates: "ar-TN",
    },
    en: { name: "English", dir: "ltr", numbers: "en-GB", dates: "en-GB" },
  };
  const ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"];
  const SKIPPED_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "TEXTAREA",
    "NOSCRIPT",
    "CODE",
  ]);

  /* ---------- 1. Langue courante (français par défaut) ---------- */
  function readLanguage() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (LANGUAGES[saved]) return saved;
    } catch (error) {
      /* localStorage indisponible : on reste en français */
    }
    return "fr";
  }
  const lang = readLanguage();

  /* ---------- 2. Sens d'écriture : tout de suite, avant l'affichage ---------- */
  const root = document.documentElement;
  root.lang = lang;
  root.dir = LANGUAGES[lang].dir;

  /* ---------- 3. Moteur de traduction ---------- */
  const exact = { en: new Map(), ar: new Map() };
  const exactLower = { en: new Map(), ar: new Map() }; // clés en minuscules (« RÉSIDENCE »)
  const templates = { en: [], ar: [] };
  const glossary = { en: [], ar: [] };

  const squeeze = (text) => text.replace(/\s+/g, " ").trim();
  const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function buildDictionary() {
    (window.I18N_ROWS || []).forEach(([fr, en, ar]) => {
      const key = squeeze(fr);
      [
        ["en", en],
        ["ar", ar],
      ].forEach(([code, value]) => {
        if (!fr.includes("{0}")) {
          exact[code].set(key, value);
          exactLower[code].set(key.toLocaleLowerCase("fr"), value);
          return;
        }
        /* Texte à trous : « Bâtiment « {0} » ajouté » devient une expression
             régulière dont chaque {n} capture une partie variable. */
        const literal = fr.replace(/\{\d\}/g, "");
        const pattern = escapeRegex(fr)
          .replace(/\\\{(\d)\\\}/g, "(.+?)")
          .replace(/ /g, "\\s+");
        templates[code].push({
          regex: new RegExp("^" + pattern + "$", "s"),
          value,
          weight: literal.length,
          slots: [...fr.matchAll(/\{(\d)\}/g)].map((m) => Number(m[1])),
        });
      });
    });
    /* Les modèles les plus précis (le plus de texte fixe) passent en premier */
    ["en", "ar"].forEach((code) =>
      templates[code].sort((a, b) => b.weight - a.weight)
    );

    /* Glossaire : mots isolés remplacés à l'intérieur de phrases composées */
    const extra = window.I18N_GLOSSARY_ROWS || {};
    (window.I18N_GLOSSARY || []).forEach((word) => {
      ["en", "ar"].forEach((code, index) => {
        const target = extra[word] ? extra[word][index] : exact[code].get(word);
        if (!target || typeof target !== "string") return;
        const regex = new RegExp(
          "(?<![\\p{L}\\p{N}])" + escapeRegex(word) + "(?![\\p{L}])",
          "gu"
        );
        glossary[code].push({ regex, target });
      });
    });
  }

  /* Traduit un texte (sans espaces de début/fin). Renvoie le texte tel quel
       si aucune traduction n'existe : jamais d'erreur, jamais de texte perdu. */
  function translateCore(core, code) {
    if (!core) return core;
    const hit = exact[code].get(squeeze(core));
    if (hit !== undefined) return typeof hit === "function" ? hit([]) : hit;

    /* Texte écrit en MAJUSCULES par script.js (ex. « RÉSIDENCE ») */
    const lowerHit = exactLower[code].get(
      squeeze(core).toLocaleLowerCase("fr")
    );
    if (typeof lowerHit === "string" && core === core.toLocaleUpperCase("fr")) {
      return lowerHit.toLocaleUpperCase(code === "en" ? "en" : "ar");
    }

    for (const template of templates[code]) {
      const match = template.regex.exec(core);
      if (!match) continue;
      /* Les parties variables sont traduites à leur tour (ex. « Eau ») */
      const captures = {};
      template.slots.forEach((slot, index) => {
        captures[slot] = translateCore(match[index + 1], code);
      });
      const raw = {};
      template.slots.forEach((slot, index) => (raw[slot] = match[index + 1]));
      if (typeof template.value === "function") {
        const list = [];
        template.slots.forEach((slot) => (list[slot] = raw[slot]));
        return template.value(list);
      }
      return template.value.replace(/\{(\d)\}/g, (_, n) => captures[n] ?? "");
    }

    /* Symbole devant le texte (« ϟ Cours », « ▦ Gymnase ») : on traduit la suite */
    const withIcon = /^(\S{1,2})\s+(\S[\s\S]*)$/u.exec(core);
    if (withIcon) {
      const rest = translateCore(withIcon[2], code);
      if (rest !== withIcon[2]) return withIcon[1] + " " + rest;
    }

    /* Dernier recours : remplacer les mots connus (ressources, bâtiments…) */
    let result = core;
    glossary[code].forEach(({ regex, target }) => {
      result = result.replace(regex, target);
    });
    return result;
  }

  /* Traduit un texte en gardant les espaces et retours à la ligne autour */
  function translate(text, code = lang) {
    if (code === "fr" || typeof text !== "string" || !text.trim()) return text;
    const [, start, core, end] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
    return start + translateCore(core, code) + end;
  }

  /* ---------- 4. Traduction de la page ---------- */
  const textRecords = new WeakMap(); // nœud texte → { src: français, out: affiché }
  const attrRecords = new WeakMap(); // élément → { attribut: { src, out } }

  function translateTextNode(node) {
    const current = node.nodeValue;
    const record = textRecords.get(node);
    if (record && record.out === current) return; // déjà traité
    if (!current.trim()) return;

    const parent = node.parentElement;
    if (
      !parent ||
      SKIPPED_TAGS.has(parent.tagName) ||
      parent.closest("[data-no-i18n]")
    )
      return;

    const out = translate(current);
    /* <option> sans value : sa valeur EST son texte. On la fige en français
         pour que les filtres et formulaires de script.js continuent de marcher. */
    if (
      out !== current &&
      parent.tagName === "OPTION" &&
      !parent.hasAttribute("value")
    ) {
      parent.setAttribute("value", current.trim());
    }
    textRecords.set(node, { src: current, out });
    if (out !== current) node.nodeValue = out;
  }

  function translateAttribute(element, name) {
    const current = element.getAttribute(name);
    if (!current || !current.trim()) return;
    const records = attrRecords.get(element) || {};
    if (records[name] && records[name].out === current) return;
    if (element.closest("[data-no-i18n]")) return;

    const out = translate(current);
    records[name] = { src: current, out };
    attrRecords.set(element, records);
    if (out !== current) element.setAttribute(name, out);
  }

  function translateTree(node) {
    if (lang === "fr" || !node) return;
    if (node.nodeType === Node.TEXT_NODE) return translateTextNode(node);
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName === "SCRIPT" || node.tagName === "STYLE") return;

    /* Les attributs (placeholder…) sont traduits partout, même dans un <textarea> */
    ATTRIBUTES.forEach(
      (name) => node.hasAttribute(name) && translateAttribute(node, name)
    );
    if (!SKIPPED_TAGS.has(node.tagName)) node.childNodes.forEach(translateTree);
  }

  /* Texte français d'origine d'un élément (pour les comparaisons de script.js) */
  function srcText(element) {
    let result = "";
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const record = textRecords.get(node);
      result +=
        record && record.out === node.nodeValue ? record.src : node.nodeValue;
    }
    return result;
  }

  function observePage() {
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList")
          mutation.addedNodes.forEach(translateTree);
        else if (mutation.type === "characterData")
          translateTextNode(mutation.target);
        else if (mutation.type === "attributes")
          translateAttribute(mutation.target, mutation.attributeName);
      }
    }).observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES,
    });
  }

  /* ---------- 5. Icône de traduction et menu des langues ---------- */
  const LANGUAGE_ICON =
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>' +
    '<path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>';

  function chooseLanguage(code) {
    if (code === lang || !LANGUAGES[code]) return;
    try {
      localStorage.setItem(LANG_KEY, code);
    } catch (error) {
      /* tant pis : la langue ne sera pas retenue */
    }
    /* Rechargement : nombres, dates, graphiques et tableaux sont alors
         tous reconstruits dans la nouvelle langue. */
    location.reload();
  }

  function buildSwitcher() {
    const wrapper = document.createElement("div");
    wrapper.className = "lang-switch";
    wrapper.setAttribute("data-no-i18n", "");

    const items = Object.entries(LANGUAGES)
      .map(
        ([code, info]) =>
          `<li role="none"><button type="button" role="menuitemradio" data-lang="${code}" ` +
          `lang="${code}" aria-checked="${code === lang}">${
            info.name
          }</button></li>`
      )
      .join("");
    wrapper.innerHTML =
      `<button type="button" class="icon-btn lang-btn" aria-haspopup="menu" aria-expanded="false" ` +
      `title="${translate("Langue")}" aria-label="${translate(
        "Langue"
      )}">${LANGUAGE_ICON}</button>` +
      `<ul class="lang-menu" role="menu" hidden>${items}</ul>`;

    const button = wrapper.querySelector(".lang-btn");
    const menu = wrapper.querySelector(".lang-menu");
    const close = () => {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
    };

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
      button.setAttribute("aria-expanded", String(!menu.hidden));
    });
    menu.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-lang]");
      if (choice) chooseLanguage(choice.dataset.lang);
    });
    document.addEventListener("click", close);
    document.addEventListener(
      "keydown",
      (event) => event.key === "Escape" && close()
    );
    return wrapper;
  }

  function insertSwitcher() {
    const switcher = buildSwitcher();
    const actions = document.querySelector(".top-actions");
    if (actions) {
      /* Après la cloche : script.js lit « le 2e bouton » (notifications),
           l'ordre des deux premiers boutons ne doit donc pas changer. */
      const bell = actions.querySelectorAll(":scope > .icon-btn")[1];
      if (bell) bell.after(switcher);
      else actions.prepend(switcher);
    } else {
      switcher.classList.add("lang-floating"); // page de connexion
      document.body.append(switcher);
    }
  }

  /* ---------- 6. Démarrage ---------- */
  buildDictionary();

  function start() {
    translateTree(document.head.querySelector("title"));
    translateTree(document.body);
    insertSwitcher();
    if (lang !== "fr") observePage();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  else start();

  window.I18N = {
    lang,
    dir: LANGUAGES[lang].dir,
    languages: LANGUAGES,
    numberLocale: LANGUAGES[lang].numbers,
    dateLocale: LANGUAGES[lang].dates,
    t: translate,
    srcText,
    /* Texte pour les PDF : jsPDF n'a pas de police arabe, on garde le français */
    pdf: (text) => translate(text, lang === "en" ? "en" : "fr"),
  };
})();
