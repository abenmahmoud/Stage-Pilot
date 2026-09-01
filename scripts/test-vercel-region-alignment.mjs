import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

test("runs server functions next to the Paris preview database", () => {
  assert.deepEqual(config.regions, ["cdg1"]);
});
