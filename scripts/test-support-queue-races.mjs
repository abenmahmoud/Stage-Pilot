import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");

test("ignores a queue response superseded by a newer request", () => {
  assert.match(page, /const queueLoadIdRef = useRef\(0\)/);
  assert.match(page, /const loadId = \+\+queueLoadIdRef\.current/);
  assert.equal((page.match(/if \(loadId !== queueLoadIdRef\.current\) return;/g) ?? []).length, 2);
});

test("updates the selected request reference before loading its detail", () => {
  assert.match(page, /selectedCodeRef\.current = nextCode;[\s\S]*setSelectedCode\(nextCode\)/);
  assert.match(page, /selectedCodeRef\.current = selectedCode;[\s\S]*const code = selectedCode/);
});

test("ignores stale detail successes and failures", () => {
  assert.equal((page.match(/if \(selectedCodeRef\.current !== code\) return;/g) ?? []).length >= 3, true);
  assert.match(page, /apiFetch<unknown>\(`support\/agent\/requests\/\$\{code\}`\)/);
});
