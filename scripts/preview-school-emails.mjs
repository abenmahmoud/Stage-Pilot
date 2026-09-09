// Generates fictional previews only. No network call or email is sent.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildIdentityVerificationEmail, buildSupportRequesterEmail, buildSupportAgentEmail } from "../shared/school-email-templates.mjs";

const output = resolve(process.argv[2] || ".vercel/school-email-previews");
mkdirSync(output, { recursive: true });
const common = { publicCode: "BC-2026-000001", requesterName: "Camille Exemple", requestSubject: "Inscription à la cantine",
  accessCode: "123456", trackingUrl: "https://example.org/?support_token=demonstration-inactive" };
const previews = {
  verification: buildIdentityVerificationEmail({ firstName: "Camille", code: "123456" }),
  confirmation: buildSupportRequesterEmail({ ...common, kind: "created" }),
  reponse: buildSupportRequesterEmail({ ...common, kind: "reply", bodyText: "Vous trouverez le formulaire demandé dans votre espace de suivi.\nVous pouvez nous le retourner complété depuis la même demande.\n\nL’intendance", attachmentCount: 1 }),
  reprise: buildSupportRequesterEmail({ ...common, kind: "recovery" }),
  agent: buildSupportAgentEmail({ ...common, serviceName: "Intendance", agentUrl: "https://example.org/?view=agent", isMessage: false }),
};
for (const [name, email] of Object.entries(previews)) {
  writeFileSync(resolve(output, `${name}.html`), email.htmlContent);
  writeFileSync(resolve(output, `${name}.txt`), `Objet : ${email.subject}\n\n${email.textContent}`);
}
writeFileSync(resolve(output, "index.html"), `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aperçu des emails du lycée</title><body style="font:16px/1.6 Arial,sans-serif;max-width:680px;margin:36px auto;padding:0 20px;color:#19344c"><h1>Les emails du lycée</h1><p>Aperçus fictifs. Les codes et liens de démonstration ne donnent aucun accès.</p><ul>${Object.entries(previews).map(([name, email]) => `<li><a href="${name}.html">${email.subject}</a></li>`).join("")}</ul></body></html>`);
console.log(JSON.stringify({ output, previews: Object.keys(previews), emailsSent: 0 }));
