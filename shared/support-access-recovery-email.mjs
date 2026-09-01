export function buildSupportAccessRecoveryEmail({ publicCode, trackingUrl, accessCode }) {
  if (!/^BC-[0-9]{4}-[0-9]{6}$/.test(publicCode) || (accessCode !== null && !/^[0-9]{6}$/.test(accessCode))) {
    throw new Error("invalid_recovery_email");
  }
  const url = new URL(trackingUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("invalid_recovery_url");
  const link = url.href.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const codeText = accessCode ? `\nCode \u00e0 usage unique : ${accessCode}` : "";
  const codeHtml = accessCode ? `<p>Code \u00e0 usage unique : <strong>${accessCode}</strong></p>` : "";
  return {
    subject: `${publicCode} - Votre lien de suivi`,
    textContent: `Bonjour,\n\nVoici votre nouveau lien pour reprendre la demande ${publicCode}.${codeText}\n${url.href}\n\nCet acc\u00e8s expire apr\u00e8s 30 minutes et ne peut \u00eatre utilis\u00e9 qu'une fois.\nSi vous n'avez pas demand\u00e9 ce lien, ignorez cet email. Votre demande n'est pas modifi\u00e9e.\nNe transf\u00e9rez pas ce message.`,
    htmlContent: `<p>Bonjour,</p><p>Voici votre nouveau lien pour reprendre la demande <strong>${publicCode}</strong>.</p>${codeHtml}<p><a href="${link}">Reprendre ma demande</a></p><p>Cet acc\u00e8s expire apr\u00e8s 30 minutes et ne peut \u00eatre utilis\u00e9 qu'une fois.</p><p>Si vous n'avez pas demand\u00e9 ce lien, ignorez cet email. Votre demande n'est pas modifi\u00e9e.</p><p>Ne transf\u00e9rez pas ce message.</p>`,
  };
}
