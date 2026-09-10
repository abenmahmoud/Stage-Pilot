/** Public corpus only. Never import the pack's internal procedures here.
 * Both the public page and the assistant read these reviewed answers.
 * Provenance and editorial decisions: docs/operations/CHROMEBOOK_2026-09-10.md.
 */
export const CHROMEBOOK_PATH = "/chromebook";
export const CHROMEBOOK_UPDATED_AT = "2026-09-10T16:00:00.000Z";
export const CHROMEBOOK_PORTAL = "https://monordi-iledefrance.fr/";
export const CHROMEBOOK_DISTRIBUTION = {
  start: "2026-09-14T00:00:00+02:00",
  end: "2026-09-16T00:00:00+02:00",
  dates: "14 et 15 septembre 2026",
  location: "Grande salle polyvalente",
  audience: "Élèves de seconde",
  planning: "Chaque classe suit le planning communiqué aux professeurs.",
} as const;

export const CHROMEBOOK_SECTIONS = [
  { id: "preparer", label: "Recevoir mon ordinateur", shortLabel: "Distribution" },
  { id: "connexion", label: "Me connecter", shortLabel: "Connexion" },
  { id: "utiliser", label: "Travailler au quotidien", shortLabel: "Utilisation" },
  { id: "depanner", label: "Une panne ou un problème", shortLabel: "Dépannage" },
  { id: "accompagner", label: "Parents et enseignants", shortLabel: "Accompagnement" },
] as const;
export type ChromebookSection = typeof CHROMEBOOK_SECTIONS[number]["id"];
export type ChromebookAnswer = {
  id: string;
  section: ChromebookSection;
  question: string;
  answer: string;
  keywords: string[];
  source: string;
};

const faq = "Région Île-de-France · FAQ Chromebook 2026-2027";
const family = "Région Île-de-France · Message de préparation aux familles";
const guide = "Région Île-de-France · Livret de rentrée 2026-2027";
const sav = "Région Île-de-France · Procédure SAV Chromebook";

export function distributionIsUpcoming(now: Date): boolean {
  return Number.isFinite(now.getTime()) && now.getTime() < Date.parse(CHROMEBOOK_DISTRIBUTION.end);
}

