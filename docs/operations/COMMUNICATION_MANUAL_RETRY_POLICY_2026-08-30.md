# Reprise manuelle des communications - 30 août 2026

## Objectif

T020B définit une reprise humaine sûre avant d'ouvrir une route ou une boîte
d'échec. La reprise ne réécrit jamais le travail mort : elle crée un successeur
idempotent et conserve l'incident d'origine pour l'audit.

## Autorisation

- uniquement `superadmin` ou `proviseur` ;
- session `aal2` obligatoire ;
- travail d'origine obligatoirement `dead` ;
- confirmation explicite que la cause a été examinée et corrigée ;
- aucune adresse, corps de message ou prose fournisseur dans la décision.

## Refus sûrs

- une portée invalide, un contenu absent ou un rejet fournisseur exige une
  nouvelle version ou une correction du contact ;
- une livraison envoyée, livrée, rejetée, désinscrite ou annulée n'est pas
  relancée ;
- un travail d'envoi, de reprise ou d'annulation sans état de livraison est
  refusé ;
- un travail en attente, en cours, déjà repris ou annulé n'est jamais dupliqué.

## Successeur

Le nouveau travail repart à zéro et immédiatement. Un envoi devient
`retry_delivery`; les autres types conservent leur fonction. Sa clé
d'idempotence est un HMAC cloisonné par établissement et par travail mort. Un
double clic produit donc la même clé, tandis que l'échec d'un successeur pourra
faire l'objet d'une nouvelle décision indépendante.

## Limites

La transaction atomique, la route, la boîte d'échec et la recette de concurrence
sur la preview restent à construire. Aucun travail distant, email, base ou
environnement de production n'a été modifié.
