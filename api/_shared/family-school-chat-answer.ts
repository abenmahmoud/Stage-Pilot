import type { FamilySchoolResult } from './family-school-chat-service.js';
import type { SupportAgentResult } from './support-agent.js';
import { scheduleAssistantDayAnswer } from '../../shared/schedule-assistant.js';
import { ENT_LOGIN_URL } from '../../shared/ent-self-service.js';

/** Facts come from the protected readers; this answer never invokes a language model. */
export function familySchoolAnswer(result: FamilySchoolResult): Partial<SupportAgentResult> {
  const base: Partial<SupportAgentResult> = {
    category: 'affectation_classe', scope: 'school_support', action: 'continue',
    confidence: 'high', readyToCreate: false, usedAi: false, missingInformation: [],
    suggestedDocuments: [], sourceReferences: [], safetyNotice: null, internalSummaryFr: null,
  };
  if (result.status === 'identity_required') return { ...base,
    reply: 'Pour consulter les informations de votre enfant, confirmez votre identité ici, par SMS ou par email parmi les contacts connus du lycée.',
    missingInformation: ['Identité scolaire confirmée'],
  };
  if (result.status === 'choose_child') return { ...base, requesterType: 'parent',
    reply: 'Quel enfant est concerné ? Choisissez parmi les liens confirmés dans l’annuaire du lycée.', schoolTargets: result.choices,
  };
  if (result.status === 'day_required') return { ...base, requesterType: 'parent',
    reply: `${result.label} : souhaitez-vous consulter les cours d’aujourd’hui ou de demain ?`, missingInformation: ['Le jour souhaité'],
  };
  if (result.status === 'class' && result.classRef) return { ...base, requesterType: 'parent',
    reply: `${result.label} : la classe indiquée dans l’annuaire actif du lycée est ${result.classRef}.`,
    internalSummaryFr: 'La classe de l’enfant autorisé a été consultée dans l’annuaire actif.',
  };
  if (result.status === 'schedule') {
    const answer = scheduleAssistantDayAnswer(result.result, result.day);
    // Keep the selected child visible, including when the timetable is unavailable.
    const reply = `${result.label}\n\n${answer.reply.replace(/vos cours/g, 'les cours de cet enfant').replace(/Vous n'avez aucun cours prévu/g, 'Cet enfant n’a aucun cours prévu').replace(/vous êtes libre/g, 'cet enfant est libre')}${!result.result.ok ? `\n\nVous pouvez aussi consulter [monlycée.net](${ENT_LOGIN_URL}) avec votre compte personnel de parent, ou choisir « Retrouver mon accès ENT » ici.` : ''}`.slice(0, 1500);
    return { ...base, ...answer, reply, requesterType: 'parent', action: answer.readyToCreate ? 'offer_case' : 'continue',
      ...(result.result.ok ? { schedule: {
        title: `${result.label} · ${result.day === 1 ? 'Demain' : 'Aujourd’hui'}`.slice(0, 120),
        courses: result.result.courses, updatedAt: result.result.source.activatedAt, incompleteGroups: result.result.incompleteGroups === true,
      } } : {}),
      internalSummaryFr: result.result.ok ? 'Les cours de l’enfant autorisé ont été lus depuis une source validée.' : 'L’emploi du temps de l’enfant autorisé ne peut pas être affiché actuellement.',
    };
  }
  return { ...base, readyToCreate: true, action: 'offer_case',
    reply: result.status === 'forbidden'
      ? `Le rattachement à cet enfant doit être vérifié par l’administration. Son nom et son prénom peuvent accompagner votre demande, sans créer automatiquement un lien familial. Votre propre accès ENT reste indépendant : vous pouvez choisir « Retrouver mon accès ENT » ici ou ouvrir [monlycée.net](${ENT_LOGIN_URL}). Souhaitez-vous préparer la demande de vérification du lien familial ?`
      : `Les informations scolaires de l’enfant ne sont pas disponibles pour cette consultation. Votre propre accès ENT reste indépendant : vous pouvez choisir « Retrouver mon accès ENT » ici ou ouvrir [monlycée.net](${ENT_LOGIN_URL}). Je peux préparer une demande à l’administration avec le nom et le prénom de votre enfant pour faire vérifier ses informations. Souhaitez-vous la préparer ici ?`,
  };
}
