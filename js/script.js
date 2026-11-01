/* =====================================================================
   EcoCampus — Module Web (Module B)

   Ce fichier est chargé par TOUTES les pages du site. Il lit data/data.json
   (produit par le module C) puis remplit les tableaux, KPI et graphiques.

   Chrome / Edge : après avoir connecté le dossier « data » (une seule fois),
   chaque ajout, modification ou suppression réécrit data/data.json ET
   data/data.csv dans EXACTEMENT le même format que le module C.

   Plan du fichier (cherchez « PARTIE » pour naviguer) :
     PARTIE 1  — Constantes et adresses
     PARTIE 2  — Petits outils réutilisables
     PARTIE 3  — Connexion et comptes utilisateurs
     PARTIE 4  — Conversion des données du module C
     PARTIE 5  — Réglages de l'utilisateur
     PARTIE 6  — Messages et boîtes de dialogue
     PARTIE 7  — Enregistrement dans data.json et data.csv
     PARTIE 8  — Chargement et vérification des données
     PARTIE 9  — Tendances et KPI
     PARTIE 10 — Graphiques
     PARTIE 11 — Sélecteur de période
     PARTIE 12 — Une fonction par page du site (dont Mon profil)
     PARTIE 13 — Barre de recherche du haut
     PARTIE 14 — Éléments communs à toutes les pages
     PARTIE 15 — Démarrage

   Le démarrage (PARTIE 15) est le meilleur point d'entrée pour lire le code.

   Notions JavaScript utilisées dans ce fichier :
     a?.b              lit b seulement si a existe (sinon undefined, pas d'erreur)
     a ?? b            a, ou b si a vaut null ou undefined
     a || b            a, ou b si a est « vide » (null, undefined, 0, "", false)
     [...liste]        copie d'un tableau ; { ...objet } copie d'un objet
     (x) => x * 2      fonction fléchée : une fonction courte, sans le mot function
     `Bonjour ${nom}`  gabarit : insère la valeur de nom dans le texte
     liste.map(f)      nouveau tableau : f appliquée à chaque élément
     liste.filter(f)   nouveau tableau : les éléments pour lesquels f renvoie true
     liste.reduce(...) combine tous les éléments en une seule valeur (ex. une somme)
     texte.slice(a, b) morceau du texte de la position a à b (b non comprise)
     async / await     attend une opération lente (fichier, réseau) sans bloquer la page
   ===================================================================== */

/* =====================================================================
   PARTIE 1 — Constantes et adresses
   ===================================================================== */

/* Adresses calculées à partir de l'emplacement de ce fichier :
   elles fonctionnent depuis index.html comme depuis le dossier pages/. */
const SCRIPT_URL = document.currentScript.src;
const DATA_URL = new URL("../data/data.json", SCRIPT_URL).href;
const LOGIN_URL = new URL("../pages/login.html", SCRIPT_URL).href;
const HOME_URL = new URL("../index.html", SCRIPT_URL).href;
const PAGES_URL = new URL("../pages/", SCRIPT_URL).href;

/* Nom de la page actuelle : attribut data-page de la balise <body> */
const CURRENT_PAGE = document.body.dataset.page;

/* Noms des cases utilisées dans le stockage du navigateur (localStorage) */
const SESSION_KEY = "ecocampus-auth";
const USERS_KEY = "ecocampus-users";
const OLD_USER_KEY = "ecocampus-user";
const MEASURES_KEY = "ecocampus-mesures";
const SETTINGS_KEY = "ecocampus-settings";
const ADDED_BUILDINGS_KEY = "ecocampus-bats";
const DELETED_BUILDINGS_KEY = "ecocampus-deleted";
const THEME_KEY = "ecocampus-theme";
const FOLDER_ASKED_KEY = "ecocampus-asked";
const ACTIVITY_KEY = "ecocampus-activite";

/* Les trois ressources suivies par le site */
const RESOURCES = {
  Électricité: { unit: "kWh", icon: "ϟ", cssColor: "--c-elec", cssClass: "" },
  Eau: {
    unit: "m³",
    icon: "♒",
    cssColor: "--c-water",
    cssClass: "water-text",
  },
  Chauffage: {
    unit: "kWh",
    icon: "♨",
    cssColor: "--c-heat",
    cssClass: "heat-text",
  },
};
const RESOURCE_NAMES = Object.keys(RESOURCES);

/* Les bâtiments déjà présents dans le code HTML de la page Bâtiments */
const BUILDINGS_IN_HTML = [
  "Cours",
  "Laboratoires",
  "Bibliothèque",
  "Résidence",
  "Administration",
];

/* Le type de chaque bâtiment connu */
const BUILDING_TYPES = {
  Cours: "Enseignement",
  Laboratoires: "Enseignement",
  Bibliothèque: "Enseignement",
  Résidence: "Résidence",
  Administration: "Administration",
};

/* Les données chargées, partagées par tout le site */
const state = { mesures: [], batiments: [], precedent: {}, generated: "" };

/* =====================================================================
      PARTIE 2 — Petits outils réutilisables
      ===================================================================== */

/* Trouve le premier élément HTML qui correspond au sélecteur CSS */
function findOne(selector, parent = document) {
  return parent.querySelector(selector);
}

/* Trouve tous les éléments HTML qui correspondent (renvoie un vrai tableau) */
function findAll(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

/* Lit une liste dans le localStorage (liste vide si absente ou abîmée) */
function readStoredList(key) {
  try {
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/* Additionne les valeurs d'une liste de mesures */
function sumValues(measures) {
  return measures.reduce((total, measure) => total + measure.valeur, 0);
}

/* Arrondit à 2 chiffres après la virgule : 12.3456 devient 12.35.
      On multiplie par 100, on arrondit à l'entier, puis on divise par 100. */
function roundTo2Decimals(number) {
  return Math.round(number * 100) / 100;
}

/* 12500 devient « 12 500 » */
function formatNumber(number) {
  return Math.round(number).toLocaleString("fr-FR");
}

/* Ajoute un « s » au mot quand il y a plusieurs éléments */
function plural(count, word) {
  return count > 1 ? word + "s" : word;
}

/* Remplace les caractères spéciaux pour afficher un texte sans danger dans du HTML */
function escapeHtml(text) {
  const replacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(text).replace(/[&<>"']/g, (char) => replacements[char]);
}

/* Minuscules et sans accents : « Bâtiment » devient « batiment ».
      Permet de comparer des textes dans les recherches. */
function normalizeText(text) {
  return String(text)
    .toLocaleLowerCase("fr")
    .normalize("NFD") // sépare chaque lettre de son accent : « â » devient « a » + « ^ »
    .replace(/[̀-ͯ]/g, ""); // puis supprime les accents (codes 0300 à 036F)
}

/* Lit une variable de couleur définie dans style.css */
function getCssVariable(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

/* Toutes les mesures d'un bâtiment */
function measuresOfBuilding(buildingName) {
  return state.mesures.filter((measure) => measure.batiment === buildingName);
}

/* Ne garde que les mesures d'une ressource */
function filterByResource(measures, resource) {
  return measures.filter((measure) => measure.ressource === resource);
}

/* Lit un paramètre de l'adresse : getUrlParam("q") sur « page.html?q=eau » donne « eau » */
function getUrlParam(name) {
  return new URLSearchParams(location.search).get(name);
}

/* =====================================================================
      PARTIE 3 — Connexion et comptes utilisateurs
      Tout se passe dans le navigateur (il n'y a pas de serveur).
      Un compte est stocké sous la forme { u: nom, h: mot de passe haché }.
      La page Profil y ajoute : nom, email, fonction, favori (bâtiment suivi),
      bio, cree (date de création), connexion et precedente (dates de connexion).
      ===================================================================== */

/* Renvoie la session en cours { u: nom, t: heure de connexion }, ou null */
function getSession() {
  try {
    return JSON.parse(
      sessionStorage.getItem(SESSION_KEY) ||
        localStorage.getItem(SESSION_KEY) ||
        "null"
    );
  } catch {
    return null;
  }
}

/* Dès le chargement : sans session on va à la connexion, et inversement */
if (CURRENT_PAGE !== "login" && !getSession()) location.replace(LOGIN_URL);
if (CURRENT_PAGE === "login" && getSession()) location.replace(HOME_URL);

/* Transforme le mot de passe en empreinte SHA-256 : on ne le stocke jamais en clair */
async function hashPassword(password) {
  try {
    const bytes = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // crypto.subtle n'existe pas sur un site non sécurisé (http)
    return "b64:" + btoa(unescape(encodeURIComponent(password)));
  }
}

/* Enregistre la liste des comptes dans le navigateur (localStorage).
      localStorage ne garde que du texte : JSON.stringify transforme la liste en texte. */
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/* Renvoie la liste des comptes (jamais effacée par « Réinitialiser ») */
async function loadUsers() {
  let users = null;
  try {
    users = JSON.parse(localStorage.getItem(USERS_KEY) || "null");
  } catch {}
  if (Array.isArray(users)) return users;

  /* Première visite : on crée la liste */
  users = [];
  try {
    // ancien format : un seul compte (mot de passe modifié)
    const oldUser = JSON.parse(localStorage.getItem(OLD_USER_KEY) || "null");
    if (oldUser && oldUser.u && oldUser.h) {
      users.push({ u: oldUser.u, h: oldUser.h });
    }
  } catch {}
  if (!users.some((user) => user.u === "admin")) {
    users.unshift({ u: "admin", h: await hashPassword("ecocampus2026") });
  }
  saveUsers(users);
  localStorage.removeItem(OLD_USER_KEY);
  return users;
}

/* Nettoie un nom d'utilisateur : enlève les espaces autour et met en minuscules,
      pour que « Admin » et « admin » soient le même compte. */
function cleanUsername(username) {
  return username.trim().toLowerCase();
}

/* Renvoie true si le nom et le mot de passe sont corrects */
async function checkLogin(username, password) {
  const name = cleanUsername(username);
  const users = await loadUsers();
  const user = users.find((candidate) => candidate.u === name);
  if (!user) return false;
  return user.h === (await hashPassword(password));
}

/* Crée un compte. Renvoie un message d'erreur, ou "" si tout va bien. */
async function registerUser(username, password) {
  const name = cleanUsername(username);
  if (!/^[a-z0-9._-]{3,20}$/.test(name)) {
    return "Nom d'utilisateur : 3 à 20 caractères (lettres, chiffres, . _ -).";
  }
  if (password.length < 8) return "Mot de passe : 8 caractères minimum.";

  const users = await loadUsers();
  if (users.some((user) => user.u === name)) {
    return "Ce nom d'utilisateur existe déjà.";
  }
  users.push({ u: name, h: await hashPassword(password), cree: Date.now() });
  saveUsers(users);
  return "";
}

/* Remplace le mot de passe d'un compte. On n'enregistre jamais le mot de passe
      lui-même, seulement son empreinte (voir hashPassword). */
async function changePassword(username, newPassword) {
  const users = await loadUsers();
  const user = users.find((candidate) => candidate.u === username);
  if (user) user.h = await hashPassword(newPassword);
  saveUsers(users);
}

/* Compte de l'utilisateur connecté (avec ses informations de profil), ou null */
async function getCurrentUser() {
  const session = getSession();
  if (!session) return null;
  const users = await loadUsers();
  return users.find((user) => user.u === session.u) || null;
}

/* Modifie le compte d'un utilisateur. changes = { nom: "...", email: "..." }.
      Renvoie le compte modifié, ou null s'il n'existe pas. */
async function updateUser(username, changes) {
  const users = await loadUsers();
  const user = users.find((candidate) => candidate.u === username);
  if (!user) return null;
  Object.assign(user, changes); // copie chaque champ de changes dans user
  saveUsers(users);
  return user;
}

/* Nom affiché : le nom complet s'il est renseigné, sinon le nom d'utilisateur */
function displayName(user) {
  return user.nom || user.u;
}

/* Retient l'heure de connexion : l'ancienne devient la « connexion précédente » */
async function recordLogin(username) {
  const users = await loadUsers();
  const user = users.find((candidate) => candidate.u === username);
  if (!user) return;
  await updateUser(username, {
    precedente: user.connexion,
    connexion: Date.now(),
  });
  logActivity("connexion", "Connexion au site", username);
}

/* --- Journal d'activité, gardé dans le navigateur pour chaque utilisateur :
      { admin: { compteurs: { ajout: 3, modif: 1 }, recent: [{ t, type, texte }] } }
      type : « ajout », « modif », « suppression », « connexion » ou « compte » --- */

/* Lit les journaux d'activité de tous les utilisateurs.
      try / catch : si le texte enregistré est abîmé, JSON.parse provoque une erreur ;
      on la « rattrape » et on renvoie un objet vide au lieu de bloquer la page. */
function readAllJournals() {
  try {
    const journals = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "{}");
    return journals && typeof journals === "object" ? journals : {};
  } catch {
    return {};
  }
}

/* Journal d'un utilisateur (vide s'il n'a encore rien fait) */
function readJournal(username) {
  const journal = readAllJournals()[username] || {};
  return {
    compteurs: journal.compteurs || {},
    recent: Array.isArray(journal.recent) ? journal.recent : [],
  };
}

/* Note une action. On garde tous les compteurs mais seulement les 20 dernières actions. */
function logActivity(type, text, username = getSession()?.u) {
  if (!username) return;
  const journals = readAllJournals();
  const journal = readJournal(username);
  journal.compteurs[type] = (journal.compteurs[type] || 0) + 1;
  journal.recent = [
    { t: Date.now(), type, texte: text },
    ...journal.recent,
  ].slice(0, 20);
  journals[username] = journal;
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(journals));
  } catch {}
}

/* remember = true : la session survit à la fermeture du navigateur */
function startSession(username, remember) {
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify({ u: username, t: Date.now() }));
  location.replace(HOME_URL);
}

/* Déconnexion : efface la session (dans les deux stockages possibles)
      puis renvoie vers la page de connexion. */
function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  location.replace(LOGIN_URL);
}

/* Affiche une erreur dans un formulaire et le fait « trembler » */
function showFormError(form, errorElement, message) {
  errorElement.textContent = message;
  errorElement.hidden = false;
  form.classList.remove("shake");
  void form.offsetWidth; // oblige le navigateur à relancer l'animation
  form.classList.add("shake");
}

/* Page de connexion : deux onglets, « in » (connexion) et « up » (création de compte) */
function setupLoginPage() {
  const loginForm = findOne("#loginForm");
  const signupForm = findOne("#signupForm");
  const tabs = findAll(".login-tabs button");

  /* Affiche l'onglet demandé (« in » = connexion, « up » = création de compte)
        et cache l'autre. Le bouton de l'onglet affiché reçoit la classe « active ». */
  function showTab(tabName) {
    const isLogin = tabName === "in";
    loginForm.hidden = !isLogin;
    signupForm.hidden = tabName !== "up";
    tabs.forEach((tab) =>
      tab.classList.toggle("active", tab.dataset.tab === tabName)
    );
    findOne("#loginTitle").textContent = isLogin
      ? "Connexion"
      : "Créer un compte";
    findAll(".login-error").forEach((error) => (error.hidden = true));
    findOne(isLogin ? "#loginUser" : "#suUser").focus();
  }

  tabs.forEach((tab) =>
    tab.addEventListener("click", () => showTab(tab.dataset.tab))
  );

  /* Bouton « œil » : affiche ou masque le mot de passe */
  findAll(".pwd-toggle").forEach((button) =>
    button.addEventListener("click", () => {
      const input = button.previousElementSibling;
      input.type = input.type === "password" ? "text" : "password";
    })
  );

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = findOne("#loginError");
    const username = findOne("#loginUser").value;
    const password = findOne("#loginPass").value;
    error.hidden = true;

    if (!username.trim() || !password) {
      showFormError(
        loginForm,
        error,
        "Entrez votre nom d'utilisateur et votre mot de passe."
      );
      return;
    }
    if (await checkLogin(username, password)) {
      await recordLogin(cleanUsername(username));
      startSession(cleanUsername(username), findOne("#loginRemember").checked);
    } else {
      showFormError(
        loginForm,
        error,
        "Nom d'utilisateur ou mot de passe incorrect."
      );
      findOne("#loginPass").select();
    }
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = findOne("#signupError");
    const username = findOne("#suUser").value;
    const password = findOne("#suPass").value;
    error.hidden = true;

    if (password !== findOne("#suPass2").value) {
      showFormError(
        signupForm,
        error,
        "Les deux mots de passe ne sont pas identiques."
      );
      return;
    }
    const errorMessage = await registerUser(username, password);
    if (errorMessage) {
      showFormError(signupForm, error, errorMessage);
      return;
    }
    await recordLogin(cleanUsername(username));
    startSession(cleanUsername(username), true); // compte créé : connexion directe
  });
}

