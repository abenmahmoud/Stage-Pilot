import { resolveAssistantConversationTransition } from "./assistant-conversation-state.js";

export type AssistantPolicyMessage = {
  role: "assistant" | "requester";
  content: string;
};

export type AssistantScope =
  | "school_support"
  | "education_help"
  | "wellbeing"
  | "privacy_request"
  | "out_of_scope"
  | "unknown";

export type AssistantPolicyAction =
  | "continue"
  | "offer_case"
  | "human_transfer"
  | "stop";

export type AssistantPolicyCategory =
  | "inscription"
  | "affectation_classe"
  | "documents_scolarite"
  | "ent"
  | "email_academique"
  | "ordinateur"
  | "logiciel"
  | "restauration_bourse"
  | "orientation_formation"
  | "vie_scolaire"
  | "autre";

export type ConversationPolicy = {
  scope: AssistantScope;
  action: AssistantPolicyAction;
  turnCount: number;
  remainingTurns: number;
  limitReached: boolean;
  deterministicReply: string | null;
  category: AssistantPolicyCategory | null;
  urgency: "faible" | "normale" | "urgente" | null;
  readyToCreate: boolean | null;
  safetyNotice: string | null;
};

export function resolveAssistantAction(input: {
  policyAction: AssistantPolicyAction;
  readyToCreate: boolean;
  scope: AssistantScope;
}): AssistantPolicyAction {
  if (input.policyAction !== "continue") return input.policyAction;
  if (input.scope === "school_support" && input.readyToCreate) return "offer_case";
  return "continue";
}

export function resolveAssistantReadiness(input: {
  scope: AssistantScope;
  policyReadyToCreate: boolean | null;
  modelReadyToCreate: boolean;
  deterministicReadyToCreate: boolean;
}): boolean {
  if (input.policyReadyToCreate !== null) return input.policyReadyToCreate;
  if (input.scope === "school_support" && input.deterministicReadyToCreate) return true;
  return input.modelReadyToCreate;
}

const MAX_CONVERSATION_TURNS = 10;
const MAX_EDUCATION_TURNS = 3;
const MAX_OUT_OF_SCOPE_TURNS = 3;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isSafetyConfirmation(text: string): boolean {
  return /\b(je suis en securite|je ne suis pas en danger|aucun danger|ca va maintenant|tout va bien maintenant)\b/.test(
    text
  );
}

function isAlertStatusQuestion(text: string): boolean {
  return /\b(as[- ]?tu|avez[- ]?vous|tu as|vous avez|est[- ]?ce que tu as|est[- ]?ce que vous avez)\b.{0,45}\b(transmis une alerte|envoye une alerte|prevenu (?:les secours|la police|un adulte)|appele (?:le )?(?:15|17|18|112|les secours|la police)|fait un signalement)\b|\b(alerte|signalement)\b.{0,35}\b(envoyee?|transmise?|confirmee?)\b/.test(
    text
  );
}

