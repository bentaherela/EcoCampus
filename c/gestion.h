
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

#endif
