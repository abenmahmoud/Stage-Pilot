# Brief d'audit Claude - corps des commandes d'emploi du temps

## Mission préparée

Auditer en lecture seule les plafonds HTTP des commandes d'emploi du temps et
la conservation du dépôt privé direct des PDF.

## Fichiers à examiner

- `api/schedule/admin/imports/index.ts`
- `api/schedule/admin/imports/[id]/confirm.ts`
- `api/schedule/admin/imports/[id]/approve.ts`
- `api/schedule/admin/imports/[id]/activate.ts`
- `api/schedule/admin/imports/[id]/rollback.ts`
- `api/schedule/admin/imports/[id]/pages/index.ts`
- `api/schedule/admin/imports/[id]/pages/[pageId]/verify.ts`
- `scripts/test-schedule-request-body-bounds.mjs`

## Questions

1. Toutes les commandes sont-elles bornées avant validation métier ?
2. Les actions sans payload désactivent-elles entièrement le parseur ?
3. Le PDF reste-t-il envoyé directement au stockage privé signé ?
4. Le contrôle du gestionnaire est-il conservé partout ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
