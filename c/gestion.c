/* ====================================================================
   gestion.c : toutes les operations sur les mesures.

   On y trouve :
     - ajouter, modifier, supprimer une mesure ;
     - rechercher par batiment ou par ressource ;
     - trier par valeur ou par date ;
     - detecter les anomalies (valeur plus grande que le seuil) ;
     - calculer les statistiques (total, moyenne, min, max) ;
     - calculer la tendance avec la moyenne mobile ;
     - exporter le tout en JSON pour le site web.

   Toutes les fonctions recoivent le tableau "mesures" et "nombre", le nombre
   de cases utilisees. Les cases au-dela de "nombre" ne contiennent rien.
   ==================================================================== */

#include "gestion.h"
#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <stdlib.h>

/* ------------------------------------------------------------------
   Prototype (annonce) : egalSansCasse est ecrite plus bas dans le fichier,
   mais ajouterMesure l'utilise avant. En C, une fonction doit etre connue
   avant d'etre utilisee, donc on l'annonce ici.
   ------------------------------------------------------------------ */
static int egalSansCasse(const char *a, const char *b);

/* ------------------------------------------------------------------
   ajouterMesure : ajoute une nouvelle mesure a la fin du tableau.

   Parametres :
     mesures        : le tableau
     nombre         : ADRESSE du nombre de mesures (un pointeur), pour que la
                      fonction puisse l'augmenter de 1
     capacite       : taille maximale du tableau
     nouvelleMesure : la mesure a ajouter

   Retour : 1 si la mesure est ajoutee, 0 si le tableau est deja plein.

   Detail : si l'utilisateur tape "cours" alors qu'il existe deja "Cours",
   on recopie l'ecriture deja connue. Sinon les statistiques compteraient
   deux batiments differents alors que c'est le meme.
   ------------------------------------------------------------------ */
int ajouterMesure(Mesure mesures[],int *nombre,int capacite,Mesure nouvelleMesure){
    if (*nombre >= capacite) {
        return 0; /* tableau plein */
    }

    /* meme batiment ecrit autrement ("cours" / "Cours") : on garde le nom
       deja utilise, sinon il serait compte comme un autre batiment */
    for (int i = 0; i < *nombre; i++) {
        if (egalSansCasse(mesures[i].batiment, nouvelleMesure.batiment)) {
            strcpy(nouvelleMesure.batiment, mesures[i].batiment);
            break;
        }
    }

    mesures[*nombre] = nouvelleMesure;
    (*nombre)++;
    return 1;
}

/* ------------------------------------------------------------------
   enMinuscules : copie le texte src dans dst en mettant tout en minuscules
   ("Cours" devient "cours"). On s'en sert pour comparer des textes sans se
   soucier des majuscules.
   taille = place disponible dans dst : on s'arrete avant de deborder.
   ------------------------------------------------------------------ */
static void enMinuscules(const char *src, char *dst, size_t taille)
{
    size_t i;
    for (i = 0; i + 1 < taille && src[i] != '\0'; i++) {
        dst[i] = (char)tolower((unsigned char)src[i]);
    }
    dst[i] = '\0';
}

/* ------------------------------------------------------------------
   supprimerEspacesFin : enleve les espaces a la fin d'un texte
   ("cours  " devient "cours"). Utile quand l'utilisateur tape un espace
   de trop sans le voir.
   ------------------------------------------------------------------ */
static void supprimerEspacesFin(char *s)
{
    size_t n = strlen(s);
    while (n > 0 && isspace((unsigned char)s[n - 1])) {
        s[--n] = '\0';
    }
}

/* ------------------------------------------------------------------
   contientTexte : dit si 'motif' se trouve quelque part dans 'texte',
   sans tenir compte des majuscules.
   Exemple : contientTexte("Bibliotheque", "biblio") retourne 1 (vrai).
   Retour : 1 si trouve, 0 sinon. (strstr cherche un texte dans un autre.)
   ------------------------------------------------------------------ */
static int contientTexte(const char *texte, const char *motif)
{
    char t[64], m[64];
    enMinuscules(texte, t, sizeof t);
    enMinuscules(motif, m, sizeof m);
    supprimerEspacesFin(m);
    return strstr(t, m) != NULL;
}

