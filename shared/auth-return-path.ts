const RETURN_ORIGIN = "https://lyceegest.invalid";

export function safeAuthReturnPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/")
    || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, RETURN_ORIGIN);
    if (url.origin !== RETURN_ORIGIN || url.pathname.startsWith("//")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