/* =====================================================================
      PARTIE 4 — Conversion des données du module C
      Le module C écrit « Bibliotheque » et « electricite », le site affiche
      « Bibliothèque » et « Électricité ». Ces tables font la traduction.
      ===================================================================== */

const RESOURCE_FROM_C = {
  electricite: "Électricité",
  eau: "Eau",
  chauffage: "Chauffage",
};
const RESOURCE_TO_C = {
  Électricité: "electricite",
  Eau: "eau",
  Chauffage: "chauffage",
};
const BUILDING_FROM_C = {
  Cours: "Cours",
  Bibliotheque: "Bibliothèque",
  Residence: "Résidence",
};
const BUILDING_TO_C = {
  Cours: "Cours",
  Bibliothèque: "Bibliotheque",
  Résidence: "Residence",
};

/* Calcule une courte « signature » du contenu de data.json (hash djb2).
      Elle change dès que le fichier change : on sait ainsi si la copie gardée
      dans le navigateur (localStorage) est encore valable. */
function computeSignature(measures) {
  const text = JSON.stringify(measures);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    /* hash << 5 = hash × 32, donc la ligne fait hash × 33 + code de la lettre.
          « | 0 » garde un entier sur 32 bits pour que le nombre ne grandisse pas sans fin. */
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return measures.length + "-" + (hash >>> 0).toString(36);
}

/* Traduit le contenu de data.json vers les noms utilisés par le site */
function convertFromModuleC(data) {
  const mesures = data.mesures.map((measure) => ({
    ...measure,
    ressource: RESOURCE_FROM_C[measure.ressource] || measure.ressource,
    batiment: BUILDING_FROM_C[measure.batiment] || measure.batiment,
    date: String(measure.date_heure || measure.date || "").replace(" ", "T"),
  }));

  let batiments;
  if (Array.isArray(data.batiments)) {
    batiments = data.batiments.map((building) => {
      const nom = BUILDING_FROM_C[building.nom] || building.nom;
      return {
        ...building,
        nom,
        type: building.type || BUILDING_TYPES[nom] || "",
      };
    });
  } else {
    /* Pas de liste de bâtiments : on la déduit des mesures */
    const names = [...new Set(mesures.map((measure) => measure.batiment))];
    batiments = names.map((nom) => ({ nom, type: BUILDING_TYPES[nom] || "" }));
  }

  return {
    ...data,
    mesures,
    batiments,
    precedent: data.precedent || {},
    genere_le: data.genere_le || computeSignature(data.mesures),
  };
}

/* =====================================================================
      PARTIE 5 — Réglages de l'utilisateur
      ===================================================================== */

const DEFAULT_SETTINGS = {
  campus: "EcoCampus",
  lieu: "Tunis, Tunisie",
  format: "CSV",
  theme: localStorage.getItem(THEME_KEY) || "light",
  langue: "Français",
  date: "JJ/MM/AAAA",
  taille: "normal",
  seuil_Électricité: 2000,
  seuil_Eau: 500,
  seuil_Chauffage: 1500,
  notif_alerte: true,
  notif_ajout: true,
};

/* Réglages enregistrés, complétés par les valeurs par défaut */
function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings = readSettings();

/* iso = « 2026-10-09T14:00 ». Résultat : « 09/10/2026 14:00 »
      slice découpe le texte par position :  2026-10-09T14:00
                                             0123456789...  → slice(0, 4) = « 2026 » */
function formatDate(iso) {
  const year = iso.slice(0, 4);
  const month = iso.slice(5, 7);
  const day = iso.slice(8, 10);
  const time = iso.slice(11, 16);
  if (settings.date === "AAAA-MM-JJ") return `${iso.slice(0, 10)} ${time}`;
  return `${day}/${month}/${year} ${time}`;
}

/* Texte « (seuil 2 000) », ou rien si la mesure n'a pas de seuil */
function thresholdText(measure) {
  return Number.isFinite(measure.seuil)
    ? ` (seuil ${formatNumber(measure.seuil)})`
    : "";
}

/* Applique les réglages à la page : thème, taille du texte, nom du campus */
function applySettings() {
  document.body.classList.toggle("dark-mode", settings.theme === "dark");
  document.body.classList.toggle("big-text", settings.taille === "grand");
  findAll(".brand b").forEach(
    (brand) => (brand.textContent = settings.campus || "EcoCampus")
  );
  const copyright = findAll(".footer span")[1];
  if (copyright) {
    const year = new Date().getFullYear();
    copyright.textContent = `© ${year} ${settings.campus} · Tous droits réservés`;
  }
}

/* Enregistre tous les champs du formulaire de la page Paramètres */
function saveSettings(form) {
  const newSettings = readSettings();
  findAll("[name]", form).forEach((input) => {
    if (input.name === "nb") return; // nombre de bâtiments : affichage seulement

    if (input.type === "radio") {
      if (input.checked) newSettings[input.name] = input.value;
    } else if (input.type === "checkbox") {
      newSettings[input.name] = input.checked;
    } else if (input.type === "number") {
      newSettings[input.name] = Number(input.value);
    } else {
      newSettings[input.name] = input.value;
    }
  });
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  localStorage.setItem(THEME_KEY, newSettings.theme);
  settings = readSettings();
  applySettings();
  redrawAllCharts();
  showToast("Vos préférences ont été enregistrées.");
}

/* =====================================================================
      PARTIE 6 — Messages et boîtes de dialogue
      ===================================================================== */

/* Petit message temporaire. type : « ok » (vert) ou « alert » (rouge) */
function showToast(message, type = "ok") {
  let container = findOne(".toast-wrap");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-wrap";
    document.body.append(container);
  }
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  container.append(toast);
  setTimeout(() => toast.remove(), 4500);
}

/* Message d'erreur permanent en haut de la page */
function showError(message) {
  const notice = document.createElement("div");
  notice.className = "notice error";
  notice.textContent = "⚠ " + message;
  findOne(".content")?.prepend(notice);
}

/* Code HTML d'un champ de boîte de dialogue : liste déroulante si le champ
      a des « options », zone de saisie sinon */
function dialogFieldHtml(field) {
  const label = escapeHtml(field.label);
  if (field.options) {
    const options = field.options
      .map((option) => `<option>${escapeHtml(option)}</option>`)
      .join("");
    return `<label>${label}<select name="${field.name}">${options}</select></label>`;
  }
  const type = field.type || "text";
  const value = escapeHtml(field.value ?? "");
  const numberLimits =
    field.type === "number" ? `step="any" min="${field.min ?? 0}"` : "";
  const required = field.required === false ? "" : "required";
  return `<label>${label}<input name="${field.name}" type="${type}" value="${value}" ${numberLimits} ${required}></label>`;
}

/* Ouvre une boîte de dialogue (remplace prompt et confirm).
      Renvoie les valeurs saisies { nomDuChamp: valeur }, ou null si on annule. */
function openDialog({ title, text = "", fields = [], ok = "Valider" }) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "modal";
    const paragraph = text ? `<p>${escapeHtml(text)}</p>` : "";
    const fieldsHtml = fields.map(dialogFieldHtml).join("");
    dialog.innerHTML = `<form method="dialog"><h2>${escapeHtml(
      title
    )}</h2>${paragraph}${fieldsHtml}
         <div class="modal-actions"><button type="button" class="btn btn-outline-success" data-x>Annuler</button>
         <button class="btn btn-success" value="ok">${escapeHtml(
           ok
         )}</button></div></form>`;
    document.body.append(dialog);

    const form = findOne("form", dialog);
    findOne("[data-x]", dialog).onclick = () => dialog.close("cancel");
    dialog.addEventListener("close", () => {
      const confirmed = dialog.returnValue === "ok";
      resolve(confirmed ? Object.fromEntries(new FormData(form)) : null);
      dialog.remove();
    });
    dialog.showModal();
    findOne("input,select", dialog)?.focus();
  });
}

/* =====================================================================
      PARTIE 7 — Enregistrement dans data.json et data.csv
   
      Chrome / Edge : l'utilisateur choisit une fois le dossier « data »
      (File System Access API), puis chaque changement réécrit les deux fichiers.
      Sinon : repli sur le localStorage + bouton de téléchargement.
      ===================================================================== */

let isFolderConnected = false; // true = on peut écrire dans le dossier data
let dataFolder = null; // accès au dossier choisi par l'utilisateur
let folderStatus = "unsupported"; // ok | prompt | none | unsupported

/* --- Petit stockage IndexedDB : le seul qui sait garder l'accès au dossier --- */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ecocampus", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("kv");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* Lit une valeur enregistrée dans IndexedDB (la petite base de données du navigateur).
      IndexedDB répond plus tard (de façon asynchrone) : on l'emballe dans une Promise
      pour pouvoir écrire simplement « await databaseGet(clé) ». */
