// Utilitaire horaire partagé (LOT 6 du plan de connaissance OB1,
// 2026-09-05). Un `Date` JavaScript ne porte aucun fuseau : `toISOString()`
// et `.getUTCHours()`/`.getHours()` (dépendant du fuseau du process, jamais
// garanti en production) répondent en UTC. C'est ce qui a produit le défaut
// relevé par la cartographie (ligne 21) : le quota d'affichage du coffre et
// la planification des contrôles de connaissance redémarraient à l'heure
// UTC, pas à minuit/l'heure réelle de Paris. Tout code qui a besoin de
// « quel jour/quelle heure sommes-nous à Paris » doit passer par ce module.

const PARIS_TIME_ZONE = "Europe/Paris";

/** Heure locale (0-23) à Paris pour un instant donné, CET/CEST inclus. */
export function parisHourOf(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(instant);
  const hour = parts.find((part) => part.type === "hour")?.value;
  if (hour === undefined) throw new Error("paris_hour_unavailable");
  return Number.parseInt(hour, 10);
}

/** Date calendaire (YYYY-MM-DD) à Paris pour un instant donné. */
export function parisDateStringOf(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PARIS_TIME_ZONE }).format(instant);
}
