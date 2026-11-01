/* ====================================================================
   lecture.c : lecture, ecriture et affichage des mesures.

   Ce fichier s'occupe de trois choses :
     1. LIRE le fichier data/data.csv et remplir le tableau des mesures ;
     2. ECRIRE le tableau dans data/data.csv (sauvegarde) ;
     3. AFFICHER les mesures a l'ecran sous forme de tableau.

   Rappel : un fichier CSV est un simple fichier texte ou chaque ligne est
   une mesure et ou les champs sont separes par des virgules, par exemple :
       4,Residence,eau,540.00,2026-10-07 07:00,500.00
       (id, batiment, ressource, valeur, date et heure, seuil)
   ==================================================================== */

#include <stdio.h>
#include "gestion.h"

/* ------------------------------------------------------------------
   chargerMesures : lit le fichier CSV et range chaque ligne dans le tableau.

   Parametres :
     nomFichier : chemin du fichier a lire (ex : "data/data.csv")
     mesures    : le tableau a remplir
     capacite   : nombre maximum de cases du tableau (on ne depasse jamais)

   Retour : le nombre de mesures lues, ou -1 si le fichier n'existe pas.

   Comment ca marche :
     - on ouvre le fichier en lecture ("r" = read) ;
     - on saute la 1ere ligne, qui contient seulement les noms des colonnes ;
     - pour chaque ligne suivante, sscanf decoupe le texte aux virgules et
       met chaque morceau dans le bon champ de la structure Mesure ;
     - si sscanf n'a pas trouve les 6 champs, la ligne est abimee : on
       l'affiche et on l'ignore au lieu de planter.
   ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------
   sauvegarderMesures : ecrit TOUTES les mesures du tableau dans le fichier CSV.

   Attention : le mode "w" (write) efface l'ancien contenu du fichier, puis
   on reecrit tout : la ligne des noms de colonnes, puis une ligne par mesure.
   On l'appelle apres chaque ajout, modification ou suppression pour que le
   fichier soit toujours a jour.

   Retour : 1 si tout s'est bien passe, 0 en cas d'erreur (disque plein,
   fichier protege...).
   ------------------------------------------------------------------ */
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

/* Largeurs : | ID | Batiment | Ressource | Valeur | Seuil | Date/heure | Etat | */
#define LIGNE_TABLEAU "+------+--------------------+--------------+------------+------------+------------------+---------+\n"

/* ------------------------------------------------------------------
   afficherEnTeteTableau : affiche le haut du tableau (les titres des colonnes)
   entoure de deux lignes de separation.

   Le "%-18s" de printf veut dire : "ecris le texte sur 18 caracteres, cale a
   gauche". Comme chaque colonne a toujours la meme largeur, les lignes du
   tableau sont bien alignees les unes sous les autres.
   ------------------------------------------------------------------ */
void afficherEnTeteTableau(void)
{
    printf(LIGNE_TABLEAU);
    printf("| %4s | %-18s | %-12s | %10s | %10s | %-16s | %-7s |\n",
           "ID", "Batiment", "Ressource", "Valeur", "Seuil", "Date/heure", "Etat");
    printf(LIGNE_TABLEAU);
}

/* ------------------------------------------------------------------
   afficherLigneMesure : affiche UNE mesure sur une ligne du tableau.

   La colonne "Etat" vaut "ALERTE" si la valeur depasse le seuil, sinon "OK".
   "%-18.18s" coupe aussi les textes trop longs a 18 caracteres, pour ne pas
   casser l'alignement du tableau.
   ------------------------------------------------------------------ */
void afficherLigneMesure(const Mesure *m)
{
    printf("| %4d | %-18.18s | %-12.12s | %10.2f | %10.2f | %-16.16s | %-7s |\n",
           m->id, m->batiment, m->ressource, m->valeur, m->seuil,
           m->date_heure, estAnomalie(m) ? "ALERTE" : "OK");
}

/* ------------------------------------------------------------------
   afficherPiedTableau : ferme le tableau et affiche le nombre de lignes.
   ------------------------------------------------------------------ */
void afficherPiedTableau(int nombre)
{
    printf(LIGNE_TABLEAU);
    printf("  %d mesure(s)\n", nombre);
}

/* ------------------------------------------------------------------
   afficherMesures : affiche un tableau complet (titres, lignes, total).

   Parametres : le tableau de mesures et le nombre de mesures a afficher.
   Astuce : afficherMesures(&mesures[i], 1) affiche une seule mesure, car
   &mesures[i] est l'adresse de la case i, vue comme un tableau de 1 case.
   ------------------------------------------------------------------ */
void afficherMesures(const Mesure mesures[], int nombre)
{
    if (nombre == 0) {
        printf("Aucune mesure.\n");
        return;
    }
    afficherEnTeteTableau();
    for (int i = 0; i < nombre; i++) {
        afficherLigneMesure(&mesures[i]);
    }
    afficherPiedTableau(nombre);
}