import assert from "node:assert/strict";
import test from "node:test";

import {
  FLASH_PUBLIC_AUDIENCE_GROUP_REF,
  FlashVisibilityError,
  checkFlashVersionVisibility,
  isFlashVersionVisible,
  selectVisibleFlashVersions,
} from "../shared/flash-visibility.ts";

const NOW = new Date("2026-09-05T12:00:00.000Z");
const CLASSE_A = "classe:2nde4";
const CLASSE_B = "classe:2nde5";

test("publiee et non expiree, audience publique : visible pour un anonyme", () => {
  const check = checkFlashVersionVisibility({
    status: "publiee",
    expiresAt: new Date("2026-09-05T18:00:00.000Z"),
    now: NOW,
    audience: [FLASH_PUBLIC_AUDIENCE_GROUP_REF],
    viewerGroupRefs: null,
  });
  assert.equal(check.isVisible, true);
  assert.equal(check.reason, "visible");
});

test("publiee et expiree a la seconde pres : jamais visible", () => {
  const check = checkFlashVersionVisibility({
    status: "publiee",
    expiresAt: NOW,
    now: NOW,
    audience: [FLASH_PUBLIC_AUDIENCE_GROUP_REF],
    viewerGroupRefs: null,
  });
  assert.equal(check.isVisible, false);
  assert.equal(check.reason, "expired");

  const oneSecondAfter = checkFlashVersionVisibility({
    status: "publiee",
    expiresAt: NOW,
    now: new Date(NOW.getTime() + 1000),
    audience: [FLASH_PUBLIC_AUDIENCE_GROUP_REF],
    viewerGroupRefs: null,
  });
  assert.equal(oneSecondAfter.isVisible, false);

  const oneSecondBefore = checkFlashVersionVisibility({
    status: "publiee",
    expiresAt: NOW,
    now: new Date(NOW.getTime() - 1000),
    audience: [FLASH_PUBLIC_AUDIENCE_GROUP_REF],
    viewerGroupRefs: null,
  });
  assert.equal(oneSecondBefore.isVisible, true);
});

test("validee mais jamais publiee : jamais visible, meme audience publique et non expiree", () => {
  const check = checkFlashVersionVisibility({
    status: "validee",
    expiresAt: new Date("2026-09-05T18:00:00.000Z"),
    now: NOW,
    audience: [FLASH_PUBLIC_AUDIENCE_GROUP_REF],
    viewerGroupRefs: null,
  });
  assert.equal(check.isVisible, false);
  assert.equal(check.reason, "not_published");
});

test("audience ciblee (classe) vue par un anonyme : jamais visible", () => {
  const check = checkFlashVersionVisibility({
    status: "publiee",
    expiresAt: new Date("2026-09-05T18:00:00.000Z"),
    now: NOW,
    audience: [CLASSE_A],
    viewerGroupRefs: null,
  });
  assert.equal(check.isVisible, false);
  assert.equal(check.reason, "audience_not_authorized");
});

test("la meme audience ciblee vue par un membre identifie du groupe : visible", () => {
  const check = checkFlashVersionVisibility({
    status: "publiee",
    expiresAt: new Date("2026-09-05T18:00:00.000Z"),
    now: NOW,
    audience: [CLASSE_A],
    viewerGroupRefs: [CLASSE_A],
  });
  assert.equal(check.isVisible, true);
  assert.equal(check.reason, "visible");
});

test("une personne identifiee mais hors du groupe cible ne voit pas la version", () => {
  const check = checkFlashVersionVisibility({
    status: "publiee",
    expiresAt: new Date("2026-09-05T18:00:00.000Z"),
    now: NOW,
    audience: [CLASSE_A],
    viewerGroupRefs: [CLASSE_B],
  });
  assert.equal(check.isVisible, false);
  assert.equal(check.reason, "audience_not_authorized");
});

test("version corrigee puis version d'origine : seule la version publiee courante est visible, l'ancienne (modifiee) ne reapparait jamais", () => {
  const originalVersion = {
    id: "original",
    status: "modifiee",
    expiresAt: new Date("2026-09-05T18:00:00.000Z"),
    audience: [FLASH_PUBLIC_AUDIENCE_GROUP_REF],
  };
  const correctedVersion = {
    id: "corrigee",
    status: "publiee",
    expiresAt: new Date("2026-09-05T18:00:00.000Z"),
    audience: [FLASH_PUBLIC_AUDIENCE_GROUP_REF],
  };

  const visible = selectVisibleFlashVersions([originalVersion, correctedVersion], {
    now: NOW,
    viewerGroupRefs: null,
  });

  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, "corrigee");

  assert.equal(
    isFlashVersionVisible({
      status: originalVersion.status,
      expiresAt: originalVersion.expiresAt,
      now: NOW,
      audience: originalVersion.audience,
      viewerGroupRefs: null,
    }),
    false,
    "l'ancienne version reste modifiee, jamais publiee : elle ne redevient jamais visible"
  );
});

test("statut inconnu refuse", () => {
  assert.throws(
    () =>
      checkFlashVersionVisibility({
        status: "archivee",
        expiresAt: new Date("2026-09-05T18:00:00.000Z"),
        now: NOW,
        audience: [FLASH_PUBLIC_AUDIENCE_GROUP_REF],
        viewerGroupRefs: null,
      }),
    (error) => error instanceof FlashVisibilityError && error.reason === "status_invalid"
  );
});

test("dates invalides refusees", () => {
  assert.throws(
    () =>
      checkFlashVersionVisibility({
        status: "publiee",
        expiresAt: new Date("not-a-date"),
        now: NOW,
        audience: [FLASH_PUBLIC_AUDIENCE_GROUP_REF],
        viewerGroupRefs: null,
      }),
    (error) => error instanceof FlashVisibilityError && error.reason === "expires_at_invalid"
  );
  assert.throws(
    () =>
      checkFlashVersionVisibility({
        status: "publiee",
        expiresAt: new Date("2026-09-05T18:00:00.000Z"),
        now: "2026-09-05T12:00:00.000Z",
        audience: [FLASH_PUBLIC_AUDIENCE_GROUP_REF],
        viewerGroupRefs: null,
      }),
    (error) => error instanceof FlashVisibilityError && error.reason === "now_invalid"
  );
});

test("audience vide refusee : une version publiee a toujours au moins un groupe", () => {
  assert.throws(
    () =>
      checkFlashVersionVisibility({
        status: "publiee",
        expiresAt: new Date("2026-09-05T18:00:00.000Z"),
        now: NOW,
        audience: [],
        viewerGroupRefs: null,
      }),
    (error) => error instanceof FlashVisibilityError && error.reason === "audience_invalid"
  );
});

test("group_ref invalide dans viewerGroupRefs refuse", () => {
  assert.throws(
    () =>
      checkFlashVersionVisibility({
        status: "publiee",
        expiresAt: new Date("2026-09-05T18:00:00.000Z"),
        now: NOW,
        audience: [CLASSE_A],
        viewerGroupRefs: ["a@b"],
      }),
    (error) => error instanceof FlashVisibilityError && error.reason === "viewer_group_refs_invalid"
  );
});
