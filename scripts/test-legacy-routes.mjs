import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const inventory = JSON.parse(await readFile(new URL("../content/legacy-site/inventory.json", import.meta.url), "utf8"));
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

test("normalise les anciennes adresses qui se terminent par une barre oblique", () => {
  assert.equal(vercel.trailingSlash, false);
});

test("conserve une destination pour chaque ancienne page WordPress", () => {
  const redirects = new Map(vercel.redirects.map((redirect) => [redirect.source, redirect.destination]));
  const missing = [];

  for (const item of inventory.contents) {
    const pathname = new URL(item.sourceUrl).pathname.replace(/\/+$/, "") || "/";
    if (pathname === "/") continue;
    const expected = `/site/${item.slug}`;
    if (redirects.get(pathname) !== expected) {
      missing.push({ source: pathname, expected, actual: redirects.get(pathname) ?? null });
    }
  }

  assert.deepEqual(missing, []);
});