function isThirdPartySchoolDataRequest(content: string): boolean {
  const text = normalizeText(content);
  const asksForSchoolData = /\b(emploi du temps|salle|classe|absence|retard|note|bulletin|resultat|sanction|dossier scolaire)\b/.test(
    text
  );
  const namesAnotherPerson = /\b(mon enfant|mon fils|ma fille|un autre eleve|une autre eleve|l[' ]eleve|d[' ]un eleve|d[' ]une eleve|ce professeur|cet enseignant|cette personne)\b/.test(
    text
  );
  return asksForSchoolData && namesAnotherPerson;
}

function explicitScope(content: string): AssistantScope {
  const text = normalizeText(content);

  if (
    /\b(je vais (tres )?mal|je (ne )?vais pas bien|je me sens (tres )?mal|je suis en danger|on me menace|mes parents? (sont )?(perdus?|introuvables?|disparus?)|je veux mourir|me tuer|suicide|suicidaire|me faire du mal|automutilation|je fais un malaise|j ai fait un malaise|je respire mal|j ai du mal a respirer|je saigne beaucoup|j ai pris trop de medicaments|surdose|overdose|intoxication)\b/.test(
      text
    )
  ) {
    return "wellbeing";
  }

  if (
    /\b(recuperer|extraire|telecharger|donner|voir|chercher)\b.{0,45}\b(donnees de l.application|base de donnees|liste des eleves|liste des professeurs|annuaire complet|coordonnees personnelles)\b/.test(
      text
    ) ||
    (/\b(numero|telephone|email|adresse|coordonnees)\b/.test(text) &&
      /\b(personnel|prive|fondateur|dirigeant|essuf|safescol|une personne|ses parents|mes parents)\b/.test(
        text
      ))
  ) {
    return "privacy_request";
  }

  if (
    /\b(cours|devoir|examen|controle|revision|resume|exercice|corrige|fraction|equation|mathematiques?|maths?|sciences?|physique|chimie|svt|francais|histoire|geographie|anglais|dissertation|probleme scolaire)\b/.test(
      text
    )
  ) {
    return "education_help";
  }

  if (
    /\b(lycee|direction|proviseur|proviseure|accueil|secretariat|ent|educonnect|pronote|webmail|zimbra|email academique|mot de passe academique|inscription|reinscription|classe|affectation|emploi du temps|document|dossier|justificatif|ordinateur|pc portable|tablette|wifi|logiciel|cantine|restauration|bourse|intendance|orientation|parcoursup|formation|specialite|absence|retard|vie scolaire|cpe|stage|grand oral)\b/.test(
      text
    )
  ) {
    return "school_support";
  }

  if (
    /\b(meteo|recette|football|match|cinema|serie netflix|acheter|shopping|cryptomonnaie|bourse en ligne|politique nationale|celebrite|blague)\b/.test(
      text
    )
  ) {
    return "out_of_scope";
  }

  return "unknown";
}

function conversationScopes(messages: AssistantPolicyMessage[]): AssistantScope[] {
  let activeScope: AssistantScope = "unknown";
  return messages
    .filter((message) => message.role === "requester")
    .map((message) => {
      if (isSafetyConfirmation(normalizeText(message.content))) {
        activeScope = "unknown";
        return "unknown";
      }
      const scope = explicitScope(message.content);
      if (scope !== "unknown") activeScope = scope;
      return scope === "unknown" ? activeScope : scope;
    });
}

export function evaluateConversationPolicy(
  messages: AssistantPolicyMessage[]
): ConversationPolicy {
  const requesterMessages = messages.filter(
    (message) => message.role === "requester"
  );
  const turnCount = requesterMessages.length;
  const remainingTurns = Math.max(0, MAX_CONVERSATION_TURNS - turnCount);
  const scopes = conversationScopes(messages);
  const explicitScopes = requesterMessages.map((message) =>
    explicitScope(message.content)
  );
  const lastScope = scopes.at(-1) ?? "unknown";
  const latestRequesterText = normalizeText(requesterMessages.at(-1)?.content ?? "");
  const transition = resolveAssistantConversationTransition(messages);

  if (isAlertStatusQuestion(latestRequesterText)) {
    return {
      scope: "wellbeing",
      action: "human_transfer",
      turnCount,
      remainingTurns,
      limitReached: false,
      deterministicReply:
        "Non. Cet assistant n’a transmis aucune alerte et ne peut pas garantir qu’un agent du lycée est disponible. Si le danger est immédiat, appelez le 15 ou le 112 et allez vers un adulte présent. Je peux préparer une demande pour qu’un agent humain la reprenne.",
      category: "vie_scolaire",
      urgency: "urgente",
      readyToCreate: true,
      safetyNotice: "Aucune alerte n’est considérée comme transmise sans confirmation d’un outil autorisé.",
    };
  }

  const latestSafetyIndex = explicitScopes.lastIndexOf("wellbeing");
  const safetyConfirmedAfter = requesterMessages
    .slice(latestSafetyIndex + 1)
    .some((message) => isSafetyConfirmation(normalizeText(message.content)));
  const unresolvedRecentSafety =
    latestSafetyIndex >= 0 &&
    turnCount - 1 - latestSafetyIndex <= 2 &&
    !safetyConfirmedAfter;

  if (lastScope === "wellbeing" || unresolvedRecentSafety) {
    const reply =
      "Je suis désolé que vous viviez cela. Si le danger ou le problème de santé est immédiat, appelez le 15 ou le 112. Si vous pensez à vous faire du mal, appelez le 3114. Allez aussi vers un adulte du lycée ou un adulte de confiance. Cet assistant n’a transmis aucune alerte et ne peut pas garantir qu’un agent du lycée est disponible. Êtes-vous en sécurité maintenant ? Je peux préparer une demande urgente pour une reprise humaine.";
    return {
      scope: "wellbeing",
      action: "human_transfer",
      turnCount,
      remainingTurns,
      limitReached: false,
      deterministicReply: reply,
      category: "vie_scolaire",
      urgency: "urgente",
      readyToCreate: true,
      safetyNotice: "Un adulte doit reprendre cette situation rapidement.",
    };
  }

  if (transition.stage === "action_confirmed" && transition.pendingAction) {
    const humanTransfer = transition.pendingAction === "human_transfer";
    return {
      scope: lastScope === "unknown" ? "school_support" : lastScope,
      action: humanTransfer ? "human_transfer" : "offer_case",
      turnCount,
      remainingTurns,
      limitReached: false,
      deterministicReply: humanTransfer
        ? "D’accord. La reprise par un agent humain est prête, mais elle n’est pas encore envoyée. Vérifiez vos coordonnées puis utilisez « Envoyer au lycée ». Le numéro de dossier confirmera l’enregistrement."
        : "D’accord. Votre demande est prête, mais elle n’est pas encore envoyée. Vérifiez vos coordonnées puis utilisez « Envoyer au lycée ». Le numéro de dossier confirmera l’enregistrement.",
      category: null,
      urgency: humanTransfer ? "urgente" : "normale",
      readyToCreate: true,
      safetyNotice: "Aucune demande n’est considérée comme transmise avant la confirmation du serveur.",
    };
  }

  if (transition.stage === "action_declined") {
    return {
      scope: lastScope,
      action: "continue",
      turnCount,
      remainingTurns,
      limitReached: false,
      deterministicReply:
        "D’accord, aucune demande n’a été envoyée. Vous pouvez continuer ici ou utiliser le formulaire quand vous le souhaitez.",
      category: null,
      urgency: "normale",
      readyToCreate: false,
      safetyNotice: null,
    };
  }

  if (isThirdPartySchoolDataRequest(requesterMessages.at(-1)?.content ?? "")) {
    return {
      scope: "school_support",
      action: "offer_case",
      turnCount,
      remainingTurns,
      limitReached: false,
      deterministicReply:
        "Je ne peux pas afficher ici l’emploi du temps, la salle, les absences ou le dossier d’une autre personne. Vous pouvez préparer une demande : le lycée vérifiera d’abord votre identité scolaire et votre relation avec la personne concernée.",
      category: "affectation_classe",
      urgency: "normale",
      readyToCreate: true,
      safetyNotice: "Aucune donnée concernant un tiers n’est transmise avant vérification de l’identité et de la relation.",
    };
  }

  if (turnCount >= MAX_CONVERSATION_TURNS) {
    return {
      scope: lastScope,
      action: "offer_case",
      turnCount,
      remainingTurns: 0,
      limitReached: true,
      deterministicReply:
        "Nous avons atteint la limite de cette conversation. Vous pouvez maintenant transmettre la demande au lycée : un agent retrouvera les messages déjà écrits et pourra vous répondre sans vous faire recommencer.",
      category: null,
      urgency: null,
      readyToCreate: true,
      safetyNotice: null,
    };
  }

  const educationTurns = scopes.filter(
    (scope) => scope === "education_help"
  ).length;
  if (lastScope === "education_help" && educationTurns > MAX_EDUCATION_TURNS) {
    return {
      scope: lastScope,
      action: "stop",
      turnCount,
      remainingTurns,
      limitReached: true,
      deterministicReply:
        "Je m’arrête après trois échanges d’aide scolaire pour rester fiable. Pour continuer, utilisez le cours donné par votre professeur, l’ENT ou demandez une aide pédagogique précise au lycée.",
      category: "orientation_formation",
      urgency: "faible",
      readyToCreate: false,
      safetyNotice: null,
    };
  }

  const outsideTurns = scopes.filter(
    (scope) => scope === "privacy_request" || scope === "out_of_scope"
  ).length;
  if (outsideTurns >= MAX_OUT_OF_SCOPE_TURNS) {
    return {
      scope: "out_of_scope",
      action: "stop",
      turnCount,
      remainingTurns,
      limitReached: true,
      deterministicReply:
        "Je suis réservé aux services et aux demandes du lycée. Pour éviter de vous faire perdre du temps, je termine cette conversation hors sujet. Vous pouvez recommencer avec un besoin concernant le lycée.",
      category: "autre",
      urgency: "faible",
      readyToCreate: false,
      safetyNotice: null,
    };
  }

  if (lastScope === "privacy_request") {
    return {
      scope: lastScope,
      action: "offer_case",
      turnCount,
      remainingTurns,
      limitReached: false,
      deterministicReply:
        "Je ne peux pas rechercher ni transmettre les coordonnées personnelles ou les données privées d’une personne. Si votre besoin concerne le lycée, je peux transmettre une demande au service concerné sans exposer ces informations.",
      category: "autre",
      urgency: "normale",
      readyToCreate: false,
      safetyNotice: "Les coordonnées et données privées ne sont jamais recherchées ni divulguées.",
    };
  }

  if (lastScope === "out_of_scope") {
    return {
      scope: lastScope,
      action: "continue",
      turnCount,
      remainingTurns,
      limitReached: false,
      deterministicReply:
        "Je suis l’assistant du lycée. Je peux vous aider pour l’ENT, la messagerie, un document, une inscription, un équipement ou une demande à transmettre à un service du lycée.",
      category: "autre",
      urgency: "faible",
      readyToCreate: false,
      safetyNotice: null,
    };
  }

  return {
    scope: lastScope,
    action: "continue",
    turnCount,
    remainingTurns,
    limitReached: false,
    deterministicReply: null,
    category: null,
    urgency: null,
    readyToCreate: null,
    safetyNotice: null,
  };
}
