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
import { readIdentityDeviceSession } from "./identity-device-access.js";
import { requireConfiguredInstitution } from "./institution-context.js";
import {
  readNextCourseFromPrivateSchedule,
  type TrustedScheduleScope,
} from "./schedule-reader.js";

const PERSON_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/;
const SCHEDULE_REF = /^[A-Z0-9][A-Z0-9._:-]{1,79}$/;
const MAX_GROUPS = 40;
const IDENTITY_REQUIRED = "Une identité scolaire et des droits à jour sont nécessaires.";

function trustedPersonRef(value: string): string {
  if (typeof value !== "string" || !PERSON_REF.test(value) || value.trim() !== value) {
    throw new HttpError(400, "La personne demandée est invalide.");
  }
  return value;
}

function scheduleRef(value: unknown): string {
  // Do not silently map a directory reference onto a different schedule ID.
  if (typeof value !== "string" || !SCHEDULE_REF.test(value) || value.trim() !== value) {
    throw new HttpError(403, IDENTITY_REQUIRED);
  }
  return value;
}

async function readCurrentPerson(
  reader: Pick<typeof db, "select">,
  scope: { institutionId: string; importId: string; personRef: string; today: string }
) {
  const rows = await reader
    .select({ personType: identityDirectoryRows.personType, classRef: identityDirectoryRows.classRef })
    .from(identityDirectoryRows)
    .innerJoin(identityDirectoryImports, and(
      eq(identityDirectoryImports.id, identityDirectoryRows.importId),
      eq(identityDirectoryImports.institutionId, identityDirectoryRows.institutionId)
    ))
    .where(and(
      eq(identityDirectoryRows.institutionId, scope.institutionId),
      eq(identityDirectoryRows.importId, scope.importId),
      eq(identityDirectoryRows.recordType, "person"),
      eq(identityDirectoryRows.personRef, scope.personRef),
      eq(identityDirectoryRows.validationStatus, "valid"),
      lte(identityDirectoryRows.validFrom, scope.today),
      or(isNull(identityDirectoryRows.validUntil), gte(identityDirectoryRows.validUntil, scope.today)),
      eq(identityDirectoryImports.status, "active")
    ))
    .limit(2);
  if (rows.length !== 1) throw new HttpError(403, IDENTITY_REQUIRED);
  return rows[0];
}

