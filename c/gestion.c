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

/* Supprime les espaces en fin de chaine (ex : "cours " devient "cours") */
static void supprimerEspacesFin(char *s)
{
    size_t n = strlen(s);
    while (n > 0 && isspace((unsigned char)s[n - 1])) {
        s[--n] = '\0';
    }
}

/* Retourne 1 si 'texte' contient 'motif', sans tenir compte de la casse */
static int contientTexte(const char *texte, const char *motif)
{
    char t[64], m[64];
    enMinuscules(texte, t, sizeof t);
    enMinuscules(motif, m, sizeof m);
    supprimerEspacesFin(m);
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
   Tendance (moyenne mobile)
   ==================================================================== */
   /* Moyenne des n valeurs se terminant a l'indice i
   (valeurs[i-n+1] ... valeurs[i]).
   A appeler seulement si i >= n - 1, sinon il n'y a pas assez de valeurs. */
float moyenneMobile(const float valeurs[], int i, int n)
{
    float somme = 0.0f;
    for (int k = i - n + 1; k <= i; k++) {
        somme += valeurs[k];
    }
    return somme / (float)n;
}

/* Retourne 1 si a et b sont egales, sans tenir compte de la casse */
static int egalSansCasse(const char *a, const char *b)
{
    char x[64], y[64];
    enMinuscules(a, x, sizeof x);
    enMinuscules(b, y, sizeof y);
    supprimerEspacesFin(x);
    supprimerEspacesFin(y);
    return strcmp(x, y) == 0;
}

/* Selectionne les mesures du couple (batiment, ressource), les classe par date
   et remplit idx[] (indices dans mesures[]) et valeurs[] (valeurs triees).
   Le tableau d'origine n'est pas modifie. Retourne le nombre de mesures.
   idx et valeurs doivent avoir MAX_MESURES elements. */
static int preparerSerie(const Mesure mesures[], int nombre,
                         const char *batiment, const char *ressource,
                         int idx[], float valeurs[])
{
    int nb = 0;

    /* 1. selectionner les mesures du couple demande */
    for (int i = 0; i < nombre; i++) {
        if (egalSansCasse(mesures[i].batiment, batiment) &&
            egalSansCasse(mesures[i].ressource, ressource)) {
            idx[nb++] = i;
        }
    }

    /* 2. trier les INDICES par date (tri a bulles) */
    for (int i = 0; i < nb - 1; i++) {
        for (int j = 0; j < nb - 1 - i; j++) {
            if (strcmp(mesures[idx[j]].date_heure,
                       mesures[idx[j + 1]].date_heure) > 0) {
                int tmp = idx[j];
                idx[j] = idx[j + 1];
                idx[j + 1] = tmp;
            }
        }
    }

    /* 3. recopier les valeurs dans l'ordre chronologique */
    for (int i = 0; i < nb; i++) {
        valeurs[i] = mesures[idx[i]].valeur;
    }
    return nb;
}
/* Conclusion sur la tendance : compare la premiere et la derniere moyenne
   mobile. Variation de moins de 5 % = stable.
   Retourne "hausse", "baisse", "stable" ou "indeterminee" (il faut au moins
   fenetre + 1 valeurs). premiere et derniere sont remplies si determinee. */
static const char *conclureTendance(const float valeurs[], int nb, int fenetre,
                                    float *premiere, float *derniere)
{
    if (fenetre < 1 || nb <= fenetre) {
        return "indeterminee";
    }
 
    *premiere = moyenneMobile(valeurs, fenetre - 1, fenetre);
    *derniere = moyenneMobile(valeurs, nb - 1, fenetre);
 
    float diff = *derniere - *premiere;
    float marge = 0.05f * (*premiere < 0 ? -*premiere : *premiere);
 
    if (diff > marge) return "hausse";
    if (diff < -marge) return "baisse";
    return "stable";
}
 
/* Affiche la moyenne mobile d'un couple (batiment, ressource) puis conclut
   sur la tendance. On ne melange pas les ressources (kWh et m3).
   Retourne le nombre de mesures du couple. */
int afficherTendance(const Mesure mesures[], int nombre,
                     const char *batiment, const char *ressource, int fenetre)
{
    int idx[MAX_MESURES];        /* indices des mesures du couple dans mesures[] */
    float valeurs[MAX_MESURES];  /* leurs valeurs, classees par date */
 
    if (fenetre < 1) {
        return 0;
    }
 
    int nb = preparerSerie(mesures, nombre, batiment, ressource, idx, valeurs);
 
    if (nb == 0) {
        printf("Aucune mesure pour ce batiment et cette ressource.\n");
        return 0;
    }
    if (nb < fenetre) {
        printf("Pas assez de mesures (%d) pour une moyenne mobile sur %d valeurs.\n",
               nb, fenetre);
        return nb;
    }
 
    /* 4. afficher les valeurs et leur moyenne mobile */
    printf("\nTendance : %s - %s (moyenne mobile sur %d valeurs)\n",
           batiment, ressource, fenetre);
    printf("%-18s %10s %12s\n", "Date/heure", "Valeur", "Moy. mobile");
 
    for (int i = 0; i < nb; i++) {
        if (i >= fenetre - 1) {
            float mm = moyenneMobile(valeurs, i, fenetre);
            printf("%-18s %10.2f %12.2f\n",
                   mesures[idx[i]].date_heure, valeurs[i], mm);
        } else {
            /* pas encore assez de valeurs pour une moyenne */
            printf("%-18s %10.2f %12s\n",
                   mesures[idx[i]].date_heure, valeurs[i], "-");
        }
    }
 
    /* 5. conclusion : on compare la premiere et la derniere moyenne mobile */
    float premiere = 0.0f, derniere = 0.0f;
    const char *conclusion = conclureTendance(valeurs, nb, fenetre,
                                              &premiere, &derniere);
 
    if (strcmp(conclusion, "indeterminee") == 0) {
        /* une seule moyenne mobile : il n'y a rien a comparer */
        printf("Tendance : impossible a determiner (il faut au moins %d mesures).\n",
               fenetre + 1);
    } else if (strcmp(conclusion, "hausse") == 0) {
        printf("Tendance : HAUSSE (%.2f -> %.2f)\n", premiere, derniere);
    } else if (strcmp(conclusion, "baisse") == 0) {
        printf("Tendance : BAISSE (%.2f -> %.2f)\n", premiere, derniere);
    } else {
        printf("Tendance : STABLE (%.2f -> %.2f)\n", premiere, derniere);
    }
    return nb;
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
 
/* Ecrit le tableau "tendances" : une entree par groupe (batiment, ressource)
   avec les points (valeur + moyenne mobile) et la conclusion.
   moyenne_mobile vaut null tant qu'il n'y a pas assez de valeurs. */
static void ecrireTendancesJSON(FILE *f, const Mesure mesures[], int nombre,
                                const StatsBatiment stats[], int nbStats)
{
    int idx[MAX_MESURES];
    float valeurs[MAX_MESURES];
    int fenetre = FENETRE_MOBILE;
 
    fprintf(f, "  \"tendances\": [\n");
    for (int k = 0; k < nbStats; k++) {
        int nb = preparerSerie(mesures, nombre, stats[k].batiment,
                               stats[k].ressource, idx, valeurs);
        float premiere = 0.0f, derniere = 0.0f;
        const char *conclusion = conclureTendance(valeurs, nb, fenetre,
                                                  &premiere, &derniere);
        int determinee = (strcmp(conclusion, "indeterminee") != 0);
 
        fprintf(f, "    {\"batiment\": ");
        ecrireChaineJSON(f, stats[k].batiment);
        fprintf(f, ", \"ressource\": ");
        ecrireChaineJSON(f, stats[k].ressource);
        fprintf(f, ", \"fenetre\": %d, \"nb_mesures\": %d, \"tendance\": \"%s\", ",
                fenetre, nb, conclusion);
        if (determinee) {
            fprintf(f, "\"premiere_moyenne\": %.2f, \"derniere_moyenne\": %.2f, ",
                    premiere, derniere);
        } else {
            fprintf(f, "\"premiere_moyenne\": null, \"derniere_moyenne\": null, ");
        }
 
        fprintf(f, "\"points\": [");
        for (int i = 0; i < nb; i++) {
            fprintf(f, "{\"date_heure\": ");
            ecrireChaineJSON(f, mesures[idx[i]].date_heure);
            fprintf(f, ", \"valeur\": %.2f, \"moyenne_mobile\": ", valeurs[i]);
            if (i >= fenetre - 1) {
                fprintf(f, "%.2f", moyenneMobile(valeurs, i, fenetre));
            } else {
                fprintf(f, "null");
            }
            fprintf(f, "}%s", (i < nb - 1) ? ", " : "");
        }
        fprintf(f, "]}%s\n", (k < nbStats - 1) ? "," : "");
    }
    fprintf(f, "  ]\n");
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
    fprintf(f, "  ],\n");
 
    /* --- tendances (moyenne mobile) --- */
    ecrireTendancesJSON(f, mesures, nombre, stats, nbStats);
 
    fprintf(f, "}\n");
 
    int ok = !ferror(f);
    if (fclose(f) != 0) ok = 0;
    if (!ok) {
        printf("Erreur : ecriture incomplete de %s.\n", nomFichier);
    }
    return ok;
}