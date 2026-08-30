const SIGNED_CONTENT_PREFIX = "/storage/v1/object/sign/site-content/";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const MODERN_OBJECT_PATH = new RegExp(
  `^${UUID}/[0-9]{4}/(?:0[1-9]|1[0-2])/${UUID}\\.[a-z0-9]{1,10}$`,
  "i"
);
const LEGACY_OBJECT_PATH = /^legacy-wordpress\/[1-9][0-9]{0,19}\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,180}$/;

function isBoundedCleanString(value: unknown, maxLength: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maxLength
    && value === value.trim()
    && !/[\u0000-\u001F\u007F]/.test(value);
}

function hasExpectedObjectPath(pathname: string): boolean {
  if (!pathname.startsWith(SIGNED_CONTENT_PREFIX) || pathname.includes("%")) return false;
  const objectPath = pathname.slice(SIGNED_CONTENT_PREFIX.length);
  return MODERN_OBJECT_PATH.test(objectPath) || LEGACY_OBJECT_PATH.test(objectPath);
}

export function isAllowedPublicContentSignedUrlForOrigin(
  value: unknown,
  configuredOrigin: unknown
): value is string | null {
  if (value === null) return true;
  if (!isBoundedCleanString(value, 4_096) || !isBoundedCleanString(configuredOrigin, 2_048)) {
    return false;
  }

  try {
    const url = new URL(value);
    const supabaseUrl = new URL(configuredOrigin);
    const entries = [...url.searchParams.entries()];
    const token = entries.length === 1 && entries[0][0] === "token" ? entries[0][1] : null;

    return supabaseUrl.protocol === "https:"
      && !supabaseUrl.username
      && !supabaseUrl.password
      && !supabaseUrl.hash
      && url.protocol === "https:"
      && url.origin === supabaseUrl.origin
      && !url.username
      && !url.password
      && !url.hash
      && hasExpectedObjectPath(url.pathname)
      && isBoundedCleanString(token, 3_072)
      && token.length >= 16;
  } catch {
    return false;
  }
}
