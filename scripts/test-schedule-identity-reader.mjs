import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reader = await readFile(
  new URL("../api/_shared/schedule-identity-reader.ts", import.meta.url),
  "utf8"
);

test("requires a server-authenticated account or revocable device identity from an active source", () => {
  assert.match(reader, /requireUser\(req\)/);
  assert.match(reader, /readIdentityDeviceSession\(req\)/);
  assert.match(reader, /requireConfiguredInstitution\(\)/);
  assert.match(reader, /isNull\(schoolIdentities\.revokedAt\)/);
  assert.match(reader, /eq\(identityDirectoryImports\.status, "active"\)/);
  assert.doesNotMatch(reader, /userMetadata|user_metadata|raw_user_meta_data/);
});

test("allows a third-party target only through an active dated relationship", () => {
  assert.match(reader, /targetRef !== ownRef/);
  assert.match(reader, /eq\(schoolRelationships\.subjectIdentityId, identity\.id\)/);
  assert.match(reader, /eq\(schoolRelationships\.objectPersonRef, targetRef\)/);
  assert.match(reader, /eq\(schoolRelationships\.relationshipType, "guardian_of"\)/);
  assert.match(reader, /eq\(schoolRelationships\.status, "active"\)/);
  assert.match(reader, /lte\(schoolRelationships\.validFrom, today\)/);
  assert.match(reader, /gte\(schoolRelationships\.validUntil, today\)/);
  assert.match(reader, /eq\(identityDirectoryRows\.subjectPersonRef, ownRef\)/);
  assert.match(reader, /eq\(identityDirectoryRows\.objectRef, targetRef\)/);
});

test("derives only valid current class and group references", () => {
  const institutionFilters = reader.match(/eq\(identityDirectoryRows\.institutionId, (?:institution\.id|scope\.institutionId)\)/g) ?? [];
  assert.equal(institutionFilters.length, 3);
  assert.match(reader, /eq\(identityDirectoryRows\.validationStatus, "valid"\)/);
  assert.match(reader, /eq\(identityDirectoryRows\.relationshipType, "member_of"\)/);
  assert.match(reader, /\.limit\(MAX_GROUPS \+ 1\)/);
  assert.match(reader, /memberships\.length > MAX_GROUPS/);
});

test("keeps teacher scope on the verified staff identity and calls the private reader", () => {
  assert.match(reader, /const isOwnStaffSchedule = targetRef === ownRef && identity\.personType === "staff"/);
  assert.match(reader, /if \(isOwnStaffSchedule\)[\s\S]{0,250}authorizedClassRefs: \[\], authorizedGroupRefs: \[\]/);
  assert.match(reader, /authorizedTeacherRefs: \[scheduleRef\(ownRef\)\]/);
  assert.match(reader, /readNextCourseFromPrivateSchedule/);
});
