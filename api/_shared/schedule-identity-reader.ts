import type { VercelRequest } from "@vercel/node";
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  identityDirectoryImports,
  identityDirectoryRows,
  schoolIdentities,
  schoolRelationships,
} from "../../db/schema.js";
import type { ScheduleReadResult } from "../../shared/schedule-policy.js";
import { HttpError, requireUser } from "./auth.js";
import { requireConfiguredInstitution } from "./institution-context.js";
import {
  readNextCourseFromPrivateSchedule,
  type TrustedScheduleScope,
} from "./schedule-reader.js";

const PERSON_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/;

function trustedPersonRef(value: string): string {
  const ref = value.normalize("NFKC").trim();
  if (!PERSON_REF.test(ref)) throw new HttpError(400, "La personne demandée est invalide.");
  return ref;
}

export async function resolveVerifiedScheduleScope(
  req: VercelRequest,
  targetPersonRef?: string
): Promise<TrustedScheduleScope> {
  const user = await requireUser(req);
  const institution = await requireConfiguredInstitution();
  const today = new Date().toISOString().slice(0, 10);

  const [identity] = await db
    .select({
      id: schoolIdentities.id,
      personType: schoolIdentities.personType,
      officialPersonRef: schoolIdentities.officialPersonRef,
    })
    .from(schoolIdentities)
    .innerJoin(identityDirectoryImports, and(
      eq(identityDirectoryImports.id, schoolIdentities.sourceImportId),
      eq(identityDirectoryImports.institutionId, schoolIdentities.institutionId)
    ))
    .where(and(
      eq(schoolIdentities.institutionId, institution.id),
      eq(schoolIdentities.userId, user.id),
      isNull(schoolIdentities.revokedAt),
      eq(identityDirectoryImports.status, "active")
    ))
    .limit(1);
  if (!identity) {
    throw new HttpError(403, "Une identité scolaire confirmée est nécessaire.");
  }

  const ownRef = trustedPersonRef(identity.officialPersonRef);
  const targetRef = targetPersonRef ? trustedPersonRef(targetPersonRef) : ownRef;
  if (targetRef !== ownRef) {
    const [relationship] = await db
      .select({ id: schoolRelationships.id })
      .from(schoolRelationships)
      .innerJoin(identityDirectoryImports, and(
        eq(identityDirectoryImports.id, schoolRelationships.sourceImportId),
        eq(identityDirectoryImports.institutionId, schoolRelationships.institutionId)
      ))
      .where(and(
        eq(schoolRelationships.institutionId, institution.id),
        eq(schoolRelationships.subjectIdentityId, identity.id),
        eq(schoolRelationships.objectPersonRef, targetRef),
        eq(schoolRelationships.relationshipType, "guardian_of"),
        eq(schoolRelationships.status, "active"),
        lte(schoolRelationships.validFrom, today),
        or(isNull(schoolRelationships.validUntil), gte(schoolRelationships.validUntil, today)),
        eq(identityDirectoryImports.status, "active")
      ))
      .limit(1);
    if (!relationship) {
      throw new HttpError(403, "Cette personne n'est pas liée à votre identité scolaire.");
    }
  }

  const [personRows, memberships] = await Promise.all([
    db
      .select({ classRef: identityDirectoryRows.classRef })
      .from(identityDirectoryRows)
      .innerJoin(identityDirectoryImports, and(
        eq(identityDirectoryImports.id, identityDirectoryRows.importId),
        eq(identityDirectoryImports.institutionId, identityDirectoryRows.institutionId)
      ))
      .where(and(
        eq(identityDirectoryRows.institutionId, institution.id),
        eq(identityDirectoryRows.recordType, "person"),
        eq(identityDirectoryRows.personRef, targetRef),
        eq(identityDirectoryRows.validationStatus, "valid"),
        lte(identityDirectoryRows.validFrom, today),
        or(isNull(identityDirectoryRows.validUntil), gte(identityDirectoryRows.validUntil, today)),
        eq(identityDirectoryImports.status, "active")
      ))
      .limit(2),
    db
      .select({ objectRef: identityDirectoryRows.objectRef })
      .from(identityDirectoryRows)
      .innerJoin(identityDirectoryImports, and(
        eq(identityDirectoryImports.id, identityDirectoryRows.importId),
        eq(identityDirectoryImports.institutionId, identityDirectoryRows.institutionId)
      ))
      .where(and(
        eq(identityDirectoryRows.institutionId, institution.id),
        eq(identityDirectoryRows.recordType, "relationship"),
        eq(identityDirectoryRows.subjectPersonRef, targetRef),
        eq(identityDirectoryRows.relationshipType, "member_of"),
        eq(identityDirectoryRows.validationStatus, "valid"),
        lte(identityDirectoryRows.validFrom, today),
        or(isNull(identityDirectoryRows.validUntil), gte(identityDirectoryRows.validUntil, today)),
        eq(identityDirectoryImports.status, "active")
      ))
      .limit(40),
  ]);

  const isOwnStaffSchedule = targetRef === ownRef && identity.personType === "staff";

  return {
    institutionId: institution.id,
    identityLevel: "I3",
    authorizedClassRefs: isOwnStaffSchedule
      ? []
      : personRows.flatMap((row) => row.classRef ? [row.classRef] : []),
    authorizedGroupRefs: isOwnStaffSchedule
      ? []
      : memberships.flatMap((row) => row.objectRef ? [row.objectRef] : []),
    authorizedTeacherRefs: isOwnStaffSchedule ? [ownRef] : [],
  };
}

export async function readNextCourseForVerifiedIdentity(input: {
  req: VercelRequest;
  targetPersonRef?: string;
  now: Date;
  requestedAt: Date;
}): Promise<ScheduleReadResult> {
  const scope = await resolveVerifiedScheduleScope(input.req, input.targetPersonRef);
  return readNextCourseFromPrivateSchedule({
    scope,
    now: input.now,
    requestedAt: input.requestedAt,
  });
}
