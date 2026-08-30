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

### `school_identities`

Lien privé entre un compte et une personne connue de l'établissement. Cette
table n'est jamais alimentée depuis une simple déclaration publique.

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `user_id` | uuid | Compte authentifié |
| `person_type` | enum | `student`, `guardian`, `staff` |
| `official_person_ref` | text | Identifiant opaque de la source officielle |
| `source_import_id` | uuid | Version active du répertoire ayant permis le rapprochement |
| `assurance_level` | enum | `directory_matched`, `official_sso` |
| `verified_by` | uuid nullable | Agent lorsque le rapprochement est manuel |
| `verified_at` | timestamptz | Date de décision |
| `revoked_at` | timestamptz nullable | Coupe immédiatement l'accès |
| `evidence` | jsonb | Méthode et source, sans OTP ni secret |

Une contrainte unique empêche qu'une même référence officielle active soit liée
à plusieurs comptes incompatibles. Les doublons passent en validation humaine.
Le niveau `contact_verified` n'est volontairement pas autorisé dans cette table :
il reste dans `contact_verifications` et ne constitue jamais une identité scolaire.

### `identity_directory_imports`

Version privée et inactive par défaut d'un export officiel ou d'un tableau
préparé. Le fichier source reste en quarantaine jusqu'aux contrôles techniques et
à la validation humaine.

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire et identifiant de version |
| `institution_id` | uuid | Cloison obligatoire |
| `title` | text | Nom lisible de la version |
| `purpose_description` | text | Finalité déclarée avant le dépôt |
| `source_type` | enum | `csv`, `xlsx`, `official_export` |
| `storage_path` | text | Objet privé opaque, jamais une URL publique |
| `checksum` | text nullable | SHA-256 calculé après réception |
| `status` | enum | `reserved`, `uploaded`, `quarantined`, `parsing`, `review`, `approved`, `active`, `superseded`, `rejected`, `failed` |
| `row_count` | integer nullable | Nombre total après lecture bornée |
| `valid_row_count` | integer nullable | Lignes proposées à la validation |
| `rejected_row_count` | integer nullable | Lignes écartées ou conflictuelles |
| `validation_summary` | jsonb | Résultat minimal, sans recopier les données personnelles |
| `uploaded_by` | uuid | Compte direction avec MFA |
| `approved_by` | uuid nullable | Validation humaine obligatoire |
| `activated_at` | timestamptz nullable | Une seule version active par établissement |

### `school_relationships`

| Champ | Type | Règle |
|---|---|---|
| `institution_id` | uuid | Cloison obligatoire |
| `subject_identity_id` | uuid | Personne qui consulte |
| `object_person_ref` | text | Élève, classe ou groupe autorisé |
| `relationship_type` | enum | `self`, `guardian_of`, `member_of`, `teaches`, `manages` |
| `valid_from` | date | Début du droit |
| `valid_until` | date nullable | Fin automatique |
| `source_import_id` | uuid | Version officielle ayant créé le lien |
| `status` | enum | `active`, `revoked`, `expired` |

### `identity_directory_rows`

Rapport de quarantaine produit après antivirus et lecture bornée. Il ne contient
jamais de nom, d'email ou de téléphone en clair et n'est accessible que côté
serveur.

| Champ | Type | Règle |
|---|---|---|
| `import_id` | uuid | Version privée contrôlée |
| `source_sheet`, `row_number` | text, integer | Localisation de l'anomalie sans recopier la ligne |
| `record_type` | enum | `person`, `relationship`, `unknown` |
| `person_ref`, `subject_person_ref`, `object_ref` | text nullable | Références opaques uniquement |
| `person_type`, `relationship_type` | enum nullable | Valeurs autorisées par le contrat |
| `class_ref`, `service_code` | text nullable | Périmètre fonctionnel opaque |
| `academic_email_hash` | text nullable | HMAC-SHA-256 avec secret serveur |
| `personal_email_hash` | text nullable | HMAC-SHA-256 avec secret serveur |
| `phone_hash` | text nullable | HMAC-SHA-256 avec secret serveur |
| `validation_status` | enum | `valid`, `warning`, `rejected` |
| `issues` | jsonb | Codes d'anomalies, sans valeur source |
| `fingerprint` | text | SHA-256 de la représentation minimale de la ligne |

