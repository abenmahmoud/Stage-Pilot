import { and, eq, gte, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { identityDirectoryImports, identityDirectoryRows } from '../../db/schema.js';
import { parisToday } from '../../shared/school-calendar.js';
import type { ContentTargeting } from '../../shared/content-targeting.js';
import { requireConfiguredInstitution } from './institution-context.js';
import { HttpError } from './auth.js';

/** Only class labels leave this reader, never names, contacts or counts of people. */
export async function readContentAudienceClasses(): Promise<string[]> {
  const institution = await requireConfiguredInstitution();
  const today = parisToday();
  const rows = await db.selectDistinct({ classRef: identityDirectoryRows.classRef }).from(identityDirectoryRows)
    .innerJoin(identityDirectoryImports, and(eq(identityDirectoryImports.id, identityDirectoryRows.importId), eq(identityDirectoryImports.institutionId, institution.id), eq(identityDirectoryImports.status, 'active')))
    .where(and(eq(identityDirectoryRows.institutionId, institution.id), eq(identityDirectoryRows.recordType, 'person'), eq(identityDirectoryRows.personType, 'student'),
      inArray(identityDirectoryRows.validationStatus, ['valid', 'warning']), isNotNull(identityDirectoryRows.classRef),
      or(isNull(identityDirectoryRows.validFrom), lte(identityDirectoryRows.validFrom, today)), or(isNull(identityDirectoryRows.validUntil), gte(identityDirectoryRows.validUntil, today))))
    .orderBy(identityDirectoryRows.classRef).limit(301);
  if (rows.length > 300) throw new HttpError(503, 'La liste des classes doit être vérifiée.');
  return rows.flatMap(row => row.classRef && row.classRef.length <= 80 && row.classRef.trim() === row.classRef && !/[\u0000-\u001f\u007f]/.test(row.classRef) ? [row.classRef] : []);
}
export async function validateContentAudienceClasses(targeting?: ContentTargeting | null) {
  if (!targeting?.classRefs.length) return;
  const known = new Set(await readContentAudienceClasses());
  if (targeting.classRefs.some(ref => !known.has(ref))) throw new HttpError(409, 'Une classe choisie n’est plus dans l’annuaire actif. Vérifiez le public avant publication.');
}
