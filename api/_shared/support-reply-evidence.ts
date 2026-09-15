import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { codeVaultAssignments, codeVaultPrivateRows, identityDirectoryImports, identityDirectoryRows, supportEvents } from '../../db/schema.js';
import { PERSONAL_HOME_BINDING_EVENT, personalHomeIdentityHash } from './personal-home-reader.js';
import { readOwnEntAccount } from './ent-account-reader.js';
import { parisToday } from '../../shared/school-calendar.js';
import type { SupportSuggestionEvidence } from '../../shared/support-reply-suggestion.js';

/** Staff-only evidence. No name matching, child traversal or credential plaintext. */
export async function readSupportEntEvidence(institutionId: string, requestId: string, now: Date, executor: Pick<typeof db, 'select'> = db, requiredPersonType?: 'guardian'): Promise<SupportSuggestionEvidence> {
  const evidence: SupportSuggestionEvidence = { state: 'unlinked', code: 'not_checked', checkedAt: now.toISOString() };
  const bindings = await executor.select({ hash: supportEvents.actorId }).from(supportEvents).where(and(
    eq(supportEvents.requestId, requestId), eq(supportEvents.eventType, PERSONAL_HOME_BINDING_EVENT), eq(supportEvents.actorType, 'system'),
  )).limit(2);
  if (bindings.length !== 1 || !bindings[0].hash) return evidence;
  const imports = await executor.select({ id: identityDirectoryImports.id }).from(identityDirectoryImports)
    .where(and(eq(identityDirectoryImports.institutionId, institutionId), eq(identityDirectoryImports.status, 'active'))).limit(2);
  if (imports.length !== 1) return evidence;
  const sourceImportId = imports[0].id;
  const today = parisToday(now);
  // A bounded metadata scan resolves the server HMAC binding, never typed names or contacts.
  const people = await executor.select({ personRef: identityDirectoryRows.personRef }).from(identityDirectoryRows).where(and(
    eq(identityDirectoryRows.institutionId, institutionId), eq(identityDirectoryRows.importId, sourceImportId),
    eq(identityDirectoryRows.recordType, 'person'), inArray(identityDirectoryRows.personType, requiredPersonType ? [requiredPersonType] : ['student', 'guardian', 'staff']),
    inArray(identityDirectoryRows.validationStatus, ['valid', 'warning']),
    or(isNull(identityDirectoryRows.validFrom), lte(identityDirectoryRows.validFrom, today)),
    or(isNull(identityDirectoryRows.validUntil), gte(identityDirectoryRows.validUntil, today)),
  )).limit(10001);
  if (people.length > 10000) return evidence;
  const matches = people.filter(p => p.personRef && personalHomeIdentityHash({ institutionId, sourceImportId, personRef: p.personRef }) === bindings[0].hash);
  if (matches.length !== 1 || !matches[0].personRef) return evidence;
  const identity = { institutionId, sourceImportId, personRef: matches[0].personRef };
  evidence.state = 'unavailable';
  const account = await readOwnEntAccount(identity, today, executor);
  if (!account) return evidence;
  evidence.state = account.activationState;
  if (account.activationState === 'inactive') {
    const year = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 9 ? 1 : 0);
    const assignments = await executor.select({ status: codeVaultAssignments.status, defective: codeVaultAssignments.defectiveFlaggedAt,
      replaced: codeVaultAssignments.replacedByAssignmentId, valueId: codeVaultPrivateRows.id }).from(codeVaultAssignments)
      .leftJoin(codeVaultPrivateRows, and(eq(codeVaultPrivateRows.assignmentId, codeVaultAssignments.id), eq(codeVaultPrivateRows.institutionId, institutionId)))
      .where(and(eq(codeVaultAssignments.institutionId, institutionId), eq(codeVaultAssignments.personRef, identity.personRef),
        eq(codeVaultAssignments.service, 'ent'), eq(codeVaultAssignments.schoolYear, `${year}-${year + 1}`), eq(codeVaultAssignments.version, 1))).limit(2);
    const assignment = assignments.length === 1 ? assignments[0] : null;
    evidence.code = !assignment || !assignment.valueId ? 'missing'
      : assignment.defective || assignment.replaced || !['disponible', 'reserve', 'remis'].includes(assignment.status) ? 'review' : 'available';
  }
  return evidence;
}
