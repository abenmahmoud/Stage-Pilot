type Message = { role: "assistant" | "requester" };

/** Keep the latest continuation when older drafts contain two assistant replies. */
export function compactAssistantReplies<T extends Message>(messages: readonly T[]): T[] {
  const result: T[] = [];
  for (const message of messages) {
    if (message.role === "assistant" && result.at(-1)?.role === "assistant") {
      result[result.length - 1] = message;
    } else {
      result.push(message);
    }
  }
  return result;
}

/** Identity verification resumes the same question; it does not start a new turn. */
export function applyAssistantReply<T extends Message & { id: string }>(
  messages: T[], requesterId: string, reply: T,
): T[] {
  const index = messages.findLastIndex(message => message.role === "requester");
  if (index < 0 || messages[index].id !== requesterId || reply.role !== "assistant") return messages;
  return [...compactAssistantReplies(messages.slice(0, index + 1)), reply];
}
