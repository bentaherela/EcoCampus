#include "gestion.h"
 
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
 