/* EcoCampus — Module Web (Module B)
   Lit data/data.json (produit par le module C), puis construit tableaux, KPI et graphiques.
   Chrome / Edge : après avoir connecté le dossier « data » (une seule fois), chaque ajout, modification
   ou suppression réécrit data/data.json ET data/data.csv dans EXACTEMENT le même format que le module C. */

/* ---------- Adaptation au fichier du module C ---------- */
const DATA_URL = new URL("../data/data.json", document.currentScript.src).href;
/* ---------- Authentification (côté navigateur) ---------- */
const LOGIN_URL = new URL("../pages/login.html", document.currentScript.src)
  .href;
const HOME_URL = new URL("../index.html", document.currentScript.src).href;
const PAGES_URL = new URL("../pages/", document.currentScript.src).href;
const AUTH_KEY = "ecocampus-auth";
const UKEY = "ecocampus-user";
const PAGE = document.body.dataset.page;
const getAuth = () => {
  try {
    return JSON.parse(
      sessionStorage.getItem(AUTH_KEY) ||
        localStorage.getItem(AUTH_KEY) ||
        "null"
    );
  } catch {
    return null;
  }
};
if (PAGE !== "login" && !getAuth()) location.replace(LOGIN_URL);
if (PAGE === "login" && getAuth()) location.replace(HOME_URL);
async function sha(s) {
  try {
    const b = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(s)
    );
    return [...new Uint8Array(b)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "b64:" + btoa(unescape(encodeURIComponent(s))); // contexte non sécurisé
  }
}
/* Comptes : liste conservée dans le navigateur (jamais effacée par « Réinitialiser ») */
const USERS_KEY = "ecocampus-users";
async function loadUsers() {
  let list = null;
  try {
    list = JSON.parse(localStorage.getItem(USERS_KEY) || "null");
  } catch {}
  if (!Array.isArray(list)) {
    list = [];
    try {
      // ancien format : un seul compte (mot de passe modifié)
      const old = JSON.parse(localStorage.getItem(UKEY) || "null");
      if (old && old.u && old.h) list.push({ u: old.u, h: old.h });
    } catch {}
    if (!list.some((x) => x.u === "admin"))
      list.unshift({ u: "admin", h: await sha("ecocampus2026") });
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
    localStorage.removeItem(UKEY);
  }
  return list;
}
const saveUsers = (l) => localStorage.setItem(USERS_KEY, JSON.stringify(l));
async function checkLogin(u, p) {
  u = u.trim().toLowerCase();
  const user = (await loadUsers()).find((x) => x.u === u);
  return !!user && user.h === (await sha(p));
}
async function registerUser(u, p) {
  u = u.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,20}$/.test(u))
    return "Nom d'utilisateur : 3 à 20 caractères (lettres, chiffres, . _ -).";
  if (p.length < 8) return "Mot de passe : 8 caractères minimum.";
  const list = await loadUsers();
  if (list.some((x) => x.u === u)) return "Ce nom d'utilisateur existe déjà.";
  list.push({ u, h: await sha(p) });
  saveUsers(list);
  return "";
}
async function changePassword(u, p) {
  const list = await loadUsers();
  const user = list.find((x) => x.u === u);
  if (user) user.h = await sha(p);
  saveUsers(list);
}
function startSession(u, remember) {
  (remember ? localStorage : sessionStorage).setItem(
    AUTH_KEY,
    JSON.stringify({ u, t: Date.now() })
  );
  location.replace(HOME_URL);
}
function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_KEY);
  location.replace(LOGIN_URL);
}
function initLogin() {
  const fIn = $("#loginForm"),
    fUp = $("#signupForm"),
    tabs = $$(".login-tabs button");
  const show = (k) => {
    fIn.hidden = k !== "in";
    fUp.hidden = k !== "up";
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === k));
    $("#loginTitle").textContent = k === "in" ? "Connexion" : "Créer un compte";
    $$(".login-error").forEach((e) => (e.hidden = true));
    (k === "in" ? $("#loginUser") : $("#suUser")).focus();
  };
  tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.tab)));
  $$(".pwd-toggle").forEach((b) =>
    b.addEventListener("click", () => {
      const i = b.previousElementSibling;
      i.type = i.type === "password" ? "text" : "password";
    })
  );
  const fail = (form, el, msg) => {
    el.textContent = msg;
    el.hidden = false;
    form.classList.remove("shake");
    void form.offsetWidth;
    form.classList.add("shake");
  };

  fIn.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#loginError"),
      u = $("#loginUser").value,
      p = $("#loginPass").value;
    err.hidden = true;
    if (!u.trim() || !p)
      return fail(
        fIn,
        err,
        "Entrez votre nom d'utilisateur et votre mot de passe."
      );
    if (await checkLogin(u, p))
      startSession(u.trim().toLowerCase(), $("#loginRemember").checked);
    else {
      fail(fIn, err, "Nom d'utilisateur ou mot de passe incorrect.");
      $("#loginPass").select();
    }
  });

  fUp.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#signupError"),
      u = $("#suUser").value,
      p = $("#suPass").value;
    err.hidden = true;
    if (p !== $("#suPass2").value)
      return fail(fUp, err, "Les deux mots de passe ne sont pas identiques.");
    const msg = await registerUser(u, p);
    if (msg) return fail(fUp, err, msg);
    startSession(u.trim().toLowerCase(), true); // compte créé : connexion directe
  });
}

/* Noms du module C  <->  noms affichés sur le site */
const NORM_RES = {
  electricite: "Électricité",
  eau: "Eau",
  chauffage: "Chauffage",
};
const NORM_BAT = {
  Cours: "Cours A",
  Bibliotheque: "Bibliothèque",
  Residence: "Résidence",
};
const TO_C_BAT = {
  "Cours A": "Cours",
  Bibliothèque: "Bibliotheque",
  Résidence: "Residence",
};
const TO_C_RES = {
  Électricité: "electricite",
  Eau: "eau",
  Chauffage: "chauffage",
};
const TYPES = {
  "Cours A": "Enseignement",
  Laboratoires: "Enseignement",
  Bibliothèque: "Enseignement",
  Résidence: "Résidence",
  Administration: "Administration",
};
function adapt(data) {
  const mesures = data.mesures.map((m) => ({
    ...m,
    ressource: NORM_RES[m.ressource] || m.ressource,
    batiment: NORM_BAT[m.batiment] || m.batiment,
    date: String(m.date_heure || m.date || "").replace(" ", "T"),
  }));
  const noms = [...new Set(mesures.map((m) => m.batiment))];
  /* les noms de bâtiments du fichier sont ceux du module C : on les convertit aussi */
  const batiments = Array.isArray(data.batiments)
    ? data.batiments.map((b) => {
        const nom = NORM_BAT[b.nom] || b.nom;
        return { ...b, nom, type: b.type || TYPES[nom] || "" };
      })
    : noms.map((nom) => ({ nom, type: TYPES[nom] || "" }));
  return {
    ...data,
    mesures,
    batiments,
    precedent: data.precedent || {},
    genere_le: data.genere_le || "",
  };
}

const RES = {
  Électricité: { unit: "kWh", icon: "ϟ", css: "--c-elec", cls: "" },
  Eau: { unit: "m³", icon: "♒", css: "--c-water", cls: "water-text" },
  Chauffage: { unit: "kWh", icon: "♨", css: "--c-heat", cls: "heat-text" },
};
const state = { mesures: [], batiments: [], precedent: {}, generated: "" };
const KEY = "ecocampus-mesures";
const SKEY = "ecocampus-settings";
const BKEY = "ecocampus-bats";
const DKEY = "ecocampus-deleted";
const readList = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || "[]");
  } catch {
    return [];
  }
};

/* ---------- Enregistrement dans data.json + data.csv ----------
   Chrome / Edge : l'utilisateur choisit une fois le dossier « data » (File System Access API),
   puis chaque changement réécrit data.json et data.csv (même format que le module C).
   Sinon : repli sur le localStorage + bouton de téléchargement. */
