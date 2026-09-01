import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import {
  inspectSupportOfficeArchive,
  SupportOfficeArchiveError,
} from "../workers/support-office-archive-policy.mjs";

const workerRequire = createRequire(new URL("../workers/package.json", import.meta.url));
const JSZip = workerRequire("jszip");
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function contentTypes(mainEntry, contentType) {
  return `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/${mainEntry}" ContentType="${contentType}"/></Types>`;
}

function relationships(mainEntry) {
  return `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${mainEntry}"/></Relationships>`;
}

function docxEntries() {
  return [
    ["[Content_Types].xml", contentTypes(
      "word/document.xml",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
    )],
    ["_rels/.rels", relationships("word/document.xml")],
    ["word/document.xml", "<w:document/>"],
  ];
}

function xlsxEntries() {
  return [
    ["[Content_Types].xml", contentTypes(
      "xl/workbook.xml",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
    )],
    ["_rels/.rels", relationships("xl/workbook.xml")],
    ["xl/workbook.xml", "<workbook/>"],
  ];
}

async function archive(entries) {
  const zip = new JSZip();
  for (const [name, value] of entries) zip.file(name, value);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error instanceof SupportOfficeArchiveError, true);
    assert.equal(error.code, code);
    return true;
  });
}

test("accepts bounded DOCX and XLSX structures and ignores non-office files", async () => {
  const docx = await archive(docxEntries());
  const xlsx = await archive(xlsxEntries());

  const docxResult = await inspectSupportOfficeArchive({
    bytes: docx,
    name: "aide.docx",
    mimeType: DOCX_MIME,
  });
  assert.equal(docxResult.checked, true);
  assert.equal(docxResult.kind, "docx");
  assert.ok(docxResult.entries >= 3);
  assert.ok(docxResult.uncompressedBytes > 0);

  const textResult = await inspectSupportOfficeArchive({
    bytes: Buffer.from("texte"),
    name: "note.txt",
    mimeType: "text/plain",
  });
  assert.equal(textResult.checked, false);

  const xlsxResult = await inspectSupportOfficeArchive({
    bytes: xlsx,
    name: "liste.xlsx",
    mimeType: "application/octet-stream",
  });
  assert.equal(xlsxResult.kind, "xlsx");
});

test("rejects a generic ZIP and contradictory office types", async () => {
  const genericZip = await archive([["readme.txt", "not an office document"]]);
  const fakeDocx = await archive([
    ["[Content_Types].xml", "<Types/>"],
    ["_rels/.rels", "<Relationships/>"],
    ["word/document.xml", "<w:document/>"],
  ]);
  const docx = await archive(docxEntries());

  await expectCode(
    inspectSupportOfficeArchive({ bytes: genericZip, name: "faux.docx", mimeType: DOCX_MIME }),
    "office_archive_missing_parts"
  );
  await expectCode(
    inspectSupportOfficeArchive({ bytes: fakeDocx, name: "faux.docx", mimeType: DOCX_MIME }),
    "office_content_type_mismatch"
  );
  await expectCode(
    inspectSupportOfficeArchive({ bytes: docx, name: "faux.docx", mimeType: XLSX_MIME }),
    "office_type_mismatch"
  );
});

test("rejects active content and excessive archive entries", async () => {
  const activeDocx = await archive([
    ...docxEntries(),
    ["word/vbaProject.bin", "active"],
  ]);
  const excessiveEntries = docxEntries();
  for (let index = 0; index < 1_000; index += 1) {
    excessiveEntries.push([`word/media/item-${index}.txt`, "x"]);
  }

  await expectCode(
    inspectSupportOfficeArchive({ bytes: activeDocx, name: "macro.docx", mimeType: DOCX_MIME }),
    "active_office_content"
  );
  await expectCode(
    inspectSupportOfficeArchive({
      bytes: await archive(excessiveEntries),
      name: "enorme.docx",
      mimeType: DOCX_MIME,
    }),
    "office_archive_too_many_entries"
  );
});

test("keeps ClamAV and office validation before promotion to clean storage", async () => {
  const worker = await readFile(new URL("../workers/support-file-worker.mjs", import.meta.url), "utf8");
  const clamIndex = worker.indexOf("await clamScan(file.bytes, file.name)");
  const officeIndex = worker.indexOf("await inspectSupportOfficeArchive");
  const cleanIndex = worker.indexOf('.from("support-clean")');

  assert.ok(clamIndex >= 0);
  assert.ok(officeIndex > clamIndex);
  assert.ok(cleanIndex > officeIndex);
  assert.match(worker, /set scan_status = 'blocked', scan_detail = \$\{detail\}/);
});
