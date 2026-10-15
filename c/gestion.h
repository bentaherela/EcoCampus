
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

#endif
