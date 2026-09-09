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
  return requestedOwnCoursesDayOffset(messages) === 0;
}

export function requestsOwnSchedule(messages: ConversationMessage[]): boolean {
  const text = requesterText(messages);
  if (mentionsThirdParty(text)) return false;
  return /\b(mon emploi du temps|mes horaires de cours|mon planning de cours)\b/.test(text);
}

export function requestedOwnCoursesDayOffset(messages: ConversationMessage[]): 0 | 1 | null {
  const text = requesterText(messages);
  if (mentionsThirdParty(text)) return null;
  const explicitDay = explicitOwnCoursesDayOffset(text);
  if (explicitDay !== null) return explicitDay;

  // A short answer continues only the immediately preceding personal timetable
  // discussion. This resolves intent, never identity or permission to read data.
  const shortDay = shortDayOffset(text);
  if (shortDay === null) return null;
  const previousRequests = messages.filter(message => message.role === "requester").slice(0, -1);
  for (const previous of previousRequests.reverse()) {
    const previousText = normalized(previous.content);
    if (mentionsThirdParty(previousText)) return null;
    if (shortDayOffset(previousText) !== null) continue;
    const conversation = [previous];
    return requestsOwnSchedule(conversation) || requestsOwnNextCourse(conversation)
      || explicitOwnCoursesDayOffset(previousText) !== null ? shortDay : null;
  }
  return null;
}

function shortDayOffset(text: string): 0 | 1 | null {
  const match = text.trim().match(/^(?:(?:oui|et|pour|plutot)[ ,]*){0,2}(aujourd'hui|demain)(?:[ ,]*(?:s'il (?:vous|te) plait|svp|stp|merci))?[.!?\s]*$/);
  return match ? match[1] === "demain" ? 1 : 0 : null;
}

function explicitOwnCoursesDayOffset(text: string): 0 | 1 | null {
  if (/\b(mes cours demain|quels sont mes cours demain|qu'est-ce que j'ai (?:comme cours )?demain|mon programme de demain|mon emploi du temps (?:pour )?demain|emploi du temps de demain)\b/.test(text)) {
    return 1;
  }
  if (/\b(mes cours (?:aujourd'hui|de la journee|du jour|de ce matin|de cet apres-midi)|quels sont mes cours|qu'est-ce que j'ai (?:comme cours )?(?:aujourd'hui|ce matin|cet apres-midi)|mon programme du jour|mon emploi du temps (?:aujourd'hui|du jour|maintenant|ce matin|cet apres-midi))\b/.test(text)) {
    return 0;
  }
  return null;
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
  if (Number.isNaN(date.getTime())) return "date non disponible";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(date);
}

function scheduleFailureAnswer(
  reason: ScheduleReadFailureReason,
  context: "next" | "today" | "tomorrow"
): ScheduleAssistantAnswer {
  const requestedDay = context === "tomorrow" ? "de demain" : "du jour";
  const messages: Record<ScheduleReadFailureReason, { reply: string; safetyNotice: string | null }> = {
    identity_i3_required: {
      reply: context !== "next"
        ? `Je peux rechercher vos cours ${requestedDay}, mais votre identité scolaire doit d'abord être confirmée. Vous pouvez transmettre une demande au lycée si vous ne pouvez pas effectuer cette vérification.`
        : "Je peux rechercher votre prochain cours, mais votre identité scolaire doit d'abord être confirmée. Vous pouvez transmettre une demande au lycée si vous ne pouvez pas effectuer cette vérification.",
      safetyNotice: "Une adresse ou une classe écrite dans la conversation ne donne aucun accès à un emploi du temps personnel.",
    },
    source_unavailable: {
      reply: "Aucun emploi du temps validé n'est disponible pour cette consultation. Vous pouvez transmettre une demande à la vie scolaire afin qu'un agent vérifie la situation.",
      safetyNotice: null,
    },
    teacher_schedule_unavailable: {
      reply: "Votre emploi du temps personnel de professeur n'est pas encore disponible dans la version active. Je peux préparer une demande à la vie scolaire pour qu'il soit ajouté.",
      safetyNotice: null,
    },
    source_stale: {
      reply: "L'emploi du temps disponible doit être revalidé avant que je puisse vous indiquer une salle ou un cours. Vous pouvez transmettre une demande à la vie scolaire.",
      safetyNotice: null,
    },
    no_authorized_course: {
      reply: context !== "next"
        ? "Je ne peux pas retrouver vos cours dans l'emploi du temps validé. Je peux préparer une demande à la vie scolaire pour vérification."
        : "Je ne peux pas retrouver votre prochain cours dans l'emploi du temps validé. Je peux préparer une demande à la vie scolaire pour vérification.",
      safetyNotice: null,
    },
    conflicting_changes: {
      reply: "Les informations disponibles sur ce cours se contredisent. La vie scolaire doit les vérifier avant que je vous indique une salle ou un horaire. Je peux préparer cette demande ici.",
      safetyNotice: null,
    },
  };
  return {
    ...messages[reason],
    readyToCreate: reason !== "identity_i3_required",
    sourceReferences: [],
  };
}

export function scheduleAssistantAnswer(result: ScheduleReadResult): ScheduleAssistantAnswer {
  if (result.ok) {
    const timing = courseTiming(result.course.startsAt, result.course.endsAt);
    const sourceNotice = `Version du ${reviewDate(result.source.activatedAt)}.`;
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
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
  const timing = `${time.format(new Date(course.startsAt))} – ${time.format(new Date(course.endsAt))}`;
  if (course.state === "cancelled") {
    return `• ${timing} · ${course.subjectLabel} · Cours annulé`;
  }
  const room = course.roomCode ? `Salle ${course.roomCode}` : "Salle à confirmer";
  const change = course.state === "moved" ? " · Changement pris en compte" : "";
  return `• ${timing} · ${course.subjectLabel} · ${room}${change}`;
}

export function scheduleAssistantDayAnswer(
  result: ScheduleDayReadResult,
  dayOffset: 0 | 1 = 0,
): ScheduleAssistantAnswer {
  const requestedDay = dayOffset === 1 ? "demain" : "aujourd'hui";
  if (result.ok) {
    const sourceNotice = `Version du ${reviewDate(result.source.activatedAt)}.`;
    if (result.courses.length === 0) {
      return {
        reply: `Vous n'avez aucun cours prévu ${requestedDay} selon l'emploi du temps validé. ${sourceNotice}`,
        readyToCreate: false,
        safetyNotice: null,
        sourceReferences: [{ title: "Emploi du temps validé", updatedAt: result.source.activatedAt }],
      };
    }
    const sentences = result.courses.map(dayCourseSentence).join("\n");
    return {
      reply: `Voici vos cours pour ${requestedDay} :\n\n${sentences}\n\n${sourceNotice}`,
      readyToCreate: false,
      safetyNotice: null,
      sourceReferences: [{ title: "Emploi du temps validé", updatedAt: result.source.activatedAt }],
    };
  }

  return scheduleFailureAnswer(result.reason, dayOffset === 1 ? "tomorrow" : "today");
}
