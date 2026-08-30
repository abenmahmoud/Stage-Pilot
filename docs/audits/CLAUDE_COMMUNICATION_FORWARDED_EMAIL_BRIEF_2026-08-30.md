# Brief d'audit Claude - brouillon depuis email transféré

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-forwarded-email.ts`
- `shared/communication-draft.ts`
- `scripts/test-communication-forwarded-email.mjs`
- `docs/operations/COMMUNICATION_FORWARDED_EMAIL_CONTRACT_2026-08-30.md`
- T025A dans `specs/005-centre-communications/tasks.md`

## Mission proposée

Auditer en lecture seule le contrat T025A. Chercher contournement de
l'autorisation serveur, collision d'empreinte, fuite d'en-tête ou de
destinataire, image distante encore active, ancien fil conservé, secret accepté,
donnée personnelle envoyable vers une IA, déduction automatique d'audience ou
possibilité de publier/notifier sans relecture. Vérifier aussi les bornes et la
couverture des tests avec des exemples strictement fictifs.

Ne modifier aucun fichier, navigateur, secret, environnement ou déploiement et
ne configurer aucune boîte email.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
