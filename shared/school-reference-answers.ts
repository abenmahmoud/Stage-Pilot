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
  let updatedAt = "2026-09-09T00:00:00.000Z";
  if (/\b(rencontre|reunion)\b/.test(text) && /\b(parents|familles|seconde|rentree)\b/.test(text) && showParentsMeeting(now)) {
    reply = `${SECOND_YEAR_PARENTS_MEETING.title} : ${SECOND_YEAR_PARENTS_MEETING.dateLabel.toLowerCase()}. Accueil en salle polyvalente de 17 h 50 à 18 h 10, puis rencontre avec les professeurs principaux de 18 h 10 à 19 h, dans les salles indiquées par le planning du lycée.`;
    source = "Hebdo du lycée du 21 au 25 septembre 2026, p. 1";
    updatedAt = "2026-09-18T14:23:14.000Z";
  } else if (/\b(horaires?|horraires?|heures?|ouvert|ouverture|ouvre|fermeture|ferme|rendez[ -]vous|rdv)\b/.test(text)
    && /\b(accueil|lycee|parents|visiteur|vous|intendance|secretariat|administration|referent numerique)\b/.test(text)
    && !/\b(cours|emploi du temps|edt)\b/.test(text)) {
    const asksHours = /\b(horaires?|horraires?|heures?|ouvert|ouverture|ouvre|fermeture|ferme)\b/.test(text);
    reply = `${SCHOOL_PUBLIC_INFORMATION.welcome}${asksHours ? ` Les horaires précis ne sont pas encore renseignés ici. Pour les vérifier, vous pouvez joindre l’accueil au ${SCHOOL_PUBLIC_INFORMATION.phone}.` : ""}`;
    source = "Accueil sur rendez-vous — services confirmés par le lycée";
    updatedAt = "2026-09-13T22:00:00.000Z";
  } else if (/\b(adresse|telephone|numero|contacter|joindre)\b/.test(text) && /\b(lycee|accueil|etablissement)\b/.test(text)) {
    reply = `Le lycée Blaise Cendrars se trouve au ${SCHOOL_PUBLIC_INFORMATION.address}, ${SCHOOL_PUBLIC_INFORMATION.locality}. Téléphone : ${SCHOOL_PUBLIC_INFORMATION.phone}. Email de l’établissement : ${SCHOOL_PUBLIC_INFORMATION.email}.`;
  } else if (/\b(carnet|carte du lycee)\b/.test(text) && /\b(obligatoire|entrer|entree|presenter|faut|regle)\b/.test(text)) {
    reply = "Pour entrer dans le lycée, présentez votre carte du lycée ou votre carnet de correspondance. Gardez ce document avec vous : un adulte de l’établissement peut vous demander de le présenter.";
    source = "Livret d’accueil 2026-2027, p. 14";
  } else if (/\b(absence|absences)\b/.test(text) && /\b(justifier|justificatif|delai|combien|comment)\b/.test(text) && !/\b(professeur|prof|personnel|enseignant)\b/.test(text)) {
    reply = "Prévenez la vie scolaire de l’absence. Au retour de l’élève, l’absence doit être justifiée dans les 48 heures, avec un justificatif signé dans le carnet de liaison, présenté à la vie scolaire avant l’entrée en cours. Vous pouvez préparer votre demande ici ; sa validation relève du lycée.";
    source = "Livret d’accueil 2026-2027, p. 10 et 15";
  }
  return reply ? { reply, sourceReferences: [{ title: source, updatedAt }] } : null;
}
