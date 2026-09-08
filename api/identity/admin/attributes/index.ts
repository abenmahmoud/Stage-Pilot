import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../../db/index.js";
import { personAttributeImports } from "../../../../db/schema.js";
import { isPersonAttributeImportListPayload } from "../../../../shared/person-attribute-admin-payload-policy.js";
import { HttpError } from "../../../_shared/auth.js";
import { requireIdentityDirectoryManager } from "../../../_shared/identity-directory.js";
import { personAttributeImportView } from "../../../_shared/person-attribute-view.js";
import { handleApi, methodNotAllowed } from "../../../_shared/response.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return handleApi(res, async () => {
    const context = await requireIdentityDirectoryManager(req);
    const imports = await db
      .select()
      .from(personAttributeImports)
      .where(eq(personAttributeImports.institutionId, context.institutionId))
      .orderBy(desc(personAttributeImports.createdAt))
      .limit(100);
    const payload = { imports: imports.map(personAttributeImportView) };
    if (!isPersonAttributeImportListPayload(payload)) {
      throw new HttpError(503, "La liste des attributs chiffrés est invalide");
    }
    return payload;
  });
}
