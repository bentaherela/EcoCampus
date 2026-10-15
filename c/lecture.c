#include <stdio.h>
#include "gestion.h"

int chargerMesures(const char *nomFichier,
                   Mesure mesures[],
                   int capacite)
{
    FILE *f = fopen(nomFichier, "r");

    if (f == NULL) {
        printf("Erreur : impossible d'ouvrir le fichier.\n");
        return -1;
    }

    char ligne[256];
    int nombre = 0;

    // Ignorer la premiere ligne (les noms des champs)
    if (fgets(ligne, sizeof(ligne), f) == NULL) {
        fclose(f);
        return 0;
    }

    while (nombre < capacite &&
           fgets(ligne, sizeof(ligne), f) != NULL) {

        Mesure m;

        int resultat = sscanf(
            ligne,
            "%d,%49[^,],%19[^,],%f,%19[^,],%f",
            &m.id,
            m.batiment,
            m.ressource,
            &m.valeur,
            m.date_heure,
            &m.seuil
        );

        if (resultat == 6) {
            mesures[nombre] = m;
            nombre++;
        } else {
            printf("Ligne invalide : %s", ligne);
        }
    }

    fclose(f);
    return nombre;
}

void afficherMesures(const Mesure mesures[], int nombre)
{
    for (int i = 0; i < nombre; i++) {
        printf("\nID : %d\n", mesures[i].id);
        printf("Batiment : %s\n", mesures[i].batiment);
        printf("Ressource : %s\n", mesures[i].ressource);
        printf("Valeur : %.2f\n", mesures[i].valeur);
        printf("Date/heure : %s\n", mesures[i].date_heure);
        printf("Seuil : %.2f\n", mesures[i].seuil);
        printf("----------------------\n");
    }
}