import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../../../../../../db/index.js";
import { parseScheduleSlotBatchInput } from "../../../../../../../shared/schedule-slot-input.js";
import { HttpError } from "../../../../../../_shared/auth.js";
import { registryInputError } from "../../../../../../_shared/knowledge-registry.js";
import { handleApi, methodNotAllowed } from "../../../../../../_shared/response.js";
import { requireScheduleManager } from "../../../../../../_shared/schedule-imports.js";
import { ScheduleSlotWriteError, writeScheduleSlots } from "../../../../../../_shared/schedule-slot-write.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeUuid(req: VercelRequest, key: "id" | "pageId"): string {
  const value = Array.isArray(req.query[key]) ? req.query[key][0] : req.query[key];
  if (!value || !UUID.test(value)) throw new HttpError(400, "Référence invalide.");
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const context = await requireScheduleManager(req);
    const id = routeUuid(req, "id");
    const pageId = routeUuid(req, "pageId");
    let input;
    try {
      input = parseScheduleSlotBatchInput(req.body);
    } catch (error) {
      registryInputError(error);
    }

    let slots;
    try {
      slots = await db.transaction((tx) =>
        writeScheduleSlots(tx, {
          institutionId: context.institutionId,
          sourceVersionId: id,
          pageIndexId: pageId,
          actorId: context.user.id,
          rows: input.rows,
        })
      );
    } catch (error) {
      if (error instanceof ScheduleSlotWriteError) throw new HttpError(error.status, error.message);
      throw error;
    }
    return { slots };
  });
}

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
