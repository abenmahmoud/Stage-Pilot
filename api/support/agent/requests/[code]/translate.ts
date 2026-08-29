import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import { supportRequests } from "../../../../../db/schema.js";
import {
  SUPPORT_IDENTITY_VERIFICATION_MESSAGE,
  normalizeSupportReplyText,
  supportTranslationTargetLanguage,
} from "../../../../../shared/support-reply-policy.js";
import { HttpError } from "../../../../_shared/auth.js";
import { handleApi, methodNotAllowed } from "../../../../_shared/response.js";
import {
  assertSupportRequestAccess,
  requireSupportAgent,
} from "../../../../_shared/support-agent-access.js";
import {
  assertNoForbiddenSupportSecret,
  enforceSupportRateLimit,
  personalHash,
} from "../../../../_shared/support.js";
import {
  SupportTranslationFailure,
  createSupportTranslationReceipt,
  prepareSupportTranslation,
} from "../../../../_shared/support-translation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const { user, access } = await requireSupportAgent(req);
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code)) {
      throw new HttpError(400, "Numéro de demande invalide");
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sourceMessage = normalizeSupportReplyText(body.sourceMessage, 5_000);
    if (!sourceMessage) throw new HttpError(400, "Rédigez d’abord la réponse en français");
    assertNoForbiddenSupportSecret(sourceMessage);

    const [request] = await db
      .select({
        id: supportRequests.id,
        category: supportRequests.category,
        requesterFirstName: supportRequests.requesterFirstName,
        requesterLastName: supportRequests.requesterLastName,
        beneficiaryFirstName: supportRequests.beneficiaryFirstName,
        beneficiaryLastName: supportRequests.beneficiaryLastName,
        subjectContext: supportRequests.subjectContext,
        assignedTeam: supportRequests.assignedTeam,
      })
      .from(supportRequests)
      .where(eq(supportRequests.publicCode, code))
      .limit(1);
    if (!request) throw new HttpError(404, "Demande introuvable");
    assertSupportRequestAccess(access, request.assignedTeam);

    const context = (request.subjectContext ?? {}) as Record<string, unknown>;
    const targetLanguage = supportTranslationTargetLanguage(context.detectedLanguage);
    if (!targetLanguage) {
      throw new HttpError(409, "Aucune autre langue fiable n’est disponible pour ce dossier");
    }
    const sensitiveIdentityPending = ["ent", "email_academique"].includes(request.category)
      && context.identityStatus !== "identite_confirmee";
    if (sensitiveIdentityPending && sourceMessage !== SUPPORT_IDENTITY_VERIFICATION_MESSAGE) {
      throw new HttpError(
        409,
        "Avant la confirmation d’identité, seul le message sécurisé peut être traduit"
      );
    }
    await enforceSupportRateLimit({
      scope: "agent_translation_user",
      keyHash: personalHash(`${user.id}:${request.id}`),
      limit: 60,
      windowSeconds: 24 * 60 * 60,
    });

    try {
      const draft = await prepareSupportTranslation({
        sourceMessage,
        targetLanguage,
        safetyIdentifier: personalHash(`support-translation:${user.id}`),
        knownNames: [
          { value: `${request.requesterFirstName} ${request.requesterLastName}`, marker: "[NOM_DEMANDEUR]" },
          { value: request.requesterFirstName, marker: "[PRENOM_DEMANDEUR]" },
          { value: request.requesterLastName, marker: "[NOM_FAMILLE_DEMANDEUR]" },
          { value: request.beneficiaryFirstName, marker: "[PRENOM_BENEFICIAIRE]" },
          { value: request.beneficiaryLastName, marker: "[NOM_BENEFICIAIRE]" },
        ],
      });
      const signed = createSupportTranslationReceipt({
        requestId: request.id,
        userId: user.id,
        sourceMessage,
        translatedMessage: draft.translatedText,
        targetLanguage,
      });
      return {
        translation: {
          ...draft,
          targetLanguage,
          receipt: signed.receipt,
          expiresAt: signed.expiresAt,
        },
      };
    } catch (error) {
      if (error instanceof SupportTranslationFailure) {
        const status = error.code === "not_configured" ? 503 : 502;
        throw new HttpError(status, error.message);
      }
      throw error;
    }
  });
}

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
