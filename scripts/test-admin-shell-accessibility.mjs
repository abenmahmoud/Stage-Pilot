import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layout = await readFile(
  new URL("../src/components/AppLayout.tsx", import.meta.url),
  "utf8"
);

test("provides a keyboard skip link to a focusable main landmark", () => {
  assert.match(layout, /href="#main-content"/u);
  assert.match(layout, />\s*Aller au contenu principal\s*<\/a>/u);
  assert.match(layout, /<main id="main-content" tabIndex=\{-1\}/u);
});

test("keeps the hidden mobile navigation outside the accessibility tree", () => {
  assert.match(layout, /id="mobile-navigation"/u);
  assert.match(layout, /role="dialog"/u);
  assert.match(layout, /aria-modal="true"/u);
  assert.match(layout, /aria-hidden=\{!open\}/u);
  assert.match(layout, /inert=\{!open\}/u);
});

test("announces the menu state and supports predictable keyboard closing", () => {
  assert.match(layout, /aria-expanded=\{open\}/u);
  assert.match(layout, /aria-controls="mobile-navigation"/u);
  assert.match(layout, /event\.key === "Escape"/u);
  assert.match(layout, /event\.key !== "Tab"/u);
  assert.match(layout, /querySelectorAll<HTMLElement>\("a\[href\], button:not\(\[disabled\]\)"\)/u);
  assert.match(layout, /mobileCloseButtonRef\.current\?\.focus\(\)/u);
  assert.match(layout, /mobileMenuButtonRef\.current\?\.focus\(\)/u);
  assert.match(layout, /closest\("a"\)\) closeMobileMenu\("main"\)/u);
  assert.match(layout, /document\.getElementById\("main-content"\)\?\.focus\(\)/u);
});

test("names the primary navigation for assistive technologies", () => {
  assert.match(layout, /<nav[\s\S]*?aria-label="Navigation principale"/u);
});