export async function resolveVerifiedScheduleScope(
  req: VercelRequest,
  targetPersonRef?: string
): Promise<TrustedScheduleScope> {
  const institution = await requireConfiguredInstitution();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const requestedRef = targetPersonRef === undefined ? undefined : trustedPersonRef(targetPersonRef);
  const deviceIdentity = await readIdentityDeviceSession(req);
  const user = deviceIdentity ? null : await requireUser(req);

  return db.transaction(async (tx): Promise<TrustedScheduleScope> => {
    let identity: {
      id: string | null;
      sourceImportId: string;
      personType: string;
      officialPersonRef: string;
      assuranceLevel: string;
    };
    if (deviceIdentity) {
      identity = {
        id: null,
        sourceImportId: deviceIdentity.sourceImportId,
        personType: deviceIdentity.personType,
        officialPersonRef: deviceIdentity.personRef,
        assuranceLevel: deviceIdentity.assuranceLevel,
      };
    } else {
      const identities = await tx
        .select({
          id: schoolIdentities.id,
          sourceImportId: schoolIdentities.sourceImportId,
          personType: schoolIdentities.personType,
          officialPersonRef: schoolIdentities.officialPersonRef,
          assuranceLevel: schoolIdentities.assuranceLevel,
          verifiedBy: schoolIdentities.verifiedBy,
          verifiedAt: schoolIdentities.verifiedAt,
        })
        .from(schoolIdentities)
        .innerJoin(identityDirectoryImports, and(
          eq(identityDirectoryImports.id, schoolIdentities.sourceImportId),
          eq(identityDirectoryImports.institutionId, schoolIdentities.institutionId)
        ))
        .where(and(
          eq(schoolIdentities.institutionId, institution.id),
          eq(schoolIdentities.userId, user!.id),
          isNull(schoolIdentities.revokedAt),
          eq(identityDirectoryImports.status, "active")
        ))
        .limit(2);
      const accountIdentity = identities[0];
      if (
        identities.length !== 1
        || !["directory_matched", "official_sso"].includes(accountIdentity.assuranceLevel)
        || (accountIdentity.assuranceLevel === "directory_matched" && !accountIdentity.verifiedBy)
        || !accountIdentity.verifiedAt
        || !Number.isFinite(accountIdentity.verifiedAt.getTime())
        || accountIdentity.verifiedAt > now
      ) {
        throw new HttpError(403, IDENTITY_REQUIRED);
      }
      identity = accountIdentity;
    }
    if (
      !["student", "guardian", "staff"].includes(identity.personType)
      || !PERSON_REF.test(identity.officialPersonRef)
      || identity.officialPersonRef.trim() !== identity.officialPersonRef
    ) throw new HttpError(403, IDENTITY_REQUIRED);

    const ownRef = identity.officialPersonRef;
    const targetRef = requestedRef ?? ownRef;
    const directoryScope = { institutionId: institution.id, importId: identity.sourceImportId, today };
    const ownPerson = await readCurrentPerson(tx, { ...directoryScope, personRef: ownRef });
    if (ownPerson.personType !== identity.personType) throw new HttpError(403, IDENTITY_REQUIRED);
    let targetPerson = ownPerson;
    if (targetRef !== ownRef) {
      const [relationship] = identity.id
        ? await tx
            .select({ id: schoolRelationships.id })
            .from(schoolRelationships)
            .innerJoin(identityDirectoryImports, and(
              eq(identityDirectoryImports.id, schoolRelationships.sourceImportId),
              eq(identityDirectoryImports.institutionId, schoolRelationships.institutionId)
            ))
            .where(and(
              eq(schoolRelationships.institutionId, institution.id),
              eq(schoolRelationships.sourceImportId, identity.sourceImportId),
              eq(schoolRelationships.subjectIdentityId, identity.id),
              eq(schoolRelationships.objectPersonRef, targetRef),
              eq(schoolRelationships.relationshipType, "guardian_of"),
              eq(schoolRelationships.status, "active"),
              lte(schoolRelationships.validFrom, today),
              or(isNull(schoolRelationships.validUntil), gte(schoolRelationships.validUntil, today)),
              eq(identityDirectoryImports.status, "active")
            ))
            .limit(1)
        : await tx
            .select({ id: identityDirectoryRows.id })
            .from(identityDirectoryRows)
            .innerJoin(identityDirectoryImports, and(
              eq(identityDirectoryImports.id, identityDirectoryRows.importId),
              eq(identityDirectoryImports.institutionId, identityDirectoryRows.institutionId)
            ))
            .where(and(
              eq(identityDirectoryRows.institutionId, institution.id),
              eq(identityDirectoryRows.importId, identity.sourceImportId),
              eq(identityDirectoryRows.recordType, "relationship"),
              eq(identityDirectoryRows.subjectPersonRef, ownRef),
              eq(identityDirectoryRows.objectRef, targetRef),
              eq(identityDirectoryRows.relationshipType, "guardian_of"),
              eq(identityDirectoryRows.validationStatus, "valid"),
              lte(identityDirectoryRows.validFrom, today),
              or(isNull(identityDirectoryRows.validUntil), gte(identityDirectoryRows.validUntil, today)),
              eq(identityDirectoryImports.status, "active")
            ))
            .limit(1);
      if (!relationship) {
        throw new HttpError(403, IDENTITY_REQUIRED);
      }
      targetPerson = await readCurrentPerson(tx, { ...directoryScope, personRef: targetRef });
      if (targetPerson.personType !== "student") throw new HttpError(403, IDENTITY_REQUIRED);
    }

    const isOwnStaffSchedule = targetRef === ownRef && identity.personType === "staff";
    if (isOwnStaffSchedule) {
      return {
        institutionId: institution.id, identityLevel: "I3",
        authorizedClassRefs: [], authorizedGroupRefs: [], authorizedTeacherRefs: [scheduleRef(ownRef)],
      };
    }
    if (targetPerson.personType !== "student") throw new HttpError(403, IDENTITY_REQUIRED);

    const memberships = await tx
      .select({ objectRef: identityDirectoryRows.objectRef })
      .from(identityDirectoryRows)
      .innerJoin(identityDirectoryImports, and(
        eq(identityDirectoryImports.id, identityDirectoryRows.importId),
        eq(identityDirectoryImports.institutionId, identityDirectoryRows.institutionId)
      ))
      .where(and(
        eq(identityDirectoryRows.institutionId, institution.id),
        eq(identityDirectoryRows.importId, identity.sourceImportId),
        eq(identityDirectoryRows.recordType, "relationship"),
        eq(identityDirectoryRows.subjectPersonRef, targetRef),
        eq(identityDirectoryRows.relationshipType, "member_of"),
        eq(identityDirectoryRows.validationStatus, "valid"),
        lte(identityDirectoryRows.validFrom, today),
        or(isNull(identityDirectoryRows.validUntil), gte(identityDirectoryRows.validUntil, today)),
        eq(identityDirectoryImports.status, "active")
      ))
      .limit(MAX_GROUPS + 1);
    if (memberships.length > MAX_GROUPS) throw new HttpError(403, IDENTITY_REQUIRED);

    return {
      institutionId: institution.id,
      identityLevel: "I3",
      authorizedClassRefs: targetPerson.classRef ? [scheduleRef(targetPerson.classRef)] : [],
      authorizedGroupRefs: [...new Set(memberships.map((row) => scheduleRef(row.objectRef)))],
      authorizedTeacherRefs: [],
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
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
