export const COMMUNICATION_INBOUND_PREVIEW_PROJECT = "xijocumlwivhbmffrnlj";

export function communicationInboundPreviewDatabaseUrl(value) {
  try {
    if (typeof value !== "string" || value.length > 4096 || /[\s\x00-\x1f\x7f]/u.test(value)) throw new Error("invalid");
    const url = new URL(value);
    const username = decodeURIComponent(url.username);
    const direct = url.hostname === `db.${COMMUNICATION_INBOUND_PREVIEW_PROJECT}.supabase.co`;
    const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/u.test(url.hostname)
      && username === `postgres.${COMMUNICATION_INBOUND_PREVIEW_PROJECT}`;
    if (!["postgres:", "postgresql:"].includes(url.protocol) || (!direct && !pooler)
      || url.pathname !== "/postgres" || !url.password || !username
      || url.search || url.hash || (url.port && !["5432", "6543"].includes(url.port))) throw new Error("invalid");
    // Do not inherit PGPORT for an otherwise valid URL with an omitted port.
    url.port ||= "5432";
    return url.href;
  } catch { throw new Error("inbound_scan_preview_configuration_invalid"); }
}
