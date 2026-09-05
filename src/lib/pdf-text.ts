import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 40;
const MAX_TEXT_CHARACTERS = 100_000;

export type ExtractedPdfText = {
  text: string;
  pageCount: number;
};

export async function extractPdfTextLocally(file: File): Promise<ExtractedPdfText> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Choisissez un fichier PDF.");
  }
  if (file.size > MAX_PDF_BYTES) throw new Error("Le PDF dépasse la limite de 10 Mo.");

  const { GlobalWorkerOptions, getDocument } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = workerUrl;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = await getDocument({ data: bytes }).promise;
  if (document.numPages > MAX_PAGES) throw new Error("Le PDF dépasse la limite de 40 pages.");

  const pages: string[] = [];
  let characterCount = 0;
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let line = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const textItem = item as { str: string; hasEOL: boolean };
      line += `${line ? " " : ""}${textItem.str}`;
      if (textItem.hasEOL) {
        if (line.trim()) lines.push(line.trim());
        line = "";
      }
    }
    if (line.trim()) lines.push(line.trim());
    const pageText = lines.join("\n");
    characterCount += pageText.length;
    if (characterCount > MAX_TEXT_CHARACTERS) throw new Error("Le texte du PDF est trop volumineux.");
    pages.push(`Page ${pageNumber}\n${pageText}`);
  }

  const text = pages.join("\n\n").trim();
  if (text.length < 40) throw new Error("Aucun texte exploitable n’a été trouvé dans ce PDF.");
  return { text, pageCount: document.numPages };
}
