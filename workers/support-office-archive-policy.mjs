import { extname } from "node:path";
import { DOMParser } from "@xmldom/xmldom";
import yauzl from "yauzl";

const OFFICE_ARCHIVE_MAX_ENTRIES = 1_000;
const OFFICE_ARCHIVE_MAX_ENTRY_BYTES = 32 * 1024 * 1024;
const OFFICE_ARCHIVE_MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const OFFICE_MANIFEST_MAX_BYTES = 256 * 1024;

const OFFICE_RULES = [
  {
    kind: "docx",
    extension: ".docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    mainEntry: "word/document.xml",
    mainContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
    requiredEntries: new Set(["[Content_Types].xml", "_rels/.rels", "word/document.xml"]),
  },
  {
    kind: "xlsx",
    extension: ".xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    mainEntry: "xl/workbook.xml",
    mainContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
    requiredEntries: new Set(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml"]),
  },
];

const NEUTRAL_ARCHIVE_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "application/zip",
]);

const ACTIVE_CONTENT_PATHS = [
  /(^|\/)vbaproject\.bin$/i,
  /(^|\/)activex\//i,
  /(^|\/)embeddings\//i,
  /(^|\/)customui\//i,
  /^xl\/macrosheets\//i,
];

export class SupportOfficeArchiveError extends Error {
  constructor(code) {
    super(code);
    this.name = "SupportOfficeArchiveError";
    this.code = code;
  }
}

function fail(code) {
  throw new SupportOfficeArchiveError(code);
}

function officeRule(name, mimeType) {
  const extension = extname(String(name ?? "")).toLowerCase();
  const normalizedMime = String(mimeType ?? "").trim().toLowerCase();
  const byExtension = OFFICE_RULES.find((rule) => rule.extension === extension) ?? null;
  const byMime = OFFICE_RULES.find((rule) => rule.mimeType === normalizedMime) ?? null;

  if (byExtension && byMime && byExtension !== byMime) fail("office_type_mismatch");
  if (byMime && extension && !byExtension) fail("office_type_mismatch");
  if (byExtension && !byMime && !NEUTRAL_ARCHIVE_MIME_TYPES.has(normalizedMime)) {
    fail("office_type_mismatch");
  }
  return byMime ?? byExtension;
}

function isUnsafePath(value) {
  return value.startsWith("/")
    || value.includes("\\")
    || /^[a-z]:/i.test(value)
    || value.split("/").some((part) => part === "..");
}

function parseOfficeXml(value) {
  if (/<!DOCTYPE|<!ENTITY/i.test(value)) fail("unsafe_office_manifest");
  let invalid = false;
  const document = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: () => { invalid = true; },
      fatalError: () => { invalid = true; },
    },
  }).parseFromString(value, "application/xml");
  if (invalid || !document?.documentElement) fail("invalid_office_manifest");
  return document;
}

function elementsByLocalName(document, localName) {
  return Array.from(document.getElementsByTagName("*"))
    .filter((element) => element.localName === localName || element.nodeName === localName);
}

function validateOfficeManifests(manifests, rule) {
  const contentTypesXml = manifests.get("[content_types].xml");
  const relationshipsXml = manifests.get("_rels/.rels");
  if (!contentTypesXml || !relationshipsXml) fail("office_archive_missing_parts");

  const contentTypes = parseOfficeXml(contentTypesXml);
  const hasMainContentType = elementsByLocalName(contentTypes, "Override").some((element) => (
    element.getAttribute("PartName")?.replace(/^\/+/, "") === rule.mainEntry
      && element.getAttribute("ContentType") === rule.mainContentType
  ));
  if (!hasMainContentType) fail("office_content_type_mismatch");

  const relationships = parseOfficeXml(relationshipsXml);
  const hasMainRelationship = elementsByLocalName(relationships, "Relationship").some((element) => {
    const target = element.getAttribute("Target")
      ?.replace(/^\/+/, "")
      .replace(/^\.\/+/, "");
    return element.getAttribute("Type")?.endsWith("/officeDocument")
      && element.getAttribute("TargetMode") !== "External"
      && target === rule.mainEntry;
  });
  if (!hasMainRelationship) fail("office_relationship_mismatch");
}

