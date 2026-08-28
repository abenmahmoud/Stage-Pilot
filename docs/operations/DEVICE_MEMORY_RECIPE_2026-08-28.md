# Recette de la memoire appareil - 28 aout 2026

## Perimetre

Cette recette couvre la reprise d'une demande publique inachevee sur le meme
navigateur. Elle ne valide ni les emails entrants, ni le SMS, ni une bascule du
site de production.

## Verification realisee

1. Ouverture du formulaire classique dans un contexte navigateur isole.
2. Saisie d'un profil parent, d'une categorie ordinateur, de coordonnees
   fictives en `example.com` et d'une description fictive.
3. Attente de l'enregistrement IndexedDB puis inspection de la structure.
4. Rechargement complet sans cache.
5. Verification de la restauration des champs et de la meme cle d'idempotence.
6. Verification a 390 x 844 avec emulation tactile et recherche de debordement.
7. Audit Lighthouse mobile et inspection de la console.

## Resultats

- brouillon restaure apres rechargement ;
- cle d'idempotence identique avant et apres ;
- aucun objet fichier, mot de passe, cookie ou jeton brut dans l'enregistrement ;
- largeur du document egale a la largeur mobile, hors honeypot volontairement
  place hors ecran ;
- aucune erreur ni alerte dans la console ;
- Lighthouse : accessibilite 100, bonnes pratiques 100, SEO 100.

## Garanties et limites

- La retention locale est bornee a 30 jours et a 100 numeros publics.
- Les pieces jointes ne sont pas conservees localement et doivent etre choisies
  a nouveau apres une interruption.
- La liste locale n'accorde aucun acces : le contenu du dossier exige toujours
  le cookie HttpOnly ou un nouveau lien securise.
- IndexedDB est une aide de resilience. Si le navigateur le bloque, la creation
  et le suivi serveur continuent de fonctionner.
