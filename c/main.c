#include <stdio.h>
#include "gestion.h"

int main(void)
{
    Mesure mesures[MAX_MESURES];

    int nombre = chargerMesures(
        "data/data.csv",
        mesures,
        MAX_MESURES
    );

    if (nombre < 0) {
        return 1;
    }

    printf("Nombre de mesures chargees : %d\n", nombre);

    /* --- Ajout d'une nouvelle mesure saisie au clavier --- */
    Mesure m;

    /*printf("\n=== Ajouter une mesure ===\n");

    printf("ID : ");
    if (scanf("%d", &m.id) != 1) {
        printf("Erreur : ID invalide.\n");
        return 1;
    }

    printf("Batiment : ");
    if (scanf(" %49[^\n]", m.batiment) != 1) {
        printf("Erreur : batiment invalide.\n");
        return 1;
    }

    printf("Ressource (electricite, eau...) : ");
    if (scanf(" %19[^\n]", m.ressource) != 1) {
        printf("Erreur : ressource invalide.\n");
        return 1;
    }

    printf("Valeur : ");
    if (scanf("%f", &m.valeur) != 1) {
        printf("Erreur : valeur invalide.\n");
        return 1;
    }

    printf("Date et heure (AAAA-MM-JJ HH:MM) : ");
    if (scanf(" %19[^\n]", m.date_heure) != 1) {
        printf("Erreur : date invalide.\n");
        return 1;
    }

    printf("Seuil : ");
    if (scanf("%f", &m.seuil) != 1) {
        printf("Erreur : seuil invalide.\n");
        return 1;
    }

    if (ajouterMesure(mesures, &nombre, MAX_MESURES, m)) {
        printf("\nMesure ajoutee. Total : %d\n", nombre);
    } else {
        printf("\nErreur : tableau plein.\n");
    }*/

    afficherMesures(mesures, nombre);

    return 0;
}