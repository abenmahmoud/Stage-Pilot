import { createHash } from "node:crypto";

export const SCHEDULE_PDF_MAX_PAGES = 500;

export class ScheduleDocumentInspectionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ScheduleDocumentInspectionError";
    this.code = code;
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hasPdfSignature(bytes) {
  return bytes.subarray(0, Math.min(bytes.length, 1024)).includes(Buffer.from("%PDF-", "ascii"));
}

export async function inspectSchedulePdf(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 8) {
    throw new ScheduleDocumentInspectionError("invalid_pdf", "PDF vide ou illisible");
  }
  if (!hasPdfSignature(bytes)) {
    throw new ScheduleDocumentInspectionError("invalid_pdf_signature", "Signature PDF absente");
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });

  let document;
  try {
    document = await task.promise;
    if (!Number.isInteger(document.numPages) || document.numPages < 1) {
      throw new ScheduleDocumentInspectionError("invalid_pdf", "Le PDF ne contient aucune page");
    }
    if (document.numPages > SCHEDULE_PDF_MAX_PAGES) {
      throw new ScheduleDocumentInspectionError(
        "pdf_too_many_pages",
        `Le PDF dépasse la limite de ${SCHEDULE_PDF_MAX_PAGES} pages`
      );
    }
    return {
      checksum: sha256(bytes),
      pageCount: document.numPages,
      method: "pdfjs",
    };
  } catch (error) {
    if (error instanceof ScheduleDocumentInspectionError) throw error;
    throw new ScheduleDocumentInspectionError("invalid_pdf", "Structure PDF invalide");
  } finally {
    if (document) await document.destroy();
    else await task.destroy().catch(() => undefined);
  }
}
