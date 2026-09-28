/** Public, reviewed instructions shared by the regional device page and chat. */
export const REGIONAL_DEVICE_SAV_PATH = "/assistance-numerique";
export const REGIONAL_DEVICE_SAV_UPDATED_AT = "2026-09-28";

export const REGIONAL_DEVICE_SAV = {
  common: {
    prepare: [
      "L’ordinateur et son chargeur",
      "Le numéro de série indiqué sous l’appareil",
      "Une description courte de la panne et, si possible, une photo",
      "Une adresse email et un numéro de téléphone consultés régulièrement",
    ],
  },
  unowhy: {
    name: "PC UNOWHY Y13 / Y14",
    period: "Distribué jusqu’en 2025",
    audience: "Élèves encore scolarisés équipés d’un PC Windows UNOWHY",
    steps: [
      "Sauvegardez vos documents si l’ordinateur fonctionne encore. Une réparation peut effacer les données locales.",
      "Connectez-vous à Monlycée.net avec le compte de l’élève.",
      "Ouvrez « Mes outils pédagogiques », puis « Mes applis – Autres services » et « La Poste | SAV ».",
      "Choisissez « Dossier », puis « Créer un dossier ». Décrivez la panne et vérifiez l’adresse d’envoi du carton.",
      "Conservez la référence du dossier et suivez les messages du SAV. Après réparation, l’appareil est retourné au lycée.",
    ],
    officialUrl: "https://auth.monlycee.net/",
    faqUrl: "https://www.iledefrance.fr/toutes-les-faq/faq-problemes-de-connexion",
    formerStudentEmail: "assistanceidf@unowhy.com",
  },
  asus: {
    name: "Chromebook ASUS",
    period: "Distribué depuis 2026",
    audience: "Élèves et personnels dotés d’un Chromebook ASUS",
    summary: "Commencez toujours par l’assistance Mon Ordi. Elle distingue les problèmes de compte ou de logiciel des pannes matérielles.",
    portalUrl: "https://www.monordi-iledefrance.fr/sav/",
    steps: [
      "Ouvrez l’assistance Mon Ordi et lancez le diagnostic avec le chatbot disponible 24 h/24.",
      "Pour un problème d’accès, d’application ou de compte Google, suivez le diagnostic puis contactez le lycée si le blocage persiste.",
      "Pour une panne matérielle, remplissez le formulaire transmis après le diagnostic : coordonnées, numéro de série et description du problème.",
      "Attendez l’email d’accord RMA avant tout déplacement. La validation du dossier peut prendre jusqu’à 48 heures ouvrées ; ce n’est pas le délai de réparation.",
      "Déposez le Chromebook au magasin FNAC partenaire choisi, avec son chargeur, propre et sans pochette. Suivez ensuite les SMS ou emails et retirez-le dans le même magasin.",
    ],
  },
} as const;

export const UNOWHY_CHAT_ANSWER = `Pour un **PC UNOWHY Y13 ou Y14** d’un élève encore scolarisé :

1. Sauvegardez les documents si l’ordinateur fonctionne encore.
2. Connectez-vous sur **Monlycée.net** avec le compte de l’élève.
3. Ouvrez **« Mes outils pédagogiques » → « Mes applis – Autres services » → « La Poste | SAV »**.
4. Choisissez **« Dossier » → « Créer un dossier »**, décrivez la panne et vérifiez l’adresse d’envoi du carton.
5. Conservez la référence : après réparation, l’appareil est retourné au lycée.

Si l’accès à Monlycée.net vous bloque, dites-moi à quelle étape : je peux vous guider ou préparer une demande au lycée. Pour un Chromebook ASUS, la démarche est différente.`;