let SERVER = false; // true = dossier data connecté en écriture
let DIR_HANDLE = null;
let DIR_STATE = "unsupported"; // ok | prompt | none | unsupported
const idb = () =>
  new Promise((res, rej) => {
    const q = indexedDB.open("ecocampus", 1);
    q.onupgradeneeded = () => q.result.createObjectStore("kv");
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
const idbGet = async (k) => {
  const db = await idb();
  return new Promise((res, rej) => {
    const q = db.transaction("kv").objectStore("kv").get(k);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
};
const idbSet = async (k, v) => {
  const db = await idb();
  return new Promise((res, rej) => {
    const q = db.transaction("kv", "readwrite").objectStore("kv").put(v, k);
    q.onsuccess = () => res();
    q.onerror = () => rej(q.error);
  });
};
async function detectDir() {
  DIR_STATE =
    typeof window.showDirectoryPicker === "function" ? "none" : "unsupported";
  if (DIR_STATE === "unsupported") return;
  try {
    const h = await idbGet("dir");
    if (!h) return;
    DIR_HANDLE = h;
    const p = await h.queryPermission({ mode: "readwrite" });
    DIR_STATE = p === "granted" ? "ok" : "prompt";
    SERVER = DIR_STATE === "ok";
  } catch {}
}

const cleanName = (s) =>
  String(s)
    .replace(/[,\r\n"]/g, " ")
    .trim();
const r2 = (n) => Math.round(n * 100) / 100;

/* Construit data.json et data.csv dans le MÊME format que le module C (exporterJSON / sauvegarderMesures).
   `list` = mesures à écrire (par défaut toutes ; l'export filtré en passe une partie). */
function buildFiles(list = state.mesures) {
  const FEN = 2; // = FENETRE_MOBILE du module C
  const mesures = list.map((m) => {
    const seuil = Number.isFinite(m.seuil) ? m.seuil : 0;
    return {
      id: m.id,
      batiment: cleanName(TO_C_BAT[m.batiment] || m.batiment),
      ressource: TO_C_RES[m.ressource] || cleanName(m.ressource).toLowerCase(),
      valeur: r2(m.valeur),
      date_heure: String(m.date).replace("T", " ").slice(0, 16),
      seuil: r2(seuil),
      alerte: m.valeur > seuil,
    };
  });
  const map = new Map();
  mesures.forEach((m) => {
    const k = m.batiment + "\u0000" + m.ressource;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(m);
  });
  const groups = [...map.values()];
  const statistiques = groups.map((l) => {
    const v = l.map((m) => m.valeur),
      total = v.reduce((a, b) => a + b, 0);
    return {
      batiment: l[0].batiment,
      ressource: l[0].ressource,
      nb_mesures: l.length,
      total: r2(total),
      moyenne: r2(total / l.length),
      min: Math.min(...v),
      max: Math.max(...v),
      nb_alertes: l.filter((m) => m.alerte).length,
    };
  });
  const tendances = groups.map((l) => {
    const s = [...l].sort((a, b) => a.date_heure.localeCompare(b.date_heure));
    const mm = (i) =>
      r2(s.slice(i - FEN + 1, i + 1).reduce((a, m) => a + m.valeur, 0) / FEN);
    let tendance = "indeterminee",
      premiere = null,
      derniere = null;
    if (s.length > FEN) {
      premiere = mm(FEN - 1);
      derniere = mm(s.length - 1);
      const marge = 0.05 * Math.abs(premiere);
      tendance =
        derniere - premiere > marge
          ? "hausse"
          : derniere - premiere < -marge
          ? "baisse"
          : "stable";
    }
    return {
      batiment: s[0].batiment,
      ressource: s[0].ressource,
      fenetre: FEN,
      nb_mesures: s.length,
      tendance,
      premiere_moyenne: premiere,
      derniere_moyenne: derniere,
      points: s.map((m, i) => ({
        date_heure: m.date_heure,
        valeur: m.valeur,
        moyenne_mobile: i >= FEN - 1 ? mm(i) : null,
      })),
    };
  });

  /* ---- écriture du JSON avec la mise en page exacte du module C ---- */
  const S = JSON.stringify;
  const f = (n) => Number(n).toFixed(2);
  const nf = (n) => (n == null ? "null" : f(n));
  const ni = (n) => (Number.isFinite(n) ? String(n) : "null");
  const block = (name, items, last) => [
    `  "${name}": [`,
    ...items.map((x, i) => "    " + x + (i < items.length - 1 ? "," : "")),
    "  ]" + (last ? "" : ","),
  ];
  const nbAlertes = mesures.filter((m) => m.alerte).length;
  const lines = [
    "{",
    '  "resume": {',
    `    "nb_mesures": ${mesures.length},`,
    `    "nb_alertes": ${nbAlertes},`,
    `    "nb_groupes": ${groups.length}`,
    "  },",
    ...block(
      "batiments",
      state.batiments.map(
        (b) =>
          `{"nom": ${S(cleanName(TO_C_BAT[b.nom] || b.nom))}, "type": ${S(
            b.type || ""
          )}, "etages": ${ni(b.etages)}, "surface": ${ni(b.surface)}}`
      )
    ),
    ...block(
      "mesures",
      mesures.map(
        (m) =>
          `{"id": ${m.id}, "batiment": ${S(m.batiment)}, "ressource": ${S(
            m.ressource
          )}, "valeur": ${f(m.valeur)}, "date_heure": ${S(
            m.date_heure
          )}, "seuil": ${f(m.seuil)}, "alerte": ${m.alerte}}`
      )
    ),
    ...block(
      "statistiques",
      statistiques.map(
        (s) =>
          `{"batiment": ${S(s.batiment)}, "ressource": ${S(
            s.ressource
          )}, "nb_mesures": ${s.nb_mesures}, "total": ${f(
            s.total
          )}, "moyenne": ${f(s.moyenne)}, "min": ${f(s.min)}, "max": ${f(
            s.max
          )}, "nb_alertes": ${s.nb_alertes}}`
      )
    ),
    ...block(
      "tendances",
      tendances.map(
        (t) =>
          `{"batiment": ${S(t.batiment)}, "ressource": ${S(
            t.ressource
          )}, "fenetre": ${t.fenetre}, "nb_mesures": ${
            t.nb_mesures
          }, "tendance": ${S(t.tendance)}, "premiere_moyenne": ${nf(
            t.premiere_moyenne
          )}, "derniere_moyenne": ${nf(
            t.derniere_moyenne
          )}, "points": [${t.points
            .map(
              (p) =>
                `{"date_heure": ${S(p.date_heure)}, "valeur": ${f(
                  p.valeur
                )}, "moyenne_mobile": ${nf(p.moyenne_mobile)}}`
            )
            .join(", ")}]}`
      ),
      true
    ),
    "}",
  ];
  const json = lines.join("\n") + "\n";
  const csv =
    "id,batiment,ressource,valeur,date_heure,seuil\n" +
    mesures
      .map(
        (m) =>
          `${m.id},${m.batiment},${m.ressource},${f(m.valeur)},${
            m.date_heure
          },${f(m.seuil)}`
      )
      .join("\n") +
    (mesures.length ? "\n" : "");
  return { json, csv };
}
async function writeFiles(dir) {
  const { json, csv } = buildFiles();
  for (const [name, text] of [
    ["data.csv", csv],
    ["data.json", json],
  ]) {
    const w = await (
      await dir.getFileHandle(name, { create: true })
    ).createWritable();
    await w.write(text);
    await w.close();
  }
}
function saveBlob(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  Object.assign(document.createElement("a"), {
    href: url,
    download: name,
  }).click();
  URL.revokeObjectURL(url);
}
function downloadFiles() {
  const { json, csv } = buildFiles();
  [
    ["data.json", json, "application/json;charset=utf-8"],
    ["data.csv", csv, "text/csv;charset=utf-8"],
  ].forEach(([n, t, ty], i) => setTimeout(() => saveBlob(t, n, ty), i * 400));
}
/* Demande à l'utilisateur de choisir (ou de réautoriser) le dossier « data ». Doit suivre un clic. */
async function connectDir() {
  try {
    let h = DIR_HANDLE;
    if (h && DIR_STATE === "prompt") {
      if ((await h.requestPermission({ mode: "readwrite" })) !== "granted")
        return false;
    } else {
      h = await window.showDirectoryPicker({ mode: "readwrite" });
      if (h.name !== "data") {
        /* l'utilisateur a choisi la racine du projet : on descend dans « data » */
        try {
          h = await h.getDirectoryHandle("data");
        } catch {
          toast("Choisissez le dossier « data » de votre projet.", "alert");
          return false;
        }
      }
      await idbSet("dir", h);
    }
    DIR_HANDLE = h;
    DIR_STATE = "ok";
    SERVER = true;
    [KEY, BKEY, DKEY].forEach((k) => localStorage.removeItem(k));
    return true;
  } catch {
    return false;
  }
}
async function persist() {
  /* La fenêtre de choix du dossier ne s'ouvre qu'UNE SEULE FOIS par session d'onglet
     (jamais à chaque ajout). Ensuite : bouton « Connecter le dossier data » sur la page Données. */
  if (!SERVER && (DIR_STATE === "none" || DIR_STATE === "prompt")) {
    let asked = false;
    try {
      asked = !!sessionStorage.getItem("ecocampus-asked");
      sessionStorage.setItem("ecocampus-asked", "1");
    } catch {}
    if (!asked) {
      toast("Sélectionnez le dossier « data » (une seule fois).");
      await connectDir();
    }
  }
  if (SERVER) {
    try {
      await writeFiles(DIR_HANDLE);
      return true;
    } catch (e) {
      toast("Échec de l'écriture dans data/ : " + e.message, "alert");
      return false;
    }
  }
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ v: state.generated, m: state.mesures })
    );
  } catch {}
  return true;
}
const registry = {};
const redraw = [];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sum = (l) => l.reduce((a, m) => a + m.valeur, 0);
const fmt = (n) => Math.round(n).toLocaleString("fr-FR");
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );

/* ---------- Réglages ---------- */
const DEF = {
  campus: "EcoCampus",
  lieu: "Tunis, Tunisie",
  format: "CSV",
  theme: localStorage.getItem("ecocampus-theme") || "light",
  langue: "Français",
  date: "JJ/MM/AAAA",
  a2f: false,
  taille: "normal",
  seuil_Électricité: 2000,
  seuil_Eau: 500,
  seuil_Chauffage: 1500,
  notif_alerte: true,
  notif_ajout: true,
};
const cfg = () => {
  try {
    return { ...DEF, ...JSON.parse(localStorage.getItem(SKEY) || "{}") };
  } catch {
    return { ...DEF };
  }
};
let SET = cfg();

const fmtDate = (iso) => {
  const t = iso.slice(11, 16);
  return SET.date === "AAAA-MM-JJ"
    ? `${iso.slice(0, 10)} ${t}`
    : `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${t}`;
};
const norm = (s) =>
  String(s)
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const cssVar = (n) =>
  getComputedStyle(document.body).getPropertyValue(n).trim();
const byBat = (b) => state.mesures.filter((m) => m.batiment === b);
const ofRes = (list, r) => list.filter((m) => m.ressource === r);
const seuilTxt = (m) =>
  Number.isFinite(m.seuil) ? ` (seuil ${fmt(m.seuil)})` : "";

function applySettings() {
  document.body.classList.toggle("dark-mode", SET.theme === "dark");
  document.body.classList.toggle("big-text", SET.taille === "grand");
  $$(".brand b").forEach((b) => (b.textContent = SET.campus || "EcoCampus"));
  const y = $$(".footer span")[1];
  if (y)
    y.textContent = `© ${new Date().getFullYear()} ${
      SET.campus
    } · Tous droits réservés`;
}
function saveSettings(f) {
  const S = cfg();
  $$("[name]", f).forEach((i) => {
    if (i.name === "nb") return;
    if (i.type === "radio") {
      if (i.checked) S[i.name] = i.value;
    } else if (i.type === "checkbox") S[i.name] = i.checked;
    else S[i.name] = i.type === "number" ? +i.value : i.value;
  });
  localStorage.setItem(SKEY, JSON.stringify(S));
  localStorage.setItem("ecocampus-theme", S.theme);
  SET = cfg();
  applySettings();
  redraw.forEach((r) => r());
  toast("Vos préférences ont été enregistrées.");
}

/* ---------- Messages ---------- */
function toast(msg, type = "ok") {
  let wrap = $(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.append(wrap);
  }
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.setAttribute("role", "status");
  t.textContent = msg;
  wrap.append(t);
  setTimeout(() => t.remove(), 4500);
}
function showError(msg) {
  const n = document.createElement("div");
  n.className = "notice error";
  n.textContent = "⚠ " + msg;
  $(".content")?.prepend(n);
}

/* ---------- Boîte de dialogue (remplace prompt/confirm) ---------- */
function ask({ title, text = "", fields = [], ok = "Valider" }) {
  return new Promise((res) => {
    const d = document.createElement("dialog");
    d.className = "modal";
    d.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2>${
      text ? `<p>${esc(text)}</p>` : ""
    }${fields
      .map(
        (f) =>
          `<label>${esc(f.label)}${
            f.options
              ? `<select name="${f.name}">${f.options
                  .map((o) => `<option>${esc(o)}</option>`)
                  .join("")}</select>`
              : `<input name="${f.name}" type="${
                  f.type || "text"
                }" value="${esc(f.value ?? "")}" ${
                  f.type === "number" ? `step="any" min="${f.min ?? 0}"` : ""
                } ${f.required === false ? "" : "required"}>`
          }</label>`
      )
      .join("")}
      <div class="modal-actions"><button type="button" class="btn btn-outline" data-x>Annuler</button>
      <button class="btn" value="ok">${esc(ok)}</button></div></form>`;
    document.body.append(d);
    const form = $("form", d);
    $("[data-x]", d).onclick = () => d.close("cancel");
    d.addEventListener("close", () => {
      res(
        d.returnValue === "ok" ? Object.fromEntries(new FormData(form)) : null
      );
      d.remove();
    });
    d.showModal();
    $("input,select", d)?.focus();
  });
}

/* ---------- Chargement et validation des données ---------- */
async function loadData() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`fichier introuvable (HTTP ${res.status})`);
    const data = await res.json();
    if (!Array.isArray(data.mesures))
      throw new Error("champ « mesures » absent ou invalide");
    return adapt(data);
  } catch (e) {
    const hint =
      location.protocol === "file:"
        ? " Ouvrez le site via un serveur local (Live Server)."
        : "";
    showError(`Impossible de charger data.json : ${e.message}.${hint}`);
    return null;
  }
}

function clean(data) {
  state.batiments = data.batiments || [];
  if (!SERVER)
    try {
      const extra = JSON.parse(localStorage.getItem(BKEY) || "[]");
      state.batiments = [
        ...state.batiments,
        ...extra.filter((e) => !state.batiments.some((b) => b.nom === e.nom)),
      ];
    } catch {}
  state.precedent = data.precedent || {};
  state.generated = data.genere_le || "";
  const seen = new Set();
  state.mesures = data.mesures
    .filter((m) => {
      const ok =
        m &&
        RES[m.ressource] &&
        typeof m.batiment === "string" &&
        m.batiment &&
        Number.isFinite(m.valeur) &&
        m.valeur >= 0 &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(m.date || "") &&
        !seen.has(m.id);
      if (ok) seen.add(m.id);
      return ok;
    })
    .map((m) => ({
      ...m,
      unite: RES[m.ressource].unit,
      alerte: Number.isFinite(m.seuil) ? m.valeur > m.seuil : !!m.alerte,
    }));
  const rejected = data.mesures.length - state.mesures.length;
  if (!SERVER)
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved && saved.v === state.generated && Array.isArray(saved.m))
        state.mesures = saved.m;
    } catch {}
  const del = SERVER ? [] : readList(DKEY);
  state.batiments = state.batiments.filter((b) => !del.includes(b.nom));
  state.mesures = state.mesures.filter((m) => !del.includes(m.batiment));
  /* bâtiments présents dans les mesures mais absents de la liste */
  state.mesures.forEach((m) => {
    if (!state.batiments.some((b) => b.nom === m.batiment))
      state.batiments.push({ nom: m.batiment, type: TYPES[m.batiment] || "" });
  });
  if (rejected)
    toast(
      `${rejected} mesure(s) invalide(s) ignorée(s) dans data.json.`,
      "alert"
    );
}

/* ---------- Tendances et KPI ---------- */
function totalPrev(res, bats) {
  return (bats || Object.keys(state.precedent)).reduce(
    (a, b) => a + (state.precedent[b]?.[res] || 0),
    0
  );
}
function setTrend(el, now, prev, short) {
  if (!el) return;
  if (!prev) {
    el.className = "muted";
    el.textContent = "Pas de période de référence";
    return;
  }
  const pct = ((now - prev) / prev) * 100;
  el.className = pct <= 0 ? "positive" : "negative";
  el.innerHTML =
    `${pct <= 0 ? "↘" : "↗"} ${Math.abs(pct).toFixed(0)}%` +
    (short ? "" : " <span>vs. période précédente</span>");
}
function kpi(sel, res, bats) {
  const card = $(sel);
  if (!card) return;
  const list = ofRes(state.mesures, res).filter(
    (m) => !bats || bats.includes(m.batiment)
  );
  $("strong", card).innerHTML = `${fmt(sum(list))} <small>${
    RES[res].unit
  }</small>`;
  setTrend($("p", card), sum(list), totalPrev(res, bats));
}

/* ---------- Graphiques (Chart.js chargé à la demande) ---------- */
let chartJsReady = null;
function loadChartJs() {
  if (window.Chart) return Promise.resolve(true);
  chartJsReady ||= new Promise((ok) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1";
    s.onload = () => ok(true);
    s.onerror = () => ok(false);
    document.head.append(s);
  });
  return chartJsReady;
}
function swapForCanvas(selector, id) {
  const el = $(selector);
  if (el)
    el.outerHTML = `<div class="chart-box"><canvas id="${id}"></canvas></div>`;
}
function mkChart(id, cfgFn) {
  const draw = () => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!window.Chart) {
      el.parentElement.textContent =
        "Graphique indisponible (Chart.js non chargé : vérifiez la connexion).";
      return;
    }
    registry[id]?.destroy();
    Chart.defaults.font.family = "Inter, Arial, sans-serif";
    Chart.defaults.color = cssVar("--soft") || "#5d777c";
    registry[id] = new Chart(el, cfgFn());
  };
  draw();
  redraw.push(draw);
}
function lineCfg(list) {
  const days = [...new Set(list.map((m) => m.date.slice(0, 10)))].sort();
  const datasets = Object.keys(RES).map((r) => ({
    label: r,
    data: days.map((d) =>
      sum(ofRes(list, r).filter((m) => m.date.startsWith(d)))
    ),
    borderColor: cssVar(RES[r].css),
    backgroundColor: cssVar(RES[r].css),
    tension: 0.35,
    pointRadius: 3,
    yAxisID: r === "Eau" ? "y1" : "y",
  }));
  return {
    type: "line",
    data: {
      labels: days.map((d) => `${d.slice(8)}/${d.slice(5, 7)}`),
      datasets,
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        y: {
          title: { display: true, text: "kWh" },
          grid: { color: cssVar("--line") },
        },
        y1: {
          position: "right",
          title: { display: true, text: "m³" },
          grid: { drawOnChartArea: false },
        },
      },
    },
  };
}
function setDonut(el, vals) {
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const parts = vals.map((v, i) => {
    const start = acc;
    acc += (v / total) * 100;
    return `var(${Object.values(RES)[i].css}) ${start}% ${acc}%`;
  });
  el.style.background = `conic-gradient(${parts.join(",")})`;
  const legend = $$(".legend-list b", el.closest(".donut-area"));
  vals.forEach(
    (v, i) => (legend[i].textContent = Math.round((v / total) * 100) + "%")
  );
}

/* ---------- Période (dates calculées à partir d'AUJOURD'HUI, toujours à jour) ---------- */
const isoDate = (d) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
const addDays = (s, n) => {
  const d = new Date(s + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
};
function presetRange(p) {
  const d = new Date(),
    t = isoDate(d);
  if (p === "today") return [t, t];
  if (p === "7") return [addDays(t, -6), t];
  if (p === "30") return [addDays(t, -29), t];
  if (p === "month")
    return [
      t.slice(0, 8) + "01",
      isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    ];
  if (p === "lastmonth")
    return [
      isoDate(new Date(d.getFullYear(), d.getMonth() - 1, 1)),
      isoDate(new Date(d.getFullYear(), d.getMonth(), 0)),
    ];
  return ["", ""];
}
const PERIOD_NAMES = {
  all: "Toutes les périodes",
  today: "Aujourd'hui",
  7: "7 derniers jours",
  30: "30 derniers jours",
  month: "Ce mois",
  lastmonth: "Mois dernier",
};
const periodPill = () => `<div class="period">
  <button type="button" class="period-pill" id="pBtn" aria-haspopup="true" aria-expanded="false">
    <span>📅</span><span id="pLabel">Toutes les périodes</span><span class="p-caret">▾</span>
  </button>
  <div class="period-pop" id="pPop" hidden>
    <div class="period-chips">${Object.entries(PERIOD_NAMES)
      .map(([k, v]) => `<button type="button" data-p="${k}">${v}</button>`)
      .join("")}</div>
    <div class="period-dates">
      <label>Du<input type="date" id="pFrom" /></label>
      <label>Au<input type="date" id="pTo" /></label>
    </div>
    <div class="period-foot"><span id="pToday"></span><b id="pCount"></b></div>
  </div></div>`;
/* Place le sélecteur de période à côté du titre de la page (à gauche du bouton Exporter s'il existe) */
function mountPeriod() {
  let actions = $(".title-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "title-actions";
    const ex = $("#exportBtn");
    if (ex) {
      ex.replaceWith(actions);
      actions.append(ex);
    } else $(".page-title").append(actions);
  }
  actions.insertAdjacentHTML("afterbegin", periodPill());
}
/* live = filtre sans recharger ; sinon la période est gardée dans l'URL (?p= / ?from= / ?to=) */
function setupPeriod(live, onChange) {
  const btn = $("#pBtn"),
    pop = $("#pPop"),
    fr = $("#pFrom"),
    to = $("#pTo");
  const sp = new URLSearchParams(location.search);
  let preset = "all";
  if (!live) {
    preset = sp.get("p") || (sp.get("from") || sp.get("to") ? "custom" : "all");
    if (preset === "custom") {
      fr.value = sp.get("from") || "";
      to.value = sp.get("to") || "";
    } else [fr.value, to.value] = presetRange(preset);
  }
  const range = () => {
    let [a, b] = [fr.value, to.value];
    if (a && b && a > b) [a, b] = [b, a];
    return [a, b];
  };
  const short = (s) => fmtDate(s + "T00:00").slice(0, 10);
  const paint = () => {
    const [a, b] = range();
    $("#pLabel").textContent =
      preset !== "custom"
        ? PERIOD_NAMES[preset]
        : a && b
        ? `${short(a)} → ${short(b)}`
        : a
        ? `Depuis le ${short(a)}`
        : b
        ? `Jusqu'au ${short(b)}`
        : PERIOD_NAMES.all;
    btn.classList.toggle(
      "on",
      preset !== "all" && (preset !== "custom" || !!(a || b))
    );
    $$(".period-chips button", pop).forEach((c) =>
      c.classList.toggle("active", c.dataset.p === preset)
    );
  };
  const close = () => {
    pop.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  };
  const commit = () => {
    paint();
    if (live) return onChange();
    const q = new URLSearchParams(location.search);
    ["p", "from", "to"].forEach((k) => q.delete(k));
    if (preset === "custom") {
      if (fr.value) q.set("from", fr.value);
      if (to.value) q.set("to", to.value);
    } else if (preset !== "all") q.set("p", preset);
    location.search = q.toString();
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    pop.hidden = !pop.hidden;
    btn.setAttribute("aria-expanded", String(!pop.hidden));
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".period")) close();
  });
  document.addEventListener("keydown", (e) => e.key === "Escape" && close());
  $$(".period-chips button", pop).forEach((c) =>
    c.addEventListener("click", () => {
      preset = c.dataset.p;
      [fr.value, to.value] = presetRange(preset);
      close();
      commit();
    })
  );
  [fr, to].forEach((i) =>
    i.addEventListener("change", () => {
      preset = "custom";
      commit();
    })
  );
  const tick = () => {
    $("#pToday").textContent =
      "Aujourd'hui : " +
      new Date().toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    if (live && !["all", "custom"].includes(preset)) {
      const r = presetRange(preset);
      if (r[0] !== fr.value || r[1] !== to.value) {
        [fr.value, to.value] = r; // le jour a changé : la période suit
        paint();
        onChange();
      }
    }
  };
  paint();
  tick();
  setInterval(tick, 60000);
  return {
    inRange(m) {
      const [a, b] = range(),
        d = m.date.slice(0, 10);
      return (!a || d >= a) && (!b || d <= b);
    },
    info(n) {
      $("#pCount").textContent = `${n} mesure${n > 1 ? "s" : ""}`;
    },
  };
}

