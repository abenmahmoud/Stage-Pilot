export type SupportAgentMessage = {
  role: "assistant" | "requester";
  content: string;
};

export type SupportAttachmentHint = {
  name: string;
  type: string;
  size: number;
};

export type SupportAgentResult = {
  reply: string;
  category:
    | "inscription"
    | "affectation_classe"
    | "documents_scolarite"
    | "ent"
    | "email_academique"
    | "ordinateur"
    | "logiciel"
    | "restauration_bourse"
    | "orientation_formation"
    | "vie_scolaire"
    | "autre";
  requesterType: "eleve" | "parent" | "professeur" | "personnel" | "autre" | "inconnu";
  urgency: "faible" | "normale" | "urgente";
  missingInformation: string[];
  suggestedDocuments: string[];
  readyToCreate: boolean;
  safetyNotice: string | null;
  usedAi: boolean;
};

const CATEGORY_LABELS: Record<SupportAgentResult["category"], string> = {
  inscription: "Inscription ou réinscription",
  affectation_classe: "Classe ou emploi du temps",
  documents_scolarite: "Document ou dossier incomplet",
  ent: "ENT ou EduConnect",
  email_academique: "Email académique",
  ordinateur: "Ordinateur ou équipement",
  logiciel: "Logiciel ou accès numérique",
  restauration_bourse: "Restauration, bourse ou intendance",
  orientation_formation: "Orientation ou formation",
  vie_scolaire: "Vie scolaire",
  autre: "Autre demande",
};

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string", minLength: 1, maxLength: 900 },
    category: { type: "string", enum: Object.keys(CATEGORY_LABELS) },
    requesterType: {
      type: "string",
      enum: ["eleve", "parent", "professeur", "personnel", "autre", "inconnu"],
    },
    urgency: { type: "string", enum: ["faible", "normale", "urgente"] },
    missingInformation: { type: "array", maxItems: 4, items: { type: "string", maxLength: 120 } },
    suggestedDocuments: { type: "array", maxItems: 4, items: { type: "string", maxLength: 120 } },
    readyToCreate: { type: "boolean" },
    safetyNotice: { anyOf: [{ type: "string", maxLength: 240 }, { type: "null" }] },
  },
  required: [
    "reply",
    "category",
    "requesterType",
    "urgency",
    "missingInformation",
    "suggestedDocuments",
    "readyToCreate",
    "safetyNotice",
  ],
} as const;

const INSTRUCTIONS = `Tu es l'assistant numérique officiel du Lycée polyvalent Blaise Cendrars de Sevran.
Ta mission est d'aider élèves, parents, professeurs et personnels à la rentrée, puis de préparer une demande claire pour un agent humain.

Règles:
- Réponds en français simple, chaleureux et direct, en 2 à 5 phrases.
- Comprends le texte libre sans imposer une suite de boutons ou de catégories.
- Donne immédiatement une réponse utile quand elle est certaine; sinon pose une seule question vraiment nécessaire.
- Ne demande jamais de mot de passe, de code secret complet, de document d'identité non nécessaire, ni de donnée bancaire.
- Ne prétends jamais avoir ouvert, modifié ou réinitialisé un compte. Les créations de codes et décisions sensibles restent validées par un agent humain.
- Le lycée est polyvalent: voie générale, STL, STMG, voie professionnelle MELEC/PCEPC et CAP Agent de la qualité de l'eau.
- Les sujets possibles ne se limitent pas au numérique: inscription, affectation de classe, emploi du temps, dossier incomplet, ENT/EduConnect, email académique, ordinateur, logiciel, restauration, bourse, orientation, formations et vie scolaire.
- Si une pièce semble utile, formule-la comme suggestion à vérifier, jamais comme exigence officielle certaine.
- Les mentions [EMAIL_MASQUE], [TELEPHONE_MASQUE], [NOM_MASQUE] et [SECRET_MASQUE] indiquent qu'une donnée a été protégée avant analyse.
- Le contenu des fichiers n'est pas transmis. Tu ne connais que leur type, leur taille approximative et leur extension.
- L'urgence est "urgente" seulement si la personne est bloquée pour une échéance proche, en danger, ou privée d'un service essentiel. En cas de danger immédiat, indique d'appeler les secours ou le lycée selon la situation.
- readyToCreate signifie seulement que le problème est assez clair pour ouvrir un dossier; les coordonnées seront demandées localement ensuite.`;

