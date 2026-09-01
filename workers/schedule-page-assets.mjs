import { createHash } from "node:crypto";
import { PDFDocument, PDFName } from "pdf-lib";
import { SCHEDULE_PDF_MAX_PAGES } from "./schedule-document-inspector.mjs";

export const SCHEDULE_PAGE_ASSET_MAX_BYTES = 12 * 1024 * 1024;
export const SCHEDULE_PAGE_ASSETS_TOTAL_MAX_BYTES = 100 * 1024 * 1024;

export class SchedulePageAssetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SchedulePageAssetError";
    this.code = code;
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function* extractSchedulePageAssets(bytes, expectedPageCount) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 8) {
    throw new SchedulePageAssetError("invalid_pdf", "PDF vide ou illisible");
  }
  if (
    !Number.isInteger(expectedPageCount)
    || expectedPageCount < 1
    || expectedPageCount > SCHEDULE_PDF_MAX_PAGES
  ) {
    throw new SchedulePageAssetError("invalid_page_count", "Nombre de pages invalide");
  }

  let source;
  try {
    source = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      parseSpeed: 100,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
  } catch {
    throw new SchedulePageAssetError("page_split_failed", "Découpage PDF impossible");
  }
  if (source.getPageCount() !== expectedPageCount) {
    throw new SchedulePageAssetError("page_count_changed", "Le comptage PDF a changé");
  }

  let totalBytes = 0;
  for (let index = 0; index < expectedPageCount; index += 1) {
    const target = await PDFDocument.create();
    const [page] = await target.copyPages(source, [index]);
    page.node.delete(PDFName.of("AA"));
    page.node.delete(PDFName.of("Annots"));
    target.addPage(page);
    const output = Buffer.from(await target.save({
      addDefaultPage: false,
      objectsPerTick: 50,
      updateFieldAppearances: false,
      useObjectStreams: true,
    }));
    if (output.length < 1 || output.length > SCHEDULE_PAGE_ASSET_MAX_BYTES) {
      throw new SchedulePageAssetError("page_asset_too_large", "Une page PDF dépasse la limite");
    }
    totalBytes += output.length;
    if (totalBytes > SCHEDULE_PAGE_ASSETS_TOTAL_MAX_BYTES) {
      throw new SchedulePageAssetError(
        "page_assets_too_large",
        "Les pages PDF dépassent la limite totale"
      );
    }
    yield {
      pageNumber: index + 1,
      bytes: output,
      checksum: sha256(output),
      sizeBytes: output.length,
    };
  }
}