/* ---------- Pages ---------- */
const pages = {
  dashboard() {
    kpi(".metric.green", "Électricité");
    kpi(".metric.blue", "Eau");
    kpi(".metric.orange", "Chauffage");
    const al = state.mesures
      .filter((m) => m.alerte)
      .sort((a, b) => b.date.localeCompare(a.date));
    const card = $(".metric.purple");
    $("strong", card).innerHTML = `${al.length} <small>alerte${
      al.length > 1 ? "s" : ""
    }</small>`;
    $("p", card).textContent = `${
      new Set(al.map((m) => m.batiment)).size
    } bâtiment(s) concerné(s)`;
    $(".alert-count").textContent = al.length;
    $$(".alerts .alert-item").forEach((e) => e.remove());
    const items = al.length
      ? al
          .slice(0, 3)
          .map(
            (m) =>
              `<div class="alert-item"><span class="alert-symbol">!</span><div><b>${esc(
                m.batiment
              )} — ${esc(m.ressource)} : ${fmt(m.valeur)} ${m.unite}${seuilTxt(
                m
              )}</b><small>${fmtDate(m.date)}</small></div></div>`
          )
          .join("")
      : '<p class="muted">Aucune alerte : tout est sous les seuils.</p>';
    $(".alerts > .text-link").insertAdjacentHTML("beforebegin", items);
    swapForCanvas(".line-chart", "chartLine");
    mkChart("chartLine", () => lineCfg(state.mesures));
  },

  charts() {
    mountPeriod();
    const per = setupPeriod(false);
    state.mesures = state.mesures.filter((m) => per.inRange(m));
    const rawQ = (new URLSearchParams(location.search).get("q") || "").trim();
    if (rawQ) {
      const q = norm(rawQ);
      state.mesures = state.mesures.filter(
        (m) => norm(m.batiment).includes(q) || norm(m.ressource).includes(q)
      );
      $(".page-title").insertAdjacentHTML(
        "afterend",
        `<div class="notice">Filtre actif : <b>« ${esc(rawQ)} »</b> — ${
          state.mesures.length
        } mesure(s). <a href="graphique.html" class="text-link">✕ Effacer le filtre</a></div>`
      );
    }
    per.info(state.mesures.length);
    const vals = Object.keys(RES).map((r) => sum(ofRes(state.mesures, r)));
    const [d1, d2] = $$(".donut");
    setDonut(d1, vals);
    $("strong", d1).textContent = fmt(vals.reduce((a, b) => a + b, 0));
    $("small", d1).textContent = "kWh + m³";
    const al = state.mesures.filter((m) => m.alerte);
    setDonut(
      d2,
      Object.keys(RES).map((r) => ofRes(al, r).length)
    );
    $("strong", d2).textContent = al.length;

    const bats = state.batiments
      .filter((b) => !rawQ || byBat(b.nom).length)
      .map((b) => b.nom);
    const subtitle = $$(".panel").find((p) =>
      $("h2", p)?.textContent.includes("par bâtiment")
    );
    if (subtitle)
      $("p", subtitle).textContent =
        "Niveau relatif au maximum de chaque ressource";
    const panels = $$(".chart-grid > .panel");
    const views = {
      "Vue globale": [0, 1, 2, 3, 4, 5],
      "Par bâtiment": [2, 3],
      "Par ressource": [0, 1, 4],
      Comparaison: [1, 2, 3],
    };
    $$(".chart-tabs .tab").forEach((t) =>
      t.addEventListener("click", () => {
        const v = views[t.textContent.trim()] || views["Vue globale"];
        panels.forEach((p, i) => (p.hidden = !v.includes(i)));
      })
    );
    swapForCanvas(".bar-chart", "chartBars");
    mkChart("chartBars", () => {
      const datasets = Object.keys(RES).map((r) => {
        const raw = bats.map((b) => sum(ofRes(byBat(b), r)));
        const mx = Math.max(...raw) || 1;
        return {
          label: r,
          raw,
          data: raw.map((v) => (v / mx) * 100),
          backgroundColor: cssVar(RES[r].css),
          borderRadius: 4,
        };
      });
      return {
        type: "bar",
        data: { labels: bats, datasets },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (c) =>
                  `${c.dataset.label} : ${fmt(c.dataset.raw[c.dataIndex])} ${
                    RES[c.dataset.label].unit
                  }`,
              },
            },
          },
          scales: {
            y: {
              max: 100,
              ticks: { callback: (v) => v + "%" },
              grid: { color: cssVar("--line") },
            },
          },
        },
      };
    });
    swapForCanvas(".line-chart", "chartLine");
    mkChart("chartLine", () => lineCfg(state.mesures));

    const rank = bats
      .map((b) => [b, sum(byBat(b).filter((m) => m.ressource !== "Eau"))])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const top = rank[0]?.[1] || 1;
    $(".rank-list").innerHTML = rank
      .map(
        ([b, v]) =>
          `<div><span>${esc(b)}</span><i><b style="width:${
            (v / top) * 100
          }%"></b></i><strong>${fmt(v)}</strong></div>`
      )
      .join("");

    const now = sum(state.mesures.filter((m) => m.ressource !== "Eau"));
    const prev = totalPrev("Électricité") + totalPrev("Chauffage");
    const st = $(".trend-panel .status");
    if (!prev) {
      $(".trend-panel > p").textContent =
        "Pas de période de référence disponible pour calculer une tendance.";
      st.className = "status normal";
      st.textContent = "Données insuffisantes";
    } else {
      const pct = ((now - prev) / prev) * 100;
      $(".trend-panel > p").innerHTML = `La consommation est en ${
        pct <= 0 ? "baisse" : "hausse"
      } de <b>${Math.abs(pct).toFixed(
        0
      )}%</b> par rapport à la période précédente.`;
      st.className = "status " + (pct <= 0 ? "normal" : "warning");
      st.textContent =
        pct <= 0
          ? "Objectif en bonne voie"
          : "Vigilance : consommation en hausse";
    }
  },

  buildings() {
    // Cartes des bâtiments ajoutés par l'utilisateur
    let extra = [];
    try {
      if (!SERVER) extra = JSON.parse(localStorage.getItem(BKEY) || "[]");
    } catch {}
    const STATIC = [
      "Cours A",
      "Laboratoires",
      "Bibliothèque",
      "Résidence",
      "Administration",
    ];
    if (SERVER) extra = state.batiments.filter((b) => !STATIC.includes(b.nom));
    extra.forEach((b) =>
      $(".total-card").insertAdjacentHTML(
        "beforebegin",
        `<article class="building-card"><div class="building-photo photo-five"><span>${esc(
          (b.type || "").toUpperCase()
        )}</span></div><div class="building-info"><h2>▦ ${esc(
          b.nom
        )}</h2><div class="building-value">0 <small>kWh</small><span></span></div><div class="mini-progress"><i style="width:0%"></i></div><a href="detail.html?b=${encodeURIComponent(
          b.nom
        )}" class="text-link">Détails →</a></div></article>`
      )
    );

    const elec = (n) => sum(ofRes(byBat(n), "Électricité"));
    const max = Math.max(0, ...state.batiments.map((b) => elec(b.nom))) || 1;
    $$(".building-card:not(.total-card)").forEach((card) => {
      const name = $("h2", card)
        .textContent.replace(/^\S+\s+/, "")
        .trim();
      const b = state.batiments.find((x) => x.nom === name);
      if (!b) return card.remove(); // bâtiment supprimé
      card.dataset.type = b.type || "";
      card.dataset.name = name;
      if (!$(".del-bat", card))
        $(".building-info", card).insertAdjacentHTML(
          "beforeend",
          '<button type="button" class="del-bat" title="Supprimer ce bâtiment">🗑 Supprimer</button>'
        );
      $(".building-value", card).innerHTML = `${fmt(
        elec(name)
      )} <small>kWh</small><span></span>`;
      setTrend(
        $(".building-value span", card),
        elec(name),
        totalPrev("Électricité", [name]),
        true
      );
      $(".mini-progress i", card).style.width = (elec(name) / max) * 100 + "%";
      $("a.text-link", card).href = "detail.html?b=" + encodeURIComponent(name);
    });
    $(".total-card h2").textContent = "Électricité totale";
    const all = ofRes(state.mesures, "Électricité");
    $(".total-card > strong").innerHTML = `${fmt(sum(all))} <small>kWh</small>`;
    setTrend($(".total-card p"), sum(all), totalPrev("Électricité"));

    $("#buildingGrid").addEventListener("click", async (e) => {
      const btn = e.target.closest(".del-bat");
      if (!btn) return;
      const name = btn.closest(".building-card").dataset.name;
      const n = byBat(name).length;
      if (
        !(await ask({
          title: `Supprimer « ${name} » ?`,
          text: `Le bâtiment et ses ${n} mesure(s) seront supprimés.`,
          ok: "Supprimer",
        }))
      )
        return;
      const backupM = state.mesures,
        backupB = state.batiments;
      state.mesures = state.mesures.filter((m) => m.batiment !== name);
      state.batiments = state.batiments.filter((b) => b.nom !== name);
      if (!(await persist())) {
        state.mesures = backupM; // échec : on annule
        state.batiments = backupB;
        return;
      }
      if (!SERVER) {
        const del = readList(DKEY);
        if (!del.includes(name)) del.push(name);
        localStorage.setItem(DKEY, JSON.stringify(del));
        localStorage.setItem(
          BKEY,
          JSON.stringify(readList(BKEY).filter((x) => x.nom !== name))
        );
      }
      toast(
        SERVER
          ? "Bâtiment supprimé (data.json et data.csv mis à jour)."
          : "Bâtiment supprimé."
      );
      setTimeout(() => location.reload(), 600);
    });

    const search = $("#buildingSearch");
    const typeSel = $(".building-search select");
    const topIn = $(".topbar .search input");
    $("#buildingGrid").insertAdjacentHTML(
      "afterend",
      '<p class="muted" id="noBat" hidden>Aucun bâtiment trouvé.</p>'
    );
    const apply = () => {
      const q = norm(search.value || topIn.value);
      let n = 0;
      $$(".building-card:not(.total-card)").forEach((c) => {
        const okType =
          typeSel.value.startsWith("Tous") || c.dataset.type === typeSel.value;
        c.hidden = !(
          okType && norm(`${c.dataset.name} ${c.dataset.type}`).includes(q)
        );
        if (!c.hidden) n++;
      });
      $("#noBat").hidden = n > 0;
    };
    search.addEventListener("input", apply);
    topIn.addEventListener("input", apply);
    const q0 = new URLSearchParams(location.search).get("q");
    if (q0) {
      topIn.value = q0;
      apply();
    }
    typeSel.addEventListener("change", apply);
  },

  detail() {
    const name =
      new URLSearchParams(location.search).get("b") || "Bibliothèque";
    const b = state.batiments.find((x) => x.nom === name);
    if (!b) return showError(`Bâtiment « ${name} » introuvable.`);
    $("h1").textContent = name;
    document.title = `EcoCampus — ${name}`;
    kpi(".metric.green", "Électricité", [name]);
    kpi(".metric.blue", "Eau", [name]);
    kpi(".metric.orange", "Chauffage", [name]);
    const list = byBat(name);
    swapForCanvas(".line-chart", "chartLine");
    mkChart("chartLine", () => lineCfg(list));
    const al = list
      .filter((m) => m.alerte)
      .sort((a, b) => b.date.localeCompare(a.date));
    const dd = $$(".details-panel dd");
    dd[0].textContent = b.surface ? `${fmt(b.surface)} m²` : "—";
    dd[1].textContent = b.type || "—";
    dd[2].textContent = b.etages ?? "—";
    dd[3].innerHTML = `<span class="status ${
      al.length ? "warning" : "normal"
    }">${al.length ? "Alerte" : "Normal"}</span>`;
    $(".recent-alert p").innerHTML = al.length
      ? `<b>${esc(al[0].ressource)} : ${fmt(al[0].valeur)} ${
          al[0].unite
        }${seuilTxt(al[0])}</b><small>${fmtDate(al[0].date)}</small>`
      : "<b>Aucune alerte récente</b>";
  },

  data() {
    const PAGE = 10;
    const F = { b: "", r: "", q: "", page: 1 };
    const topSearch = $(".topbar .search input");
    const textSearch = $("#textSearch");
    mountPeriod();
    const per = setupPeriod(true, () => sync());
    $("#buildingFilter").innerHTML =
      '<option value="">Tous les bâtiments</option>' +
      state.batiments.map((b) => `<option>${esc(b.nom)}</option>`).join("");

    const filtered = () =>
      state.mesures
        .filter(
          (m) =>
            (!F.b || m.batiment === F.b) &&
            (!F.r || m.ressource === F.r) &&
            per.inRange(m) &&
            (!F.q ||
              norm(`${m.id} ${m.batiment} ${m.ressource} ${m.valeur}`).includes(
                F.q
              ))
        )
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

    const row = (m) => {
      const r = RES[m.ressource];
      return `<tr class="${m.alerte ? "row-alert" : ""}"><td>${String(
        m.id
      ).padStart(3, "0")}</td><td>${esc(
        m.batiment
      )}</td><td><span class="resource-label ${r.cls}">${r.icon} ${
        m.ressource
      }</span></td><td>${fmt(m.valeur)}</td><td>${m.unite}</td><td>${fmtDate(
        m.date
      )}</td><td><span class="status ${m.alerte ? "warning" : "normal"}">${
        m.alerte ? "Alerte" : "Normal"
      }</span></td><td><button class="row-action" data-act="edit" data-id="${
        m.id
      }" title="Modifier la valeur" aria-label="Modifier">↗</button> <button class="row-action delete-row" data-act="del" data-id="${
        m.id
      }" title="Supprimer" aria-label="Supprimer">♲</button></td></tr>`;
    };

    const render = () => {
      const list = filtered();
      const pages = Math.max(1, Math.ceil(list.length / PAGE));
      F.page = Math.min(F.page, pages);
      const start = (F.page - 1) * PAGE;
      const view = list.slice(start, start + PAGE);
      $("#measureTable tbody").innerHTML = view.length
        ? view.map(row).join("")
        : '<tr><td colspan="8">Aucune mesure ne correspond aux filtres.</td></tr>';
      per.info(list.length);
      $("#tableCount").textContent = list.length
        ? `Affichage de ${start + 1} à ${start + view.length} sur ${
            list.length
          } entrée${list.length > 1 ? "s" : ""}`
        : "Aucune entrée";
      $(".pagination").innerHTML =
        `<button data-p="${F.page - 1}" ${
          F.page === 1 ? "disabled" : ""
        }>‹</button>` +
        Array.from(
          { length: pages },
          (_, i) =>
            `<button data-p="${i + 1}" class="${
              i + 1 === F.page ? "selected" : ""
            }">${i + 1}</button>`
        ).join("") +
        `<button data-p="${F.page + 1}" ${
          F.page === pages ? "disabled" : ""
        }>›</button>`;
    };

    const sync = () => {
      F.b = $("#buildingFilter").value;
      F.r = $("#resourceFilter").value;
      F.q = norm((textSearch.value || topSearch.value).trim());
      F.page = 1;
      $$(".resource-tabs [data-resource]").forEach((t) =>
        t.classList.toggle("active", t.dataset.resource === F.r)
      );
      render();
    };

    ["#buildingFilter", "#resourceFilter"].forEach((s) =>
      $(s).addEventListener("change", sync)
    );
    textSearch.addEventListener("input", sync);
    topSearch.addEventListener("input", sync);
    $("#searchBtn").addEventListener("click", () => {
      sync();
      toast(`${filtered().length} résultat(s) trouvé(s).`);
    });
    $$(".resource-tabs [data-resource]").forEach((t) =>
      t.addEventListener("click", () => {
        $("#resourceFilter").value = t.dataset.resource;
        sync();
      })
    );
    $(".pagination").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-p]");
      if (!b || b.disabled) return;
      F.page = +b.dataset.p;
      render();
    });

    /* modification / suppression : on met à jour l'écran PUIS data.json + data.csv ;
       si l'écriture échoue, on annule le changement. */
    $("#measureTable tbody").addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-act]");
      const m = btn && state.mesures.find((x) => x.id === +btn.dataset.id);
      if (!m) return;
      const backup = state.mesures.map((x) => ({ ...x }));
      if (btn.dataset.act === "del") {
        if (
          !(await ask({
            title: "Supprimer la mesure ?",
            text: `Mesure n°${m.id} — ${m.batiment}, ${m.ressource}.`,
            ok: "Supprimer",
          }))
        )
          return;
        state.mesures = state.mesures.filter((x) => x !== m);
      } else {
        const r = await ask({
          title: `Modifier la mesure n°${m.id}`,
          ok: "Enregistrer",
          fields: [
            {
              name: "valeur",
              label: `Valeur (${m.unite})`,
              type: "number",
              value: m.valeur,
            },
          ],
        });
        if (!r) return;
        m.valeur = +r.valeur;
        m.alerte = Number.isFinite(m.seuil) && m.valeur > m.seuil;
      }
      if (!(await persist())) state.mesures = backup;
      else if (SERVER) toast("data.json et data.csv mis à jour.");
      render();
    });

    /* Export : télécharge un fichier INDÉPENDANT « apercu_data.csv » (rien n'est affiché sur le site).
       Il contient la même présentation en blocs que l'aperçu : résumé, puis un bloc par bâtiment.
       Séparateur « ; » + BOM : s'ouvre en colonnes dans Excel. Le data.csv du dossier data est,
       lui, déjà mis à jour automatiquement à chaque changement. */
    $("#exportBtn").addEventListener("click", () => {
      if (!state.mesures.length)
        return toast("Aucune mesure à exporter.", "alert");
      const { csv } = buildFiles();
      const rows = csv
        .trim()
        .split("\n")
        .slice(1)
        .filter(Boolean)
        .map((l) => l.split(","));
      const groups = new Map();
      rows.forEach((r) => {
        if (!groups.has(r[1])) groups.set(r[1], []);
        groups.get(r[1]).push(r);
      });
      const alertes = rows.filter((r) => +r[3] > +r[5]).length;
      const L = [
        "APERÇU DE DATA.CSV",
        "Exporté le;" + new Date().toLocaleString("fr-FR"),
        "",
        "RÉSUMÉ",
        "Mesures;" + rows.length,
        "Alertes;" + alertes,
        "Bâtiments;" + groups.size,
      ];
      groups.forEach((list, bat) => {
        L.push(
          "",
          `BÂTIMENT : ${bat} (${list.length} mesure${
            list.length > 1 ? "s" : ""
          })`
        );
        L.push("ID;Ressource;Valeur;Date/Heure;Seuil;Statut");
        list.forEach((r) =>
          L.push(
            [
              r[0],
              r[2],
              r[3],
              r[4],
              r[5],
              +r[3] > +r[5] ? "Alerte" : "Normal",
            ].join(";")
          )
        );
      });
      saveBlob(
        "\ufeff" + L.join("\r\n") + "\r\n",
        "apercu_data.csv",
        "text/csv;charset=utf-8"
      );
      toast("Export réussi : apercu_data.csv téléchargé.");
    });

    $("#addRowBtn").addEventListener("click", async () => {
      const r = await ask({
        title: "Ajouter une mesure",
        ok: "Ajouter",
        fields: [
          {
            name: "bat",
            label: "Bâtiment",
            options: state.batiments.map((b) => b.nom),
          },
          { name: "res", label: "Ressource", options: Object.keys(RES) },
          {
            name: "valeur",
            label: "Valeur mesurée",
            type: "number",
            value: 500,
          },
        ],
      });
      if (!r) return;
      const { bat, res } = r,
        valeur = +r.valeur;
      const ref = state.mesures.find(
        (m) => m.batiment === bat && m.ressource === res
      );
      const now = new Date();
      const m = {
        id: Math.max(0, ...state.mesures.map((x) => x.id)) + 1,
        batiment: bat,
        ressource: res,
        valeur,
        unite: RES[res].unit,
        seuil: ref?.seuil ?? Number(SET["seuil_" + res]),
        date: new Date(now - now.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16),
      };
      m.alerte = valeur > m.seuil;
      state.mesures.push(m);
      if (!(await persist())) {
        state.mesures = state.mesures.filter((x) => x !== m); // annulé
        return render();
      }
      F.page = 1;
      render();
      if (m.alerte && SET.notif_alerte)
        toast(
          `Nouvelle anomalie : ${bat} — ${res} ${fmt(valeur)} ${
            m.unite
          }${seuilTxt(m)}`,
          "alert"
        );
      else if (SET.notif_ajout)
        toast(
          SERVER
            ? "Mesure ajoutée (data.json et data.csv mis à jour)."
            : "Mesure ajoutée dans le navigateur seulement : data.json n'a PAS été modifié (dossier data non connecté).",
          SERVER ? "ok" : "alert"
        );
    });

    const badge = $(".small-badge");
    const last = state.mesures
      .map((m) => m.date)
      .sort()
      .pop();
    badge.textContent = last
      ? `Dernière mesure : ${fmtDate(last)}`
      : "Aucune mesure";
    const links = {
      ok: " <b>Fichiers connectés :</b> data.json et data.csv sont mis à jour automatiquement.",
      prompt:
        ' <b>Dossier data déconnecté.</b> <a href="#" id="dirBtn" class="text-link">🔓 Réautoriser l\'écriture</a>',
      none: ' <b>Dossier data non connecté :</b> les changements restent dans ce navigateur. <a href="#" id="dirBtn" class="text-link">📁 Connecter le dossier data</a>',
      unsupported:
        " <b>Modifications gardées dans ce navigateur</b> (écriture directe dans data.json : Chrome ou Edge requis). Utilisez le bouton de téléchargement.",
    }[DIR_STATE];
    if (!SERVER)
      $(".notice").insertAdjacentHTML(
        "beforeend",
        links +
          ' <a href="#" id="resetBtn" class="text-link">↺ Réinitialiser</a>'
      );
    $("#dirBtn")?.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!(await connectDir())) return;
      try {
        await writeFiles(DIR_HANDLE); // écrit l'état actuel (rien n'est perdu)
        toast("Dossier connecté : data.json et data.csv mis à jour.");
        setTimeout(() => location.reload(), 800);
      } catch (err) {
        toast("Connexion impossible : " + err.message, "alert");
      }
    });
    $("#resetBtn")?.addEventListener("click", async (e) => {
      e.preventDefault();
      if (
        await ask({
          title: "Réinitialiser les données ?",
          text: "Vos ajouts, modifications et suppressions seront annulés.",
          ok: "Réinitialiser",
        })
      ) {
        localStorage.removeItem(KEY);
        location.reload();
      }
    });
    const q0 = new URLSearchParams(location.search).get("q");
    if (q0) topSearch.value = q0;
    sync();
  },

  settings() {
    $("[name=nb]").value = state.batiments.length;
    const top = $(".topbar .search input");
    const tabs = $$(".settings-tabs .tab");
    const go = (pane) => {
      $$(".settings-pane").forEach((p) => (p.hidden = p.dataset.pane !== pane));
      tabs.forEach((t) =>
        t.classList.toggle("active", t.dataset.pane === pane)
      );
    };
    const find = () => {
      $$(".hit").forEach((e) => e.classList.remove("hit"));
      const q = norm(top.value.trim());
      if (!q) return 0;
      const hits = $$(
        ".settings-card label, .settings-card h2, .setting-link"
      ).filter((el) => norm(el.textContent).includes(q));
      hits.forEach((h) => h.classList.add("hit"));
      if (hits.length) go(hits[0].closest(".settings-pane").dataset.pane);
      else {
        const t = tabs.find((x) => norm(x.textContent).includes(q));
        if (t) go(t.dataset.pane);
        return t ? 1 : 0;
      }
      return hits.length;
    };
    top.addEventListener("input", find);
    top.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && top.value.trim() && !find())
        toast("Aucun paramètre trouvé.", "alert");
    });
  },
};

