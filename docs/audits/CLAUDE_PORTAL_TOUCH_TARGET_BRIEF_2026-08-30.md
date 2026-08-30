# Brief d'audit Claude - cibles tactiles du portail

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `src/pages/prototype/lycee-connect.css`
- `scripts/test-prototype-responsive-contract.mjs`
- `docs/operations/PORTAL_TOUCH_TARGET_AUDIT_PREVIEW_2026-08-30.md`

## Mission proposée

Auditer en lecture seule les trois cibles tactiles corrigées et leurs règles à
320 px. Chercher régression de mise en page, cible encore trop petite,
recouvrement, débordement horizontal, ordre de tabulation incohérent ou preuve
automatique trop faible. Ne pas étendre l'audit aux écrans agents ni prétendre
qu'un lecteur d'écran a été testé.

Ne modifier aucun fichier, navigateur, secret, environnement ou déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
