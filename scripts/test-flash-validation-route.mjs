// T071E (LOT 5 du plan de publication publique) : la porte de l'écran de
// validation des informations flash doit reposer sur le service réellement
// accordé, jamais sur le rôle applicatif. Ce script teste la fonction pure
// `decideFlashValidationRoute` (shared/flash-validation-route.ts) qui décide
// quoi afficher, puis vérifie par lecture de src/App.tsx que la route
// `/admin/informations-flash/valider` appelle bien cette fonction avec la
// réponse de `GET /api/flash/validation/screen-access`, sans jamais retomber
// sur `RoleRoute`/`CONTENT_MANAGER_ROLES` ni recalculer une règle de rôle.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { decideFlashValidationRoute } from "../shared/flash-validation-route.ts";

const ROLE_HOME = {
  superadmin: "/admin",
  administration: "/stages",
  agent: "/prototype?view=agent",
  pp: "/stages",
  professeur: "/stages",
  proviseur: "/grand-oral",
  eleve: "/stages/mon-stage",
};

test("attend pendant le chargement de l'authentification, avant même de regarder l'accès", () => {
  const decision = decideFlashValidationRoute({
    user: { role: "administration" },
    authLoading: true,
    access: { status: "checked", allowed: true },
    roleHome: ROLE_HOME,
  });
  assert.deepEqual(decision, { kind: "wait" });
});

test("renvoie au login quand personne n'est connecté", () => {
  const decision = decideFlashValidationRoute({
    user: null,
    authLoading: false,
    access: { status: "loading" },
    roleHome: ROLE_HOME,
  });
  assert.deepEqual(decision, { kind: "redirect", to: "/login?mode=staff" });
});

test("attend la réponse du serveur avant de décider quoi que ce soit", () => {
  const decision = decideFlashValidationRoute({
    user: { role: "administration" },
    authLoading: false,
    access: { status: "loading" },
    roleHome: ROLE_HOME,
  });
  assert.deepEqual(decision, { kind: "wait" });
});

test("un compte administration sans le service n'a plus accès à l'écran", () => {
  const decision = decideFlashValidationRoute({
    user: { role: "administration" },
    authLoading: false,
    access: { status: "checked", allowed: false },
    roleHome: ROLE_HOME,
  });
  assert.deepEqual(decision, { kind: "redirect", to: "/stages" });
});

test("un compte proviseur sans le service est renvoyé vers son propre accueil, pas un accueil générique", () => {
  const decision = decideFlashValidationRoute({
    user: { role: "proviseur" },
    authLoading: false,
    access: { status: "checked", allowed: false },
    roleHome: ROLE_HOME,
  });
  assert.deepEqual(decision, { kind: "redirect", to: "/grand-oral" });
});

test("un compte avec le service (quel que soit son rôle) accède à l'écran", () => {
  for (const role of ["administration", "proviseur", "superadmin", "professeur"]) {
    const decision = decideFlashValidationRoute({
      user: { role },
      authLoading: false,
      access: { status: "checked", allowed: true },
      roleHome: ROLE_HOME,
    });
    assert.deepEqual(decision, { kind: "render" }, `rôle ${role}`);
  }
});

test("la porte de l'écran (App.tsx) appelle la décision serveur, jamais un rôle recalculé côté client", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /import \{ apiFetch \} from "\.\/lib\/api"/);
  assert.match(
    app,
    /import \{\s*decideFlashValidationRoute,\s*type FlashValidationScreenAccessState,\s*\} from "\.\.\/shared\/flash-validation-route"/
  );
  assert.match(app, /function FlashValidationRoute/);
  assert.match(app, /apiFetch<unknown>\("flash\/validation\/screen-access"\)/);
  assert.match(app, /isValidFlashValidationScreenAccessPayload\(payload\)/);
  assert.match(app, /setAccess\(\{ status: "checked", allowed: false \}\)/);
  assert.match(
    app,
    /path="admin\/informations-flash\/valider"[\s\S]{0,120}<FlashValidationRoute>[\s\S]{0,40}<FlashValidationPage \/>[\s\S]{0,40}<\/FlashValidationRoute>/
  );
  assert.doesNotMatch(
    app,
    /path="admin\/informations-flash\/valider"[\s\S]{0,200}RoleRoute/
  );
});
