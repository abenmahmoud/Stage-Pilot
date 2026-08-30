import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url),
  "utf8"
);

test("keeps detail failures separate from queue and action failures", () => {
  assert.match(source, /const \[detailLoadError, setDetailLoadError\] = useState<string \| null>\(null\)/);
  assert.match(source, /const agentError = queueLoadError \?\? detailLoadError \?\? error/);
});

test("ignores stale detail reads for the same or another selection", () => {
  assert.match(source, /const detailLoadIdRef = useRef\(0\)/);
  assert.match(source, /loadId !== detailLoadIdRef\.current \|\| selectedCodeRef\.current !== code/);
  assert.match(source, /detailLoadIdRef\.current \+= 1/);
});

test("offers a bounded retry only for ordinary detail failures", () => {
  assert.match(source, /detailLoadError && selectedCode \?/);
  assert.match(source, /onClick=\{\(\) => void loadDetail\(selectedCode\)\}/);
  assert.match(source, /"Réessayer le dossier"/);
  const security = source.indexOf("needsAgentSecurity ?");
  const retry = source.indexOf("detailLoadError && selectedCode ?");
  assert.ok(security !== -1 && security < retry);
});
