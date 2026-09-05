# LOT 1 — Migration additive et reversible (`knowledge_sources`)

Plan : `docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, section « LOT 1 ».
Base de connaissance : `docs/operations/CARTOGRAPHIE_OB1_2026-09-05.md`.

## Ce qui a ete fait

Fichier ajoute : `supabase/migrations/20260906010000_add_knowledge_source_provenance.sql`.

Ajoute a `public.knowledge_sources`, sans modifier une ligne existante :

- `provenance_status text not null default 'imported'`, contraint aux sept
  valeurs du plan (`observed`, `inferred`, `user_confirmed`, `imported`,
  `generated`, `superseded`, `disputed`).
- `use_policy text not null default 'can_use_as_instruction'`, contraint aux
  quatre valeurs du plan.
- `superseded_by uuid`, cle etrangere composite
  `(superseded_by, institution_id) -> knowledge_sources(id, institution_id)`,
  auto-reference interdite par contrainte separee.
- `review_comment text`, borne entre 3 et 2000 caracteres (btrim) quand non
  nul.
- `reviewed_by uuid references auth.users(id) on delete restrict` et
  `reviewed_at timestamptz`, sur le meme motif que
  `knowledge_document_ingestion` / `schedule_source_versions` /
  `support_assistant_routing_reviews` deja presents dans le depot.

Contraintes structurelles posees (pas seulement documentees) :

- `knowledge_sources_superseded_pairing_check` : `provenance_status =
  'superseded'` **si et seulement si** `superseded_by is not null`.
- `knowledge_sources_superseded_by_not_self_check` : une source ne peut pas se
  remplacer elle-meme.
- `knowledge_sources_generated_inferred_policy_check` : une source
  `generated` ou `inferred` ne peut jamais porter
  `use_policy = 'can_use_as_instruction'`.
- `knowledge_sources_review_pairing_check` : `reviewed_by` / `reviewed_at`
  toujours poses ensemble ou jamais.
- Trigger `knowledge_sources_supersede_guard_trigger` (avant chaque
  `update`) : une fois `superseded_by` pose, il est immuable — toute
  tentative de le changer, y compris pour le remettre a `null`, est rejetee.
  Combinee au constraint de pairing ci-dessus, cette regle empeche aussi de
  faire ressortir une ligne de l'etat `superseded` une fois le lien pose,
  sans dupliquer la logique.

Index ajoutes : `(institution_id, provenance_status)`,
`(institution_id, use_policy)`, `superseded_by` (partiel, non nul),
`reviewed_by` (partiel, non nul).

Migration inverse : le depot n'a pas de convention de fichier `down` (verifie
par recherche sur tout `supabase/migrations`, aucun `_down.sql` ni bloc
« rollback migration » trouve ailleurs que dans des noms d'action d'audit).
Le bloc inverse est donc ecrit en commentaire a la fin du meme fichier, a
rejouer manuellement sur une pile jetable si besoin.

RLS et privileges : `knowledge_sources` avait deja `enable/force row level
security` et un `revoke all ... from public, anon, authenticated` pose dans
`20260827221500_create_agent_skill_registry.sql`. Cette migration n'accorde
aucun nouveau privilege : elle ne touche ni GRANT ni RLS sur la table, et la
fonction du trigger est explicitement revoquee pour `anon`/`authenticated`
puis accordee au seul `service_role`.

## Preuves reellement executees (pile Supabase locale jetable)

Environnement : Docker Desktop disponible cette nuit (contrairement au 3
septembre). `npx supabase start` puis `npx supabase db reset`.

1. **`supabase db reset` complet** : les 95 migrations (94 existantes + celle
   de ce lot) se sont appliquees sans erreur, jusqu'a
   `Finished supabase db reset on branch codex/lycee-connect-prototype.`

2. **Relecture `information_schema` / `pg_constraint`** (`psql` dans le
   conteneur `supabase_db_lyceegest-prototype`) :
   - les 6 colonnes existent avec le bon type, la bonne nullabilite et le bon
     defaut (`provenance_status` = `'imported'`, `use_policy` =
     `'can_use_as_instruction'`, les 4 autres nullables) ;
   - les 20 contraintes attendues sont presentes sur `knowledge_sources`,
     dont les 4 contraintes du LOT 1 et la cle etrangere composite
     `knowledge_sources_superseded_by_fk` ;
   - `information_schema.role_table_grants` pour `anon` et `authenticated`
     sur `knowledge_sources` renvoie **0 ligne** : aucun droit gagne.

3. **Comportement historique preserve** : insertion d'une source sans
   preciser les nouvelles colonnes -> `provenance_status = 'imported'`,
   `use_policy = 'can_use_as_instruction'`, `superseded_by = null`. Exactement
   ce que le plan exige.

4. **Chaque combinaison interdite testee individuellement et rejetee
   nommement** (transaction avec savepoints, donnees fictives uniquement) :
   1. `superseded` sans `superseded_by` -> rejet par
      `knowledge_sources_superseded_pairing_check`.
   2. non-`superseded` avec `superseded_by` pose -> meme contrainte.
   3. `superseded_by` pointant sur soi-meme -> rejet par
      `knowledge_sources_superseded_by_not_self_check`.
   4. `superseded_by` pointant vers une source d'un **autre etablissement**
      -> rejet par la cle etrangere composite
      `knowledge_sources_superseded_by_fk`.
   5. `generated` + `can_use_as_instruction` -> rejet par
      `knowledge_sources_generated_inferred_policy_check`.
   6. `inferred` + `can_use_as_instruction` -> meme contrainte.
   7. `reviewed_by` sans `reviewed_at` -> rejet par
      `knowledge_sources_review_pairing_check`.
   8. `review_comment` de 2 caracteres -> rejet par
      `knowledge_sources_review_comment_check`.
   9. valeur hors enum sur `provenance_status` -> rejet par
      `knowledge_sources_provenance_status_check`.
   10. valeur hors enum sur `use_policy` -> rejet par
       `knowledge_sources_use_policy_check`.
   11. cas valide de reference (superseded + remplacement dans le meme
       etablissement) -> accepte, verifie par relecture de la ligne.
   12. tentative de modifier `superseded_by` deja pose vers une autre valeur
       -> rejet par le trigger, message
       `knowledge_sources_superseded_by_is_immutable`.
   13. tentative de remettre `superseded_by` a `null` en meme temps que
       `provenance_status` a `imported` -> meme rejet par le trigger (la
       ligne ne peut pas non plus sortir de l'etat `superseded`).

   Toutes les transactions de test ont ete annulees (`rollback`) : aucune
   donnee de test ne subsiste dans la base locale jetable, qui a de toute
   facon ete arretee ensuite (`npx supabase stop`).

## Non verifie / hors perimetre de ce lot

- `tsc --noEmit`, `vite build`, `npm run test:preview-security-gate`,
  `npm run test:spec-integrity` : **non executes**, le plan (§LOT 8) les
  demande a la cloture finale, pas a chaque lot, et ce lot ne touche a aucun
  fichier TypeScript.
- LOT 2 a LOT 8 du plan : non commences. Ce compte rendu ne couvre que le
  LOT 1.
- Aucune donnee reelle, aucun drapeau, aucune migration `--linked` ni `db
  push` : respecte, tout s'est joue sur la pile locale jetable.

## Fichiers modifies

- `supabase/migrations/20260906010000_add_knowledge_source_provenance.sql`
  (nouveau)
- `docs/operations/night-logs/OB1-LOT1.md` (nouveau, ce fichier)
