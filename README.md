# EcoCampus

Projet DSI2 (2026-2027) : suivi de la consommation des ressources (électricité, eau, chauffage) par bâtiment du campus.

## Structure du projet

```
EcoCampus/
├── c/
│   ├── main.c        # programme principal (menu)
│   ├── gestion.c     # ajout, recherche, suppression, tri, stats, tendances, export JSON
│   ├── gestion.h     # struct Mesure et prototypes
│   └── lecture.c     # chargement / sauvegarde du CSV et affichage
├── data/
│   ├── data.csv      # données d'entrée (lues par le module C)
│   └── data.json     # données lues par le site web
├── css/style.css
├── js/script.js      # logique du site
├── pages/            # donnees, graphique, batiment, detail, parametres, login
├── index.html        # tableau de bord
└── README.md
```

## Module C : traitement des données

Compilation (depuis la racine, GCC requis) :

```
gcc -Wall c/main.c c/gestion.c c/lecture.c -o ecocampus.exe
./ecocampus.exe
```

Fonctionnalités : chargement/affichage, ajout, recherche par bâtiment ou ressource, suppression par id, tri par valeur ou date, statistiques, anomalies (valeur > seuil), tendance par moyenne mobile (menu 11, fenêtre `FENETRE_MOBILE` = 2, variation < 5 % = stable), export `data/data.json`.

## Module Web : lancement

Ouvrir le site avec un serveur local (extension **Live Server** de VS Code) dans **Chrome ou Edge** (compte par défaut : `admin` / `ecocampus2026`).

**Une seule fois** : page _Données_ → « 📁 Connecter le dossier data » → choisir le dossier `data` du projet. Ensuite, chaque **ajout, modification ou suppression** (mesure ou bâtiment — page _Bâtiments_ : boutons Nouveau, Modifier et Supprimer) est enregistré immédiatement dans `data/data.json` **et** `data/data.csv`, dans le même format que le module C. Si l'écriture échoue, le changement est annulé à l'écran.

Le bouton **Exporter** (page Données) réécrit `data/data.csv` et `data/data.json` (toutes les mesures, même format que le module C) en remplaçant les anciens fichiers. Si le dossier n'est pas connecté, les deux fichiers sont téléchargés à la place.

> Si le dossier n'est pas connecté (ou avec Firefox/Safari), les modifications restent dans le navigateur (localStorage) et ne touchent pas `data/` : utilisez « Télécharger data.json + data.csv ».

## Format de data.json

Sections : `resume`, `batiments` (ajoutée par le site : type, étages, surface), `mesures`, `statistiques`, `tendances`.

```json
{
  "batiment": "Cours",
  "ressource": "electricite",
  "fenetre": 2,
  "nb_mesures": 6,
  "tendance": "hausse",
  "premiere_moyenne": 1570.0,
  "derniere_moyenne": 2200.0,
  "points": [
    {
      "date_heure": "2026-10-07 08:15",
      "valeur": 1250.0,
      "moyenne_mobile": null
    }
  ]
}
```

- `tendance` : `"hausse"`, `"baisse"`, `"stable"` ou `"indeterminee"` (pas assez de mesures).
- `moyenne_mobile`, `premiere_moyenne`, `derniere_moyenne` valent `null` s'il n'y a pas assez de valeurs.
- Le module C ne connaît pas la section `batiments` : elle disparaît si vous ré-exportez depuis le C.

## Équipe

- Asma Zaghouani
- Ela ben taher
- Raghd Boulares
- Youmna limem
- Anwar kacem

## Changement de langue (français / arabe / anglais)

- `js/i18n.js` : moteur (icône de traduction, mémorisation dans `localStorage`
  sous la clé `ecocampus-lang`, sens RTL/LTR sur `<html dir>`, traduction du DOM).
- `js/i18n-dict.js` : dictionnaire. Une ligne = `["français", "anglais", "arabe"]`,
  avec `{0}`, `{1}`… pour les parties variables. Pour traduire une nouvelle
  phrase, il suffit d'ajouter une ligne.
