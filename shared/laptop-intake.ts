export type LaptopIntakeMessage = {
  role: "assistant" | "requester";
  content: string;
};

export type LaptopIntakeResult = {
  reply: string;
  category: "ordinateur";
  urgency: "faible" | "normale" | "urgente";
  missingInformation: string[];
  suggestedDocuments: string[];
  readyToCreate: boolean;
  safetyNotice: string | null;
  action: "continue" | "offer_case" | "human_transfer";
  intent:
    | "danger_materiel"
    | "perte_vol"
    | "dommage"
    | "alimentation"
    | "reseau"
    | "logiciel"
    | "diagnostic";
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function requesterText(messages: LaptopIntakeMessage[]): string[] {
  return messages
    .filter((message) => message.role === "requester")
    .map((message) => normalizeText(message.content));
}

export function evaluateLaptopIntake(
  messages: LaptopIntakeMessage[],
  attachmentCount = 0
): LaptopIntakeResult | null {
  const turns = requesterText(messages);
  const text = turns.join("\n");
  const latest = turns.at(-1) ?? "";
  const concernsLaptop =
    /\b(pc|ordinateur|portable|tablette|chargeur|batterie|clavier|ecran|trackpad)\b/.test(text);
  if (!concernsLaptop) return null;

  if (
    /\b(batterie.{0,30}gonflee?|gonflee?|fumee?|etincelle|odeur de brule|brule|tres chaud|surchauffe|liquide coule|feu)\b/.test(
      text
    )
  ) {
    return {
      reply:
        "N’utilisez plus et ne rechargez plus l’appareil. Débranchez-le seulement si vous pouvez le faire sans danger, éloignez-vous et prévenez immédiatement un adulte du lycée ; je peux vous aider à préparer une demande urgente.",
      category: "ordinateur",
      urgency: "urgente",
      missingInformation: ["Lieu où se trouve l’appareil"],
      suggestedDocuments: ["Photo extérieure de l’appareil, uniquement si elle peut être prise sans danger"],
      readyToCreate: true,
      safetyNotice: "Un appareil qui chauffe anormalement, fume ou gonfle ne doit plus être utilisé ni rechargé.",
      action: "human_transfer",
      intent: "danger_materiel",
    };
  }

  if (/\b(perdu|perdue|vole|volee|vol|introuvable|oublie dans|oublie au)\b/.test(text)) {
    return {
      reply:
        "Je vais préparer un signalement pour que le lycée puisse agir rapidement. Indiquez simplement le dernier lieu et le moment où l’appareil a été vu, sans publier de mot de passe ni de numéro confidentiel.",
      category: "ordinateur",
      urgency: "urgente",
      missingInformation: ["Dernier lieu connu", "Moment approximatif de la perte ou du vol"],
      suggestedDocuments: [],
      readyToCreate: true,
      safetyNotice: "Ne publiez aucun mot de passe, code de session ou donnée personnelle enregistrée sur l’appareil.",
      action: "offer_case",
      intent: "perte_vol",
    };
  }

  if (
    /\b(casse|cassee|fissure|ecran noir|charniere|touche arrachee|chargeur casse|prise cassee|tombe|choc|mouille|liquide renverse)\b/.test(
      text
    )
  ) {
    return {
      reply:
        "N’ouvrez pas l’appareil et n’essayez pas de le réparer vous-même. La description est suffisante pour préparer une demande ; vous pouvez ajouter une photo extérieure qui ne montre ni mot de passe ni information personnelle.",
      category: "ordinateur",
      urgency: /\b(mouille|liquide renverse|prise cassee)\b/.test(text) ? "urgente" : "normale",
      missingInformation: ["Lieu où l’appareil peut être présenté au support"],
      suggestedDocuments: ["Photo extérieure du dommage"],
      readyToCreate: true,
      safetyNotice: null,
      action: "offer_case",
      intent: "dommage",
    };
  }

  if (/\b(ne demarre|ne s allume|plus de batterie|ne charge|charge plus|chargeur)\b/.test(text)) {
    const powerTurnCount = turns.filter((turn) =>
      /\b(ne demarre|ne s allume|plus de batterie|ne charge|charge plus|chargeur)\b/.test(turn)
    ).length;
    const lightAnswer = /\b(aucun voyant|pas de voyant|voyant eteint|non.*voyant)\b/.test(latest);
    const lightSeen = /\b(voyant allume|voyant s allume|oui.*voyant|lumiere s allume)\b/.test(latest);
    if (powerTurnCount === 1 && !lightAnswer && !lightSeen) {
      return {
        reply:
          "Quand vous branchez le chargeur remis avec l’ordinateur, est-ce qu’un voyant s’allume sur l’appareil ou sur le chargeur ?",
        category: "ordinateur",
        urgency: "normale",
        missingInformation: ["État du voyant de charge"],
        suggestedDocuments: [],
        readyToCreate: false,
        safetyNotice: null,
        action: "continue",
        intent: "alimentation",
      };
    }
    return {
      reply:
        "Merci, j’ajoute l’état du voyant au diagnostic. Je peux maintenant créer une demande pour que le support contrôle l’ordinateur et son chargeur sans vous faire recommencer les vérifications.",
      category: "ordinateur",
      urgency: "normale",
      missingInformation: [],
      suggestedDocuments: ["Photo extérieure du chargeur et de sa prise si un dommage est visible"],
      readyToCreate: true,
      safetyNotice: null,
      action: "offer_case",
      intent: "alimentation",
    };
  }

  if (/\b(wifi|wi-fi|internet|reseau|connexion)\b/.test(text)) {
    if (!/\b(au lycee|dans le lycee|a la maison|chez moi|domicile)\b/.test(text)) {
      return {
        reply: "Le problème de connexion se produit-il au lycée ou à la maison ?",
        category: "ordinateur",
        urgency: "normale",
        missingInformation: ["Lieu du problème de connexion"],
        suggestedDocuments: [],
        readyToCreate: false,
        safetyNotice: null,
        action: "continue",
        intent: "reseau",
      };
    }
    return {
      reply:
        "J’ai le contexte nécessaire. Indiquez le message affiché, sans envoyer de mot de passe, puis vous pourrez transmettre la demande au support avec la conversation déjà résumée.",
      category: "ordinateur",
      urgency: "normale",
      missingInformation: ["Message affiché à l’écran"],
      suggestedDocuments: ["Capture du message d’erreur après masquage des données personnelles"],
      readyToCreate: text.length >= 40 || attachmentCount > 0,
      safetyNotice: null,
      action: text.length >= 40 || attachmentCount > 0 ? "offer_case" : "continue",
      intent: "reseau",
    };
  }

  if (/\b(application|logiciel|mise a jour|windows|navigateur|impression|imprimante)\b/.test(text)) {
    return {
      reply:
        "Quel est le nom de l’application ou du logiciel qui bloque, et quel message est affiché ? Ne communiquez aucun mot de passe.",
      category: "ordinateur",
      urgency: "normale",
      missingInformation: ["Nom du logiciel", "Message affiché"],
      suggestedDocuments: ["Capture du message après masquage des données personnelles"],
      readyToCreate: text.length >= 55 || attachmentCount > 0,
      safetyNotice: null,
      action: text.length >= 55 || attachmentCount > 0 ? "offer_case" : "continue",
      intent: "logiciel",
    };
  }

  return {
    reply:
      "Quel est le problème principal avec l’ordinateur : il ne démarre pas, ne charge pas, est endommagé, ou rencontre un problème de connexion ou de logiciel ?",
    category: "ordinateur",
    urgency: "normale",
    missingInformation: ["Symptôme principal"],
    suggestedDocuments: [],
    readyToCreate: false,
    safetyNotice: null,
    action: "continue",
    intent: "diagnostic",
  };
}
