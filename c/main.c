/* ====================================================================
   main.c : le programme principal (le menu).

   C'est ici que le programme demarre (fonction main). Il :
     1. charge les mesures depuis data/data.csv ;
     2. affiche le menu et attend le choix de l'utilisateur ;
     3. appelle la bonne fonction (afficher, ajouter, modifier...) ;
     4. recommence jusqu'au choix 0 (Quitter).

   Le menu se pilote avec les fleches haut / bas + Entree, ou en tapant le
   numero de l'option. Les vraies operations (ajout, tri, statistiques...)
   sont ecrites dans gestion.c et lecture.c : ici on gere seulement le
   dialogue avec l'utilisateur (questions, saisies, messages).
   ==================================================================== */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "gestion.h"

/* ------------------------------------------------------------------
   Le clavier ne se lit pas de la meme facon sous Windows et sous macOS /
   Linux. #ifdef _WIN32 veut dire "si on compile sous Windows". Le
   compilateur garde seulement la partie qui correspond au systeme utilise :
     - Windows       : conio.h (fonction _getch) et windows.h ;
     - macOS / Linux : termios.h (reglages du terminal) et unistd.h (read).
   ------------------------------------------------------------------ */
#ifdef _WIN32
#include <conio.h>
#include <io.h>
#include <windows.h>
#else
#include <signal.h>
#include <termios.h>
#include <unistd.h>
#endif

/* ------------------------------------------------------------------
   viderBuffer : jette tout ce qui reste dans la ligne tapee au clavier.

   Pourquoi ? Si l'utilisateur tape "abc" alors qu'on attend un nombre,
   scanf echoue et laisse "abc" dans la memoire du clavier (le buffer). Sans
   cette fonction, le scanf suivant relirait "abc" et echouerait encore, a
   l'infini. On lit donc les caracteres un par un jusqu'a la fin de ligne.
   ------------------------------------------------------------------ */
static void viderBuffer(void)
{
    int c;
    while ((c = getchar()) != '\n' && c != EOF) {
    }
}

/* ------------------------------------------------------------------
   lireLigne : lit une ligne complete tapee au clavier et enleve le '\n'
   (le retour a la ligne de la touche Entree).

   Contrairement a scanf, fgets accepte une ligne vide : on peut donc savoir
   si l'utilisateur a juste appuye sur Entree.
   Retour : 1 si une ligne a ete lue, 0 si l'entree est terminee.
   ------------------------------------------------------------------ */
static int lireLigne(char *buffer, int taille)
{
    if (fgets(buffer, taille, stdin) == NULL) {
        return 0;
    }
    size_t n = strlen(buffer);
    if (n > 0 && buffer[n - 1] == '\n') {
        buffer[n - 1] = '\0';
    } else {
        viderBuffer(); /* ligne trop longue : on ignore la suite */
    }
    return 1;
}

/* ------------------------------------------------------------------
   modifierTexte : demande la nouvelle valeur d'un champ texte.

   Affiche par exemple :  Batiment     [Residence] :
   Entre crochets, c'est la valeur actuelle. Si l'utilisateur appuie
   directement sur Entree, on garde cette valeur. Sinon on la remplace par
   ce qu'il a tape (sans les espaces de fin). strncpy copie au maximum
   taille - 1 caracteres pour ne pas deborder du champ.
   ------------------------------------------------------------------ */
static void modifierTexte(const char *libelle, char *champ, int taille)
{
    char ligne[100];
    printf("  %-12s [%s] : ", libelle, champ);
    if (!lireLigne(ligne, sizeof ligne)) {
        return;
    }
    /* supprimer les espaces en fin de saisie */
    size_t n = strlen(ligne);
    while (n > 0 && ligne[n - 1] == ' ') {
        ligne[--n] = '\0';
    }
    if (ligne[0] != '\0') {
        strncpy(champ, ligne, taille - 1);
        champ[taille - 1] = '\0';
    }
}

/* ------------------------------------------------------------------
   dateValide : verifie qu'une date est au format AAAA-MM-JJ HH:MM,
   par exemple "2026-10-07 08:15".

   C'est important car le tri par date et la tendance comparent les dates
   comme du texte : une date mal ecrite serait mal rangee.
   On verifie : 16 caracteres exactement, 5 nombres trouves par sscanf,
   mois entre 1 et 12, jour entre 1 et 31, heure entre 0 et 23, minutes
   entre 0 et 59. Retour : 1 si la date est correcte, 0 sinon.
   ------------------------------------------------------------------ */