export async function inspectSupportOfficeArchive({ bytes, name, mimeType }) {
  const rule = officeRule(name, mimeType);
  if (!rule) {
    return { checked: false, kind: null, entries: 0, uncompressedBytes: 0 };
  }
  if (!Buffer.isBuffer(bytes) || bytes.length < 4) fail("invalid_office_archive");

  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(bytes, {
      lazyEntries: true,
      decodeStrings: true,
      validateEntrySizes: true,
      strictFileNames: true,
    }, (error, archive) => {
      if (error || !archive) {
        reject(new SupportOfficeArchiveError("invalid_office_archive"));
        return;
      }

      const entriesSeen = new Set();
      const exactEntriesSeen = new Set();
      const manifests = new Map();
      let entries = 0;
      let uncompressedBytes = 0;
      let settled = false;

      const rejectArchive = (code) => {
        if (settled) return;
        settled = true;
        archive.close();
        reject(new SupportOfficeArchiveError(code));
      };

      archive.on("error", () => rejectArchive("invalid_office_archive"));
      archive.on("entry", (entry) => {
        const entryName = entry.fileName;
        const comparableName = entryName.toLowerCase();
        const entryBytes = Number(entry.uncompressedSize ?? 0);

        if ((entry.generalPurposeBitFlag & 1) !== 0) {
          rejectArchive("encrypted_office_archive");
          return;
        }
        if (isUnsafePath(entryName)) {
          rejectArchive("unsafe_office_archive_path");
          return;
        }
        if (entriesSeen.has(comparableName)) {
          rejectArchive("duplicate_office_archive_entry");
          return;
        }
        if (ACTIVE_CONTENT_PATHS.some((pattern) => pattern.test(entryName))) {
          rejectArchive("active_office_content");
          return;
        }

        entriesSeen.add(comparableName);
        exactEntriesSeen.add(entryName);
        entries += 1;
        uncompressedBytes += entryBytes;
        if (entries > OFFICE_ARCHIVE_MAX_ENTRIES) {
          rejectArchive("office_archive_too_many_entries");
          return;
        }
        if (!Number.isSafeInteger(entryBytes)
          || entryBytes < 0
          || entryBytes > OFFICE_ARCHIVE_MAX_ENTRY_BYTES
          || uncompressedBytes > OFFICE_ARCHIVE_MAX_UNCOMPRESSED_BYTES) {
          rejectArchive("office_archive_too_large");
          return;
        }
        if (comparableName !== "[content_types].xml" && comparableName !== "_rels/.rels") {
          archive.readEntry();
          return;
        }
        if (entryBytes > OFFICE_MANIFEST_MAX_BYTES) {
          rejectArchive("office_manifest_too_large");
          return;
        }
        archive.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            rejectArchive("invalid_office_manifest");
            return;
          }
          const chunks = [];
          let bytesRead = 0;
          stream.on("error", () => rejectArchive("invalid_office_manifest"));
          stream.on("data", (chunk) => {
            bytesRead += chunk.length;
            if (bytesRead > OFFICE_MANIFEST_MAX_BYTES) {
              stream.destroy();
              rejectArchive("office_manifest_too_large");
              return;
            }
            chunks.push(chunk);
          });
          stream.on("end", () => {
            if (settled) return;
            manifests.set(comparableName, Buffer.concat(chunks).toString("utf8"));
            archive.readEntry();
          });
        });
      });
      archive.on("end", () => {
        if (settled) return;
        if (![...rule.requiredEntries].every((entry) => exactEntriesSeen.has(entry))) {
          rejectArchive("office_archive_missing_parts");
          return;
        }
        try {
          validateOfficeManifests(manifests, rule);
        } catch (error) {
          settled = true;
          reject(error);
          return;
        }
        settled = true;
        resolve({ checked: true, kind: rule.kind, entries, uncompressedBytes });
      });
      archive.readEntry();
    });
  });
}
