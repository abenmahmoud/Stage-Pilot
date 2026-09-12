import postgres from 'postgres';
import webpush from 'web-push';
import { pushSubject } from './push-scope.mjs';
import { dispatchFlashPush } from './flash-push-worker.mjs';
import { validPushEndpoint, pushNotice } from '../shared/web-push-policy.mjs';

// Durable reservations coalesce changes; an uncertain provider outcome is never replayed blindly.
export async function dispatchSupportPush(sql, send, limit = 100) {
  const stats = { checked: 0, sent: 0, uncertain: 0, rejected: 0 };
  const candidates = await sql`select id from public.support_push_subscriptions where disabled_at is null and expires_at > now() order by updated_at limit ${limit}`;
  await sql`update public.support_push_deliveries set status='uncertain' where status='reserved' and created_at<now()-interval '5 minutes'`;
  for (const candidate of candidates) {
    const delivery = await sql.begin(async tx => {
      const [sub] = await tx`select * from public.support_push_subscriptions where id = ${candidate.id} and disabled_at is null and expires_at > now() for update skip locked`;
      if (!sub) return null;
      stats.checked++;
      const subject = await pushSubject(tx, sub);
      if (!subject) { await tx`update support_push_subscriptions set updated_at=now() where id=${sub.id}`; return null; }
      const ownerHash = subject.identity ? sub.identity_owner_hash : null;
      const [{ watermark }] = await tx`select coalesce(max(id),0)::text as watermark from public.support_events`;
      let events;
      if (sub.session_id) {
        events = await tx`select e.id from public.support_events e join public.support_requests r on r.id=e.request_id
          join public.support_session_requests sr on sr.request_id=r.id join public.support_device_sessions ds on ds.id=sr.session_id
          where sr.session_id=${sub.session_id} and ds.revoked_at is null and ds.expires_at>now() and r.institution_id=${sub.institution_id}
          and (ds.access_contact_id is null or exists(select 1 from public.support_contacts c where c.id=ds.access_contact_id
            and c.request_id=r.id and c.channel='email' and c.usage_scope='support' and c.disabled_at is null))
          and r.retention_until>now()
          and (${sub.identity_session_id}::uuid is null or exists(select 1 from support_events bound where bound.request_id=r.id
            and bound.event_type='request.identity_bound' and bound.actor_type='system' and bound.actor_id=${ownerHash}))
          and e.created_at>=${sub.created_at} and not exists(select 1 from public.support_push_deliveries d where d.subscription_id=${sub.id} and d.event_id=e.id)
          and e.created_at > now()-interval '24 hours'
          and (e.event_type in ('reply.queued','request.updated') or (e.event_type='callback.created' and e.actor_type='agent')) order by e.id limit 50`;
      } else if (sub.user_id) {
        events = await tx`select e.id from public.support_events e join public.support_requests r on r.id=e.request_id
          join public.institution_memberships m on m.institution_id=r.institution_id and m.user_id=${sub.user_id}
          join auth.users u on u.id=m.user_id join public.institutions i on i.id=m.institution_id
          where r.institution_id=${sub.institution_id} and m.status='active' and i.status in ('active','pilot')
          and (u.banned_until is null or u.banned_until < now())
          and ((u.raw_app_meta_data->>'role' in ('superadmin','proviseur') and m.role='admin')
            or (u.raw_app_meta_data->>'role' in ('agent','administration') and m.role in ('agent','service_manager','admin')
              and r.assigned_team=any(m.service_codes)))
          and e.created_at>=${sub.created_at} and not exists(select 1 from public.support_push_deliveries d where d.subscription_id=${sub.id} and d.event_id=e.id) and e.created_at>now()-interval '24 hours'
          and e.event_type in ('request.created','message.received','callback.requested','request.updated') order by e.id limit 50`;
      } else events=[];
      await tx`update public.support_push_subscriptions set last_event_id=${watermark}, updated_at=now() where id=${sub.id}`;
      if (!events.length) return null;
      const reservations = [];
      for (const event of events) {
        const [reservation] = await tx`insert into public.support_push_deliveries(subscription_id,event_id,status)
          values(${sub.id},${event.id},'reserved') on conflict do nothing returning id`;
        if (reservation) reservations.push(reservation.id);
      }
      return reservations.length ? { ids: reservations, sub, notice: pushNotice(Boolean(sub.user_id)) } : null;
    });
    if (!delivery) continue;
    let status = 'sent';
    try {
      const [active] = await sql`select * from support_push_subscriptions where id=${delivery.sub.id} and disabled_at is null and expires_at>now()`;
      if (!active || !await pushSubject(sql, active)) throw Object.assign(new Error('access_expired'), {statusCode:403});
      if (!validPushEndpoint(delivery.sub.subscription?.endpoint)) throw Object.assign(new Error('invalid_endpoint'), { statusCode: 410 });
      await send(delivery.sub.subscription, JSON.stringify(delivery.notice));
      stats.sent++;
    } catch (error) {
      status = [400,401,403,404,410].includes(error?.statusCode) ? 'rejected' : 'uncertain';
      stats[status]++;
      if ([404,410].includes(error?.statusCode)) await sql`update public.support_push_subscriptions set disabled_at=now() where id=${delivery.sub.id}`;
    }
    await sql`update public.support_push_deliveries set status=${status} where id=any(${delivery.ids}::uuid[])`;
  }
  return stats;
}

if (process.argv.includes('--run')) {
  if (process.env.SUPPORT_PUSH_ENABLED !== 'true') throw new Error('Push worker is disabled');
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 10 });
  webpush.setVapidDetails('mailto:ce.0932048w@ac-creteil.fr', process.env.SUPPORT_PUSH_PUBLIC_KEY, process.env.SUPPORT_PUSH_PRIVATE_KEY);
  try {
    console.log(JSON.stringify(await dispatchSupportPush(sql, (subscription, payload) => webpush.sendNotification(subscription, payload, { TTL: 3600, urgency: 'normal', timeout: 10000 }))));
    if (process.env.SUPPORT_FLASH_PUSH_ENABLED === 'true') console.log(JSON.stringify({flash:await dispatchFlashPush(sql,(subscription,payload)=>webpush.sendNotification(subscription,payload,{TTL:3600,urgency:'normal',timeout:10000}))}));
    await sql`delete from public.support_push_subscriptions where expires_at<now()-interval '7 days' or disabled_at<now()-interval '7 days'`;
    await sql`delete from public.support_push_deliveries where created_at<now()-interval '30 days'`;
  } finally { await sql.end({ timeout: 5 }); }
}
