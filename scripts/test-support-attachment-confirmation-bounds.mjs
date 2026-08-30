import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readBoundedBlobBytes } from "../shared/bounded-blob.ts";

const routeSource = readFileSync(
  new URL("../api/support/attachments/[id]/confirm.ts", import.meta.url),
  "utf8"
);

test("la confirmation utilise la lecture bornée avant toute copie mémoire", () => {
  assert.match(routeSource, /readBoundedBlobBytes\(file, Number\(attachment\.sizeBytes\), MAX_FILE_BYTES\)/);
  assert.doesNotMatch(routeSource, /file\.arrayBuffer\(\)/);
  assert.match(routeSource, /scanStatus = accepted \? "quarantine" : "blocked"/);
});

test("refuse une taille réelle excessive sans lire le Blob", async () => {
  let read = false;
  const blob = {
    size: 11,
    async arrayBuffer() {
      read = true;
      return new ArrayBuffer(11);
    },
  };
  await assert.rejects(() => readBoundedBlobBytes(blob, 11, 10), /bounded_blob_invalid/);
  assert.equal(read, false);
});

test("refuse un écart avec la réservation sans lire le Blob", async () => {
  let read = false;
  const blob = {
    size: 9,
    async arrayBuffer() {
      read = true;
      return new ArrayBuffer(9);
    },
  };
  await assert.rejects(() => readBoundedBlobBytes(blob, 10, 10), /bounded_blob_invalid/);
  assert.equal(read, false);
});

test("accepte uniquement une copie dont la longueur reste exacte", async () => {
  const valid = await readBoundedBlobBytes(new Blob([new Uint8Array(8)]), 8, 10);
  assert.equal(valid.byteLength, 8);

  const dishonestBlob = {
    size: 8,
    async arrayBuffer() {
      return new ArrayBuffer(9);
    },
  };
  await assert.rejects(
    () => readBoundedBlobBytes(dishonestBlob, 8, 10),
    /bounded_blob_invalid/
  );
});