/* ---------- Barre de recherche du haut ---------- */
const SITE_PAGES = [
  ["Tableau de bord", "accueil dashboard", HOME_URL],
  [
    "Données",
    "donnees mesures liste tableau export",
    PAGES_URL + "donnees.html",
  ],
  [
    "Graphiques",
    "graphiques courbes tendances statistiques analyse",
    PAGES_URL + "graphique.html",
  ],
  ["Bâtiments", "batiments parc immobilier", PAGES_URL + "batiment.html"],
  [
    "Paramètres",
    "parametres reglages seuils notifications apparence theme mot de passe",
    PAGES_URL + "parametres.html",
  ],
];
function initSearch() {
  const top = $(".topbar .search input");
  if (!top) return;
  top.placeholder =
    {
      data: "Rechercher une mesure (bâtiment, ressource, valeur)…",
      buildings: "Rechercher un bâtiment…",
      charts: "Filtrer les graphiques (bâtiment ou ressource) puis Entrée…",
      settings: "Rechercher un paramètre…",
    }[PAGE] || "Rechercher un bâtiment, une page, une mesure…";
  if (["data", "buildings", "settings"].includes(PAGE)) return; // gérée par la page elle-même
  if (PAGE === "charts") {
    top.value = new URLSearchParams(location.search).get("q") || "";
    top.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const v = top.value.trim();
      const q = new URLSearchParams(location.search);
      if (v) q.set("q", v);
      else q.delete("q");
      location.search = q.toString();
    });
    return;
  }
  // tableau de bord / détail : liste de suggestions
  const box = document.createElement("div");
  box.className = "search-results";
  box.hidden = true;
  top.closest(".search").append(box);
  const render = () => {
    const raw = top.value.trim(),
      q = norm(raw);
    if (!q) return (box.hidden = true);
    const bats = state.batiments
      .filter((b) => norm(b.nom).includes(q))
      .slice(0, 5);
    const pgs = SITE_PAGES.filter(([n, k]) => norm(n + " " + k).includes(q));
    box.innerHTML =
      (bats.length
        ? "<h4>Bâtiments</h4>" +
          bats
            .map(
              (b) =>
                `<a href="${PAGES_URL}detail.html?b=${encodeURIComponent(
                  b.nom
                )}"><span>▦</span>${esc(b.nom)}<small>${esc(
                  b.type || ""
                )}</small></a>`
            )
            .join("")
        : "") +
      (pgs.length
        ? "<h4>Pages</h4>" +
          pgs
            .map(([n, , u]) => `<a href="${u}"><span>→</span>${esc(n)}</a>`)
            .join("")
        : "") +
      `<h4>Mesures</h4><a href="${PAGES_URL}donnees.html?q=${encodeURIComponent(
        raw
      )}"><span>⌕</span>Chercher « ${esc(raw)} » dans les mesures</a>`;
    box.hidden = false;
  };
  top.addEventListener("input", render);
  top.addEventListener("focus", render);
  top.addEventListener("keydown", (e) => {
    if (e.key === "Escape") box.hidden = true;
    if (e.key === "Enter" && top.value.trim())
      location.href =
        PAGES_URL + "donnees.html?q=" + encodeURIComponent(top.value.trim());
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search")) box.hidden = true;
  });
}

