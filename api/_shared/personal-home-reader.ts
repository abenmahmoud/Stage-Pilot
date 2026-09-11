import type { VercelRequest } from '@vercel/node';
import { and, desc, eq, gt, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.js';
import { identityDirectoryRows, supportContacts, supportDeviceSessions, supportEvents, supportRequests, supportSessionRequests } from '../../db/schema.js';
import { PERSONAL_HOME_STATUS_LABELS, type PersonalHomeRequest } from '../../shared/personal-home.js';
import { parisToday } from '../../shared/school-calendar.js';
import type { HomeIdentity, HomeTarget } from './personal-home-service.js';
import { personalHash, readSupportSessionToken, sha256 } from './support.js';
import { supportSessionContactPredicate } from './support-session-contact.js';

export const PERSONAL_HOME_BINDING_EVENT = 'request.identity_bound';
export function personalHomeIdentityHash(identity: Pick<HomeIdentity, 'institutionId' | 'sourceImportId' | 'personRef'>): string {
  return personalHash(`personal-home-owner-v1:${identity.institutionId}:${identity.sourceImportId}:${identity.personRef}`);
}

export async function readPersonalHomeTargets(identity: HomeIdentity, now: Date): Promise<HomeTarget[]> {
  const person = alias(identityDirectoryRows, 'home_person');
  const validPerson = and(
    eq(person.institutionId, identity.institutionId), eq(person.importId, identity.sourceImportId), eq(person.recordType, 'person'),
    inArray(person.validationStatus, ['valid', 'warning']),
    or(isNull(person.validFrom), lte(person.validFrom, parisToday(now))), or(isNull(person.validUntil), gte(person.validUntil, parisToday(now))),
  );
  const people = identity.personType === 'guardian'
    ? await db.selectDistinct({ personRef: person.personRef, classRef: person.classRef }).from(identityDirectoryRows)
      .innerJoin(person, and(eq(person.personRef, identityDirectoryRows.objectRef), validPerson, eq(person.personType, 'student')))
      .where(and(eq(identityDirectoryRows.institutionId, identity.institutionId), eq(identityDirectoryRows.importId, identity.sourceImportId),
        eq(identityDirectoryRows.recordType, 'relationship'), eq(identityDirectoryRows.relationshipType, 'guardian_of'),
        eq(identityDirectoryRows.subjectPersonRef, identity.personRef), eq(identityDirectoryRows.validationStatus, 'valid'),
        lte(identityDirectoryRows.validFrom, parisToday(now)), or(isNull(identityDirectoryRows.validUntil), gte(identityDirectoryRows.validUntil, parisToday(now)))))
      .orderBy(person.personRef).limit(21)
    : await db.select({ personRef: person.personRef, classRef: person.classRef }).from(person)
      .where(and(validPerson, eq(person.personRef, identity.personRef), eq(person.personType, identity.personType))).limit(2);
  // A malformed or ambiguous directory must never broaden an access scope.
  if (people.length > 20 || (identity.personType !== 'guardian' && people.length !== 1)) return [];
  return people.filter(p => p.personRef && /^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(p.personRef)).map((person, index) => ({
    classRef: person.classRef,
    personRef: person.personRef!, key: personalHash(`personal-home-target-v1:${identity.id}:${person.personRef}`),
    label: identity.personType === 'guardian'
      ? `Enfant ${index + 1}${person.classRef ? ` · ${person.classRef.slice(0, 80)}` : ''}`
      : identity.personType === 'student' && person.classRef ? `Ma classe · ${person.classRef.slice(0, 80)}` : 'Mon emploi du temps',
  }));
}

/** Existing request ACL AND server-recorded identity binding. Never match a typed name or email. */
export async function readPersonalHomeRequests(req: VercelRequest, identity: HomeIdentity): Promise<PersonalHomeRequest[]> {
  const token = readSupportSessionToken(req);
  if (!token) return [];
  const now = new Date();
  return db.selectDistinct({
    publicCode: supportRequests.publicCode, subject: supportRequests.subject, status: supportRequests.status,
    hasDocument: sql<boolean>`exists (select 1 from public.support_attachments as home_attachment
      where home_attachment.request_id = "support_requests"."id" and home_attachment.direction = 'agent'
      and home_attachment.message_id is not null and home_attachment.released_at is not null
      and home_attachment.scan_status = 'clean' and home_attachment.retention_until > ${now.toISOString()}::timestamptz)`,
    updatedAt: supportRequests.updatedAt,
  }).from(supportDeviceSessions)
    .innerJoin(supportSessionRequests, eq(supportSessionRequests.sessionId, supportDeviceSessions.id))
    .innerJoin(supportRequests, eq(supportRequests.id, supportSessionRequests.requestId))
    .innerJoin(supportEvents, and(eq(supportEvents.requestId, supportRequests.id), eq(supportEvents.eventType, PERSONAL_HOME_BINDING_EVENT),
      eq(supportEvents.actorType, 'system'), eq(supportEvents.actorId, personalHomeIdentityHash(identity))))
    .leftJoin(supportContacts, eq(supportContacts.id, supportDeviceSessions.accessContactId))
    .where(and(eq(supportDeviceSessions.sessionHash, sha256(token)), gt(supportDeviceSessions.expiresAt, now), isNull(supportDeviceSessions.revokedAt),
      eq(supportRequests.institutionId, identity.institutionId), gt(supportRequests.retentionUntil, now),
      inArray(supportRequests.status, Object.keys(PERSONAL_HOME_STATUS_LABELS)), supportSessionContactPredicate()))
    .orderBy(desc(supportRequests.updatedAt)).limit(4)
    .then(rows => rows.map(({ updatedAt: _updatedAt, ...row }) => row));
}
