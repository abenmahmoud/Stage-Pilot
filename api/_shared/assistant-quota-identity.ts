import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const MAX_AGE = 30 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{1,400}\.[A-Za-z0-9_-]{43}$/;
const FIELDS = ["v", "id", "institutionId", "iat", "exp"].sort().join(",");

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("assistant-anonymous-quota-v1\0").update(payload).digest("base64url");
}

export function resolveAssistantQuotaCookie(input: {
  cookieHeader: string | undefined;
  secret: string | undefined;
  institutionId: string;
  production: boolean;
  now?: number;
}): { anonymousId: string; setCookie: string | null } {
  if (!input.secret || input.secret.length < 32 || !UUID.test(input.institutionId)) {
    throw new Error("assistant_quota_configuration_unavailable");
  }
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  if (!Number.isSafeInteger(now) || now < 0 || now > 8_640_000_000_000 - MAX_AGE) {
    throw new Error("assistant_quota_clock_invalid");
  }
  const name = input.production ? "__Host-bc_assistant_quota" : "bc_assistant_quota";
  const header = input.cookieHeader ?? "";
  if (header.length > 16_384) throw new Error("assistant_quota_cookie_header_too_large");
  const cookies = header.split(";").flatMap((part) => {
    const index = part.indexOf("=");
    return index > 0 && part.slice(0, index).trim() === name ? [part.slice(index + 1).trim()] : [];
  });
  const token = cookies.length === 1 ? cookies[0] : "";
  if (TOKEN.test(token)) {
    const [payload, actual] = token.split(".");
    const expected = signature(payload, input.secret);
    if (timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
      try {
        const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        if (claims && !Array.isArray(claims) && Object.keys(claims).sort().join(",") === FIELDS
          && claims.v === 1 && typeof claims.id === "string" && /^[A-Za-z0-9_-]{43}$/.test(claims.id)
          && claims.institutionId === input.institutionId
          && Number.isSafeInteger(claims.iat) && claims.iat >= 0 && claims.iat <= now
          && claims.exp === claims.iat + MAX_AGE && claims.exp > now) {
          return { anonymousId: claims.id, setCookie: null };
        }
      } catch {
        // An invalid cookie can only become a new anonymous visitor, never an identity.
      }
    }
  }
  const anonymousId = randomBytes(32).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    v: 1, id: anonymousId, institutionId: input.institutionId, iat: now, exp: now + MAX_AGE,
  })).toString("base64url");
  const value = `${payload}.${signature(payload, input.secret)}`;
  return {
    anonymousId,
    setCookie: `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${input.production ? "; Secure" : ""}`,
  };
}
