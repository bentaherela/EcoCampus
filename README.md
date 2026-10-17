# EcoCampus

Projet DSI2 (2026-2027) : suivi de la consommation des ressources (électricité, eau) par bâtiment du campus.

## Module C : traitement des données

Programme en C qui charge des mesures depuis un fichier CSV, les gère (ajout, recherche, suppression, tri), calcule des statistiques, détecte les anomalies (valeur > seuil) et génère un fichier de sortie pour le module web.

## Structure du projet

EcoCampus/
├── c/
│ ├── main.c # programme principal (menu)
│ ├── gestion.c # fonctions de gestion (ajout, recherche, suppression, tri)
│ ├── gestion.h # struct Mesure et prototypes
│ └── lecture.c # chargement du CSV et affichage
├── data/
│ ├── data.csv # jeu de données d'entrée
│ └── data.json # fichier de sortie généré
└── README.md

## Format du fichier d'entrée

Fichier CSV avec une ligne d'en-tête :

id,batiment,ressource,valeur,date_heure,seuil
1,Cours,electricite,1250,2026-10-07 08:15,2000

## Compilation

Depuis la racine du projet (nécessite GCC) :

gcc -Wall c/main.c c/gestion.c c/lecture.c -o ecocampus.exe

## Exécution

Toujours depuis la racine du projet (le chemin data/data.csv est relatif) :

./ecocampus.exe

## Fonctionnalités

- Chargement et affichage des mesures
- Ajout d'une mesure
- Recherche par bâtiment ou par ressource
- Suppression d'une mesure par id
- Tri par valeur ou par date (croissant/décroissant)
- Statistiques par bâtiment et détection des anomalies
- Tendance par moyenne mobile (menu 11) : pour un couple (bâtiment, ressource),les mesures sont classées par date, la moyenne mobile est calculée sur `FENETRE_MOBILE` valeurs (2 par défaut, défini dans `gestion.h`), puis on compare la première et la dernière moyenne : variation de moins de 5 % = STABLE, sinon HAUSSE ou BAISSE. Il faut au moins `fenêtre + 1` mesures pour conclure.
- Export du résultat dans data/data.json (mesures, statistiques, résumé et tendances)

- Export du résultat dans data/data.json

## Format du fichier de sortie (data.json)
 
Le fichier contient quatre sections : `resume`, `mesures`, `statistiques` et `tendances`.
 
La section `tendances` contient une entrée par couple (bâtiment, ressource) :
 
```json
{
  "batiment": "Cours",
  "ressource": "electricite",
  "fenetre": 2,
  "nb_mesures": 3,
  "tendance": "hausse",
  "premiere_moyenne": 1225.00,
  "derniere_moyenne": 1400.00,
  "points": [
    {"date_heure": "2026-10-07 08:15", "valeur": 1250.00, "moyenne_mobile": null},
    {"date_heure": "2026-10-08 08:15", "valeur": 1200.00, "moyenne_mobile": 1225.00}
  ]
}
```
 
- `tendance` vaut `"hausse"`, `"baisse"`, `"stable"` ou `"indeterminee"` (pas assez de mesures).
- `moyenne_mobile` vaut `null` tant qu'il n'y a pas assez de valeurs pour la calculer ; `premiere_moyenne` et `derniere_moyenne` valent `null` si la tendance est indéterminée.

## Équipe

- Asma Zaghouani
- Ela ben taher
- Raghd Boulares
- Youmna limem
- Anwar kacem
