# Modèle de données

## 1. Tables principales

### `support_requests`

Une ligne par demande, source de vérité de son état.

- `id uuid primary key`
- `public_code text unique not null`
- `idempotency_key_hash text unique not null`
- `requester_type text not null`
- `requester_first_name text not null`
- `requester_last_name text not null`
- `beneficiary_type text not null`
- `beneficiary_first_name text`
- `beneficiary_last_name text`
- `student_id uuid null references eleves`
- `class_id uuid null references classes`
- `professeur_id uuid null references professeurs`
- `subject_context jsonb not null default '{}'`
- `category text not null`
- `subcategory text`
- `subject text not null`
- `description text not null`
- `status text not null default 'nouveau'`
- `priority text not null default 'p3'`
- `priority_reason text`
- `preferred_channel text not null`
- `fallback_allowed boolean not null default false`
- `assigned_to uuid null references auth.users`
- `assigned_team text`
- `sla_due_at timestamptz`
- `resolved_at timestamptz`
- `closed_at timestamptz`
- `retention_until timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Index : `(status, priority, created_at)`, `(assigned_to, status, sla_due_at)`,
`(category, created_at)`, `(class_id, created_at)`.

### `support_contacts`

Coordonnées liées à une demande ou à une personne connue.

- `id uuid primary key`
- `request_id uuid references support_requests on delete cascade`
- `person_type text not null`
- `person_reference_id uuid`
- `channel text not null` : `email` ou `phone`
- `value text not null`
- `normalized_hash text not null`
- `is_primary boolean not null default false`
- `is_verified boolean not null default false`
- `verification_source text`
- `usage_scope text not null default 'support'`
- `verified_at timestamptz`
- `disabled_at timestamptz`
- `created_at timestamptz not null default now()`

La valeur doit rester accessible au serveur pour communiquer. Le hash sert aux
recherches de doublons sans exposer la valeur dans les logs.

### `support_messages`

Fil canonique de conversation.

- `id uuid primary key`
- `request_id uuid not null references support_requests on delete cascade`
- `direction text not null` : `inbound`, `outbound`, `internal`
- `channel text not null` : `web`, `email`, `sms`, `phone`, `system`
- `author_user_id uuid`
- `author_label text`
- `body_text text not null`
- `body_html_sanitized text`
- `provider text`
- `provider_message_id text`
- `in_reply_to text`
- `delivery_status text not null default 'stored'`
- `validated_by uuid`
- `validated_at timestamptz`
- `created_at timestamptz not null default now()`

Contraintes uniques partielles sur `provider + provider_message_id`.

### `support_attachments`

- `id uuid primary key`
- `request_id uuid not null references support_requests on delete cascade`
- `message_id uuid references support_messages on delete cascade` : vide pendant
  un brouillon agent, obligatoire dès sa libération au demandeur
- `concerns_type text not null`
- `concerns_label text`
- `document_type text not null`
- `note text`
- `original_name text not null`
- `declared_mime text not null`
- `detected_mime text`
- `size_bytes bigint not null`
- `sha256 text`
- `storage_bucket text not null`
- `storage_path text not null unique`
- `scan_status text not null default 'awaiting_upload'`
- `scan_detail text`
- `direction text not null` : `requester` ou `agent`
- `uploaded_by_session uuid`
- `uploaded_by_user uuid` : propriétaire d'un brouillon agent
- `released_at timestamptz`
- `released_by uuid`
- `retention_until timestamptz not null`
- `uploaded_at timestamptz`
- `created_at timestamptz not null default now()`

Le navigateur ne recoit qu'une autorisation temporaire pour un chemin unique.
Apres l'envoi, le serveur recalcule la taille, le type et l'empreinte du fichier,
puis le conserve en quarantaine jusqu'au controle antivirus.

Un brouillon agent propre, refusé ou en erreur de contrôle peut être retiré par
son propriétaire. Il passe d'abord à `removal_pending` sous le verrou du dossier,
puis le fichier privé est supprimé avant la ligne. L'événement
`attachment.draft_removed` ne contient ni nom ni contenu. Une pièce liée à un
message ne peut plus suivre ce parcours de retrait.

### `support_events`

Journal append-only.

- `id bigint generated always as identity primary key`
- `request_id uuid not null references support_requests on delete cascade`
- `event_type text not null`
- `actor_type text not null`
- `actor_id text`
- `from_value jsonb`
- `to_value jsonb`
- `correlation_id uuid not null`
- `created_at timestamptz not null default now()`

Aucune politique UPDATE ou DELETE pour les agents.

## 2. Accès public sécurisé

### `support_magic_tokens`

- `id uuid primary key`
- `request_id uuid not null references support_requests on delete cascade`
- `token_hash text unique not null`
- `purpose text not null`
- `expires_at timestamptz not null`
- `used_at timestamptz`
- `attempt_count integer not null default 0`
- `created_at timestamptz not null default now()`

### `support_device_sessions`

- `id uuid primary key`
- `session_hash text unique not null`
- `label text`
- `last_used_at timestamptz not null default now()`
- `expires_at timestamptz not null`
- `revoked_at timestamptz`
- `created_at timestamptz not null default now()`

### `support_session_requests`

- `session_id uuid references support_device_sessions on delete cascade`
- `request_id uuid references support_requests on delete cascade`
- `granted_at timestamptz not null default now()`
- clé primaire `(session_id, request_id)`

Le cookie contient le jeton brut ; la base ne contient que son hash.

## 3. Automatisation et communication

### Queue `support-jobs`

La Basic Queue Supabase est créée avec `pgmq`. Le message contient seulement :

- `job_id uuid`
- `request_id uuid`
- `message_id uuid null`
- `job_type text`
- `idempotency_key text`
- `attempt integer`
- `payload_minimal jsonb`

L'appel `pgmq.send` s'exécute dans la transaction qui crée la demande ou la
réponse. Le payload ne contient aucun secret et minimise les données.

### `support_job_runs`

Journal compact d'exécution et d'observabilité.

- `id uuid primary key`
- `institution_id uuid not null references institutions on delete restrict`
- `job_id uuid not null`
- `job_type text not null`
- `request_id uuid not null`
- `attempt integer not null`
- `status text not null`
- `provider_reference text`
- `error_code text`
- `duration_ms integer`
- `created_at timestamptz not null default now()`

### `support_failed_jobs`

File d'échec administrable après épuisement des relances.

- `id uuid primary key`
- `institution_id uuid not null references institutions on delete restrict`
- `job_id uuid not null`
- `request_id uuid not null`
- `job_type text not null`
- `payload_redacted jsonb not null`
- `attempts integer not null`
- `last_error_code text`
- `last_error_summary text`
- `failed_at timestamptz not null default now()`
- `retried_by uuid`
- `retried_at timestamptz`

### `support_delivery_events`

- `id uuid primary key`
- `institution_id uuid not null references institutions on delete restrict`
- `message_id uuid references support_messages on delete cascade`
- `provider text not null`
- `provider_event_id text not null`
- `event_type text not null`
- `occurred_at timestamptz not null`
- `payload_redacted jsonb`
- `created_at timestamptz not null default now()`

Unique `(institution_id, provider, provider_event_id, event_type)`.

### `support_webhook_receipts`

Reçoit d'abord les webhooks pour garantir idempotence et audit.

- `id uuid primary key`
- `institution_id uuid not null references institutions on delete restrict`
- `provider text not null`
- `external_id text not null`
- `payload_hash text not null`
- `status text not null default 'received'`
- `processed_at timestamptz`
- `error_code text`
- `created_at timestamptz not null default now()`

Unique `(institution_id, provider, external_id, payload_hash)`.

Pour les quatre tables techniques, l'établissement est immuable. Les jobs et
échecs possèdent en plus une clé étrangère composite
`(request_id, institution_id)` afin d'interdire tout rattachement à un dossier
d'un autre établissement. Un événement de livraison est contrôlé contre le
message et sa demande avant insertion.

### `support_callback_tasks`

- `id uuid primary key`
- `request_id uuid not null references support_requests on delete cascade`
- `phone_contact_id uuid not null references support_contacts`
- `assigned_to uuid`
- `due_at timestamptz`
- `status text not null default 'todo'`
- `outcome text`
- `completed_at timestamptz`
- `created_at timestamptz not null default now()`

## 4. Agent et connaissances

### `support_templates`

- catégorie, nom, sujet, corps, variables autorisées, version, actif,
  auteur et dates.

### `support_ai_runs`

- demande, message source, objectif, fournisseur, modèle, version de consigne,
  empreinte de l'entrée pseudonymisée, résultat structuré, confiance, coût,
  durée, statut, validateur et date de purge.

### `support_saved_views`

- agent, nom, filtres JSON, tri, vue par défaut.

### `support_agent_presence`

- agent, dernière activité, capacité maximale, catégories autorisées.

## 5. RLS et accès

- Les routes publiques passent par des fonctions serveur dédiées.
- `anon` n'obtient aucun SELECT direct sur les tables support.
- Une session publique ne peut lire que le dossier lié à son hash de session.
- Un agent lit les dossiers de son périmètre ou qui lui sont assignés.
- La direction lit tout et réattribue.
- Seul l'administrateur gère catégories, modèles et canaux.
- Les notes internes ne sont jamais retournées au demandeur.
- Les objets Storage utilisent les mêmes règles de dossier et de scan.
- Les secrets fournisseur sont hors base publique, dans les variables serveur.

## 6. Contraintes de cohérence

- Toute réponse externe possède un `support_message` et un job `pgmq` validés
  dans la même transaction.
- Toute transition de statut ajoute un `support_event`.
- `resolu` exige une réponse sortante ou un motif interne non vide.
- `clos` exige `resolved_at`.
- Un fichier `clean` doit posséder un résultat antivirus.
- Un contact utilisé pour une information sensible doit être vérifié.
- La suppression d'un dossier suit une procédure d'anonymisation et d'audit.
