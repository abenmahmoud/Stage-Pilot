import type { ScheduleReadResult } from "./schedule-policy.js";

type ConversationMessage = {
  role: "assistant" | "requester";
  content: string;
};

export type ScheduleAssistantAnswer = {
  reply: string;
  readyToCreate: boolean;
  safetyNotice: string | null;
  sourceReferences: Array<{ title: string; updatedAt: string }>;
};

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’`]/g, "'")
    .toLowerCase();
}

export function requestsOwnNextCourse(messages: ConversationMessage[]): boolean {
  const content = [...messages]
    .reverse()
    .find((message) => message.role === "requester")?.content ?? "";
  const text = normalized(content);
  const namesThirdParty = /\b(mon enfant|mon fils|ma fille|un autre eleve|une autre eleve|ce professeur|cet enseignant)\b/.test(text);
  if (namesThirdParty) return false;
  return /\b(mon prochain cours|ou est mon cours|mon cours commence|ma salle pour (?:mon )?cours|dans quelle salle (?:est|a lieu) mon cours|changement de salle (?:pour )?mon cours|mon emploi du temps (?:maintenant|aujourd'hui|ce matin|cet apres-midi))\b/.test(text);
}

function courseTiming(startsAt: string, endsAt: string): string {
  const date = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(date.getTime()) || Number.isNaN(end.getTime())) {
    return "à l'horaire indiqué dans l'emploi du temps";
  }
  const day = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(date);
  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
  return `${day}, de ${time.format(date)} à ${time.format(end)}`;
}

function reviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "la date de fraîcheur indiquée";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(date);
}

export function scheduleAssistantAnswer(result: ScheduleReadResult): ScheduleAssistantAnswer {
  if (result.ok) {
    const timing = courseTiming(result.course.startsAt, result.course.endsAt);
    const sourceNotice = `Source validée, à recontrôler avant le ${reviewDate(result.source.freshUntil)}.`;
    if (result.course.state === "cancelled") {
      return {
        reply: `Votre cours de ${result.course.subjectLabel} prévu ${timing} est annulé selon le dernier changement officiel. ${sourceNotice}`,
        readyToCreate: false,
        safetyNotice: null,
        sourceReferences: [{
          title: "Emploi du temps validé",
          updatedAt: result.source.changeObservedAt ?? result.source.activatedAt,
        }],
      };
    }
    const room = result.course.roomCode
      ? ` en salle ${result.course.roomCode}`
      : ", sans salle confirmée";
    const change = result.course.state === "moved"
      ? " Le dernier changement officiel est pris en compte."
      : "";
    return {
      reply: `Votre prochain cours est ${result.course.subjectLabel}, ${timing}${room}.${change} ${sourceNotice}`,
      readyToCreate: false,
      safetyNotice: null,
      sourceReferences: [{
        title: "Emploi du temps validé",
        updatedAt: result.source.changeObservedAt ?? result.source.activatedAt,
      }],
    };
  }

  const messages: Record<Exclude<ScheduleReadResult, { ok: true }>["reason"], {
    reply: string;
    safetyNotice: string | null;
  }> = {
    school_identity_required: {
      reply: "Je peux rechercher votre prochain cours, mais votre identité scolaire doit d'abord être confirmée. Vous pouvez transmettre une demande au lycée si vous ne pouvez pas effectuer cette vérification.",
      safetyNotice: "Une adresse ou une classe écrite dans la conversation ne donne aucun accès à un emploi du temps personnel.",
    },
    source_unavailable: {
      reply: "Aucun emploi du temps validé n'est disponible pour cette consultation. Vous pouvez transmettre une demande à la vie scolaire afin qu'un agent vérifie la situation.",
      safetyNotice: null,
    },
    source_stale: {
      reply: "L'emploi du temps disponible doit être revalidé avant que je puisse vous indiquer une salle ou un cours. Vous pouvez transmettre une demande à la vie scolaire.",
      safetyNotice: "Une source périmée n'est jamais présentée comme actuelle.",
    },
    no_authorized_course: {
      reply: "Je ne trouve aucun prochain cours autorisé dans la version validée. Vous pouvez transmettre une demande à la vie scolaire pour vérification.",
      safetyNotice: null,
    },
    conflicting_changes: {
      reply: "Deux informations officielles se contredisent sur ce cours. Je ne choisis pas à votre place : transmettez une demande à la vie scolaire pour confirmation.",
      safetyNotice: "Aucune salle ni aucun horaire incertain n'est affiché.",
    },
  };
  return {
    ...messages[result.reason],
    readyToCreate: true,
    sourceReferences: [],
  };
}
