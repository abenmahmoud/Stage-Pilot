import { createHash } from "node:crypto";
import { DOMParser } from "@xmldom/xmldom";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import yauzl from "yauzl";
import {
  buildKnowledgeReviewProposal,
  documentInstructionSignals,
} from "./knowledge-document-proposal.mjs";
import { documentSecretSignals } from "./knowledge-document-secret-policy.mjs";

export const KNOWLEDGE_EXTRACTED_TEXT_MAX_CHARS = 120_000;
const KNOWLEDGE_PDF_MAX_PAGES = 200;
const KNOWLEDGE_ZIP_MAX_ENTRIES = 2_000;
const KNOWLEDGE_ZIP_MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const KNOWLEDGE_SHEET_MAX_ROWS = 25_000;
const KNOWLEDGE_SHEET_MAX_COLUMNS = 100;
const KNOWLEDGE_PRESENTATION_MAX_SLIDES = 300;
const KNOWLEDGE_PRESENTATION_MAX_XML_BYTES = 5 * 1024 * 1024;
const KNOWLEDGE_PRESENTATION_MAX_TOTAL_XML_BYTES = 40 * 1024 * 1024;
const DRAWINGML_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/main";

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
        if ((entry.generalPurposeBitFlag & 1) !== 0) {
          fail("encrypted_archive", "Les archives bureautiques chiffrées sont interdites");
          return;
        }
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

function readPresentationXmlEntries(bytes) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      bytes,
      {
        lazyEntries: true,
        decodeStrings: true,
        validateEntrySizes: true,
      },
      (error, archive) => {
        if (error || !archive) {
          reject(
            new KnowledgeDocumentExtractionError(
              "invalid_archive",
              "Présentation illisible"
            )
          );
          return;
        }

        const entries = [];
        const requiredEntries = new Set();
        const seenTextEntries = new Set();
        let slideCount = 0;
        let noteCount = 0;
        let totalXmlBytes = 0;
        let settled = false;
        const fail = (code, message) => {
          if (settled) return;
          settled = true;
          archive.close();
          reject(new KnowledgeDocumentExtractionError(code, message));
        };

        archive.on("error", () => fail("invalid_archive", "Présentation invalide"));
        archive.on("entry", (entry) => {
          if (settled) return;
          if (["[Content_Types].xml", "ppt/presentation.xml"].includes(entry.fileName)) {
            requiredEntries.add(entry.fileName);
          }

          const match = entry.fileName.match(
            /^ppt\/(slides\/slide|notesSlides\/notesSlide)(\d+)\.xml$/u
          );
          if (!match) {
            archive.readEntry();
            return;
          }
          if (seenTextEntries.has(entry.fileName)) {
            fail(
              "duplicate_presentation_entry",
              "La présentation contient une entrée dupliquée"
            );
            return;
          }
          seenTextEntries.add(entry.fileName);

          const kind = match[1].startsWith("slides/") ? "slide" : "note";
          const number = Number(match[2]);
          if (!Number.isInteger(number) || number < 1) {
            fail("invalid_presentation_entry", "Entrée de présentation invalide");
            return;
          }
          if (kind === "slide") slideCount += 1;
          else noteCount += 1;
          if (
            slideCount > KNOWLEDGE_PRESENTATION_MAX_SLIDES ||
            noteCount > KNOWLEDGE_PRESENTATION_MAX_SLIDES
          ) {
            fail(
              "presentation_too_many_slides",
              "La présentation contient trop de diapositives"
            );
            return;
          }

          const expectedBytes = Number(entry.uncompressedSize ?? 0);
          totalXmlBytes += expectedBytes;
          if (expectedBytes > KNOWLEDGE_PRESENTATION_MAX_XML_BYTES) {
            fail(
              "presentation_entry_too_large",
              "Une diapositive dépasse la limite autorisée"
            );
            return;
          }
          if (totalXmlBytes > KNOWLEDGE_PRESENTATION_MAX_TOTAL_XML_BYTES) {
            fail(
              "presentation_xml_too_large",
              "Le texte interne de la présentation dépasse la limite autorisée"
            );
            return;
          }

          archive.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) {
              fail("invalid_presentation_entry", "Diapositive illisible");
              return;
            }
            const chunks = [];
            let readBytes = 0;
            stream.on("error", () =>
              fail("invalid_presentation_entry", "Diapositive invalide")
            );
            stream.on("data", (chunk) => {
              readBytes += chunk.length;
              if (readBytes > KNOWLEDGE_PRESENTATION_MAX_XML_BYTES) {
                fail(
                  "presentation_entry_too_large",
                  "Une diapositive dépasse la limite autorisée"
                );
                stream.destroy();
                return;
              }
              chunks.push(chunk);
            });
            stream.on("end", () => {
              if (settled) return;
              entries.push({ kind, number, bytes: Buffer.concat(chunks) });
              archive.readEntry();
            });
          });
        });
        archive.on("end", () => {
          if (settled) return;
          if (
            !requiredEntries.has("[Content_Types].xml") ||
            !requiredEntries.has("ppt/presentation.xml") ||
            slideCount < 1
          ) {
            fail("invalid_presentation_structure", "Structure PPTX invalide");
            return;
          }
          settled = true;
          entries.sort(
            (left, right) =>
              left.number - right.number ||
              (left.kind === right.kind ? 0 : left.kind === "slide" ? -1 : 1)
          );
          resolve({ entries, slideCount, noteCount });
        });
        archive.readEntry();
      }
    );
  });
}

