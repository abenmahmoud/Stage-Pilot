# Brief Claude - réponses documentaires de communication

## Statut

Audit externe non exécuté. Zéro jeton externe consommé.

## Mission préparée

Relire en lecture seule les validateurs de liste, de réservation signée et de
confirmation, leur branchement dans la console Communications et leurs tests.
Rechercher une substitution de bucket, chemin, jeton, document ou métadonnée,
une validation trop permissive ou trop restrictive, une fausse confirmation,
un dépôt orphelin silencieux ou une donnée privée exposée.

## Périmètre

- `shared/communication-document-payload.ts`
- `shared/communication-document-input.ts`
- `api/_shared/communication-documents.ts`
- `api/communications/admin/documents/index.ts`
- `api/communications/admin/documents/[id]/confirm.ts`
- `src/pages/admin/CommunicationsPage.tsx`
- `scripts/test-communication-document-payload.mjs`

Interdire tout accès à Vercel, Supabase, aux variables, aux données réelles et
aux autres dépôts. Ne lancer aucun téléversement. Arrêter après les constats
classés et les tests manquants. Le fournisseur, le modèle et le plafond de
consommation doivent être confirmés avant exécution.
