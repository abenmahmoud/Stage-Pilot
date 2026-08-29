# Recette preview - extraits documentaires minimaux

Date : 29 aout 2026

## Perimetre

- Depot : `abenmahmoud/Stage-Pilot`
- Branche : `codex/lycee-connect-prototype`
- Supabase preview : `guichet-lycee-preview`
- Production, DNS, Hostinger, VPS et documents reels : non modifies

## Comportement livre

- Compilation apres antivirus, extraction locale et approbation humaine MFA.
- Sources `public` et `internal` seulement ; `personal` et `sensitive` exclues.
- Maximum 1 200 caracteres par extrait, 40 extraits et 30 000 caracteres par
  source.
- Suppression du texte integral de `proposed_knowledge` apres compilation.
- Selection apres autorisation, limitee a six extraits et 4 000 caracteres.
- Balises HTML/XML neutralisees avant insertion dans le contexte du modele.
- L'interface indique le nombre d'extraits disponibles ou la lecture humaine.

## Migrations

- `20260829034457_create_knowledge_source_excerpts.sql`
- `20260829034714_index_knowledge_source_excerpt_foreign_keys.sql`

La premiere migration a d'abord ete executee dans une transaction annulee. Les
controles ont confirme la creation, RLS activee et forcee, l'absence de droit
`anon`/`authenticated`, les droits serveur, puis la disparition de la table
apres `rollback`.

Apres application sur la preview :

- table presente et vide ;
- RLS activee et forcee ;
- `anon_select = false` ;
- `authenticated_select = false` ;
- droits CRUD `service_role = true` ;
- versions de migration enregistrees ;
- deux cles etrangeres composites couvertes par des index dedies.

Une transaction fictive a cree une source, un document et un extrait dans le
meme etablissement, puis a ete annulee. Le controle final a confirme zero reste.

## Tests

- `npm run test:knowledge-excerpts` : 12/12
- `npm run test:public-skill-context` : 11/11
- `npm run test:knowledge-document-review` : 4/4
- `npm run build` : reussi

Le conseiller securite remonte seulement l'information attendue « RLS sans
politique » pour cette table reservee au serveur, dont les droits clients sont
revoques. Le conseiller performance ne remonte plus de cle etrangere non
indexee pour ce module ; les index sont marques non utilises car la table est
vide.

## Reste a valider

- Publier une source et une competence entierement fictives.
- Rejouer une question publique puis une question interne avec deux acteurs de
  niveaux differents.
- Confirmer dans la trace que seule la version autorisee a ete utilisee.
- Garder toute source reelle bloquee jusqu'aux validations Direction/DPO.