/* ---------- Éléments communs (thème, onglets, paramètres) ---------- */
function initCommon() {
  applySettings();
  const who = getAuth();
  if (who && $(".top-actions")) {
    $(".top-actions").insertAdjacentHTML(
      "beforeend",
      '<button class="icon-btn logout-btn" title="Se déconnecter" aria-label="Se déconnecter">⎋</button>'
    );
    $(".logout-btn").addEventListener("click", logout);
    const pr = $(".profile");
    if (pr) pr.textContent = who.u;
    const av = $(".avatar");
    if (av) av.textContent = who.u.charAt(0).toUpperCase();
  }
  $("#themeToggle")?.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    SET.theme = document.body.classList.contains("dark-mode")
      ? "dark"
      : "light";
    localStorage.setItem("ecocampus-theme", SET.theme);
    localStorage.setItem(SKEY, JSON.stringify(SET));
    redraw.forEach((f) => f());
  });
  initSearch();
  $$(".top-actions .icon-btn")[1]?.addEventListener("click", () => {
    const n = state.mesures.filter((m) => m.alerte).length;
    toast(
      n
        ? `${n} alerte(s) active(s). Détails dans la page Données.`
        : "Aucune alerte active.",
      n ? "alert" : "ok"
    );
  });

  $("#newBuilding")?.addEventListener("click", async () => {
    const r = await ask({
      title: "Nouveau bâtiment",
      ok: "Créer",
      fields: [
        { name: "nom", label: "Nom du bâtiment" },
        {
          name: "type",
          label: "Type",
          options: ["Enseignement", "Résidence", "Administration"],
        },
        {
          name: "etages",
          label: "Nombre d'étages",
          type: "number",
          min: 1,
          value: 1,
        },
        {
          name: "surface",
          label: "Surface (m²)",
          type: "number",
          min: 1,
          value: 500,
        },
      ],
    });
    if (!r) return;
    const nom = r.nom.trim();
    if (!nom) return toast("Le nom est obligatoire.", "alert");
    if (state.batiments.some((b) => b.nom.toLowerCase() === nom.toLowerCase()))
      return toast("Ce bâtiment existe déjà.", "alert");
    if (/[,"\n\r]/.test(nom) || nom.length > 49)
      return toast(
        "Nom invalide : pas de virgule ni de guillemet, 49 caractères max.",
        "alert"
      );
    const nb = { nom, type: r.type, etages: +r.etages, surface: +r.surface };
    state.batiments.push(nb);
    if (!(await persist())) {
      state.batiments.pop();
      return;
    }
    if (!SERVER) {
      localStorage.setItem(
        DKEY,
        JSON.stringify(
          readList(DKEY).filter((x) => x.toLowerCase() !== nom.toLowerCase())
        )
      );
      const list = readList(BKEY);
      list.push(nb);
      localStorage.setItem(BKEY, JSON.stringify(list));
    }
    location.reload();
  });

  const sf = $("#settingsForm");
  if (sf) {
    $$("[name]", sf).forEach((i) => {
      if (i.type === "radio") i.checked = i.value === SET[i.name];
      else if (i.type === "checkbox") i.checked = !!SET[i.name];
      else if (i.name !== "nb") i.value = SET[i.name] ?? "";
    });
    sf.addEventListener("submit", (e) => {
      e.preventDefault();
      saveSettings(sf);
    });
    $$(".settings-tabs .tab").forEach((t) =>
      t.addEventListener("click", () =>
        $$(".settings-pane").forEach(
          (p) => (p.hidden = p.dataset.pane !== t.dataset.pane)
        )
      )
    );
    $("#pwdBtn").addEventListener("click", async (e) => {
      e.preventDefault();
      const r = await ask({
        title: "Changer le mot de passe",
        ok: "Changer",
        fields: [
          { name: "a", label: "Mot de passe actuel", type: "password" },
          {
            name: "n",
            label: "Nouveau mot de passe (8 caractères min.)",
            type: "password",
          },
          { name: "c", label: "Confirmer", type: "password" },
        ],
      });
      if (!r) return;
      const me = getAuth();
      if (!me || !(await checkLogin(me.u, r.a)))
        return toast("Mot de passe actuel incorrect.", "alert");
      if (r.n.length < 8 || r.n !== r.c)
        return toast(
          "Nouveau mot de passe trop court (8 min.) ou confirmation différente.",
          "alert"
        );
      await changePassword(me.u, r.n);
      toast("Mot de passe modifié.");
    });
    $("#resetAll").addEventListener("click", async (e) => {
      e.preventDefault();
      if (
        await ask({
          title: "Tout réinitialiser ?",
          text: SERVER
            ? "Vos préférences seront effacées (data.json, data.csv et les comptes ne sont pas touchés)."
            : "Mesures, bâtiments et préférences seront effacés. Les comptes utilisateurs sont conservés.",
          ok: "Réinitialiser",
        })
      ) {
        [KEY, BKEY, DKEY, SKEY, "ecocampus-theme"].forEach((k) =>
          localStorage.removeItem(k)
        );
        location.reload();
      }
    });
  }

  $$(".chart-tabs .tab, .detail-tabs .tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      $$(".tab", tab.parentElement).forEach((t) =>
        t.classList.remove("active")
      );
      tab.classList.add("active");
    })
  );
  $$(".settings-tabs .tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      $$(".tab", tab.parentElement).forEach((t) =>
        t.classList.remove("active")
      );
      tab.classList.add("active");
    })
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  if (PAGE !== "login" && !getAuth()) return; // redirection vers la connexion en cours
  const page = PAGE;
  if (page === "login") {
    applySettings();
    return initLogin();
  }
  initCommon();
  if (!pages[page]) return;
  await detectDir();
  const data = await loadData();
  if (!data) return;
  clean(data);
  if (page !== "data" && page !== "buildings") await loadChartJs();
  pages[page]();
});
