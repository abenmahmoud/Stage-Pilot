# Routes privées de boîte d'échec - 30 août 2026

## Lecture

`GET /api/communications/admin/failures` est réservé à la direction sous MFA.
Il retourne cent lignes au maximum : titre, version, type, essais, code fermé et
date. La route n'importe pas le modèle de livraison. Aucun contact, HMAC ou
identifiant fournisseur n'est sélectionné.

## Reprise

`POST /api/communications/admin/failures/:id/retry` exige :

- direction nominative sous MFA ;
- module et envoi activés globalement et pour l'établissement ;
- corps exact `{ "operatorConfirmedReady": true }` ;
- secret serveur de reprise fort ;
- politique et transaction de reprise à nouveau validées sous verrou.

Un double clic renvoie un résultat idempotent sans deuxième travail.

## État actuel

Les interrupteurs et le secret ne sont pas activés. Aucune reprise n'est donc
possible sur la preview distante avant décision et recette contrôlée.

## Interface

La direction dispose d'une liste responsive avec motif français, essais et date.
La reprise demande deux clics distincts : `Cause corrigée`, puis
`Confirmer la reprise`. Aucun identifiant technique ou état de livraison n'est
affiché.
