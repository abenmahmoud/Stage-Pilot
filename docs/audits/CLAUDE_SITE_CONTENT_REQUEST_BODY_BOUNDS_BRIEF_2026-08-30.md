# Brief d'audit Claude - corps de la gestion éditoriale

## Mission préparée

Auditer en lecture seule les plafonds HTTP des articles, pages, modèles et
médias du site, ainsi que la séparation des rôles.

## Fichiers à examiner

- `api/content/admin/index.ts`
- `api/content/admin/[id].ts`
- `api/content/admin/[id]/action.ts`
- `api/content/admin/templates.ts`
- `api/content/admin/assets.ts`
- `api/content/admin/assets/[id]/confirm.ts`
- `api/content/admin/legacy-import.ts`
- `scripts/test-site-content-request-body-bounds.mjs`

## Questions

1. Tous les corps sont-ils bornés avant validation et persistance ?
2. La confirmation sans payload désactive-t-elle entièrement le parseur ?
3. Le média reste-t-il envoyé directement au stockage privé signé ?
4. Les rôles éditeur et publication restent-ils séparés ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