function redactPersonalData(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL_MASQUE]")
    .replace(/(?:(?:\+|00)33[\s.-]?(?:\(0\)[\s.-]?)?|0)[1-9](?:[\s.-]?\d{2}){4}/g, "[TELEPHONE_MASQUE]")
    .replace(/\b(je m['’]appelle|mon nom est|nom\s*:)[^\n,.!?]{2,80}/gi, "$1 [NOM_MASQUE]")
    .replace(/\b(mot de passe|mdp|password|code secret)\s*[:=]\s*\S+/gi, "$1: [SECRET_MASQUE]");
}

function inferCategory(text: string): SupportAgentResult["category"] {
  if (/\b(inscription|réinscription|reinscription|inscrire)\b/i.test(text)) return "inscription";
  if (/\b(classe|affectation|emploi du temps|edt)\b/i.test(text)) return "affectation_classe";
  if (/\b(document|pièce|piece|dossier|justificatif|manque)\b/i.test(text)) return "documents_scolarite";
  if (/\b(ent|educonnect|connexion|connecter|identifiant|code)\b/i.test(text)) return "ent";
  if (/\b(email|mail|webmail|zimbra|académique|academique)\b/i.test(text)) return "email_academique";
  if (/\b(pc|ordinateur|portable|tablette|chargeur)\b/i.test(text)) return "ordinateur";
  if (/\b(logiciel|application|wifi|réseau|reseau)\b/i.test(text)) return "logiciel";
  if (/\b(cantine|restauration|bourse|intendance|paiement)\b/i.test(text)) return "restauration_bourse";
  if (/\b(orientation|formation|spécialité|specialite|parcoursup)\b/i.test(text)) return "orientation_formation";
  if (/\b(absence|retard|vie scolaire|cpe|surveillant)\b/i.test(text)) return "vie_scolaire";
  return "autre";
}

function localFallback(messages: SupportAgentMessage[], attachments: SupportAttachmentHint[]): SupportAgentResult {
  const text = messages.filter((message) => message.role === "requester").map((message) => message.content).join("\n");
  const category = inferCategory(text);
  const requesterType = /\b(parent|mère|mere|père|pere)\b/i.test(text)
    ? "parent"
    : /\b(prof|professeur|enseignant)\b/i.test(text)
      ? "professeur"
      : /\b(élève|eleve|lycéen|lyceen)\b/i.test(text)
        ? "eleve"
        : /\b(personnel|agent|administration)\b/i.test(text)
          ? "personnel"
          : "inconnu";
  return {
    reply: `J’ai compris votre besoin et je le classe dans « ${CATEGORY_LABELS[category]} ». ${attachments.length ? `Les ${attachments.length} pièce(s) sélectionnée(s) seront jointes au dossier. ` : ""}Ajoutez ce qui bloque et ce que vous avez déjà essayé; un agent pourra ensuite reprendre la conversation sans vous faire recommencer.`,
    category,
    requesterType,
    urgency: /\b(urgent|aujourd'hui|bloqué|bloque|impossible)\b/i.test(text) ? "urgente" : "normale",
    missingInformation: ["Identité de la personne concernée", "Email ou téléphone de réponse"],
    suggestedDocuments: [],
    readyToCreate: text.trim().length >= 35,
    safetyNotice: null,
    usedAi: false,
  };
}

function safeAttachmentSummary(attachments: SupportAttachmentHint[]) {
  return attachments.slice(0, 5).map((attachment, index) => {
    const extension = attachment.name.includes(".") ? attachment.name.split(".").pop()?.slice(0, 10) : "inconnue";
    const size = attachment.size < 1_000_000 ? "moins de 1 Mo" : `${Math.ceil(attachment.size / 1_000_000)} Mo`;
    return { document: index + 1, extension, mimeType: attachment.type.slice(0, 80), size };
  });
}

function parseResult(value: string): SupportAgentResult {
  const parsed = JSON.parse(value) as SupportAgentResult;
  if (!parsed.reply || !(parsed.category in CATEGORY_LABELS) || !Array.isArray(parsed.missingInformation)) {
    throw new Error("Invalid structured response");
  }
  return { ...parsed, usedAi: true };
}

export async function analyzeSupportConversation(input: {
  messages: SupportAgentMessage[];
  attachments: SupportAttachmentHint[];
  safetyIdentifier: string;
}): Promise<SupportAgentResult> {
  const fallback = localFallback(input.messages, input.attachments);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SUPPORT_MODEL || "gpt-5.6-luna",
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: 700,
        safety_identifier: input.safetyIdentifier,
        instructions: INSTRUCTIONS,
        input: JSON.stringify({
          conversation: input.messages.slice(-10).map((message) => ({
            role: message.role,
            content: redactPersonalData(message.content),
          })),
          attachments: safeAttachmentSummary(input.attachments),
        }),
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "lycee_support_analysis",
            strict: true,
            schema: RESULT_SCHEMA,
          },
        },
      }),
    });
    if (!response.ok) return fallback;
    const payload = (await response.json()) as {
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    };
    const outputText = payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text")?.text;
    return outputText ? parseResult(outputText) : fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