Le secret HMAC n'est jamais placé dans Git, la base ou l'interface. Une ligne
valide n'est pas encore une identité : seul un rapprochement ultérieur, borné à
la version active et validé par la politique d'accès, peut créer ce lien.

### `contact_verifications`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `user_id` | uuid nullable | Compte en cours de création |
| `channel` | enum | `email`, `sms` |
| `contact_hash` | text | Empreinte, jamais l'OTP |
| `purpose` | enum | `signup`, `recovery`, `link_identity` |
| `status` | enum | `pending`, `verified`, `expired`, `blocked` |
| `attempt_count` | integer | Limite anti-bruteforce |
| `expires_at` | timestamptz | Courte durée |
| `consumed_at` | timestamptz nullable | Usage unique |

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
| `service_codes` | text[] | Services autorisés ; vide uniquement pour une source réellement transverse |
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

### `schedule_source_versions`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `source_kind` | enum | `classes`, `teachers` |
| `source_format` | enum | `pdf_import` en V1 |
| `school_year` | text | Année consécutive, par exemple `2026-2027` |
| `version` | integer | Incrément atomique par périmètre |
| `storage_bucket/path` | text | Objet privé, jamais URL publique permanente |
| `checksum` | text nullable | Ajouté après contrôle antivirus |
| `effective_from` | date | Début de validité métier |
| `effective_until` | date nullable | Fin de validité métier, jamais antérieure au début |
| `fresh_until` | timestamptz nullable | Obligatoire pour toute nouvelle activation ; au-delà, l'agent refuse de répondre |
| `page_count` | integer nullable | Renseigné après lecture technique |
| `status` | enum | `reserved`, `uploaded`, `quarantined`, `processing`, `review`, `approved`, `active`, `superseded`, `rejected`, `failed`, `retired` |
| `uploaded_by` | uuid | Compte individuel |
| `approved_by` | uuid nullable | Validation humaine requise |
| `activated_at` | timestamptz nullable | Une seule version active par périmètre |

### `schedule_page_indexes`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Même établissement que la source |
| `source_version_id` | uuid | Version PDF immuable |
| `page_number` | integer | De 1 à 500, unique dans la version |
| `subject_type` | enum | `class`, `teacher` |
| `subject_ref` | text | Référence opaque, jamais nom de personne |
| `review_status` | enum | `draft`, `verified`, `rejected` |
| `reviewed_by/at` | uuid/timestamptz | Obligatoires hors brouillon |

### `schedule_audit`

Le journal conserve la version, la page éventuelle, l'action, le compte agent,
la date et un résumé minimal. Il ne conserve ni nom, emploi du temps complet,
question utilisateur ou coordonnées.

### `schedule_slots`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `source_version_id` | uuid | Version immuable |
| `class_ref` | text nullable | Référence opaque de classe |
| `group_ref` | text nullable | Référence opaque de groupe |
| `teacher_ref` | text nullable | Référence opaque, non publique |
| `subject_code` | text | Matière issue du référentiel validé |
| `room_code` | text nullable | Salle |
| `starts_at` | timestamptz | Heure avec fuseau établissement |
| `ends_at` | timestamptz | Supérieure à `starts_at` |
| `week_pattern` | text nullable | Semaine A/B ou période |
| `parse_confidence` | numeric | Les faibles scores exigent une revue |
| `review_status` | enum | `pending`, `approved`, `rejected` |

### `schedule_changes`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `base_slot_id` | uuid nullable | Créneau remplacé lorsque connu |
| `change_type` | enum | `maintained`, `moved`, `cancelled`, `room_changed`, `time_changed` |
| `new_room_code` | text nullable | Salle corrigée |
| `new_starts_at` | timestamptz nullable | Horaire corrigé |
| `new_ends_at` | timestamptz nullable | Horaire corrigé |
| `source_integration_id` | uuid | Source officielle autorisée |
| `source_event_ref` | text | Idempotence du changement |
| `observed_at` | timestamptz | Fraîcheur affichable |
| `expires_at` | timestamptz | Empêche de réutiliser un ancien événement |
| `status` | enum | `active`, `superseded`, `revoked` |