/** Event and campaign wording expires independently from the year-round guide. */
export function chromebookAnswers(now = new Date()): ChromebookAnswer[] {
  const upcoming = distributionIsUpcoming(now);
  const distribution = CHROMEBOOK_DISTRIBUTION;
  return [
    { id: "distribution", section: "preparer", question: "Quand et où a lieu la distribution ?",
      answer: upcoming
        ? `La distribution pour les élèves de seconde est prévue les **${distribution.dates}**, en **grande salle polyvalente**. ${distribution.planning} Aucun horaire par classe n’est publié ici : suivez les indications de votre professeur.`
        : "Les journées annoncées pour les élèves de seconde étaient les **14 et 15 septembre 2026**, en grande salle polyvalente. Si vous n’avez pas reçu votre ordinateur, le lycée doit vérifier votre situation et vous préciser les modalités de retrait. Aucun nouveau créneau n’est confirmé ici.",
      keywords: ["date", "quand", "distribution", "heure", "horaire", "planning", "salle", "14", "15", "recevoir"], source: "Lycée Blaise Cendrars · Organisation confirmée le 10 septembre 2026" },
    { id: "preparer", section: "preparer", question: "Que préparer avant de venir ?",
      answer: "**1. Activez votre compte Monlycée.net.**\n\n**2. Installez l’application MonOrdi IdF** depuis l’App Store ou Google Play et connectez-vous avec les identifiants ENT de l’élève.\n\n**3. Acceptez la dotation** dans l’application pour obtenir le QR code. Présentez ce QR code le jour de la remise, sur téléphone ou imprimé. Gardez vos identifiants personnels disponibles pour la mise en route, sans les partager dans le chat.",
      keywords: ["preparer", "preparation", "comment avoir", "comment obtenir", "comment recuperer", "comment recevoir", "apporter", "etapes", "application", "monordi", "mon ordi", "accepter", "dotation", "telecharger"], source: family },
    { id: "qr", section: "preparer", question: "Je n’ai pas de QR code ou de smartphone : que faire ?",
      answer: "Un **QR code déjà généré peut être imprimé**. Si vous n’avez pas de smartphone, si l’application bloque ou si le QR code n’apparaît pas, demandez de l’aide au lycée avant votre passage. Le représentant du lycée peut examiner une situation particulière après vérification de l’identité ; je ne peux pas garantir une remise sans QR code.",
      keywords: ["qr", "smartphone", "pas de telephone", "sans telephone", "imprimer", "papier", "appli marche pas", "application bloque"], source: `${family} ; ${guide}, p. 5-6` },
    { id: "absent", section: "preparer", question: "J’ai manqué la distribution : comment récupérer mon ordinateur ?",
      answer: "Le livret régional prévoit de conserver au lycée les colis nominatifs des élèves absents enregistrés dans l’ENT. **Le lycée doit confirmer que votre colis est disponible et vous indiquer quand le retirer.** Une absence ne permet pas de déduire un nouveau rendez-vous. Vous pouvez demander cette vérification à l’équipe du lycée depuis le chat.",
      keywords: ["absent", "absence", "manque", "rate", "rattrapage", "pas recu", "recuperer apres"], source: `${guide}, p. 5-6` },
    { id: "eligibilite", section: "preparer", question: "Qui est concerné par la dotation ?",
      answer: "Le dispositif régional concerne notamment les élèves de **seconde et de première année de CAP**. Au lycée, les journées des 14 et 15 septembre ont été confirmées pour les **secondes**. Les modalités locales pour les CAP ou les nouveaux entrants doivent être confirmées par l’établissement. Une dotation individuelle ne peut pas être garantie par le chat.",
      keywords: ["cap", "premiere", "terminale", "nouvel", "nouveau", "entrant", "eligible", "eligibilite", "droit", "qui est concerne"], source: `${guide}, p. 5-6 ; organisation locale confirmée` },
    { id: "refus", section: "preparer", question: "Peut-on refuser l’équipement ou changer d’avis ?",
      answer: "L’application MonOrdi IdF permet d’accepter ou de refuser la dotation. Si vous avez déjà refusé et souhaitez changer d’avis, faites vérifier votre situation par le lycée. Je ne peux ni modifier ce choix ni promettre une nouvelle dotation.",
      keywords: ["refus", "refuser", "refuse", "changer avis", "change avis", "pas besoin"], source: family },
    { id: "colis", section: "preparer", question: "Que contient le colis ?",
      answer: "Le colis comprend **le Chromebook, son chargeur et une pochette de protection**. Vérifiez son contenu au moment de la remise et signalez tout élément manquant à l’équipe présente. La remise est suivie d’un accompagnement à la mise en route.",
      keywords: ["colis", "contenu", "pochette", "fourni", "fourni avec", "accessoires"], source: `${guide}, p. 5-6` },
    { id: "connexion", section: "connexion", question: "Avec quel compte ouvrir le Chromebook ?",
      answer: "Utilisez **votre propre compte Monlycée.net**, activé avant la première connexion. Ce sont les identifiants de l’élève pour son Chromebook, même si un parent l’aide à préparer la distribution. MonOrdi IdF sert à préparer la remise ; Monlycée.net sert ensuite à vous connecter et à retrouver vos services. Ne prêtez pas votre compte.",
      keywords: ["compte", "identifiant", "connexion", "connecter", "allumer", "demarrer", "ouvrir", "premiere connexion"], source: `${faq}, p. 12` },
    { id: "mot-de-passe", section: "connexion", question: "J’ai oublié mon mot de passe Monlycée.net.",
      answer: "Sur la page de connexion de **Monlycée.net**, choisissez **« Mot de passe oublié »** et suivez la procédure de récupération. Si elle a déjà échoué, si le message n’arrive pas ou si vos coordonnées ne sont plus correctes, dites-le dans le chat : le référent numérique doit vérifier la situation. Le chat ne modifie pas lui-même vos coordonnées et ne vous demande jamais votre mot de passe.",
      keywords: ["mot de passe", "mdp", "identifiants perdus", "oubli", "activation ent"], source: `${faq}, p. 12 ; procédure d’assistance ENT du lycée` },
    { id: "wifi", section: "connexion", question: "Comment se connecter au Wi-Fi du lycée ?",
      answer: "La connexion au réseau **Wifi lycee IDF** est prévue automatiquement sur les Chromebooks régionaux dans l’établissement. Vérifiez que le Wi-Fi est activé. Si la connexion échoue, indiquez à un adulte du lycée le lieu et le message d’erreur : un personnel pourra faire remonter l’incident. Aucun mot de passe personnel ne doit être publié dans le chat.",
      keywords: ["wifi", "wi fi", "reseau", "capte", "internet", "connexion automatique"], source: `${faq}, p. 14` },
    { id: "maison", section: "connexion", question: "Puis-je l’utiliser chez moi et sans Internet ?",
      answer: "À la maison, sélectionnez votre réseau Wi-Fi dans les paramètres et saisissez son mot de passe **sur votre appareil**. Le Chromebook est conçu principalement pour travailler en ligne. Certains usages hors connexion sont possibles s’ils ont été préparés auparavant ; vérifiez l’accès à vos documents avant de quitter le réseau.",
      keywords: ["maison", "domicile", "chez moi", "hors connexion", "sans internet", "offline", "box"], source: `${faq}, p. 14` },
    { id: "bureautique", section: "utiliser", question: "Comment utiliser Word, Excel ou PowerPoint ?",
      answer: "Utilisez **Microsoft 365 dans le navigateur**, avec votre compte Monlycée.net, selon les services mis à disposition. Les logiciels Windows ne s’installent pas sur le Chromebook. Vous pouvez travailler sur vos documents en ligne ; vérifiez l’accès à l’outil demandé par votre professeur avant la séance.",
      keywords: ["word", "excel", "powerpoint", "office", "microsoft", "365", "bureautique"], source: `${faq}, p. 16` },
    { id: "fichiers", section: "utiliser", question: "Où enregistrer mes cours et mes fichiers ?",
      answer: "Enregistrez votre travail dans le **Drive de Monlycée.net** et vérifiez qu’il est bien synchronisé. Évitez de garder une seule copie sur l’ordinateur : les fichiers locaux risquent d’être perdus en cas de panne ou de réparation. Le Drive de l’ENT et Google Drive sont deux services différents.",
      keywords: ["fichier", "fichiers", "enregistrer", "sauvegarde", "stocker", "stockage", "drive", "perdu mon devoir", "document"], source: `${faq}, p. 9-10 ; ${sav}` },
    { id: "logiciels", section: "utiliser", question: "Puis-je installer un logiciel ou un fichier .exe ?",
      answer: "Le Chromebook utilise **ChromeOS**, pas Windows : les fichiers **.exe ne s’y exécutent pas**. Les usages scolaires passent principalement par le navigateur et les applications mises à disposition par la Région. Pour un logiciel de filière, votre professeur peut faire étudier le besoin, notamment avec Class’Connect ; sa disponibilité au lycée doit être confirmée.",
      keywords: ["installer", "installation", "logiciel", "logiciels", "exe", "windows", "chromeos", "linux", "jeux"], source: `${faq}, p. 16` },
    { id: "google", section: "utiliser", question: "Pourquoi Google Workspace n’est-il pas disponible ?",
      answer: "La FAQ régionale indique que **Google Workspace n’est pas déployé sur ces équipements**. Pour les travaux demandés en classe, utilisez les outils prévus par le lycée, notamment Microsoft 365 en ligne et le Drive Monlycée.net. Cette information ne permet pas d’affirmer que tous les services ou comptes Google personnels sont bloqués.",
      keywords: ["google", "workspace", "gmail", "docs", "sheets"], source: `${faq}, p. 9-10` },
    { id: "pronote", section: "utiliser", question: "Comment accéder à PRONOTE ?",
      answer: "Ouvrez **PRONOTE en version web depuis l’ENT Monlycée.net**. Vous pouvez y consulter les services activés pour votre profil. Certaines fonctions professionnelles peuvent nécessiter un autre poste ; les enseignants doivent vérifier les outils utiles à leur séance.",
      keywords: ["pronote", "notes", "emploi du temps"], source: `${faq}, p. 16` },
    { id: "entretien", section: "utiliser", question: "Quels gestes adopter chaque jour ?",
      answer: "**Rechargez le Chromebook avant de venir**, transportez-le dans sa pochette et éloignez les boissons. Gardez une sauvegarde de vos travaux dans le Drive Monlycée.net. L’autonomie varie selon l’usage : ne comptez pas sur une prise disponible en classe. Votre compte et vos identifiants restent strictement personnels.",
      keywords: ["charger", "recharger", "autonomie", "batterie", "entretien", "transport", "proteger", "chaque jour"], source: "Région Île-de-France · Checklist d’utilisation Chromebook" },
    { id: "accessibilite", section: "utiliser", question: "Existe-t-il des aides à l’accessibilité ?",
      answer: "ChromeOS propose des réglages d’accessibilité, notamment la **loupe, la lecture à voix haute et la saisie vocale**. Retrouvez-les dans les paramètres de l’appareil. Si vous avez besoin d’un aménagement particulier, faites-le préciser par l’équipe du lycée ; le chat ne décide pas d’un aménagement individuel.",
      keywords: ["accessibilite", "handicap", "loupe", "dictee", "vocale", "lecture voix"], source: `${faq}, p. 9-10` },
    { id: "sav", section: "depanner", question: "Mon Chromebook est en panne ou cassé : que faire ?",
      answer: "Commencez sur **[monordi-iledefrance.fr](https://monordi-iledefrance.fr/)** avec l’assistance ASUS. Après le diagnostic, si un retour est nécessaire, suivez le formulaire avec le numéro de série et les informations demandées. **Attendez l’accord de retour RMA avant le dépôt** dans un magasin FNAC partenaire. Apportez l’ordinateur et son chargeur, **sans la pochette**. Sauvegardez vos fichiers si c’est encore possible. Le lycée peut vous orienter, mais n’effectue pas la réparation.",
      keywords: ["sav", "panne", "casse", "cassee", "reparer", "reparation", "ecran noir", "allume plus", "ne demarre", "fonctionne plus", "ne marche plus", "asus", "fnac", "charge plus", "fissure", "tombe"], source: sav },
    { id: "delai-sav", section: "depanner", question: "Que signifie le délai de 48 heures ouvrées ?",
      answer: "Les **48 heures ouvrées** annoncées concernent **l’examen du dossier SAV après l’envoi du formulaire**, pas la durée de réparation. L’accord de retour RMA est transmis par email après validation. Le suivi de la réparation est ensuite communiqué par SMS selon la procédure régionale.",
      keywords: ["48", "delai", "combien de temps", "suivi", "rma", "accord retour", "sms"], source: sav },
    { id: "cout-sav", section: "depanner", question: "La réparation est-elle toujours gratuite ?",
      answer: "La prise en charge dépend du diagnostic et de la garantie. Pour un dommage hors garantie, **une participation financière peut être demandée à la famille**. Des tarifs ont été négociés avec les partenaires régionaux, mais le chat ne peut pas annoncer un prix : consultez le devis et les conditions communiquées par le SAV avant de vous engager.",
      keywords: ["cout", "coute", "prix", "payer", "paye", "gratuit", "garantie", "devis"], source: `${sav} ; ${guide}, p. 8` },
    { id: "pret", section: "depanner", question: "Puis-je avoir un ordinateur pendant une réparation ou en cas d’oubli ?",
      answer: "La Région n’annonce pas de stock complémentaire destiné au remplacement temporaire des Chromebooks. **Les possibilités d’aide au lycée doivent être vérifiées avec l’équipe**, sans garantie de prêt. Prévenez votre professeur pour organiser le travail pendant l’indisponibilité de votre appareil.",
      keywords: ["pret", "preter", "remplacement", "secours", "en attendant", "oublie ordinateur", "oublie mon", "pas mon ordinateur"], source: `${guide}, p. 8 ; vérification locale nécessaire` },
    { id: "ancien-pc", section: "depanner", question: "J’ai un ancien ordinateur UNOWHY Y13 : est-ce le même SAV ?",
      answer: "**Les anciens UNOWHY Y13 ont leur propre parcours SAV.** Depuis Monlycée.net, ouvrez « Mes outils pédagogiques », puis l’entrée La Poste / SAV indiquée pour cet équipement. Le parcours ASUS et le retour en FNAC décrits ici concernent les Chromebooks. En cas de doute sur le modèle, demandez de l’aide au référent numérique.",
      keywords: ["unowhy", "y13", "ancien", "ancien ordinateur", "ancien pc"], source: `${guide}, p. 9` },
    { id: "charte", section: "accompagner", question: "Faut-il signer une convention papier ?",
      answer: "Le livret régional n’annonce **pas de convention de prêt papier** pour cette remise. Les conditions figurent dans la charte Monlycée.net, acceptée lors de l’activation du compte. Le choix dans MonOrdi IdF et la confirmation de réception restent deux étapes distinctes : **confirmez la réception seulement après la remise effective**.",
      keywords: ["convention", "signer", "signature", "charte", "contrat", "confirmation", "confirmer reception"], source: `${guide}, p. 5-6 ; message régional après distribution` },
    { id: "parents", section: "accompagner", question: "Comment aider mon enfant à préparer la remise ?",
      answer: "Vérifiez avec votre enfant qu’il peut ouvrir **son compte Monlycée.net**, puis aidez-le à préparer son QR code dans MonOrdi IdF. L’opération utilise le compte de l’élève. Après la remise, accompagnez-le pour sauvegarder ses travaux, recharger l’appareil et conserver ses identifiants pour lui seul. Le livret prévoit une information des responsables légaux sur le choix et la remise.",
      keywords: ["parent", "parents", "enfant", "maman", "papa", "responsable legal", "notification"], source: `${family} ; ${guide}, p. 5-6` },
    { id: "filtrage", section: "accompagner", question: "Comment encadrer l’usage à la maison ?",
      answer: "La FAQ régionale indique que le contrôle parental de Google Workspace n’est pas proposé sur ces Chromebooks. Le filtrage du réseau de l’établissement relève de la Région. À la maison, vérifiez les réglages disponibles sur votre box et convenez avec votre enfant d’horaires et de règles d’usage. Pour une difficulté particulière, échangez avec le lycée.",
      keywords: ["controle parental", "filtrage", "bloquer sites", "surveiller", "limiter", "ecrans"], source: faq },
    { id: "enseignants", section: "accompagner", question: "Quelle dotation pour les enseignants ?",
      answer: now.getTime() < Date.parse("2026-10-01T00:00:00+02:00")
        ? "Le livret régional annonce une nouvelle vague de dotation volontaire des enseignants pour **octobre-novembre 2026**, avec des inscriptions prévues jusqu’au courant de septembre, sans date de clôture précise. Consultez le message envoyé sur votre adresse **@monlycee.net** et faites confirmer la disponibilité. Les livraisons ne sont pas celles des élèves les 14 et 15 septembre."
        : "Le livret de rentrée annonçait une vague de dotation volontaire des enseignants pour **octobre-novembre 2026**. Cette annonce ne confirme pas l’ouverture actuelle des inscriptions ni une livraison individuelle. Consultez votre messagerie **@monlycee.net** et faites vérifier la situation auprès du référent numérique.",
      keywords: ["enseignant", "enseignants", "professeur", "prof", "dotation prof", "volontaire"], source: `${guide}, p. 7` },
    { id: "restitution", section: "accompagner", question: "Un enseignant doit-il rendre son Y13 en recevant un Chromebook ?",
      answer: "Le livret régional prévoit que l’enseignant doté d’un Chromebook **restitue son ancien UNOWHY Y13 au coordonnateur numérique** de l’établissement. Faites préciser les modalités locales de collecte avant de déposer l’appareil.",
      keywords: ["rendre", "restituer", "restitution", "garder les deux", "remplace y13"], source: `${guide}, p. 7` },
    { id: "classe-connect", section: "accompagner", question: "Comment utiliser les logiciels de filière et projeter en classe ?",
      answer: "Pour un logiciel de filière, un enseignant peut faire étudier une solution via **Class’Connect et Mon Support** ; cela ne confirme pas son activation au lycée. Pour projeter, la documentation décrit une liaison HDMI, avec USB pour les fonctions interactives des équipements compatibles, ou Cast pour une projection sans interaction. **Testez le matériel et vos liens avant la séance.**",
      keywords: ["class connect", "classconnect", "filiere", "projeter", "projection", "videoprojecteur", "eni", "vpi", "hdmi", "cast", "ezwrite"], source: `${faq}, p. 16 ; documentation régionale de prise en main` },
  ];
}

export function chromebookQuestion(id: unknown): string {
  if (typeof id !== "string") return "";
  const entry = chromebookAnswers().find((item) => item.id === id);
  return entry ? `À propos du Chromebook : ${entry.question}` : "";
}
