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

**Une seule fois** : page *Données* → « 📁 Connecter le dossier data » → choisir le dossier `data` du projet. Ensuite, chaque **ajout, modification ou suppression** (mesure ou bâtiment) est enregistré immédiatement dans `data/data.json` **et** `data/data.csv`, dans le même format que le module C. Si l'écriture échoue, le changement est annulé à l'écran.

Le bouton **Exporter** (page Données) réécrit `data/data.csv` et `data/data.json` (toutes les mesures, même format que le module C) en remplaçant les anciens fichiers. Si le dossier n'est pas connecté, les deux fichiers sont téléchargés à la place.

> Si le dossier n'est pas connecté (ou avec Firefox/Safari), les modifications restent dans le navigateur (localStorage) et ne touchent pas `data/` : utilisez « Télécharger data.json + data.csv ».

## Format de data.json

Sections : `resume`, `batiments` (ajoutée par le site : type, étages, surface), `mesures`, `statistiques`, `tendances`.

```json
{"batiment": "Cours", "ressource": "electricite", "fenetre": 2, "nb_mesures": 6,
 "tendance": "hausse", "premiere_moyenne": 1570.00, "derniere_moyenne": 2200.00,
 "points": [{"date_heure": "2026-10-07 08:15", "valeur": 1250.00, "moyenne_mobile": null}]}
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