/* ------------------------------------------------------------------
   rechercherParBatiment : affiche les mesures dont le nom du batiment
   contient le texte demande (il suffit d'une partie du nom : "lab" trouve
   "Laboratoires").

   On affiche les titres du tableau seulement au premier resultat trouve,
   puis une ligne par resultat, puis le pied du tableau.
   Retour : le nombre de mesures trouvees (0 = aucun resultat).
   ------------------------------------------------------------------ */
int rechercherParBatiment(const Mesure mesures[], int nombre, const char *batiment)
{
    int trouves = 0;
    for (int i = 0; i < nombre; i++) {
        if (contientTexte(mesures[i].batiment, batiment)) {
            if (trouves == 0) {
                afficherEnTeteTableau();
            }
            afficherLigneMesure(&mesures[i]);
            trouves++;
        }
    }
    if (trouves > 0) {
        afficherPiedTableau(trouves);
    }
    return trouves;
}

/* ------------------------------------------------------------------
   rechercherParRessource : meme principe que rechercherParBatiment, mais
   on cherche dans le nom de la ressource (eau, electricite, chauffage...).
   Retour : le nombre de mesures trouvees.
   ------------------------------------------------------------------ */
int rechercherParRessource(const Mesure mesures[], int nombre, const char *ressource)
{
    int trouves = 0;
    for (int i = 0; i < nombre; i++) {
        if (contientTexte(mesures[i].ressource, ressource)) {
            if (trouves == 0) {
                afficherEnTeteTableau();
            }
            afficherLigneMesure(&mesures[i]);
            trouves++;
        }
    }
    if (trouves > 0) {
        afficherPiedTableau(trouves);
    }
    return trouves;
}

/* ------------------------------------------------------------------
   supprimerMesure : supprime la mesure qui porte l'identifiant 'id'.

   Un tableau en C ne peut pas avoir de "trou". Pour supprimer la case i,
   on decale toutes les cases suivantes d'une place vers la gauche :
       avant : [A][B][C][D]   on supprime B
       apres : [A][C][D]      et nombre passe de 4 a 3
   Retour : 1 si la mesure a ete supprimee, 0 si l'id n'existe pas.
   ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------
   indiceParId : cherche la mesure qui a l'identifiant 'id'.
   Retour : sa position (son indice) dans le tableau, ou -1 si elle n'existe
   pas. -1 est utilise car aucune case du tableau n'a un indice negatif.
   ------------------------------------------------------------------ */
int indiceParId(const Mesure mesures[], int nombre, int id)
{
    for (int i = 0; i < nombre; i++) {
        if (mesures[i].id == id) {
            return i;
        }
    }
    return -1;
}

/* ------------------------------------------------------------------
   modifierMesure : remplace la mesure 'id' par la version modifiee.

   On garde toujours l'id d'origine : l'identifiant d'une mesure ne change
   jamais. Comme pour l'ajout, un batiment deja connu garde son ecriture
   ("residence" devient "Residence" si "Residence" existe deja).
   Retour : 1 si la mesure est modifiee, 0 si l'id n'existe pas.
   ------------------------------------------------------------------ */
int modifierMesure(Mesure mesures[], int nombre, int id, Mesure nouvelle)
{
    int i = indiceParId(mesures, nombre, id);
    if (i < 0) {
        return 0; /* id introuvable */
    }

    /* meme regle qu'a l'ajout : un batiment deja connu garde son ecriture */
    for (int k = 0; k < nombre; k++) {
        if (k != i && egalSansCasse(mesures[k].batiment, nouvelle.batiment)) {
            strcpy(nouvelle.batiment, mesures[k].batiment);
            break;
        }
    }

    nouvelle.id = id;
    mesures[i] = nouvelle;
    return 1;
}