async function databaseGet(key) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction("kv").objectStore("kv").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* Enregistre une valeur dans IndexedDB sous le nom « key »
      (« readwrite » = on a le droit d'écrire). */
async function databaseSet(key, value) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction("kv", "readwrite")
      .objectStore("kv")
      .put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/* Au démarrage : retrouve le dossier connecté lors d'une visite précédente */
async function detectDataFolder() {
  if (typeof window.showDirectoryPicker !== "function") {
    folderStatus = "unsupported";
    return;
  }
  folderStatus = "none";
  try {
    const savedFolder = await databaseGet("dir");
    if (!savedFolder) return;
    dataFolder = savedFolder;
    const permission = await savedFolder.queryPermission({ mode: "readwrite" });
    folderStatus = permission === "granted" ? "ok" : "prompt";
    isFolderConnected = folderStatus === "ok";
  } catch {}
}

/* --- Construction du contenu des fichiers --- */

/* Enlève les caractères qui casseraient le CSV */
function cleanName(name) {
  return String(name)
    .replace(/[,\r\n"]/g, " ")
    .trim();
}

/* Traduit une mesure du site vers le format du module C */
function toModuleCMeasure(measure) {
  const seuil = Number.isFinite(measure.seuil) ? measure.seuil : 0;
  return {
    id: measure.id,
    batiment: cleanName(BUILDING_TO_C[measure.batiment] || measure.batiment),
    ressource:
      RESOURCE_TO_C[measure.ressource] ||
      cleanName(measure.ressource).toLowerCase(),
    valeur: roundTo2Decimals(measure.valeur),
    date_heure: String(measure.date).replace("T", " ").slice(0, 16),
    seuil: roundTo2Decimals(seuil),
    alerte: measure.valeur > seuil,
  };
}

/* Regroupe les mesures par couple bâtiment + ressource */
function groupByBuildingAndResource(measures) {
  const groups = new Map();
  measures.forEach((measure) => {
    /* clé unique par couple, ex. « Cours » + « eau ». Le séparateur "\u0000"
          ne peut apparaître dans aucun nom, donc deux couples ne se confondent jamais. */
    const key = measure.batiment + "\u0000" + measure.ressource;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(measure);
  });
  return [...groups.values()];
}

/* Statistiques d'un groupe de mesures */
function computeStatistics(group) {
  const values = group.map((measure) => measure.valeur);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    batiment: group[0].batiment,
    ressource: group[0].ressource,
    nb_mesures: group.length,
    total: roundTo2Decimals(total),
    moyenne: roundTo2Decimals(total / group.length),
    min: Math.min(...values),
    max: Math.max(...values),
    nb_alertes: group.filter((measure) => measure.alerte).length,
  };
}

/* Compare la première et la dernière moyenne mobile (écart de moins de 5 % = stable) */
function trendName(firstAverage, lastAverage) {
  const margin = 0.05 * Math.abs(firstAverage);
  const change = lastAverage - firstAverage;
  if (change > margin) return "hausse";
  if (change < -margin) return "baisse";
  return "stable";
}

/* Tendance d'un groupe de mesures, par moyenne mobile */
function computeTrend(group) {
  const WINDOW = 2; // = FENETRE_MOBILE du module C
  const sorted = [...group].sort((a, b) =>
    a.date_heure.localeCompare(b.date_heure)
  );

  /* Moyenne des WINDOW mesures qui se terminent à la position endIndex */
  function movingAverage(endIndex) {
    const measures = sorted.slice(endIndex - WINDOW + 1, endIndex + 1);
    return roundTo2Decimals(sumValues(measures) / WINDOW);
  }

  let tendance = "indeterminee";
  let firstAverage = null;
  let lastAverage = null;
  if (sorted.length > WINDOW) {
    firstAverage = movingAverage(WINDOW - 1);
    lastAverage = movingAverage(sorted.length - 1);
    tendance = trendName(firstAverage, lastAverage);
  }

  return {
    batiment: sorted[0].batiment,
    ressource: sorted[0].ressource,
    fenetre: WINDOW,
    nb_mesures: sorted.length,
    tendance,
    premiere_moyenne: firstAverage,
    derniere_moyenne: lastAverage,
    points: sorted.map((measure, index) => ({
      date_heure: measure.date_heure,
      valeur: measure.valeur,
      moyenne_mobile: index >= WINDOW - 1 ? movingAverage(index) : null,
    })),
  };
}

/* --- Écriture du texte JSON avec la mise en page exacte du module C --- */

/* Écrit un texte entre guillemets, au format JSON : Cours devient "Cours".
      JSON.stringify ajoute aussi un \ devant les guillemets qui sont dans le texte. */
function quoted(value) {
  return JSON.stringify(value);
}

/* Nombre écrit avec 2 décimales : 12 devient « 12.00 » */
function decimal(number) {
  return Number(number).toFixed(2);
}

/* Nombre avec 2 décimales, ou le mot null s'il n'y a pas de nombre
      (null en JSON veut dire « pas de valeur »). */
function decimalOrNull(number) {
  return number == null ? "null" : decimal(number);
}

/* Nombre entier écrit en texte, ou null si ce n'est pas un vrai nombre. */
function integerOrNull(number) {
  return Number.isFinite(number) ? String(number) : "null";
}

/* Lignes d'un tableau JSON. isLast : pas de virgule après le crochet fermant. */
function jsonArrayLines(name, items, isLast = false) {
  return [
    `  "${name}": [`,
    ...items.map(
      (item, index) => "    " + item + (index < items.length - 1 ? "," : "")
    ),
    "  ]" + (isLast ? "" : ","),
  ];
}

/* Une ligne JSON qui décrit un bâtiment : nom, type, étages, surface. */
function buildingJsonLine(building) {
  const nom = cleanName(BUILDING_TO_C[building.nom] || building.nom);
  return `{"nom": ${quoted(nom)}, "type": ${quoted(
    building.type || ""
  )}, "etages": ${integerOrNull(building.etages)}, "surface": ${integerOrNull(
    building.surface
  )}}`;
}

/* Une ligne JSON qui décrit une mesure, avec exactement les mêmes champs
      et le même ordre que le programme C (fonction exporterJSON). */
function measureJsonLine(m) {
  return `{"id": ${m.id}, "batiment": ${quoted(
    m.batiment
  )}, "ressource": ${quoted(m.ressource)}, "valeur": ${decimal(
    m.valeur
  )}, "date_heure": ${quoted(m.date_heure)}, "seuil": ${decimal(
    m.seuil
  )}, "alerte": ${m.alerte}}`;
}

/* Une ligne JSON avec les statistiques d'un groupe (bâtiment + ressource) :
      nombre de mesures, total, moyenne, min, max et nombre d'alertes. */
function statisticsJsonLine(s) {
  return `{"batiment": ${quoted(s.batiment)}, "ressource": ${quoted(
    s.ressource
  )}, "nb_mesures": ${s.nb_mesures}, "total": ${decimal(
    s.total
  )}, "moyenne": ${decimal(s.moyenne)}, "min": ${decimal(
    s.min
  )}, "max": ${decimal(s.max)}, "nb_alertes": ${s.nb_alertes}}`;
}

/* Un point de la courbe de tendance : date, valeur et moyenne mobile. */
function trendPointJson(point) {
  return `{"date_heure": ${quoted(point.date_heure)}, "valeur": ${decimal(
    point.valeur
  )}, "moyenne_mobile": ${decimalOrNull(point.moyenne_mobile)}}`;
}

/* Une ligne JSON avec la tendance d'un groupe (hausse, baisse ou stable)
      et tous ses points. */
function trendJsonLine(t) {
  const points = t.points.map(trendPointJson).join(", ");
  return `{"batiment": ${quoted(t.batiment)}, "ressource": ${quoted(
    t.ressource
  )}, "fenetre": ${t.fenetre}, "nb_mesures": ${
    t.nb_mesures
  }, "tendance": ${quoted(t.tendance)}, "premiere_moyenne": ${decimalOrNull(
    t.premiere_moyenne
  )}, "derniere_moyenne": ${decimalOrNull(
    t.derniere_moyenne
  )}, "points": [${points}]}`;
}

/* Construit tout le texte du fichier data.json, ligne par ligne :
      résumé, bâtiments, mesures, statistiques, puis tendances.
      Les « ... » devant jsonArrayLines insèrent toutes les lignes renvoyées
      dans le grand tableau « lines ». À la fin, join("\n") colle les lignes
      en un seul texte, avec un retour à la ligne entre chacune. */
function buildJsonText(measures) {
  const groups = groupByBuildingAndResource(measures);
  const alertCount = measures.filter((measure) => measure.alerte).length;
  const lines = [
    "{",
    '  "resume": {',
    `    "nb_mesures": ${measures.length},`,
    `    "nb_alertes": ${alertCount},`,
    `    "nb_groupes": ${groups.length}`,
    "  },",
    ...jsonArrayLines("batiments", state.batiments.map(buildingJsonLine)),
    ...jsonArrayLines("mesures", measures.map(measureJsonLine)),
    ...jsonArrayLines(
      "statistiques",
      groups.map(computeStatistics).map(statisticsJsonLine)
    ),
    ...jsonArrayLines(
      "tendances",
      groups.map(computeTrend).map(trendJsonLine),
      true
    ),
    "}",
  ];
  return lines.join("\n") + "\n";
}

/* Construit le texte du fichier data.csv : la ligne des noms de colonnes,
      puis une ligne par mesure, champs séparés par des virgules (même format que le C). */
function buildCsvText(measures) {
  const header = "id,batiment,ressource,valeur,date_heure,seuil\n";
  const rows = measures.map(
    (m) =>
      `${m.id},${m.batiment},${m.ressource},${decimal(m.valeur)},${
        m.date_heure
      },${decimal(m.seuil)}`
  );
  return header + rows.join("\n") + (measures.length ? "\n" : "");
}

/* Construit data.json et data.csv dans le MÊME format que le module C
      (fonctions exporterJSON et sauvegarderMesures) */
function buildFiles() {
  const measures = state.mesures.map(toModuleCMeasure);
  return { json: buildJsonText(measures), csv: buildCsvText(measures) };
}

/* --- Écriture et téléchargement --- */

/* Écrit un texte dans un fichier du dossier connecté.
      { create: true } : le fichier est créé s'il n'existe pas encore.
      Il faut fermer (close) pour que le contenu soit vraiment enregistré. */
async function writeFile(folder, fileName, text) {
  const file = await folder.getFileHandle(fileName, { create: true });
  const writer = await file.createWritable();
  await writer.write(text);
  await writer.close();
}

/* Écrit data.csv et data.json dans le dossier « data » connecté. */
async function writeFilesToFolder(folder) {
  const { json, csv } = buildFiles();
  await writeFile(folder, "data.csv", csv);
  await writeFile(folder, "data.json", json);
}

/* Fait télécharger un texte sous forme de fichier */
function downloadText(text, fileName, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/* Demande à l'utilisateur de choisir (ou de réautoriser) le dossier « data ».
      Le navigateur exige que cette fonction soit appelée juste après un clic. */
async function connectDataFolder() {
  try {
    let folder = dataFolder;
    if (folder && folderStatus === "prompt") {
      const permission = await folder.requestPermission({ mode: "readwrite" });
      if (permission !== "granted") return false;
    } else {
      folder = await window.showDirectoryPicker({ mode: "readwrite" });
      if (folder.name !== "data") {
        /* l'utilisateur a choisi la racine du projet : on descend dans « data » */
        try {
          folder = await folder.getDirectoryHandle("data");
        } catch {
          showToast("Choisissez le dossier « data » de votre projet.", "alert");
          return false;
        }
      }
      await databaseSet("dir", folder);
    }
    dataFolder = folder;
    folderStatus = "ok";
    isFolderConnected = true;
    /* Les fichiers font désormais foi : les copies du navigateur ne servent plus */
    [MEASURES_KEY, ADDED_BUILDINGS_KEY, DELETED_BUILDINGS_KEY].forEach((key) =>
      localStorage.removeItem(key)
    );
    return true;
  } catch {
    return false;
  }
}

/* La fenêtre de choix du dossier ne s'ouvre qu'UNE SEULE FOIS par session
      d'onglet (jamais à chaque ajout). Ensuite : bouton « Connecter le dossier
      data » sur la page Données. */
async function askForFolderOnce() {
  let alreadyAsked = false;
  try {
    alreadyAsked = !!sessionStorage.getItem(FOLDER_ASKED_KEY);
    sessionStorage.setItem(FOLDER_ASKED_KEY, "1");
  } catch {}
  if (alreadyAsked) return;
  showToast("Sélectionnez le dossier « data » (une seule fois).");
  await connectDataFolder();
}

/* Enregistre l'état actuel. Renvoie false si l'écriture a échoué. */
async function saveData() {
  const canAskForFolder = folderStatus === "none" || folderStatus === "prompt";
  if (!isFolderConnected && canAskForFolder) await askForFolderOnce();

  if (isFolderConnected) {
    try {
      await writeFilesToFolder(dataFolder);
      return true;
    } catch (error) {
      showToast("Échec de l'écriture dans data/ : " + error.message, "alert");
      return false;
    }
  }

  /* Pas de dossier : on garde une copie dans le navigateur */
  try {
    localStorage.setItem(
      MEASURES_KEY,
      JSON.stringify({ v: state.generated, m: state.mesures })
    );
  } catch {}
  return true;
}

/* =====================================================================
      PARTIE 8 — Chargement et vérification des données
      ===================================================================== */

/* Charge le fichier data.json et le traduit pour le site.
   
      fetch demande le fichier au serveur ; { cache: "no-store" } oblige à relire
      la dernière version au lieu d'une ancienne copie gardée par le navigateur.
      En cas de problème (fichier absent, JSON abîmé...), on affiche un message
      d'erreur et on renvoie null : la page sait alors qu'il n'y a pas de données. */
async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`fichier introuvable (HTTP ${response.status})`);
    }
    const data = await response.json();
    if (!Array.isArray(data.mesures)) {
      throw new Error("champ « mesures » absent ou invalide");
    }
    return convertFromModuleC(data);
  } catch (error) {
    const hint =
      location.protocol === "file:"
        ? " Ouvrez le site via un serveur local (Live Server)."
        : "";
    showError(`Impossible de charger data.json : ${error.message}.${hint}`);
    return null;
  }
}

/* Mise à jour en temps réel : relit data.json toutes les quelques secondes
      (changements faits par le programme C ou un autre onglet) et écoute le
      localStorage (changements faits dans un autre onglet sans dossier connecté).
      « isBusy() » permet de ne rien changer pendant qu'une modification est en cours.
      « onChange(nouveauxIds) » est appelée seulement si les mesures ont changé. */
const LIVE_INTERVAL_MS = 3000;

/* Lance la mise à jour automatique (voir l'explication juste au-dessus).
      lastText garde le dernier contenu lu : si le fichier n'a pas changé,
      on ne fait rien. */
function startLiveUpdates(onChange, isBusy) {
  let lastText = null;
  let lastData = null;

  /* Recharge les données et appelle onChange seulement si les mesures ont
        vraiment changé. On compare la « signature » avant / après, et on donne à
        onChange la liste des identifiants nouveaux (pour les mettre en évidence). */
  function refreshFrom(data) {
    const before = computeSignature(state.mesures);
    const oldIds = new Set(state.mesures.map((measure) => measure.id));
    prepareState(data);
    if (computeSignature(state.mesures) === before) return;
    const newIds = state.mesures
      .map((measure) => measure.id)
      .filter((id) => !oldIds.has(id));
    onChange(newIds);
  }

  /* Relit data.json. On ne fait rien si l'onglet est caché (document.hidden),
        si une modification est en cours, ou si le texte n'a pas changé.
        La toute première lecture sert seulement de point de départ. */
  async function checkFile() {
    if (document.hidden || isBusy()) return;
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) return;
      const text = await response.text();
      if (text === lastText) return;
      const isFirstRead = lastText === null;
      lastText = text;
      const data = JSON.parse(text);
      if (!Array.isArray(data.mesures)) return;
      lastData = convertFromModuleC(data);
      if (!isFirstRead && !isBusy()) refreshFrom(lastData);
    } catch {
      /* fichier en cours d'écriture ou serveur coupé : on réessaiera */
    }
  }

  window.addEventListener("storage", (event) => {
    const watchedKeys = [
      MEASURES_KEY,
      ADDED_BUILDINGS_KEY,
      DELETED_BUILDINGS_KEY,
    ];
    if (!lastData || isBusy() || !watchedKeys.includes(event.key)) return;
    refreshFrom(lastData);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkFile();
  });

  checkFile();
  setInterval(checkFile, LIVE_INTERVAL_MS);
}

/* Une mesure valide : ressource connue, bâtiment renseigné, valeur positive,
      date correcte et identifiant jamais vu */
function isValidMeasure(measure, seenIds) {
  return (
    measure &&
    RESOURCES[measure.ressource] &&
    typeof measure.batiment === "string" &&
    measure.batiment &&
    Number.isFinite(measure.valeur) &&
    measure.valeur >= 0 &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(measure.date || "") &&
    !seenIds.has(measure.id)
  );
}

/* Garde seulement les mesures valides (voir isValidMeasure) et complète
      chacune avec son unité (kWh, m³...) et son état d'alerte.
      seenIds retient les identifiants déjà vus, pour écarter les doublons. */
function keepValidMeasures(measures) {
  const seenIds = new Set();
  const validMeasures = measures.filter((measure) => {
    const isValid = isValidMeasure(measure, seenIds);
    if (isValid) seenIds.add(measure.id);
    return isValid;
  });
  return validMeasures.map((measure) => ({
    ...measure,
    unite: RESOURCES[measure.ressource].unit,
    alerte: Number.isFinite(measure.seuil)
      ? measure.valeur > measure.seuil
      : !!measure.alerte,
  }));
}

/* Ajoute les bâtiments créés dans le navigateur à ceux du fichier */
function addBuildingsFromBrowser(buildings) {
  const newBuildings = readStoredList(ADDED_BUILDINGS_KEY).filter(
    (added) => !buildings.some((building) => building.nom === added.nom)
  );
  return [...buildings, ...newBuildings];
}

/* Reprend les mesures gardées dans le navigateur, si elles concernent bien
      la même version de data.json */
function restoreMeasuresFromBrowser() {
  try {
    const saved = JSON.parse(localStorage.getItem(MEASURES_KEY) || "null");
    if (saved && saved.v === state.generated && Array.isArray(saved.m)) {
      state.mesures = saved.m;
    }
  } catch {}
}

/* Remplit « state » à partir du fichier, en écartant les mesures invalides */
function prepareState(data) {
  state.batiments = data.batiments || [];
  if (!isFolderConnected)
    state.batiments = addBuildingsFromBrowser(state.batiments);
  state.precedent = data.precedent || {};
  state.generated = data.genere_le || "";
  state.mesures = keepValidMeasures(data.mesures);
  const rejectedCount = data.mesures.length - state.mesures.length;

  if (!isFolderConnected) restoreMeasuresFromBrowser();

  const deletedNames = isFolderConnected
    ? []
    : readStoredList(DELETED_BUILDINGS_KEY);
  state.batiments = state.batiments.filter(
    (building) => !deletedNames.includes(building.nom)
  );
  state.mesures = state.mesures.filter(
    (measure) => !deletedNames.includes(measure.batiment)
  );

  /* bâtiments présents dans les mesures mais absents de la liste */
  state.mesures.forEach((measure) => {
    const isKnown = state.batiments.some(
      (building) => building.nom === measure.batiment
    );
    if (!isKnown) {
      state.batiments.push({
        nom: measure.batiment,
        type: BUILDING_TYPES[measure.batiment] || "",
      });
    }
  });

  if (rejectedCount) {
    showToast(
      `${rejectedCount} mesure(s) invalide(s) ignorée(s) dans data.json.`,
      "alert"
    );
  }
}

/* =====================================================================
      PARTIE 9 — Tendances et KPI
      ===================================================================== */

/* Total de la période précédente, pour certains bâtiments (ou tous par défaut) */
function previousTotal(resource, buildingNames) {
  const names = buildingNames || Object.keys(state.precedent);
  return names.reduce(
    (total, name) => total + (state.precedent[name]?.[resource] || 0),
    0
  );
}

/* Affiche la variation par rapport à la période précédente : « ↘ 12% » */
function showTrend(element, currentValue, previousValue, isShort) {
  if (!element) return;
  if (!previousValue) {
    element.className = "muted";
    element.textContent = "Pas de période de référence";
    return;
  }
  const percent = ((currentValue - previousValue) / previousValue) * 100;
  const isDown = percent <= 0; // consommer moins est une bonne nouvelle
  element.className = isDown ? "positive" : "negative";
  element.innerHTML =
    `${isDown ? "↘" : "↗"} ${Math.abs(percent).toFixed(0)}%` +
    (isShort ? "" : " <span>vs. période précédente</span>");
}

/* Remplit une carte KPI. buildingNames (facultatif) limite le calcul à ces bâtiments. */
function fillKpiCard(selector, resource, buildingNames) {
  const card = findOne(selector);
  if (!card) return;
  const measures = filterByResource(state.mesures, resource).filter(
    (measure) => !buildingNames || buildingNames.includes(measure.batiment)
  );
  const total = sumValues(measures);
  const unit = RESOURCES[resource].unit;
  findOne("strong", card).innerHTML = `${formatNumber(
    total
  )} <small>${unit}</small>`;
  showTrend(findOne("p", card), total, previousTotal(resource, buildingNames));
}

/* =====================================================================
      PARTIE 10 — Graphiques (Chart.js est chargé seulement si besoin)
      ===================================================================== */

const chartsById = {};
const chartDrawFunctions = []; // pour tout redessiner quand le thème change
let chartJsLoading = null;

/* Redessine tous les graphiques, par exemple après un changement de thème
      (clair / sombre), pour qu'ils reprennent les bonnes couleurs. */
function redrawAllCharts() {
  chartDrawFunctions.forEach((draw) => draw());
}

/* Charge la bibliothèque Chart.js. Renvoie une promesse : true si elle a réussi. */
function loadChartJs() {
  if (window.Chart) return Promise.resolve(true);
  /* « ||= » : on ne crée la promesse que la première fois, les appels suivants
        réutilisent la même (la bibliothèque n'est donc téléchargée qu'une fois) */
  chartJsLoading ||= loadScript("https://cdn.jsdelivr.net/npm/chart.js@4.4.1");
  return chartJsLoading;
}

/* Ajoute une balise <script src="..."> à la page.
      Renvoie une promesse : true quand le fichier est chargé, false en cas d'échec. */
function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.append(script);
  });
}

/* Remplace l'image de démonstration du HTML par un vrai <canvas> */
function replaceWithCanvas(selector, canvasId) {
  const placeholder = findOne(selector);
  if (placeholder) {
    placeholder.outerHTML = `<div class="chart-box"><canvas id="${canvasId}"></canvas></div>`;
  }
}

/* Crée un graphique. buildConfig est une fonction : elle est rappelée à chaque
      dessin pour relire les couleurs du thème actuel. */