static int dateValide(const char *d)
{
    int a, mo, j, h, mi;
    char fin;
    if (strlen(d) != 16 ||
        sscanf(d, "%4d-%2d-%2d %2d:%2d%c", &a, &mo, &j, &h, &mi, &fin) != 5) {
        return 0;
    }
    return mo >= 1 && mo <= 12 && j >= 1 && j <= 31 &&
           h >= 0 && h <= 23 && mi >= 0 && mi <= 59;
}

/* ------------------------------------------------------------------
   modifierNombre : comme modifierTexte, mais pour un nombre (valeur, seuil).

   strtof transforme le texte en nombre. Le pointeur 'fin' indique ou la
   lecture s'est arretee : si on n'a rien lu (fin == ligne) ou s'il reste
   des lettres apres le nombre ("12abc"), la saisie est refusee et
   l'ancienne valeur est gardee.
   ------------------------------------------------------------------ */
static void modifierNombre(const char *libelle, float *champ)
{
    char ligne[100];
    char *fin;
    printf("  %-12s [%.2f] : ", libelle, *champ);
    if (!lireLigne(ligne, sizeof ligne) || ligne[0] == '\0') {
        return;
    }
    float v = strtof(ligne, &fin);
    if (fin == ligne || *fin != '\0') {
        printf("  -> valeur invalide, %.2f est conservee.\n", *champ);
        return;
    }
    *champ = v;
}

/* ------------------------------------------------------------------
   afficherTitre : affiche le titre d'une action, ex : === Anomalies ===
   ------------------------------------------------------------------ */
static void afficherTitre(const char *titre)
{
    printf("\n=== %s ===\n", titre);
}

/* ====================================================================
   Menu : navigation aux fleches (haut / bas + Entree) ou par numero
   ==================================================================== */

/* ------------------------------------------------------------------
   OptionMenu : une ligne du menu.
     numero  : le numero de l'option (celui qu'on peut taper au clavier)
     section : titre de rubrique affiche juste avant l'option
               (NULL = pas de titre, "" = simple trait de separation)
     libelle : le texte de l'option
   ------------------------------------------------------------------ */
typedef struct {
    int numero;
    const char *section;  /* titre affiche avant l'option, NULL si aucun */
    const char *libelle;
} OptionMenu;

/* ------------------------------------------------------------------
   OPTIONS : la liste de toutes les options, dans l'ordre d'affichage.
   Pour ajouter une option au menu, il suffit d'ajouter une ligne ici, puis
   un "case" correspondant dans le switch de main.
   ------------------------------------------------------------------ */
static const OptionMenu OPTIONS[] = {
    { 1, "GESTION DES MESURES", "Afficher les mesures" },
    { 2, NULL,                  "Ajouter une mesure" },
    { 3, NULL,                  "Modifier une mesure (par ID)" },
    { 4, NULL,                  "Supprimer une mesure (par ID)" },
    { 5, "RECHERCHE ET TRI",    "Rechercher par batiment" },
    { 6, NULL,                  "Rechercher par ressource" },
    { 7, NULL,                  "Trier par valeur" },
    { 8, NULL,                  "Trier par date" },
    { 9, "ANALYSE",             "Statistiques par batiment / ressource" },
    { 10, NULL,                 "Anomalies (valeur > seuil)" },
    { 11, NULL,                 "Tendance (moyenne mobile)" },
    { 12, "EXPORT",             "Exporter vers data/data.json" },
    { 0, "",                    "Quitter" }  /* "" = simple separateur */
};

/* ------------------------------------------------------------------
   NB_OPTIONS : nombre d'options du menu, calcule automatiquement :
   taille totale du tableau / taille d'une case.
   ------------------------------------------------------------------ */
#define NB_OPTIONS ((int)(sizeof OPTIONS / sizeof OPTIONS[0]))

/* ------------------------------------------------------------------
   Codes qu'on donne aux touches speciales. On choisit des nombres plus
   grands que 255 pour ne jamais les confondre avec une lettre ou un chiffre.
   ------------------------------------------------------------------ */
#define TOUCHE_HAUT   1000
#define TOUCHE_BAS    1001
#define TOUCHE_ENTREE 1002

#ifdef _WIN32

/* ------------------------------------------------------------------
   activerModeTouches (version Windows) : la console Windows lit deja les
   touches une par une avec _getch. Ici on active seulement les codes
   couleur ANSI, utilises pour effacer l'ecran et surligner l'option
   choisie (Windows 10 et plus recents).
   ------------------------------------------------------------------ */
