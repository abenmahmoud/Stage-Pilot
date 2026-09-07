import type {
  ScheduleDayCourse,
  ScheduleDayReadResult,
  ScheduleReadFailureReason,
  ScheduleReadResult,
} from "./schedule-policy.js";

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

function requesterText(messages: ConversationMessage[]): string {
  const content = [...messages]
    .reverse()
    .find((message) => message.role === "requester")?.content ?? "";
  return normalized(content);
}

function mentionsThirdParty(text: string): boolean {
  return /\b(mon enfant|mon fils|ma fille|un autre eleve|une autre eleve|ce professeur|cet enseignant)\b/.test(text);
}

export function requestsOwnNextCourse(messages: ConversationMessage[]): boolean {
  const text = requesterText(messages);
  if (mentionsThirdParty(text)) return false;
  return /\b(mon prochain cours|ou est mon cours|mon cours commence|ma salle pour (?:mon )?cours|dans quelle salle (?:est|a lieu) mon cours|changement de salle (?:pour )?mon cours)\b/.test(text);
}

export function requestsOwnCoursesToday(messages: ConversationMessage[]): boolean {
  const text = requesterText(messages);
  if (mentionsThirdParty(text)) return false;
  return /\b(mes cours (?:aujourd'hui|de la journee|du jour|de ce matin|de cet apres-midi)|quels sont mes cours|qu'est-ce que j'ai (?:comme cours )?(?:aujourd'hui|ce matin|cet apres-midi)|mon programme du jour|mon emploi du temps (?:aujourd'hui|du jour|maintenant|ce matin|cet apres-midi))\b/.test(text);
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

function scheduleFailureAnswer(
  reason: ScheduleReadFailureReason,
  context: "next" | "day"
): ScheduleAssistantAnswer {
  const messages: Record<ScheduleReadFailureReason, { reply: string; safetyNotice: string | null }> = {
    identity_i3_required: {
      reply: context === "day"
        ? "Je peux rechercher vos cours du jour, mais votre identité scolaire doit d'abord être confirmée. Vous pouvez transmettre une demande au lycée si vous ne pouvez pas effectuer cette vérification."
        : "Je peux rechercher votre prochain cours, mais votre identité scolaire doit d'abord être confirmée. Vous pouvez transmettre une demande au lycée si vous ne pouvez pas effectuer cette vérification.",
      safetyNotice: "Une adresse ou une classe écrite dans la conversation ne donne aucun accès à un emploi du temps personnel.",
    },
    source_unavailable: {
      reply: "Aucun emploi du temps validé n'est disponible pour cette consultation. Vous pouvez transmettre une demande à la vie scolaire afin qu'un agent vérifie la situation.",
      safetyNotice: null,
    },
    teacher_schedule_unavailable: {
      reply: "Votre emploi du temps personnel de professeur n'est pas disponible dans la version actuellement active : je ne peux donc pas vous répondre. Vous pouvez transmettre une demande à la vie scolaire pour qu'il soit ajouté.",
      safetyNotice: "Aucun emploi du temps de classe ne vous est présenté à la place du vôtre.",
    },
    source_stale: {
      reply: "L'emploi du temps disponible doit être revalidé avant que je puisse vous indiquer une salle ou un cours. Vous pouvez transmettre une demande à la vie scolaire.",
      safetyNotice: "Une source périmée n'est jamais présentée comme actuelle.",
    },
    no_authorized_course: {
      reply: context === "day"
        ? "Je ne trouve aucun cours autorisé pour vous dans la version validée. Vous pouvez transmettre une demande à la vie scolaire pour vérification."
        : "Je ne trouve aucun prochain cours autorisé dans la version validée. Vous pouvez transmettre une demande à la vie scolaire pour vérification.",
      safetyNotice: null,
    },
    conflicting_changes: {
      reply: "Deux informations officielles se contredisent sur ce cours. Je ne choisis pas à votre place : transmettez une demande à la vie scolaire pour confirmation.",
      safetyNotice: "Aucune salle ni aucun horaire incertain n'est affiché.",
    },
  };
  return {
    ...messages[reason],
    readyToCreate: true,
    sourceReferences: [],
  };
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

  return scheduleFailureAnswer(result.reason, "next");
}

function dayCourseSentence(course: ScheduleDayCourse): string {
  const timing = courseTiming(course.startsAt, course.endsAt);
  if (course.state === "cancelled") {
    return `${course.subjectLabel} (${timing}) est annulé selon le dernier changement officiel.`;
  }
  const room = course.roomCode ? ` en salle ${course.roomCode}` : ", sans salle confirmée";
  const change = course.state === "moved" ? " (changement pris en compte)" : "";
  return `${course.subjectLabel}, ${timing}${room}${change}.`;
}

export function scheduleAssistantDayAnswer(result: ScheduleDayReadResult): ScheduleAssistantAnswer {
  if (result.ok) {
    const sourceNotice = `Source validée, à recontrôler avant le ${reviewDate(result.source.freshUntil)}.`;
    if (result.courses.length === 0) {
      return {
        reply: `Vous n'avez aucun cours prévu pour cette journée selon l'emploi du temps validé. ${sourceNotice}`,
        readyToCreate: false,
        safetyNotice: null,
        sourceReferences: [{ title: "Emploi du temps validé", updatedAt: result.source.activatedAt }],
      };
    }
    const sentences = result.courses.map(dayCourseSentence).join(" ");
    return {
      reply: `Voici vos cours pour cette journée : ${sentences} ${sourceNotice}`,
      readyToCreate: false,
      safetyNotice: null,
      sourceReferences: [{ title: "Emploi du temps validé", updatedAt: result.source.activatedAt }],
    };
  }

  return scheduleFailureAnswer(result.reason, "day");
}
