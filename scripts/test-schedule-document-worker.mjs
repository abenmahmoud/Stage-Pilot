import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  inspectSchedulePdf,
  ScheduleDocumentInspectionError,
} from "../workers/schedule-document-inspector.mjs";

function minimalPdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

test("counts pages and hashes a structurally valid fictional PDF", async () => {
  const result = await inspectSchedulePdf(minimalPdf());
  assert.equal(result.pageCount, 1);
  assert.equal(result.method, "pdfjs");
  assert.match(result.checksum, /^[a-f0-9]{64}$/);
});

test("rejects a file that only claims the PDF MIME type", async () => {
  await assert.rejects(
    inspectSchedulePdf(Buffer.from("not a pdf", "utf8")),
    (error) => error instanceof ScheduleDocumentInspectionError && error.code === "invalid_pdf_signature"
  );
});

test("rejects a malformed file even when its header starts with PDF", async () => {
  await assert.rejects(
    inspectSchedulePdf(Buffer.from("%PDF-1.7\ninvalid", "ascii")),
    (error) => error instanceof ScheduleDocumentInspectionError && error.code === "invalid_pdf"
  );
});

test("worker scans before inspection and never calls an AI provider", async () => {
  const [worker, service] = await Promise.all([
    readFile(new URL("../workers/schedule-document-worker.mjs", import.meta.url), "utf8"),
    readFile(new URL("../deploy/lycee-schedule-document-worker.service", import.meta.url), "utf8"),
  ]);
  assert.match(worker, /clamdscan/);
  assert.ok(worker.indexOf("await clamScan") < worker.indexOf("await inspectSchedulePdf"));
  assert.match(worker, /status = 'review'/);
  assert.match(worker, /page_count = \$\{result\.pageCount\}/);
  assert.match(worker, /pgmq\.delete\('schedule_document_scan'/);
  assert.match(worker, /pgmq\.archive\('schedule_document_scan'/);
  assert.match(worker, /objectDeleted: true/);
  assert.doesNotMatch(worker, /openai|anthropic|generativelanguage|api\.mistral/i);
  assert.match(service, /User=lycee-support/);
  assert.match(service, /PrivateTmp=true/);
  assert.match(service, /MemoryMax=768M/);
});