/* ------------------------------------------------------------------
   trierParValeur : range les mesures de la plus petite valeur a la plus grande
   (croissant = 1) ou de la plus grande a la plus petite (croissant = 0).

   Methode : le TRI A BULLES. On compare chaque case avec sa voisine de
   droite et on les echange si elles sont dans le mauvais ordre. A chaque
   tour, la plus grande valeur "remonte" a la fin comme une bulle. Apres
   assez de tours, tout est range.
   ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------
   trierParDate : range les mesures de la plus ancienne a la plus recente
   (croissant = 1) ou l'inverse (croissant = 0). Meme tri a bulles.

   Astuce : les dates sont ecrites "AAAA-MM-JJ HH:MM" (annee d'abord). Avec
   ce format, l'ordre alphabetique (strcmp) est aussi l'ordre chronologique :
   "2026-10-07" vient avant "2026-10-08". Pas besoin de calcul sur les dates.
   ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------
   estAnomalie : une mesure est une ANOMALIE si sa valeur depasse son seuil.
   Exemple : valeur 540 et seuil 500 : anomalie.
   Retour : 1 (vrai) si anomalie, 0 (faux) sinon.
   ------------------------------------------------------------------ */
int estAnomalie(const Mesure *m)
{
    return m->valeur > m->seuil;
}

/* ------------------------------------------------------------------
   afficherAnomalies : affiche dans un tableau seulement les mesures en
   anomalie. Retour : combien il y en a.
   ------------------------------------------------------------------ */
int afficherAnomalies(const Mesure mesures[], int nombre)
{
    int nb = 0;
    for (int i = 0; i < nombre; i++) {
        if (estAnomalie(&mesures[i])) {
            if (nb == 0) {
                afficherEnTeteTableau();
            }
            afficherLigneMesure(&mesures[i]);
            nb++;
        }
    }
    if (nb > 0) {
        afficherPiedTableau(nb);
    }
    return nb;
}

/* ====================================================================
   Statistiques par (batiment, ressource)
   ==================================================================== */

/* ------------------------------------------------------------------
   calculerStatistiques : calcule nombre, total, moyenne, min, max et nombre
   d'alertes pour chaque couple (batiment, ressource).

   Pourquoi un couple ? Parce qu'on ne peut pas additionner des kWh
   (electricite) et des m3 (eau) : ce serait comme additionner des pommes et
   des litres. Chaque groupe = un batiment + une seule ressource.

   Comment ca marche, pour chaque mesure :
     1. on cherche si son groupe existe deja dans stats[] ;
     2. sinon on cree le groupe (min et max = la premiere valeur) ;
     3. on met a jour le groupe : +1 mesure, total, min, max, alertes.
   A la fin : moyenne = total / nombre de mesures du groupe.

   Retour : le nombre de groupes crees.
   ------------------------------------------------------------------ */
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

#define LIGNE_STATS "+--------------------+--------------+------+------------+------------+------------+------------+---------+\n"

/* ------------------------------------------------------------------
   afficherStatistiques : affiche les statistiques calculees, un groupe
   (batiment + ressource) par ligne du tableau.
   ------------------------------------------------------------------ */
void afficherStatistiques(const StatsBatiment stats[], int nbStats)
{
    printf(LIGNE_STATS);
    printf("| %-18s | %-12s | %4s | %10s | %10s | %10s | %10s | %7s |\n",
           "Batiment", "Ressource", "Nb", "Total", "Moyenne", "Min", "Max", "Alertes");
    printf(LIGNE_STATS);
    for (int k = 0; k < nbStats; k++) {
        printf("| %-18.18s | %-12.12s | %4d | %10.2f | %10.2f | %10.2f | %10.2f | %7d |\n",
               stats[k].batiment, stats[k].ressource, stats[k].nb_mesures,
               stats[k].total, stats[k].moyenne, stats[k].min, stats[k].max,
               stats[k].nb_alertes);
    }
    printf(LIGNE_STATS);
}

/* ====================================================================
   Tendance (moyenne mobile)
   ==================================================================== */

/* ------------------------------------------------------------------
   moyenneMobile : moyenne des n dernieres valeurs qui se terminent a la case i.

   Exemple avec n = 2 et valeurs = [10, 20, 40] :
     i = 1 : (10 + 20) / 2 = 15
     i = 2 : (20 + 40) / 2 = 30
   La moyenne "glisse" avec le temps : elle lisse les petites variations et
   montre mieux si la consommation monte ou descend.
   Attention : il faut i >= n - 1, sinon il n'y a pas assez de valeurs avant.
   ------------------------------------------------------------------ */
float moyenneMobile(const float valeurs[], int i, int n)
{
    float somme = 0.0f;
    for (int k = i - n + 1; k <= i; k++) {
        somme += valeurs[k];
    }
    return somme / (float)n;
}

