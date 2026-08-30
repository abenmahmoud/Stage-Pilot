# Brief d'audit Claude - brouillon depuis email transféré

## Statut

Mis à jour le 30 août 2026. Audit non exécuté : le modèle Claude exact et le
plafond de consommation propres à cette mission n'ont pas été confirmés. Zéro
jeton externe consommé.

## Périmètre strict

- `shared/communication-forwarded-email.ts`
- `shared/communication-brevo-forwarded.ts`
- `shared/communication-brevo-inbound.ts`
- `shared/communication-draft.ts`
- `api/webhooks/brevo/communications-forwarded.ts`
- `scripts/test-communication-forwarded-email.mjs`
- `scripts/test-communication-brevo-forwarded.mjs`
- `scripts/test-communication-forwarded-route.mjs`
- `scripts/test-communication-forwarded-persistence.mjs`
- `supabase/tests/communication_forwarded_draft_security.test.sql`
- `docs/operations/COMMUNICATION_FORWARDED_EMAIL_CONTRACT_2026-08-30.md`
- T025A dans `specs/005-centre-communications/tasks.md`

## Mission proposée

Auditer en lecture seule T025. Chercher contournement du double contrôle HMAC
expéditeur/alias, confusion de domaines HMAC, faiblesse Bearer, acteur technique
hors établissement, collision ou course d'idempotence, fuite d'en-tête ou de
destinataire, image distante active, ancien fil conservé, secret accepté,
donnée personnelle envoyable vers une IA, audience implicite ou possibilité de
publier/notifier sans relecture. Vérifier aussi les bornes et la couverture des
tests avec des exemples strictement fictifs.

Ne modifier aucun fichier, navigateur, secret, environnement ou déploiement et
ne configurer aucune boîte email.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
