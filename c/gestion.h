/* ====================================================================
   gestion.h : le "sommaire" du projet.

   Un fichier .h (header) ne contient pas le code des fonctions : il
   annonce seulement ce qui existe (les structures et les fonctions) pour
   que main.c, gestion.c et lecture.c puissent s'en servir. Le vrai code
   est dans gestion.c et lecture.c.
   ==================================================================== */

/* Protection contre la double inclusion : si ce fichier est inclus deux
   fois, la deuxieme fois GESTION_H existe deja et tout est ignore. */
#ifndef GESTION_H
#define GESTION_H

/* Nombre maximum de mesures que le programme peut garder en memoire */
#define MAX_MESURES 1000

/* Une MESURE = un releve de consommation, c'est-a-dire une ligne du CSV.
   Exemple : 4,Residence,eau,540.00,2026-10-07 07:00,500.00 */
typedef struct {
    int id;               /* numero unique de la mesure (ex : 4) */
    char batiment[50];    /* nom du batiment (ex : "Residence") */
    char ressource[20];   /* ce qui est mesure : eau, electricite... */
    float valeur;         /* quantite consommee (kWh, m3...) */
    char date_heure[20];  /* date du releve : "AAAA-MM-JJ HH:MM" */
    float seuil;          /* limite a ne pas depasser : au-dessus = alerte */
} Mesure;

/* ---------- Lecture, sauvegarde et affichage (lecture.c) ---------- */

/* Lit le fichier CSV dans mesures[]. Retourne le nombre de mesures lues,
   ou -1 si le fichier ne peut pas etre ouvert. */

int chargerMesures(const char *nomFichier,
                   Mesure mesures[],
                   int capacite);

/* Affiche les mesures sous forme de tableau */
void afficherMesures(const Mesure mesures[], int nombre);

/* Affichage en tableau : en-tete, une ligne par mesure, pied (avec total) */
void afficherEnTeteTableau(void);
void afficherLigneMesure(const Mesure *m);
void afficherPiedTableau(int nombre);

/* ---------- Gestion des mesures (gestion.c) ---------- */

/* Ajoute une mesure a la fin. Retourne 1 si OK, 0 si le tableau est plein */
int ajouterMesure(Mesure mesures[],
                  int *nombre,
                  int capacite,
                  Mesure nouvelleMesure);

/* Sauvegarde : reecrit toutes les mesures dans le fichier CSV.
   Retourne 1 si OK, 0 si erreur. */
int sauvegarderMesures(const char *nomFichier,
                       const Mesure mesures[],
                       int nombre);

/* Recherche : affiche les mesures correspondantes, retourne leur nombre */
int rechercherParBatiment(const Mesure mesures[], int nombre, const char *batiment);
int rechercherParRessource(const Mesure mesures[], int nombre, const char *ressource);

/* Suppression par id : retourne 1 si supprimee, 0 si id introuvable */
int supprimerMesure(Mesure mesures[], int *nombre, int id);

/* Indice de la mesure d'id donne dans mesures[], -1 si introuvable */
int indiceParId(const Mesure mesures[], int nombre, int id);

/* Modification : remplace la mesure d'id donne par nouvelle (l'id est garde).
   Retourne 1 si modifiee, 0 si id introuvable. */
int modifierMesure(Mesure mesures[], int nombre, int id, Mesure nouvelle);

/* Tri : croissant = 1 (ordre croissant) ou 0 (decroissant) */
void trierParValeur(Mesure mesures[], int nombre, int croissant);
void trierParDate(Mesure mesures[], int nombre, int croissant);

/* ---------- Statistiques ---------- */
/* Nombre maximum de groupes (batiment, ressource) pour les statistiques */
#define MAX_STATS 100

/* Statistiques pour un couple (batiment, ressource).
   On ne melange pas electricite (kWh) et eau (m3) dans un meme total. */
typedef struct {
    char batiment[50];    /* le batiment du groupe */
    char ressource[20];   /* la ressource du groupe */
    int nb_mesures;       /* combien de mesures dans ce groupe */
    int nb_alertes;       /* combien de ces mesures depassent le seuil */
    float total;          /* somme des valeurs */
    float moyenne;        /* total / nb_mesures */
    float min;            /* plus petite valeur */
    float max;            /* plus grande valeur */
} StatsBatiment;

/* Anomalie : 1 si valeur > seuil, 0 sinon */
int estAnomalie(const Mesure *m);

/* Calcule les stats par (batiment, ressource) dans stats[].
   Retourne le nombre de groupes calcules. */
int calculerStatistiques(const Mesure mesures[], int nombre,
                         StatsBatiment stats[], int capacite);
void afficherStatistiques(const StatsBatiment stats[], int nbStats);

/* Moyenne des n valeurs se terminant a l'indice i */
float moyenneMobile(const float valeurs[], int i, int n);

/* Nombre de valeurs utilisees pour la moyenne mobile */
#define FENETRE_MOBILE 2
 
/* Affiche la moyenne mobile et la tendance (hausse / baisse / stable)
   d'un couple (batiment, ressource), mesures classees par date.
   Retourne le nombre de mesures du couple (0 si aucune). */
int afficherTendance(const Mesure mesures[], int nombre,
                     const char *batiment, const char *ressource, int fenetre);

/* Affiche les mesures en anomalie, retourne leur nombre */
int afficherAnomalies(const Mesure mesures[], int nombre);

/* ---------- Export ---------- */
/* Ecrit le fichier JSON (mesures + alerte, statistiques, resume).
   La section "batiments" du fichier existant est conservee.
   Retourne 1 si OK, 0 si erreur. */
int exporterJSON(const char *nomFichier, const Mesure mesures[], int nombre);

#endif /* GESTION_H */