import assert from "node:assert/strict";
import test from "node:test";
import {
  CommunicationRecipientRegistryError,
  createCommunicationRecipientRegistryRequestToken,
  createCommunicationRecipientRegistrySnapshotToken,
  verifyCommunicationRecipientRegistryRequestToken,
  verifyCommunicationRecipientRegistrySnapshotToken,
} from "../shared/communication-recipient-registry.ts";

const secret = "registry-test-secret-with-at-least-32-characters";
const institutionId = "11111111-1111-4111-8111-111111111111";
const otherInstitutionId = "22222222-2222-4222-8222-222222222222";
const snapshotId = "33333333-3333-4333-8333-333333333333";
const nonce = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-08-30T09:00:00.000Z");

function snapshot(overrides = {}) {
  return {
    v: 1,
    institutionId,
    snapshotId,
    generatedAt: "2026-08-30T08:59:30.000Z",
    expiresAt: "2026-08-30T09:29:30.000Z",
    groups: [
      {
        groupRef: "staff:general",
        label: "Professeurs - voie generale",
        kind: "teaching",
        memberCount: 84,
        active: true,
      },
      {
        groupRef: "staff:all",
        label: "Tous les personnels",
        kind: "mixed",
        memberCount: 200,
        active: true,
      },
    ],
    ...overrides,
  };
}

test("authenticates a short-lived server request without user data", () => {
  const signed = createCommunicationRecipientRegistryRequestToken({
    institutionId,
    secret,
    now,
    nonce,
  });
  const verified = verifyCommunicationRecipientRegistryRequestToken({
    token: signed.token,
    institutionId,
    secret,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(verified?.institutionId, institutionId);
  assert.match(verified?.requestHash ?? "", /^[a-f0-9]{64}$/);
  assert.doesNotMatch(signed.token, /email|phone|message|document|contact/i);
});

test("rejects request tampering, replay after expiry, cross-scope use and weak secrets", () => {
  const signed = createCommunicationRecipientRegistryRequestToken({ institutionId, secret, now, nonce });
  const base = { token: signed.token, institutionId, secret, now };
  assert.equal(verifyCommunicationRecipientRegistryRequestToken({ ...base, token: `${signed.token}x` }), null);
  assert.equal(verifyCommunicationRecipientRegistryRequestToken({ ...base, institutionId: otherInstitutionId }), null);
  assert.equal(
    verifyCommunicationRecipientRegistryRequestToken({
      ...base,
      now: new Date(now.getTime() + 6 * 60_000),
    }),
    null
  );
  assert.throws(
    () => createCommunicationRecipientRegistryRequestToken({ institutionId, secret: "short", now, nonce }),
    (error) => error instanceof CommunicationRecipientRegistryError && error.reason === "secret_invalid"
  );
});

test("accepts a signed bounded snapshot containing groups only", () => {
  const signed = createCommunicationRecipientRegistrySnapshotToken({
    snapshot: snapshot(),
    institutionId,
    secret,
    now,
  });
  const verified = verifyCommunicationRecipientRegistrySnapshotToken({
    token: signed.token,
    institutionId,
    secret,
    now,
  });
  assert.equal(verified?.groups.length, 2);
  assert.deepEqual(verified?.groups.map((group) => group.groupRef), ["staff:all", "staff:general"]);
  assert.match(verified?.snapshotHash ?? "", /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(verified?.groups[0] ?? {}).sort(), [
    "active",
    "groupRef",
    "kind",
    "label",
    "memberCount",
  ]);
});

test("rejects contact fields, member lists and locator values at every depth", () => {
  for (const unsafe of [
    snapshot({ email: "direction@example.test" }),
    snapshot({ groups: [{ ...snapshot().groups[0], members: ["contact-1"] }] }),
    snapshot({ groups: [{ ...snapshot().groups[0], label: "professeurs@example.test" }] }),
    snapshot({ groups: [{ ...snapshot().groups[0], label: "+33 6 12 34 56 78" }] }),
  ]) {
    assert.throws(
      () => createCommunicationRecipientRegistrySnapshotToken({
        snapshot: unsafe,
        institutionId,
        secret,
        now,
      }),
      CommunicationRecipientRegistryError
    );
  }
});

test("rejects duplicate refs, excessive groups, invalid counts and long-lived snapshots", () => {
  assert.throws(() => createCommunicationRecipientRegistrySnapshotToken({
    snapshot: snapshot({ groups: [snapshot().groups[0], snapshot().groups[0]] }),
    institutionId,
    secret,
    now,
  }), (error) => error instanceof CommunicationRecipientRegistryError && error.reason === "group_ref_duplicate");
  assert.throws(() => createCommunicationRecipientRegistrySnapshotToken({
    snapshot: snapshot({ groups: Array.from({ length: 201 }, (_, index) => ({
      ...snapshot().groups[0],
      groupRef: `group:${index.toString().padStart(3, "0")}`,
    })) }),
    institutionId,
    secret,
    now,
  }), (error) => error instanceof CommunicationRecipientRegistryError && error.reason === "groups_invalid");
  assert.throws(() => createCommunicationRecipientRegistrySnapshotToken({
    snapshot: snapshot({ groups: [{ ...snapshot().groups[0], memberCount: 10_001 }] }),
    institutionId,
    secret,
    now,
  }), (error) => error instanceof CommunicationRecipientRegistryError && error.reason === "member_count_invalid");
  assert.throws(() => createCommunicationRecipientRegistrySnapshotToken({
    snapshot: snapshot({ expiresAt: "2026-08-30T10:59:30.000Z" }),
    institutionId,
    secret,
    now,
  }), (error) => error instanceof CommunicationRecipientRegistryError && error.reason === "snapshot_ttl_invalid");
});

test("rejects expired, future, cross-institution and tampered snapshots", () => {
  const signed = createCommunicationRecipientRegistrySnapshotToken({
    snapshot: snapshot(),
    institutionId,
    secret,
    now,
  });
  assert.equal(verifyCommunicationRecipientRegistrySnapshotToken({
    token: signed.token,
    institutionId: otherInstitutionId,
    secret,
    now,
  }), null);
  assert.equal(verifyCommunicationRecipientRegistrySnapshotToken({
    token: signed.token,
    institutionId,
    secret,
    now: new Date("2026-08-30T09:30:00.000Z"),
  }), null);
  assert.equal(verifyCommunicationRecipientRegistrySnapshotToken({
    token: `${signed.token}x`,
    institutionId,
    secret,
    now,
  }), null);
  assert.throws(() => createCommunicationRecipientRegistrySnapshotToken({
    snapshot: snapshot({ generatedAt: "2026-08-30T09:01:00.000Z" }),
    institutionId,
    secret,
    now,
  }), (error) => error instanceof CommunicationRecipientRegistryError && error.reason === "snapshot_from_future");
});
