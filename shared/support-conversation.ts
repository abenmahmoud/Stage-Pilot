export type SupportConversationTurn = {
  role: "assistant" | "requester";
  content: string;
};

export class SupportConversationValidationError extends Error {}

const MAX_TURNS = 21;
const MAX_TURN_LENGTH = 1500;
const MAX_TOTAL_LENGTH = 12000;

export function normalizeSupportConversation(value: unknown): SupportConversationTurn[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_TURNS) {
    throw new SupportConversationValidationError("La conversation est invalide");
  }

  let totalLength = 0;
  const turns = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new SupportConversationValidationError("La conversation est invalide");
    }
    const record = item as Record<string, unknown>;
    if (record.role !== "assistant" && record.role !== "requester") {
      throw new SupportConversationValidationError("La conversation est invalide");
    }
    if (typeof record.content !== "string") {
      throw new SupportConversationValidationError("Un message de la conversation est invalide");
    }
    const content = record.content
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .trim();
    if (!content || content.length > MAX_TURN_LENGTH) {
      throw new SupportConversationValidationError("Un message de la conversation est invalide");
    }
    totalLength += content.length;
    return { role: record.role, content } satisfies SupportConversationTurn;
  });

  if (totalLength > MAX_TOTAL_LENGTH) {
    throw new SupportConversationValidationError("La conversation est trop longue");
  }

  const firstRequester = turns.findIndex((turn) => turn.role === "requester");
  if (firstRequester < 0) {
    throw new SupportConversationValidationError("La conversation ne contient aucune demande");
  }

  return turns.slice(firstRequester);
}
