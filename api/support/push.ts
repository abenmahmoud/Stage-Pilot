import { createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { client } from "../../db/index.js";
import { HttpError } from "../_shared/auth.js";
import { requireSupportAgent } from "../_shared/support-agent-access.js";
import { requireConfiguredInstitution } from "../_shared/institution-context.js";
import { readSupportSessionToken, sha256 } from "../_shared/support.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { parsePushSubscription } from "../../shared/web-push-policy.mjs";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!["GET", "POST", "DELETE"].includes(req.method ?? "")) return methodNotAllowed(res, ["GET", "POST", "DELETE"]);
  return handleApi(res, async () => {
    const publicKey = process.env.SUPPORT_PUSH_PUBLIC_KEY;
    const enabled = process.env.SUPPORT_PUSH_ENABLED === "true" && Boolean(publicKey);
    if (req.method === "GET") return { available: enabled, publicKey: enabled ? publicKey : null };
    if (!enabled) throw new HttpError(503, "Les notifications ne sont pas encore disponibles.");
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new HttpError(403, "Origine non autorisée.");
    const institution = await requireConfiguredInstitution();
    let sessionId: string | null = null;
    let userId: string | null = null;
    if (req.query.audience !== undefined && !["agent", "requester"].includes(String(req.query.audience))) throw new HttpError(400, "Espace invalide.");
    if (req.query.audience === "agent") {
      const agent = await requireSupportAgent(req);
      userId = agent.user.id;
    } else {
      const token = readSupportSessionToken(req);
      if (!token) throw new HttpError(401, "Ouvrez d’abord Mes demandes sur cet appareil.");
      const [session] = await client`
        select s.id from public.support_device_sessions s
        where s.session_hash = ${sha256(token)} and s.revoked_at is null and s.expires_at > now()
        and exists(select 1 from public.support_session_requests sr join public.support_requests r on r.id = sr.request_id
          where sr.session_id = s.id and r.institution_id = ${institution.id}
            and (s.access_contact_id is null or exists(select 1 from public.support_contacts c where c.id=s.access_contact_id
              and c.request_id=r.id and c.channel='email' and c.usage_scope='support' and c.disabled_at is null))) limit 1`;
      if (!session) throw new HttpError(401, "Votre accès au suivi a expiré. Reconnectez-vous.");
      sessionId = session.id;
    }
    let subscription;
    try { subscription = parsePushSubscription(req.body); }
    catch { throw new HttpError(400, "L’abonnement aux notifications est invalide."); }
    const hash = createHash("sha256").update(subscription.endpoint).digest("hex");
    try {
      return await client.begin(async tx => {
        await tx`select pg_advisory_xact_lock(hashtext(${sessionId ?? userId!}))`;
        if (req.method === "DELETE") {
          await tx`update public.support_push_subscriptions set disabled_at = now() where endpoint_hash = ${hash}
            and institution_id = ${institution.id} and session_id is not distinct from ${sessionId}::uuid and user_id is not distinct from ${userId}::uuid`;
          return { enabled: false };
        }
        const [{ count }] = await tx`select count(*)::int as count from public.support_push_subscriptions
          where disabled_at is null and expires_at > now() and endpoint_hash <> ${hash}
          and session_id is not distinct from ${sessionId}::uuid and user_id is not distinct from ${userId}::uuid`;
        if (count >= 8) throw new HttpError(429, "Trop d’appareils inscrits. Désactivez un ancien appareil.");
        const saved = await tx`insert into public.support_push_subscriptions (institution_id, session_id, user_id, endpoint_hash, subscription, last_event_id)
          values (${institution.id}, ${sessionId}, ${userId}, ${hash}, ${tx.json(subscription)}, (select coalesce(max(id),0) from public.support_events))
          on conflict(endpoint_hash) do update set subscription = excluded.subscription, updated_at = now(), disabled_at = null,
            expires_at = now() + interval '30 days', last_event_id = greatest(public.support_push_subscriptions.last_event_id, excluded.last_event_id)
          where public.support_push_subscriptions.institution_id = excluded.institution_id
            and public.support_push_subscriptions.session_id is not distinct from excluded.session_id
            and public.support_push_subscriptions.user_id is not distinct from excluded.user_id returning id`;
        if (!saved.length) throw new HttpError(409, "Désactivez les notifications avant de changer de compte sur cet appareil.");
        return { enabled: true };
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, "L’enregistrement des notifications n’a pas abouti. Réessayez.");
    }
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
