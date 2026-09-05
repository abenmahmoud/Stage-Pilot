export const COMMUNICATIONS_UI_ENABLED =
  import.meta.env.VITE_COMMUNICATIONS_ENABLED === "true";

export const COMMUNICATION_DOCUMENTS_UI_ENABLED =
  COMMUNICATIONS_UI_ENABLED
  && import.meta.env.VITE_COMMUNICATION_DOCUMENTS_ENABLED === "true";

export const COMMUNICATION_PUBLICATION_UI_ENABLED =
  COMMUNICATIONS_UI_ENABLED
  && import.meta.env.VITE_COMMUNICATION_PUBLICATION_ENABLED === "true";

export const LEGACY_EDITORIAL_CORRECTIONS_UI_ENABLED =
  import.meta.env.VITE_LEGACY_EDITORIAL_CORRECTIONS_ENABLED === "true";

// Parcours d'envois nominatifs (cantine). Ferme par defaut : la page reste
// atteignable par son adresse pour la relecture, mais elle n'apparait dans la
// navigation que lorsque l'administration ouvre ce drapeau.
export const NOMINATIVE_SEND_UI_ENABLED =
  import.meta.env.VITE_NOMINATIVE_SEND_UI_ENABLED === "true";

// Ecran de proposition d'information flash (§13). Ferme par defaut, meme
// motif que NOMINATIVE_SEND_UI_ENABLED : la page reste atteignable par son
// adresse pour la relecture, mais n'apparait dans la navigation que lorsque
// l'administration ouvre ce drapeau. Aucune ecriture serveur derriere cet
// ecran de toute facon : il ne fait que preparer un apercu local.
export const FLASH_INFO_UI_ENABLED =
  import.meta.env.VITE_FLASH_INFO_UI_ENABLED === "true";
