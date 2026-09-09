// A tool mentioned in a question is not necessarily the subject of the request.
export function isCateringSupportTopic(value: string): boolean {
  const text = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(internat|hebergement scolaire)\b/.test(text)) return false;
  if (!/\b(cantine|restauration|repas|badge|bourse|intendance|demi[- ]pension)\b/.test(text)) return false;
  // A clearly stated ENT/PRONOTE access problem remains with digital support,
  // even when accessing the meal service is the reason for needing that access.
  const explicitDigitalAccess = /\b(codes?|identifiants?|mot de passe)\b.{0,30}\b(ent|educonnect|pronotes?)\b/.test(text)
    || /\b(connecter|connexion|acceder|ouvrir)\b.{0,25}\b(ent|educonnect|pronotes?)\b/.test(text)
    || /\b(ent|educonnect|pronotes?)\b.{0,30}\b(bloque|bloquee|inaccessible|ne marche|ne fonctionne)\b/.test(text);
  return !explicitDigitalAccess;
}
