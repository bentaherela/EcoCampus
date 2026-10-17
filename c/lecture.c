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

/*sauvegarde immediate dans le CSV */
int sauvegarderMesures(const char *nomFichier, const Mesure mesures[], int nombre)
{
    FILE *f = fopen(nomFichier, "w");
    if (f == NULL) {
        printf("Erreur : impossible d'ecrire dans %s.\n", nomFichier);
        return 0;
    }

    /* ligne d'en-tete, ignoree par chargerMesures */
    fprintf(f, "id,batiment,ressource,valeur,date_heure,seuil\n");

    for (int i = 0; i < nombre; i++) {
        fprintf(f, "%d,%s,%s,%.2f,%s,%.2f\n",
                mesures[i].id, mesures[i].batiment, mesures[i].ressource,
                mesures[i].valeur, mesures[i].date_heure, mesures[i].seuil);
    }

    int ok = !ferror(f);
    if (fclose(f) != 0) ok = 0;
    return ok;
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