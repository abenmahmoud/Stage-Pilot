# Publication d'une communication dans À la une - preuve preview

## Périmètre

La recette ferme T014 avec des données strictement fictives sur la branche
Supabase de preview. Elle ne publie rien sur le domaine public, n'active aucune
variable Vercel et ne prépare aucun destinataire ni email.

## Transaction attendue

Après validation humaine, une seule transaction :

1. verrouille la communication dans son établissement ;
2. exige une racine et une version courante `approved`, publiques et datées ;
3. crée une page `site_content_items` et son instantané publié ;
4. relie la communication à cette page et passe son état à `published` ;
5. écrit l'audit éditorial et l'événement de communication ;
6. retourne uniquement l'identifiant, l'état, le slug et la date de publication.

La publication reste séparée de la diffusion. Aucune audience, livraison ou
tâche d'envoi n'est créée par ce chemin.

## Garde de la route

`POST /api/communications/admin/:id/publish` exige un compte `proviseur` ou
`superadmin` sous MFA, la confirmation exacte `PUBLIER`, les interrupteurs de
module et de publication côté serveur et base, ainsi qu'une communication
publique dont la version courante a déjà été validée. Questions ouvertes,
coordonnées, secrets, contenu trop long, publication future et contenu expiré
sont refusés avant toute écriture publique.

La réponse ne contient ni corps, ni résumé, ni acteur : seulement l'identifiant
de communication, l'état, la visibilité, le slug et la date de publication.

## Preuves attendues

`supabase/tests/communication_publication_atomicity_security.test.sql` vérifie :

- une page publique liée à sa version publiée et à la communication validée ;
- les critères réellement utilisés par l'API publique : audience `tous`, date
  atteinte, non-expiration et instantané publié ;
- exactement un audit et un événement ;
- zéro audience, livraison ou travail d'envoi ;
- l'annulation complète d'une seconde publication après une panne forcée ;
- l'absence de lecture directe des tables par `anon` et `authenticated` ;
- huit compteurs à zéro après le rollback final.

La recette a été exécutée avec succès sur `xijocumlwivhbmffrnlj`. Les huit
compteurs de résidus valent zéro après rollback. L'advisor Supabase retourne 60
informations et aucun avertissement ni erreur.

L'interrupteur de base n'est activé que dans la transaction annulée. Les
interrupteurs d'environnement restent absents et la production n'est pas
touchée.
