begin;

create table public.site_content_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  content_type text not null check (content_type in ('article', 'alerte', 'page', 'document')),
  description text not null default '' check (char_length(description) <= 500),
  default_title text not null default '' check (char_length(default_title) <= 180),
  default_summary text not null default '' check (char_length(default_summary) <= 600),
  default_body_markdown text not null default '' check (char_length(default_body_markdown) <= 30000),
  active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_content_items (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('article', 'alerte', 'page', 'document')),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 2 and 180),
  summary text not null default '' check (char_length(summary) <= 600),
  body_markdown text not null default '' check (char_length(body_markdown) <= 30000),
  category text not null default 'Vie du lycée' check (char_length(category) between 2 and 100),
  audience text not null default 'tous' check (audience in ('tous', 'eleves', 'parents', 'personnels', 'professeurs')),
  status text not null default 'brouillon' check (status in ('brouillon', 'a_valider', 'publie', 'archive')),
  template_id uuid references public.site_content_templates(id) on delete set null,
  featured boolean not null default false,
  meta_title text check (meta_title is null or char_length(meta_title) <= 180),
  meta_description text check (meta_description is null or char_length(meta_description) <= 320),
  publish_at timestamptz,
  expires_at timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > coalesce(publish_at, published_at, created_at)),
  check (status <> 'publie' or (approved_by is not null and published_at is not null))
);

create table public.site_content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.site_content_items(id) on delete restrict,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (content_id, version)
);

create table public.site_content_assets (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null default 'site-content' check (storage_bucket = 'site-content'),
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text not null check (
    mime_type in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  ),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  asset_kind text not null check (asset_kind in ('image', 'document')),
  title text not null check (char_length(title) between 1 and 180),
  alt_text text check (alt_text is null or char_length(alt_text) <= 300),
  status text not null default 'pending' check (status in ('pending', 'ready', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (asset_kind <> 'image' or (alt_text is not null and char_length(trim(alt_text)) > 0))
);

create table public.site_content_asset_links (
  content_id uuid not null references public.site_content_items(id) on delete cascade,
  asset_id uuid not null references public.site_content_assets(id) on delete restrict,
  asset_role text not null check (asset_role in ('couverture', 'illustration', 'document')),
  public_label text not null check (char_length(public_label) between 1 and 180),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (content_id, asset_id)
);

create table public.site_content_audit (
  id bigint generated always as identity primary key,
  resource_type text not null check (resource_type in ('content', 'template', 'asset')),
  resource_id uuid not null,
  action text not null check (action in ('create', 'update', 'submit_review', 'publish', 'archive', 'duplicate', 'restore', 'upload', 'confirm_upload')),
  actor_id uuid references auth.users(id) on delete set null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index site_content_publication_idx
  on public.site_content_items (status, publish_at, expires_at, featured, updated_at desc);
create index site_content_filter_idx
  on public.site_content_items (content_type, status, category, updated_at desc);
create index site_content_versions_idx
  on public.site_content_versions (content_id, version desc);
create index site_content_assets_status_idx
  on public.site_content_assets (status, created_at desc);
create index site_content_audit_resource_idx
  on public.site_content_audit (resource_type, resource_id, created_at desc);

create trigger site_content_templates_set_updated_at
before update on public.site_content_templates
for each row execute function public.set_updated_at();

create trigger site_content_items_set_updated_at
before update on public.site_content_items
for each row execute function public.set_updated_at();

create trigger site_content_assets_set_updated_at
before update on public.site_content_assets
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-content',
  'site-content',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.site_content_templates (
  slug, name, content_type, description, default_title, default_summary, default_body_markdown
)
values
  (
    'actualite', 'Actualité du lycée', 'article',
    'Information générale destinée à la communauté scolaire.', '', '',
    E'## L’essentiel\n\nPrésentez l’information principale en quelques lignes.\n\n## À retenir\n\n- Date ou échéance\n- Public concerné\n- Contact ou démarche utile'
  ),
  (
    'information-urgente', 'Information urgente', 'alerte',
    'Message bref et prioritaire avec une durée de validité.', '', '',
    E'Indiquez clairement la situation, les personnes concernées et la conduite à tenir.\n\n**Mise à jour :** précisez la date et l’heure.'
  ),
  (
    'evenement', 'Événement', 'article',
    'Annonce d’une réunion, rencontre, sortie ou action du lycée.', '', '',
    E'## Programme\n\nDécrivez l’événement.\n\n## Informations pratiques\n\n- Date et heure\n- Lieu\n- Inscription éventuelle'
  ),
  (
    'document-administratif', 'Document administratif', 'document',
    'Publication d’un formulaire, calendrier ou document public.', '', '',
    E'Présentez l’objet du document, le public concerné, sa date de validité et la démarche à suivre.'
  ),
  (
    'formation', 'Information formation', 'page',
    'Présentation durable d’une formation ou d’un parcours.', '', '',
    E'## Présentation\n\nDécrivez la formation.\n\n## Compétences et enseignements\n\n- Point principal\n\n## Poursuites et débouchés\n\nPrécisez les possibilités après la formation.'
  );

alter table public.site_content_templates enable row level security;
alter table public.site_content_items enable row level security;
alter table public.site_content_versions enable row level security;
alter table public.site_content_assets enable row level security;
alter table public.site_content_asset_links enable row level security;
alter table public.site_content_audit enable row level security;

revoke all on table
  public.site_content_templates,
  public.site_content_items,
  public.site_content_versions,
  public.site_content_assets,
  public.site_content_asset_links,
  public.site_content_audit
from anon, authenticated;

revoke all on sequence public.site_content_audit_id_seq from anon, authenticated;

alter table public.support_rate_limits
  drop constraint support_rate_limits_scope_check;

alter table public.support_rate_limits
  add constraint support_rate_limits_scope_check check (
    scope in (
      'assistant_session',
      'assistant_network',
      'request_network',
      'message_session',
      'magic_token_network',
      'content_ai_user'
    )
  );

commit;