static void activerModeTouches(void)
{
    /* active les sequences ANSI (effacement, inversion video) sous Windows 10+ */
    HANDLE h = GetStdHandle(STD_OUTPUT_HANDLE);
    DWORD mode;
    if (GetConsoleMode(h, &mode)) {
        SetConsoleMode(h, mode | 0x0004 /* ENABLE_VIRTUAL_TERMINAL_PROCESSING */);
    }
}

/* ------------------------------------------------------------------
   desactiverModeTouches (version Windows) : rien a remettre en place.
   ------------------------------------------------------------------ */
static void desactiverModeTouches(void)
{
}

/* ------------------------------------------------------------------
   lireTouche (version Windows) : lit une touche sans attendre Entree.

   Les fleches envoient DEUX codes : d'abord 0 ou 224 ("touche speciale"),
   puis 72 pour la fleche haut ou 80 pour la fleche bas.
   Retour : TOUCHE_HAUT, TOUCHE_BAS, TOUCHE_ENTREE, ou le caractere tape.
   ------------------------------------------------------------------ */
static int lireTouche(void)
{
    int c = _getch();
    if (c == 0 || c == 224) {        /* touche speciale : un 2e code suit */
        c = _getch();
        if (c == 72) return TOUCHE_HAUT;
        if (c == 80) return TOUCHE_BAS;
        return -1;
    }
    if (c == '\r') return TOUCHE_ENTREE;
    return c;
}

#else

/* ------------------------------------------------------------------
   ancienTerminal : sauvegarde des reglages du terminal avant qu'on les
   change, pour pouvoir les remettre exactement comme avant.
   terminalModifie : 1 si les reglages sont changes en ce moment, sinon 0.
   ------------------------------------------------------------------ */
static struct termios ancienTerminal;
static int terminalModifie = 0;

/* ------------------------------------------------------------------
   desactiverModeTouches (version macOS / Linux) : remet le terminal en mode
   normal (on revoit ce qu'on tape, et il faut appuyer sur Entree).
   A appeler apres chaque utilisation du mode touches, sinon les saisies
   suivantes (scanf) ne s'afficheraient plus a l'ecran.
   ------------------------------------------------------------------ */
static void desactiverModeTouches(void)
{
    if (terminalModifie) {
        tcsetattr(STDIN_FILENO, TCSANOW, &ancienTerminal);
        terminalModifie = 0;
    }
}

/* ------------------------------------------------------------------
   interruption : appelee automatiquement si l'utilisateur appuie sur Ctrl+C.
   Sans elle, le programme s'arreterait en laissant le terminal dans le mode
   touches (plus rien ne s'afficherait quand on tape). On remet donc le
   terminal en etat, puis on quitte.
   ------------------------------------------------------------------ */
static void interruption(int sig)
{
    (void)sig;
    desactiverModeTouches();
    printf("\033[0m\n");
    _exit(1);
}

/* ------------------------------------------------------------------
   activerModeTouches (version macOS / Linux) : passe le terminal en mode
   "touche par touche".

   Normalement, le terminal attend la touche Entree avant de donner la ligne
   au programme (mode ICANON) et affiche ce qu'on tape (ECHO). Pour le menu,
   on veut reagir des qu'une fleche est appuyee, sans l'afficher : on
   desactive donc ICANON et ECHO. VMIN = 1 : read attend au moins 1 touche.
   ------------------------------------------------------------------ */
static void activerModeTouches(void)
{
    struct termios t;
    if (tcgetattr(STDIN_FILENO, &ancienTerminal) != 0) {
        return;
    }
    t = ancienTerminal;
    t.c_lflag &= ~(ICANON | ECHO);
    t.c_cc[VMIN] = 1;
    t.c_cc[VTIME] = 0;
    tcsetattr(STDIN_FILENO, TCSANOW, &t);
    terminalModifie = 1;
    signal(SIGINT, interruption);
}

/* ------------------------------------------------------------------
   lireTouche (version macOS / Linux) : lit une touche sans attendre Entree.

   Une fleche envoie TROIS caracteres : ESC (code 27), '[' puis 'A' pour
   haut ou 'B' pour bas. Quand on recoit ESC, on lit donc les deux suivants.
   Retour : TOUCHE_HAUT, TOUCHE_BAS, TOUCHE_ENTREE, le caractere tape,
   ou EOF si le clavier est ferme.
   ------------------------------------------------------------------ */
