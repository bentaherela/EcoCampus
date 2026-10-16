#include "gestion.h"
#include <stdio.h>
#include <string.h>
#include <ctype.h>
 
int ajouterMesure(Mesure mesures[],int *nombre,int capacite,Mesure nouvelleMesure){
    if (*nombre >= capacite) {
        return 0; /* tableau plein */
    }
 
    mesures[*nombre] = nouvelleMesure;
    (*nombre)++;
    return 1;
}

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
        if (contientTexte(mesures[i].ressource, ressource)) {
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

/* ====================================================================
   Detection d'anomalies
   ==================================================================== */

/* Une mesure est une anomalie si sa valeur depasse strictement son seuil */
int estAnomalie(const Mesure *m)
{
    return m->valeur > m->seuil;
}

int afficherAnomalies(const Mesure mesures[], int nombre)
{
    int nb = 0;
    for (int i = 0; i < nombre; i++) {
        if (estAnomalie(&mesures[i])) {
            printf("[ALERTE] ID %d | %s | %s | valeur %.2f > seuil %.2f | %s\n",
                   mesures[i].id, mesures[i].batiment, mesures[i].ressource,
                   mesures[i].valeur, mesures[i].seuil, mesures[i].date_heure);
            nb++;
        }
    }
    return nb;
}

/* ====================================================================
   Statistiques par (batiment, ressource)
   ==================================================================== */

int calculerStatistiques(const Mesure mesures[], int nombre,
                         StatsBatiment stats[], int capacite)
{
    int nbStats = 0;

    for (int i = 0; i < nombre; i++) {
        /* chercher le groupe (batiment, ressource) deja cree */
        int g = -1;
        for (int k = 0; k < nbStats; k++) {
            if (strcmp(stats[k].batiment, mesures[i].batiment) == 0 &&
                strcmp(stats[k].ressource, mesures[i].ressource) == 0) {
                g = k;
                break;
            }
        }

        /* sinon, creer un nouveau groupe */
        if (g == -1) {
            if (nbStats >= capacite) {
                printf("Attention : trop de groupes, mesure ID %d ignoree.\n",
                       mesures[i].id);
                continue;
            }
            g = nbStats++;
            strcpy(stats[g].batiment, mesures[i].batiment);
            strcpy(stats[g].ressource, mesures[i].ressource);
            stats[g].nb_mesures = 0;
            stats[g].nb_alertes = 0;
            stats[g].total = 0.0f;
            stats[g].moyenne = 0.0f;
            stats[g].min = mesures[i].valeur;
            stats[g].max = mesures[i].valeur;
        }

        /* mise a jour du groupe */
        stats[g].nb_mesures++;
        stats[g].total += mesures[i].valeur;
        if (mesures[i].valeur < stats[g].min) stats[g].min = mesures[i].valeur;
        if (mesures[i].valeur > stats[g].max) stats[g].max = mesures[i].valeur;
        if (estAnomalie(&mesures[i])) stats[g].nb_alertes++;
    }

    /* moyennes (nb_mesures >= 1 pour tout groupe cree) */
    for (int k = 0; k < nbStats; k++) {
        stats[k].moyenne = stats[k].total / (float)stats[k].nb_mesures;
    }
    return nbStats;
}

void afficherStatistiques(const StatsBatiment stats[], int nbStats)
{
    printf("\n%-20s %-12s %5s %10s %10s %10s %10s %7s\n",
           "Batiment", "Ressource", "Nb", "Total", "Moyenne", "Min", "Max", "Alertes");
    for (int k = 0; k < nbStats; k++) {
        printf("%-20s %-12s %5d %10.2f %10.2f %10.2f %10.2f %7d\n",
               stats[k].batiment, stats[k].ressource, stats[k].nb_mesures,
               stats[k].total, stats[k].moyenne, stats[k].min, stats[k].max,
               stats[k].nb_alertes);
    }
}

/* ====================================================================
   Export JSON
   ==================================================================== */

/* Ecrit une chaine entre guillemets en echappant " \ et les caracteres de controle */
static void ecrireChaineJSON(FILE *f, const char *s)
{
    fputc('"', f);
    for (; *s != '\0'; s++) {
        unsigned char c = (unsigned char)*s;
        if (c == '"' || c == '\\') {
            fputc('\\', f);
            fputc(c, f);
        } else if (c < 0x20) {
            fprintf(f, "\\u%04x", c);
        } else {
            fputc(c, f);
        }
    }
    fputc('"', f);
}

int exporterJSON(const char *nomFichier, const Mesure mesures[], int nombre)
{
    StatsBatiment stats[MAX_STATS];
    int nbStats = calculerStatistiques(mesures, nombre, stats, MAX_STATS);
    int nbAlertes = 0;

    for (int i = 0; i < nombre; i++) {
        if (estAnomalie(&mesures[i])) nbAlertes++;
    }

    FILE *f = fopen(nomFichier, "w");
    if (f == NULL) {
        printf("Erreur : impossible de creer le fichier %s.\n", nomFichier);
        return 0;
    }

    fprintf(f, "{\n");

    /* --- resume --- */
    fprintf(f, "  \"resume\": {\n");
    fprintf(f, "    \"nb_mesures\": %d,\n", nombre);
    fprintf(f, "    \"nb_alertes\": %d,\n", nbAlertes);
    fprintf(f, "    \"nb_groupes\": %d\n", nbStats);
    fprintf(f, "  },\n");

    /* --- mesures --- */
    fprintf(f, "  \"mesures\": [\n");
    for (int i = 0; i < nombre; i++) {
        fprintf(f, "    {\"id\": %d, \"batiment\": ", mesures[i].id);
        ecrireChaineJSON(f, mesures[i].batiment);
        fprintf(f, ", \"ressource\": ");
        ecrireChaineJSON(f, mesures[i].ressource);
        fprintf(f, ", \"valeur\": %.2f, \"date_heure\": ", mesures[i].valeur);
        ecrireChaineJSON(f, mesures[i].date_heure);
        fprintf(f, ", \"seuil\": %.2f, \"alerte\": %s}%s\n",
                mesures[i].seuil,
                estAnomalie(&mesures[i]) ? "true" : "false",
                (i < nombre - 1) ? "," : "");
    }
    fprintf(f, "  ],\n");

    /* --- statistiques --- */
    fprintf(f, "  \"statistiques\": [\n");
    for (int k = 0; k < nbStats; k++) {
        fprintf(f, "    {\"batiment\": ");
        ecrireChaineJSON(f, stats[k].batiment);
        fprintf(f, ", \"ressource\": ");
        ecrireChaineJSON(f, stats[k].ressource);
        fprintf(f, ", \"nb_mesures\": %d, \"total\": %.2f, \"moyenne\": %.2f, "
                   "\"min\": %.2f, \"max\": %.2f, \"nb_alertes\": %d}%s\n",
                stats[k].nb_mesures, stats[k].total, stats[k].moyenne,
                stats[k].min, stats[k].max, stats[k].nb_alertes,
                (k < nbStats - 1) ? "," : "");
    }
    fprintf(f, "  ]\n");

    fprintf(f, "}\n");

    int ok = !ferror(f);
    if (fclose(f) != 0) ok = 0;
    if (!ok) {
        printf("Erreur : ecriture incomplete de %s.\n", nomFichier);
    }
    return ok;
}
