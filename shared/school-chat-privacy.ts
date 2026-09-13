export const PRIVATE_SCHOOL_PLACEHOLDER = 'La réponse scolaire personnelle est à consulter de nouveau dans votre session vérifiée.';

/** Preserve turn order without saving personal school answers or sending them to the model. */
export function schoolChatTranscript(messages: readonly { role: 'assistant' | 'requester'; content: string; privateSchoolReply?: boolean }[]) {
  return messages.map(({ role, content, privateSchoolReply }) => ({ role, content: role === 'assistant' && privateSchoolReply ? PRIVATE_SCHOOL_PLACEHOLDER : content }));
}