Le modèle ne conserve pas un booléen public `teacher_present`. Une réponse sur
un cours est calculée à partir du créneau autorisé et d'un changement officiel.

### `agent_actions`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `support_request_id` | uuid nullable | Dossier `001` concerné |
| `conversation_id` | uuid nullable | Session concernée |
| `skill_version_id` | uuid | Compétence exacte utilisée |
| `service_code` | enum | Service propriétaire immuable utilisé pour cloisonner la validation |
| `tool_key` | text | Outil structuré exact de la liste blanche |
| `authority_level` | enum | `A0`, `A1`, `A2`, `A3` ; `A4` interdit en base |
| `input_redacted` | jsonb | Entrée minimale et masquée |
| `input_fingerprint` | sha256 | Empreinte de l'entrée assainie calculée côté serveur |
| `status` | enum | `planned`, `awaiting_approval`, `running`, `succeeded`, `failed`, `refused` |
| `idempotency_key_hash` | sha256 | Unique par établissement, sans conserver la clé brute |
| `requested_by_user_id` | uuid nullable | Compte nominatif ; obligatoire pour `A3` |
| `requester_ref_hash` | sha256 | Référence traçable sans exposer la session ou l'appareil |
| `tool_result` | jsonb nullable | Preuve technique sans secret |
| `confirmation_ref` | text nullable | Référence opaque fournie par l'outil |
| `requested_at` | timestamptz | Heure serveur de préparation |
| `started_at` | timestamptz nullable | Renseignée seulement au démarrage réel |
| `confirmed_at` | timestamptz nullable | Requis avant d'annoncer la réussite |

### `agent_approvals`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `action_id` | uuid | Action `A3`, une validation au maximum par action |
| `tool_key` | text | Doit correspondre exactement à l'action |
| `input_fingerprint` | sha256 | Doit correspondre exactement à l'action |
| `requested_by_user_id` | uuid | Demandeur nominatif de l'action |
| `requested_from_role` | text | Rôle habilité attendu |
| `status` | enum | `pending`, `approved`, `rejected`, `expired`, `cancelled` |
| `decision_by_user_id` | uuid nullable | Compte individuel distinct du demandeur |
| `decision_role` | text nullable | Doit correspondre au rôle attendu |
| `decision_reason` | text nullable | Obligatoire en cas de refus |
| `decided_at` | timestamptz nullable | Heure serveur de décision |
| `expires_at` | timestamptz | Empêche une vieille validation |
| `consumed_at` | timestamptz nullable | Posée atomiquement une seule fois avant exécution |

### `agent_action_audit`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `action_id` | uuid | Action concernée |
| `approval_id` | uuid nullable | Validation concernée |
| `event_type` | enum | Création, décision, consommation, démarrage ou résultat |
| `actor_user_id` | uuid nullable | Compte individuel ou événement système |
| `actor_role` | text nullable | Rôle au moment de l'événement |
| `summary` | jsonb | Métadonnées minimales sans entrée brute |
| `created_at` | timestamptz | Heure serveur immuable |

### `agent_evaluations`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire |
| `institution_id` | uuid | Cloison obligatoire |
| `skill_version_id` | uuid | Version testée |
| `test_case_key` | text | Identifiant stable |
| `result` | enum | `pass`, `fail`, `needs_review` |
| `scores` | jsonb | Nombre borné d’assertions, sans contenu utilisateur |
| `evidence` | jsonb | Mode, jeu fictif, scénario, attendu et observé bornés, sans secret |
| `run_at` | timestamptz | Heure serveur de l’exécution, postérieure au gel de la version |

### `agent_runtime_metrics`

