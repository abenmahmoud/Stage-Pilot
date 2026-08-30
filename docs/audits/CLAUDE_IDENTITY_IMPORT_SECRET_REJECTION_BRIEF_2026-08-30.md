# Brief Claude - refus des secrets dans les annuaires

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise.

## Mission proposée

Effectuer une revue de sécurité en lecture seule du refus des secrets dans les
annuaires CSV/XLSX. Rechercher les contournements, faux positifs dangereux,
fuites dans les erreurs et chemins qui produiraient une empreinte ou une charge
chiffrée avant le refus.

## Périmètre minimal

- `workers/identity-directory-parser.mjs`
- `workers/knowledge-document-secret-policy.mjs`
- `workers/identity-directory-worker.mjs`
- `scripts/test-identity-directory-parser.mjs`
- `scripts/test-identity-directory-worker.mjs`
- diff Git du lot

Aucun secret, `.env`, export, document réel, journal, outil d'écriture ou accès
réseau ne doit être transmis.

## Questions

1. Le contrôle précède-t-il toujours empreinte, coffre et persistance ?
2. Un en-tête de secret non autorisé peut-il être traité comme une simple colonne inconnue ?
3. Une valeur étiquetée, une clé privée ou un jeton technique peut-il contourner les motifs ?
4. Le code, le message ou l'audit peuvent-ils recopier une valeur détectée ?
5. Les mentions d'aide sans valeur secrète restent-elles utilisables ?

## Arrêt

Un rapport classé par sévérité, avec fichier, scénario reproductible et
correction minimale. Une seule passe, sans relance ni élargissement du périmètre.
