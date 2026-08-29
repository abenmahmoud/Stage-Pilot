import { createHash } from "node:crypto";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import yauzl from "yauzl";
import { documentSecretSignals } from "./knowledge-document-secret-policy.mjs";

export const KNOWLEDGE_EXTRACTED_TEXT_MAX_CHARS = 120_000;
const KNOWLEDGE_PDF_MAX_PAGES = 200;
const KNOWLEDGE_ZIP_MAX_ENTRIES = 2_000;
const KNOWLEDGE_ZIP_MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const KNOWLEDGE_SHEET_MAX_ROWS = 25_000;
const KNOWLEDGE_SHEET_MAX_COLUMNS = 100;

export class KnowledgeDocumentExtractionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "KnowledgeDocumentExtractionError";
    this.code = code;
  }
}

function checksum(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizedText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function boundedText(value) {
  const text = normalizedText(value);
  return {
    text: text.slice(0, KNOWLEDGE_EXTRACTED_TEXT_MAX_CHARS),
    characters: text.length,
    truncated: text.length > KNOWLEDGE_EXTRACTED_TEXT_MAX_CHARS,
  };
}

export function documentPrivacySignals(value) {
  const text = String(value ?? "");
  const signals = [];
  if (/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(text)) signals.push("email_address");
  if (/(?:\+33|0)[1-9](?:[ .()-]*\d{2}){4}\b/.test(text)) signals.push("phone_number");
  signals.push(...documentSecretSignals(text));
  if (/\b(?:ine|num[ée]ro national [ée]l[èe]ve)\b/i.test(text)) signals.push("student_identifier");
  return signals;
}

function preflightZip(bytes) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(bytes, {
      lazyEntries: true,
      decodeStrings: true,
      validateEntrySizes: true,
    }, (error, archive) => {
      if (error || !archive) {
        reject(new KnowledgeDocumentExtractionError("invalid_archive", "Archive bureautique illisible"));
        return;
      }
      let entries = 0;
      let uncompressedBytes = 0;
      let settled = false;
      const fail = (code, message) => {
        if (settled) return;
        settled = true;
        archive.close();
        reject(new KnowledgeDocumentExtractionError(code, message));
      };
      archive.on("error", () => fail("invalid_archive", "Archive bureautique invalide"));
      archive.on("entry", (entry) => {
        entries += 1;
        uncompressedBytes += Number(entry.uncompressedSize ?? 0);
        if (entries > KNOWLEDGE_ZIP_MAX_ENTRIES) {
          fail("archive_too_many_entries", "Le document contient trop de fichiers internes");
          return;
        }
        if (uncompressedBytes > KNOWLEDGE_ZIP_MAX_UNCOMPRESSED_BYTES) {
          fail("archive_too_large", "Le document décompressé dépasse la limite autorisée");
          return;
        }
        archive.readEntry();
      });
      archive.on("end", () => {
        if (settled) return;
        settled = true;
        resolve({ entries, uncompressedBytes });
      });
      archive.readEntry();
    });
  });
}

async function extractPdf(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const document = await task.promise;
  try {
    if (document.numPages > KNOWLEDGE_PDF_MAX_PAGES) {
      throw new KnowledgeDocumentExtractionError("pdf_too_many_pages", "Le PDF contient trop de pages");
    }
    const pages = [];
    let acceptedCharacters = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => (item && typeof item === "object" && "str" in item ? item.str : ""))
        .join(" ");
      pages.push(text);
      acceptedCharacters += text.length;
      page.cleanup();
      if (acceptedCharacters > KNOWLEDGE_EXTRACTED_TEXT_MAX_CHARS * 2) break;
    }
    return { value: pages.join("\n\n"), method: "pdfjs", pages: document.numPages };
  } finally {
    await document.destroy();
  }
}

