export const PUBLIC_PORTAL_VIEWS = [
  "home", "services", "help", "collect", "requests", "school", "news", "agent", "trust",
] as const;

export type PublicPortalView = (typeof PUBLIC_PORTAL_VIEWS)[number];

export function publicPortalView(search: string): PublicPortalView {
  const requested = new URLSearchParams(search).get("view");
  return PUBLIC_PORTAL_VIEWS.includes(requested as PublicPortalView)
    ? requested as PublicPortalView
    : "home";
}

export const PUBLIC_PORTAL_TITLES: Record<PublicPortalView, string> = {
  home: "Lycée Blaise Cendrars · Sevran",
  services: "Services · Lycée Blaise Cendrars",
  help: "Demander de l’aide · Lycée Blaise Cendrars",
  collect: "Coordonnées personnelles · Lycée Blaise Cendrars",
  requests: "Suivre une demande · Lycée Blaise Cendrars",
  school: "Formations et vie du lycée · Blaise Cendrars",
  news: "À la une · Lycée Blaise Cendrars",
  agent: "Espace agent · Lycée Blaise Cendrars",
  trust: "Confidentialité · Lycée Blaise Cendrars",
};

type PublicPageAlternative = { href: string; label: string };

// Only point to public sections that already exist; this never exposes a draft.
export function publicPageAlternative(slug: string): PublicPageAlternative {
  if (["contact", "localisation"].includes(slug)) {
    return { href: "/?view=school#infos-pratiques", label: "Coordonnées et itinéraire" };
  }
  if (["formations", "bac-general", "bac-technologique", "bac-professionnel", "cap-etl"].includes(slug)) {
    return { href: "/?view=school#formations", label: "Consulter les formations" };
  }
  if (["specialites", "hlp", "llce", "maths", "nsi"].includes(slug)) {
    return { href: "/?view=school#specialites", label: "Découvrir les spécialités" };
  }
  if (["cdi", "unss", "presentations-clubs", "vie-du-lycee"].includes(slug)) {
    return { href: "/?view=school#vie-lycee", label: "Consulter la vie du lycée" };
  }
  if (slug === "se-connecter") {
    return { href: "/?view=services", label: "Accéder aux services numériques" };
  }
  if (["accueil-historique", "nouveau-site-lycee", "presentation-lycee"].includes(slug)) {
    return { href: "/?view=school", label: "Découvrir le lycée" };
  }
  return { href: "/?view=news", label: "Consulter les informations du lycée" };
}
