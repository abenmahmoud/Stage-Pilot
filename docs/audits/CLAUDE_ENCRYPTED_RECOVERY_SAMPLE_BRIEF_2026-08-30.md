# Brief Claude - paquet fictif de restauration chiffré

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise.

## Mission proposée

Effectuer une revue cryptographique et de robustesse en lecture seule du format
local de restauration. Rechercher les réutilisations de nonce, confusions de
contexte, restaurations partielles, contournements de limites et fuites dans le
manifeste.

## Périmètre minimal

- `workers/recovery-sample-bundle.mjs`
- `scripts/test-recovery-sample-bundle.mjs`
- `docs/security/ENCRYPTED_RECOVERY_SAMPLE_BUNDLE_2026-08-30.md`
- diff Git du lot

Aucun secret, `.env`, export, document réel, journal, outil d'écriture ou accès
réseau ne doit être transmis.

## Questions

1. Le MAC et les AAD lient-ils sans ambiguïté établissement, paquet, ordre et contenu ?
2. Une suppression, duplication ou permutation peut-elle passer inaperçue ?
3. Les tailles sont-elles bornées avant les allocations et le déchiffrement ?
4. Une erreur peut-elle exposer du clair ou produire un résultat partiel ?
5. Le document distingue-t-il correctement cette preuve locale d'une vraie sauvegarde restaurable ?

## Arrêt

Un rapport classé par sévérité, avec fichier, scénario reproductible et
correction minimale. Une seule passe, sans relance ni élargissement du périmètre.
