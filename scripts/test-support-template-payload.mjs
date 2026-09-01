import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isSupportReplyTemplatePayload,
  isSupportTemplateCreatePayload,
  isSupportTemplateListPayload,
  projectSupportReplyTemplatePayload,
  SUPPORT_TEMPLATE_LIST_LIMIT,
} from "../shared/support-template-payload-policy.ts";
import { DEFAULT_SUPPORT_REPLY_TEMPLATES } from "../shared/support-reply-templates.ts";

const template = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  category: "all",
  name: "Prise en charge",
  bodyText: "Bonjour {{prenom}}",
  allowedVariables: ["prenom"],
  builtIn: false,
};

test("accepts only exact bounded templates and envelopes", () => {
  assert.equal(isSupportReplyTemplatePayload(template), true);
  assert.equal(isSupportTemplateCreatePayload({ template }), true);
  assert.equal(isSupportTemplateListPayload({ templates: [template] }), true);
  assert.equal(isSupportReplyTemplatePayload({ ...template, createdBy: "hidden" }), false);
  assert.equal(isSupportReplyTemplatePayload({ ...template, builtIn: undefined }), false);
  assert.equal(isSupportTemplateCreatePayload({ template, active: true }), false);
  assert.equal(isSupportTemplateListPayload({ templates: [template, template] }), false);
  assert.equal(isSupportTemplateListPayload({ templates: Array.from({ length: SUPPORT_TEMPLATE_LIST_LIMIT + 1 }, (_, index) => ({ ...template, id: `builtin:${index}` })) }), false);
});

test("projects database rows to the six public fields at runtime", () => {
  const projected = projectSupportReplyTemplatePayload({
    ...template,
    builtIn: undefined,
    active: true,
    createdBy: "hidden",
    updatedAt: new Date(),
  }, false);
  assert.deepEqual(projected, template);
  assert.deepEqual(Object.keys(projected).sort(), [
    "allowedVariables",
    "bodyText",
    "builtIn",
    "category",
    "id",
    "name",
  ]);
  assert.equal(isSupportTemplateCreatePayload({ template: projected }), true);
});

test("derives the saved capacity from the built-in catalog", async () => {
  assert.ok(DEFAULT_SUPPORT_REPLY_TEMPLATES.length < SUPPORT_TEMPLATE_LIST_LIMIT);
  const atLimit = [
    ...DEFAULT_SUPPORT_REPLY_TEMPLATES,
    ...Array.from(
      { length: SUPPORT_TEMPLATE_LIST_LIMIT - DEFAULT_SUPPORT_REPLY_TEMPLATES.length },
      (_, index) => ({ ...template, id: `saved:${index}` })
    ),
  ];
  assert.equal(isSupportTemplateListPayload({ templates: atLimit }), true);

  const route = await readFile("api/support/agent/templates.ts", "utf8");
  assert.match(route, /SUPPORT_TEMPLATE_LIST_LIMIT - DEFAULT_SUPPORT_REPLY_TEMPLATES\.length/);
  assert.match(route, /pg_advisory_xact_lock/);
  assert.match(route, /activeTemplates >= MAX_SAVED_TEMPLATES/);
  assert.doesNotMatch(route, /\.select\(\)/);
  assert.doesNotMatch(route, /\.returning\(\)/);
  assert.match(route, /templateCreatePayload\(templatePayload\(created, false\)\)/);
  assert.match(route, /return templateListPayload\(\[/);
  assert.match(route, /\.limit\(MAX_SAVED_TEMPLATES \+ 1\)/);
  assert.match(route, /saved\.length > MAX_SAVED_TEMPLATES/);
});

test("uses the shared runtime policy in the browser", async () => {
  const page = await readFile("src/pages/prototype/LyceeConnectPrototype.tsx", "utf8");
  assert.match(page, /support-template-payload-policy/);
  assert.match(page, /isSupportTemplateListPayload\(payload\)/);
  assert.match(page, /isSupportTemplateCreatePayload\(payload\)/);
});