function createChart(canvasId, buildConfig) {
  /* Dessine (ou redessine) le graphique dans le <canvas>. Si un ancien graphique
        existe déjà, on le détruit d'abord pour ne pas en empiler deux. */
  function draw() {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (!window.Chart) {
      canvas.parentElement.textContent =
        "Graphique indisponible (Chart.js non chargé : vérifiez la connexion).";
      return;
    }
    chartsById[canvasId]?.destroy();
    Chart.defaults.font.family = "Inter, Arial, sans-serif";
    Chart.defaults.color = getCssVariable("--soft") || "#5d777c";
    chartsById[canvasId] = new Chart(canvas, buildConfig());
  }
  draw();
  chartDrawFunctions.push(draw);
}

/* Courbes : une ligne par ressource, un point par jour.
      L'eau a son propre axe à droite car elle se mesure en m³ et non en kWh. */
function lineChartConfig(measures) {
  const days = [
    ...new Set(measures.map((measure) => measure.date.slice(0, 10))),
  ].sort();

  const datasets = RESOURCE_NAMES.map((resource) => {
    const resourceMeasures = filterByResource(measures, resource);
    const color = getCssVariable(RESOURCES[resource].cssColor);
    return {
      label: resource,
      data: days.map((day) =>
        sumValues(resourceMeasures.filter((m) => m.date.startsWith(day)))
      ),
      borderColor: color,
      backgroundColor: color,
      tension: 0.35,
      pointRadius: 3,
      yAxisID: resource === "Eau" ? "y1" : "y",
    };
  });

  return {
    type: "line",
    data: {
      labels: days.map((day) => `${day.slice(8)}/${day.slice(5, 7)}`),
      datasets,
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        y: {
          title: { display: true, text: "kWh" },
          grid: { color: getCssVariable("--line") },
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

/* Barres : pour chaque ressource, 100 % correspond au bâtiment qui consomme le plus */
function barChartConfig(buildingNames) {
  const datasets = RESOURCE_NAMES.map((resource) => {
    const totals = buildingNames.map((name) =>
      sumValues(filterByResource(measuresOfBuilding(name), resource))
    );
    const highest = Math.max(...totals) || 1;
    return {
      label: resource,
      raw: totals, // vraies valeurs, affichées dans l'infobulle
      data: totals.map((total) => (total / highest) * 100),
      backgroundColor: getCssVariable(RESOURCES[resource].cssColor),
      borderRadius: 4,
    };
  });

  /* Texte de la bulle qui apparaît au survol d'une barre,
        ex : « Eau : 540 m³ » (la vraie valeur, pas le pourcentage). */
  function tooltipLabel(context) {
    const resource = context.dataset.label;
    const value = context.dataset.raw[context.dataIndex];
    return `${resource} : ${formatNumber(value)} ${RESOURCES[resource].unit}`;
  }

  return {
    type: "bar",
    data: { labels: buildingNames, datasets },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: tooltipLabel } },
      },
      scales: {
        y: {
          max: 100,
          ticks: { callback: (value) => value + "%" },
          grid: { color: getCssVariable("--line") },
        },
      },
    },
  };
}

/* Colore un anneau (donut) et écrit les pourcentages dans sa légende.
      values contient une valeur par ressource, dans l'ordre de RESOURCES. */
function fillDonut(donut, values) {
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const colors = Object.values(RESOURCES);

  let position = 0;
  const slices = values.map((value, index) => {
    const start = position;
    position += (value / total) * 100;
    return `var(${colors[index].cssColor}) ${start}% ${position}%`;
  });
  donut.style.background = `conic-gradient(${slices.join(",")})`;

  const legend = findAll(".legend-list b", donut.closest(".donut-area"));
  values.forEach((value, index) => {
    legend[index].textContent = Math.round((value / total) * 100) + "%";
  });
}

/* =====================================================================
      PARTIE 11 — Sélecteur de période
      Les dates sont calculées à partir d'AUJOURD'HUI : toujours à jour.
      ===================================================================== */

const PERIOD_NAMES = {
  all: "Toutes les périodes",
  today: "Aujourd'hui",
  7: "7 derniers jours",
  30: "30 derniers jours",
  month: "Ce mois",
  lastmonth: "Mois dernier",
};

/* Date au format « 2026-10-09 », à l'heure locale (toISOString utilise l'heure UTC) */
function toIsoDate(date) {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

/* Ajoute (ou enlève, si days est négatif) des jours à une date « AAAA-MM-JJ ».
      On se place à midi pour éviter les erreurs lors des changements d'heure. */
function addDays(isoDate, days) {
  const date = new Date(isoDate + "T12:00:00");
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/* Renvoie [date de début, date de fin] d'une période prédéfinie */
function getPresetDates(preset) {
  const now = new Date();
  const today = toIsoDate(now);
  const year = now.getFullYear();
  const month = now.getMonth();

  if (preset === "today") return [today, today];
  if (preset === "7") return [addDays(today, -6), today];
  if (preset === "30") return [addDays(today, -29), today];
  if (preset === "month") {
    const firstDay = today.slice(0, 8) + "01";
    const lastDay = toIsoDate(new Date(year, month + 1, 0)); // jour 0 = dernier jour du mois d'avant
    return [firstDay, lastDay];
  }
  if (preset === "lastmonth") {
    return [
      toIsoDate(new Date(year, month - 1, 1)),
      toIsoDate(new Date(year, month, 0)),
    ];
  }
  return ["", ""];
}

/* Code HTML du sélecteur de période : le bouton, puis la fenêtre qui
      s'ouvre avec les périodes toutes prêtes et les deux champs de date. */
function periodPickerHtml() {
  const chips = Object.entries(PERIOD_NAMES)
    .map(
      ([key, name]) => `<button type="button" data-p="${key}">${name}</button>`
    )
    .join("");
  return `<div class="period">
     <button type="button" class="period-pill" id="pBtn" aria-haspopup="true" aria-expanded="false">
       <span>📅</span><span id="pLabel">Toutes les périodes</span><span class="p-caret">▾</span>
     </button>
     <div class="period-pop" id="pPop" hidden>
       <div class="period-chips">${chips}</div>
       <div class="period-dates">
         <label>Du<input type="date" id="pFrom" /></label>
         <label>Au<input type="date" id="pTo" /></label>
       </div>
       <div class="period-foot"><span id="pToday"></span><b id="pCount"></b></div>
     </div></div>`;
}

/* Place le sélecteur à côté du titre de la page (à gauche du bouton Exporter s'il existe) */
function addPeriodPicker() {
  let actions = findOne(".title-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "title-actions";
    const exportButton = findOne("#exportBtn");
    if (exportButton) {
      exportButton.replaceWith(actions);
      actions.append(exportButton);
    } else {
      findOne(".page-title").append(actions);
    }
  }
  actions.insertAdjacentHTML("afterbegin", periodPickerHtml());
}

/* Rend le sélecteur fonctionnel.
      isLive = true  : filtre sans recharger, en appelant onChange.
      isLive = false : la période est gardée dans l'adresse (?p= / ?from= / ?to=)
                       et la page se recharge.
      Renvoie un objet avec deux fonctions : isInPeriod(mesure) et showCount(nombre). */
function setupPeriodPicker(isLive, onChange) {
  const button = findOne("#pBtn");
  const popup = findOne("#pPop");
  const fromInput = findOne("#pFrom");
  const toInput = findOne("#pTo");
  const chips = findAll(".period-chips button", popup);
  let preset = "all"; // une clé de PERIOD_NAMES, ou « custom » pour des dates choisies

  /* Mode avec rechargement : on relit la période dans l'adresse */
  if (!isLive) {
    const hasCustomDates = getUrlParam("from") || getUrlParam("to");
    preset = getUrlParam("p") || (hasCustomDates ? "custom" : "all");
    if (preset === "custom") {
      fromInput.value = getUrlParam("from") || "";
      toInput.value = getUrlParam("to") || "";
    } else {
      [fromInput.value, toInput.value] = getPresetDates(preset);
    }
  }

  /* Dates choisies, remises dans l'ordre si elles sont inversées */
  function getDates() {
    const [from, to] = [fromInput.value, toInput.value];
    if (from && to && from > to) return [to, from];
    return [from, to];
  }

  /* Date courte « 09/10/2026 » à partir de « 2026-10-09 ». */
  function shortDate(isoDate) {
    return formatDate(isoDate + "T00:00").slice(0, 10);
  }

  /* Texte affiché sur le bouton : le nom de la période
        (ex : « Ce mois-ci »), ou les dates choisies à la main. */
  function getLabel() {
    if (preset !== "custom") return PERIOD_NAMES[preset];
    const [from, to] = getDates();
    if (from && to) return `${shortDate(from)} → ${shortDate(to)}`;
    if (from) return `Depuis le ${shortDate(from)}`;
    if (to) return `Jusqu'au ${shortDate(to)}`;
    return PERIOD_NAMES.all;
  }

  /* Met à jour le bouton et le bouton de période actif */
  function updateDisplay() {
    const [from, to] = getDates();
    const hasDates = !!(from || to);
    const isFiltering = preset !== "all" && (preset !== "custom" || hasDates);
    findOne("#pLabel").textContent = getLabel();
    button.classList.toggle("on", isFiltering);
    chips.forEach((chip) =>
      chip.classList.toggle("active", chip.dataset.p === preset)
    );
  }

  /* Ferme la fenêtre du sélecteur de période. */
  function closePopup() {
    popup.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  /* Recharge la page avec la nouvelle période dans l'adresse */
  function reloadWithPeriod() {
    const params = new URLSearchParams(location.search);
    ["p", "from", "to"].forEach((name) => params.delete(name));
    if (preset === "custom") {
      if (fromInput.value) params.set("from", fromInput.value);
      if (toInput.value) params.set("to", toInput.value);
    } else if (preset !== "all") {
      params.set("p", preset);
    }
    location.search = params.toString();
  }

  /* Applique la période choisie : soit on filtre tout de suite (isLive),
        soit on recharge la page avec la période dans l'adresse. */
  function applyPeriod() {
    updateDisplay();
    if (isLive) onChange();
    else reloadWithPeriod();
  }

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    popup.hidden = !popup.hidden;
    button.setAttribute("aria-expanded", String(!popup.hidden));
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".period")) closePopup();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePopup();
  });
  chips.forEach((chip) =>
    chip.addEventListener("click", () => {
      preset = chip.dataset.p;
      [fromInput.value, toInput.value] = getPresetDates(preset);
      closePopup();
      applyPeriod();
    })
  );
  [fromInput, toInput].forEach((input) =>
    input.addEventListener("change", () => {
      preset = "custom";
      applyPeriod();
    })
  );

  /* Exécuté chaque minute : si le jour change, la période suit */
  function updateToday() {
    findOne("#pToday").textContent =
      "Aujourd'hui : " +
      new Date().toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    if (isLive && !["all", "custom"].includes(preset)) {
      const [from, to] = getPresetDates(preset);
      if (from !== fromInput.value || to !== toInput.value) {
        fromInput.value = from;
        toInput.value = to;
        updateDisplay();
        onChange();
      }
    }
  }

  updateDisplay();
  updateToday();
  setInterval(updateToday, 60000);

  return {
    /* true si la mesure est dans la période choisie.
          On compare seulement le jour (les 10 premiers caractères de la date). */
    isInPeriod(measure) {
      const [from, to] = getDates();
      const day = measure.date.slice(0, 10);
      return (!from || day >= from) && (!to || day <= to);
    },

    /* Affiche le nombre de mesures de la période, ex : « 12 mesures ». */
    showCount(count) {
      findOne("#pCount").textContent = `${count} ${plural(count, "mesure")}`;
    },
  };
}

/* =====================================================================
      PARTIE 12 — Une fonction par page du site
      Le nom de chaque page vient de l'attribut data-page de <body>.
      ===================================================================== */

/* ---------- Page : Tableau de bord (index.html) ---------- */

/* Code HTML d'une alerte du tableau de bord : bâtiment, ressource, valeur,
      seuil et date. escapeHtml protège contre les noms qui contiendraient du HTML. */
function alertItemHtml(measure) {
  const title = `${escapeHtml(measure.batiment)} — ${escapeHtml(
    measure.ressource
  )} : ${formatNumber(measure.valeur)} ${measure.unite}${thresholdText(
    measure
  )}`;
  return `<div class="alert-item"><span class="alert-symbol">!</span><div><b>${title}</b><small>${formatDate(
    measure.date
  )}</small></div></div>`;
}

/* Liste des mesures en alerte, de la plus récente à la plus ancienne.
      localeCompare compare deux textes ; b avant a = ordre inverse (plus récent d'abord). */
function getAlertsNewestFirst(measures) {
  return measures
    .filter((measure) => measure.alerte)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* Page Tableau de bord : remplit les 3 cartes KPI (électricité, eau,
      chauffage), la carte des anomalies, la liste des 3 dernières alertes et
      la courbe de consommation. */
function showDashboardPage() {
  fillKpiCard(".metric.green", "Électricité");
  fillKpiCard(".metric.blue", "Eau");
  fillKpiCard(".metric.orange", "Chauffage");

  /* Carte « Anomalies » */
  const alerts = getAlertsNewestFirst(state.mesures);
  const alertCard = findOne(".metric.purple");
  const buildingCount = new Set(alerts.map((alert) => alert.batiment)).size;
  findOne("strong", alertCard).innerHTML = `${alerts.length} <small>${plural(
    alerts.length,
    "alerte"
  )}</small>`;
  findOne(
    "p",
    alertCard
  ).textContent = `${buildingCount} bâtiment(s) concerné(s)`;

  /* Liste des 3 dernières alertes */
  findOne(".alert-count").textContent = alerts.length;
  findAll(".alerts .alert-item").forEach((item) => item.remove());
  const alertsHtml = alerts.length
    ? alerts.slice(0, 3).map(alertItemHtml).join("")
    : '<p class="muted">Aucune alerte : tout est sous les seuils.</p>';
  findOne(".alerts > .text-link").insertAdjacentHTML("beforebegin", alertsHtml);

  replaceWithCanvas(".line-chart", "chartLine");
  createChart("chartLine", () => lineChartConfig(state.mesures));
}

/* ---------- Page : Graphiques (graphique.html) ---------- */

/* Trouve le panneau (.panel) dont le titre h2 contient le texte demandé. */
function findPanelByTitle(titleText) {
  return findAll(".panel").find((panel) =>
    findOne("h2", panel)?.textContent.includes(titleText)
  );
}

/* Filtre « ?q=... » de l'adresse. Renvoie le texte cherché ("" s'il n'y en a pas). */
function applyChartsSearch() {
  const searchText = (getUrlParam("q") || "").trim();
  if (!searchText) return "";

  const query = normalizeText(searchText);
  state.mesures = state.mesures.filter(
    (measure) =>
      normalizeText(measure.batiment).includes(query) ||
      normalizeText(measure.ressource).includes(query)
  );
  findOne(".page-title").insertAdjacentHTML(
    "afterend",
    `<div class="notice">Filtre actif : <b>« ${escapeHtml(
      searchText
    )} »</b> — ${
      state.mesures.length
    } mesure(s). <a href="graphique.html" class="text-link">✕ Effacer le filtre</a></div>`
  );
  return searchText;
}

/* Les kWh et les m³ ne s'additionnent pas : l'anneau ne compte que les kWh,
      et le total de l'eau est écrit à part dans la légende. */
function fillResourceDonut(donut) {
  const totals = RESOURCE_NAMES.map((resource) =>
    sumValues(filterByResource(state.mesures, resource))
  );
  const kwhTotals = RESOURCE_NAMES.map((resource, index) =>
    RESOURCES[resource].unit === "kWh" ? totals[index] : 0
  );
  fillDonut(donut, kwhTotals);
  findOne("strong", donut).textContent = formatNumber(
    kwhTotals.reduce((sum, total) => sum + total, 0)
  );
  findOne("small", donut).textContent = "kWh";

  const waterIndex = RESOURCE_NAMES.findIndex(
    (resource) => RESOURCES[resource].unit === "m³"
  );
  const legend = findAll(".legend-list b", donut.closest(".donut-area"));
  legend[waterIndex].textContent = formatNumber(totals[waterIndex]) + " m³";

  const panel = findPanelByTitle("par ressource");
  if (panel) {
    findOne("p", panel).textContent =
      "Électricité et chauffage en kWh · eau en m³ à part";
  }
}

/* Anneau des alertes : combien d'alertes pour chaque ressource,
      et le total au centre. */
function fillAlertDonut(donut) {
  const alerts = state.mesures.filter((measure) => measure.alerte);
  fillDonut(
    donut,
    RESOURCE_NAMES.map((resource) => filterByResource(alerts, resource).length)
  );
  findOne("strong", donut).textContent = alerts.length;
}

/* Onglets : chaque vue affiche certains panneaux (numéros dans l'ordre du HTML) */
function setupChartViews() {
  const panels = findAll(".chart-grid > .panel");
  const views = {
    "Vue globale": [0, 1, 2, 3, 4, 5],
    "Par bâtiment": [2, 3],
    "Par ressource": [0, 1, 4],
    Comparaison: [1, 2, 3],
  };
  findAll(".chart-tabs .tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      const visiblePanels =
        views[tab.textContent.trim()] || views["Vue globale"];
      panels.forEach(
        (panel, index) => (panel.hidden = !visiblePanels.includes(index))
      );
    })
  );
}

