import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../../../../db/index.js';
import { supportMessages, supportRequests } from '../../../../../db/schema.js';
import { HttpError } from '../../../../_shared/auth.js';
import { handleApi, methodNotAllowed } from '../../../../_shared/response.js';
import { requireSupportAgent, assertSupportRequestAccess } from '../../../../_shared/support-agent-access.js';
import { enforceSupportRateLimit, personalHash } from '../../../../_shared/support.js';
import { readSupportEntEvidence } from '../../../../_shared/support-reply-evidence.js';
import { formatSupportRevision } from '../../../../../shared/support-concurrency.js';
import { singleSupportAgentRouteValue } from '../../../../../shared/support-agent-mutation-input-policy.js';
import { suggestEntReply, type SupportReplySuggestion } from '../../../../../shared/support-reply-suggestion.js';
import { schoolReferenceAnswer } from '../../../../../shared/school-reference-answers.js';
import { chromebookReferenceAnswer } from '../../../../../shared/chromebook-assistant.js';
import { decideVaultAccess } from '../../../../../shared/code-vault-policy.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  return handleApi(res, async () => {
    const { user, access, institutionId } = await requireSupportAgent(req);
    const code = singleSupportAgentRouteValue(req.query.code);
    if (!code || !/^BC-\d{4}-\d{6}$/.test(code) || Object.keys(req.query).some(key => key !== 'code')) throw new HttpError(400, 'Numéro de demande invalide.');
    const [request] = await db.select().from(supportRequests).where(and(eq(supportRequests.institutionId, institutionId), eq(supportRequests.publicCode, code))).limit(1);
    if (!request) throw new HttpError(404, 'Demande introuvable.');
    assertSupportRequestAccess(access, request.assignedTeam);
    if (request.retentionUntil <= new Date()) throw new HttpError(410, 'Ce dossier n’est plus disponible.');
    await enforceSupportRateLimit({ scope: 'assistant_session', keyHash: personalHash(`agent-reply-suggestion:${institutionId}:${user.id}`), limit: 30, windowSeconds: 60 });
    const now = new Date();
    const messages = await db.select({ text: supportMessages.bodyText }).from(supportMessages)
      .where(and(eq(supportMessages.requestId, request.id), eq(supportMessages.direction, 'inbound'))).orderBy(desc(supportMessages.createdAt)).limit(4);
    const latest = messages[0]?.text ?? request.description;
    const text = `${request.subject} ${latest}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const ent = /\b(ent|monlycee|mon lycee)\b/.test(text) && !/\b(koxo|session windows|badge cantine)\b/.test(text);
    let proposal: Pick<SupportReplySuggestion, 'draft' | 'facts' | 'sources' | 'title'>;
    if (ent) {
      const canReadEnt = decideVaultAccess({ actor: access.role === 'superadmin' ? { profile: 'superadmin' }
        : { profile: 'service', institutionId, grantedServices: access.serviceCodes },
        target: { service: 'ent', institutionId, subjectKind: 'institution_wide', subjectPersonRef: null, subjectClassRef: null } }).allowed;
      // Only a server-bound owner can inform this draft. A declared beneficiary never selects a vault account.
      const parentOwnAccount = request.requesterType === 'parent';
      const evidence = canReadEnt && (request.beneficiaryType === 'self' || parentOwnAccount)
        ? await readSupportEntEvidence(institutionId, request.id, now, db, parentOwnAccount ? 'guardian' : undefined)
        : { state: 'unlinked' as const, code: 'not_checked' as const, checkedAt: now.toISOString() };
      proposal = suggestEntReply(evidence, /\b(deja (essaye|fait)|toujours bloque|ne (marche|fonctionne) (toujours )?pas|ca (marche|fonctionne) pas|aucun (mail|email|code) recu)\b/.test(latest.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
      if (!canReadEnt) proposal.facts = ['Votre service peut expliquer la procédure publique. La consultation du coffre ENT est réservée aux services habilités.'];
      if (canReadEnt && parentOwnAccount && evidence.state !== 'unlinked') {
        proposal.title = 'Accès ENT personnel du parent';
        proposal.facts.unshift('Compte du parent lié à la demande ; les codes de l’enfant ne sont pas consultés.');
      }
    } else {
      const conversation = [{ role: 'requester' as const, content: latest }];
      const answer = schoolReferenceAnswer(conversation, now) ?? chromebookReferenceAnswer(conversation, now);
      proposal = answer ? { title: 'Réponse issue des informations du lycée', draft: `Bonjour,\n\n${answer.reply}\n\nVous pouvez répondre dans ce dossier si vous avez besoin d’une précision.\n\nL’équipe du lycée Blaise Cendrars`, facts: ['Réponse fondée sur une procédure publique validée.'], sources: answer.sourceReferences.map(s => s.title) }
        : { title: 'Une précision est nécessaire', draft: 'Bonjour,\n\nPour vous apporter une réponse précise, pouvez-vous indiquer ce qui vous bloque et la démarche déjà essayée ? Si un message d’erreur apparaît, vous pouvez joindre une capture en masquant les codes et mots de passe.\n\nVous pouvez répondre directement dans ce dossier.\n\nL’équipe du lycée Blaise Cendrars', facts: ['Aucune réponse suffisamment précise n’est disponible dans les sources consultées.'], sources: ['Dernier message du dossier'] };
    }
    const result: SupportReplySuggestion = { ...proposal, publicCode: code, revision: formatSupportRevision(request.updatedAt), checkedAt: now.toISOString() };
    return result;
  });
}
