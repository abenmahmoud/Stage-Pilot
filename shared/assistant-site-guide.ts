export type SiteAssistantAction = {
  label: string;
  description: string;
  href: string;
};

type SiteDestination = SiteAssistantAction & {
  id: string;
  keywords: readonly string[];
};

const DESTINATIONS: readonly SiteDestination[] = [
  {
    id: "news",
    label: "Voir les informations à la une",
    description: "Actualités, annonces et informations publiées par le lycée",
    href: "/?view=news",
    keywords: ["a la une", "actualite", "actualites", "hebdo", "information de la semaine", "informations de la semaine"],
  },
  {
    id: "calendar",
    label: "Ouvrir le calendrier du lycée",
    description: "Dates et événements publiés par le lycée",
    href: "/?view=calendar",
    keywords: ["calendrier", "agenda", "dates importantes", "evenements du lycee"],
  },
  {
    id: "requests",
    label: "Retrouver mes demandes",
    description: "Réponses, documents et état d’avancement au même endroit",
    href: "/?view=requests",
    keywords: ["mes demandes", "suivre ma demande", "suivre mon dossier", "retrouver ma demande", "numero de demande", "reponse a ma demande"],
  },
  {
    id: "services",
    label: "Voir les services du lycée",
    description: "ENT, webmail, outils scolaires et services utiles",
    href: "/?view=services",
    keywords: ["mes services", "services du lycee", "services numeriques", "liens utiles", "outils du lycee"],
  },
  {
    id: "school",
    label: "Découvrir le lycée",
    description: "Formations, spécialités, vie du lycée et informations pratiques",
    href: "/?view=school",
    keywords: ["vie du lycee", "formations du lycee", "specialites du lycee", "decouvrir le lycee", "presentation du lycee"],
  },
  {
    id: "contact",
    label: "Voir le contact et l’accès",
    description: "Adresse, téléphone et informations pratiques du lycée",
    href: "/?view=school#infos-pratiques",
    keywords: ["contact et acces", "contacter le lycee", "adresse du lycee", "telephone du lycee", "venir au lycee", "itineraire"],
  },
  {
    id: "help",
    label: "Demander de l’aide",
    description: "Expliquez le besoin dans le chat et suivez le traitement",
    href: "/?view=help",
    keywords: ["aide et demandes", "demander de l aide", "faire une demande", "contacter un service", "prendre rendez vous"],
  },
  {
    id: "chromebook",
    label: "Ouvrir le guide Chromebook",
    description: "Remise, première connexion, utilisation et dépannage",
    href: "/chromebook",
    keywords: ["guide chromebook", "page chromebook", "ordinateur region", "monordi idf", "remise ordinateur", "distribution ordinateur"],
  },
  {
    id: "device-sav",
    label: "Trouver le bon SAV numérique",
    description: "Démarche adaptée aux Chromebook ASUS et aux anciens PC UNOWHY",
    href: "/assistance-numerique",
    keywords: ["sav numerique", "reparer chromebook", "reparer ordinateur region", "ordinateur unowhy", "pc unowhy", "chromebook en panne"],
  },
  {
    id: "equipment",
    label: "Ouvrir l’espace matériel",
    description: "Signaler un équipement du lycée et suivre l’intervention",
    href: "/materiel",
    keywords: ["espace materiel", "signaler materiel", "materiel de salle", "intervention spie", "passage spie", "equipement du lycee"],
  },
  {
    id: "webmail",
    label: "Ouvrir le webmail du lycée",
    description: "Messagerie professionnelle du lycée Blaise Cendrars",
    href: "https://mail.lycee-blaise-cendrars-sevran.fr/",
    keywords: ["webmail du lycee", "ouvrir webmail", "messagerie du lycee", "mail du lycee"],
  },
  {
    id: "privacy",
    label: "Consulter la confidentialité",
    description: "Protection des données, identité et sécurité du portail",
    href: "/?view=trust",
    keywords: ["confidentialite", "protection des donnees", "donnees personnelles", "securite du site"],
  },
];

