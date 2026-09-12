import {readFile} from 'node:fs/promises';
export async function addPushFlashSchema(sql) {
  await sql.unsafe(`alter table support_requests add retention_until timestamptz default now()+interval '1 year';
    alter table support_events add actor_id text;
    create table identity_directory_imports(id uuid primary key,institution_id uuid,status text);
    create table identity_directory_rows(institution_id uuid,import_id uuid,person_ref text,person_type text,record_type text,
      validation_status text,class_ref text,valid_from date,valid_until date,relationship_type text,subject_person_ref text,object_ref text);
    create table identity_device_sessions(id uuid primary key,institution_id uuid,source_import_id uuid,person_ref text,person_type text,
      revoked_at timestamptz,expires_at timestamptz,absolute_expires_at timestamptz,assurance_level text);
    create table knowledge_sources(id uuid primary key,status text);
    create table knowledge_source_proposals(source_id uuid,institution_id uuid,origin_flash_info_id uuid,status text);`);
  for(const file of ['20260905013000_create_flash_info_foundation.sql','20260905130000_add_flash_publication_actor.sql','20260905140000_add_flash_expired_after_validation_status.sql','20260905150000_add_flash_notification_dispatch_simulation.sql','20260912004512_school_flash_push.sql','20260912085951_push_identity_binding.sql']) {
    await sql.unsafe(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
  }
}
