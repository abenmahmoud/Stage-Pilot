import { validPushEndpoint } from '../shared/web-push-policy.mjs';
import { pushSubject } from './push-scope.mjs';

// Lock-screen messages deliberately contain no article text or recipient details.
export function flashPushNotice(removed = false) {
  return { kind: removed ? 'flash_removed' : 'flash', destination: '/?view=home' };
}

export async function dispatchFlashPush(sql, send, limit = 100) {
  const stats = { checked: 0, sent: 0, uncertain: 0, rejected: 0 };
  const candidates = await sql`select s.id from support_push_subscriptions s
    where s.flash_since is not null and s.disabled_at is null and s.expires_at>now()
      and exists(select 1 from flash_info_versions v join flash_infos f on f.id=v.flash_info_id and f.published_version=v.version
        where v.institution_id=s.institution_id and v.status='publiee' and v.expires_at>now()
          and v.push_authorized_at>=s.flash_since and v.push_authorized_at>now()-interval '24 hours'
          and not exists(select 1 from support_push_deliveries d where d.subscription_id=s.id and d.flash_version_id=v.id))
    order by s.updated_at limit ${limit}`;
  for (const candidate of candidates) {
    const batch = await sql.begin(async tx => {
      const [sub] = await tx`select * from support_push_subscriptions where id=${candidate.id}
        and flash_since is not null and disabled_at is null and expires_at>now() for update skip locked`;
      if (!sub) return [];
      stats.checked++;
      await tx`update support_push_subscriptions set updated_at=now() where id=${sub.id}`;
      const subject = await pushSubject(tx, sub);
      if (!subject) return [];
      const versions = await tx`select v.id,v.flash_info_id,v.version,v.importance from flash_info_versions v
        join flash_infos f on f.id=v.flash_info_id and f.institution_id=v.institution_id and f.published_version=v.version
        where v.institution_id=${sub.institution_id} and v.status='publiee' and v.expires_at>now()
          and v.push_authorized_at>=${sub.flash_since} and v.push_authorized_at>now()-interval '24 hours'
          and not exists(select 1 from support_push_deliveries d where d.subscription_id=${sub.id} and d.flash_version_id=v.id)
        order by v.push_authorized_at limit 20`;
      const batch=[];
      for (const version of versions) {
        const groups=await tx`select group_ref from flash_info_audiences where version_id=${version.id} and institution_id=${sub.institution_id}`;
        const matched=groups.some(g=>subject.groups.includes(g.group_ref));
        let previouslyNotified=false;
        if (version.version>1) {
          const [previous]=await tx`select d.kind from support_push_deliveries d join flash_info_versions v on v.id=d.flash_version_id
            where d.subscription_id=${sub.id} and d.status='sent'
              and v.flash_info_id=${version.flash_info_id} and v.institution_id=${sub.institution_id} and v.version<${version.version} order by v.version desc limit 1`;
          previouslyNotified=previous?.kind==='flash';
        }
        const included=matched&&(version.importance!=='normale'||previouslyNotified);
        const removed=!matched&&previouslyNotified;
        if (!included && !removed) continue;
        const kind=removed?'flash_removed':'flash';
        const [reserved]=await tx`insert into support_push_deliveries(subscription_id,flash_version_id,kind,status)
          values(${sub.id},${version.id},${kind},'reserved') on conflict do nothing returning id`;
        if(reserved)batch.push({id:reserved.id,sub,version,kind});
      }
      return batch;
    });
    for(const item of batch) {
      let status='rejected';
      try {
        // Recheck after reservation: logout, opt-out, expiry and a new correction cancel an unsent alert.
        const [sub]=await sql`select s.* from support_push_subscriptions s join flash_info_versions v on v.id=${item.version.id}
          join flash_infos f on f.id=v.flash_info_id and f.institution_id=s.institution_id and f.published_version=v.version
          where s.id=${item.sub.id} and s.disabled_at is null and s.expires_at>now() and s.flash_since is not null
            and v.push_authorized_at>=s.flash_since and v.status='publiee' and v.expires_at>now()`;
        const subject=sub?await pushSubject(sql,sub):null;
        const groups=subject?await sql`select group_ref from flash_info_audiences where version_id=${item.version.id} and institution_id=${sub.institution_id}`:[];
        const included=subject&&groups.some(g=>subject.groups.includes(g.group_ref));
        if(subject && (item.kind==='flash'?included:!included) && validPushEndpoint(sub.subscription?.endpoint)) {
          await send(sub.subscription,JSON.stringify(flashPushNotice(item.kind==='flash_removed')));
          status='sent';stats.sent++;
          if(item.kind==='flash')await sql`update flash_notification_dispatches set status='sent',sent_at=now()
            where institution_id=${sub.institution_id} and version_id=${item.version.id} and channel='push'
              and group_ref=any(${subject.groups}::text[]) and status='simulated'`;
        } else stats.rejected++;
      } catch(error) {
        status=[400,401,403,404,410].includes(error?.statusCode)?'rejected':'uncertain';stats[status]++;
        if([404,410].includes(error?.statusCode))await sql`update support_push_subscriptions set disabled_at=now() where id=${item.sub.id}`;
      }
      await sql`update support_push_deliveries set status=${status} where id=${item.id}`;
    }
  }
  return stats;
}
