# Brief d'audit Claude - modèles de communication

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le
plafond de consommation de cette mission ne sont pas fournis.

## Périmètre strict

- `shared/communication-templates.ts`
- `api/communications/admin/templates.ts`
- ajout de rôles dans `api/_shared/communications.ts`
- conservation du modèle dans `shared/communication-draft.ts` et l'API de brouillon
- sélection et édition dans `src/pages/admin/CommunicationsPage.tsx`
- migration `20260830070000_create_communication_templates.sql`
- modèles Drizzle et tests associés

## Mission proposée

Chercher une modification de modèle hors établissement, un contournement du
rôle direction, un secret persistant, une perte de version ou d'audit, une
mutation de l'historique et tout chemin pouvant publier, cibler ou envoyer.
Vérifier la concurrence de l'upsert. Ne modifier aucun fichier et ne manipuler
aucune donnée réelle.

## Sortie attendue

- constats classés par sévérité avec fichier et ligne ;
- scénario de reproduction minimal ;
- mention explicite si aucun défaut bloquant n'est trouvé ;
- risques résiduels séparés des défauts confirmés.
