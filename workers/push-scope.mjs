import { flashViewerGroups } from '../shared/flash-audience-groups.mjs';

// Recomputed from the active directory for every dispatch, never browser claims.
export async function pushSubject(sql, sub) {
  const [school] = await sql`select id from institutions where id=${sub.institution_id} and status in ('active','pilot')`;
  if (!school) return null;
  if (sub.identity_session_id) {
    const rows = await sql`select ds.source_import_id,ds.person_ref,ds.person_type,p.class_ref
      from identity_device_sessions ds
      join identity_directory_imports i on i.id=ds.source_import_id and i.institution_id=ds.institution_id and i.status='active'
      join identity_directory_rows p on p.import_id=i.id and p.institution_id=i.institution_id and p.person_ref=ds.person_ref
        and p.record_type='person' and p.person_type=ds.person_type and p.validation_status in ('valid','warning')
        and (p.valid_from is null or p.valid_from<=(now() at time zone 'Europe/Paris')::date)
        and (p.valid_until is null or p.valid_until>=(now() at time zone 'Europe/Paris')::date)
      where ds.id=${sub.identity_session_id} and ds.institution_id=${sub.institution_id} and ds.revoked_at is null
        and ds.expires_at>now() and ds.absolute_expires_at>now()
        and ds.assurance_level in ('directory_email_otp','directory_phone_otp') limit 2`;
    if(rows.length!==1 || !['student','guardian','staff'].includes(rows[0].person_type))return null;
    const person=rows[0];let classes=[person.class_ref];
    if(person.person_type==='guardian') {
      const children=await sql`select distinct p.person_ref,p.class_ref from identity_directory_rows r
        join identity_directory_rows p on p.institution_id=r.institution_id and p.import_id=r.import_id and p.person_ref=r.object_ref
          and p.record_type='person' and p.person_type='student' and p.validation_status in ('valid','warning')
          and (p.valid_from is null or p.valid_from<=(now() at time zone 'Europe/Paris')::date)
          and (p.valid_until is null or p.valid_until>=(now() at time zone 'Europe/Paris')::date)
        where r.institution_id=${sub.institution_id} and r.import_id=${person.source_import_id} and r.record_type='relationship'
          and r.relationship_type='guardian_of' and r.subject_person_ref=${person.person_ref} and r.validation_status='valid'
          and r.valid_from<=(now() at time zone 'Europe/Paris')::date
          and (r.valid_until is null or r.valid_until>=(now() at time zone 'Europe/Paris')::date) limit 21`;
      classes=children.length<=20?children.map(p=>p.class_ref):[];
    }
    return {groups:flashViewerGroups(person.person_type,classes),identity:person};
  }
  if(sub.user_id) {
    const [user]=await sql`select u.id from auth.users u join institution_memberships m on m.user_id=u.id
      where u.id=${sub.user_id} and m.institution_id=${sub.institution_id} and m.status='active'
      and (u.banned_until is null or u.banned_until<now())
      and u.raw_app_meta_data->>'role' in ('superadmin','proviseur','agent','administration','professeur') limit 1`;
    return user?{groups:flashViewerGroups('staff')}:null;
  }
  const [session]=await sql`select s.id from support_device_sessions s where s.id=${sub.session_id} and s.revoked_at is null and s.expires_at>now()
    and exists(select 1 from support_session_requests sr join support_requests r on r.id=sr.request_id
      where sr.session_id=s.id and r.institution_id=${sub.institution_id} and r.retention_until>now()
      and (s.access_contact_id is null or exists(select 1 from support_contacts c where c.id=s.access_contact_id
        and c.request_id=r.id and c.channel='email' and c.usage_scope='support' and c.disabled_at is null)))`;
  return session?{groups:['public:site']}:null;
}