/* Classement des 5 bâtiments qui consomment le plus de kWh (sans l'eau) */
function fillBuildingRanking(buildingNames) {
  const ranking = buildingNames
    .map((name) => ({
      name,
      total: sumValues(
        measuresOfBuilding(name).filter((m) => m.ressource !== "Eau")
      ),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const highest = ranking[0]?.total || 1;
  findOne(".rank-list").innerHTML = ranking
    .map(
      ({ name, total }) =>
        `<div><span>${escapeHtml(name)}</span><i><b style="width:${
          (total / highest) * 100
        }%"></b></i><strong>${formatNumber(total)}</strong></div>`
    )
    .join("");
}

/* Compare les kWh de la période à ceux de la période précédente */
function fillTrendPanel() {
  const current = sumValues(state.mesures.filter((m) => m.ressource !== "Eau"));
  const previous = previousTotal("Électricité") + previousTotal("Chauffage");
  const text = findOne(".trend-panel > p");
  const status = findOne(".trend-panel .status");

  if (!previous) {
    text.textContent =
      "Pas de période de référence disponible pour calculer une tendance.";
    status.className = "status normal";
    status.textContent = "Données insuffisantes";
    return;
  }
  const percent = ((current - previous) / previous) * 100;
  const isDown = percent <= 0;
  text.innerHTML = `La consommation est en ${
    isDown ? "baisse" : "hausse"
  } de <b>${Math.abs(percent).toFixed(
    0
  )}%</b> par rapport à la période précédente.`;
  status.className = "status " + (isDown ? "normal" : "warning");
  status.textContent = isDown
    ? "Objectif en bonne voie"
    : "Vigilance : consommation en hausse";
}

/* Page Graphiques : applique la période et la recherche, puis remplit les
      anneaux, les barres par bâtiment, la courbe, le classement et la tendance. */
function showChartsPage() {
  addPeriodPicker();
  const period = setupPeriodPicker(false);
  state.mesures = state.mesures.filter(period.isInPeriod);
  const searchText = applyChartsSearch();
  period.showCount(state.mesures.length);

  const [resourceDonut, alertDonut] = findAll(".donut");
  fillResourceDonut(resourceDonut);
  fillAlertDonut(alertDonut);

  /* Pendant une recherche, on ne garde que les bâtiments qui ont des mesures */
  const buildingNames = state.batiments
    .filter(
      (building) => !searchText || measuresOfBuilding(building.nom).length
    )
    .map((building) => building.nom);

  const buildingPanel = findPanelByTitle("par bâtiment");
  if (buildingPanel) {
    findOne("p", buildingPanel).textContent =
      "Niveau relatif au maximum de chaque ressource";
  }

  setupChartViews();
  replaceWithCanvas(".bar-chart", "chartBars");
  createChart("chartBars", () => barChartConfig(buildingNames));
  replaceWithCanvas(".line-chart", "chartLine");
  createChart("chartLine", () => lineChartConfig(state.mesures));
  fillBuildingRanking(buildingNames);
  fillTrendPanel();
}

/* ---------- Page : Bâtiments (batiment.html) ---------- */

/* Total d'électricité (kWh) consommé par un bâtiment. */
function electricityOfBuilding(name) {
  return sumValues(filterByResource(measuresOfBuilding(name), "Électricité"));
}

/* Code HTML de la carte d'un bâtiment (type, nom, lien « Détails »).
      Les chiffres sont mis à 0 ici, puis remplis par fillBuildingCard. */
function buildingCardHtml(building) {
  const type = escapeHtml((building.type || "").toUpperCase());
  const name = escapeHtml(building.nom);
  const link = `detail.html?b=${encodeURIComponent(building.nom)}`;
  return `<article class="building-card"><div class="building-photo photo-five"><span>${type}</span></div><div class="building-info"><h2>▦ ${name}</h2><div class="building-value">0 <small>kWh</small><span></span></div><div class="mini-progress"><i style="width:0%"></i></div><a href="${link}" class="text-link">Détails →</a></div></article>`;
}

/* Ajoute une carte pour chaque bâtiment créé par l'utilisateur */
function addUserBuildingCards() {
  const userBuildings = isFolderConnected
    ? state.batiments.filter((b) => !BUILDINGS_IN_HTML.includes(b.nom))
    : readStoredList(ADDED_BUILDINGS_KEY);
  userBuildings.forEach((building) =>
    findOne(".total-card").insertAdjacentHTML(
      "beforebegin",
      buildingCardHtml(building)
    )
  );
}

/* Remplit une carte avec les chiffres du bâtiment (ou la retire s'il a été supprimé) */
function fillBuildingCard(card, highestElectricity) {
  const titleWithoutIcon = findOne("h2", card).textContent.replace(
    /^\S+\s+/,
    ""
  );
  const title = titleWithoutIcon.trim();
  const name = BUILDING_FROM_C[title] || title; // le HTML écrit « Cours », le site « Cours »
  const building = state.batiments.find((candidate) => candidate.nom === name);
  if (!building) {
    card.remove();
    return;
  }
  card.dataset.type = building.type || "";
  card.dataset.name = name;
  if (!findOne(".del-bat", card)) {
    findOne(".building-info", card).insertAdjacentHTML(
      "beforeend",
      '<button type="button" class="del-bat btn btn-sm btn-outline-danger" title="Supprimer ce bâtiment">🗑 Supprimer</button>'
    );
  }
  const electricity = electricityOfBuilding(name);
  findOne(".building-value", card).innerHTML = `${formatNumber(
    electricity
  )} <small>kWh</small><span></span>`;
  showTrend(
    findOne(".building-value span", card),
    electricity,
    previousTotal("Électricité", [name]),
    true
  );
  findOne(".mini-progress i", card).style.width =
    (electricity / highestElectricity) * 100 + "%";
  findOne("a.text-link", card).href =
    "detail.html?b=" + encodeURIComponent(name);
}

/* Carte « Électricité totale » : la somme de tous les bâtiments et
      la variation par rapport à la période précédente. */
function fillTotalCard() {
  const total = sumValues(filterByResource(state.mesures, "Électricité"));
  findOne(".total-card h2").textContent = "Électricité totale";
  findOne(".total-card > strong").innerHTML = `${formatNumber(
    total
  )} <small>kWh</small>`;
  showTrend(findOne(".total-card p"), total, previousTotal("Électricité"));
}

/* Sans dossier connecté, les bâtiments supprimés sont notés dans le navigateur */
function rememberDeletedBuilding(name) {
  const deletedNames = readStoredList(DELETED_BUILDINGS_KEY);
  if (!deletedNames.includes(name)) deletedNames.push(name);
  localStorage.setItem(DELETED_BUILDINGS_KEY, JSON.stringify(deletedNames));

  const addedBuildings = readStoredList(ADDED_BUILDINGS_KEY).filter(
    (building) => building.nom !== name
  );
  localStorage.setItem(ADDED_BUILDINGS_KEY, JSON.stringify(addedBuildings));
}

/* Supprime un bâtiment et toutes ses mesures, après confirmation.
      On garde une copie (backup) des données avant : si l'enregistrement échoue,
      on remet tout comme avant pour ne rien perdre. */
async function deleteBuilding(name) {
  const measureCount = measuresOfBuilding(name).length;
  const confirmed = await openDialog({
    title: `Supprimer « ${name} » ?`,
    text: `Le bâtiment et ses ${measureCount} mesure(s) seront supprimés.`,
    ok: "Supprimer",
  });
  if (!confirmed) return;

  const measuresBackup = state.mesures;
  const buildingsBackup = state.batiments;
  state.mesures = state.mesures.filter((m) => m.batiment !== name);
  state.batiments = state.batiments.filter((b) => b.nom !== name);

  const saved = await saveData();
  if (!saved) {
    state.mesures = measuresBackup; // échec : on annule
    state.batiments = buildingsBackup;
    return;
  }
  if (!isFolderConnected) rememberDeletedBuilding(name);
  logActivity(
    "suppression",
    `Suppression du bâtiment « ${name} » et de ses ${measureCount} mesure(s)`
  );
  showToast(
    isFolderConnected
      ? "Bâtiment supprimé (data.json et data.csv mis à jour)."
      : "Bâtiment supprimé."
  );
  setTimeout(() => location.reload(), 600);
}

/* Recherche et filtre par type */
function setupBuildingFilters() {
  const searchInput = findOne("#buildingSearch");
  const typeSelect = findOne(".building-search select");
  const topSearch = findOne(".topbar .search input");
  findOne("#buildingGrid").insertAdjacentHTML(
    "afterend",
    '<p class="muted" id="noBat" hidden>Aucun bâtiment trouvé.</p>'
  );

  /* Cache les cartes qui ne correspondent pas à la recherche ou au type choisi,
        et affiche « Aucun bâtiment trouvé » s'il n'en reste aucune. */
  function applyFilters() {
    const query = normalizeText(searchInput.value || topSearch.value);
    const allTypes = typeSelect.value.startsWith("Tous");
    let visibleCount = 0;
    findAll(".building-card:not(.total-card)").forEach((card) => {
      const typeMatches = allTypes || card.dataset.type === typeSelect.value;
      const cardText = `${card.dataset.name} ${card.dataset.type}`;
      card.hidden = !(typeMatches && normalizeText(cardText).includes(query));
      if (!card.hidden) visibleCount++;
    });
    findOne("#noBat").hidden = visibleCount > 0;
  }

  searchInput.addEventListener("input", applyFilters);
  topSearch.addEventListener("input", applyFilters);
  const searchFromUrl = getUrlParam("q");
  if (searchFromUrl) {
    topSearch.value = searchFromUrl;
    applyFilters();
  }
  typeSelect.addEventListener("change", applyFilters);
}

/* Page Bâtiments : ajoute les bâtiments créés par l'utilisateur, remplit
      chaque carte (la barre de progression compare au bâtiment qui consomme
      le plus), la carte du total, puis active la recherche et les boutons Supprimer. */
function showBuildingsPage() {
  addUserBuildingCards();

  const allElectricity = state.batiments.map((b) =>
    electricityOfBuilding(b.nom)
  );
  const highestElectricity = Math.max(0, ...allElectricity) || 1;
  findAll(".building-card:not(.total-card)").forEach((card) =>
    fillBuildingCard(card, highestElectricity)
  );
  fillTotalCard();

  /* Un seul écouteur sur la grille pour tous les boutons « Supprimer » */
  findOne("#buildingGrid").addEventListener("click", (event) => {
    const button = event.target.closest(".del-bat");
    if (button) deleteBuilding(button.closest(".building-card").dataset.name);
  });

  setupBuildingFilters();
}

/* ---------- Page : Détail d'un bâtiment (detail.html?b=Nom) ---------- */

/* Page Détail : affiche les informations et les mesures d'UN bâtiment.
      Son nom est dans l'adresse : detail.html?b=Bibliothèque. */
function showDetailPage() {
  const name = getUrlParam("b") || "Bibliothèque";
  const building = state.batiments.find((candidate) => candidate.nom === name);
  if (!building) {
    showError(`Bâtiment « ${name} » introuvable.`);
    return;
  }

  findOne("h1").textContent = name;
  document.title = `EcoCampus — ${name}`;
  fillKpiCard(".metric.green", "Électricité", [name]);
  fillKpiCard(".metric.blue", "Eau", [name]);
  fillKpiCard(".metric.orange", "Chauffage", [name]);

  const measures = measuresOfBuilding(name);
  replaceWithCanvas(".line-chart", "chartLine");
  createChart("chartLine", () => lineChartConfig(measures));

  /* Fiche du bâtiment : surface, type, étages, état */
  const alerts = getAlertsNewestFirst(measures);
  const hasAlerts = alerts.length > 0;
  const [surface, type, floors, status] = findAll(".details-panel dd");
  surface.textContent = building.surface
    ? `${formatNumber(building.surface)} m²`
    : "—";
  type.textContent = building.type || "—";
  floors.textContent = building.etages ?? "—";
  status.innerHTML = `<span class="status ${
    hasAlerts ? "warning" : "normal"
  }">${hasAlerts ? "Alerte" : "Normal"}</span>`;

  let lastAlertHtml = "<b>Aucune alerte récente</b>";
  if (hasAlerts) {
    const lastAlert = alerts[0];
    lastAlertHtml = `<b>${escapeHtml(lastAlert.ressource)} : ${formatNumber(
      lastAlert.valeur
    )} ${lastAlert.unite}${thresholdText(lastAlert)}</b><small>${formatDate(
      lastAlert.date
    )}</small>`;
  }
  findOne(".recent-alert p").innerHTML = lastAlertHtml;
}

/* ---------- Page : Données (donnees.html) ---------- */

const ROWS_PER_PAGE = 10;

/* Code HTML d'une ligne du tableau des mesures : numéro, bâtiment, ressource,
      valeur, unité, date, état (Normal / Alerte) et les boutons Modifier / Supprimer.
      padStart(3, "0") écrit l'identifiant sur 3 chiffres : 7 devient 007. */
function measureRowHtml(measure) {
  const resource = RESOURCES[measure.ressource];
  const id = String(measure.id).padStart(3, "0");
  const statusClass = measure.alerte ? "warning" : "normal";
  const statusText = measure.alerte ? "Alerte" : "Normal";
  return `<tr class="${
    measure.alerte ? "row-alert" : ""
  }"><td>${id}</td><td>${escapeHtml(
    measure.batiment
  )}</td><td><span class="resource-label ${resource.cssClass}">${
    resource.icon
  } ${measure.ressource}</span></td><td>${formatNumber(
    measure.valeur
  )}</td><td>${measure.unite}</td><td>${formatDate(
    measure.date
  )}</td><td><span class="status ${statusClass}">${statusText}</span></td><td><button class="row-action" data-act="edit" data-id="${
    measure.id
  }" title="Modifier la valeur" aria-label="Modifier"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-.873a2 2 0 0 1 .506-.852z"/></svg></button> <button class="row-action delete-row" data-act="del" data-id="${
    measure.id
  }" title="Supprimer" aria-label="Supprimer"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button></td></tr>`;
}

/* Boutons de pagination : ‹ précédent, un bouton par page, › suivant.
      Le bouton de la page actuelle est mis en évidence, et « ‹ » est
      désactivé sur la première page (« › » sur la dernière). */
function paginationHtml(currentPage, pageCount) {
  let html = `<button data-p="${currentPage - 1}" ${
    currentPage === 1 ? "disabled" : ""
  }>‹</button>`;
  for (let page = 1; page <= pageCount; page++) {
    html += `<button data-p="${page}" class="${
      page === currentPage ? "selected" : ""
    }">${page}</button>`;
  }
  html += `<button data-p="${currentPage + 1}" ${
    currentPage === pageCount ? "disabled" : ""
  }>›</button>`;
  return html;
}

/* --- Export en PDF (bouton « Exporter en PDF ») ---
      On utilise deux bibliothèques, chargées seulement au premier clic :
      jsPDF dessine le document, jspdf-autotable y ajoute les tableaux.
      Le PDF contient les mesures AFFICHÉES : celles qui passent les filtres. */

const JSPDF_URL =
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
const AUTOTABLE_URL =
  "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js";
let pdfLibrariesLoading = null;

/* Couleurs du PDF en [rouge, vert, bleu] : les mêmes que style.css */
const PDF_COLORS = {
  brand: [11, 122, 95],
  ink: [18, 60, 67],
  muted: [117, 144, 151],
  line: [220, 239, 235],
  pale: [233, 248, 242],
  alert: [220, 38, 38],
  alertRow: [254, 242, 242],
  ok: [10, 127, 90],
  Électricité: [124, 58, 237],
  Eau: [2, 132, 199],
  Chauffage: [234, 88, 12],
};

/* Page A4 en millimètres : 210 de large, marges de 14 à gauche et à droite */
const PDF_MARGIN = 14;
const PDF_RIGHT = 210 - PDF_MARGIN;

/* Charge les bibliothèques qui fabriquent le PDF (jsPDF et son extension
      autoTable pour les tableaux). Elles ne sont chargées qu'au premier export. */
function loadPdfLibraries() {
  if (window.jspdf?.jsPDF?.API?.autoTable) return Promise.resolve(true);
  /* autotable doit être chargé APRÈS jsPDF, car il s'y ajoute */
  pdfLibrariesLoading ||= loadScript(JSPDF_URL)
    .then((ok) => ok && loadScript(AUTOTABLE_URL))
    .then((ok) => {
      if (!ok) pdfLibrariesLoading = null; // échec : on pourra réessayer
      return ok;
    });
  return pdfLibrariesLoading;
}

/* Les polices de base du PDF ne connaissent pas l'espace fine que le français
      met dans « 12 040 » : on la remplace par une espace normale */
function pdfText(text) {
  return String(text).replace(/[  ]/g, " ");
}

/* Les ressources qui ont au moins une mesure (ex. seulement « Eau » si on a filtré) */
function resourcesIn(measures) {
  return RESOURCE_NAMES.filter((resource) =>
    measures.some((measure) => measure.ressource === resource)
  );
}

/* Les en-têtes de colonnes suivent l'alignement de leur colonne (nombres à droite) */
function alignHeader(cell, columnStyles) {
  cell.cell.styles.halign = columnStyles[cell.column.index]?.halign || "left";
}

/* Bandeau vert en haut de la première page */
function drawPdfHeader(doc, userName, filterText) {
  doc.setFillColor(...PDF_COLORS.brand); // « ... » donne les 3 nombres séparément
  doc.rect(0, 0, 210, 32, "F"); // « F » = rectangle rempli

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(pdfText(settings.campus || "EcoCampus"), PDF_MARGIN, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Rapport des mesures de consommation", PDF_MARGIN, 23);

  const generatedOn = "Généré le " + formatDate(currentDateTime());
  doc.setFontSize(9);
  doc.text(pdfText(generatedOn), PDF_RIGHT, 15, { align: "right" });
  if (userName)
    doc.text(pdfText("par " + userName), PDF_RIGHT, 21, { align: "right" });
  if (settings.lieu)
    doc.text(pdfText(settings.lieu), PDF_RIGHT, 27, { align: "right" });

  doc.setTextColor(...PDF_COLORS.muted);
  doc.setFontSize(8.5);
  doc.text(pdfText("Filtres : " + filterText), PDF_MARGIN, 40);
}

/* Cartes de résumé : mesures, alertes, puis le total de chaque ressource présente.
      Renvoie la position (en mm) sous les cartes. */
function drawPdfSummary(doc, measures) {
  const alertCount = measures.filter((m) => m.alerte).length;
  const cards = [
    {
      label: "Mesures",
      value: formatNumber(measures.length),
      color: PDF_COLORS.brand,
    },
    {
      label: "Alertes",
      value: formatNumber(alertCount),
      color: alertCount ? PDF_COLORS.alert : PDF_COLORS.ok,
    },
    ...resourcesIn(measures).map((resource) => ({
      label: `${resource} (${RESOURCES[resource].unit})`,
      value: formatNumber(sumValues(filterByResource(measures, resource))),
      color: PDF_COLORS[resource],
    })),
  ];

  const top = 45;
  const gap = 4;
  const width =
    (PDF_RIGHT - PDF_MARGIN - gap * (cards.length - 1)) / cards.length;
  cards.forEach((card, index) => {
    const x = PDF_MARGIN + index * (width + gap);
    doc.setFillColor(...PDF_COLORS.pale);
    doc.roundedRect(x, top, width, 20, 2, 2, "F");
    doc.setFillColor(...card.color);
    doc.rect(x, top + 3, 1.2, 14, "F"); // petite barre de couleur à gauche

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(pdfText(card.label), x + 4, top + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...card.color);
    doc.text(pdfText(card.value), x + 4, top + 15.5);
  });
  return top + 20 + 10;
}

/* Titre de section. Renvoie la position où commencer le tableau. */
function drawPdfSectionTitle(doc, title, y) {
  if (y > 255) {
    doc.addPage(); // trop bas : on passe à la page suivante
    y = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text(pdfText(title), PDF_MARGIN, y);
  return y + 3;
}

/* Réglages communs aux deux tableaux */
function pdfTableStyle(startY) {
  return {
    startY,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN, top: 16, bottom: 18 },
    theme: "striped",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2.4,
      textColor: PDF_COLORS.ink,
    },
    headStyles: {
      fillColor: PDF_COLORS.brand,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [247, 251, 250] },
  };
}

/* Tableau 1 : une ligne par bâtiment, avec le total de chaque ressource */
function drawBuildingSummaryTable(doc, measures, startY) {
  const resources = resourcesIn(measures);
  const buildingNames = [...new Set(measures.map((m) => m.batiment))].sort();
  const rows = buildingNames.map((name) => {
    const buildingMeasures = measures.filter((m) => m.batiment === name);
    return [
      name,
      ...resources.map((resource) =>
        formatNumber(sumValues(filterByResource(buildingMeasures, resource)))
      ),
      buildingMeasures.length,
      buildingMeasures.filter((m) => m.alerte).length,
    ].map(pdfText);
  });

  const head = [
    "Bâtiment",
    ...resources.map((resource) => `${resource} (${RESOURCES[resource].unit})`),
    "Mesures",
    "Alertes",
  ];
  const alertColumn = head.length - 1;
  const columnStyles = { 0: { fontStyle: "bold" } };
  resources.forEach(
    (resource, index) => (columnStyles[index + 1] = { halign: "right" })
  );
  columnStyles[alertColumn - 1] = { halign: "center" };
  columnStyles[alertColumn] = { halign: "center" };

  doc.autoTable({
    ...pdfTableStyle(startY),
    head: [head],
    body: rows,
    columnStyles,
    /* Appelée pour chaque case avant de la dessiner : alertes en rouge */
    didParseCell(cell) {
      if (cell.section === "head") return alignHeader(cell, columnStyles);
      if (cell.column.index === alertColumn && cell.cell.raw !== "0") {
        cell.cell.styles.textColor = PDF_COLORS.alert;
        cell.cell.styles.fontStyle = "bold";
      }
    },
  });
}

/* Tableau 2 : toutes les mesures, lignes en alerte sur fond rouge pâle */
function drawMeasureTable(doc, measures, startY) {
  const rows = measures.map((m) =>
    [
      String(m.id).padStart(3, "0"),
      m.batiment,
      m.ressource,
      formatNumber(m.valeur),
      m.unite,
      formatDate(m.date),
      Number.isFinite(m.seuil) ? formatNumber(m.seuil) : "-",
      m.alerte ? "Alerte" : "Normal",
    ].map(pdfText)
  );

  const columnStyles = {
    0: { halign: "center", textColor: PDF_COLORS.muted },
    3: { halign: "right", fontStyle: "bold" },
    6: { halign: "right", textColor: PDF_COLORS.muted },
    7: { halign: "center", fontStyle: "bold" },
  };

  doc.autoTable({
    ...pdfTableStyle(startY),
    head: [
      [
        "N°",
        "Bâtiment",
        "Ressource",
        "Valeur",
        "Unité",
        "Date / heure",
        "Seuil",
        "Statut",
      ],
    ],
    body: rows,
    columnStyles,
    /* Appelée par autoTable pour chaque case du tableau PDF, juste avant de la
          dessiner : on colore les lignes en alerte, la ressource et le statut. */
    didParseCell(cell) {
      if (cell.section === "head") return alignHeader(cell, columnStyles);
      const measure = measures[cell.row.index];
      if (measure.alerte) cell.cell.styles.fillColor = PDF_COLORS.alertRow;
      if (cell.column.index === 2)
        cell.cell.styles.textColor = PDF_COLORS[measure.ressource];
      if (cell.column.index === 7) {
        cell.cell.styles.textColor = measure.alerte
          ? PDF_COLORS.alert
          : PDF_COLORS.ok;
      }
    },
  });
}

/* Bas de chaque page : nom du rapport et « Page 2 / 3 ».
      On le dessine à la fin, quand on connaît le nombre total de pages. */
function drawPdfFooters(doc) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(...PDF_COLORS.line);
    doc.line(PDF_MARGIN, 284, PDF_RIGHT, 284);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(
      pdfText(`${settings.campus || "EcoCampus"} · Rapport des mesures`),
      PDF_MARGIN,
      289
    );
    doc.text(`Page ${page} / ${pageCount}`, PDF_RIGHT, 289, { align: "right" });
  }
}

/* measures : les mesures à exporter. filterText : les filtres, écrits en clair. */
async function exportPdf(measures, filterText) {
  if (!measures.length) {
    showToast("Aucune mesure à exporter avec ces filtres.", "alert");
    return;
  }
  if (!(await loadPdfLibraries())) {
    showToast(
      "Impossible de charger la bibliothèque PDF (connexion ?) : export en CSV à la place.",
      "alert"
    );
    exportPreview(measures);
    return;
  }

  const user = await getCurrentUser();
  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  drawPdfHeader(doc, user ? displayName(user) : "", filterText);
  let y = drawPdfSummary(doc, measures);

  y = drawPdfSectionTitle(doc, "Synthèse par bâtiment", y);
  drawBuildingSummaryTable(doc, measures, y);

  /* doc.lastAutoTable.finalY = position du bas du tableau précédent */
  y = drawPdfSectionTitle(
    doc,
    `Détail des mesures (${measures.length})`,
    doc.lastAutoTable.finalY + 12
  );
  drawMeasureTable(doc, measures, y);

  drawPdfFooters(doc);
  const fileName = `ecocampus_mesures_${toIsoDate(new Date())}.pdf`;
  doc.save(fileName); // le navigateur télécharge le fichier
  logActivity("compte", `Export PDF de ${measures.length} mesure(s)`);
  showToast(`Export réussi : ${fileName} téléchargé.`);
}

/* Export CSV de secours (si le PDF est impossible) : un fichier INDÉPENDANT
      « apercu_data.csv », avec un résumé puis un bloc par bâtiment.
      Séparateur « ; » + BOM : s'ouvre en colonnes dans Excel. Le data.csv du
      dossier data, lui, est déjà mis à jour automatiquement à chaque changement. */
function exportPreview(siteMeasures = state.mesures) {
  if (!siteMeasures.length) {
    showToast("Aucune mesure à exporter.", "alert");
    return;
  }
  const measures = siteMeasures.map(toModuleCMeasure);

  /* true si la mesure dépasse son seuil. */
  const isOverThreshold = (m) => m.valeur > m.seuil;

  const measuresByBuilding = new Map();
  measures.forEach((measure) => {
    if (!measuresByBuilding.has(measure.batiment)) {
      measuresByBuilding.set(measure.batiment, []);
    }
    measuresByBuilding.get(measure.batiment).push(measure);
  });

  const lines = [
    "APERÇU DE DATA.CSV",
    "Exporté le;" + new Date().toLocaleString("fr-FR"),
    "",
    "RÉSUMÉ",
    "Mesures;" + measures.length,
    "Alertes;" + measures.filter(isOverThreshold).length,
    "Bâtiments;" + measuresByBuilding.size,
  ];
  measuresByBuilding.forEach((buildingMeasures, building) => {
    const count = buildingMeasures.length;
    lines.push(
      "",
      `BÂTIMENT : ${building} (${count} ${plural(count, "mesure")})`
    );
    lines.push("ID;Ressource;Valeur;Date/Heure;Seuil;Statut");
    buildingMeasures.forEach((m) => {
      const status = isOverThreshold(m) ? "Alerte" : "Normal";
      lines.push(
        [
          m.id,
          m.ressource,
          decimal(m.valeur),
          m.date_heure,
          decimal(m.seuil),
          status,
        ].join(";")
      );
    });
  });

  /* "\uFEFF" (BOM) est un caractère invisible qui dit à Excel : « ce fichier est en UTF-8 » */
  downloadText(
    "\uFEFF" + lines.join("\r\n") + "\r\n",
    "apercu_data.csv",
    "text/csv;charset=utf-8"
  );
  showToast("Export réussi : apercu_data.csv téléchargé.");
}

/* Une heure (en millisecondes, comme Date.now()) au format « 2026-10-09T14:00 »,
      à l'heure locale */
function timestampToIso(timestamp) {
  const date = new Date(timestamp);
  return new Date(date - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

/* Date et heure actuelles au format « 2026-10-09T14:00 » */
function currentDateTime() {
  return timestampToIso(Date.now());
}

/* Demande les informations d'une nouvelle mesure. Renvoie la mesure, ou null si on annule. */
async function askNewMeasure() {
  const answers = await openDialog({
    title: "Ajouter une mesure",
    ok: "Ajouter",
    fields: [
      {
        name: "bat",
        label: "Bâtiment",
        options: state.batiments.map((building) => building.nom),
      },
      { name: "res", label: "Ressource", options: RESOURCE_NAMES },
      { name: "valeur", label: "Valeur mesurée", type: "number", value: 500 },
    ],
  });
  if (!answers) return null;

  const { bat: batiment, res: ressource } = answers;
  const valeur = Number(answers.valeur);

  /* Seuil : celui d'une mesure semblable, sinon celui des réglages */
  const similarMeasure = state.mesures.find(
    (m) => m.batiment === batiment && m.ressource === ressource
  );
  const seuil = similarMeasure?.seuil ?? Number(settings["seuil_" + ressource]);

  return {
    id: Math.max(0, ...state.mesures.map((m) => m.id)) + 1,
    batiment,
    ressource,
    valeur,
    unite: RESOURCES[ressource].unit,
    seuil,
    date: currentDateTime(),
    alerte: valeur > seuil,
  };
}

/* Petit message après l'ajout d'une mesure : en rouge si c'est une anomalie,
      sinon un message de confirmation (selon les réglages de notifications). */
function notifyMeasureAdded(measure) {
  if (measure.alerte && settings.notif_alerte) {
    showToast(
      `Nouvelle anomalie : ${measure.batiment} — ${
        measure.ressource
      } ${formatNumber(measure.valeur)} ${measure.unite}${thresholdText(
        measure
      )}`,
      "alert"
    );
  } else if (settings.notif_ajout) {
    if (isFolderConnected) {
      showToast("Mesure ajoutée (data.json et data.csv mis à jour).");
    } else {
      showToast(
        "Mesure ajoutée dans le navigateur seulement : data.json n'a PAS été modifié (dossier data non connecté).",
        "alert"
      );
    }
  }
}

/* Supprime une mesure après confirmation. Renvoie false si l'utilisateur annule. */
async function confirmDeleteMeasure(measure) {
  const confirmed = await openDialog({
    title: "Supprimer la mesure ?",
    text: `Mesure n°${measure.id} — ${measure.batiment}, ${measure.ressource}.`,
    ok: "Supprimer",
  });
  if (!confirmed) return false;
  state.mesures = state.mesures.filter((m) => m !== measure);
  return true;
}

/* Modifie la valeur d'une mesure. Renvoie false si l'utilisateur annule. */
async function askEditMeasure(measure) {
  const answers = await openDialog({
    title: `Modifier la mesure n°${measure.id}`,
    ok: "Enregistrer",
    fields: [
      {
        name: "valeur",
        label: `Valeur (${measure.unite})`,
        type: "number",
        value: measure.valeur,
      },
    ],
  });
  if (!answers) return false;
  measure.valeur = Number(answers.valeur);
  measure.alerte =
    Number.isFinite(measure.seuil) && measure.valeur > measure.seuil;
  return true;
}

/* Badge « Dernière mesure : ... » : la date la plus récente.
      Les dates « AAAA-MM-JJ... » se trient comme du texte ; pop() prend la dernière. */
function showLastMeasureBadge() {
  const lastDate = state.mesures
    .map((measure) => measure.date)
    .sort()
    .pop();
  findOne(".small-badge").textContent = lastDate
    ? `Dernière mesure : ${formatDate(lastDate)}`
    : "Aucune mesure";
}

/* Explique où vont les changements, avec les boutons Connecter et Réinitialiser.
      Dossier connecté : le message déjà présent dans le HTML suffit. */
function setupFolderNotice() {
  if (isFolderConnected) return;

  const messages = {
    ok: " <b>Fichiers connectés :</b> data.json et data.csv sont mis à jour automatiquement.",
    prompt:
      ' <b>Dossier data déconnecté.</b> <a href="#" id="dirBtn" class="text-link">🔓 Réautoriser l\'écriture</a>',
    none: ' <b>Dossier data non connecté :</b> les changements restent dans ce navigateur. <a href="#" id="dirBtn" class="text-link">📁 Connecter le dossier data</a>',
    unsupported:
      " <b>Modifications gardées dans ce navigateur</b> (écriture directe dans data.json : Chrome ou Edge requis). Utilisez le bouton de téléchargement.",
  };
  findOne(".notice").insertAdjacentHTML(
    "beforeend",
    messages[folderStatus] +
      ' <a href="#" id="resetBtn" class="text-link">↺ Réinitialiser</a>'
  );

  findOne("#dirBtn")?.addEventListener("click", async (event) => {
    event.preventDefault();
    if (!(await connectDataFolder())) return;
    try {
      await writeFilesToFolder(dataFolder); // écrit l'état actuel (rien n'est perdu)
      showToast("Dossier connecté : data.json et data.csv mis à jour.");
      setTimeout(() => location.reload(), 800);
    } catch (error) {
      showToast("Connexion impossible : " + error.message, "alert");
    }
  });

  findOne("#resetBtn")?.addEventListener("click", async (event) => {
    event.preventDefault();
    const confirmed = await openDialog({
      title: "Réinitialiser les données ?",
      text: "Vos ajouts, modifications et suppressions seront annulés.",
      ok: "Réinitialiser",
    });
    if (confirmed) {
      localStorage.removeItem(MEASURES_KEY);
      location.reload();
    }
  });
}

/* Page Données : le tableau de toutes les mesures, avec filtres (bâtiment,
      ressource, texte, période), pagination, ajout, modification, suppression,
      export, et mise à jour en temps réel. */
function showDataPage() {
  /* Filtres actuels du tableau, et numéro de la page affichée */
  const filters = { building: "", resource: "", text: "", page: 1 };
  const topSearch = findOne(".topbar .search input");
  const textSearch = findOne("#textSearch");

  addPeriodPicker();
  const period = setupPeriodPicker(true, () => applyFilters());

  /* Vrai pendant un ajout / une modification / une suppression :
        le temps réel attend la fin pour ne pas écraser le changement */
  let isEditing = false;

  /* Liste des bâtiments du filtre (garde le choix actuel s'il existe encore) */
  function fillBuildingFilter() {
    const select = findOne("#buildingFilter");
    const selected = select.value;
    select.innerHTML =
      '<option value="">Tous les bâtiments</option>' +
      state.batiments
        .map((building) => `<option>${escapeHtml(building.nom)}</option>`)
        .join("");
    if (state.batiments.some((building) => building.nom === selected)) {
      select.value = selected;
    }
  }
  fillBuildingFilter();

  /* true si la mesure correspond à TOUS les filtres choisis.
        Un filtre vide ("") laisse tout passer. */
  function matchesFilters(measure) {
    const searchableText = `${measure.id} ${measure.batiment} ${measure.ressource} ${measure.valeur}`;
    return (
      (!filters.building || measure.batiment === filters.building) &&
      (!filters.resource || measure.ressource === filters.resource) &&
      period.isInPeriod(measure) &&
      (!filters.text || normalizeText(searchableText).includes(filters.text))
    );
  }

  /* Mesures à afficher, de la plus récente à la plus ancienne */
  function getFilteredMeasures() {
    return state.mesures
      .filter(matchesFilters)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }

  /* Redessine le tableau : filtre les mesures, calcule le nombre de pages,
        puis affiche seulement les 10 lignes de la page actuelle (slice). */
  function renderTable() {
    const measures = getFilteredMeasures();
    const pageCount = Math.max(1, Math.ceil(measures.length / ROWS_PER_PAGE));
    filters.page = Math.min(filters.page, pageCount);
    const start = (filters.page - 1) * ROWS_PER_PAGE;
    const visible = measures.slice(start, start + ROWS_PER_PAGE);
    const total = measures.length;

    findOne("#measureTable tbody").innerHTML = visible.length
      ? visible.map(measureRowHtml).join("")
      : '<tr><td colspan="8">Aucune mesure ne correspond aux filtres.</td></tr>';
    period.showCount(total);
    findOne("#tableCount").textContent = total
      ? `Affichage de ${start + 1} à ${
          start + visible.length
        } sur ${total} ${plural(total, "entrée")}`
      : "Aucune entrée";
    findOne(".pagination").innerHTML = paginationHtml(filters.page, pageCount);
  }

  /* Relit tous les filtres de la page, puis réaffiche le tableau */
  function applyFilters() {
    filters.building = findOne("#buildingFilter").value;
    filters.resource = findOne("#resourceFilter").value;
    filters.text = normalizeText((textSearch.value || topSearch.value).trim());
    filters.page = 1;
    findAll(".resource-tabs [data-resource]").forEach((tab) =>
      tab.classList.toggle("active", tab.dataset.resource === filters.resource)
    );
    renderTable();
  }

  ["#buildingFilter", "#resourceFilter"].forEach((selector) =>
    findOne(selector).addEventListener("change", applyFilters)
  );
  textSearch.addEventListener("input", applyFilters);
  topSearch.addEventListener("input", applyFilters);
  findOne("#searchBtn").addEventListener("click", () => {
    applyFilters();
    showToast(`${getFilteredMeasures().length} résultat(s) trouvé(s).`);
  });
  findAll(".resource-tabs [data-resource]").forEach((tab) =>
    tab.addEventListener("click", () => {
      findOne("#resourceFilter").value = tab.dataset.resource;
      applyFilters();
    })
  );
  findOne(".pagination").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-p]");
    if (!button || button.disabled) return;
    filters.page = Number(button.dataset.p);
    renderTable();
  });

  /* Boutons de chaque ligne : on met à jour l'écran PUIS data.json + data.csv ;
        si l'écriture échoue, on annule le changement. */
  findOne("#measureTable tbody").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-act]");
    if (!button) return;
    const measure = state.mesures.find(
      (m) => m.id === Number(button.dataset.id)
    );
    if (!measure) return;

    isEditing = true;
    try {
      const backup = state.mesures.map((m) => ({ ...m }));
      const isDelete = button.dataset.act === "del";
      const changed = isDelete
        ? await confirmDeleteMeasure(measure)
        : await askEditMeasure(measure);
      if (!changed) return;

      if (!(await saveData())) {
        state.mesures = backup;
      } else {
        const description = `mesure n°${measure.id} (${measure.batiment}, ${measure.ressource})`;
        if (isDelete)
          logActivity("suppression", "Suppression de la " + description);
        else logActivity("modif", "Modification de la " + description);
        if (isFolderConnected) showToast("data.json et data.csv mis à jour.");
      }
      renderTable();
    } finally {
      isEditing = false;
    }
  });

  /* Filtres actuels écrits en clair, pour l'en-tête du PDF */
  function describeFilters() {
    const parts = [
      filters.building || "Tous les bâtiments",
      filters.resource || "Toutes les ressources",
      findOne("#pLabel").textContent,
    ];
    const text = (textSearch.value || topSearch.value).trim();
    if (text) parts.push(`Recherche « ${text} »`);
    return parts.join(" · ");
  }

  const exportButton = findOne("#exportBtn");
  exportButton.addEventListener("click", async () => {
    const label = exportButton.textContent;
    exportButton.disabled = true; // évite un double clic pendant la préparation
    exportButton.textContent = "Préparation…";
    try {
      await exportPdf(getFilteredMeasures(), describeFilters());
    } catch (error) {
      showToast("Export PDF impossible : " + error.message, "alert");
    }
    exportButton.disabled = false;
    exportButton.textContent = label;
  });

  findOne("#addRowBtn").addEventListener("click", async () => {
    isEditing = true;
    try {
      const measure = await askNewMeasure();
      if (!measure) return;

      state.mesures.push(measure);
      if (!(await saveData())) {
        state.mesures = state.mesures.filter((m) => m !== measure); // annulé
        renderTable();
        return;
      }
      filters.page = 1;
      renderTable();
      notifyMeasureAdded(measure);
      logActivity(
        "ajout",
        `Ajout de la mesure n°${measure.id} (${measure.batiment}, ${
          measure.ressource
        } : ${formatNumber(measure.valeur)} ${measure.unite})`
      );
    } finally {
      isEditing = false;
    }
  });

  /* Temps réel : quand les mesures changent ailleurs, on réaffiche le tableau
        (même filtres, même page) et on fait clignoter les nouvelles lignes */
  startLiveUpdates(
    (newIds) => {
      fillBuildingFilter();
      renderTable();
      showLastMeasureBadge();
      newIds.forEach((id) =>
        findOne(`#measureTable [data-id="${id}"]`)
          ?.closest("tr")
          .classList.add("row-new")
      );
      showToast(
        newIds.length
          ? `${newIds.length} nouvelle(s) mesure(s) reçue(s).`
          : "Données mises à jour en direct."
      );
    },
    () => isEditing
  );

  showLastMeasureBadge();
  setupFolderNotice();

  const searchFromUrl = getUrlParam("q");
  if (searchFromUrl) topSearch.value = searchFromUrl;
  applyFilters();
}

