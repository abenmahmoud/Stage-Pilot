import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  isExpectedSchedulePageAssetPath,
  schedulePageAssetStoragePath,
} from "../shared/schedule-page-asset.mjs";
import { inspectSchedulePdf } from "../workers/schedule-document-inspector.mjs";
import {
  extractSchedulePageAssets,
  SchedulePageAssetError,
} from "../workers/schedule-page-assets.mjs";

const INSTITUTION_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const workerRequire = createRequire(new URL("../workers/package.json", import.meta.url));

function fictionalTwoPagePdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
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

test("creates exactly one valid PDF per fictional source page", async () => {
  const assets = [];
  for await (const asset of extractSchedulePageAssets(fictionalTwoPagePdf(), 2)) {
    assets.push(asset);
  }
  assert.equal(assets.length, 2);
  assert.deepEqual(assets.map((asset) => asset.pageNumber), [1, 2]);
  for (const asset of assets) {
    assert.equal((await inspectSchedulePdf(asset.bytes)).pageCount, 1);
    assert.match(asset.checksum, /^[a-f0-9]{64}$/);
    assert.equal(asset.sizeBytes, asset.bytes.length);
  }
});

test("removes annotations and additional actions from generated pages", async () => {
  const { PDFDocument, PDFName, PDFString } = workerRequire("pdf-lib");
  const document = await PDFDocument.create();
  const sourcePage = document.addPage([612, 792]);
  sourcePage.node.set(PDFName.of("AA"), document.context.obj({ O: PDFString.of("action") }));
  sourcePage.node.set(PDFName.of("Annots"), document.context.obj([]));
  const source = Buffer.from(await document.save());

  const assets = [];
  for await (const asset of extractSchedulePageAssets(source, 1)) assets.push(asset);
  const generated = await PDFDocument.load(assets[0].bytes);
  const page = generated.getPage(0);
  assert.equal(page.node.has(PDFName.of("AA")), false);
  assert.equal(page.node.has(PDFName.of("Annots")), false);
});

test("fails closed when the verified page count changes", async () => {
  await assert.rejects(
    async () => {
      for await (const _asset of extractSchedulePageAssets(fictionalTwoPagePdf(), 1)) {
        // Iteration triggers the guarded load and count comparison.
      }
    },
    (error) => error instanceof SchedulePageAssetError && error.code === "page_count_changed"
  );
});

test("derives an opaque deterministic path and rejects another scope", () => {
  const path = schedulePageAssetStoragePath(INSTITUTION_ID, SOURCE_ID, 7);
  assert.equal(
    path,
    `page-assets/${INSTITUTION_ID}/${SOURCE_ID}/0007.pdf`
  );
  assert.equal(
    isExpectedSchedulePageAssetPath(path, INSTITUTION_ID, SOURCE_ID, 7),
    true
  );
  assert.equal(
    isExpectedSchedulePageAssetPath(path, INSTITUTION_ID, SOURCE_ID, 8),
    false
  );
  assert.doesNotMatch(path, /student|teacher|class|email/i);
});