const ACTION_HREFS = new Set(DESTINATIONS.map((destination) => destination.href));

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[’']/g, " ").replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ").trim();
}

function latestRequesterText(messages: readonly { role: string; content: string }[]): string {
  return normalize(messages.findLast((message) => message.role === "requester")?.content ?? "");
}

function directlyAsksForDestination(text: string): boolean {
  return /\b(ou (?:est|sont|trouver)|comment (?:aller|acceder|ouvrir|retrouver|voir)|je (?:veux|voudrais|souhaite) (?:aller|acceder|ouvrir|retrouver|voir|consulter)|ouvre[rz]?|affiche[rz]?|montre[rz]?|acceder|acces a|lien (?:du|de|vers)|page (?:du|de)|aller (?:au|a la|sur)|voir (?:le|la|les|mes))\b/.test(text);
}

export function siteNavigationAnswer(
  messages: readonly { role: string; content: string }[]
): { reply: string; action: SiteAssistantAction } | null {
  const text = latestRequesterText(messages);
  if (!text) return null;

  const installQuestion = /\b(installer|installation|ajouter)\b/.test(text)
    && /\b(application|appli|site|ecran d accueil|telephone|smartphone)\b/.test(text);
  if (installQuestion) {
    return {
      reply: "Sur votre téléphone, ouvrez le site puis utilisez le bouton « Installer » lorsqu’il apparaît. Sur iPhone ou iPad, ouvrez le menu Partager de Safari, choisissez « Sur l’écran d’accueil », puis « Ajouter ».",
      action: {
        label: "Revenir à l’accueil",
        description: "Le bouton Installer apparaît dans l’en-tête sur les appareils compatibles",
        href: "/",
      },
    };
  }

  const destination = DESTINATIONS.find((candidate) =>
    candidate.keywords.some((keyword) => text.includes(keyword))
  );
  if (!destination) return null;

  const alwaysActionable = ["requests", "equipment", "device-sav", "webmail"].includes(destination.id);
  if (!alwaysActionable && !directlyAsksForDestination(text)) return null;

  const intro = destination.id === "requests"
    ? "Vous pouvez reprendre une demande existante sans recommencer votre démarche."
    : destination.id === "equipment"
      ? "Les professeurs et personnels peuvent signaler un matériel du lycée, suivre le dossier et consulter les passages SPIE."
      : `Cette rubrique est disponible directement sur le portail du lycée.`;
  return {
    reply: intro,
    action: {
      label: destination.label,
      description: destination.description,
      href: destination.href,
    },
  };
}

export function isSiteAssistantAction(value: unknown): value is SiteAssistantAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  return Object.keys(action).length === 3
    && typeof action.label === "string" && action.label.trim().length >= 2 && action.label.length <= 80
    && typeof action.description === "string" && action.description.trim().length >= 2 && action.description.length <= 160
    && typeof action.href === "string" && ACTION_HREFS.has(action.href);
}

export const SITE_ASSISTANT_INSTRUCTIONS = `Carte officielle du portail du lycée :
- Actualités et hebdo publiés : /?view=news
- Calendrier public : /?view=calendar
- Services et liens utiles : /?view=services
- Chat d’aide et création d’une demande : /?view=help
- Suivi des demandes existantes : /?view=requests
- Formations, spécialités, vie du lycée et contact : /?view=school
- Confidentialité : /?view=trust
- Guide Chromebook : /chromebook
- SAV des ordinateurs Région : /assistance-numerique
- Signalement du matériel du lycée et passages SPIE : /materiel
- Webmail professionnel : https://mail.lycee-blaise-cendrars-sevran.fr/
Utilise uniquement ces adresses publiques. Ne donne jamais une adresse /admin, /gestion, /app ou /intervention-spie à un visiteur. Quand la bonne rubrique suffit, donne une réponse courte avec son lien. Le suivi d’un dossier existant doit conduire à « Mes demandes » et ne doit pas créer un doublon.`;
