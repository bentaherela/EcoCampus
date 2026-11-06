/* =====================================================================
   EcoCampus — Carte interactive du campus

   • Les lieux viennent de data/campus.csv (un lieu = une ligne).
   • Le fichier est relu toutes les 3 secondes : tout ajout, modification ou
     suppression dans le CSV apparaît sur la carte SANS recharger la page.
   • Aucune position n'est écrite dans le code : une ligne sans latitude /
     longitude reste « non localisée » (visible dans la liste, pas sur la carte).
   • Fond de carte réel : OpenStreetMap (plan) et Esri World Imagery (satellite).
   • Itinéraire à pied : routing.openstreetmap.de (profil piéton, données OSM).

   Ce fichier est chargé APRÈS script.js (connexion, thème, langue, dossier data).
   ===================================================================== */
(function () {
  "use strict";

  const SRC = document.currentScript.src;
  const CSV_URL = new URL("../data/campus.csv", SRC).href;
  const PAGES_URL_LOCAL = new URL("../pages/", SRC).href;
  const POLL_MS = 3000;
  const ROUTE_API =
    "https://routing.openstreetmap.de/routed-foot/route/v1/foot/";
  /* Vue de départ quand aucun lieu n'est localisé : le Campus Universitaire de
       Menzel Abderrahmane (Bizerte), centre approximatif des établissements.
       Ce n'est la position d'aucun bâtiment : les lieux viennent de campus.csv. */
  const FALLBACK_VIEW = { center: [37.2365, 9.884], zoom: 16 };

  const tr = (text) => (typeof t === "function" ? t(text) : text);

  /* ---------- Catégories : couleur + icône (les autres reçoivent un style neutre) ---------- */
  const CATEGORY_STYLES = {
    enseignement: { c: "#087c62", i: "🎓" },
    residence: { c: "#3b82f6", i: "🏠" },
    administration: { c: "#8b5cf6", i: "🏛️" },
    bibliotheque: { c: "#f59e0b", i: "📚" },
    restauration: { c: "#ef4444", i: "🍽️" },
    sport: { c: "#0ea5e9", i: "⚽" },
    sante: { c: "#ec4899", i: "➕" },
    parking: { c: "#64748b", i: "🅿️" },
    service: { c: "#14b8a6", i: "ℹ️" },
    technopole: { c: "#a16207", i: "🏭" },
    espace: { c: "#22a05a", i: "🌳" }, // « Espace vert »
    point: { c: "#0284c7", i: "🚰" }, // « Point d'eau »
  };
  const DEFAULT_STYLE = { c: "#10ad82", i: "📍" };

  /* Campus documenté dans le README du projet. Une colonne facultative « localisation »
       (ou « adresse ») de campus.csv remplace ce texte pour un lieu donné. */
  const CAMPUS_NAME = "Campus universitaire de Menzel Abderrahmane, Bizerte";
  /* Catégories (début du nom, sans accent) comptées comme « établissements ».
       Toute autre catégorie (restauration, parking, espace vert, point d'eau, résidence,
       sport, santé, services…) est rangée dans « Équipements et services ». */
  const ESTABLISHMENT_CATEGORIES = [
    "enseignement",
    "administration",
    "technopole",
    "recherche",
    "universite",
    "faculte",
    "institut",
    "ecole",
  ];

  const norm = (s) =>
    String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c])
    );
  const $ = (sel, root = document) => root.querySelector(sel);

  const isEstablishment = (p) =>
    ESTABLISHMENT_CATEGORIES.some((k) => norm(p.categorie).startsWith(k));

  /* Type affiché : sigle entre parenthèses du nom (ISET, ENIB, ISG…), sinon Faculté / Institut /
       École / Université si le nom commence ainsi, sinon la catégorie du fichier. */
  function typeOf(p) {
    const acr = String(p.nom).match(/\(([A-ZÉÈ0-9]{2,8})\)\s*$/);
    if (acr) return acr[1];
    const w = norm(p.nom).match(/^(faculte|institut|ecole|universite)/);
    if (w)
      return {
        faculte: "Faculté",
        institut: "Institut",
        ecole: "École",
        universite: "Université",
      }[w[1]];
    return p.categorie;
  }

  function styleOf(category) {
    const k = norm(category);
    for (const key in CATEGORY_STYLES)
      if (k.startsWith(key)) return CATEGORY_STYLES[key];
    return DEFAULT_STYLE;
  }

  /* ---------- Lecture du CSV (séparateur , ou ; détecté, guillemets, BOM, CRLF) ---------- */
  function parseCsv(text) {
    text = text.replace(/^\uFEFF/, "");
    const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || "";
    const delim =
      (firstLine.match(/;/g) || []).length >
      (firstLine.match(/,/g) || []).length
        ? ";"
        : ",";
    const rows = [];
    let row = [],
      cell = "",
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i++;
          } else quoted = false;
        } else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delim) {
        row.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        rows.push(row);
        row = [];
      } else cell += ch;
    }
    if (cell !== "" || row.length) {
      row.push(cell);
      rows.push(row);
    }
    const clean = rows.filter((r) => r.some((c) => c.trim() !== ""));
    return {
      delim,
      eol: text.includes("\r\n") ? "\r\n" : "\n",
      header: clean[0] || [],
      rows: clean.slice(1),
    };
  }

  function csvCell(value, delim) {
    const s = String(value ?? "");
    return /["\r\n]/.test(s) || s.includes(delim)
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  }
  function serializeCsv(p) {
    return (
      [p.header, ...p.rows]
        .map((r) => r.map((c) => csvCell(c, p.delim)).join(p.delim))
        .join(p.eol) + p.eol
    );
  }

  const ALIASES = {
    id: ["id"],
    nom: ["nom", "name", "lieu"],
    categorie: ["categorie", "category", "type"],
    lat: ["latitude", "lat"],
    lng: ["longitude", "lng", "lon", "long"],
    description: ["description", "infos", "info"],
    horaires: ["horaires", "horaire", "hours"],
    telephone: ["telephone", "tel", "phone"],
    services: ["services", "service"],
    batiment: ["batiment", "batiment_lie"],
    localisation: ["localisation", "adresse", "address"],
  };
  function columnIndexes(header) {
    const names = header.map(norm);
    const idx = {};
    for (const key in ALIASES) {
      idx[key] = names.findIndex((n) => ALIASES[key].includes(n));
    }
    if (idx.nom < 0) idx.nom = idx.batiment; // fichier minimal : « batiment » sert de nom
    return idx;
  }

  function parseCoordinate(raw, min, max) {
    const s = String(raw ?? "")
      .trim()
      .replace(",", ".");
    if (s === "") return { value: null, bad: false };
    const n = Number(s);
    if (!Number.isFinite(n) || n < min || n > max)
      return { value: null, bad: true };
    return { value: n, bad: false };
  }

  /* Transforme le CSV en liste de lieux */
  function buildPlaces(parsed, idx, overrides) {
    const seen = new Set();
    const places = [];
    parsed.rows.forEach((row, rowIndex) => {
      const get = (k) => (idx[k] >= 0 ? String(row[idx[k]] ?? "").trim() : "");
      const nom = get("nom");
      if (!nom) return;
      let id = get("id") || nom;
      while (seen.has(id)) id += "#" + rowIndex;
      seen.add(id);
      let la = parseCoordinate(get("lat"), -90, 90);
      let ln = parseCoordinate(get("lng"), -180, 180);
      let lat = la.value,
        lng = ln.value;
      const ov = overrides.get(id);
      if (ov) {
        if (lat === null || lng === null) {
          lat = ov.lat;
          lng = ov.lng;
          la.bad = ln.bad = false;
        } else overrides.delete(id); // le fichier contient maintenant la position
      }
      const located = lat !== null && lng !== null;
      places.push({
        id,
        rowIndex,
        nom,
        categorie: get("categorie") || "Autre",
        lat: located ? lat : null,
        lng: located ? lng : null,
        located,
        badCoords:
          !located &&
          (la.bad || ln.bad || (lat === null) !== (lng === null)) &&
          (get("lat") || get("lng")) !== "",
        description: get("description"),
        horaires: get("horaires"),
        telephone: get("telephone"),
        services: get("services")
          .split(/[|;]/)
          .map((s) => s.trim())
          .filter(Boolean),
        batiment: idx.nom === idx.batiment ? "" : get("batiment"),
        localisation: get("localisation"),
      });
    });
    return places;
  }

  /* Informations de consommation (data.json) : état global de script.js */
  function ecoBuilding(place) {
    if (typeof state === "undefined" || !Array.isArray(state.batiments))
      return null;
    const keys = [norm(place.nom), norm(place.batiment)].filter(Boolean);
    return state.batiments.find((b) => keys.includes(norm(b.nom))) || null;
  }

  /* =====================================================================
       Application
       ===================================================================== */
  window.initCampusMap = function initCampusMap() {
    if (typeof L === "undefined") {
      $("#campusMap").innerHTML =
        '<p class="map-error">La bibliothèque de carte (Leaflet) n\'a pas pu être chargée. Vérifiez la connexion Internet.</p>';
      return;
    }

    let parsed = null,
      idx = {};
    let places = [];
    let lastText = null;
    let selectedId = null;
    let placingId = null;
    let routeTo = null;
    let hasFitted = false;
    const overrides = new Map(); // réservé (toujours vide) : buildPlaces l'attend en paramètre
    const filters = { q: "", cats: new Set(), view: "all" }; // view : all | equip
    const markers = new Map(); // id -> { marker, sig }

    const searchInput = $("#mapSearch");
    const topInput = $(".topbar .search input");
    const listEl = $("#placeList");
    const chipsEl = $("#catChips");
    const countEl = $("#resultCount");
    const statusEl = $("#syncStatus");
    const hintEl = $("#mapHint");
    const bannerEl = $("#placeBanner");
    const routeEl = $("#routePanel");
    const tabsEl = $("#viewTabs");

    if (topInput)
      topInput.placeholder = tr("Rechercher un bâtiment ou un service…");

    /* ---------- Carte ---------- */
    const map = L.map("campusMap", { zoomControl: true, maxZoom: 20 }).setView(
      FALLBACK_VIEW.center,
      FALLBACK_VIEW.zoom
    );
    const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      maxNativeZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 20,
        maxNativeZoom: 18,
        attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
      }
    ).addTo(map); // vue satellite par défaut ; « Plan » (OpenStreetMap) dans le sélecteur
    L.control
      .layers({ [tr("Satellite")]: satellite, [tr("Plan")]: osm }, null, {
        position: "topright",
      })
      .addTo(map);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);
    const meLayer = L.layerGroup().addTo(map);

    /* Boutons « Recentrer » et « Ma position » */
    const tools = L.control({ position: "topleft" });
    tools.onAdd = () => {
      const box = L.DomUtil.create("div", "leaflet-bar cc-tools");
      box.innerHTML =
        `<a href="#" role="button" data-tool="fit" title="${esc(
          tr("Voir tout le campus")
        )}" aria-label="${esc(tr("Voir tout le campus"))}">⛶</a>` +
        `<a href="#" role="button" data-tool="me" title="${esc(
          tr("Ma position")
        )}" aria-label="${esc(tr("Ma position"))}">◎</a>`;
      L.DomEvent.disableClickPropagation(box);
      box.addEventListener("click", (e) => {
        const tool = e.target.closest("[data-tool]")?.dataset.tool;
        if (!tool) return;
        e.preventDefault();
        if (tool === "fit") fitAll(true);
        if (tool === "me")
          locateMe().then((p) => p && map.flyTo([p.lat, p.lng], 17));
      });
      return box;
    };
    tools.addTo(map);

    /* ---------- Marqueurs ---------- */
    function pinIcon(place, selected) {
      const s = styleOf(place.categorie);
      return L.divIcon({
        className: "cc-pin-wrap",
        html: `<div class="cc-pin${
          selected ? " is-selected" : ""
        }" style="--c:${s.c}"><span>${s.i}</span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -32],
      });
    }

    function popupHtml(place) {
      const s = styleOf(place.categorie);
      const eco = ecoBuilding(place);
      const type = typeOf(place);
      const coords = place.located
        ? `${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}`
        : "";
      const detail = eco
        ? `<a class="cc-btn ghost" href="${PAGES_URL_LOCAL}detail.html?b=${encodeURIComponent(
            eco.nom
          )}">${esc(tr("Consommation"))}</a>`
        : "";
      return `<div class="cc-pop">
          <div class="cc-top">
            <span class="cc-badge strong" style="--c:${s.c}">${s.i} ${esc(
        tr(type)
      )}</span>
            ${
              norm(type) !== norm(place.categorie)
                ? `<span class="cc-badge" style="--c:${s.c}">${esc(
                    tr(place.categorie)
                  )}</span>`
                : ""
            }
          </div>
          <h3>${esc(tr(place.nom))}</h3>
          <section class="cc-sec cc-general">
            <h4 class="cc-sec-title">📍 ${esc(tr("Informations du lieu"))}</h4>
            <dl class="cc-info">
              <dt>${esc(tr("Localisation"))}</dt><dd>${esc(
        tr(place.localisation || CAMPUS_NAME)
      )}${coords ? `<small>${esc(coords)}</small>` : ""}</dd>
              <dt>${esc(tr("Type"))}</dt><dd>${esc(tr(type))}${
        norm(type) !== norm(place.categorie)
          ? ` · ${esc(tr(place.categorie))}`
          : ""
      }</dd>
            </dl>
            ${
              place.description
                ? `<p class="cc-desc">${esc(tr(place.description))}</p>`
                : ""
            }
            ${
              place.telephone
                ? `<p class="cc-tel">📞 <a href="tel:${esc(
                    place.telephone.replace(/\s+/g, "")
                  )}">${esc(place.telephone)}</a></p>`
                : ""
            }
            ${place.horaires ? `<p>🕘 ${esc(tr(place.horaires))}</p>` : ""}
            ${
              place.services.length
                ? `<p>🔧 ${place.services
                    .map((x) => esc(tr(x)))
                    .join(" · ")}</p>`
                : ""
            }
          </section>
          <div class="cc-actions">${
            place.located
              ? `<button type="button" class="cc-btn" data-act="route" data-id="${esc(
                  place.id
                )}">➜ ${esc(tr("Itinéraire"))}</button>`
              : ""
          }${detail}</div>
        </div>`;
    }

    /* Ajoute / met à jour / retire seulement les marqueurs qui ont changé */
    function syncMarkers() {
      const wanted = new Set();
      places
        .filter((p) => p.located)
        .forEach((p) => {
          wanted.add(p.id);
          const sig = JSON.stringify([
            p.nom,
            p.categorie,
            p.lat,
            p.lng,
            p.description,
            p.horaires,
            p.telephone,
            p.services,
            p.batiment,
            p.localisation,
          ]);
          const old = markers.get(p.id);
          if (old && old.sig === sig) return;
          const wasOpen = old && old.marker.isPopupOpen();
          if (old) markersLayer.removeLayer(old.marker);
          const marker = L.marker([p.lat, p.lng], {
            icon: pinIcon(p, p.id === selectedId),
            title: tr(p.nom),
            riseOnHover: true,
          })
            .bindTooltip(esc(tr(p.nom)), { direction: "top", offset: [0, -30] })
            .bindPopup(
              () => popupHtml(places.find((x) => x.id === p.id) || p),
              { maxWidth: 360, minWidth: 260, autoPanPadding: [20, 20] }
            );
          marker.on("click", () => setSelected(p.id, false));
          marker.addTo(markersLayer);
          if (wasOpen) marker.openPopup();
          markers.set(p.id, { marker, sig });
        });
      for (const [id, entry] of markers) {
        if (!wanted.has(id)) {
          markersLayer.removeLayer(entry.marker);
          markers.delete(id);
        }
      }
      applyVisibility();
    }

    /* Filtres : cache les marqueurs hors résultats */
    const inView = (p) =>
      filters.view === "equip" ? !isEstablishment(p) : isEstablishment(p);
    function matches(p) {
      if (!inView(p)) return false;
      if (filters.cats.size && !filters.cats.has(norm(p.categorie)))
        return false;
      if (!filters.q) return true;
      const raw = [
        p.nom,
        p.categorie,
        p.description,
        p.services.join(" "),
        p.batiment,
        p.horaires,
      ];
      const hay = norm(raw.concat(raw.map((x) => tr(x))).join(" "));
      return filters.q.split(/\s+/).every((tok) => hay.includes(tok));
    }
    function applyVisibility() {
      for (const [id, entry] of markers) {
        const p = places.find((x) => x.id === id);
        const show = p && matches(p);
        const has = markersLayer.hasLayer(entry.marker);
        if (show && !has) markersLayer.addLayer(entry.marker);
        if (!show && has) markersLayer.removeLayer(entry.marker);
      }
    }

    function fitAll(animate, subset) {
      const pts = (subset || places.filter((p) => p.located)).map((p) => [
        p.lat,
        p.lng,
      ]);
      if (!pts.length) {
        map.setView(FALLBACK_VIEW.center, FALLBACK_VIEW.zoom);
        return;
      }
      if (pts.length === 1) {
        map.setView(pts[0], 18, { animate });
        return;
      }
      map.fitBounds(L.latLngBounds(pts), {
        padding: [50, 50],
        maxZoom: 18,
        animate,
      });
    }

    /* ---------- Liste + filtres ---------- */
    function renderChips() {
      const counts = new Map();
      places.filter(inView).forEach((p) => {
        const k = norm(p.categorie);
        const e = counts.get(k) || { label: p.categorie, n: 0 };
        e.n++;
        counts.set(k, e);
      });
      // retire du filtre les catégories qui n'existent plus
      [...filters.cats].forEach((k) => {
        if (!counts.has(k)) filters.cats.delete(k);
      });
      const all = `<button type="button" class="chip${
        filters.cats.size ? "" : " on"
      }" data-cat="">${esc(tr("Tous"))} <b>${
        places.filter(inView).length
      }</b></button>`;
      chipsEl.innerHTML =
        all +
        [...counts]
          .map(([k, e]) => {
            const s = styleOf(e.label);
            return `<button type="button" class="chip${
              filters.cats.has(k) ? " on" : ""
            }" style="--c:${s.c}" data-cat="${esc(
              k
            )}" aria-pressed="${filters.cats.has(k)}">${s.i} ${esc(
              tr(e.label)
            )} <b>${e.n}</b></button>`;
          })
          .join("");
    }

    function renderList() {
      const shown = places.filter(matches);
      const located = places.filter((p) => p.located).length;
      const inViewCount = places.filter(inView).length;
      countEl.textContent = `${shown.length} / ${inViewCount}`;
      if (!places.length) {
        listEl.innerHTML = `<p class="empty">${esc(
          tr("Aucun lieu dans data/campus.csv pour le moment.")
        )}</p>`;
      } else if (!inViewCount) {
        listEl.innerHTML = `<p class="empty">${esc(
          filters.view === "equip"
            ? tr(
                "Aucun équipement ni service dans data/campus.csv. Ajoutez des lignes (Parking, Espace vert, Point d'eau, Restauration…) pour les voir ici."
              )
            : tr("Aucun établissement dans data/campus.csv.")
        )}</p>`;
      } else if (!shown.length) {
        listEl.innerHTML = `<p class="empty">${esc(
          tr("Aucun résultat. Essayez un autre mot ou retirez un filtre.")
        )}</p>`;
      } else {
        listEl.innerHTML = shown
          .map((p) => {
            const s = styleOf(p.categorie);
            const sub = p.located
              ? esc(tr(p.categorie))
              : `<span class="warn">${esc(
                  p.badCoords ? tr("Coordonnées invalides") : tr("Non localisé")
                )}</span>`;
            const action = p.located
              ? ""
              : `<button type="button" class="mini" data-place="${esc(
                  p.id
                )}">${esc(tr("Placer sur la carte"))}</button>`;
            return `<div class="place-item${
              p.id === selectedId ? " sel" : ""
            }" data-id="${esc(p.id)}" tabindex="0" role="button">
              <span class="place-ico" style="--c:${s.c}">${s.i}</span>
              <span class="place-txt"><b>${esc(
                tr(p.nom)
              )}</b><small>${sub}</small></span>${action}</div>`;
          })
          .join("");
      }
      const unlocated = places.length - located;
      if (hintEl) {
        if (
          filters.view === "equip" &&
          inViewCount &&
          !places.some((p) => inView(p) && p.located)
        ) {
          hintEl.hidden = false;
          hintEl.innerHTML = esc(
            tr(
              "Aucun équipement ou service n'est encore localisé : renseignez latitude et longitude dans data/campus.csv."
            )
          );
          clearTimeout(hintEl._t);
          hintEl._t = setTimeout(() => (hintEl.hidden = true), 7000);
        } else if (places.length && !located) {
          hintEl.hidden = false;
          hintEl.innerHTML = `<b>${esc(
            tr("Aucun lieu n'est encore localisé.")
          )}</b> ${esc(
            tr(
              "Renseignez latitude et longitude dans data/campus.csv, ou utilisez « Placer sur la carte » dans la liste."
            )
          )}`;
        } else if (unlocated) {
          hintEl.hidden = false;
          hintEl.innerHTML = `${unlocated} ${esc(
            tr("lieu(x) sans position (voir la liste).")
          )}`;
          clearTimeout(hintEl._t);
          hintEl._t = setTimeout(() => (hintEl.hidden = true), 6000);
        } else hintEl.hidden = true;
      }
    }

    /* ---------- Filtres : établissements / équipements et services ---------- */
    function renderTabs() {
      if (!tabsEl) return;
      const n = {
        all: places.filter(isEstablishment).length,
        equip: places.filter((p) => !isEstablishment(p)).length,
      };
      tabsEl.querySelectorAll("[data-view]").forEach((b) => {
        const on = b.dataset.view === filters.view;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", String(on));
        const c = b.querySelector("b");
        if (c && n[b.dataset.view] !== undefined)
          c.textContent = n[b.dataset.view];
      });
    }
    tabsEl?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-view]");
      if (!btn || btn.dataset.view === filters.view) return;
      filters.view = btn.dataset.view;
      filters.cats.clear(); // les catégories diffèrent d'une vue à l'autre
      map.closePopup();
      refreshUi();
      fitAll(
        true,
        places.filter((p) => p.located && matches(p))
      );
    });

    function refreshUi() {
      renderTabs();
      renderChips();
      renderList();
      applyVisibility();
    }

    function setSelected(id, fly) {
      const prev = selectedId;
      selectedId = id;
      [prev, id].forEach((pid) => {
        const entry = pid && markers.get(pid);
        const p = pid && places.find((x) => x.id === pid);
        if (entry && p) entry.marker.setIcon(pinIcon(p, pid === selectedId));
      });
      renderList();
      const p = places.find((x) => x.id === id);
      if (!p) return;
      const item = listEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
      item?.scrollIntoView({ block: "nearest" });
      if (!fly) return;
      const entry = markers.get(id);
      if (p.located && entry) {
        if (!markersLayer.hasLayer(entry.marker))
          markersLayer.addLayer(entry.marker);
        map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 18), {
          duration: 0.8,
        });
        map.once("moveend", () => entry.marker.openPopup());
        document
          .querySelector(".map-wrap")
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else {
        toast(tr("Ce lieu n'a pas encore de coordonnées."), "alert");
      }
    }

    /* ---------- Recherche + filtres : événements ---------- */
    let searchTimer;
    function onSearch(value, source) {
      filters.q = norm(value).replace(/\s+/g, " ");
      if (source !== searchInput) searchInput.value = value;
      if (topInput && source !== topInput) topInput.value = value;
      renderList();
      applyVisibility();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        if (filters.q || filters.cats.size)
          fitAll(
            true,
            places.filter((p) => p.located && matches(p))
          );
      }, 350);
    }
    searchInput.addEventListener("input", (e) =>
      onSearch(e.target.value, searchInput)
    );
    topInput?.addEventListener("input", (e) =>
      onSearch(e.target.value, topInput)
    );
    [searchInput, topInput].forEach((inp) =>
      inp?.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const first =
          places.find((p) => matches(p) && p.located) || places.find(matches);
        if (first) setSelected(first.id, true);
      })
    );

    chipsEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      const cat = btn.dataset.cat;
      if (!cat) filters.cats.clear();
      else if (filters.cats.has(cat)) filters.cats.delete(cat);
      else filters.cats.add(cat);
      refreshUi();
      fitAll(
        true,
        places.filter((p) => p.located && matches(p))
      );
    });

    listEl.addEventListener("click", (e) => {
      const place = e.target.closest("[data-place]");
      if (place) {
        e.stopPropagation();
        startPlacing(place.dataset.place);
        return;
      }
      const item = e.target.closest(".place-item");
      if (item) setSelected(item.dataset.id, true);
    });
    listEl.addEventListener("keydown", (e) => {
      if (
        (e.key === "Enter" || e.key === " ") &&
        e.target.classList.contains("place-item")
      ) {
        e.preventDefault();
        setSelected(e.target.dataset.id, true);
      }
    });

    map.on("popupopen", (e) => {
      const el = e.popup.getElement();
      el?.querySelector('[data-act="route"]')?.addEventListener(
        "click",
        (ev) => {
          const p = places.find((x) => x.id === ev.currentTarget.dataset.id);
          if (p) {
            map.closePopup();
            openRoute(p);
          }
        }
      );
    });

    /* ---------- Ma position ---------- */
    let me = null;
    function locateMe() {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          toast(
            tr("La géolocalisation n'est pas disponible sur cet appareil."),
            "alert"
          );
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            me = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              acc: pos.coords.accuracy,
            };
            meLayer.clearLayers();
            L.circle([me.lat, me.lng], {
              radius: me.acc,
              color: "#3b82f6",
              weight: 1,
              fillOpacity: 0.1,
            }).addTo(meLayer);
            L.circleMarker([me.lat, me.lng], {
              radius: 7,
              color: "#fff",
              weight: 2,
              fillColor: "#3b82f6",
              fillOpacity: 1,
            })
              .bindTooltip(esc(tr("Vous êtes ici")))
              .addTo(meLayer);
            resolve(me);
          },
          () => {
            toast(
              tr(
                "Position indisponible : autorisez la localisation ou choisissez un point de départ."
              ),
              "alert"
            );
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
      });
    }

    /* ---------- Itinéraire à pied ---------- */
    function openRoute(dest) {
      routeTo = dest.id;
      const others = places.filter((p) => p.located && p.id !== dest.id);
      routeEl.hidden = false;
      routeEl.innerHTML = `
          <div class="route-head"><b>➜ ${esc(
            tr("Itinéraire à pied")
          )}</b><button type="button" class="route-x" aria-label="${esc(
        tr("Fermer")
      )}" data-r="close">✕</button></div>
          <p class="route-dest">${esc(tr("Vers"))} <b>${esc(
        tr(dest.nom)
      )}</b></p>
          <label class="route-from">${esc(tr("Départ"))}
            <select id="routeFrom">
              <option value="">${esc(
                tr("Choisir un point de départ…")
              )}</option>
              <option value="me">📍 ${esc(tr("Ma position"))}</option>
              ${others
                .map(
                  (p) =>
                    `<option value="${esc(p.id)}">${esc(tr(p.nom))}</option>`
                )
                .join("")}
            </select>
          </label>
          <div class="route-info" id="routeInfo" aria-live="polite"></div>
          <a class="route-ext" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${
            dest.lat
          },${dest.lng}&travelmode=walking">${esc(
        tr("Ouvrir dans Google Maps")
      )} ↗</a>`;
      const select = $("#routeFrom", routeEl);
      select.addEventListener("change", () => computeRoute(select.value));
      // Départ par défaut : la position de la personne si elle l'autorise
      select.value = "me";
      computeRoute("me");
    }

    function closeRoute() {
      routeTo = null;
      routeEl.hidden = true;
      routeLayer.clearLayers();
    }
    routeEl.addEventListener("click", (e) => {
      if (e.target.closest('[data-r="close"]')) closeRoute();
    });

    let routeSeq = 0;
    async function computeRoute(fromKey) {
      const info = $("#routeInfo", routeEl);
      const dest = places.find((p) => p.id === routeTo);
      routeLayer.clearLayers();
      if (!dest || !fromKey) {
        info.textContent = "";
        return;
      }
      const seq = ++routeSeq;
      info.innerHTML = `<span class="spin"></span> ${esc(
        tr("Calcul de l'itinéraire…")
      )}`;
      let from;
      if (fromKey === "me") {
        from = await locateMe();
        if (seq !== routeSeq) return;
        if (!from) {
          info.textContent = tr(
            "Position indisponible. Choisissez un bâtiment de départ."
          );
          $("#routeFrom", routeEl).value = "";
          return;
        }
      } else {
        from = places.find((p) => p.id === fromKey);
        if (!from) return;
      }
      let coords = null,
        meters = null,
        seconds = null,
        approx = false;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(
          `${ROUTE_API}${from.lng},${from.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`,
          { signal: ctrl.signal }
        );
        clearTimeout(timer);
        const json = await res.json();
        const r = json.routes && json.routes[0];
        if (!r) throw new Error("no route");
        coords = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        meters = r.distance;
        seconds = r.duration;
      } catch {
        approx = true;
        coords = [
          [from.lat, from.lng],
          [dest.lat, dest.lng],
        ];
        meters = map.distance(coords[0], coords[1]);
      }
      if (seq !== routeSeq) return;
      const minutes = Math.max(
        1,
        Math.round((seconds && !approx ? seconds : meters / 1.33) / 60)
      );
      const line = L.polyline(coords, {
        color: "#087c62",
        weight: 6,
        opacity: 0.9,
        dashArray: approx ? "2 10" : null,
        lineCap: "round",
      }).addTo(routeLayer);
      L.polyline(coords, {
        color: "#fff",
        weight: 2,
        opacity: 0.7,
        dashArray: "1 10",
      }).addTo(routeLayer);
      map.fitBounds(line.getBounds(), { padding: [60, 60], maxZoom: 19 });
      const dist =
        meters >= 1000
          ? `${(meters / 1000).toFixed(1).replace(".", ",")} km`
          : `${Math.round(meters)} m`;
      info.innerHTML =
        `<strong>${dist}</strong> · ≈ ${minutes} min ${esc(tr("à pied"))}` +
        (approx
          ? `<small>${esc(
              tr(
                "Service d'itinéraire indisponible : ligne droite affichée à titre indicatif."
              )
            )}</small>`
          : "");
    }

    /* ---------- Placer un lieu sans coordonnées en cliquant sur la carte ---------- */
    function startPlacing(id) {
      const p = places.find((x) => x.id === id);
      if (!p) return;
      closeRoute();
      placingId = id;
      bannerEl.hidden = false;
      bannerEl.innerHTML = `📍 ${esc(
        tr("Cliquez sur la carte à l'emplacement exact de")
      )} <b>${esc(tr(p.nom))}</b>
          <button type="button" data-b="cancel">${esc(tr("Annuler"))}</button>`;
      map.getContainer().classList.add("is-placing");
      document
        .querySelector(".map-wrap")
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    function stopPlacing() {
      placingId = null;
      bannerEl.hidden = true;
      map.getContainer().classList.remove("is-placing");
    }
    bannerEl.addEventListener("click", (e) => {
      if (e.target.closest('[data-b="cancel"]')) stopPlacing();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        stopPlacing();
      }
    });

    map.on("click", async (e) => {
      if (!placingId) return;
      const p = places.find((x) => x.id === placingId);
      stopPlacing();
      if (!p) return;
      const lat = Math.round(e.latlng.lat * 1e6) / 1e6;
      const lng = Math.round(e.latlng.lng * 1e6) / 1e6;
      await saveCoordinates(p, lat, lng);
    });

    async function saveCoordinates(place, lat, lng) {
      if (!parsed) return;
      if (idx.lat < 0) {
        parsed.header.push("latitude");
        idx.lat = parsed.header.length - 1;
      }
      if (idx.lng < 0) {
        parsed.header.push("longitude");
        idx.lng = parsed.header.length - 1;
      }
      const row = parsed.rows[place.rowIndex];
      while (row.length < parsed.header.length) row.push("");
      row[idx.lat] = String(lat);
      row[idx.lng] = String(lng);
      const text = serializeCsv(parsed);

      let saved = false;
      try {
        const folder = typeof dataFolder !== "undefined" ? dataFolder : null;
        if (folder) {
          let perm = await folder.queryPermission({ mode: "readwrite" });
          if (perm !== "granted")
            perm = await folder.requestPermission({ mode: "readwrite" });
          if (perm === "granted") {
            const handle = await folder.getFileHandle("campus.csv", {
              create: true,
            });
            const w = await handle.createWritable();
            await w.write(text);
            await w.close();
            saved = true;
          }
        }
      } catch {
        saved = false;
      }

      if (saved) {
        applyCsv(text);
        toast(
          `${tr(place.nom)} : ${tr(
            "position enregistrée dans data/campus.csv"
          )}`,
          "ok"
        );
      } else {
        /* parsed contient déjà la position : on réaffiche sans toucher au fichier du disque */
        places = buildPlaces(parsed, idx, overrides);
        syncMarkers();
        refreshUi();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(
          new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" })
        );
        a.download = "campus.csv";
        document.body.append(a);
        a.click();
        a.remove();
        toast(
          tr(
            "Dossier data non connecté : campus.csv téléchargé, remplacez data/campus.csv par ce fichier."
          ),
          "alert"
        );
      }
      setSelected(place.id, true);
    }

    /* ---------- Chargement et mise à jour en direct du CSV ---------- */
    function toast(message, type) {
      if (typeof showToast === "function") showToast(message, type);
    }
    function setStatus(kind, text) {
      statusEl.className = "sync-pill " + kind;
      $("span", statusEl).textContent = text;
    }

    function applyCsv(text, silent) {
      const previousIds = new Set(places.map((p) => p.id));
      const previousNames = new Map(places.map((p) => [p.id, p.nom]));
      parsed = parseCsv(text);
      idx = columnIndexes(parsed.header);
      if (idx.nom < 0) {
        places = [];
        setStatus("err", tr("Colonne « nom » manquante dans campus.csv"));
        refreshUi();
        syncMarkers();
        return;
      }
      lastText = text;
      places = buildPlaces(parsed, idx, overrides);
      if (selectedId && !places.some((p) => p.id === selectedId)) {
        selectedId = null;
        map.closePopup();
      }
      if (routeTo && !places.some((p) => p.id === routeTo && p.located))
        closeRoute();
      syncMarkers();
      refreshUi();

      if (!hasFitted) {
        hasFitted = true;
        fitAll(false);
      } else if (!silent) {
        const added = places.filter((p) => !previousIds.has(p.id));
        const removed = [...previousIds].filter(
          (id) => !places.some((p) => p.id === id)
        );
        const changed = places.filter(
          (p) => previousIds.has(p.id) && previousNames.get(p.id) !== p.nom
        );
        const parts = [];
        if (added.length) parts.push(`+${added.length} ${tr("ajouté(s)")}`);
        if (removed.length)
          parts.push(`−${removed.length} ${tr("supprimé(s)")}`);
        if (changed.length) parts.push(`${changed.length} ${tr("renommé(s)")}`);
        if (parts.length)
          toast(`${tr("Carte mise à jour")} : ${parts.join(", ")}`, "ok");
        // un lieu ajouté avec une position : on le montre sans bouger la vue de force
      }
    }

    async function poll() {
      if (document.hidden) return;
      try {
        const res = await fetch(CSV_URL, { cache: "no-store" });
        if (!res.ok) {
          setStatus("err", tr("data/campus.csv introuvable"));
          return;
        }
        const text = await res.text();
        if (text !== lastText) {
          if (lastText === null && parsed === null) applyCsv(text, true);
          else if (text.trim() !== "") applyCsv(text); // fichier vide = en cours d'écriture : on ignore
        }
        const now = new Date().toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setStatus("ok", `${tr("Synchronisé")} · ${now}`);
      } catch {
        setStatus("warn", tr("Hors ligne — dernier état conservé"));
      }
    }

    setStatus("warn", tr("Chargement…"));
    poll();
    setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) poll();
    });
    window.addEventListener("resize", () => map.invalidateSize());
    setTimeout(() => map.invalidateSize(), 250);
  };
})();
