import assert from "node:assert/strict";
import { matchesSiteContentFileSignature } from "../shared/site-content-file-signature.ts";

const ascii = (value) => new TextEncoder().encode(value);
const concat = (...parts) => {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
};

const cases = [
  ["PDF valide", ascii("%PDF-1.7 exemple"), "application/pdf", true],
  ["faux PDF", ascii("MZ executable"), "application/pdf", false],
  ["PNG valide", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png", true],
  ["PNG tronqué", new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png", false],
  ["JPEG valide", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg", true],
  ["WEBP valide", ascii("RIFF0000WEBP"), "image/webp", true],
  [
    "DOCX valide",
    concat(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), ascii("[Content_Types].xml word/document.xml")),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    true,
  ],
  [
    "faux DOCX",
    concat(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), ascii("random.txt")),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    false,
  ],
  [
    "XLSX valide",
    concat(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), ascii("[Content_Types].xml xl/workbook.xml")),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    true,
  ],
  ["type inconnu", ascii("plain text"), "text/plain", false],
];

for (const [label, bytes, mime, expected] of cases) {
  assert.equal(matchesSiteContentFileSignature(bytes, mime), expected, label);
}

console.log(`site content file signature: ${cases.length}/${cases.length} tests passed`);
