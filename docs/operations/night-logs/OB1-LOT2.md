# LOT 2 — Module pur de politique d'usage (`knowledge-use-policy.ts`)

Plan : `docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md`, section « LOT 2 ».
S'appuie sur les colonnes ajoutees au LOT 1 (`provenance_status`, `use_policy`,
`superseded_by`) — voir `docs/operations/night-logs/OB1-LOT1.md`.

## Ce qui a ete fait

Fichier ajoute : `shared/knowledge-use-policy.ts`.

Une fonction unique, `decideKnowledgeSourceUsage({ source, actor, now })`,
decide pour une source candidate et un acteur :
- `instruction` (utilisable comme consigne),
- `evidence` (utilisable comme preuve citee),
- `requires_confirmation` (a confirmer par un humain),
- `do_not_inject` (jamais injectee).

Elle retourne toujours un `reasonCode` stable (13 valeurs, ex.
`source_superseded`, `service_scope_required`, `classification_not_safe_for_actor`,
`policy_allows_instruction`), jamais une phrase, pour que le LOT 4 puisse
l'ecrire tel quel dans la trace. Module pur : aucune base, aucun reseau,
toutes les donnees sont passees en entree.

Exclusions sans condition, verifiees dans cet ordre (deterministe, pour que le
motif retenu ne varie jamais quand plusieurs causes sont vraies en meme
temps) :
1. horodatage d'evaluation invalide (defense, hors liste du plan) ;
2. hors etablissement (`institutionId` different) ;
3. statut autre que `published` (`draft`/`revoked` -> `source_not_published`,
   `expired` -> `source_expired`) ;
4. fenetre de validite : `validFrom` futur -> `source_not_yet_valid` ;
   `expiresAt` depasse ou horodatage illisible -> `source_expired` (echec
   ferme, meme comportement que `sourceIsAuthorizedAndCurrent` existant) ;
5. `provenance_status = superseded` -> `source_superseded` ;
6. `provenance_status = disputed` -> `source_disputed` ;
7. `use_policy = do_not_inject_automatically` -> `use_policy_blocks_automatic_injection` ;
8. hors service (source scopee a des `serviceCodes` que l'acteur n'a pas)
   -> `service_scope_required` ;
9. classification non sure pour cet acteur -> `classification_not_safe_for_actor`.

Apres ces neuf verifications, le `use_policy` restant determine la decision
finale (`requires_human_confirmation` -> `requires_confirmation`,
`can_use_as_evidence` -> `evidence`, sinon `instruction`).

## Extension sans reecriture de `public-agent-skill-policy.ts`

Le plan demande d'etendre la meme famille de modules sans la reecrire. La
verification « classification sure pour cet acteur » existait deja, non
exportee, dans `shared/public-agent-skill-policy.ts`
(`classificationIsPromptSafe`). Plutot que de la dupliquer (le meme calcul de
securite en deux endroits qui pourraient diverger), j'ai ajoute le seul mot-cle
`export` devant cette fonction — aucun changement de comportement, aucune
ligne de logique modifiee — et je l'importe depuis le nouveau module. Verifie :
les 13 tests existants de `test:public-skill-context` passent toujours a
l'identique apres ce changement (voir Preuves).

## Tests purs (`scripts/test-knowledge-use-policy.mjs`)

23 tests, `node:test`, donnees fictives, aucune base ni reseau :
- un test par cas d'exclusion (8 motifs), un test par decision finale
  positive (instruction, evidence, requires_confirmation, plus le cas
  historique par defaut), un test pour l'horodatage invalide ;
- deux tests de la portee de service (source scopee refusee puis acceptee
  selon le service de l'acteur) ;
- trois tests de classification (interne refusee a un visiteur puis acceptee
  a un agent autorise ; personnelle et sensible toujours refusees, meme pour
  un agent interne autorise) ;
- quatre tests de **combinaisons contradictoires** : plusieurs motifs
  d'exclusion vrais simultanement (ex. institution differente + statut expire
  + disputee + politique bloquante + classification sensible, toutes en meme
  temps) ; chaque test verifie que le motif retenu est celui de priorite la
  plus haute dans l'ordre ci-dessus, jamais un choix arbitraire entre deux
  causes valides.

## Preuves reellement executees

- `npm run test:knowledge-use-policy` : 23/23 tests passent.
- `npm run test:public-skill-context` : 13/13 tests passent encore apres
  l'ajout de l'`export` (aucune regression sur le module etendu).
- `node node_modules/typescript/bin/tsc --noEmit` : aucune erreur (couvre le
  nouveau fichier, l'export ajoute, et le reste du depot).
- `git status` avant et apres : seuls `package.json`,
  `shared/public-agent-skill-policy.ts` (un mot-cle `export` ajoute),
  `shared/knowledge-use-policy.ts` (nouveau) et
  `scripts/test-knowledge-use-policy.mjs` (nouveau) portent mes changements.
  Le bruit deja present avant ce lot (`nuit.ps1`, `.nuit.lock`,
  `docs/operations/CARTOGRAPHIE_OB1_2026-09-05.md` et
  `docs/operations/PLAN_CONNAISSANCE_OB1_2026-09-05.md` en supprime+non suivi)
  n'a pas ete touche.

## Non verifie / hors perimetre de ce lot

- `npx vite build` et `npm run test:preview-security-gate` /
  `test:spec-integrity` : **non executes**, demandes par le plan a la
  cloture finale (§LOT 8), pas a chaque lot ; ce lot n'ajoute qu'un module
  pur sans base ni route.
- Aucun branchement serveur : `sourceIsAuthorizedAndCurrent` et
  `api/_shared/public-knowledge-context.ts` ne sont pas modifies. C'est le
  LOT 3.
- Le champ `superseded_by` n'est pas repris dans le type d'entree du module :
  la contrainte DB (LOT 1) garantit deja qu'une source `superseded` porte
  toujours un remplacement, et la fonction n'a besoin que de
  `provenance_status = superseded` pour exclure. Ne pas porter un champ
  inutilise a la fonction, conformement au plan (« pas a supposer »).
- Aucune donnee reelle, aucun drapeau, aucune migration : ce lot ne touche
  aucune base, respecte.
- LOT 3 a LOT 8 : non commences.

## Fichiers modifies

- `shared/knowledge-use-policy.ts` (nouveau)
- `scripts/test-knowledge-use-policy.mjs` (nouveau)
- `shared/public-agent-skill-policy.ts` (un mot-cle `export` ajoute a
  `classificationIsPromptSafe`, comportement inchange)
- `package.json` (nouvelle entree `test:knowledge-use-policy`)
- `docs/operations/night-logs/OB1-LOT2.md` (nouveau, ce fichier)
