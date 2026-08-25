# Modèle de données - Agent d'établissement adaptatif V2

## Principe

La V2 réutilise les entités de suivi de `001-guichet-numerique` pour les demandes, messages, fichiers, événements et notifications. Les tables ci-dessous ajoutent uniquement la configuration multi-établissement, les compétences, les sources, les actions et les validations.

Toutes les entités V2 portent `institution_id`, sont protégées par des politiques d'accès et possèdent `created_at` et `updated_at` lorsque pertinent.

## Entités

### `institutions`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `slug` | text | Unique, stable |
| `name` | text | Nom public |
| `timezone` | text | Défaut `Europe/Paris` |
| `settings` | jsonb | Horaires, canaux, identité visuelle et limites non secrètes |
| `status` | enum | `draft`, `pilot`, `active`, `suspended` |

### `institution_memberships`

| Champ | Type | Règle |
|---|---|---|
| `institution_id` | uuid | Établissement |
| `user_id` | uuid | Compte individuel |
| `role` | enum | `agent`, `service_manager`, `admin`, `auditor` |
| `service_codes` | text[] | Périmètres autorisés |
| `mfa_verified_at` | timestamptz | Requis pour les actions sensibles |
| `status` | enum | `invited`, `active`, `disabled` |

### `agent_skills`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `skill_key` | text | Unique dans l'établissement |
| `name` | text | Libellé agent |
| `domain` | text | Administration, numérique, coordination, etc. |
| `active_version_id` | uuid nullable | Version publiée |
| `enabled` | boolean | Arrêt immédiat possible |

### `agent_skill_versions`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Doit correspondre à la compétence |
| `skill_id` | uuid | Parent |
| `version` | text | Version sémantique |
| `status` | enum | `draft`, `review`, `published`, `retired` |
| `definition` | jsonb | Représentation validée du document de compétence |
| `content_hash` | text | Détection d'altération |
| `created_by` | uuid | Auteur |
| `approved_by` | uuid nullable | Différent de l'auteur pour publication sensible |
| `published_at` | timestamptz nullable | Date d'effet |
| `review_due_at` | timestamptz | Compétence périmée après cette date |

### `knowledge_sources`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `title` | text | Titre affichable |
| `source_type` | enum | `official_url`, `internal_document`, `procedure`, `directory`, `calendar` |
| `uri` | text | URL ou identifiant de stockage privé |
| `classification` | enum | `public`, `internal`, `personal`, `sensitive` |
| `owner_user_id` | uuid | Responsable métier |
| `valid_from` | timestamptz | Début d'utilisation |
| `expires_at` | timestamptz nullable | Interdiction de répondre après expiration |
| `status` | enum | `draft`, `published`, `expired`, `revoked` |
| `checksum` | text | Traçabilité du contenu |

### `skill_source_links`

Relie une version de compétence à une ou plusieurs sources. La publication échoue si une source obligatoire est absente, révoquée ou expirée.

### `institution_integrations`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `provider` | enum | `support`, `lyceegest`, `pronote`, `scolarite_services`, `brevo`, `sms` |
| `mode` | enum | `link`, `manual_import`, `read_only`, `read_write` |
| `status` | enum | `disabled`, `testing`, `active`, `error` |
| `secret_reference` | text nullable | Référence de coffre, jamais le secret lui-même |
| `allowed_actions` | text[] | Liste blanche |
| `last_verified_at` | timestamptz nullable | État contrôlé |

### `agent_actions`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `support_request_id` | uuid nullable | Dossier `001` concerné |
| `conversation_id` | uuid nullable | Session concernée |
| `skill_version_id` | uuid | Compétence exacte utilisée |
| `action_type` | text | Action structurée |
| `automation_level` | enum | `L0`, `L1`, `L2`, `L3`, `L4` |
| `input_redacted` | jsonb | Entrée minimale et masquée |
| `status` | enum | `planned`, `awaiting_approval`, `running`, `succeeded`, `failed`, `refused` |
| `idempotency_key` | text | Unique pour une action externe |
| `tool_result` | jsonb nullable | Preuve technique sans secret |
| `confirmed_at` | timestamptz nullable | Requis avant d'annoncer la réussite |

### `agent_approvals`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `action_id` | uuid | Action L3 |
| `requested_from_role` | text | Rôle habilité attendu |
| `status` | enum | `pending`, `approved`, `rejected`, `expired`, `cancelled` |
| `decision_by` | uuid nullable | Compte individuel |
| `decision_reason` | text nullable | Obligatoire en cas de refus |
| `expires_at` | timestamptz | Empêche une vieille validation |

### `agent_evaluations`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `skill_version_id` | uuid | Version testée |
| `test_case_key` | text | Identifiant stable |
| `result` | enum | `pass`, `fail`, `needs_review` |
| `scores` | jsonb | Exactitude, source, sécurité, utilité |
| `evidence` | jsonb | Sortie masquée et raisons |
| `run_at` | timestamptz | Date du test |

## Entités `001` réutilisées

- `support_requests` : dossier, identité déclarée, catégorie, service, priorité et statut.
- `support_messages` : échanges usager-agent avec auteur et canal.
- `support_attachments` : métadonnées et référence de stockage privé.
- `support_events` : historique immuable des transitions.
- `support_notifications` : envoi durable, nouvelles tentatives et preuve.

Une migration peut ajouter `institution_id`, `source_channel`, `identity_assurance_level` et `retention_policy` à ces entités si ces champs n'existent pas encore.

## Contraintes de sécurité

- Un compte ne lit que les établissements et services présents dans ses adhésions actives.
- Un parent ou élève ne lit que ses propres dossiers après vérification adaptée.
- Une source `sensitive` ne peut jamais être injectée automatiquement dans le modèle généraliste.
- Une action L3 exige une validation active, non expirée, émise par un rôle autorisé.
- Une action L4 ne peut pas passer à `running`.
- La suppression logique préserve l'audit ; la purge physique suit la politique de rétention.
- Les journaux excluent mots de passe, codes à usage unique, secrets API et contenu intégral des pièces.

## Index et résilience

- Index sur `(institution_id, status, created_at)` pour demandes, actions et validations.
- Index sur `(institution_id, skill_key)` et `(skill_id, version)`.
- Index sur sources publiées et non expirées.
- Contraintes uniques sur `idempotency_key` par intégration.
- Transactions pour confirmer ensemble action, événement et notification à produire.
- File de quarantaine pour les traitements définitivement échoués, sans perte silencieuse.
