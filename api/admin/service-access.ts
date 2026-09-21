import type { VercelRequest, VercelResponse } from "@vercel/node";
import { client } from "../../db/index.js";
import { HttpError } from "../_shared/auth.js";
import { requireSupportAgent } from "../_shared/support-agent-access.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { SUPPORT_SERVICES, supportServiceLabel } from "../../shared/support-agent-access.js";
import { servicePilotPasswordOnly } from "../../shared/agent-pilot-access.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    const actor = await requireSupportAgent(req);
    if (!actor.access.canViewAll || !["superadmin", "proviseur"].includes(actor.user.role)) {
      throw new HttpError(403, "Accès réservé à la direction");
    }
    const rows = await client`select u.id, u.email, u.raw_app_meta_data->>'role' as app_role,
      m.role as membership_role, m.service_codes
      from public.institution_memberships m join auth.users u on u.id=m.user_id
      where m.institution_id=${actor.institutionId} and m.status='active'
      and m.role in ('agent','service_manager','admin')
      and u.raw_app_meta_data->>'role' in ('agent','administration','superadmin','proviseur')
      and (u.banned_until is null or u.banned_until<now())
      order by lower(u.email), u.id`;
    const accounts = rows.map(row => {
      const serviceCodes = Array.isArray(row.service_codes)
        ? row.service_codes.filter((code): code is typeof SUPPORT_SERVICES[number] =>
            typeof code === "string" && SUPPORT_SERVICES.includes(code as typeof SUPPORT_SERVICES[number]))
        : [];
      const appRole = String(row.app_role);
      return {
        id: String(row.id),
        email: typeof row.email === "string" ? row.email : null,
        appRole,
        membershipRole: String(row.membership_role),
        serviceCodes,
        globalAccess: (appRole === "superadmin" || appRole === "proviseur") && row.membership_role === "admin",
      };
    });
    return { services: SUPPORT_SERVICES.map(code => ({ code, label: supportServiceLabel(code), activeAccounts: accounts.filter(account => account.serviceCodes.includes(code)).length })),
      accounts,
      passwordOnlyUntil: servicePilotPasswordOnly("agent", process.env.AGENT_PILOT_PASSWORD_ONLY_UNTIL) ? process.env.AGENT_PILOT_PASSWORD_ONLY_UNTIL : null };
  });
}