static int lireTouche(void)
{
    unsigned char c;
    if (read(STDIN_FILENO, &c, 1) != 1) {
        return EOF;
    }
    if (c == 27) {
        unsigned char seq[2];
        if (read(STDIN_FILENO, &seq[0], 1) != 1) return -1;
        if (read(STDIN_FILENO, &seq[1], 1) != 1) return -1;
        if (seq[0] == '[' || seq[0] == 'O') {
            if (seq[1] == 'A') return TOUCHE_HAUT;
            if (seq[1] == 'B') return TOUCHE_BAS;
        }
        return -1;
    }
    if (c == '\n' || c == '\r') return TOUCHE_ENTREE;
    return c;
}

#endif

/* ------------------------------------------------------------------
   afficherMenu : dessine le menu dans un cadre.

   selection = position de l'option surlignee (0 = la premiere).
   Avec -1, rien n'est surligne (mode ou l'on tape le numero).
   L'option choisie est ecrite en video inversee : "\033[7m" demande au
   terminal d'inverser les couleurs et "\033[0m" revient a la normale.
   ------------------------------------------------------------------ */
static void afficherMenu(int selection)
{
    printf("\n+==============================================+\n");
    printf("|        ECOCAMPUS - Suivi des consommations   |\n");
    printf("+==============================================+\n");
    for (int i = 0; i < NB_OPTIONS; i++) {
        if (OPTIONS[i].section != NULL) {
            if (OPTIONS[i].section[0] == '\0') {
                printf("+----------------------------------------------+\n");
            } else {
                printf("|  %-44s|\n", OPTIONS[i].section);
            }
        }
        if (i == selection) {
            /* \033[7m = video inversee, \033[0m = retour normal */
            printf("|\033[7m > %2d. %-38s \033[0m|\n",
                   OPTIONS[i].numero, OPTIONS[i].libelle);
        } else {
            printf("|   %2d. %-38s |\n", OPTIONS[i].numero, OPTIONS[i].libelle);
        }
    }
    printf("+==============================================+\n");
}

/* ------------------------------------------------------------------
   indiceOption : trouve la position, dans OPTIONS, de l'option qui porte ce
   numero. Exemple : le numero 0 (Quitter) est en derniere position.
   Retour : la position, ou -1 si aucune option n'a ce numero.
   ------------------------------------------------------------------ */
static int indiceOption(int numero)
{
    for (int i = 0; i < NB_OPTIONS; i++) {
        if (OPTIONS[i].numero == numero) {
            return i;
        }
    }
    return -1;
}

/* ------------------------------------------------------------------
   choisirOption : affiche le menu et laisse l'utilisateur choisir.

   Touches :
     fleche haut / bas : monte ou descend (en bas de la liste, on revient en
                         haut, et inversement : c'est le modulo %)
     Entree            : valide l'option surlignee
     chiffres          : vont directement a l'option. Pour 12, on tape 1 puis
                         2 : 'saisie' memorise les chiffres deja tapes. Si le
                         nombre obtenu n'existe pas (ex : 1 puis 3), on repart
                         du dernier chiffre seul.
   A chaque touche, on efface l'ecran ("\033[H\033[2J") et on redessine le
   menu. selection est un pointeur : la position est gardee pour la
   prochaine fois qu'on revient au menu.
   Retour : le numero de l'option choisie.
   ------------------------------------------------------------------ */
static int choisirOption(int *selection)
{
    int saisie = 0;   /* numero en cours de frappe, 0 = aucun */
    int choix = -1;

    activerModeTouches();
    while (choix < 0) {
        printf("\033[H\033[2J");  /* effacer l'ecran */
        afficherMenu(*selection);
        printf("  Fleches haut/bas : naviguer | Entree : valider\n");
        printf("  Chiffres : acces direct     | 0 : quitter\n");
        fflush(stdout);

        int t = lireTouche();
        if (t == EOF) {
            choix = 0;
        } else if (t == TOUCHE_HAUT) {
            *selection = (*selection - 1 + NB_OPTIONS) % NB_OPTIONS;
            saisie = 0;
        } else if (t == TOUCHE_BAS) {
            *selection = (*selection + 1) % NB_OPTIONS;
            saisie = 0;
        } else if (t == TOUCHE_ENTREE) {
            choix = OPTIONS[*selection].numero;
        } else if (t >= '0' && t <= '9') {
            /* ajoute le chiffre au numero en cours ; s'il n'existe pas,
               on repart du seul chiffre tape */
            int i = indiceOption(saisie * 10 + (t - '0'));
            if (saisie == 0 || i < 0) {
                saisie = t - '0';
                i = indiceOption(saisie);
            } else {
                saisie = saisie * 10 + (t - '0');
            }
            if (i >= 0) {
                *selection = i;
            }
        }
    }
    desactiverModeTouches();
    printf("\033[H\033[2J");
    return choix;
}

/* ------------------------------------------------------------------
   attendreRetourMenu : attend que l'utilisateur appuie sur une touche.
   Sans cette pause, le menu effacerait l'ecran tout de suite et on
   n'aurait pas le temps de lire le resultat de l'action.
   ------------------------------------------------------------------ */
static void attendreRetourMenu(void)
{
    printf("\nAppuyez sur une touche pour revenir au menu...");
    fflush(stdout);
    activerModeTouches();
    lireTouche();
    desactiverModeTouches();
}

/* ------------------------------------------------------------------
   synchroniser : sauvegarde les mesures dans data.csv PUIS met a jour
   data.json.

   Le site web lit data.json, le programme C lit data.csv : les deux
   fichiers doivent toujours contenir les memes mesures. On appelle donc
   cette fonction apres chaque ajout, modification ou suppression.
   Si la sauvegarde CSV echoue, on ne touche pas au JSON.
   ------------------------------------------------------------------ */
static void synchroniser(const Mesure mesures[], int nombre)
{
    if (!sauvegarderMesures("data/data.csv", mesures, nombre)) {
        return;
    }
    printf("Sauvegarde reussie (data.csv).\n");
    if (exporterJSON("data/data.json", mesures, nombre)) {
        printf("data.json mis a jour : actualisez la page web (F5).\n");
    }
}

/* ------------------------------------------------------------------
   saisirMesure : pose les questions pour une nouvelle mesure (id, batiment,
   ressource, valeur, date, seuil) et remplit la structure m.

   Dans scanf, " %49[^\n]" veut dire : ignorer les espaces du debut, puis
   lire jusqu'a la fin de la ligne (espaces compris), 49 caracteres maximum.
   Cela permet de taper un nom avec des espaces, ex : "Salle de sport".
   Retour : 1 si toutes les saisies sont correctes, 0 a la premiere erreur.
   ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------
   main : le point de depart du programme.

     1. charge les mesures du fichier CSV dans le tableau "mesures" ;
     2. regarde si on est dans un vrai terminal (isatty). Si oui : menu aux
        fleches. Si les entrees viennent d'un fichier : menu classique ou
        l'on tape le numero ;
     3. boucle "do ... while" : affiche le menu, lit le choix, puis le
        "switch" execute le "case" qui correspond au numero choisi ;
     4. s'arrete quand l'utilisateur choisit 0.
   Retour : 0 si tout va bien, 1 si le fichier CSV n'a pas pu etre ouvert.
   ------------------------------------------------------------------ */
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

    printf("EcoCampus : %d mesure(s) chargee(s) depuis data/data.csv\n", nombre);

    /* menu aux fleches dans un vrai terminal ; si l'entree est redirigee
       (fichier, pipe), on garde la saisie classique du numero */
#ifdef _WIN32
    int interactif = _isatty(_fileno(stdin));
#else
    int interactif = isatty(STDIN_FILENO);
