import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layout = await readFile(new URL("../src/components/AppLayout.tsx", import.meta.url), "utf8");
const roles = await readFile(new URL("../src/lib/types.ts", import.meta.url), "utf8");

test("offers one direct request queue link to every support role", () => {
  assert.match(
    layout,
    /const isSupportAgent = \["superadmin", "administration", "agent", "proviseur"\]\.includes/
  );
  const supportSection = layout.slice(
    layout.indexOf("{isSupportAgent && ("),
    layout.indexOf("{(isAdmin || isProviseur) && (")
  );
  assert.match(supportSection, /Espace agent/);
  assert.match(supportSection, /to="\/prototype\?view=agent"/);
  assert.match(supportSection, />\s*Demandes\s*</);
  assert.match(supportSection, /to="\/admin\/validations-agent"/);
  assert.equal((supportSection.match(/Espace agent/g) ?? []).length, 1);
});

test("keeps the scoped agent queue as the agent landing page", () => {
  assert.match(roles, /agent: "\/prototype\?view=agent"/);
});

test("keeps the shared navigation named and keyboard-managed", () => {
  assert.match(layout, /aria-label="Navigation principale"/);
  assert.match(layout, /if \(event\.key === "Escape"\)/);
  assert.match(layout, /querySelectorAll<HTMLElement>\("a\[href\], button:not\(\[disabled\]\)"\)/);
  assert.match(layout, /closeMobileMenu\("main"\)/);
});
