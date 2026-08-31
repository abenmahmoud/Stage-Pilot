import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const recipe = readFileSync(
  new URL("./test-preview-support-create-request-action.mjs", import.meta.url),
  "utf8"
);
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("locks the action recipe to the isolated Supabase preview", () => {
  assert.match(recipe, /--preview-only/);
  assert.match(recipe, /EXPECTED_PROJECT_REF/);
  assert.match(recipe, /PRODUCTION_SUPABASE_REF/);
  assert.doesNotMatch(recipe, /--prod|vercel\s+env|SUPABASE_DB_PASSWORD/);
});

test("uses only fictional fixture values and a reserved contact domain", () => {
  assert.match(recipe, /\[TEST\] Création de demande ENT/);
  assert.match(recipe, /@example\.test/);
  assert.match(recipe, /entièrement fictive/i);
  assert.doesNotMatch(recipe, /@ac-creteil\.fr|@gmail\.com|admin93/);
});

test("activates the feature only inside an explicitly authorized recipe process", () => {
  assert.match(recipe, /process\.env\.SUPPORT_AGENT_CREATE_REQUEST_ACTION_ENABLED = "true"/);
  assert.match(recipe, /VERCEL_ENV === "preview"/);
  assert.match(recipe, /PREVIEW_ACTION_RECIPE_AUTHORIZED === "true"/);
  assert.doesNotMatch(
    recipe,
    /spawn|exec|fetch\(|Invoke-RestMethod|vercel\s+(?:env|deploy|api)/i
  );
});

test("rolls back action and request data and verifies zero residue", () => {
  assert.match(recipe, /throw ROLLBACK_RECIPE/);
  assert.match(recipe, /assert\.equal\(rolledBack, true/);
  assert.match(recipe, /assert\.deepEqual\(after, \{ skills: 0, sources: 0, actions: 0, requests: 0 \}\)/);
});

test("keeps the real recipe outside the permanent security gate", () => {
  assert.match(packageJson.scripts["test:preview-support-create-request-action"], /--preview-only/);
  assert.match(
    packageJson.scripts["test:preview-security-gate"],
    /test:preview-support-create-request-action-safety/
  );
  assert.doesNotMatch(
    packageJson.scripts["test:preview-security-gate"],
    /test:preview-support-create-request-action(?:\s|&&|$)/
  );
});