async function extractDocx(bytes) {
  const archive = await preflightZip(bytes);
  const result = await mammoth.extractRawText({ buffer: bytes });
  return {
    value: result.value,
    method: "mammoth",
    archive,
    warnings: result.messages.length,
  };
}

async function extractWorkbook(bytes) {
  const archive = await preflightZip(bytes);
  const workbook = XLSX.read(bytes, {
    type: "buffer",
    raw: false,
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellDates: false,
    bookVBA: false,
  });
  if (workbook.SheetNames.length > 20) {
    throw new KnowledgeDocumentExtractionError("too_many_sheets", "Le classeur contient trop de feuilles");
  }
  const sheets = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = sheet?.["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
    if (range) {
      const rows = range.e.r - range.s.r + 1;
      const columns = range.e.c - range.s.c + 1;
      if (rows > KNOWLEDGE_SHEET_MAX_ROWS || columns > KNOWLEDGE_SHEET_MAX_COLUMNS) {
        throw new KnowledgeDocumentExtractionError(
          "workbook_dimensions_exceeded",
          "Une feuille dépasse les dimensions autorisées"
        );
      }
    }
    sheets.push(`# ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet, { blankrows: false })}`);
  }
  return { value: sheets.join("\n\n"), method: "sheetjs", sheets: workbook.SheetNames.length, archive };
}

function extractTextFile(bytes) {
  let value;
  try {
    value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new KnowledgeDocumentExtractionError("invalid_text_encoding", "Le fichier texte doit être en UTF-8");
  }
  return { value, method: "utf8" };
}

function manualResult(bytes, reason, metadata = {}) {
  return {
    checksum: checksum(bytes),
    summary: {
      state: "manual_review",
      reason,
      extractedCharacters: 0,
      truncated: false,
      ...metadata,
    },
    proposedKnowledge: {
      schemaVersion: 1,
      state: "manual_review",
      reason,
      extractedText: null,
      privacySignals: [],
    },
  };
}

export async function extractKnowledgeDocument({ bytes, mimeType, classification }) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1) {
    throw new KnowledgeDocumentExtractionError("invalid_buffer", "Document illisible");
  }
  if (["personal", "sensitive"].includes(classification)) {
    return manualResult(bytes, "sensitive_classification");
  }

  let extracted;
  if (mimeType === "application/pdf") extracted = await extractPdf(bytes);
  else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    extracted = await extractDocx(bytes);
  } else if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    extracted = await extractWorkbook(bytes);
  } else if (["text/plain", "text/csv"].includes(mimeType)) extracted = extractTextFile(bytes);
  else if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    return manualResult(bytes, "presentation_manual_review");
  } else if (["image/jpeg", "image/png"].includes(mimeType)) {
    return manualResult(bytes, "image_manual_review");
  } else {
    throw new KnowledgeDocumentExtractionError("unsupported_mime", "Format documentaire non pris en charge");
  }

  const bounded = boundedText(extracted.value);
  if (!bounded.text) return manualResult(bytes, "no_extractable_text", { method: extracted.method });
  const privacySignals = documentPrivacySignals(bounded.text);
  if (privacySignals.length > 0) {
    return {
      ...manualResult(bytes, "privacy_signal_detected", { method: extracted.method }),
      proposedKnowledge: {
        schemaVersion: 1,
        state: "manual_review",
        reason: "privacy_signal_detected",
        extractedText: null,
        privacySignals,
      },
    };
  }

  return {
    checksum: checksum(bytes),
    summary: {
      state: "extracted",
      method: extracted.method,
      extractedCharacters: bounded.characters,
      storedCharacters: bounded.text.length,
      truncated: bounded.truncated,
      pages: extracted.pages ?? null,
      sheets: extracted.sheets ?? null,
      warnings: extracted.warnings ?? 0,
    },
    proposedKnowledge: {
      schemaVersion: 1,
      state: "extracted",
      extractedText: bounded.text,
      privacySignals: [],
      truncated: bounded.truncated,
    },
  };
}