/* ---------- Page : Paramètres (parametres.html) ---------- */

/* Page Paramètres : onglets, recherche dans les réglages et formulaire. */
function showSettingsPage() {
  findOne("[name=nb]").value = state.batiments.length;
  const searchInput = findOne(".topbar .search input");
  const tabs = findAll(".settings-tabs .tab");

  /* Affiche le panneau de réglages demandé et cache les autres. */
  function openPane(paneName) {
    findAll(".settings-pane").forEach(
      (pane) => (pane.hidden = pane.dataset.pane !== paneName)
    );
    tabs.forEach((tab) =>
      tab.classList.toggle("active", tab.dataset.pane === paneName)
    );
  }

  /* Surligne les réglages qui correspondent à la recherche et ouvre leur onglet.
        Renvoie le nombre de résultats. */
  function searchSettings() {
    findAll(".hit").forEach((element) => element.classList.remove("hit"));
    const query = normalizeText(searchInput.value.trim());
    if (!query) return 0;

    const matches = findAll(
      ".settings-card label, .settings-card h2, .setting-link"
    ).filter((element) => normalizeText(element.textContent).includes(query));
    matches.forEach((match) => match.classList.add("hit"));

    if (matches.length) {
      openPane(matches[0].closest(".settings-pane").dataset.pane);
      return matches.length;
    }
    /* Aucun réglage trouvé : on essaie le nom des onglets */
    const matchingTab = tabs.find((tab) =>
      normalizeText(tab.textContent).includes(query)
    );
    if (!matchingTab) return 0;
    openPane(matchingTab.dataset.pane);
    return 1;
  }

  searchInput.addEventListener("input", searchSettings);
  searchInput.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      searchInput.value.trim() &&
      !searchSettings()
    ) {
      showToast("Aucun paramètre trouvé.", "alert");
    }
  });
}

