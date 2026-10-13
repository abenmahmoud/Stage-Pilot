import { detectForbiddenSupportSecret } from './support-secret-policy.js';
import { isCateringSupportTopic } from './support-topic-context.js';
import { isValidSupportQueueAccess, isSupportQueuePublicCode, isSupportQueueDate, isKnownSupportQueueService, hasCoherentSupportQueuePagination } from './support-queue-payload-policy.js';
import type { SupportAgentAccess } from './support-agent-access.js';

export const TEAM_INSTRUCTION_PREFIX = '[Consigne équipe]\n';
export const BOARD_SERVICES: Record<string, string> = {
  referent_numerique: 'Référent numérique', secretariat: 'Secrétariat', administration: 'Administration',
  intendance: 'Intendance', vie_scolaire: 'Vie scolaire', ddfpt: 'DDFPT', direction: 'Direction',
};
export const BOARD_STATUSES: Record<string, string> = {
  nouveau: 'À prendre en charge', a_qualifier: 'À orienter', assigne: 'Pris en charge', en_cours: 'En cours',
  attente_demandeur: 'Réponse du demandeur attendue', attente_interne: 'Action du lycée attendue',
  resolu: 'Résolu', clos: 'Clos', indesirable: 'Écarté',
};
export type ActionBoardRow = {
  publicCode: string; createdAt: string; updatedAt: string; person: string; subject: string; problem: string;
  service: string | null; status: string; urgent: boolean; action: string; instruction: string | null;
  instructionAt: string | null; callbackPending: boolean;
};
export type ActionBoardPayload = {
  rows: ActionBoardRow[]; access: SupportAgentAccess; generatedAt: string;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

/** A short team handout must not carry secrets or contact details. React renders it as plain text. */
export function boardExcerpt(value: string, max = 360): string {
  if (detectForbiddenSupportSecret(value)) return 'Consulter le dossier pour le détail de cette demande.';
  const text = value.replace(/https?:\/\/\S+/gi, '[lien dans le dossier]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email dans le dossier]')
    .replace(/(?:\+33|0033|0)[1-9](?:[ .-]?\d{2}){4}\b/g, '[téléphone dans le dossier]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

export function boardProblem(description: string, latestInbound: string | null): string {
  const original = description.trim();
  const latest = latestInbound?.trim() || '';
  if (!original) return boardExcerpt(latest);
  // A reply such as a school year or “merci” must not replace the original need.
  if (!latest || original.includes(latest)) return boardExcerpt(original);
  return boardExcerpt(`${boardExcerpt(original, 230)} Dernier message : ${boardExcerpt(latest, 100)}`);
}

export function suggestedTeamAction(input: { category: string; subcategory?: string | null; status: string; subject: string; problem: string; callbackPending: boolean }): string {
  if (['resolu', 'clos', 'indesirable'].includes(input.status)) return 'Aucune action en cours. Consulter l’historique si nécessaire.';
  if (input.callbackPending) return 'Effectuer le rappel demandé, puis consigner le résultat dans le dossier.';
  if (input.status === 'attente_demandeur') return 'Attendre la réponse ou les pièces demandées ; reprendre le dossier à leur réception.';
  if (input.status === 'a_qualifier') return 'Préciser le besoin et confirmer le service responsable avant de répondre.';
  if (input.subcategory === 'materiel_lycee') return 'Qualifier le matériel et le lieu, préparer l’intervention SPIE et consigner son résultat.';
  if (isCateringSupportTopic(input.problem)) return 'Vérifier la demande de restauration avec l’intendance et communiquer la démarche adaptée.';
  if (input.category === 'ent') return 'Vérifier l’identité et l’état ENT : activation par le parcours sécurisé, ou récupération Monlycée.net. PRONOTE s’ouvre depuis l’ENT.';
  if (input.category === 'email_academique') return 'Vérifier le compte concerné et proposer la récupération officielle ; faire valider toute correction de coordonnées.';
  if (input.category === 'inscription') return 'Vérifier la classe ou la formation et les pièces utiles ; transmettre la décision du service compétent.';
  if (input.category === 'documents_scolarite') return 'Vérifier le document demandé et les droits du bénéficiaire, puis préparer la remise sécurisée.';
  if (input.category === 'restauration_bourse') return 'Vérifier le dossier auprès de l’intendance et préciser la prochaine démarche.';
  if (input.category === 'ordinateur') return 'Identifier l’équipement et le problème, puis orienter vers le SAV adapté ou le parcours sécurisé de session PC.';
  if (input.category === 'vie_scolaire' || input.category === 'affectation_classe') return 'Vérifier la situation avec le service concerné et donner une réponse adaptée.';
  return 'Lire le besoin, effectuer la vérification utile et indiquer clairement la suite au demandeur.';
}

export function isActionBoardPayload(value: unknown): value is ActionBoardPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as ActionBoardPayload;
  if (Object.keys(item).length !== 4 || !Object.keys(item).every(key => ['rows', 'access', 'generatedAt', 'pagination'].includes(key))) return false;
  if (!isValidSupportQueueAccess(item.access) || !isSupportQueueDate(item.generatedAt) || !Array.isArray(item.rows) || !item.pagination) return false;
  if (item.pagination.pageSize > 50 || !hasCoherentSupportQueuePagination(item.rows.length, item.pagination)) return false;
  return new Set(item.rows.map(row => row?.publicCode)).size === item.rows.length && item.rows.every(row => {
    if (!row || typeof row !== 'object') return false;
    const fields = ['publicCode', 'createdAt', 'updatedAt', 'person', 'subject', 'problem', 'service', 'status', 'urgent', 'action', 'instruction', 'instructionAt', 'callbackPending'];
    if (Object.keys(row).length !== fields.length || !Object.keys(row).every(key => fields.includes(key))) return false;
    const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
    return isSupportQueuePublicCode(row.publicCode) && isSupportQueueDate(row.createdAt) && isSupportQueueDate(row.updatedAt)
      && text(row.person, 220) && text(row.subject, 180) && text(row.problem, 360) && text(row.action, 1000)
      && isKnownSupportQueueService(row.service) && Object.hasOwn(BOARD_STATUSES, row.status)
      && typeof row.urgent === 'boolean' && typeof row.callbackPending === 'boolean'
      && (row.instruction === null || text(row.instruction, 1000))
      && (row.instructionAt === null || isSupportQueueDate(row.instructionAt));
  });
}
