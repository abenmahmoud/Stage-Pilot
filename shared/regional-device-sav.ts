/** Public, reviewed instructions shared by the regional device page and chat. */
export const REGIONAL_DEVICE_SAV_PATH = "/assistance-numerique";
export const REGIONAL_DEVICE_SAV_UPDATED_AT = "2026-09-16";

export const REGIONAL_DEVICE_SAV = {
  unowhy: {
    name: "PC UNOWHY Y13",
    audience: "Élèves équipés avant la rentrée 2026, notamment en première et terminale",
    steps: [
      "Sauvegardez vos documents si l’ordinateur fonctionne encore. Une réparation peut effacer ses données.",
      "Connectez-vous avec le compte de l’élève sur Monlycée.net. Ouvrez « Mes outils pédagogiques », puis « La Poste SAV ».",
      "Décrivez la panne dans le service officiel et suivez les consignes reçues pour l’envoi et le suivi. Conservez la référence du dossier.",
      "Attendez la confirmation du lieu et des modalités de récupération avant de vous déplacer au lycée.",
    ],
    officialUrl: "https://monlycee.net/",
    faqUrl: "https://iledefrance-unowhy.com/assistance-faq/",
    formerStudentUrl: "https://iledefrance-unowhy.com/contact-assistance/",
  },
  asus: {
    name: "Chromebook ASUS",
    audience: "Élèves de seconde équipés en 2026 et personnels dotés d’un Chromebook",
    summary: "Le constructeur ASUS assure le SAV avec l’appui du réseau Fnac-Darty. Commencez par le diagnostic sur le portail régional ; la marche à suivre dépend du résultat.",
    portalUrl: "https://monordi-iledefrance.fr/",
  },
} as const;

export const UNOWHY_CHAT_ANSWER = `Pour un **PC UNOWHY Y13** d’un élève encore scolarisé :

1. Sauvegardez les documents si l’ordinateur fonctionne encore.
2. Connectez-vous sur **Monlycée.net** avec le compte de l’élève, puis ouvrez **« Mes outils pédagogiques » → « La Poste SAV »**.
3. Décrivez la panne et suivez les consignes du service pour l’envoi et le suivi. Conservez la référence du dossier.

Le chat UNOWHY a fermé le 30 avril 2026. Si l’accès à Monlycée.net vous bloque, dites-moi à quelle étape : je peux vous guider ou préparer une demande au lycée. Le lieu de récupération est à confirmer après traitement. Pour un Chromebook ASUS, la démarche est différente.`;
