import assert from "node:assert/strict";
import {
  isPublicEquipmentVisit,
  isPublicEquipmentVisitsPayload,
} from "../shared/equipment-support.ts";
import { routeSupportRequest } from "../shared/support-routing.ts";

const visit = {
  id: "86a6f564-66e7-4df1-b789-0e04e8d76842",
  provider: "SPIE",
  startsAt: "2026-09-28T08:00:00.000Z",
  endsAt: "2026-09-28T11:00:00.000Z",
  location: "Accueil",
  publicNote: "Les salles doivent être accessibles.",
};

assert.equal(isPublicEquipmentVisit(visit), true);
assert.equal(isPublicEquipmentVisitsPayload({ visits: [visit] }), true);
assert.equal(isPublicEquipmentVisit({ ...visit, internalNote: "Contact privé" }), false);
assert.equal(isPublicEquipmentVisit({ ...visit, endsAt: visit.startsAt }), false);
assert.equal(isPublicEquipmentVisitsPayload({ visits: Array.from({ length: 13 }, () => visit) }), false);

const ordinary = routeSupportRequest({
  category: "ordinateur",
  subject: "Vidéoprojecteur B204",
  description: "L'image ne s'affiche plus.",
});
assert.equal(ordinary.service, "referent_numerique");
assert.equal(ordinary.priority, "p3");

const safety = routeSupportRequest({
  category: "ordinateur",
  subject: "Ordinateur B204",
  description: "Risque matériel signalé : appareil mis à l’écart si cela pouvait être fait sans danger.",
});
assert.equal(safety.service, "referent_numerique");
assert.equal(safety.priority, "p1");
assert.equal(safety.reason, "risque_materiel_a_securiser");

const studentDanger = routeSupportRequest({
  category: "vie_scolaire",
  subject: "Danger",
  description: "Un élève est menacé.",
});
assert.equal(studentDanger.service, "vie_scolaire");
assert.equal(studentDanger.priority, "p1");

process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/test";
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test";
const { parseSupportRequest } = await import("../api/_shared/support.ts");
const description = "Risque matériel signalé : appareil mis à l’écart si cela pouvait être fait sans danger.";
const parsed = parseSupportRequest({
  requesterType: "professeur",
  beneficiaryType: "self",
  requesterFirstName: "Camille",
  requesterLastName: "Martin",
  email: "camille.martin@ac-creteil.fr",
  preferredChannel: "email",
  category: "ordinateur",
  subject: "Poste B204",
  description,
  conversation: [{ role: "requester", content: description }],
  equipmentReportVersion: "1",
  equipmentType: "desktop",
  roomCode: "B204",
  symptomSummary: "Le poste surchauffe fortement.",
  impact: "class_blocked",
  safetyRisk: "yes",
});
assert.equal(parsed.routing.service, "referent_numerique");
assert.equal(parsed.routing.priority, "p1");
assert.equal(parsed.subjectContext.roomCode, "B204");
assert.equal(parsed.subjectContext.safetyRisk, "yes");

console.log("equipment support policy: ok");
