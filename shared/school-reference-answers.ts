import { SCHOOL_PUBLIC_INFORMATION, SECOND_YEAR_PARENTS_MEETING, showParentsMeeting } from "./school-public-information.js";

type Message = { role: string; content: string };
/** Public extracts reviewed against the owner's instructions and source pages.
 * Private staff information and unapproved weekly changes are deliberately absent.
 */
export function schoolReferenceAnswer(messages: readonly Message[], now: Date) {
  if (!Number.isFinite(now.getTime()) || now < new Date("2026-09-04T00:00:00Z") || now >= new Date("2027-09-01T00:00:00Z")) return null;
  const latest = messages.findLast(message => message.role === "requester")?.content ?? "";
  const text = latest.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, " ");
  let reply = "";
  let source = "Livret d’accueil 2026-2027, p. 1";
  if (/\b(rencontre|reunion)\b/.test(text) && /\b(parents|familles|seconde|rentree)\b/.test(text) && showParentsMeeting(now)) {
    reply = `${SECOND_YEAR_PARENTS_MEETING.title} : ${SECOND_YEAR_PARENTS_MEETING.dateLabel.toLowerCase()}, au lycée Blaise Cendrars. L’horaire est en cours de confirmation.`;
    source = "Information confirmée par le lycée — rentrée 2026";
  } else if (/\b(horaires?|horraires?|ouvert|ouverture|rendez[ -]vous|rdv)\b/.test(text) && /\b(accueil|lycee|parents|visiteur|vous)\b/.test(text)) {
    reply = `L’accueil des parents et des visiteurs se fait actuellement sur rendez-vous. Vous pouvez demander un rendez-vous ici ou appeler le ${SCHOOL_PUBLIC_INFORMATION.phone}. Aucun horaire d’ouverture au public n’est confirmé pour le moment.`;
    source = "Modalités d’accueil confirmées par le lycée";
  } else if (/\b(adresse|telephone|numero|contacter|joindre)\b/.test(text) && /\b(lycee|accueil|etablissement)\b/.test(text)) {
    reply = `Le lycée Blaise Cendrars se trouve au ${SCHOOL_PUBLIC_INFORMATION.address}, ${SCHOOL_PUBLIC_INFORMATION.locality}. Téléphone : ${SCHOOL_PUBLIC_INFORMATION.phone}. Email de l’établissement : ${SCHOOL_PUBLIC_INFORMATION.email}. L’accueil des visiteurs se fait sur rendez-vous.`;
  } else if (/\b(carnet|carte du lycee)\b/.test(text) && /\b(obligatoire|entrer|entree|presenter|faut|regle)\b/.test(text)) {
    reply = "Pour entrer dans le lycée, présentez votre carte du lycée ou votre carnet de correspondance. Gardez ce document avec vous : un adulte de l’établissement peut vous demander de le présenter.";
    source = "Livret d’accueil 2026-2027, p. 14";
  } else if (/\b(absence|absences)\b/.test(text) && /\b(justifier|justificatif|delai|combien|comment)\b/.test(text) && !/\b(professeur|prof|personnel|enseignant)\b/.test(text)) {
    reply = "Prévenez la vie scolaire de l’absence. Au retour de l’élève, l’absence doit être justifiée dans les 48 heures, avec un justificatif signé dans le carnet de liaison, présenté à la vie scolaire avant l’entrée en cours. Vous pouvez préparer votre demande ici ; sa validation relève du lycée.";
    source = "Livret d’accueil 2026-2027, p. 10 et 15";
  }
  return reply ? { reply, sourceReferences: [{ title: source, updatedAt: "2026-09-09T00:00:00.000Z" }] } : null;
}
