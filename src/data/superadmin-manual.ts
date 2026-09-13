/** Guide révisé avec les écrans et rapports de livraison le 12 septembre 2026.
 * Instructions générales uniquement : ni annuaire, ni secret, ni état opérationnel en temps réel.
 * Mettre à jour la fiche concernée lorsqu'un parcours ou une limite change.
 */
export const MANUAL_REVIEW_DATE = "12 septembre 2026";

export const MANUAL_GROUPS = [
  { id: "quotidien", label: "Demandes et accueil" },
  { id: "publications", label: "Actualités et calendrier" },
  { id: "diffusion", label: "Messages et notifications" },
  { id: "donnees", label: "Données et agent IA" },
  { id: "pilotage", label: "Équipe et pilotage" },
  { id: "scolarite", label: "Stages et Grand Oral" },
] as const;
export type ManualGroup = typeof MANUAL_GROUPS[number]["id"];
export type ManualArticle = {
  id: string;
  group: ManualGroup;
  title: string;
  summary: string;
  access: string;
  prerequisite: string;
  steps: string[];
  result: string;
  check: string;
  availability?: { label: string; detail: string };
  links: { label: string; to: string }[];
};

export const MANUAL_ARTICLES: ManualArticle[] = [
  {
    id: "bien-demarrer", group: "pilotage", title: "Se repérer dans les espaces",
    summary: "Retrouver la gestion du lycée, le site public et les outils de scolarité.",
    access: "Ce manuel est réservé au superadmin. Les outils conservent leurs propres habilitations.",
    prerequisite: "Un compte professionnel individuel et les droits correspondant à sa fonction.",
    steps: [
      "Ouvrez Gestion du lycée pour retrouver les demandes, les publications et l’administration du portail.",
      "Utilisez Vue d’ensemble pour ouvrir un outil. Le menu présente uniquement les entrées prévues pour votre rôle et les modules ouverts.",
      "Les outils de stages et de Grand Oral disposent d’un espace distinct. Leur menu ne contient plus les outils de gestion du portail.",
      "Utilisez Voir le site pour contrôler le résultat public. Pour travailler, revenez à l’adresse privée de gestion.",
    ],
    result: "Le superadmin dispose du pilotage global ; les collègues travaillent dans le périmètre attribué à leur compte.",
    check: "Une entrée absente ou un accès refusé ne se corrige pas en changeant l’adresse : vérifiez le rôle, le service et l’ouverture du module. Masquer un menu ne remplace pas les contrôles d’accès.",
    links: [{ label: "Gestion du lycée", to: "/gestion" }, { label: "Stages", to: "/stages" }, { label: "Voir le site", to: "/" }],
  },
  {
    id: "repondre-demande", group: "quotidien", title: "Prendre et traiter une demande",
    summary: "Répondre dans le dossier, joindre un document et conserver l’historique.",
    access: "Superadmin et membres des services autorisés pour le dossier.",
    prerequisite: "Une demande enregistrée et un accès au service responsable.",
    steps: [
      "Dans Demandes, recherchez le dossier ou filtrez par service, priorité ou statut. Lisez le besoin et les échanges précédents.",
      "Utilisez Prendre la demande si elle n’est pas attribuée. Vérifiez le service responsable : la cantine relève de l’intendance.",
      "Rédigez la réponse. Joindre permet d’ajouter une pièce ; attendez la fin de son contrôle. Pour une réponse sensible, respectez la vérification d’identité demandée à l’écran.",
      "Relisez le destinataire et le message, puis utilisez Valider et envoyer. Vérifiez la confirmation et l’apparition du message dans l’historique.",
      "Choisissez le statut adapté. Note interne sert à transmettre une consigne aux collègues. Pour clôturer, indiquez le motif ; Rouvrir le dossier permet de reprendre une demande clôturée.",
    ],
    result: "La réponse et les pièces autorisées restent dans le suivi de la demande. Une note interne reste invisible pour la famille.",
    check: "Si l’envoi n’est pas confirmé, relisez l’historique et le suivi du fonctionnement avant de recommencer. Un contact vérifié ne prouve pas à lui seul le lien avec un élève.",
    links: [{ label: "Ouvrir les demandes", to: "/gestion/demandes" }, { label: "Suivi du fonctionnement", to: "/admin/sante-demandes" }],
  },
  {
    id: "validations", group: "quotidien", title: "Valider une action de l’agent",
    summary: "Examiner les actions qui nécessitent une décision humaine.",
    access: "La personne habilitée pour le type d’action et le service concernés.",
    prerequisite: "Une action présente dans Validations des demandes.",
    steps: [
      "Ouvrez Validations des demandes et sélectionnez l’action en attente.",
      "Lisez les éléments à contrôler, le contexte et le rôle demandé. Vérifiez les pièces utiles dans le dossier.",
      "Choisissez Valider ou Refuser. Un refus demande un motif pour permettre la correction.",
      "Confirmez la décision. Contrôlez ensuite le résultat de l’action : une autorisation n’est pas encore une preuve d’exécution.",
    ],
    result: "La décision est enregistrée ; le service concerné peut poursuivre l’action autorisée.",
    check: "L’auteur ne peut pas valider sa propre action dans cette file. Les règles de validation des flashs sont distinctes et sont précisées dans leur écran.",
    links: [{ label: "Ouvrir les validations", to: "/admin/validations-agent" }],
  },
  {
    id: "identite", group: "quotidien", title: "Accompagner la vérification d’identité",
    summary: "Comprendre le parcours du chat, les contacts connus et le code de vérification.",
    access: "Élève, responsable ou personnel pour ses informations autorisées ; services habilités pour les rectifications.",
    prerequisite: "Une personne identifiable dans l’annuaire actif et au moins un canal connu disponible.",
    steps: [
      "La personne explique son besoin dans le chat et se présente. Les informations nécessaires servent à retrouver une correspondance, sans dévoiler l’annuaire.",
      "Lorsqu’une correspondance est établie, elle choisit parmi les contacts masqués proposés : email ou SMS, selon les coordonnées et les canaux disponibles.",
      "Elle demande le code puis le saisit dans le champ de vérification prévu. Un seul canal validé suffit pour ce contrôle ; aucun mot de passe ne doit être donné au chat.",
      "Si aucun contact n’est utilisable, elle prépare une demande de rectification avec les bons contacts et les éléments utiles. L’agent ne modifie pas l’annuaire lui-même.",
      "Après expiration de l’accès, ou pour changer de personne, une nouvelle vérification est nécessaire. Un visiteur peut déposer une demande sans accéder aux données personnelles.",
    ],
    result: "La session vérifiée ouvre uniquement les informations du profil et les liens parent-enfant autorisés.",
    check: "En cas de code absent, vérifier le canal choisi, les courriers indésirables et le traitement des envois. Ne jamais inventer un identifiant ENT à partir du prénom et du nom.",
    links: [{ label: "Voir le parcours du chat", to: "/?view=help" }, { label: "Contrôler l’annuaire", to: "/admin/repertoire-identites" }],
  },
  {
    id: "autonomie-agent", group: "quotidien", title: "Savoir ce que l’agent traite seul",
    summary: "Distinguer réponse immédiate, donnée manquante et intervention humaine.",
    access: "Réponses publiques pour tous ; services personnels selon l’identité et les droits vérifiés.",
    prerequisite: "Des informations publiées à jour et, pour un service personnel, une source active exploitable.",
    steps: [
      "Testez une question publique dont la réponse figure dans une source publiée : le chat peut répondre directement.",
      "Pour un emploi du temps ou un autre service personnel, faites vérifier l’identité puis contrôlez que la source correspondante est active, datée et reliée à la bonne personne.",
      "Si une information manque, est périmée ou exige une décision humaine, l’agent prépare le relais vers le service compétent.",
      "Corrigez une réponse en mettant à jour sa source officielle et en la faisant valider. Une affirmation dans une conversation ne devient pas une nouvelle règle du lycée.",
      "Pour améliorer un parcours, conservez la référence de demande et l’étape qui bloque ; vérifiez de nouveau le scénario après correction.",
    ],
    result: "L’autonomie dépend du service réellement raccordé et de ses preuves. Une identité confirmée ne rend pas disponibles des données qui n’ont pas encore été activées.",
    check: "Ne promettez pas une génération automatique de tout document ni un emploi du temps complet tant que les modèles, les sources et les contrôles correspondants ne sont pas validés.",
    links: [{ label: "Tester le chat", to: "/?view=help" }, { label: "Connaissances de l’IA", to: "/admin/connaissances-agent" }],
  },
  {
    id: "articles", group: "publications", title: "Créer une actualité à la une",
    summary: "Écrire, illustrer et publier une information lisible sur téléphone.",
    access: "Rédacteurs autorisés ; publication selon les droits affichés.",
    prerequisite: "Un texte et des dates vérifiés auprès d’une source du lycée.",
    steps: [
      "Dans Contenus du site, utilisez Nouveau contenu (+), éventuellement à partir d’un modèle.",
      "Renseignez le titre, un résumé court et le message. Aide IA peut rédiger, corriger ou simplifier une proposition que vous relisez.",
      "Choisissez la catégorie et le public. Cochez Mettre à la une pour donner la priorité à l’information. Ajoutez une photo adaptée ou conservez l’illustration thématique proposée.",
      "Renseignez les rendez-vous utiles et, si nécessaire, le retrait automatique. Contrôlez les aperçus ordinateur et téléphone.",
      "Enregistrez, puis faites valider ou publiez selon vos droits. Vérifiez la page avec Voir le site ; publier un article n’envoie pas automatiquement une notification.",
    ],
    result: "La version publiée alimente le site, ses cartes et ses dates ; les modifications en brouillon ne remplacent pas encore la publication.",
    check: "Si Publier est absent, vérifiez les droits et l’état de reprise. Un ancien contenu doit être relu avant Marquer comme vérifié. Enregistrez toujours les modifications avant publication.",
    links: [{ label: "Contenus du site", to: "/admin/contenus" }, { label: "Voir À la une", to: "/?view=news" }],
  },
  {
    id: "calendrier", group: "publications", title: "Ajouter une date au calendrier",
    summary: "Relier les rendez-vous aux articles, sans recopier les informations.",
    access: "Rédacteurs et personnes autorisées à publier le contenu.",
    prerequisite: "Un article avec une date confirmée ; l’heure peut rester inconnue.",
    steps: [
      "Ouvrez l’article dans Contenus du site et sa rubrique de dates du calendrier.",
      "Ajoutez le titre du rendez-vous, la date ou la période et le lieu. Complétez les heures seulement si elles sont confirmées.",
      "Enregistrez et publiez la version de l’article contenant ces dates.",
      "Ouvrez le calendrier public et vérifiez le jour, le lien vers l’article et le téléchargement dans un agenda.",
    ],
    result: "Les dates des articles publics apparaissent dans le calendrier. Les dates réservées à un public identifié restent dans les informations personnelles.",
    check: "Un fichier de calendrier téléchargé est une copie à importer, pas un abonnement automatique. Les brouillons, contenus retirés et informations privées n’apparaissent pas dans le calendrier public.",
    links: [{ label: "Modifier un article", to: "/admin/contenus" }, { label: "Voir le calendrier", to: "/?view=calendar" }],
  },
  {
    id: "documents", group: "publications", title: "Mettre un document à disposition",
    summary: "Joindre un formulaire ou une information durable au bon contenu.",
    access: "Gestionnaires des contenus, selon leurs droits de publication.",
    prerequisite: "Un fichier à jour, son titre et le choix de son public.",
    steps: [
      "Dans Contenus du site, ouvrez le contenu à compléter ou créez-en un. Les onglets Documents et Modèles permettent de retrouver les ressources existantes.",
      "Dans Fichiers et images, choisissez un fichier, donnez-lui un titre et utilisez Ajouter au contenu. Pour une image, renseignez aussi sa description.",
      "Attendez le contrôle du fichier. Vous pouvez aussi sélectionner un fichier déjà contrôlé.",
      "Vérifiez le public, l’aperçu et le libellé du document ; enregistrez puis publiez la version.",
      "Ouvrez le document depuis le parcours du destinataire pour vérifier son accès et sa version.",
    ],
    result: "Le document validé accompagne l’article ou la page pour les personnes autorisées.",
    check: "Un fichier en attente, bloqué ou sans contrôle confirmé doit être vérifié dans Contrôle des fichiers. Publier un formulaire à télécharger ne crée pas un générateur de certificat personnalisé.",
    links: [{ label: "Gérer les documents du site", to: "/admin/contenus" }],
  },
  {
    id: "hebdo", group: "publications", title: "Préparer l’hebdo de la semaine",
    summary: "Transformer le PDF de la direction en brouillons clairs et datés.",
    access: "Rédacteurs autorisés, avec validation humaine avant diffusion.",
    prerequisite: "Le PDF officiel de la semaine et les informations confirmées par la direction.",
    steps: [
      "Ouvrez Préparer l’hebdo et Choisir le PDF de la semaine, puis Préparer avec l’IA.",
      "Relisez chaque carte : texte, dates, lieu, public et points à vérifier. Retirez les éléments internes qui ne doivent pas devenir publics.",
      "Sélectionnez les informations utiles et au maximum trois actualités à la une. Contrôlez l’aperçu et les dates d’expiration.",
      "Enregistrez les brouillons sélectionnés. Retrouvez-les dans Contenus du site pour les valider et les publier.",
      "Si vous avez demandé des propositions de notification, traitez-les séparément dans Valider les flashs.",
    ],
    result: "L’atelier prépare des brouillons ; il ne publie pas et n’envoie pas de messages depuis cet écran.",
    check: "Le suivi Gmail préparé dans Codex dépend de cet environnement et de son accès à la boîte. Ce n’est pas un connecteur serveur permanent du portail. Si aucun brouillon n’arrive, utilisez l’import PDF manuel.",
    links: [{ label: "Préparer l’hebdo", to: "/admin/hebdo" }, { label: "Relire les brouillons", to: "/admin/contenus" }],
  },
  {
    id: "ciblage", group: "publications", title: "Réserver une information à un public",
    summary: "Choisir les élèves, les parents ou les personnels concernés.",
    access: "Gestionnaires autorisés des contenus.",
    prerequisite: "Un annuaire actif, les classes et des liens parent-enfant valides.",
    steps: [
      "Dans l’article, ouvrez Qui peut lire cette information ? et choisissez les profils concernés.",
      "Sélectionnez les classes lorsque l’information concerne seulement certains élèves ou parents.",
      "Relisez le public choisi, le texte, les dates et les fichiers. Enregistrez puis publiez.",
      "Vérifiez le résultat dans le parcours d’une personne autorisée et l’absence de l’article sur le site public.",
    ],
    result: "La publication apparaît dans les informations personnelles des destinataires autorisés, avec ses dates et documents.",
    check: "Le ciblage de lecture et l’envoi d’une alerte sont deux actions distinctes. L’IA ne doit pas deviner une classe ou un lien familial ; corrigez d’abord la source de l’annuaire.",
    links: [{ label: "Choisir le public d’un contenu", to: "/admin/contenus" }],
  },
  {
    id: "flash", group: "diffusion", title: "Publier une information flash",
    summary: "Diffuser une information courte avec un public, une importance et une expiration.",
    access: "Proposition selon le rôle ; validation et publication selon les habilitations du service.",
    prerequisite: "Un message confirmé, des destinataires précis et une date de fin.",
    steps: [
      "Ouvrez Information flash. Renseignez le titre, le message et les groupes ou classes concernés.",
      "Choisissez l’importance : Normale affiche l’information sans alerte ; Importante prévoit une alerte push. Le niveau Urgente prévoit aussi l’email et ne remplace jamais un appel d’urgence.",
      "Renseignez l’expiration obligatoire. Vérifiez les canaux réellement disponibles avant de soumettre la proposition.",
      "Dans Valider les flashs, une personne habilitée relit et valide la proposition.",
      "Dans Validées, en attente de publication, utilisez Publier. Pour une correction, choisissez explicitement si une nouvelle alerte est nécessaire.",
    ],
    result: "Le flash publié devient visible au public choisi. Le push concerne les appareils abonnés et éligibles.",
    availability: { label: "Canaux à vérifier", detail: "Le push est raccordé. La diffusion email/SMS des flashs dépend de l’ouverture et de la configuration du module de communication ; elle ne doit pas être supposée active." },
    check: "Valider ne publie pas encore. Contrôlez aussi l’expiration, l’audience et l’abonnement du téléphone. Une correction sans choix d’alerte ne renvoie pas de push.",
    links: [{ label: "Proposer un flash", to: "/admin/informations-flash/proposer" }, { label: "Valider et publier", to: "/admin/informations-flash/valider" }],
  },
  {
    id: "distribution-pc", group: "diffusion", title: "Annoncer la distribution des ordinateurs",
    summary: "Le parcours complet : article durable, calendrier et alerte aux secondes.",
    access: "Rédacteur et personne habilitée à publier le flash.",
    prerequisite: "Le planning confirmé par l’établissement et les classes concernées.",
    steps: [
      "Créez ou actualisez l’article de distribution dans Contenus du site. Pour la vague de septembre 2026 : les 14 et 15 septembre, salle polyvalente, selon le planning communiqué aux professeurs.",
      "Ajoutez les deux dates au calendrier de l’article. Liez le guide Chromebook pour les informations utiles toute l’année. N’inventez pas de créneau individuel.",
      "Enregistrez, publiez et vérifiez l’article sur téléphone.",
      "Préparez un flash court renvoyant à cet article. Choisissez les élèves de seconde et, si utile, leurs parents dans les classes de l’annuaire, puis une expiration après la distribution.",
      "Choisissez Importante si une alerte push est souhaitée, faites valider puis publiez. Pour un email, vérifiez séparément le canal de communication et les destinataires avant tout envoi.",
    ],
    result: "Une seule information de référence, des rendez-vous visibles et une alerte ciblée, sans notifier inutilement tout le lycée.",
    check: "Un appareil sans abonnement ne recevra pas de push. Après la distribution, retirez l’annonce datée tout en conservant le guide annuel.",
    links: [{ label: "Préparer l’article", to: "/admin/contenus" }, { label: "Créer le flash", to: "/admin/informations-flash/proposer" }, { label: "Guide Chromebook", to: "/chromebook" }],
  },
  {
    id: "push-telephone", group: "diffusion", title: "Installer l’application et activer les notifications",
    summary: "Accompagner l’installation sur téléphone et vérifier les alertes.",
    access: "Chaque utilisateur décide pour son propre appareil.",
    prerequisite: "Un navigateur compatible, une connexion et l’accès à l’espace concerné.",
    steps: [
      "Ouvrez le site du lycée sur le téléphone. Sur iPhone ou iPad, utilisez Partager puis Sur l’écran d’accueil et ouvrez l’icône ajoutée. Sur Android, utilisez l’option d’installation proposée par le navigateur.",
      "Dans l’espace personnel, Mes demandes ou l’espace de traitement, retrouvez Notifications sur cet appareil.",
      "Si souhaité, cochez Recevoir aussi les informations flash importantes du lycée.",
      "Appuyez sur Activer les notifications et autorisez-les dans le navigateur. Attendez Préférences enregistrées sur cet appareil.",
      "Vérifiez la réception d’une alerte autorisée sur un téléphone réellement abonné. Le même panneau permet de modifier le choix ou de désactiver les notifications.",
    ],
    result: "Les alertes éligibles ouvrent les informations protégées après les contrôles d’accès nécessaires. L’écran verrouillé reçoit un message générique.",
    availability: { label: "Réception à tester", detail: "La chaîne push a été vérifiée avec des appareils simulés. La réception physique doit être confirmée sur le téléphone abonné." },
    check: "Vérifiez les autorisations du téléphone, le mode Concentration et l’abonnement. Installer l’application seul ne donne pas l’autorisation d’envoyer des notifications.",
    links: [{ label: "Ouvrir le site sur cet appareil", to: "/" }, { label: "Notifications de l’équipe", to: "/gestion/demandes" }],
  },
  {
    id: "communications", group: "diffusion", title: "Préparer une communication et suivre les envois",
    summary: "Relire un message, ses destinataires et les résultats de diffusion.",
    access: "Rédacteurs et validateurs habilités ; canaux selon la configuration du module.",
    prerequisite: "Un canal ouvert et un public autorisé. Préparer un brouillon n’active pas la diffusion.",
    steps: [
      "Dans Communications, créez une Nouvelle communication ou partez d’un modèle.",
      "Complétez le titre, le résumé et le message. L’aide à la rédaction propose des améliorations à relire ; vérifiez les points à confirmer.",
      "Contrôlez les aperçus Page et Email et la visibilité. Enregistrez le brouillon puis demandez sa validation.",
      "Après validation, utilisez seulement les actions de publication ou d’envoi effectivement ouvertes. Vérifiez les destinataires, le canal et le contenu avant confirmation.",
      "Consultez Réponses reçues et Envois à reprendre. Avant une relance, vérifiez le statut du premier envoi pour éviter les doublons.",
    ],
    result: "Les versions et les validations sont conservées ; les résultats de diffusion doivent être contrôlés séparément.",
    availability: { label: "Selon configuration", detail: "L’ouverture du module, les prestataires et les circuits d’envoi sont distincts de l’éditeur. Un bouton fermé ne prouve pas qu’un message a été envoyé." },
    check: "Pour une réponse individuelle à une famille, utilisez son dossier de demande. Le webmail est une application liée, avec sa propre connexion.",
    links: [{ label: "Ouvrir Communications", to: "/admin/communications" }, { label: "Webmail du lycée", to: "https://mail.lycee-blaise-cendrars-sevran.fr/" }],
  },
  {
    id: "nominatifs", group: "diffusion", title: "Comprendre les envois nominatifs",
    summary: "Tester la préparation d’un message contenant la seule information du destinataire.",
    access: "Gestionnaires autorisés au parcours d’essai.",
    prerequisite: "Utiliser le jeu d’essai fictif proposé par l’écran.",
    steps: [
      "Ouvrez Envois nominatifs et lisez l’indication Mode simulation.",
      "Suivez Importer, puis Confirmer les colonnes et le type d’information.",
      "Relisez le Bilan du rapprochement : les cas ambigus ou exclus ne doivent pas être forcés.",
      "Contrôlez le Message par destinataire et terminez le Lot validé (simulation).",
    ],
    result: "Un aperçu de lot est figé pour l’essai ; aucun message ne part.",
    availability: { label: "Simulation uniquement", detail: "Ce parcours utilise des bénéficiaires fictifs. Il n’est pas encore un outil d’envoi réel des codes du lycée." },
    check: "Ne le présentez pas comme une distribution opérationnelle des codes ENT, KOXO ou cantine. L’ouverture réelle demande un raccordement et une recette spécifiques.",
    links: [{ label: "Voir le parcours de simulation", to: "/admin/envois-nominatifs" }],
  },
  {
    id: "annuaire", group: "donnees", title: "Importer et vérifier l’annuaire",
    summary: "Mettre à jour les identités et les liens familiaux depuis un export officiel.",
    access: "Superadmin et direction habilitée.",
    prerequisite: "Un CSV ou Excel conforme au modèle et, pour un export officiel, rapport_verification.txt.",
    steps: [
      "Ouvrez Annuaire du lycée, puis Mettre à jour l’annuaire. Les modèles se trouvent dans Modèles et fichiers de test. Les exports bruts ENT et le ZIP SIECLE doivent d’abord être rapprochés et préparés au format attendu.",
      "Choisissez l’annuaire préparé en CSV ou Excel .xlsx, ajoutez le rapport de vérification demandé et renseignez le nom de version, l’origine et l’usage autorisé.",
      "Utilisez Déposer dans l’espace privé. Examinez le bilan et les anomalies de la version reçue.",
      "Faites corriger les correspondances ambiguës dans l’export source, puis suivez les contrôles, l’approbation et l’activation proposés pour cette version.",
      "Revenez à Rechercher une personne pour contrôler une identité. Compléter les fiches donne accès aux imports d’attributs complémentaires. Conservez les contacts officiels et les identifiants exacts, y compris leurs chiffres éventuels.",
    ],
    result: "Seule la version active sert au rapprochement d’identité. L’annuaire reste séparé des connaissances générales envoyées à l’IA.",
    check: "Aucun mot de passe ni code d’activation dans ce fichier. Un dépôt réussi n’est pas une activation. N’ajoutez pas automatiquement un domaine email à un identifiant non vérifié.",
    links: [{ label: "Ouvrir l’annuaire", to: "/admin/repertoire-identites" }],
  },
  {
    id: "emplois-du-temps", group: "donnees", title: "Importer et activer les emplois du temps",
    summary: "Passer d’un fichier reçu à une version utilisable par le bon profil.",
    access: "Superadmin et direction habilitée, avec les validations exigées.",
    prerequisite: "Un export officiel à jour et des correspondances fiables avec l’annuaire.",
    steps: [
      "Dans Emplois du temps, choisissez PDF officiel, calendriers iCal (.ics) ou export CSV/Excel. Séparez les périmètres classes et professeurs.",
      "Renseignez l’année scolaire, la date d’effet, la date de recontrôle et l’usage autorisé, puis Déposer la nouvelle version.",
      "Utilisez Vérifier les correspondances, puis le filtre À vérifier et la recherche. Les calendriers déjà rattachés restent consultables dans Déjà traités. Reliez les éléments incertains à la bonne référence de l’annuaire, sans déduire un identifiant du seul nom.",
      "Sélectionner les correspondances exactes et Préparer l’exclusion des calendriers vides préparent uniquement des choix, pour toute la version. Relisez le nombre de rattachements et d’exclusions, modifiez-les si nécessaire puis validez. Aucun de ces choix n’active une version.",
      "Contrôlez le bilan, les créneaux, les dates et les correspondances. Suivez Approuver puis Activer avec les vérifications humaines demandées.",
      "Testez une demande d’emploi du temps dans le chat avec une identité autorisée. Vérifiez le jour, la salle et le document ou les créneaux disponibles.",
    ],
    result: "Une version active et non périmée peut être utilisée selon son format et le profil autorisé. Un PDF source et un iCal n’offrent pas nécessairement la même présentation.",
    availability: { label: "Activation à contrôler", detail: "Le chantier comporte des correspondances et des versions à valider. La présence de fichiers importés ne signifie pas que tous les emplois du temps sont disponibles dans le chat." },
    check: "Après la date de recontrôle, la source doit être remise à jour. Un import iCal manuel ne met pas en place une synchronisation permanente avec PRONOTE.",
    links: [{ label: "Gérer les emplois du temps", to: "/admin/emplois-du-temps" }],
  },
  {
    id: "connaissances", group: "donnees", title: "Alimenter les connaissances de l’IA",
    summary: "Donner à l’agent des sources validées, révisables et traçables.",
    access: "Superadmin et direction habilitée au registre.",
    prerequisite: "Une source officielle, son usage autorisé, sa confidentialité et ses dates de validité.",
    steps: [
      "Dans Connaissances de l’IA, utilisez Documents pour déposer une ressource ou Sources de référence pour enregistrer une source.",
      "Décrivez ce que l’agent doit comprendre, le public, les règles et ce qu’il ne doit pas déduire. Contrôlez la classification et les dates.",
      "Attendez les contrôles du document et renseignez la validation humaine. Pour une référence, vérifiez la version et son empreinte avant Valider la source.",
      "Si une compétence est nécessaire, créez son brouillon, ses instructions et ses liens vers les sources publiées. Envoyez-la en validation.",
      "Exécutez et enregistrez les scénarios requis par le registre avant publication. Utilisez l’historique et les actions de retrait ou de révocation si une source devient incorrecte.",
    ],
    result: "Une source ou compétence n’est exploitable qu’après les contrôles et la publication prévus. Retirer une source peut désactiver les compétences qui en dépendent.",
    check: "Les conversations des familles ne modifient pas les règles. Le registre exige des tests réellement exécutés ; il ne suffit pas d’affirmer que tout fonctionne. Annuaire et codes secrets ont leurs circuits séparés.",
    links: [{ label: "Ouvrir le registre", to: "/admin/connaissances-agent" }],
  },
  {
    id: "coffre-codes", group: "donnees", title: "Préparer les codes ENT, KOXO et cantine",
    summary: "Comprendre les conditions d’une remise personnelle et sécurisée.",
    access: "Services habilités et destinataire dont l’identité est vérifiée.",
    prerequisite: "Des valeurs préparées dans le circuit de coffre privé, liées à des identifiants exacts et autorisées à la remise.",
    steps: [
      "Préparez les exports de codes dans le circuit sécurisé prévu avec le référent ; ne les déposez ni dans un article, ni dans l’hebdo, ni dans le registre général de l’IA.",
      "Vérifiez le type de service et la correspondance avec la personne. L’identifiant ENT réel peut contenir des chiffres : ne le reconstruisez pas à partir du nom.",
      "Faites vérifier le raccordement du coffre, les affectations et l’ouverture du service avant d’annoncer une remise automatique.",
      "Testez la remise avec une identité autorisée et le parcours prévu. Pour un ENT déjà actif, utilisez la procédure de réinitialisation ; un code d’activation n’est pas un nouveau mot de passe.",
    ],
    result: "La remise dépend du coffre, de la preuve d’identité et des règles du service. En cas d’échec, une demande est transmise au service compétent.",
    availability: { label: "Raccordement à valider", detail: "Des parcours et protections existent, mais le manuel ne confirme pas l’import ni l’ouverture de tous les codes réels. Il n’existe pas ici de bouton universel pour verser tous les secrets." },
    check: "Les écrans Codes élèves et Codes professeurs de l’espace stages concernent les accès LyceeGest ; ils ne sont pas le coffre ENT/KOXO.",
    links: [{ label: "Vérifier une identité", to: "/admin/repertoire-identites" }, { label: "Traiter une demande d’accès", to: "/gestion/demandes" }],
  },
  {
    id: "equipe", group: "pilotage", title: "Préparer l’accès d’un collègue",
    summary: "Répartir le travail entre administration, intendance, vie scolaire et autres services.",
    access: "Superadmin et direction habilitée pour consulter les accès des services.",
    prerequisite: "Le nom du collègue, son email professionnel et les services explicitement autorisés.",
    steps: [
      "Ouvrez Équipes et services pour voir les services et le nombre de comptes habilités.",
      "Définissez le rôle du collègue et son périmètre. Un intitulé de poste ou un domaine email ne donne pas automatiquement des droits.",
      "Faites créer ou affecter son compte individuel dans la gestion sécurisée des accès. Cette page est une vue des services, pas un formulaire de création de compte.",
      "Invitez le collègue à se connecter à la gestion, à ouvrir les demandes de son service et à tester une prise en charge.",
      "Accompagnez l’activation des notifications sur son appareil. Vérifiez qu’il ne voit que les dossiers et actions autorisés.",
    ],
    result: "Chaque collègue utilise son propre compte et partage l’historique des dossiers de son service.",
    check: "Le mode de connexion temporaire pendant les essais, s’il est actif, affiche une date de fin. Il ne faut pas supposer que la double authentification est désactivée pour tous les comptes.",
    links: [{ label: "Voir les équipes et services", to: "/admin/services" }, { label: "Sécurité du compte", to: "/security" }],
  },
  {
    id: "supervision", group: "pilotage", title: "Vérifier le fonctionnement du portail",
    summary: "Repérer un envoi bloqué, un incident de fichier ou un relais humain en attente.",
    access: "Superadmin et direction habilitée à la supervision.",
    prerequisite: "Une référence de dossier ou une anomalie précise à examiner.",
    steps: [
      "Ouvrez Suivi du fonctionnement et actualisez les indicateurs affichés.",
      "Repérez les erreurs ou traitements en attente, puis ouvrez le dossier concerné pour vérifier son dernier état.",
      "Pour une pièce jointe ou une ressource éditoriale, consultez aussi Contrôle des fichiers dans Contenus du site.",
      "Notez l’heure, la référence de demande et l’action concernée pour faire corriger l’incident. Vérifiez la confirmation du premier traitement avant de le relancer.",
    ],
    result: "Un diagnostic fondé sur l’état des traitements, plutôt qu’une nouvelle soumission qui risquerait de créer un doublon.",
    check: "Un contrôle indisponible n’est pas un contrôle réussi. Les anciens fichiers repris demandent une vérification réelle ; leur présence dans la bibliothèque n’est pas une preuve de rescan.",
    links: [{ label: "Suivi du fonctionnement", to: "/admin/sante-demandes" }, { label: "Contrôle des fichiers", to: "/admin/contenus" }],
  },
  {
    id: "budget-ia", group: "pilotage", title: "Suivre les coûts et le budget IA",
    summary: "Lire les estimations et comprendre le plafond des appels payants.",
    access: "Superadmin uniquement, avec les contrôles d’accès administratifs du serveur.",
    prerequisite: "Un suivi des usages et une tarification configurés côté serveur.",
    steps: [
      "Ouvrez Coûts et budget IA puis Actualiser.",
      "Contrôlez l’état du plafond, le coût estimé aujourd’hui et l’estimation sur 30 jours.",
      "Lisez l’enveloppe engagée : elle comprend aussi les appels en cours ou dont la consommation n’est pas confirmée.",
      "Consultez la répartition entre conversations, articles et hebdos, communications et traductions.",
      "Pour changer le plafond ou le fournisseur, faites modifier la configuration serveur puis vérifiez de nouveau l’écran. Cette page ne permet pas d’acheter des crédits.",
    ],
    result: "Le contrôle limite les appels payants selon l’enveloppe configurée. Les réponses locales et le dépôt de demandes restent disponibles lorsque le plafond est atteint.",
    check: "Les montants sont des estimations, pas une facture. Ils excluent notamment SMS, emails et hébergement. Le plafond quotidien suit l’heure de Paris.",
    links: [{ label: "Ouvrir le budget IA", to: "/gestion/budget-ia" }],
  },
  {
    id: "stages", group: "scolarite", title: "Suivre les stages de seconde",
    summary: "Retrouver les élèves, leurs dossiers et les documents de stage.",
    access: "Selon les rôles et affectations de l’espace stages.",
    prerequisite: "Des élèves importés et les affectations pédagogiques à jour.",
    steps: [
      "Ouvrez Stages et utilisez les filtres pour retrouver la classe ou l’élève concerné.",
      "Ouvrez le dossier de l’élève et vérifiez les informations de son stage et les documents disponibles.",
      "Attribuez le professeur de suivi lorsque votre rôle le permet et complétez les étapes du dossier.",
      "Utilisez Exporter CSV si un bilan est nécessaire ; conservez cet export dans un emplacement professionnel adapté.",
    ],
    result: "Le suivi pédagogique reste dans l’espace stages, distinct du traitement des demandes du portail.",
    check: "Les droits dépendent aussi des affectations. Une importation de l’annuaire du portail ne remplace pas automatiquement l’import des données de stages.",
    links: [{ label: "Ouvrir les stages", to: "/stages" }],
  },
  {
    id: "grand-oral", group: "scolarite", title: "Suivre le Grand Oral",
    summary: "Consulter les fiches et l’avancement dans l’espace dédié.",
    access: "Selon les rôles et périmètres autorisés pour le Grand Oral.",
    prerequisite: "Des fiches et des élèves accessibles au compte connecté.",
    steps: [
      "Ouvrez Grand Oral et retrouvez la classe ou la fiche concernée avec les filtres proposés.",
      "Consultez les informations de préparation et complétez les actions ouvertes à votre rôle.",
      "Vérifiez l’avancement dans le tableau de bord. Utilisez Exporter CSV pour un bilan autorisé.",
    ],
    result: "Le suivi du Grand Oral reste accessible dans son espace pédagogique.",
    check: "La présence de l’outil ne confirme pas que toutes les fiches de l’année sont renseignées. Vérifiez la population et les affectations avant de produire un bilan.",
    links: [{ label: "Ouvrir le Grand Oral", to: "/grand-oral" }],
  },
  {
    id: "imports-stages", group: "scolarite", title: "Importer et affecter les données de stages",
    summary: "Préparer les élèves, professeurs et responsabilités pédagogiques.",
    access: "Administration autorisée dans l’espace stages.",
    prerequisite: "Un fichier conforme à l’import choisi, distinct de l’annuaire d’identité du portail.",
    steps: [
      "Dans Import CSV / Excel, choisissez le type de données puis le fichier à analyser.",
      "Associez les colonnes aux champs demandés et relisez le bilan. Corrigez les lignes en erreur avant de confirmer l’import.",
      "Dans Affectations classes, vérifiez les relations entre classes et professeurs principaux.",
      "Dans Affectations élèves, vérifiez les professeurs chargés du suivi et enregistrez les changements autorisés.",
      "Revenez au tableau des stages pour contrôler le résultat sur les dossiers concernés.",
    ],
    result: "Les données et affectations alimentent le suivi des stages selon les droits existants.",
    check: "Ne mélangez pas cet import avec le coffre de codes ou les exports ENT bruts. Une correspondance ambiguë demande une vérification, pas un rapprochement au hasard.",
    links: [{ label: "Import stages", to: "/admin/import" }, { label: "Affectations classes", to: "/admin/affectations-classes" }, { label: "Affectations élèves", to: "/admin/affectations-eleves" }],
  },
  {
    id: "administration-stages", group: "scolarite", title: "Gérer les accès et documents de stages",
    summary: "Retrouver les codes LyceeGest, les documents par classe et les paramètres.",
    access: "Administration autorisée dans l’espace stages.",
    prerequisite: "Des comptes et classes correctement associés.",
    steps: [
      "Ouvrez Codes élèves ou Codes professeurs pour retrouver l’accès LyceeGest de la bonne personne. Vérifiez son identité avant une remise ou une impression.",
      "Ouvrez Documents PDF pour retrouver les documents proposés par classe et vérifier leur contenu avant diffusion.",
      "Dans Paramètres, contrôlez les informations de l’établissement, du chef d’établissement et les dates importantes utilisées par ces outils.",
      "Enregistrez une modification autorisée puis vérifiez un document concerné pour contrôler le résultat.",
    ],
    result: "Les accès et les documents correspondent aux données de l’espace stages.",
    check: "Ces paramètres ne constituent pas un éditeur universel de tout le site. Les codes LyceeGest ne doivent pas être confondus avec les mots de passe ENT ou les sessions KOXO.",
    links: [{ label: "Codes élèves", to: "/admin/codes-acces" }, { label: "Codes professeurs", to: "/admin/codes-profs" }, { label: "Documents PDF", to: "/admin/documents-classes" }, { label: "Paramètres", to: "/admin/parametres" }],
  },
  {
    id: "services-lies", group: "quotidien", title: "Retrouver les services et guides liés",
    summary: "Orienter vers le guide Chromebook, le webmail et les services extérieurs.",
    access: "Public pour les guides publiés ; connexion propre à chaque service pour les données privées.",
    prerequisite: "Des liens officiels confirmés et à jour.",
    steps: [
      "Dans Mes services, utilisez les accès correspondant au besoin. Pour les ordinateurs, le guide Chromebook regroupe l’information annuelle.",
      "Le webmail ouvre l’application de messagerie du lycée avec sa propre authentification.",
      "Les signalements SafeScol doivent être orientés vers l’application dédiée lorsque son lien est confirmé ; ils ne sont pas collectés par le chat du lycée.",
      "La radio ESSUF utilise son lecteur officiel et la playlist déjà retenue. La lecture dépend des possibilités de la plateforme et du choix du visiteur.",
    ],
    result: "Le portail oriente vers le bon outil sans attribuer de droits sur une application extérieure.",
    check: "Un lien extérieur ne constitue ni une synchronisation ni une preuve d’accès. Ne promettez pas la lecture musicale intégrale sans les conditions du fournisseur, ni un service dont l’adresse reste à confirmer.",
    links: [{ label: "Mes services", to: "/?view=services" }, { label: "Guide Chromebook", to: "/chromebook" }, { label: "Webmail", to: "https://mail.lycee-blaise-cendrars-sevran.fr/" }],
  },
];

export const MANUAL_SHORTCUTS = [
  { id: "repondre-demande", label: "Répondre à une famille", hint: "Du dossier à la réponse" },
  { id: "distribution-pc", label: "Annoncer la distribution des PC", hint: "Article, calendrier et notification" },
  { id: "hebdo", label: "Publier les informations de la semaine", hint: "Du PDF aux actualités" },
] as const;

export function normalizeManualSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[’']/g, " ").trim();
}

export function searchManual(query: string, group: string): ManualArticle[] {
  const terms = normalizeManualSearch(query).split(/\s+/).filter(Boolean);
  return MANUAL_ARTICLES.filter(article => {
    if (group && article.group !== group) return false;
    const text = normalizeManualSearch([article.title, article.summary, article.access, article.prerequisite, ...article.steps, article.result, article.check, article.availability?.detail ?? "", ...article.links.map(link => link.label)].join(" "));
    return terms.every(term => text.includes(term));
  });
}