/* ------------------------------------------------------------------
   egalSansCasse : compare deux textes sans tenir compte des majuscules ni
   des espaces de fin. "Cours", "cours" et "COURS " sont consideres egaux.
   Retour : 1 si les deux textes sont egaux, 0 sinon.
   ------------------------------------------------------------------ */
static int egalSansCasse(const char *a, const char *b)
{
    char x[64], y[64];
    enMinuscules(a, x, sizeof x);
    enMinuscules(b, y, sizeof y);
    supprimerEspacesFin(x);
    supprimerEspacesFin(y);
    return strcmp(x, y) == 0;
}

/* ------------------------------------------------------------------
   preparerSerie : prepare les donnees de la tendance d'un couple
   (batiment, ressource).

   Etapes :
     1. on garde seulement les mesures du batiment et de la ressource voulus ;
     2. on les range par date (tri a bulles) ;
     3. on recopie leurs valeurs dans valeurs[], dans l'ordre des dates.

   Detail important : on trie les INDICES (les numeros de case, idx[]) et non
   les mesures elles-memes. Ainsi le tableau d'origine n'est pas modifie :
   idx[0] = numero de case de la mesure la plus ancienne, etc.
   Retour : le nombre de mesures trouvees pour ce couple.
   ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------
   conclureTendance : decide si la consommation est en hausse, en baisse ou
   stable.

   On compare la PREMIERE moyenne mobile et la DERNIERE :
     - si la derniere est plus grande de plus de 5 %  : "hausse"
     - si elle est plus petite de plus de 5 %         : "baisse"
     - sinon (petite difference)                      : "stable"
   La marge de 5 % evite de crier "hausse" pour une toute petite variation.
   Il faut au moins fenetre + 1 valeurs pour avoir deux moyennes a comparer,
   sinon on retourne "indeterminee".
   premiere et derniere sont des pointeurs : la fonction y ecrit les deux
   moyennes pour que l'appelant puisse les afficher.
   ------------------------------------------------------------------ */
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
 
/* ------------------------------------------------------------------
   afficherTendance : affiche la tendance d'un batiment pour une ressource.

   Affiche un tableau avec, pour chaque date : la valeur et la moyenne mobile
   ("-" tant qu'il n'y a pas assez de valeurs pour la calculer). Puis affiche
   la conclusion : HAUSSE, BAISSE ou STABLE.
   Retour : le nombre de mesures du couple (0 si aucune).
   ------------------------------------------------------------------ */
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
    printf("+------------------+------------+--------------+\n");
    printf("| %-16s | %10s | %12s |\n", "Date/heure", "Valeur", "Moy. mobile");
    printf("+------------------+------------+--------------+\n");
 
    for (int i = 0; i < nb; i++) {
        if (i >= fenetre - 1) {
            float mm = moyenneMobile(valeurs, i, fenetre);
            printf("| %-16.16s | %10.2f | %12.2f |\n",
                   mesures[idx[i]].date_heure, valeurs[i], mm);
        } else {
            /* pas encore assez de valeurs pour une moyenne */
            printf("| %-16.16s | %10.2f | %12s |\n",
                   mesures[idx[i]].date_heure, valeurs[i], "-");
        }
    }
 
    printf("+------------------+------------+--------------+\n");

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
 
/* ------------------------------------------------------------------
   ecrireChaineJSON : ecrit un texte entre guillemets dans le fichier JSON.

   Si le texte contient lui-meme un guillemet " ou un antislash \, il faut
   les "echapper" (mettre un \ devant), sinon le fichier JSON serait casse
   et le site web ne pourrait plus le lire.
   ------------------------------------------------------------------ */
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
 
/* ------------------------------------------------------------------
   ecrireTendancesJSON : ecrit la partie "tendances" du fichier JSON.

   Une entree par groupe (batiment, ressource) avec : la conclusion (hausse,
   baisse, stable), les deux moyennes comparees, et la liste des points
   (date, valeur, moyenne mobile). Le site web s'en sert pour les graphiques.
   "null" en JSON veut dire "pas de valeur" (pas assez de mesures).
   ------------------------------------------------------------------ */
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
 
