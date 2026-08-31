const PUBLIC_CODE_PATTERN = /^BC-[0-9]{4}-[0-9]{6}$/u;

export const SUPPORT_AGENT_WORK_DRAFT_LIMIT = 30;

export type SupportAgentWorkDraft = {
  reply: string;
  internalNote: string;
  callbackOutcome: string;
  closureReason: string;
};

export type SupportAgentWorkDraftStore = Map<string, SupportAgentWorkDraft>;

const EMPTY_DRAFT: SupportAgentWorkDraft = {
  reply: "",
  internalNote: "",
  callbackOutcome: "",
  closureReason: "",
};

const FIELD_LIMITS: Record<keyof SupportAgentWorkDraft, number> = {
  reply: 5_000,
  internalNote: 5_000,
  callbackOutcome: 1_000,
  closureReason: 500,
};

function assertPublicCode(publicCode: string): void {
  if (!PUBLIC_CODE_PATTERN.test(publicCode)) {
    throw new Error("support_agent_draft_public_code_invalid");
  }
}

function boundedFields(draft: SupportAgentWorkDraft): SupportAgentWorkDraft {
  const next = { ...draft };
  for (const field of Object.keys(FIELD_LIMITS) as Array<keyof SupportAgentWorkDraft>) {
    if (typeof next[field] !== "string" || next[field].length > FIELD_LIMITS[field]) {
      throw new Error("support_agent_draft_field_invalid");
    }
  }
  return next;
}

function isEmpty(draft: SupportAgentWorkDraft): boolean {
  return Object.values(draft).every((value) => value.trim().length === 0);
}

export function readSupportAgentWorkDraft(
  store: SupportAgentWorkDraftStore,
  publicCode: string
): SupportAgentWorkDraft {
  assertPublicCode(publicCode);
  return { ...(store.get(publicCode) ?? EMPTY_DRAFT) };
}

export function writeSupportAgentWorkDraft(
  store: SupportAgentWorkDraftStore,
  publicCode: string,
  patch: Partial<SupportAgentWorkDraft>
): SupportAgentWorkDraft {
  assertPublicCode(publicCode);
  const next = boundedFields({
    ...(store.get(publicCode) ?? EMPTY_DRAFT),
    ...patch,
  });

  store.delete(publicCode);
  if (isEmpty(next)) return { ...EMPTY_DRAFT };

  store.set(publicCode, next);
  while (store.size > SUPPORT_AGENT_WORK_DRAFT_LIMIT) {
    const oldestCode = store.keys().next().value;
    if (typeof oldestCode !== "string") break;
    store.delete(oldestCode);
  }
  return { ...next };
}

export function hasSupportAgentWorkDraft(
  store: SupportAgentWorkDraftStore,
  publicCode: string
): boolean {
  return PUBLIC_CODE_PATTERN.test(publicCode) && store.has(publicCode);
}
