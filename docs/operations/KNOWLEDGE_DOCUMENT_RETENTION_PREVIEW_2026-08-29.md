# Preuve preview - conservation documentaire

## Cible

- Dépôt : `abenmahmoud/Stage-Pilot`
- Branche : `codex/lycee-connect-prototype`
- Supabase : branche `guichet-lycee-preview`, référence `xijocumlwivhbmffrnlj`
- Production, VPS et données réelles : non touchés

## Migration

- `20260829203723_add_knowledge_document_retention.sql`
- La version du dépôt correspond à la version enregistrée sur la preview.
- Après application : zéro document, zéro extrait et zéro audit documentaire.
- `anon` et `authenticated` n'ont pas le privilège `SELECT` sur
  `public.knowledge_documents`.

## Contrôles

- Politique par défaut `pending_dpo`, date vide et purge `blocked`.
- Index partiel uniquement sur les politiques approuvées et documents sans source.
- Masquage des métadonnées personnelles et sensibles avant réponse de liste.
- Audit minimal de chaque ouverture d'original privé.
- Worker désactivé par défaut, lots bornés et verrouillage concurrent.
- Suppression du fichier par l'API Storage, jamais par SQL.
- Tests ciblés : 45 réussis avec le build TypeScript/Vite.

## Limites

Le worker n'est pas installé ni planifié. Aucune durée n'est approuvée. Une
recette fictive de purge et une restauration doivent réussir avant activation.