/* ---------- Page : Mon profil (profil.html) ----------
      Tout est calculé à partir du compte connecté, de son journal d'activité
      et des mesures : la page change dès que ces données changent. */

const ACTIVITY_ICONS = {
  ajout: "＋",
  modif: "✎",
  suppression: "♲",
  connexion: "⎆",
  compte: "☺",
};

/* « il y a 5 min », « il y a 2 h », puis la date complète après un jour */
function timeAgo(timestamp) {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return formatDate(timestampToIso(timestamp));
}

/* En-tête : avatar, nom, rôle, dates. user = le compte, éventuellement avec
      des modifications pas encore enregistrées (aperçu pendant la saisie). */
function fillProfileHeader(user) {
  const name = displayName(user);
  findOne("#profileAvatar").textContent = name.charAt(0).toUpperCase();
  findOne("#profileName").textContent = name;
  findOne("#profileHandle").textContent =
    "@" + user.u + (user.email ? " · " + user.email : "");
  findOne("#profileRole").textContent =
    user.u === "admin" ? "Administrateur" : "Utilisateur";

  const job = findOne("#profileJob");
  job.textContent = user.fonction || "";
  job.hidden = !user.fonction;

  const bio = findOne("#profileBio");
  bio.textContent = user.bio || "";
  bio.hidden = !user.bio;

  findOne("#profileSince").textContent = user.cree
    ? formatDate(timestampToIso(user.cree)).slice(0, 10)
    : "Compte par défaut";
  findOne("#profileLastLogin").textContent = user.precedente
    ? formatDate(timestampToIso(user.precedente))
    : "Première connexion";

  /* La session est dans localStorage si « Se souvenir de moi » était coché */
  const isRemembered = !!localStorage.getItem(SESSION_KEY);
  findOne("#profileSession").textContent = isRemembered
    ? "Mémorisée sur cet appareil"
    : "Jusqu'à la fermeture du navigateur";
}

/* Carte du bâtiment suivi : consommation par ressource et alertes */
function fillFavoriteBuilding(buildingName) {
  const panel = findOne("#favoritePanel");
  const building = state.batiments.find((b) => b.nom === buildingName);
  if (!building) {
    panel.innerHTML = `<h2>Mon bâtiment suivi</h2><p class="muted favorite-empty">Choisissez un bâtiment dans vos informations pour suivre sa consommation ici.</p>`;
    return;
  }

  const measures = measuresOfBuilding(buildingName);
  const alertCount = measures.filter((m) => m.alerte).length;
  const rows = RESOURCE_NAMES.map((resource) => {
    const info = RESOURCES[resource];
    const total = sumValues(filterByResource(measures, resource));
    return `<div><span class="resource-label ${info.cssClass}">${
      info.icon
    } ${resource}</span><b>${formatNumber(total)} ${info.unit}</b></div>`;
  }).join("");
  const status = alertCount
    ? `<span class="status warning">${alertCount} ${plural(
        alertCount,
        "alerte"
      )}</span>`
    : '<span class="status normal">Normal</span>';
  const link = `detail.html?b=${encodeURIComponent(buildingName)}`;

  panel.innerHTML = `<div class="panel-heading"><h2>Mon bâtiment suivi : ${escapeHtml(
    buildingName
  )}</h2>${status}</div>
       <div class="favorite-list">${rows}</div>
       <a class="text-link" href="${link}">Voir le détail →</a>`;
}

/* Compteurs et liste des dernières actions */
function fillActivity(username) {
  const { compteurs, recent } = readJournal(username);
  ["ajout", "modif", "suppression", "connexion"].forEach((type) => {
    const id = "#count" + type.charAt(0).toUpperCase() + type.slice(1); // « ajout » → « #countAjout »
    findOne(id).textContent = formatNumber(compteurs[type] || 0);
  });

  findOne("#activityTotal").textContent = recent.length
    ? `${recent.length} dernière(s) action(s)`
    : "";
  findOne("#activityList").innerHTML = recent.length
    ? recent
        .map(
          (entry) =>
            `<li><span class="activity-icon ${entry.type}">${
              ACTIVITY_ICONS[entry.type] || "•"
            }</span><span>${escapeHtml(entry.texte)}</span><small>${timeAgo(
              entry.t
            )}</small></li>`
        )
        .join("")
    : '<li class="muted">Aucune action pour le moment : ajoutez ou modifiez une mesure depuis la page Données.</li>';
}

/* Vérifie le formulaire. Renvoie un message d'erreur, ou "" si tout va bien. */
function checkProfile(values) {
  if (values.nom.length > 40) return "Nom complet : 40 caractères maximum.";
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return "Adresse e-mail invalide (exemple : prenom.nom@exemple.tn).";
  }
  if (values.bio.length > 200) return "Bio : 200 caractères maximum.";
  return "";
}

/* Lit les champs du formulaire, sans espaces inutiles au début et à la fin */
function readProfileForm(form) {
  const values = Object.fromEntries(new FormData(form));
  return {
    nom: values.nom.trim(),
    email: values.email.trim(),
    fonction: values.fonction,
    favori: values.favori,
    bio: values.bio.trim(),
  };
}

