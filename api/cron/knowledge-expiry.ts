// LOT 6 du plan de connaissance OB1 (2026-09-05) : cette route est désormais
// appelée toutes les heures (`vercel.json`, `"5 * * * *"`, toujours en UTC —
// Vercel Cron ne connaît pas les fuseaux) et laisse
// `scheduledKnowledgeSweepTrigger` (heure locale Paris réelle de `now`)
// décider si l'appel en cours correspond au balayage nocturne (2 h) ou à un
// contrôle de fraîcheur (8 h, 13 h, 18 h). En dehors de ces heures, répond
// sans ouvrir de transaction. Le balayage lui-même vit dans
// `api/_shared/knowledge-freshness-sweep.ts`, rejoué à l'identique par les
// routes de publication (LOT 6, bullet 3).
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../db/index.js";
import { secretMatches, HttpError } from "../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../_shared/response.js";
import { runKnowledgeFreshnessSweep } from "../_shared/knowledge-freshness-sweep.js";
import { scheduledKnowledgeSweepTrigger } from "../../shared/knowledge-freshness-schedule.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  return handleApi(res, async () => {
    const authorization = req.headers.authorization;
    const provided = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;
    if (!secretMatches(process.env.CRON_SECRET, provided)) {
      throw new HttpError(401, "Accès refusé");
    }

    const now = new Date();
    const trigger = scheduledKnowledgeSweepTrigger(now);
    if (trigger === "not_scheduled") {
      return { skipped: true, checkedAt: now.toISOString() };
    }

    return db.transaction((tx) => runKnowledgeFreshnessSweep(tx, now, trigger));
  });
}

export const config = { maxDuration: 60, api: { bodyParser: false } };
