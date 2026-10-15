#include "gestion.h"
#include <stdio.h>
#include <string.h>
#include <ctype.h>
 
int ajouterMesure(Mesure mesures[],
                  int *nombre,
                  int capacite,
                  Mesure nouvelleMesure)
{
    if (*nombre >= capacite) {
        return 0; /* tableau plein */
    }
 
    mesures[*nombre] = nouvelleMesure;
    (*nombre)++;
    return 1;
}
/* ... ajouterMesure existante ... */
/* Copie src dans dst en minuscules */
static void enMinuscules(const char *src, char *dst, size_t taille)
{
    size_t i;
    for (i = 0; i + 1 < taille && src[i] != '\0'; i++) {
        dst[i] = (char)tolower((unsigned char)src[i]);
    }
    dst[i] = '\0';
}

/* Retourne 1 si 'texte' contient 'motif', sans tenir compte de la casse */
static int contientTexte(const char *texte, const char *motif)
{
    char t[64], m[64];
    enMinuscules(texte, t, sizeof t);
    enMinuscules(motif, m, sizeof m);
    return strstr(t, m) != NULL;
}
int rechercherParBatiment(const Mesure mesures[], int nombre, const char *batiment)
{
    int trouves = 0;
    for (int i = 0; i < nombre; i++) {
        if (contientTexte(mesures[i].batiment, batiment)) {
            afficherMesures(&mesures[i], 1);   /* reutilise l'affichage existant */
            trouves++;
        }
    }
    return trouves;
}

int rechercherParRessource(const Mesure mesures[], int nombre, const char *ressource)
{
    int trouves = 0;
    for (int i = 0; i < nombre; i++) {
        if (contientTexte(mesures[i].ressource, ressource)) {5
            afficherMesures(&mesures[i], 1);
            trouves++;
        }
    }
    return trouves;
}

int supprimerMesure(Mesure mesures[], int *nombre, int id)
{
    for (int i = 0; i < *nombre; i++) {
        if (mesures[i].id == id) {
            /* decaler tous les elements suivants vers la gauche */
            for (int j = i; j < *nombre - 1; j++) {
                mesures[j] = mesures[j + 1];
            }
            (*nombre)--;
            return 1;
        }
    }
    return 0; /* id introuvable */
}

void trierParValeur(Mesure mesures[], int nombre, int croissant)
{
    for (int i = 0; i < nombre - 1; i++) {
        for (int j = 0; j < nombre - 1 - i; j++) {
            int echanger = croissant
                ? (mesures[j].valeur > mesures[j + 1].valeur)
                : (mesures[j].valeur < mesures[j + 1].valeur);
            if (echanger) {
                Mesure tmp = mesures[j];
                mesures[j] = mesures[j + 1];
                mesures[j + 1] = tmp;
            }
        }
    }
}

void trierParDate(Mesure mesures[], int nombre, int croissant)
{
    /* le format AAAA-MM-JJ HH:MM se compare correctement avec strcmp */
    for (int i = 0; i < nombre - 1; i++) {
        for (int j = 0; j < nombre - 1 - i; j++) {
            int cmp = strcmp(mesures[j].date_heure, mesures[j + 1].date_heure);
            int echanger = croissant ? (cmp > 0) : (cmp < 0);
            if (echanger) {
                Mesure tmp = mesures[j];
                mesures[j] = mesures[j + 1];
                mesures[j + 1] = tmp;
            }
        }
    }
}
 