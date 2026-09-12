import { createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { client } from "../../db/index.js";
import { HttpError } from "../_shared/auth.js";
import { requireSupportAgent } from "../_shared/support-agent-access.js";
import { requireConfiguredInstitution } from "../_shared/institution-context.js";
import { readSupportSessionToken, sha256 } from "../_shared/support.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { parsePushSubscription } from "../../shared/web-push-policy.mjs";
import { readIdentityDeviceSession } from "../_shared/identity-device-access.js";
import { identityDeviceFeatureEnabled } from "../../shared/identity-device-access.js";
import { enforceSupportRateLimit, personalHash } from "../_shared/support.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!["GET", "POST", "DELETE"].includes(req.method ?? "")) return methodNotAllowed(res, ["GET", "POST", "DELETE"]);
  return handleApi(res, async () => {
    const publicKey = process.env.SUPPORT_PUSH_PUBLIC_KEY;
    const enabled = process.env.SUPPORT_PUSH_ENABLED === "true" && Boolean(publicKey);
    const flashAvailable = enabled && process.env.SUPPORT_FLASH_PUSH_ENABLED === "true";
    if (req.method === "GET") return { available: enabled, publicKey: enabled ? publicKey : null, flashAvailable };
    if (!enabled) throw new HttpError(503, "Les notifications ne sont pas encore disponibles.");
    if (req.headers.origin) { let host; try { host = new URL(req.headers.origin).host; } catch { throw new HttpError(403,"Origine non autorisée."); } if(host !== req.headers.host) throw new HttpError(403,"Origine non autorisée."); }
    const institution = await requireConfiguredInstitution();
    let sessionId: string | null = null;
    let userId: string | null = null;
    let identityId: string | null = null;
    let identityOwnerHash: string | null = null;
    if (req.query.audience !== undefined && (typeof req.query.audience !== "string" || !["agent", "requester", "identity"].includes(req.query.audience))) throw new HttpError(400, "Espace invalide.");
    if (req.query.action !== undefined && req.query.action !== "status") throw new HttpError(400, "Action invalide.");
    if (req.query.audience === "agent") {
      const agent = await requireSupportAgent(req);
      userId = agent.user.id;
    } else {
      if (identityDeviceFeatureEnabled(process.env)) {
        const identity = await readIdentityDeviceSession(req);
        if (identity?.institutionId === institution.id) {
          identityId = identity.id;
          identityOwnerHash = personalHash(`personal-home-owner-v1:${identity.institutionId}:${identity.sourceImportId}:${identity.personRef}`);
        }
      }
      if (req.query.audience === "identity" && !identityId) throw new HttpError(401, "Identifiez-vous dans votre espace pour activer les alertes.");
      const token = readSupportSessionToken(req);
      if (!token && !identityId) throw new HttpError(401, "Ouvrez d’abord Mes demandes sur cet appareil.");
      if (token) {
      const [session] = await client`
        select s.id from public.support_device_sessions s
        where s.session_hash = ${sha256(token)} and s.revoked_at is null and s.expires_at > now()
        and exists(select 1 from public.support_session_requests sr join public.support_requests r on r.id = sr.request_id
          where sr.session_id = s.id and r.institution_id = ${institution.id}
            and (s.access_contact_id is null or exists(select 1 from public.support_contacts c where c.id=s.access_contact_id
              and c.request_id=r.id and c.channel='email' and c.usage_scope='support' and c.disabled_at is null))) limit 1`;
      if (!session && !identityId) throw new HttpError(401, "Votre accès au suivi a expiré. Reconnectez-vous.");
      sessionId = session?.id ?? null;
      }
    }
    let subscription;
    let flashEnabled: boolean | null = null;
    try {
      const body = req.body;
      if (body && typeof body === "object" && "subscription" in body) {
        if (Object.keys(body).some(key => !["subscription", "flashEnabled"].includes(key)) || typeof body.flashEnabled !== "boolean") throw new Error();
        subscription = parsePushSubscription(body.subscription);
        flashEnabled = body.flashEnabled;
      } else subscription = parsePushSubscription(body);
    }
    catch { throw new HttpError(400, "L’abonnement aux notifications est invalide."); }
    if (flashEnabled && !flashAvailable) throw new HttpError(503, "Les alertes flash ne sont pas encore disponibles.");
    const hash = createHash("sha256").update(subscription.endpoint).digest("hex");
    await enforceSupportRateLimit({scope:"request_device_burst",keyHash:sha256(`push:${identityId ?? sessionId ?? userId}`),limit:40,windowSeconds:60});
    try {
      return await client.begin(async tx => {
        await tx`select pg_advisory_xact_lock(hashtext(${identityId ?? sessionId ?? userId!}))`;
        if (req.query.action === "status") {
          const [state] = await tx`select flash_since is not null as flash from support_push_subscriptions where endpoint_hash=${hash}
            and institution_id=${institution.id} and disabled_at is null and expires_at>now()
            and ((identity_session_id=${identityId}::uuid) or (identity_session_id is null and session_id=${sessionId}::uuid)
              or (user_id=${userId}::uuid))`;
          return {enabled:Boolean(state),flashEnabled:state?.flash ?? false};
        }
        if (req.method === "DELETE") {
          await tx`update public.support_push_subscriptions set disabled_at = now() where endpoint_hash = ${hash}
            and institution_id = ${institution.id} and (identity_session_id=${identityId}::uuid
              or (identity_session_id is null and session_id=${sessionId}::uuid) or user_id=${userId}::uuid)`;
          return { enabled: false, flashEnabled: false };
        }
        const [{ count }] = await tx`select count(*)::int as count from public.support_push_subscriptions
          where disabled_at is null and expires_at > now() and endpoint_hash <> ${hash}
          and ((identity_session_id=${identityId}::uuid) or (identity_session_id is null and session_id=${sessionId}::uuid) or user_id=${userId}::uuid)`;
        if (count >= 8) throw new HttpError(429, "Trop d’appareils inscrits. Désactivez un ancien appareil.");
        const saved = await tx`insert into public.support_push_subscriptions (institution_id, session_id, user_id, identity_session_id, identity_owner_hash, flash_since, endpoint_hash, subscription, last_event_id)
          values (${institution.id}, ${sessionId}, ${userId}, ${identityId}, ${identityOwnerHash}, case when ${flashEnabled}::boolean then now() end, ${hash}, ${JSON.stringify(subscription)}::jsonb, (select coalesce(max(id),0) from public.support_events))
          on conflict(endpoint_hash) do update set subscription = excluded.subscription, updated_at = now(), disabled_at = null,
            identity_session_id=excluded.identity_session_id, session_id=excluded.session_id, identity_owner_hash=excluded.identity_owner_hash,
            flash_since=case when ${flashEnabled}::boolean=false then null when ${flashEnabled}::boolean=true then case when public.support_push_subscriptions.disabled_at is not null or public.support_push_subscriptions.expires_at<=now() then now() else coalesce(public.support_push_subscriptions.flash_since,now()) end else public.support_push_subscriptions.flash_since end,
            expires_at = now() + interval '30 days', last_event_id = greatest(public.support_push_subscriptions.last_event_id, excluded.last_event_id)
          where public.support_push_subscriptions.institution_id = excluded.institution_id
            and ((public.support_push_subscriptions.identity_session_id=excluded.identity_session_id)
              or (public.support_push_subscriptions.identity_session_id is null and public.support_push_subscriptions.session_id=excluded.session_id)
              or (public.support_push_subscriptions.user_id=excluded.user_id)) returning id, flash_since is not null as flash`;
        if (!saved.length) throw new HttpError(409, "Désactivez les notifications avant de changer de compte sur cet appareil.");
        return { enabled: true, flashEnabled: saved[0].flash };
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, "L’enregistrement des notifications n’a pas abouti. Réessayez.");
    }
  });
}

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };
