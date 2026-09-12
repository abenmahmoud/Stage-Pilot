export const MAX_BUDGETED_REQUEST_BYTES = 150_000;
export const MAX_BUDGETED_OUTPUT_TOKENS = 4000;

/** A byte per input token plus a conservative allowance for provider framing. */
export function isAiReservationPriced(reservationMicros: number, env: NodeJS.ProcessEnv): boolean {
  const input = Number(env.OPENAI_SUPPORT_INPUT_EUR_PER_MILLION_TOKENS);
  const output = Number(env.OPENAI_SUPPORT_OUTPUT_EUR_PER_MILLION_TOKENS);
  if (env.OPENAI_BUDGET_PRICED_MODEL !== "gpt-5.6-luna"
    || !Number.isFinite(input) || input <= 0 || !Number.isFinite(output) || output <= 0) return false;
  return Math.ceil((MAX_BUDGETED_REQUEST_BYTES + 8192) * input + MAX_BUDGETED_OUTPUT_TOKENS * output) <= reservationMicros;
}

/** Bound the entire billed prompt, including instructions, schema and retrieved context. */
export function encodeBudgetedAiRequest(body: Record<string, unknown>, env: NodeJS.ProcessEnv = process.env): string {
  const encoded = JSON.stringify(body);
  if (env.OPENAI_BUDGET_GUARD_ENABLED !== "true") return encoded;
  if (body.model !== env.OPENAI_BUDGET_PRICED_MODEL
    || body.model !== "gpt-5.6-luna"
    || typeof body.max_output_tokens !== "number" || body.max_output_tokens > MAX_BUDGETED_OUTPUT_TOKENS
    || body.max_output_tokens < 1 || !Number.isSafeInteger(body.max_output_tokens)
    || Buffer.byteLength(encoded, "utf8") > MAX_BUDGETED_REQUEST_BYTES
    || "tools" in body || "previous_response_id" in body || "conversation" in body) {
    throw new Error("ai_request_outside_budget_envelope");
  }
  return encoded;
}