/* Page Mon profil : remplit le formulaire avec les informations du compte,
      affiche l'activité de l'utilisateur et enregistre les modifications. */
async function showProfilePage() {
  let user = await getCurrentUser();
  if (!user) return;

  const form = findOne("#profileForm");
  const saveButton = findOne("#profileSave");
  const errorElement = findOne("#profileError");
  const bioInput = findOne("[name=bio]", form);

  /* Liste des bâtiments, puis valeurs actuelles du compte dans le formulaire */
  findOne("#favoriteSelect").insertAdjacentHTML(
    "beforeend",
    state.batiments.map((b) => `<option>${escapeHtml(b.nom)}</option>`).join("")
  );
  ["nom", "email", "fonction", "favori", "bio"].forEach((field) => {
    findOne(`[name=${field}]`, form).value = user[field] || "";
  });

  /* Compteur de caractères de la bio, ex : « 42 / 200 ». */
  function updateBioCount() {
    findOne("#bioCount").textContent = `${bioInput.value.length} / 200`;
  }

  fillProfileHeader(user);
  fillFavoriteBuilding(user.favori);
  fillActivity(user.u);
  updateBioCount();

  /* Pendant la saisie : aperçu immédiat de l'en-tête et du bâtiment suivi */
  form.addEventListener("input", () => {
    const values = readProfileForm(form);
    fillProfileHeader({ ...user, ...values });
    fillFavoriteBuilding(values.favori);
    updateBioCount();
    errorElement.hidden = true;
    saveButton.disabled = false; // il y a des changements à enregistrer
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = readProfileForm(form);
    const errorMessage = checkProfile(values);
    if (errorMessage) {
      showFormError(form, errorElement, errorMessage);
      return;
    }
    user = await updateUser(user.u, values);
    showUserInTopbar(displayName(user));
    logActivity("compte", "Profil mis à jour");
    fillActivity(user.u);
    saveButton.disabled = true;
    showToast("Profil enregistré.");
  });

  findOne("#profilePwdBtn").addEventListener("click", async (event) => {
    event.preventDefault();
    if (await askChangePassword()) fillActivity(user.u);
  });
  findOne("#profileLogout").addEventListener("click", (event) => {
    event.preventDefault();
    logout();
  });

  /* « il y a 5 min » doit avancer tout seul : on réaffiche chaque minute */
  setInterval(() => fillActivity(user.u), 60000);
}

/* Associe chaque valeur de data-page à la fonction qui remplit cette page */
const PAGE_FUNCTIONS = {
  dashboard: showDashboardPage,
  charts: showChartsPage,
  buildings: showBuildingsPage,
  detail: showDetailPage,
  data: showDataPage,
  settings: showSettingsPage,
  profile: showProfilePage,
};

/* =====================================================================
      PARTIE 13 — Barre de recherche du haut
      ===================================================================== */

/* Pages proposées dans les suggestions : [nom, mots-clés, adresse] */
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
    "parametres reglages seuils notifications apparence theme reinitialiser",
    PAGES_URL + "parametres.html",
  ],
  [
    "Mon profil",
    "profil compte utilisateur nom email activite historique deconnexion mot de passe securite",
    PAGES_URL + "profil.html",
  ],
];

const SEARCH_PLACEHOLDERS = {
  data: "Rechercher une mesure (bâtiment, ressource, valeur)…",
  buildings: "Rechercher un bâtiment…",
  charts: "Filtrer les graphiques (bâtiment ou ressource) puis Entrée…",
  settings: "Rechercher un paramètre…",
};

/* Adresse de la page Données avec une recherche, ex : donnees.html?q=eau.
      encodeURIComponent protège les espaces et les accents dans l'adresse. */
function measuresSearchUrl(text) {
  return PAGES_URL + "donnees.html?q=" + encodeURIComponent(text);
}

/* Page Graphiques : Entrée recharge la page avec le filtre dans l'adresse */
function setupChartsSearch(searchInput) {
  searchInput.value = getUrlParam("q") || "";
  searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const text = searchInput.value.trim();
    const params = new URLSearchParams(location.search);
    if (text) params.set("q", text);
    else params.delete("q");
    location.search = params.toString();
  });
}

/* Suggestion de recherche pour un bâtiment : un lien vers sa page Détail. */
function buildingSuggestionHtml(building) {
  const link = `${PAGES_URL}detail.html?b=${encodeURIComponent(building.nom)}`;
  return `<a href="${link}"><span>▦</span>${escapeHtml(
    building.nom
  )}<small>${escapeHtml(building.type || "")}</small></a>`;
}

/* Suggestion de recherche pour une page du site.
      [name, , url] prend la 1re et la 3e case du tableau (la 2e est ignorée). */
function pageSuggestionHtml([name, , url]) {
  return `<a href="${url}"><span>→</span>${escapeHtml(name)}</a>`;
}

/* Contenu de la liste : bâtiments et pages trouvés, puis recherche dans les mesures */
function suggestionsHtml(text) {
  const query = normalizeText(text);
  const buildings = state.batiments
    .filter((building) => normalizeText(building.nom).includes(query))
    .slice(0, 5);
  const pages = SITE_PAGES.filter(([name, keywords]) =>
    normalizeText(name + " " + keywords).includes(query)
  );

  let html = "";
  if (buildings.length) {
    html +=
      "<h4>Bâtiments</h4>" + buildings.map(buildingSuggestionHtml).join("");
  }
  if (pages.length) {
    html += "<h4>Pages</h4>" + pages.map(pageSuggestionHtml).join("");
  }
  html += `<h4>Mesures</h4><a href="${measuresSearchUrl(
    text
  )}"><span>⌕</span>Chercher « ${escapeHtml(text)} » dans les mesures</a>`;
  return html;
}

/* Tableau de bord et Détail : liste de suggestions sous la barre */
function setupSearchSuggestions(searchInput) {
  const resultsBox = document.createElement("div");
  resultsBox.className = "search-results";
  resultsBox.hidden = true;
  searchInput.closest(".search").append(resultsBox);

  /* Affiche la liste des suggestions sous la barre de recherche,
        ou la cache si le champ est vide. */
  function showSuggestions() {
    const text = searchInput.value.trim();
    if (!normalizeText(text)) {
      resultsBox.hidden = true;
      return;
    }
    resultsBox.innerHTML = suggestionsHtml(text);
    resultsBox.hidden = false;
  }

  searchInput.addEventListener("input", showSuggestions);
  searchInput.addEventListener("focus", showSuggestions);
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") resultsBox.hidden = true;
    if (event.key === "Enter" && searchInput.value.trim()) {
      location.href = measuresSearchUrl(searchInput.value.trim());
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search")) resultsBox.hidden = true;
  });
}

/* Barre de recherche du haut : son texte d'aide change selon la page,
      et son comportement aussi (filtre direct, Entrée, ou suggestions). */
function setupTopSearch() {
  const searchInput = findOne(".topbar .search input");
  if (!searchInput) return;

  searchInput.placeholder =
    SEARCH_PLACEHOLDERS[CURRENT_PAGE] ||
    "Rechercher un bâtiment, une page, une mesure…";

  /* Sur ces pages, la barre filtre directement le contenu (voir PARTIE 12) */
  if (["data", "buildings", "settings"].includes(CURRENT_PAGE)) return;

  if (CURRENT_PAGE === "charts") setupChartsSearch(searchInput);
  else setupSearchSuggestions(searchInput);
}

/* =====================================================================
      PARTIE 14 — Éléments communs à toutes les pages
      ===================================================================== */

/* Écrit le nom et l'initiale de l'utilisateur en haut à droite */
function showUserInTopbar(name) {
  const profile = findOne(".profile");
  if (profile) profile.textContent = name;
  const avatar = findOne(".avatar");
  if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
}

/* Bouton de déconnexion, nom et initiale de l'utilisateur.
      Un clic sur l'avatar ou le nom ouvre la page Mon profil. */
function setupUserMenu() {
  const session = getSession();
  const actions = findOne(".top-actions");
  if (!session || !actions) return;

  const avatar = findOne(".avatar", actions);
  const profile = findOne(".profile", actions);
  if (avatar && profile) {
    const link = document.createElement("a");
    link.className = "profile-link";
    link.href = PAGES_URL + "profil.html";
    link.title = "Mon profil";
    avatar.before(link);
    link.append(avatar, profile); // déplace l'avatar et le nom dans le lien
  }

  actions.insertAdjacentHTML(
    "beforeend",
    '<button class="icon-btn logout-btn" title="Se déconnecter" aria-label="Se déconnecter">⎋</button>'
  );
  findOne(".logout-btn").addEventListener("click", logout);

  showUserInTopbar(session.u);
  /* Le nom complet (s'il existe) est dans le compte, qu'on lit ensuite */
  getCurrentUser().then((user) => {
    if (user) showUserInTopbar(displayName(user));
  });
}

/* Bouton thème clair / sombre : ajoute ou enlève la classe « dark-mode »,
      retient le choix, puis redessine les graphiques avec les nouvelles couleurs. */
function setupThemeButton() {
  findOne("#themeToggle")?.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    settings.theme = isDark ? "dark" : "light";
    localStorage.setItem(THEME_KEY, settings.theme);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    redrawAllCharts();
  });
}

/* Bouton cloche : affiche le nombre d'alertes en cours. */
function setupNotificationsButton() {
  const button = findAll(".top-actions .icon-btn")[1];
  button?.addEventListener("click", () => {
    const alertCount = state.mesures.filter((m) => m.alerte).length;
    if (alertCount) {
      showToast(
        `${alertCount} alerte(s) active(s). Détails dans la page Données.`,
        "alert"
      );
    } else {
      showToast("Aucune alerte active.");
    }
  });
}

/* Vérifie le nom d'un nouveau bâtiment. Renvoie un message d'erreur, ou "". */
function checkBuildingName(name) {
  if (!name) return "Le nom est obligatoire.";
  const lowerName = name.toLowerCase();
  if (state.batiments.some((b) => b.nom.toLowerCase() === lowerName)) {
    return "Ce bâtiment existe déjà.";
  }
  if (/[,"\n\r]/.test(name) || name.length > 49) {
    return "Nom invalide : pas de virgule ni de guillemet, 49 caractères max.";
  }
  return "";
}

/* Sans dossier connecté, le nouveau bâtiment est gardé dans le navigateur */
function rememberAddedBuilding(building) {
  const lowerName = building.nom.toLowerCase();
  const deletedNames = readStoredList(DELETED_BUILDINGS_KEY).filter(
    (name) => name.toLowerCase() !== lowerName
  );
  localStorage.setItem(DELETED_BUILDINGS_KEY, JSON.stringify(deletedNames));

  const addedBuildings = readStoredList(ADDED_BUILDINGS_KEY);
  addedBuildings.push(building);
  localStorage.setItem(ADDED_BUILDINGS_KEY, JSON.stringify(addedBuildings));
}

/* Bouton « Nouveau bâtiment » : ouvre un formulaire (nom, type...),
      vérifie le nom, ajoute le bâtiment puis enregistre. */
function setupNewBuildingButton() {
  findOne("#newBuilding")?.addEventListener("click", async () => {
    const answers = await openDialog({
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
    if (!answers) return;

    const name = answers.nom.trim();
    const errorMessage = checkBuildingName(name);
    if (errorMessage) {
      showToast(errorMessage, "alert");
      return;
    }

    const building = {
      nom: name,
      type: answers.type,
      etages: Number(answers.etages),
      surface: Number(answers.surface),
    };
    state.batiments.push(building);
    if (!(await saveData())) {
      state.batiments.pop(); // échec : on annule
      return;
    }
    if (!isFolderConnected) rememberAddedBuilding(building);
    logActivity("ajout", `Création du bâtiment « ${building.nom} »`);
    location.reload();
  });
}

/* Changement de mot de passe : demande l'ancien (pour vérifier que c'est bien
      le propriétaire du compte), puis le nouveau deux fois (contre les fautes de
      frappe, 8 caractères minimum), puis l'enregistre. Renvoie true si le mot de passe a été changé. */
async function askChangePassword() {
  const answers = await openDialog({
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
  if (!answers) return;

  const session = getSession();
  if (!session || !(await checkLogin(session.u, answers.a))) {
    showToast("Mot de passe actuel incorrect.", "alert");
    return;
  }
  if (answers.n.length < 8 || answers.n !== answers.c) {
    showToast(
      "Nouveau mot de passe trop court (8 min.) ou confirmation différente.",
      "alert"
    );
    return;
  }
  await changePassword(session.u, answers.n);
  logActivity("compte", "Mot de passe modifié");
  showToast("Mot de passe modifié.");
  return true;
}

/* Bouton « Réinitialiser » : après confirmation, efface les préférences
      gardées dans le navigateur (les comptes ne sont jamais effacés). */
async function askResetEverything() {
  const confirmed = await openDialog({
    title: "Tout réinitialiser ?",
    text: isFolderConnected
      ? "Vos préférences seront effacées (data.json, data.csv et les comptes ne sont pas touchés)."
      : "Mesures, bâtiments et préférences seront effacés. Les comptes utilisateurs sont conservés.",
    ok: "Réinitialiser",
  });
  if (!confirmed) return;

  [
    MEASURES_KEY,
    ADDED_BUILDINGS_KEY,
    DELETED_BUILDINGS_KEY,
    SETTINGS_KEY,
    THEME_KEY,
  ].forEach((key) => localStorage.removeItem(key));
  location.reload();
}

/* Remplit le formulaire de la page Paramètres et branche ses boutons */
function setupSettingsForm() {
  const form = findOne("#settingsForm");
  if (!form) return;

  findAll("[name]", form).forEach((input) => {
    if (input.type === "radio")
      input.checked = input.value === settings[input.name];
    else if (input.type === "checkbox") input.checked = !!settings[input.name];
    else if (input.name !== "nb") input.value = settings[input.name] ?? "";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSettings(form);
  });

  findAll(".settings-tabs .tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      findAll(".settings-pane").forEach(
        (pane) => (pane.hidden = pane.dataset.pane !== tab.dataset.pane)
      );
    })
  );

  findOne("#resetAll").addEventListener("click", (event) => {
    event.preventDefault();
    askResetEverything();
  });
}

/* Quand on clique sur un onglet, il devient l'onglet actif */
function setupTabs() {
  findAll(".chart-tabs .tab, .detail-tabs .tab, .settings-tabs .tab").forEach(
    (tab) =>
      tab.addEventListener("click", () => {
        findAll(".tab", tab.parentElement).forEach((otherTab) =>
          otherTab.classList.remove("active")
        );
        tab.classList.add("active");
      })
  );
}

/* Prépare tout ce qui est commun à toutes les pages : réglages, menu de
      l'utilisateur, bouton thème, recherche, notifications, nouveau bâtiment... */
function setupCommonElements() {
  applySettings();
  setupUserMenu();
  setupThemeButton();
  setupTopSearch();
  setupNotificationsButton();
  setupNewBuildingButton();
  setupSettingsForm();
  setupTabs();
}

/* =====================================================================
      PARTIE 15 — Démarrage : tout commence ici
      ===================================================================== */

/* Point de départ du site, appelé quand la page HTML est prête (voir la dernière ligne).
   
        1. pas connecté : on ne fait rien (la page de connexion s'ouvre) ;
        2. page de connexion : on la prépare et on s'arrête là ;
        3. sinon : éléments communs, puis on charge data.json ;
        4. on charge Chart.js si la page a des graphiques ;
        5. on appelle la fonction de la page (PAGE_FUNCTIONS : une fonction par page). */
async function startApp() {
  /* Sans session, la redirection vers la connexion est déjà en cours */
  if (CURRENT_PAGE !== "login" && !getSession()) return;

  if (CURRENT_PAGE === "login") {
    applySettings();
    setupLoginPage();
    return;
  }

  setupCommonElements();

  const showPage = PAGE_FUNCTIONS[CURRENT_PAGE];
  if (!showPage) return;

  await detectDataFolder();
  const data = await loadData();
  if (!data) return;
  prepareState(data);

  /* Les pages Données, Bâtiments et Profil n'ont pas de graphique */
  if (!["data", "buildings", "profile"].includes(CURRENT_PAGE)) {
    await loadChartJs();
  }
  showPage();
}

document.addEventListener("DOMContentLoaded", startApp);
