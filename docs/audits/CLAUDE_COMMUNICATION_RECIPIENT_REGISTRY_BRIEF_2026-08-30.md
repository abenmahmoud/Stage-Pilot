# Brief d'audit Claude - contrat du registre de destinataires

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-recipient-registry.ts`
- `scripts/test-communication-recipient-registry.mjs`
- `shared/communication-policy.ts`
- `docs/operations/COMMUNICATION_RECIPIENT_REGISTRY_CONTRACT_2026-08-30.md`
- `specs/005-centre-communications/plan.md`
- `specs/005-centre-communications/tasks.md`

## Mission proposée

Auditer en lecture seule le contrat HMAC serveur à serveur. Chercher les risques
de rejeu, signature ambiguë, confusion requête/réponse, croisement
d'établissement, durée excessive, déni de service, pollution par champs
inconnus, fuite de coordonnées dans les groupes, mauvaise rotation de clé et
utilisation d'un instantané comme autorisation d'envoi.

Ne modifier aucun fichier, secret, environnement, dépôt distant, base ou
déploiement. Ne contacter ni Webmail, Brevo, Hostinger, VPS, ENT ou PRONOTE.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- scénario d'exploitation ou d'échec concret ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
