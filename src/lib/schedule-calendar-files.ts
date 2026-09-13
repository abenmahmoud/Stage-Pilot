import { SCHEDULE_IMPORT_MAX_BYTES } from "../../shared/schedule-import-input.js";

const MAX_FILES = 250;
const MAX_ENTRIES = 1000;
const TOO_LARGE = "Le lot dépasse 50 Mo après ouverture. Exportez une période plus courte dans EDT.";

export type PreparedCalendars = { file: File; fileCount: number; calendarCount: number };

/** Prepare locally; the resulting ICS still follows the private security/review pipeline. */
export async function prepareCalendarFiles(
  files: File[],
  outputName: string,
  options: { signal?: AbortSignal; onProgress?: (count: number) => void } = {},
): Promise<PreparedCalendars> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = setTimeout(cancel, 60_000);
  const signal = controller.signal;
  const parts: string[] = [];
  let bytes = 0, calendarCount = 0;
  const check = () => signal.throwIfAborted();
  async function append(blob: Blob) {
    check();
    if (!blob.size) throw new Error("Un calendrier est vide. Refaites l’export de ce fichier dans EDT.");
    if (bytes + blob.size + 2 > SCHEDULE_IMPORT_MAX_BYTES) throw new Error(TOO_LARGE);
    let content: string;
    try { content = new TextDecoder("utf-8", { fatal: true }).decode(await blob.arrayBuffer()); }
    catch { throw new Error("Un calendrier n’est pas encodé en UTF-8. Refaites son export iCal dans EDT."); }
    check();
    content = content.replace(/^\uFEFF/, "").trim();
    if (!/^BEGIN:VCALENDAR\r?\n/i.test(content) || !/\r?\nEND:VCALENDAR$/i.test(content) || content.includes("\0")) {
      throw new Error("Un fichier ne contient pas un calendrier iCal complet. Refaites son export dans EDT.");
    }
    calendarCount += (content.match(/^BEGIN:VCALENDAR\r?$/gim) ?? []).length;
    if (calendarCount > MAX_FILES) throw new Error("Un dépôt peut contenir au maximum 250 calendriers.");
    bytes += blob.size + 2;
    parts.push(content + "\r\n");
    options.onProgress?.(parts.length);
  }
  try {
    check();
    if (!files.length) throw new Error("Choisissez un ZIP ou vos fichiers .ics ensemble.");
    const isZip = files.some(file => /\.zip$/i.test(file.name));
    if (isZip) {
      if (files.length !== 1) throw new Error("Choisissez un seul ZIP, ou sélectionnez les fichiers .ics ensemble, sans les mélanger.");
      const zip = files[0];
      if (!zip.size || zip.size > SCHEDULE_IMPORT_MAX_BYTES) throw new Error(TOO_LARGE);
      const { ZipReader, BlobReader } = await import("@zip.js/zip.js");
      check();
      const reader = new ZipReader(new BlobReader(zip), {
        useWebWorkers: false, strictness: "strict", checkCrc32: true, checkOverlappingEntry: true,
      });
      try {
        let entryCount = 0, declaredBytes = 0;
        const entries = [];
        const names = new Set<string>();
        for await (const entry of reader.getEntriesGenerator()) {
          check();
          if (++entryCount > MAX_ENTRIES) throw new Error("Ce ZIP contient trop d’éléments. Créez un ZIP avec uniquement les calendriers EDT.");
          const path = entry.filename.normalize("NFC").replace(/\\/g, "/");
          if (!path || path.startsWith("/") || /[:\u0000-\u001f]/.test(path) || path.split("/").some(p => p === ".." || p === ".") || entry.symlink) {
            throw new Error("La structure du ZIP est invalide. Recréez-le avec les fichiers .ics exportés.");
          }
          if (entry.encrypted) throw new Error("Ce ZIP est protégé par un mot de passe. Choisissez les fichiers .ics ensemble ou un ZIP sans mot de passe.");
          if (entry.directory) continue;
          // Only known OS metadata is ignored; never silently omit a supplied document.
          if (path.startsWith("__MACOSX/") || /(^|\/)(\.DS_Store|Thumbs\.db)$/i.test(path)) continue;
          if (!/\.ics$/i.test(path)) throw new Error("Ce ZIP contient autre chose que des calendriers. Créez un ZIP contenant uniquement les fichiers .ics.");
          const key = path.toLowerCase();
          if (names.has(key)) throw new Error("Le ZIP contient des noms de fichiers en double. Recréez-le à partir d’un seul export EDT.");
          names.add(key);
          if (entries.length >= MAX_FILES) throw new Error("Un dépôt peut contenir au maximum 250 fichiers iCal.");
          declaredBytes += entry.uncompressedSize + 2;
          if (!Number.isSafeInteger(declaredBytes) || declaredBytes > SCHEDULE_IMPORT_MAX_BYTES) throw new Error(TOO_LARGE);
          entries.push(entry);
        }
        if (!entries.length) throw new Error("Ce ZIP ne contient aucun fichier .ics. Choisissez le ZIP de l’export iCal EDT.");
        // Match extraction order to the export, preserving its calendar labels and UID values.
        for (const entry of entries) {
          check();
          let extracted = 0;
          const chunks: Uint8Array<ArrayBuffer>[] = [];
          await entry.getData(new WritableStream<Uint8Array>({
            write(chunk) {
              check();
              extracted += chunk.byteLength;
              // Enforce actual output size too: ZIP headers are untrusted.
              if (bytes + extracted + 2 > SCHEDULE_IMPORT_MAX_BYTES) throw new Error(TOO_LARGE);
              chunks.push(new Uint8Array(chunk));
            },
          }), { signal });
          await append(new Blob(chunks));
        }
      } catch (reason) {
        if (reason instanceof Error && /^(Le |La |Un |Ce |Choisissez)/.test(reason.message)) throw reason;
        check();
        throw new Error("Impossible de lire ce ZIP : il est incomplet ou endommagé. Recréez-le, ou sélectionnez tous les fichiers .ics ensemble.");
      } finally { await reader.close(); }
    } else {
      if (files.length > MAX_FILES) throw new Error("Un dépôt peut contenir au maximum 250 fichiers iCal.");
      if (files.some(file => !/\.ics$/i.test(file.name))) throw new Error("Choisissez un ZIP ou uniquement des fichiers .ics.");
      if (files.reduce((sum, file) => sum + file.size + 2, 0) > SCHEDULE_IMPORT_MAX_BYTES) throw new Error(TOO_LARGE);
      for (const file of files) await append(file);
    }
    check();
    return {
      file: new File(parts, outputName, { type: "text/calendar" }),
      fileCount: parts.length,
      calendarCount,
    };
  } catch (reason) {
    if (signal.aborted && !options.signal?.aborted) throw new Error("La préparation prend trop de temps. Réessayez avec une période d’export plus courte.");
    throw reason;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}
