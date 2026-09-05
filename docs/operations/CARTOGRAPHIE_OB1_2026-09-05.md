# Cartographie — principes OB1 contre l'architecture LyceeGest reelle

Date : 2026-09-05. Perimetre : uniquement l'architecture de connaissance et de
memoire de l'agent. Aucune analyse generale du projet refaite.

Methode : lecture du schema (`db/schema.ts`), des migrations, du filtre serveur
`shared/public-agent-skill-policy.ts`, du chargeur `api/_shared/public-knowledge-
context.ts`, du moteur `api/_shared/support-agent.ts`, de `vercel.json` et des
scripts de test existants. Rien n'est repris d'un compte rendu : chaque ligne
ci-dessous a ete verifiee dans le code.

## Les dix regles, une par une

| # | Regle | Etat reel | Preuve |
|---|---|---|---|
| 1 | Une conversation ne devient jamais une connaissance | **Conforme, par absence** | Aucun chemin d'ecriture vers `knowledge_sources` depuis une conversation. Mais rien ne l'interdit explicitement : conformite de fait, pas garantie. |
| 2 | Une affirmation IA commence en proposition | **Partiel** | `knowledge_documents.proposed_knowledge` + `reviewed_by`/`reviewed_at` existent pour un document importe. Rien pour une affirmation nee en conversation. Aucun `provenance_status`. |
| 3 | Source officielle publiee ou validee | **Conforme, solide** | `sourceIsAuthorizedAndCurrent` exige `status = 'published'` sur la source ET `versionStatus = 'published'` + `approved_by` sur la version de competence. Filtre serveur, pas interface. |
| 4 | Correction = nouvelle version, historique auditable | **Partiel** | Versions reelles pour les competences (`agent_skill_versions`) et les contenus de site. `knowledge_sources` n'a **aucune** relation de remplacement : corriger une source ecrase la precedente. |
| 5 | valid_from / valid_until, perime inutilisable | **Conforme, solide** | Colonnes presentes et contraintes (`expires_at > valid_from`), filtre serveur, cron de peremption, et retrait automatique d'une competence dont une source requise a expire (`knowledge-expiry-policy.ts`). |
| 6 | Heure serveur Europe/Paris | **Partiel** | `Europe/Paris` utilise pour l'emploi du temps, le budget IA et les metriques. Mais la peremption tourne a `15 2 * * *` en **UTC**, et le quota du coffre compte la journee en UTC : la journee scolaire commence a 2 h du matin. |
| 7 | Pas de reponse certaine -> le dire + formulaire | **Conforme** | Consigne explicite dans le prompt systeme, repli deterministe local (`localFallback`) et bascule `caseFormReady` vers le formulaire. |
| 8 | Aucun code, secret ou donnee nominative dans le prompt, les embeddings ou la memoire | **Conforme, solide** | Coffre separe ; `ModelVisibleVaultFact` sans champ capable de porter une valeur ; `classificationIsPromptSafe` ecarte `personal` et `sensitive` selon l'acteur. |
| 9 | Roles, MFA, RLS, audit restent la base | **Conforme** | Inchange par cette mission. |
| 10 | Controles de fraicheur a 08 h, 13 h, 18 h | **Absent** | Un seul passage quotidien (`/api/cron/knowledge-expiry`, 02:15 UTC). Aucun controle declenche par une publication. |

## Les concepts OB1, un par un

| Concept demande | Etat | Decision |
|---|---|---|
| `provenance_status` | Absent | **A ajouter.** Aujourd'hui `status` melange cycle de vie (`draft`/`published`/`expired`/`revoked`) et rien d'autre : impossible de dire qu'une source a ete produite par l'IA ou qu'elle est contestee. |
| `use_policy` | Absent | **A ajouter — c'est le vrai manque.** Le modele est binaire : publiee + liee a une competence = injectee comme **instruction**. Il n'existe aucune facon de dire « citable comme preuve, jamais comme consigne ». |
| Relation de remplacement | Absent | **A ajouter** sur `knowledge_sources` (regle 4). |
| Trace de rappel expliquant le choix | Partiel | **A completer.** `recordPublicKnowledgeUsage` enregistre ce qui a **servi** (versions, sources, `sessionHash`, modele) via `agent_skill_audit.action = 'consult_public'`. Il n'enregistre pas ce qui a ete **ecarte** ni **pourquoi**. La question n'est deja pas stockee en clair : bon point a conserver tel quel. |
| Empreinte de contenu | **Deja present** | `knowledge_sources.checksum` (sha-256 contraint) et index unique `(source_id, content_hash)` sur les extraits. **Ne rien ajouter.** |
| Statut de validation, auteur, date, commentaire | Partiel | **Reutiliser l'existant**, ne pas creer un troisieme circuit : `knowledge_documents` (reviewed_by/at) et `agent_skill_versions` (approved_by, published_at) valident deja. Seul le **commentaire** de validation manque. |
| Portee : etablissement, service | **Deja present** | `institution_id` partout, `service_codes[]` contraint a la liste des services, index GIN. |
| Portee : public concerne, role, classe | Absent | **A ne pas construire maintenant.** Aucun cas d'usage reel ne le demande, et cela multiplierait la surface RLS. A ouvrir le jour ou une source devra viser une classe precise, pas avant. |
| Reference vers le document source et sa version | Partiel | `skill_source_links` relie une version de competence a ses sources. Une source n'a pas de version propre — c'est la meme lacune que la relation de remplacement, et la meme correction la couvre. |

## Ce que cette cartographie recommande de NE PAS faire

- **Ne pas installer OB1, ne pas copier son schema, ne pas creer une seconde
  base.** Rien dans ce qui precede ne le demande : les manques sont quatre
  colonnes, une relation et une trace enrichie.
- **Ne pas ajouter un troisieme circuit de validation.** Deux existent deja
  (documents, versions de competence). Un troisieme sur les sources creerait
  des chemins concurrents et donc des trous.
- **Ne pas ajouter de portee par classe** tant qu'aucun besoin reel ne
  l'exige.
- **Ne pas re-implementer l'empreinte de contenu** : elle existe et elle est
  contrainte.

## L'ecart le plus important, en une phrase

Une source publiee et liee a une competence est aujourd'hui injectee comme
**instruction**, sans qu'il existe le moindre moyen de dire « celle-ci peut
etayer une reponse mais ne doit jamais dicter un comportement ». C'est ce que
`use_policy` apporte, et c'est le seul ajout dont depend reellement l'objectif
« savoir pourquoi il utilise une source ».
