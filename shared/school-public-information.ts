/** Public editorial facts. Source register: docs/operations/REVISION_TEXTES_SITE_2026-09-07.md.
 * This module is not a published knowledge source for the assistant.
 */
export const SCHOOL_PUBLIC_INFORMATION = {
  name: "Lycée Blaise Cendrars",
  schoolYear: "2026-2027",
  address: "12 avenue Léon Jouhaux",
  locality: "93270 Sevran",
  phone: "01 49 36 20 50",
  phoneHref: "tel:+33149362050",
  email: "ce.0932048w@ac-creteil.fr",
  welcome: "L’accueil des parents et des visiteurs se fait sur rendez-vous. Utilisez le formulaire pour demander un rendez-vous avant de vous déplacer.",
} as const;

export const SECOND_YEAR_PARENTS_MEETING = {
  title: "Rencontre des parents de seconde",
  date: "2026-09-22",
  dateLabel: "Mardi 22 septembre 2026",
  location: "Au lycée Blaise Cendrars",
  description: "Présentation du fonctionnement du lycée et des accès à l’ENT pour les familles des élèves de seconde.",
  timeNotice: "L’horaire n’est pas encore communiqué.",
  // Midnight in Paris after the event, not an invented meeting time.
  expiresAt: "2026-09-22T22:00:00Z",
} as const;

export function showParentsMeeting(now: Date): boolean {
  const instant = now.getTime();
  return Number.isFinite(instant)
    && instant >= Date.parse("2026-09-04T00:00:00+02:00")
    && instant < Date.parse(SECOND_YEAR_PARENTS_MEETING.expiresAt);
}
