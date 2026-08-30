# Brief d'audit Claude - API de brouillon de communication

## Statut

Préparé le 30 août 2026. Audit externe non exécuté : le modèle exact et le
plafond de consommation n'ont pas été fournis pour cette mission.

## Périmètre strict

- `shared/communication-draft.ts`
- `api/_shared/communications.ts`
- `api/communications/admin/index.ts`
- `scripts/test-communication-draft.mjs`
- fondation SQL et schéma Drizzle des communications déjà présents

## Mission proposée

Auditer uniquement la création et la lecture de brouillons manuels. Chercher en
priorité une faille d'autorisation, de cloisonnement établissement, de gestion
des secrets, d'idempotence concurrente, de transaction ou de journalisation.
Vérifier que les deux interrupteurs ferment réellement la route et qu'aucune
publication, audience ou livraison n'est déclenchée. Ne modifier aucun fichier,
ne déployer rien et ne manipuler aucune donnée réelle.

## Preuves attendues

- constats classés par sévérité avec fichier et ligne ;
- scénario de reproduction minimal pour chaque anomalie ;
- mention explicite si aucun problème bloquant n'est trouvé ;
- risques résiduels et tests manquants, sans proposition hors périmètre.
