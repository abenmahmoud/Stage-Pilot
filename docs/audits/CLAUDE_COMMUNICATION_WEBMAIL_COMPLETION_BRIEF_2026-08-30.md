# Brief d'audit Claude - complétion Webmail

## Statut

Préparé le 30 août 2026. Audit non exécuté : le modèle Claude exact et le plafond
de consommation propres à cette mission n'ont pas été confirmés.

## Périmètre strict

- `shared/communication-webmail-completion.ts`
- `supabase/migrations/20260830120000_add_communication_webmail_handshake.sql`
- `db/schema.ts` pour `communication_deliveries`
- `scripts/test-communication-webmail-completion.mjs`

## Mission proposée

Auditer en lecture seule les invariants de reprise, l'immuabilité des empreintes,
les contraintes d'état, les index uniques et les transitions après doublon.
Chercher une course, une régression de statut, une substitution de commande ou
une possibilité d'associer le même reçu à deux livraisons.

Ne modifier ni appliquer aucune migration, donnée, variable, route ou
déploiement.

## Sortie attendue

- constats classés par gravité avec fichier et ligne ;
- correctif minimal et test de non-régression proposé ;
- mention explicite si aucun défaut bloquant n'est trouvé.
