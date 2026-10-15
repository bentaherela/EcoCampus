#ifndef GESTION_H
#define GESTION_H

#define MAX_MESURES 1000

typedef struct {
    int id;
    char batiment[50];
    char ressource[20];
    float valeur;
    char date_heure[20];
    float seuil;
} Mesure;

int chargerMesures(const char *nomFichier,
                   Mesure mesures[],
                   int capacite);

void afficherMesures(const Mesure mesures[], int nombre);

int ajouterMesure(Mesure mesures[],
                  int *nombre,
                  int capacite,
                  Mesure nouvelleMesure);
/* Recherche : affiche les mesures correspondantes, retourne leur nombre */
int rechercherParBatiment(const Mesure mesures[], int nombre, const char *batiment);
int rechercherParRessource(const Mesure mesures[], int nombre, const char *ressource);

/* Suppression par id : retourne 1 si supprimee, 0 si id introuvable */
int supprimerMesure(Mesure mesures[], int *nombre, int id);

/* Tri : croissant = 1 (ordre croissant) ou 0 (decroissant) */
void trierParValeur(Mesure mesures[], int nombre, int croissant);
void trierParDate(Mesure mesures[], int nombre, int croissant);

/* ---------- Statistiques ---------- */
#define MAX_STATS 100

/* Statistiques pour un couple (batiment, ressource).
   On ne melange pas electricite (kWh) et eau (m3) dans un meme total. */
typedef struct {
    char batiment[50];
    char ressource[20];
    int nb_mesures;
    int nb_alertes;
    float total;
    float moyenne;
    float min;
    float max;
} StatsBatiment;

/* Anomalie : 1 si valeur > seuil, 0 sinon */
int estAnomalie(const Mesure *m);

/* Calcule les stats par (batiment, ressource) dans stats[].
   Retourne le nombre de groupes calcules. */
int calculerStatistiques(const Mesure mesures[], int nombre,
                         StatsBatiment stats[], int capacite);
void afficherStatistiques(const StatsBatiment stats[], int nbStats);

/* Affiche les mesures en anomalie, retourne leur nombre */
int afficherAnomalies(const Mesure mesures[], int nombre);

/* ---------- Export ---------- */
/* Ecrit le fichier JSON (mesures + alerte, statistiques, resume).
   Retourne 1 si OK, 0 si erreur. */
int exporterJSON(const char *nomFichier, const Mesure mesures[], int nombre);

#endif