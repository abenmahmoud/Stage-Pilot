import type { VercelRequest,VercelResponse } from '@vercel/node';
import { and,eq,sql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { codeVaultAssignments,identityDeviceSessions } from '../../../db/schema.js';
import { HttpError } from '../../_shared/auth.js';
import { handleApi,methodNotAllowed } from '../../_shared/response.js';
import { readIdentityDeviceSession } from '../../_shared/identity-device-access.js';
import { identityDeviceFeatureEnabled } from '../../../shared/identity-device-access.js';
import { readOwnEntAccount } from '../../_shared/ent-account-reader.js';
import { codeFromEntVault,ownEntAccessAllowed,validEntAccessPayload,type EntAccessPayload } from '../../../shared/ent-self-service.js';
import { enforceSupportRateLimit,personalHash } from '../../_shared/support.js';
import { recordVaultCodeDisplay } from '../../_shared/code-vault-assignment.js';
import { resolveVaultCodeReveal } from '../../_shared/code-vault-read.js';
import { recordVaultAccessEvent } from '../../_shared/code-vault-access-events.js';

export default async function handler(req: VercelRequest,res: VercelResponse) {
  res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vary','Cookie');
  if (!['GET','POST'].includes(req.method ?? '')) return methodNotAllowed(res,['GET','POST']);
  return handleApi(res,async()=>{
    // No caller-controlled person, child, institution, account state or verification phase.
    if (Object.keys(req.query).length || (req.method==='POST' && JSON.stringify(req.body ?? {})!=='{}')) throw new HttpError(400,'Requête invalide.');
    if (!identityDeviceFeatureEnabled()) throw new HttpError(503,'Le service est momentanément indisponible.');
    const identity=await readIdentityDeviceSession(req,res);
    if (!identity) throw new HttpError(401,'Confirmez votre identité pour consulter votre accès ENT.');
    await enforceSupportRateLimit({scope:'assistant_session',keyHash:personalHash(`ent-self:${identity.id}`),limit:20,windowSeconds:60});
    const now=new Date();const account=await readOwnEntAccount(identity,now.toISOString().slice(0,10));
    if (!account) return {status:'unavailable'};
    let code: string|null=null;
    if (req.method==='POST' && account.activationState==='inactive') {
      if (process.env.CODE_VAULT_REVEAL_ENABLED!=='true') throw new HttpError(503,'La remise du code est momentanément indisponible.');
      const [proof]=await db.select({createdAt:identityDeviceSessions.createdAt}).from(identityDeviceSessions)
        .where(and(eq(identityDeviceSessions.id,identity.id),eq(identityDeviceSessions.institutionId,identity.institutionId))).limit(1);
      if (!proof || now.getTime()-proof.createdAt.getTime()>30*60_000) throw new HttpError(401,'Pour afficher un code personnel, confirmez à nouveau votre identité depuis « Gérer mon accès ».');
      code=await db.transaction(async tx=>{
        // Activation cannot supersede this source while a disclosure is in flight.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${identity.institutionId}::text,934821))`);
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${identity.institutionId}::text,827164))`);
        const active=await tx.execute(sql`select id from identity_directory_imports where id=${identity.sourceImportId} and institution_id=${identity.institutionId} and status='active'`);
        if (!Array.from(active).length) throw new HttpError(401,'L’annuaire a été actualisé. Confirmez à nouveau votre identité.');
        const session=await tx.execute(sql`select id from identity_device_sessions where id=${identity.id} and institution_id=${identity.institutionId} and source_import_id=${identity.sourceImportId} and revoked_at is null and expires_at > now() and absolute_expires_at > now() for share`);
        if (!Array.from(session).length) throw new HttpError(401,'Confirmez à nouveau votre identité.');
        const latest=await readOwnEntAccount(identity,now.toISOString().slice(0,10),tx);
        if (!latest || latest.identifier!==account.identifier || latest.activationState!=='inactive') throw new HttpError(409,'Votre compte ENT vient d’être actualisé. Consultez à nouveau votre accès.');
        const year=now.getUTCMonth()>=8?now.getUTCFullYear():now.getUTCFullYear()-1;
        const [assignment]=await tx.select().from(codeVaultAssignments).where(and(
          eq(codeVaultAssignments.institutionId,identity.institutionId),eq(codeVaultAssignments.personRef,identity.personRef),
          eq(codeVaultAssignments.service,'ent'),eq(codeVaultAssignments.schoolYear,`${year}-${year+1}`),eq(codeVaultAssignments.version,1))).limit(1);
        if (!assignment || !ownEntAccessAllowed(identity,assignment) || assignment.status==='utilise') throw new HttpError(409,'Le code doit être vérifié par le référent numérique. Vous pouvez lui transmettre votre demande ici.');
        const display=await recordVaultCodeDisplay(tx,{assignmentId:assignment.id,institutionId:identity.institutionId,now});
        if (display.outcome!=='displayed') return null;
        const reveal=await resolveVaultCodeReveal(tx,{assignmentId:assignment.id,institutionId:identity.institutionId,displayOutcome:display});
        const result=reveal.value ? codeFromEntVault(reveal.value,account) : null;
        if (!result) throw new HttpError(409,'Le code doit être vérifié par le référent numérique.');
        await recordVaultAccessEvent(tx,{institutionId:identity.institutionId,assignmentId:assignment.id,
          actor:{profile:identity.personType==='guardian'?'parent':identity.personType==='student'?'eleve':'professeur',personRef:identity.personRef,institutionId:identity.institutionId},eventType:'consult'});
        return result;
      });
      if (!code) throw new HttpError(429,'La limite de consultation est atteinte ou le code attend une vérification. Transmettez une demande au référent numérique.');
    }
    const result:EntAccessPayload={status:'ready',account,profile:identity.personType,code,
      expiresAt:new Date(Math.min(now.getTime()+30*60_000,identity.expiresAt.getTime())).toISOString()};
    if (!validEntAccessPayload(result)) throw new HttpError(503,'Les informations ENT doivent être vérifiées.');
    return result;
  });
}
export const config={api:{bodyParser:{sizeLimit:'1kb'}}};
