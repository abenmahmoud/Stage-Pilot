import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseSiteContentAiInput } from "../../../shared/site-content.js";
import { HttpError } from "../../_shared/auth.js";
import { requireSiteEditor, inputError, redactEditorialText } from "../../_shared/site-content.js";
import { enforceSupportRateLimit, personalHash } from "../../_shared/support.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    bodyMarkdown: { type: "string" },
    metaTitle: { type: "string" },
    metaDescription: { type: "string" },
    suggestedTitles: { type: "array", items: { type: "string" }, maxItems: 5 },
    reviewNotes: { type: "array", items: { type: "string" }, maxItems: 5 },
  },
  required: [
    "title",
    "summary",
    "bodyMarkdown",
    "metaTitle",
    "metaDescription",
    "suggestedTitles",
    "reviewNotes",
  ],
} as const;

const INSTRUCTIONS = `Tu aides l'équipe du Lycée Blaise Cendrars de Sevran à rédiger ses contenus publics.
Écris en français irréprochable, clair et accessible aux élèves, parents et personnels, y compris aux lecteurs peu à l'aise avec le français.
Respecte strictement les faits fournis. N'invente jamais une date, un contact, une procédure, un lien ou une décision officielle.
Ne demande et ne révèle jamais de mot de passe ni de donnée personnelle. Le corps est en Markdown simple, sans HTML.
L'utilisateur humain relit et décide toujours de publier. Signale dans reviewNotes les informations à vérifier.`;

function outputText(payload: unknown): string | null {
  const response = payload as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  return response.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text")?.text ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  return handleApi(res, async () => {
    const user = await requireSiteEditor(req);
    let input;
    try {
      input = parseSiteContentAiInput(req.body);
    } catch (error) {
      inputError(error);
    }
    await enforceSupportRateLimit({
      scope: "content_ai_user",
      keyHash: personalHash(user.id),
      limit: 30,
      windowSeconds: 24 * 60 * 60,
    });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new HttpError(503, "L’aide à la rédaction n’est pas encore configurée");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_CONTENT_MODEL || process.env.OPENAI_SUPPORT_MODEL || "gpt-5.6-luna",
          store: false,
          reasoning: { effort: "low" },
          max_output_tokens: 900,
          safety_identifier: personalHash(`content:${user.id}`),
          instructions: INSTRUCTIONS,
          input: JSON.stringify({
            action: input.action,
            contentType: input.contentType,
            title: redactEditorialText(input.title),
            summary: redactEditorialText(input.summary),
            bodyMarkdown: redactEditorialText(input.bodyMarkdown),
            instructions: redactEditorialText(input.instructions),
          }),
          text: {
            verbosity: "low",
            format: { type: "json_schema", name: "site_content_draft", strict: true, schema: RESULT_SCHEMA },
          },
        }),
      });
      if (!response.ok) throw new HttpError(502, "L’aide à la rédaction ne répond pas pour le moment");
      const text = outputText(await response.json());
      if (!text) throw new HttpError(502, "La proposition reçue est incomplète");
      return { suggestion: JSON.parse(text) as unknown };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, "L’aide à la rédaction ne répond pas pour le moment");
    } finally {
      clearTimeout(timeout);
    }
  });
}
