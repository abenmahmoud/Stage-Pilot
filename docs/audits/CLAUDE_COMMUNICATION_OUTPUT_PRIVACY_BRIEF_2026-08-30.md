# Brief d'audit Claude - confidentialité des sorties Communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `api/communications/**`
- `src/pages/admin/CommunicationsPage.tsx`
- `scripts/test-communication-output-privacy.mjs`
- `scripts/test-communication-review.mjs`
- `scripts/test-communication-document-intake.mjs`
- `docs/operations/COMMUNICATION_OUTPUT_PRIVACY_AUDIT_2026-08-30.md`

## Mission proposée

Auditer en lecture seule toutes les réponses actuelles pour détecter fuite de
destinataire, référence de contact, empreinte interne, chemin de stockage, texte
extrait, secret ou sélection SQL excessive. Vérifier que le test dynamique
échouera pour une nouvelle route sensible et qu'il ne donne pas une fausse
garantie sur l'envoi futur encore absent.

Ne modifier aucun fichier, secret, environnement, base ou déploiement. Ne
contacter ni Webmail, Brevo, Hostinger, VPS, ENT ou PRONOTE.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- scénario d'exploitation ou de fuite concret ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