| Champ | Type | Règle |
|---|---|---|
| `id` | uuid | Clé primaire opaque |
| `institution_id` | uuid | Cloison obligatoire |
| `operation` | enum | `support_assistant` en V1 |
| `outcome` | enum | Résultat technique fermé, jamais une erreur brute |
| `model` | text nullable | Modèle appelé, absent pour une réponse locale |
| `ai_attempted` | boolean | Appel fournisseur tenté |
| `used_ai` | boolean | Sortie IA acceptée après les contrôles locaux |
| `latency_ms` | integer | Durée bornée à 120 secondes |
| `input_tokens` | integer nullable | Usage fournisseur borné |
| `output_tokens` | integer nullable | Usage fournisseur borné |
| `total_tokens` | integer nullable | Usage fournisseur borné |
| `estimated_cost_micros` | bigint nullable | Estimation en micro-euros, jamais une facture |
| `pricing_configured` | boolean | Vrai seulement si les deux tarifs explicites existent |
| `source_count` | integer | Nombre borné de sources, sans leur identité |
| `turn_count` | integer | Nombre borné de tours, sans le texte |
| `created_at` | timestamptz | Heure serveur immuable |

Cette table ne contient ni conversation, session, compte, nom, contact, pièce
jointe, catégorie métier ou message d'erreur. Elle est append-only, sans accès
`anon` ou `authenticated`; le rôle serveur possède uniquement `SELECT/INSERT`.
La conservation finale reste soumise à la validation direction/DPO.

## Entités `001` réutilisées

- `support_requests` : dossier, établissement obligatoire et immuable, identité
  déclarée, catégorie, service, priorité et statut. L'idempotence est unique par
  établissement et les files sont indexées par établissement, statut et date.
- `support_messages` : échanges usager-agent avec auteur et canal. L'idempotence
  d'un message est unique dans son dossier, jamais globalement.
- `support_attachments` : métadonnées et référence de stockage privé.
- `support_events` : historique immuable des transitions.
- `support_notifications` : envoi durable, nouvelles tentatives et preuve.

La migration `20260830020355` ajoute `institution_id` à `support_requests`,
refuse sa modification, force RLS et retire tout accès client direct. Les tables
techniques de notification qui ne portent pas encore ce champ restent en mode
mono-établissement fermé. `source_channel`, `identity_assurance_level` et
`retention_policy` restent à ajouter seulement si leur usage le justifie.

## Contraintes de sécurité

- Un compte ne lit que les établissements et services présents dans ses adhésions actives.
- Un parent ou élève ne lit que ses propres dossiers après vérification adaptée.
- Un OTP sur un contact déclaré ne crée jamais seul une ligne
  `school_identities` au niveau `directory_matched` ou `official_sso`.
- Une lecture d'emploi du temps exige une identité scolaire active et une
  relation active vers la classe, le groupe ou la personne concernée.
- Une référence enseignant n'est jamais exposée dans une API publique permettant
  de suivre sa présence ou sa localisation.
- Une source `sensitive` ne peut jamais être injectée automatiquement dans le modèle généraliste.
- Une source interne, personnelle ou sensible est contrôlée par établissement,
  rôle, service et voie d'accès ; un rôle administrateur ne contourne pas ce
  périmètre par défaut.
- Une action `A3` exige une validation active, non expirée, indépendante, liée
  à l'entrée exacte et consommée atomiquement avant `running`.
- Le service de l'action est obligatoire et immuable. Une décision est refusée
  si ce service n'appartient pas au périmètre persistant du valideur.
- Une action `A4` ne peut pas être créée dans `agent_actions`.
- Une réussite exige `started_at`, `tool_result`, `confirmation_ref` et
  `confirmed_at` cohérents avec l'heure serveur.
- Les actions, validations et audits sont privés, non supprimables par le rôle
  serveur et sans accès direct `anon` ou `authenticated`.
- La suppression logique préserve l'audit ; la purge physique suit la politique de rétention.
- Les journaux excluent mots de passe, codes à usage unique, secrets API et contenu intégral des pièces.

## Index et résilience

- Index sur `(institution_id, status, created_at)` pour demandes, actions et validations.
- Index sur `(institution_id, skill_key)` et `(skill_id, version)`.
- Index sur sources publiées et non expirées.
- Index sur `(institution_id, official_person_ref, status)` et sur les relations
  actives par identité.
- Index sur `(institution_id, starts_at, class_ref, group_ref)` pour les créneaux
  et sur `(institution_id, base_slot_id, observed_at)` pour les changements.
- Contraintes uniques sur `idempotency_key` par intégration.
- Transactions pour confirmer ensemble action, événement et notification à produire.
- File de quarantaine pour les traitements définitivement échoués, sans perte silencieuse.
