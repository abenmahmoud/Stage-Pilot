# Brief d'audit Claude - interface documentaire des communications

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et la limite
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `api/_shared/communication-documents.ts`
- `api/communications/admin/documents/index.ts`
- `api/communications/admin/documents/[id]/confirm.ts`
- `src/lib/feature-flags.ts`
- `src/pages/admin/CommunicationsPage.tsx`
- `scripts/test-communication-document-intake.mjs`
- `scripts/test-communication-ui.mjs`

## Mission proposée

Auditer en lecture seule les deux interrupteurs, le transfert signé, la
validation extension/MIME/taille, les courses entre réservation et confirmation,
le cloisonnement établissement, les fuites de chemin ou de texte, les états
d'erreur, l'accessibilité clavier et le rendu 320 px. Vérifier que l'interface
ne peut ni analyser sans ClamAV, ni relier automatiquement un document, ni
publier, ni envoyer. Ne modifier aucun fichier et n'utiliser aucune donnée réelle.

## Sortie attendue

- constats classés par sévérité avec fichier et ligne ;
- scénario minimal de reproduction ;
- mention explicite si aucun défaut bloquant n'est trouvé ;
- risques résiduels séparés des défauts confirmés.