#endif
    int selection = 0;
    int choix = -1;

    if (interactif) {
        printf("\nAppuyez sur une touche pour ouvrir le menu...");
        fflush(stdout);
        activerModeTouches();
        lireTouche();
        desactiverModeTouches();
    }

    do {
        if (interactif) {
            choix = choisirOption(&selection);
        } else {
            afficherMenu(-1);
            printf("Votre choix : ");
            if (scanf("%d", &choix) != 1) {
                printf("Entree invalide.\n");
                viderBuffer();
                if (feof(stdin)) {
                    break;
                }
                choix = -1;
                continue;
            }
        }

        switch (choix) {
            case 1:
                afficherTitre("Liste des mesures");
                afficherMesures(mesures, nombre);
                break;

            case 2: {
                afficherTitre("Ajouter une mesure");
                Mesure m;
                if (saisirMesure(&m)) {
                    if (ajouterMesure(mesures, &nombre, MAX_MESURES, m)) {
                        printf("\nMesure ajoutee. Total : %d\n", nombre);
                        /* sauvegarde immediate : CSV + JSON (pour le site web) */
                        synchroniser(mesures, nombre);
                    } else {
                        printf("\nErreur : tableau plein.\n");
                    }
                }
                break;
            }

            case 3: {
                afficherTitre("Modifier une mesure");
                int id;
                printf("ID a modifier : ");
                if (scanf("%d", &id) != 1) {
                    printf("ID invalide.\n");
                    viderBuffer();
                    break;
                }
                viderBuffer(); /* retire le '\n' avant les saisies ligne par ligne */

                int i = indiceParId(mesures, nombre, id);
                if (i < 0) {
                    printf("ID introuvable.\n");
                    break;
                }

                printf("\nMesure actuelle :\n");
                afficherMesures(&mesures[i], 1);
                printf("\nNouvelle valeur pour chaque champ (Entree = garder) :\n");

                Mesure m = mesures[i];
                modifierTexte("Batiment", m.batiment, sizeof m.batiment);
                modifierTexte("Ressource", m.ressource, sizeof m.ressource);
                modifierNombre("Valeur", &m.valeur);
                char ancienneDate[20];
                strcpy(ancienneDate, m.date_heure);
                modifierTexte("Date/heure", m.date_heure, sizeof m.date_heure);
                if (!dateValide(m.date_heure)) {
                    printf("  -> date invalide (AAAA-MM-JJ HH:MM), %s est conservee.\n",
                           ancienneDate);
                    strcpy(m.date_heure, ancienneDate);
                }
                modifierNombre("Seuil", &m.seuil);

                printf("\nApres modification :\n");
                afficherMesures(&m, 1);
                printf("Confirmer la modification ? (o/n) : ");

                char reponse[10];
                if (!lireLigne(reponse, sizeof reponse) ||
                    (reponse[0] != 'o' && reponse[0] != 'O')) {
                    printf("Modification annulee.\n");
                    break;
                }

                modifierMesure(mesures, nombre, id, m);
                printf("Mesure %d modifiee.\n", id);
                /* sauvegarde immediate : CSV + JSON (pour le site web) */
                synchroniser(mesures, nombre);
                break;
            }

            case 4: {
                afficherTitre("Supprimer une mesure");
                int id;
                printf("ID a supprimer : ");
                if (scanf("%d", &id) != 1) {
                    printf("ID invalide.\n");
                    viderBuffer();
                    break;
                }
                if (supprimerMesure(mesures, &nombre, id)) {
                    printf("Mesure supprimee. Total : %d\n", nombre);
                    /* sauvegarde immediate : CSV + JSON (pour le site web) */
                    synchroniser(mesures, nombre);
                } else {
                    printf("ID introuvable.\n");
                }
                break;
            }

            case 5: {
                afficherTitre("Recherche par batiment");
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

            case 6: {
                afficherTitre("Recherche par ressource");
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

            case 7: {
                afficherTitre("Tri par valeur");
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

            case 8: {
                afficherTitre("Tri par date");
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

            case 9: {
                afficherTitre("Statistiques par batiment et ressource");
                StatsBatiment stats[MAX_STATS];
                int nbStats = calculerStatistiques(mesures, nombre, stats, MAX_STATS);
                if (nbStats == 0) {
                    printf("Aucune mesure.\n");
                } else {
                    afficherStatistiques(stats, nbStats);
                }
                break;
            }

            case 10: {
                afficherTitre("Anomalies");
                int nb = afficherAnomalies(mesures, nombre);
                if (nb == 0) {
                    printf("Aucune anomalie detectee.\n");
                } else {
                    printf("%d anomalie(s) detectee(s).\n", nb);
                }
                break;
            }

            case 11: {
                afficherTitre("Tendance (moyenne mobile)");
                char bat[50];
                char res[20];
                printf("Batiment : ");
                if (scanf(" %49[^\n]", bat) != 1) {
                    printf("Saisie invalide.\n");
                    viderBuffer();
                    break;
                }
                printf("Ressource : ");
                if (scanf(" %19[^\n]", res) != 1) {
                    printf("Saisie invalide.\n");
                    viderBuffer();
                    break;
                }
                afficherTendance(mesures, nombre, bat, res, FENETRE_MOBILE);
                break;
            }

            case 12:
                afficherTitre("Export JSON");
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
        if (interactif && choix != 0) {
            attendreRetourMenu();
        }
    } while (choix != 0);

    return 0;
}