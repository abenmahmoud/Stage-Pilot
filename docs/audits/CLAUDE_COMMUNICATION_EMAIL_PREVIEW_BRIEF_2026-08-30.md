# Brief d'audit Claude - aperçu email des communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-email-preview.ts`
- `src/pages/admin/CommunicationsPage.tsx`
- `scripts/test-communication-email-preview.mjs`
- `scripts/test-communication-ui.mjs`
- `docs/operations/COMMUNICATION_EMAIL_PREVIEW_2026-08-30.md`

## Mission proposée

Auditer en lecture seule les risques d'injection Markdown, URL dangereuse,
chargement distant, fuite de destinataire, confusion entre aperçu et envoi,
divergence future entre aperçu et email réel, débordement mobile et information
trompeuse sur le lien canonique. Vérifier que le modèle reste local, borné et
incapable de publier ou d'envoyer.

Ne modifier aucun fichier, secret, environnement, base ou déploiement. Ne
contacter ni Webmail, Brevo, Hostinger, VPS, ENT ou PRONOTE.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- scénario d'exploitation ou d'échec concret ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
