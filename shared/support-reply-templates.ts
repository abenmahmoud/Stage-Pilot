export type SupportReplyTemplate = {
  id: string;
  category: string;
  name: string;
  bodyText: string;
  allowedVariables: string[];
  builtIn?: boolean;
};

export const SUPPORT_TEMPLATE_VARIABLES = ["prenom", "numero", "objet"] as const;

export const DEFAULT_SUPPORT_REPLY_TEMPLATES: SupportReplyTemplate[] = [
  {
    id: "builtin:acknowledgement",
    category: "all",
    name: "Prise en charge",
    bodyText:
      "Bonjour {{prenom}}, votre demande {{numero}} concernant « {{objet}} » a bien été prise en charge. Nous revenons vers vous dès que la vérification est terminée.",
    allowedVariables: ["prenom", "numero", "objet"],
    builtIn: true,
  },
  {
    id: "builtin:details",
    category: "all",
    name: "Demande de précision",
    bodyText:
      "Bonjour {{prenom}}, nous avons besoin d’une précision pour poursuivre le traitement de la demande {{numero}}. Pouvez-vous répondre à ce message en indiquant ce qui s’affiche exactement, sans transmettre de mot de passe ni de code reçu par SMS ?",
    allowedVariables: ["prenom", "numero"],
    builtIn: true,
  },
  {
    id: "builtin:resolved",
    category: "all",
    name: "Solution apportée",
    bodyText:
      "Bonjour {{prenom}}, une solution a été apportée à votre demande {{numero}}. Merci de vérifier que tout fonctionne. Vous pouvez répondre à ce message si le problème persiste.",
    allowedVariables: ["prenom", "numero"],
    builtIn: true,
  },
];

export function supportTemplateVariables(bodyText: string): string[] {
  const matches = bodyText.matchAll(/\{\{([a-z_]+)\}\}/g);
  return [...new Set(Array.from(matches, (match) => match[1]))];
}

export function renderSupportReplyTemplate(
  bodyText: string,
  values: Record<(typeof SUPPORT_TEMPLATE_VARIABLES)[number], string>
): string {
  return bodyText.replace(/\{\{([a-z_]+)\}\}/g, (placeholder, variable: string) => {
    return variable in values
      ? values[variable as keyof typeof values]
      : placeholder;
  });
}
