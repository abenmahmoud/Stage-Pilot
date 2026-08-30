import { extractKnowledgeDocument } from "./knowledge-document-extractor.mjs";

export const COMMUNICATION_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const COMMUNICATION_EXTRACTED_TEXT_MAX_CHARS = 100_000;

export class CommunicationDocumentExtractionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CommunicationDocumentExtractionError";
    this.code = code;
  }
}

export async function extractCommunicationDocument({ bytes, mimeType }) {
  if (!COMMUNICATION_DOCUMENT_MIME_TYPES.has(mimeType)) {
    throw new CommunicationDocumentExtractionError(
      "unsupported_mime",
      "Seuls les fichiers PDF et DOCX sont acceptés."
    );
  }

  const result = await extractKnowledgeDocument({
    bytes,
    mimeType,
    classification: "internal",
  });
  const proposal = result.proposedKnowledge ?? {};
  const extractedText = proposal.state === "extracted" && typeof proposal.extractedText === "string"
    ? proposal.extractedText.slice(0, COMMUNICATION_EXTRACTED_TEXT_MAX_CHARS)
    : null;

  return {
    checksum: result.checksum,
    state: extractedText ? "extracted" : "manual_review",
    reason: extractedText ? null : String(result.summary?.reason ?? "manual_review"),
    extractedText,
    truncated: Boolean(
      result.summary?.truncated
      || (typeof proposal.extractedText === "string"
        && proposal.extractedText.length > COMMUNICATION_EXTRACTED_TEXT_MAX_CHARS)
    ),
    method: result.summary?.method ?? null,
    pages: result.summary?.pages ?? null,
    warnings: result.summary?.warnings ?? 0,
    privacySignals: Array.isArray(proposal.privacySignals) ? proposal.privacySignals : [],
    safetySignals: Array.isArray(proposal.safetySignals) ? proposal.safetySignals : [],
    reviewProposal: proposal.reviewProposal ?? null,
  };
}
