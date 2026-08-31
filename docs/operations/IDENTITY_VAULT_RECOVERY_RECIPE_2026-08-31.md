# Restauration locale du coffre d'identités

## Périmètre

- Exécution locale uniquement, sans Supabase, Vercel, VPS ou service distant.
- Trois identités et un document entièrement fictifs.
- Aucune clé, identité, coordonnée ou donnée de production.
- Lot borné à 250 lignes et à un seul établissement/import.

## Recette vérifiée

1. Chiffrer les identités fictives avec deux versions de clé du coffre.
2. Vérifier chaque enveloppe et produire seulement un compte, les versions de
   clé et une empreinte SHA-256 agrégée.
3. Emballer l'artefact de base chiffré et un document Storage fictif dans un
   paquet AES-256-GCM protégé par une clé de sauvegarde distincte.
4. Confirmer que le paquet public n'expose ni chemin, contenu ou identité.
5. Restaurer le paquet, valider son schéma exact et retrouver la même empreinte.
6. Rechiffrer toutes les enveloppes `v1` et `v2` vers `v3` avec de nouveaux
   nonces.
7. Revérifier le lot avec seulement la clé `v3`, puis confirmer que `v1` et
   `v2` peuvent être retirées logiquement.

Commande locale :

```powershell
npm run test:identity-vault-recovery
```

## Cas fermés

La recette refuse une clé manquante, une ligne contenant un champ clair
supplémentaire, un identifiant dupliqué, un mauvais périmètre, une enveloppe
altérée, un lot vide ou hors limite et un mauvais secret de sauvegarde.

## Preuve minimale

Le résultat ne contient que le nombre d'enveloppes vérifiées, leur répartition
par version de clé et une empreinte SHA-256 indépendante de l'ordre de lecture.
Le clair est déchiffré en mémoire pour validation puis immédiatement abandonné ;
il n'est ni journalisé ni inclus dans la preuve.

## Limites avant usage réel

- Restaurer un paquet fictif sur une cible distante isolée et explicitement
  autorisée.
- Tester l'atomicité de la rotation distante, son audit et le retour arrière.
- Faire valider la rétention, la garde des clés, la séparation des rôles et la
  procédure d'incident par la Direction et le DPO.
- Obtenir une validation écrite avant le retrait matériel d'une ancienne clé.

Cette recette n'autorise aucune donnée réelle et ne déclenche aucune opération
sur la production.