/* ------------------------------------------------------------------
   lireSectionBatiments : recupere la partie "batiments" de l'ancien fichier
   JSON, pour la recopier telle quelle dans le nouveau.

   Pourquoi ? Cette partie est remplie par le site web (pas par le C). Si on
   ne la recopiait pas, chaque export du C l'effacerait.

   Comment : on lit tout le fichier en memoire (malloc), on cherche
   "batiments": puis on avance jusqu'au ] qui ferme le tableau. On compte
   les [ et les ] (profondeur) pour ne pas s'arreter sur un tableau qui
   serait a l'interieur, et on ignore ce qui est entre guillemets.
   Retour : le texte trouve (a liberer avec free apres usage), ou NULL.
   ------------------------------------------------------------------ */
static char *lireSectionBatiments(const char *nomFichier)
{
    FILE *f = fopen(nomFichier, "rb");
    if (f == NULL) {
        return NULL;
    }

    fseek(f, 0, SEEK_END);
    long taille = ftell(f);
    rewind(f);

    char *texte = (taille >= 0) ? malloc((size_t)taille + 1) : NULL;
    if (texte == NULL) {
        fclose(f);
        return NULL;
    }
    texte[fread(texte, 1, (size_t)taille, f)] = '\0';
    fclose(f);

    char *debut = strstr(texte, "\"batiments\":");
    debut = (debut != NULL) ? strchr(debut, '[') : NULL;
    if (debut == NULL) {
        free(texte);
        return NULL;
    }

    /* chercher le ] qui ferme le tableau, en ignorant le contenu des chaines */
    int profondeur = 0;
    int dansChaine = 0;
    char *p;
    for (p = debut; *p != '\0'; p++) {
        if (dansChaine) {
            if (*p == '\\' && p[1] != '\0') p++;
            else if (*p == '"') dansChaine = 0;
        } else if (*p == '"') {
            dansChaine = 1;
        } else if (*p == '[') {
            profondeur++;
        } else if (*p == ']' && --profondeur == 0) {
            break;
        }
    }
    if (*p == '\0') {   /* tableau jamais ferme : fichier invalide */
        free(texte);
        return NULL;
    }

    p[1] = '\0';
    memmove(texte, debut, strlen(debut) + 1);
    return texte;
}

/* ------------------------------------------------------------------
   exporterJSON : cree le fichier data/data.json lu par le site web.

   Le fichier contient, dans l'ordre :
     - "resume"       : nombre de mesures, d'alertes et de groupes ;
     - "batiments"    : recopie de l'ancien fichier (voir lireSectionBatiments) ;
     - "mesures"      : toutes les mesures, avec "alerte" true / false ;
     - "statistiques" : les statistiques par (batiment, ressource) ;
     - "tendances"    : les moyennes mobiles et leurs conclusions.

   Attention a l'ordre : on lit "batiments" AVANT d'ouvrir le fichier en
   ecriture, car fopen(..., "w") vide le fichier tout de suite.
   Retour : 1 si l'export a reussi, 0 sinon.
   ------------------------------------------------------------------ */
int exporterJSON(const char *nomFichier, const Mesure mesures[], int nombre)
{
    StatsBatiment stats[MAX_STATS];
    int nbStats = calculerStatistiques(mesures, nombre, stats, MAX_STATS);
    int nbAlertes = 0;

    for (int i = 0; i < nombre; i++) {
        if (estAnomalie(&mesures[i])) nbAlertes++;
    }

    /* a lire AVANT fopen("w"), qui vide le fichier */
    char *batiments = lireSectionBatiments(nomFichier);

    FILE *f = fopen(nomFichier, "w");
    if (f == NULL) {
        printf("Erreur : impossible de creer le fichier %s.\n", nomFichier);
        free(batiments);
        return 0;
    }
 
    fprintf(f, "{\n");
 
    /* --- resume --- */
    fprintf(f, "  \"resume\": {\n");
    fprintf(f, "    \"nb_mesures\": %d,\n", nombre);
    fprintf(f, "    \"nb_alertes\": %d,\n", nbAlertes);
    fprintf(f, "    \"nb_groupes\": %d\n", nbStats);
    fprintf(f, "  },\n");

    /* --- batiments (conserves depuis l'ancien fichier) --- */
    if (batiments != NULL) {
        fprintf(f, "  \"batiments\": %s,\n", batiments);
        free(batiments);
    }

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