- Les deux fichiers sont chargés dans le `<head>` de chaque page, avant `script.js`.
- La langue survit à l'actualisation, à la déconnexion et à « Tout réinitialiser ».
- L'export PDF est en français ou en anglais (jsPDF n'a pas de police arabe).

## Photo de profil et logo

- Page Mon profil : carte « Photo de profil » (importer, modifier, supprimer).
  Formats JPG / PNG / WebP, 2 Mo maximum, 64 × 64 px minimum ; la photo est
  recadrée en carré (256 × 256) et enregistrée dans le compte (`localStorage`,
  clé `ecocampus-users`, champ `photo`). Sans photo : l'initiale du nom.
- Logo : `images/logo.svg` (+ `logo.png`, `favicon.png`, `apple-touch-icon.png`),
  utilisé comme icône d'onglet et dans le menu de gauche.

## Carte interactive du campus

Page `pages/carte.html` (menu **Carte**) : carte réelle (OpenStreetMap, vue satellite en option), fiche de chaque lieu au clic, recherche (nom, catégorie, service, description), filtres par catégorie, itinéraire à pied (depuis « Ma position » ou un autre bâtiment).

- Les lieux sont lus dans **`data/campus.csv`** et relus toutes les 3 secondes : ajouter, modifier ou supprimer une ligne met la carte à jour **sans recharger la page** (indicateur « Synchronisé » en haut).
- Colonnes : `id,nom,categorie,latitude,longitude,description,horaires,telephone,services,batiment,source`
  - `latitude` / `longitude` : degrés décimaux (ex. `36.806500`, la virgule décimale est acceptée). **Une ligne sans coordonnées n'est pas placée sur la carte** : elle reste dans la liste, avec un bouton « Placer sur la carte ».
  - `services` : plusieurs valeurs séparées par `|` (ex. `wifi|impression`), utilisées par la recherche.
  - `batiment` : nom du bâtiment EcoCampus (colonne `batiment` de `data.csv`) pour afficher le lien « Consommation » et les étages / surface.
  - Séparateur `,` ou `;` détecté automatiquement. Les catégories sont libres (couleur et icône automatiques pour enseignement, résidence, administration, bibliothèque, restauration, sport, santé, parking, services).
- « Placer sur la carte » : cliquer sur l'emplacement exact ; la position est écrite dans `data/campus.csv` si le dossier `data` est connecté (page Données), sinon le fichier mis à jour est téléchargé.
- Bibliothèques externes : Leaflet 1.9.4 (unpkg), tuiles OpenStreetMap / Esri, itinéraires routing.openstreetmap.de (Internet requis).
- Campus : Campus Universitaire de Menzel Abderrahmane (Bizerte). `data/campus.csv` contient les établissements dont la position a été relevée sur OpenStreetMap / Wikidata (colonne `source`) ; le Restaurant Universitaire n'a pas de position vérifiée : à placer sur la carte satellite. La vue satellite (Esri) est la vue par défaut.
- Ce fichier est indépendant de `data.csv` : le module C n'est pas affecté.

### Carte : fiche et filtres

- **Fiche d'un lieu** (clic sur un marqueur) : nom, type (sigle du nom — ISET, ENIB, ISG… — sinon catégorie), adresse, téléphone, horaires, services et description lus dans `data/campus.csv`. Aucune donnée de consommation n'est affichée sur la carte.
- **Deux filtres** : _Tous les établissements_ (catégories Enseignement, Administration, Technopôle…) et _Équipements et services_ (toutes les autres catégories : Restauration, Parking, Espace vert, Point d'eau, Résidence…). La liste `ESTABLISHMENT_CATEGORIES` en tête de `js/carte.js` définit ce qui est un établissement.
- Pour afficher des parkings, espaces verts ou points d'eau : ajouter des lignes dans `data/campus.csv` (catégorie `Parking`, `Espace vert`, `Point d'eau`, avec latitude / longitude relevées).
- Colonne facultative `localisation` (ou `adresse`) de `campus.csv` : adresse affichée dans la fiche (à défaut, le campus de Menzel Abderrahmane et les coordonnées).
