# Brief d'audit Claude - ordre individuel Webmail

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-recipient-resolution.ts`
- `shared/communication-webmail-delivery.ts`
- `scripts/test-communication-webmail-delivery.mjs`
- T017A, T018A et T027B dans `specs/005-centre-communications/tasks.md`

## Mission proposée

Auditer en lecture seule la séparation LyceeGest/Webmail, l'unicité du
destinataire, la signature, l'idempotence, les liens publics ou authentifiés et
la minimisation. Chercher une possibilité d'injecter une adresse, un lot, une
origine externe, un jeton d'accès ou des identifiants Brevo bruts.

Ne modifier aucun fichier, secret, environnement, contact, email ou
déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
