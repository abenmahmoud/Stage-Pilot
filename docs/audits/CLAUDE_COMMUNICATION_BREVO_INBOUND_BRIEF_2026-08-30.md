# Brief d'audit Claude - contrat entrant Brevo Communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-brevo-inbound.ts`
- `scripts/test-communication-brevo-inbound.mjs`
- `specs/005-centre-communications/tasks.md`
- `specs/005-centre-communications/analysis.md`
- `docs/operations/COMMUNICATION_BREVO_INBOUND_CONTRACT_2026-08-30.md`

## Mission proposée

Auditer en lecture seule le contrat d'authentification et de réduction du futur
webhook Brevo. Chercher contournement Bearer, comparaison non constante,
duplication de `Message-ID`, réutilisation de secret, collision ou confusion de
domaine des HMAC,
lot non borné, conversion numérique dangereuse, adresse ou contenu sensible
dans la sortie et divergence avec le format officiel Brevo.

Vérifier aussi que le lot ne prétend pas avoir créé une route, persisté un
message ou configuré un domaine. Ne modifier aucun fichier, secret,
environnement, base, DNS ou déploiement et ne contacter aucun service externe.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- scénario d'exploitation concret ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
