import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMUNICATION_DOCUMENT_MIME_TYPES,
  extractCommunicationDocument,
} from "../workers/communication-document-extractor.mjs";

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, value] of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.from(value, "utf8");
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, end]);
}

function minimalDocx(text) {
  return storedZip([
    ["[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`],
    ["word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`],
  ]);
}

function minimalPdf(text) {
  const safeText = text.replace(/([\\()])/g, "\\$1");
  const stream = `BT /F1 12 Tf 72 720 Td (${safeText}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
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

test("accepts only local PDF and DOCX extraction", () => {
  assert.deepEqual([...COMMUNICATION_DOCUMENT_MIME_TYPES], [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
});

test("extracts a fictitious PDF locally", async () => {
  const result = await extractCommunicationDocument({
    bytes: minimalPdf("Information fictive de rentree"),
    mimeType: "application/pdf",
  });
  assert.equal(result.state, "extracted");
  assert.equal(result.method, "pdfjs");
  assert.match(result.extractedText, /Information fictive/);
  assert.match(result.checksum, /^[a-f0-9]{64}$/);
});

test("extracts a synthetic safe DOCX through Mammoth", async () => {
  const bytes = minimalDocx("Information fictive pour les familles");
  const result = await extractCommunicationDocument({
    bytes,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  assert.equal(result.method, "mammoth");
  assert.equal(result.state, "extracted");
  assert.match(result.extractedText, /Information fictive/);
});

test("stops automatic use when privacy or credential values are detected", async () => {
  const result = await extractCommunicationDocument({
    bytes: minimalPdf("Contact personne@example.test code ENT: BC93-2026"),
    mimeType: "application/pdf",
  });
  assert.equal(result.state, "manual_review");
  assert.equal(result.extractedText, null);
  assert.ok(result.privacySignals.includes("email_address"));
  assert.ok(result.privacySignals.includes("school_access_code"));
});

test("rejects every unsupported format before extraction", async () => {
  for (const mimeType of ["text/plain", "image/jpeg", "image/png"]) {
    await assert.rejects(
      () => extractCommunicationDocument({ bytes: Buffer.from("x"), mimeType }),
      /Seuls les fichiers PDF et DOCX/
    );
  }
});

test("rejects a corrupt file even when its declared MIME type is allowed", async () => {
  await assert.rejects(
    () => extractCommunicationDocument({
      bytes: Buffer.from("not-a-pdf"),
      mimeType: "application/pdf",
    })
  );
});
