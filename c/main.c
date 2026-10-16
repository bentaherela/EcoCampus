#include <stdio.h>
#include "gestion.h"

/* Vide le buffer d'entree apres une saisie invalide */
static void viderBuffer(void)
{
    int c;
    while ((c = getchar()) != '\n' && c != EOF) {
    }
}

/* Saisie d'une mesure au clavier. Retourne 1 si OK, 0 sinon */
static int saisirMesure(Mesure *m)
{
    printf("ID : ");
    if (scanf("%d", &m->id) != 1) {
        printf("Erreur : ID invalide.\n");
        viderBuffer();
        return 0;
    }

    printf("Batiment : ");
    if (scanf(" %49[^\n]", m->batiment) != 1) {
        printf("Erreur : batiment invalide.\n");
        viderBuffer();
        return 0;
    }

    printf("Ressource (electricite, eau...) : ");
    if (scanf(" %19[^\n]", m->ressource) != 1) {
        printf("Erreur : ressource invalide.\n");
        viderBuffer();
        return 0;
    }

    printf("Valeur : ");
    if (scanf("%f", &m->valeur) != 1) {
        printf("Erreur : valeur invalide.\n");
        viderBuffer();
        return 0;
    }

    printf("Date et heure (AAAA-MM-JJ HH:MM) : ");
    if (scanf(" %19[^\n]", m->date_heure) != 1) {
        printf("Erreur : date invalide.\n");
        viderBuffer();
        return 0;
    }

    printf("Seuil : ");
    if (scanf("%f", &m->seuil) != 1) {
        printf("Erreur : seuil invalide.\n");
        viderBuffer();
        return 0;
    }

    return 1;
}

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

    int choix = -1;

    do {
        printf("\n===== MENU =====\n");
        printf("1. Afficher les mesures\n");
        printf("2. Ajouter une mesure\n");
        printf("3. Rechercher par batiment\n");
        printf("4. Rechercher par ressource\n");
        printf("5. Supprimer une mesure (par ID)\n");
        printf("6. Trier par valeur\n");
        printf("7. Trier par date\n");
        printf("8. Statistiques par batiment et ressource\n");
        printf("9. Afficher les anomalies\n");
        printf("10. Exporter vers data/data.json\n");
        printf("0. Quitter\n");
        printf("Choix : ");

        if (scanf("%d", &choix) != 1) {
            printf("Entree invalide.\n");
            viderBuffer();
            choix = -1;
            continue;
        }

        switch (choix) {
            case 1:
                afficherMesures(mesures, nombre);
                break;

            case 2: {
                Mesure m;
                printf("\n=== Ajouter une mesure ===\n");
                if (saisirMesure(&m)) {
                    if (ajouterMesure(mesures, &nombre, MAX_MESURES, m)) {
                        printf("\nMesure ajoutee. Total : %d\n", nombre);
                        /* sauvegarde immediate dans le CSV : l'ajout
                           survivra a la fermeture du programme */
                        if (sauvegarderMesures("data/data.csv", mesures, nombre)) {
                        printf("Sauvegarde reussie.\n");
                        }
                        
                    } else {
                        printf("\nErreur : tableau plein.\n");
                    }
                }
                break;
            }

            case 3: {
                char nom[50];
                printf("Batiment : ");
                if (scanf(" %49[^\n]", nom) != 1) {
                    printf("Saisie invalide.\n");
                    viderBuffer();
                    break;
                }
                if (rechercherParBatiment(mesures, nombre, nom) == 0) {
                    printf("Aucun resultat.\n");
                }
                break;
            }

            case 4: {
                char res[20];
                printf("Ressource : ");
                if (scanf(" %19[^\n]", res) != 1) {
                    printf("Saisie invalide.\n");
                    viderBuffer();
                    break;
                }
                if (rechercherParRessource(mesures, nombre, res) == 0) {
                    printf("Aucun resultat.\n");
                }
                break;
            }

            case 5: {
                int id;
                printf("ID a supprimer : ");
                if (scanf("%d", &id) != 1) {
                    printf("ID invalide.\n");
                    viderBuffer();
                    break;
                }
                if (supprimerMesure(mesures, &nombre, id)) {
                    printf("Mesure supprimee. Total : %d\n", nombre);
                } else {
                    printf("ID introuvable.\n");
                }
                break;
            }

            case 6: {
                int ordre;
                printf("1 = croissant, 0 = decroissant : ");
                if (scanf("%d", &ordre) != 1) {
                    printf("Saisie invalide.\n");
                    viderBuffer();
                    break;
                }
                trierParValeur(mesures, nombre, ordre);
                afficherMesures(mesures, nombre);
                break;
            }

            case 7: {
                int ordre;
                printf("1 = croissant, 0 = decroissant : ");
                if (scanf("%d", &ordre) != 1) {
                    printf("Saisie invalide.\n");
                    viderBuffer();
                    break;
                }
                trierParDate(mesures, nombre, ordre);
                afficherMesures(mesures, nombre);
                break;
            }

            case 8: {
                StatsBatiment stats[MAX_STATS];
                int nbStats = calculerStatistiques(mesures, nombre, stats, MAX_STATS);
                if (nbStats == 0) {
                    printf("Aucune mesure.\n");
                } else {
                    afficherStatistiques(stats, nbStats);
                }
                break;
            }

            case 9: {
                int nb = afficherAnomalies(mesures, nombre);
                if (nb == 0) {
                    printf("Aucune anomalie detectee.\n");
                } else {
                    printf("%d anomalie(s) detectee(s).\n", nb);
                }
                break;
            }

            case 10:
                if (exporterJSON("data/data.json", mesures, nombre)) {
                    printf("Export reussi : data/data.json\n");
                }
                break;

            case 0:
                printf("Au revoir.\n");
                break;

            default:
                printf("Choix invalide.\n");
        }
    } while (choix != 0);

    return 0;
}