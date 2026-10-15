# EcoCampus

Projet DSI2 (2026-2027) : suivi de la consommation des ressources (électricité, eau) par bâtiment du campus.

## Module C : traitement des données

Programme en C qui charge des mesures depuis un fichier CSV, les gère (ajout, recherche, suppression, tri), calcule des statistiques, détecte les anomalies (valeur > seuil) et génère un fichier de sortie pour le module web.

## Structure du projet

EcoCampus/
├── c/
│   ├── main.c       # programme principal (menu)
│   ├── gestion.c    # fonctions de gestion (ajout, recherche, suppression, tri)
│   ├── gestion.h    # struct Mesure et prototypes
│   └── lecture.c    # chargement du CSV et affichage
├── data/
│   ├── data.csv     # jeu de données d'entrée
│   └── data.json    # fichier de sortie généré
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
- Export du résultat dans data/data.json

## Équipe

- Asma Zaghouani
- Ela ben taher
- Raghd Boulares
- Youmna limem
- Anwar kacem
