// Shared by the web API and the VPS worker. Inputs are plain text, never HTML.
export const SCHOOL_EMAIL_NAME = "Lycée Blaise Cendrars";
export const SCHOOL_PUBLIC_URL = "https://lycee-blaise-cendrars-sevran.fr/";

const html = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const line = (value) => String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();
const greeting = (name) => line(name) ? `Bonjour ${line(name)},` : "Bonjour,";
const paragraph = (text) => `<p style="margin:0 0 18px">${html(text).replace(/\r?\n/g, "<br>")}</p>`;

export function schoolEmailSenderName(configured) {
  const name = line(configured);
  return !name || /^lyc[eé]e blaise cendrars$/i.test(name) ? SCHOOL_EMAIL_NAME : name;
}

function secureUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("invalid_school_email_url");
  return url;
}

export function schoolEmailUrl(base, params) {
  const url = secureUrl(base || SCHOOL_PUBLIC_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.href;
}

function validateCode(code) {
  if (!/^[0-9]{6}$/.test(code)) throw new Error("invalid_school_email_code");
}

function validateReference(publicCode) {
  if (!/^BC-[0-9]{4}-[0-9]{6}$/.test(publicCode)) throw new Error("invalid_school_email_reference");
}

function codeBlock(code) {
  return `<p style="margin:0 0 18px;font-size:30px;letter-spacing:5px;font-weight:bold;color:#19344c">${code}</p>`;
}

function renderEmail({ subject, title, preview, text, body, action, note }) {
  const url = action ? secureUrl(action.url).href : null;
  const actionHtml = action ? `<p style="margin:24px 0"><a href="${html(url)}" style="display:inline-block;background:#1659d9;color:#fff;text-decoration:none;font-weight:bold;padding:14px 20px;border-radius:8px">${html(action.label)}</a></p>` : "";
  return {
    subject: line(subject),
    textContent: `${text}${action ? `\n\n${action.label} : ${url}` : ""}${note ? `\n\n${note}` : ""}\n\n${SCHOOL_EMAIL_NAME}\nPortail du lycée · Sevran\n${SCHOOL_PUBLIC_URL}`,
    htmlContent: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(title)}</title></head><body style="margin:0;background:#f2f5f9;color:#243b50;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${html(preview)}</div><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:20px 10px"><table role="presentation" style="width:100%;max-width:600px;margin:auto;border-collapse:collapse;background:#fff"><tr><td style="padding:24px;background:#19344c;color:#fff"><strong style="font-size:20px">${SCHOOL_EMAIL_NAME}</strong><br><span style="font-size:13px;color:#d2e5f5">Portail du lycée · Sevran</span></td></tr><tr><td style="padding:28px 24px;overflow-wrap:anywhere;word-break:break-word"><h1 style="font-size:23px;line-height:1.3;margin:0 0 24px;color:#19344c">${html(title)}</h1>${body}${actionHtml}${note ? `<div style="font-size:14px;color:#526779">${paragraph(note)}</div>` : ""}</td></tr><tr><td style="padding:18px 24px;border-top:1px solid #e3eaf1;font-size:13px;color:#526779">${SCHOOL_EMAIL_NAME}<br><a href="${SCHOOL_PUBLIC_URL}" style="color:#1659d9;text-decoration:underline;overflow-wrap:anywhere;word-break:break-all">lycee-blaise-cendrars-sevran.fr</a></td></tr></table></td></tr></table></body></html>`,
  };
}

export function buildIdentityVerificationEmail({ firstName, code }) {
  validateCode(code);
  const hello = greeting(firstName);
  const instruction = "Saisissez ce code dans la conversation ouverte sur le site du lycée pour confirmer votre identité.";
  const note = "Ce code est valable 10 minutes. Ne le partagez pas et ne répondez pas à cet email avec le code. Si vous n’avez pas demandé cette vérification, ignorez ce message. Le lycée ne vous demandera jamais votre mot de passe.";
  return renderEmail({
    subject: `Votre code de vérification - ${SCHOOL_EMAIL_NAME}`,
    title: "Votre code de vérification",
    preview: "Confirmez votre identité dans la conversation sur le site du lycée.",
    text: `${hello}\n\n${instruction}\n\nVotre code de vérification : ${code}`,
    body: paragraph(hello) + paragraph(instruction) + codeBlock(code), note,
  });
}

export function buildSupportRequesterEmail({ kind, publicCode, requesterName, requestSubject, trackingUrl, accessCode, bodyText, attachmentCount = 0 }) {
  validateReference(publicCode);
  if (accessCode !== null) validateCode(accessCode);
  secureUrl(trackingUrl);
  const hello = greeting(requesterName);
  let title, intro, actionLabel, suffix;
  let note = "Le code et le lien sont à usage unique et expirent après 30 minutes. Votre demande reste enregistrée. Si cet accès a expiré, ouvrez « Mes demandes » sur le site du lycée pour demander un nouveau lien. Ne transférez pas cet email.";
  if (kind === "created") {
    title = "Votre demande est enregistrée";
    suffix = "Votre demande a été reçue";
    intro = `Votre demande « ${line(requestSubject)} » a bien été reçue. Vous pouvez consulter son avancement et les réponses du lycée dans « Mes demandes ».`;
    actionLabel = "Suivre ma demande";
  } else if (kind === "reply") {
    title = "Le lycée vous a répondu";
    suffix = "Réponse du lycée";
    intro = String(bodyText ?? "");
    actionLabel = "Lire et répondre";
  } else if (kind === "recovery") {
    title = "Reprendre le suivi de votre demande";
    suffix = "Votre lien de suivi";
    intro = "Voici votre nouveau lien pour retrouver les échanges et les documents de votre demande.";
    actionLabel = "Reprendre ma demande";
    note = "Cet accès expire après 30 minutes et ne peut être utilisé qu’une fois. Votre demande reste enregistrée. Si vous n’avez pas demandé ce lien, ignorez cet email. Votre demande n’est pas modifiée. Ne transférez pas ce message.";
  } else throw new Error("invalid_school_email_kind");
  const count = Number.isSafeInteger(attachmentCount) && attachmentCount > 0 ? attachmentCount : 0;
  const documents = kind === "reply" && count ? `${count} document${count > 1 ? "s sont disponibles" : " est disponible"} dans votre suivi sécurisé.` : "";
  const reference = `Numéro de demande : ${publicCode}`;
  const codeText = accessCode ? `Code à usage unique : ${accessCode}\nVous pouvez saisir ce code avec le numéro de demande dans « Mes demandes », ou utiliser le lien ci-dessous.` : "";
  return renderEmail({
    subject: `${publicCode} - ${suffix}`, title,
    preview: `${suffix}. Référence : ${publicCode}.`,
    text: [hello, reference, intro, documents, codeText].filter(Boolean).join("\n\n"),
    body: paragraph(hello) + paragraph(reference) + paragraph(intro) + (documents ? paragraph(documents) : "")
      + (accessCode ? paragraph("Code à usage unique :") + codeBlock(accessCode) + paragraph("Saisissez-le avec le numéro de demande dans « Mes demandes », ou utilisez le bouton ci-dessous.") : ""),
    action: { label: actionLabel, url: trackingUrl }, note,
  });
}

export function buildSupportAgentEmail({ publicCode, requesterName, requestSubject, serviceName, agentUrl, isMessage }) {
  validateReference(publicCode);
  const title = isMessage ? "Un nouveau message vous attend" : "Une nouvelle demande vous attend";
  const reference = `Dossier : ${publicCode}`;
  const details = [`Demandeur : ${line(requesterName)}`, `Objet : ${line(requestSubject)}`, serviceName ? `Service : ${line(serviceName)}` : ""].filter(Boolean).join("\n");
  return renderEmail({
    subject: `${publicCode} - ${isMessage ? "Nouveau message" : "Nouvelle demande"}`,
    title, preview: `${title}. Référence : ${publicCode}.`,
    text: `Bonjour,\n\n${reference}\n\n${details}`,
    body: paragraph("Bonjour,") + paragraph(reference) + paragraph(details),
    action: { label: "Ouvrir l’espace agent", url: schoolEmailUrl(agentUrl, { view: "agent" }) },
    note: "Connectez-vous à l’espace agent pour consulter le dossier et répondre. Cet email est une notification : aucune réponse n’a été envoyée au demandeur.",
  });
}
