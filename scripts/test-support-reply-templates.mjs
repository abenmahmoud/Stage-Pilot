import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SUPPORT_REPLY_TEMPLATES,
  renderSupportReplyTemplate,
  supportTemplateVariables,
} from "../shared/support-reply-templates.ts";

test("renders only the approved support variables", () => {
  const rendered = renderSupportReplyTemplate(
    "Bonjour {{prenom}}, dossier {{numero}} : {{objet}}.",
    { prenom: "Samira", numero: "BC-2026-000001", objet: "Accès ENT" }
  );
  assert.equal(
    rendered,
    "Bonjour Samira, dossier BC-2026-000001 : Accès ENT."
  );
});

test("keeps an unknown placeholder visible instead of inventing a value", () => {
  const rendered = renderSupportReplyTemplate(
    "Bonjour {{prenom}} {{mot_de_passe}}",
    { prenom: "Yanis", numero: "BC-2026-000002", objet: "Ordinateur" }
  );
  assert.equal(rendered, "Bonjour Yanis {{mot_de_passe}}");
});

test("declares every variable used by the built-in templates", () => {
  for (const template of DEFAULT_SUPPORT_REPLY_TEMPLATES) {
    assert.deepEqual(
      supportTemplateVariables(template.bodyText).sort(),
      [...template.allowedVariables].sort()
    );
  }
});
