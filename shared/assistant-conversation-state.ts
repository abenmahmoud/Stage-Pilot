export type AssistantConversationMessage = {
  role: "assistant" | "requester";
  content: string;
};

export type PendingAssistantAction = "create_request" | "human_transfer" | null;
export type AssistantUserDecision = "accept" | "decline" | "unknown";
export type AssistantConversationStage =
  | "gathering"
  | "offer_pending"
  | "action_confirmed"
  | "action_declined";

export type AssistantConversationTransition = {
  stage: AssistantConversationStage;
  pendingAction: PendingAssistantAction;
  decision: AssistantUserDecision;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyAssistantUserDecision(content: string): AssistantUserDecision {
  const text = normalizeText(content).replace(/[.!?]+$/g, "").trim();
  if (
    /^(?:oui+|ouais|ok|okay|d accord|accord|vas y|allez y|je confirme|je veux bien|faites le|fais le|envoyez|envoie|transmettez|transmets)(?: s il vous plait| merci)?$/.test(
      text
    )
  ) {
    return "accept";
  }
  if (
    /^(?:non+|non merci|pas maintenant|je refuse|je ne veux pas|annulez|annule|laissez tomber|laisse tomber)$/.test(
      text
    )
  ) {
    return "decline";
  }
  return "unknown";
}

export function pendingAssistantActionFromReply(content: string): PendingAssistantAction {
  const text = normalizeText(content);
  const mentionsCase = /\b(demande|dossier|ticket)\b/.test(text);
  const offersCase =
    /\b(voulez vous|souhaitez vous|je peux|puis je)\b.{0,120}\b(prepare|preparer|redige|rediger|cree|creer|ouvre|ouvrir|transmet|transmettre|envoie|envoyer)\b/.test(text)
    || /\b(demande|dossier|ticket)\b.{0,100}\b(prete?|prepare|preparer|cree|creer|ouvre|ouvrir|transmet|transmettre|envoie|envoyer)\b/.test(text)
    || /\b(prepare|preparer|redige|rediger|cree|creer|ouvre|ouvrir|transmet|transmettre|envoie|envoyer)\b.{0,100}\b(demande|dossier|ticket)\b/.test(text);
  if (!mentionsCase || !offersCase) return null;
  if (/\b(reprise humaine|agent humain|un adulte|demande urgente)\b/.test(text)) {
    return "human_transfer";
  }
  return "create_request";
}

function assistantReplyBeforeLatestRequester(
  messages: AssistantConversationMessage[]
): string | null {
  const requesterIndex = messages.findLastIndex((message) => message.role === "requester");
  if (requesterIndex <= 0) return null;
  for (let index = requesterIndex - 1; index >= 0; index -= 1) {
    if (messages[index].role === "assistant") return messages[index].content;
  }
  return null;
}

export function resolveAssistantConversationTransition(
  messages: AssistantConversationMessage[]
): AssistantConversationTransition {
  const latestRequester = messages.findLast((message) => message.role === "requester");
  const previousReply = assistantReplyBeforeLatestRequester(messages);
  const pendingAction = previousReply ? pendingAssistantActionFromReply(previousReply) : null;
  if (!latestRequester || !pendingAction) {
    return { stage: "gathering", pendingAction: null, decision: "unknown" };
  }
  const decision = classifyAssistantUserDecision(latestRequester.content);
  if (decision === "accept") {
    return { stage: "action_confirmed", pendingAction, decision };
  }
  if (decision === "decline") {
    return { stage: "action_declined", pendingAction, decision };
  }
  return { stage: "offer_pending", pendingAction, decision };
}
