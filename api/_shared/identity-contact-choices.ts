import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { identityDirectoryImports, identityDirectoryLookupRequests } from '../../db/schema.js';
import { decryptIdentityLookupResult } from '../../shared/identity-directory-lookup-crypto.mjs';
import { directoryIdentityMatches, directoryContactOptions, type DirectoryContactOption } from '../../shared/identity-contact-choices.mjs';
import type { ChallengeReceipt } from './identity-device-access.js';
import { HttpError } from './auth.js';

export type DeviceChoiceResult = {
  firstName: string; lastName: string; personType: 'student' | 'guardian' | 'staff';
  personRef: string; directoryVersionId: string; contacts: DirectoryContactOption[];
};

export async function readDeviceChoiceResult(claims: ChallengeReceipt, lookup: typeof identityDirectoryLookupRequests.$inferSelect): Promise<DeviceChoiceResult> {
  if (claims.schema !== 2 || lookup.searchType !== 'identity' || lookup.status !== 'completed'
    || lookup.expiresAt <= new Date() || lookup.resultSchema !== 1 || !lookup.resultIv || !lookup.resultAuthTag || !lookup.resultCiphertext) {
    throw new HttpError(410, 'Cette recherche a expiré. Recommencez pour recevoir un code.');
  }
  let value;
  try {
    value = decryptIdentityLookupResult({
      envelope: { schema: lookup.resultSchema, iv: lookup.resultIv, authTag: lookup.resultAuthTag, ciphertext: lookup.resultCiphertext },
      responseKey: claims.responseKey, requestId: claims.requestId,
      institutionId: claims.institutionId, actorId: claims.challengeId,
    }) as DeviceChoiceResult & { matchedBy: string };
    if (value.matchedBy !== 'identity' || !directoryIdentityMatches(claims, value)
      || typeof value.personRef !== 'string' || value.directoryVersionId !== lookup.matchedImportId
      || !Array.isArray(value.contacts) || value.contacts.length > 3) throw new Error('invalid_result');
    const known = directoryContactOptions({
      phone: value.contacts.find(c => c.id === 'phone')?.value,
      academicEmail: value.contacts.find(c => c.id === 'academic_email')?.value,
      personalEmail: value.contacts.find(c => c.id === 'personal_email')?.value,
    });
    if (JSON.stringify(known) !== JSON.stringify(value.contacts)) throw new Error('invalid_contacts');
  } catch {
    throw new HttpError(503, 'La vérification est momentanément indisponible. Réessayez.');
  }
  const [active] = await db.select({ id: identityDirectoryImports.id }).from(identityDirectoryImports)
    .where(and(eq(identityDirectoryImports.id, value.directoryVersionId), eq(identityDirectoryImports.institutionId, claims.institutionId), eq(identityDirectoryImports.status, 'active'))).limit(1);
  if (!active) throw new HttpError(410, 'L’annuaire a été actualisé. Recommencez la vérification.');
  return value;
}
