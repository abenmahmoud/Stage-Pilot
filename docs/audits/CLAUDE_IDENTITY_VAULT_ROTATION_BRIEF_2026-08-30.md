# Brief Claude - rotation du coffre d'identités

## Statut

Brief préparé, non exécuté. Le modèle Claude exact et le plafond de consommation
doivent être autorisés pour cette mission précise.

## Mission proposée

Revue cryptographique en lecture seule de la primitive de rotation. Vérifier
uniquement l'intégrité AES-256-GCM, la liaison AAD, la gestion des versions et
les risques de fuite ou de perte de données.

## Périmètre minimal

- `workers/identity-directory-vault.mjs`
- `scripts/test-identity-directory-vault.mjs`
- `docs/security/IDENTITY_DIRECTORY_VAULT_ROTATION_2026-08-30.md`
- diff Git du lot

Aucun secret, `.env`, export, ligne de base, journal, outil d'écriture ou accès
réseau ne doit être transmis.

## Questions

1. La rotation authentifie-t-elle l'ancienne enveloppe avant rechiffrement ?
2. L'AAD lie-t-il toujours établissement, import, personne, schéma et version ?
3. Une même clé ou un même nonce peut-il être réutilisé par erreur ?
4. Un échec peut-il produire une enveloppe partielle ou exposer le clair ?
5. Les critères proposés pour retirer l'ancienne clé sont-ils suffisants ?

## Arrêt

Un rapport classé par sévérité avec scénario reproductible et correction
minimale. Une seule passe, sans relance ni élargissement du périmètre.