function presentationXmlText(bytes) {
  let xml;
  try {
    xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new KnowledgeDocumentExtractionError(
      "invalid_presentation_xml",
      "Texte de diapositive invalide"
    );
  }
  if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) {
    throw new KnowledgeDocumentExtractionError(
      "presentation_xml_entities_forbidden",
      "Les entités XML sont interdites"
    );
  }

  const errors = [];
  const document = new DOMParser({
    errorHandler: {
      warning: (message) => errors.push(message),
      error: (message) => errors.push(message),
      fatalError: (message) => errors.push(message),
    },
  }).parseFromString(xml, "application/xml");
  if (errors.length > 0 || !document?.documentElement) {
    throw new KnowledgeDocumentExtractionError(
      "invalid_presentation_xml",
      "XML de diapositive invalide"
    );
  }

  const textNodes = document.getElementsByTagNameNS(DRAWINGML_NAMESPACE, "t");
  const values = [];
  for (let index = 0; index < textNodes.length; index += 1) {
    const value = normalizedText(textNodes.item(index)?.textContent ?? "");
    if (value) values.push(value);
  }
  return values.join("\n");
}

async function extractPresentation(bytes) {
  const archive = await preflightZip(bytes);
  const presentation = await readPresentationXmlEntries(bytes);
  const sections = presentation.entries
    .map((entry) => {
      const value = presentationXmlText(entry.bytes);
      if (!value) return "";
      const label = entry.kind === "slide" ? "Diapositive" : "Notes";
      return `# ${label} ${entry.number}\n${value}`;
    })
    .filter(Boolean);
  return {
    value: sections.join("\n\n"),
    method: "pptx-xmldom",
    slides: presentation.slideCount,
    notes: presentation.noteCount,
    archive,
  };
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
      safetySignals: [],
      reviewProposal: null,
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
    extracted = await extractPresentation(bytes);
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
        safetySignals: [],
        reviewProposal: null,
      },
    };
  }

  const safetySignals = documentInstructionSignals(bounded.text);
  if (safetySignals.length > 0) {
    return {
      ...manualResult(bytes, "instruction_signal_detected", { method: extracted.method }),
      proposedKnowledge: {
        schemaVersion: 1,
        state: "manual_review",
        reason: "instruction_signal_detected",
        extractedText: null,
        privacySignals: [],
        safetySignals,
        reviewProposal: buildKnowledgeReviewProposal(bounded.text),
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
      slides: extracted.slides ?? null,
      notes: extracted.notes ?? null,
      warnings: extracted.warnings ?? 0,
    },
    proposedKnowledge: {
      schemaVersion: 1,
      state: "extracted",
      extractedText: bounded.text,
      privacySignals: [],
      safetySignals: [],
      reviewProposal: buildKnowledgeReviewProposal(bounded.text),
      truncated: bounded.truncated,
    },
  };
}
