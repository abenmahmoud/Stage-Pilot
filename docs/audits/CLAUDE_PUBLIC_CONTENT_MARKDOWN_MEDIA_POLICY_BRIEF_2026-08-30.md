# Brief d'audit Claude - médias Markdown publics

## Mission préparée

Auditer la politique unique de rendu des médias et liens Markdown des contenus
publics et de leur aperçu administratif.

## Fichiers à examiner

- `src/components/PublicContentMarkdown.tsx`
- `src/pages/prototype/public-content-client.ts`
- `src/pages/prototype/PublicContentPage.tsx`
- `src/pages/prototype/LyceeConnectPrototype.tsx`
- `src/pages/admin/ContentManagerPage.tsx`
- `scripts/test-public-content-client-payload.mjs`
- `vercel.json`

## Questions

1. Une image externe, y compris sous `*.supabase.co`, peut-elle se charger ?
2. Une URL `javascript:`, protocole relatif ou contenant des identifiants peut-elle
   devenir cliquable, et les exceptions email/téléphone restent-elles strictes ?
3. Une image signée du bucket privé reste-t-elle affichable sans fuite de referrer ?
4. Tous les consommateurs éditoriaux appliquent-ils la même politique ?

## État d'exécution

Audit non lancé : le modèle Claude exact et le plafond de jetons propres à cette
mission n'ont pas été fournis. Aucun jeton externe n'a été consommé.
