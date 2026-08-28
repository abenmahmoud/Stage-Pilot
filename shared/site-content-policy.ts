export type SiteContentAction =
  | "submit_review"
  | "publish"
  | "archive"
  | "duplicate"
  | "restore"
  | "verify_source";

export const SITE_EDITOR_ROLES = ["superadmin", "administration", "proviseur"];
export const SITE_PUBLISHER_ROLES = ["superadmin", "proviseur"];

export function siteContentActionAccess(action: SiteContentAction): "editor" | "publisher" {
  return ["publish", "archive", "restore", "verify_source"].includes(action)
    ? "publisher"
    : "editor";
}

export function rolesForSiteContentAction(action: SiteContentAction): string[] {
  return siteContentActionAccess(action) === "publisher"
    ? SITE_PUBLISHER_ROLES
    : SITE_EDITOR_ROLES;
}

export function siteContentStatusAllowsAction(
  status: string,
  action: SiteContentAction
): boolean {
  if (status !== "archive") return true;
  return action === "archive" || action === "duplicate" || action === "restore" || action === "verify_source";
}

export function hasPublicSiteContentVersion(input: {
  status: string;
  publishedVersion: number | null;
}): boolean {
  return input.status !== "archive" &&
    Number.isInteger(input.publishedVersion) &&
    Number(input.publishedVersion) >= 1;
}
