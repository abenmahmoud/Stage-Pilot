import { sql } from 'drizzle-orm';
import { credentialsFromPcVault, ownPcSessionAccessAllowed, type PcSessionAccessPayload } from '../../shared/pc-session-self-service.js';
import { VAULT_DISPLAY_VISIBILITY_SECONDS } from '../../shared/code-vault-policy.js';
import { HttpError } from './auth.js';
import type { IdentityDeviceSessionContext } from './identity-device-access.js';
import { recordVaultCodeDisplay, type VaultTx } from './code-vault-assignment.js';
import { resolveVaultCodeReveal } from './code-vault-read.js';
import { recordVaultAccessEvent } from './code-vault-access-events.js';

/** Called only with the verified server cookie, never a person supplied by the chat. */
export async function readOwnPcSessionAccess(tx: VaultTx, identity: IdentityDeviceSessionContext, reveal: boolean, now = new Date(), env: NodeJS.ProcessEnv = process.env): Promise<PcSessionAccessPayload> {
  if (!ownPcSessionAccessAllowed(identity, identity)) throw new HttpError(403, 'Les accès PC sont personnels. Chaque élève ou membre du personnel doit confirmer sa propre identité.');
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${identity.institutionId}::text,934821))`);
  // Keep revocation and directory activation from racing the disclosure.
  const sessions = await tx.execute(sql`
    select s.created_at, s.expires_at, s.absolute_expires_at
    from identity_device_sessions s
    join identity_directory_imports i on i.id=s.source_import_id and i.institution_id=s.institution_id and i.status='active'
    where s.id=${identity.id} and s.institution_id=${identity.institutionId} and s.source_import_id=${identity.sourceImportId}
      and s.person_ref=${identity.personRef} and s.person_type=${identity.personType}
      and s.assurance_level in ('directory_email_otp','directory_phone_otp') and s.revoked_at is null
      and s.expires_at > ${now.toISOString()}::timestamptz and s.absolute_expires_at > ${now.toISOString()}::timestamptz
    for share of s
  `);
  const [session] = Array.from(sessions as unknown as { created_at: string; expires_at: string; absolute_expires_at: string }[]);
  if (!session) throw new HttpError(401, 'Confirmez à nouveau votre identité pour consulter votre accès PC.');
  const proofEnd = new Date(session.created_at).getTime() + VAULT_DISPLAY_VISIBILITY_SECONDS * 1000;
  if (!Number.isFinite(proofEnd) || now.getTime() >= proofEnd) return { status: 'verification_required' };
  const year = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const assignments = await tx.execute(sql`
    select id, defective_flagged_at from public.code_vault_assignments
    where institution_id=${identity.institutionId} and person_ref=${identity.personRef}
      and service='koxo' and school_year=${`${year}-${year + 1}`} and replaced_by_assignment_id is null
    order by version desc limit 2 for update
  `);
  const rows = Array.from(assignments as unknown as { id: string; defective_flagged_at: string | null }[]);
  if (!rows.length) return { status: 'unavailable' };
  if (rows.length !== 1 || rows[0].defective_flagged_at) throw new HttpError(409, 'Votre accès PC doit être vérifié par le référent numérique. Vous pouvez lui transmettre une demande ici.');
  if (env.CODE_VAULT_REVEAL_ENABLED !== 'true') throw new HttpError(503, 'La remise des accès PC est momentanément indisponible.');
  if (!reveal) return { status: 'available' };
  const assignmentId = rows[0].id;
  const display = await recordVaultCodeDisplay(tx, { assignmentId, institutionId: identity.institutionId, now });
  if (display.outcome !== 'displayed') throw new HttpError(429, 'La limite de consultation est atteinte ou votre accès attend une vérification. Contactez le référent numérique ici.');
  const secret = await resolveVaultCodeReveal(tx, { assignmentId, institutionId: identity.institutionId, displayOutcome: display, env });
  const credentials = secret.value ? credentialsFromPcVault(secret.value) : null;
  if (!credentials) throw new HttpError(409, 'Votre identifiant et votre code PC ne sont pas encore disponibles. Demandez leur vérification au référent numérique.');
  await recordVaultAccessEvent(tx, { institutionId: identity.institutionId, assignmentId,
    actor: { profile: identity.personType === 'staff' ? 'professeur' : 'eleve', institutionId: identity.institutionId, personRef: identity.personRef }, eventType: 'consult' });
  return { status: 'ready', ...credentials, expiresAt: new Date(Math.min(proofEnd, new Date(session.expires_at).getTime(), new Date(session.absolute_expires_at).getTime())).toISOString() };
}
