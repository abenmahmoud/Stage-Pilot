import type { VercelRequest, VercelResponse } from "@vercel/node";
import { client } from "../../db/index.js";
import { requireRole } from "../_shared/auth.js";
import { requireConfiguredInstitution } from "../_shared/institution-context.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { SUPPORT_SERVICES, supportServiceLabel } from "../../shared/support-agent-access.js";
import { servicePilotPasswordOnly } from "../../shared/agent-pilot-access.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    await requireRole(req, ["superadmin", "proviseur"]);
    const institution = await requireConfiguredInstitution();
    const rows = await client`select service, count(distinct m.user_id)::int as members from public.institution_memberships m
      join auth.users u on u.id=m.user_id cross join lateral unnest(m.service_codes) service
      where m.institution_id=${institution.id} and m.status='active' and m.role in ('agent','service_manager','admin')
      and u.raw_app_meta_data->>'role' in ('agent','administration','superadmin','proviseur')
      and (u.banned_until is null or u.banned_until<now()) group by service`;
    return { services: SUPPORT_SERVICES.map(code => ({ code, label: supportServiceLabel(code), activeAccounts: Number(rows.find(row => row.service === code)?.members ?? 0) })),
      passwordOnlyUntil: servicePilotPasswordOnly("agent", process.env.AGENT_PILOT_PASSWORD_ONLY_UNTIL) ? process.env.AGENT_PILOT_PASSWORD_ONLY_UNTIL : null };
  });
}
