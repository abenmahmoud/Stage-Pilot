import Busboy from "busboy";
import type { VercelRequest } from "@vercel/node";
import { HttpError } from "./auth.js";

export const DEPOT_MULTIPART_MAX_FILE_BYTES = 4 * 1024 * 1024;

export type DepotMultipartFile = {
  fieldName: "fichier" | "rapport";
  fileName: string;
  mimeType: string;
  bytes: Buffer;
};

export type DepotMultipartPayload = {
  files: Partial<Record<DepotMultipartFile["fieldName"], DepotMultipartFile>>;
  fields: Record<string, string>;
};

const ALLOWED_FIELDS = new Set([
  "annee_scolaire",
  "titre",
  "valide_du",
  "valide_au",
  "fraiche_jusquau",
  "source_kind",
]);

function safeFileName(value: string): string {
  const name = value.normalize("NFKC").replace(/[\\/\u0000-\u001f\u007f]/g, "").trim();
  if (!name || name.length > 255) throw new HttpError(400, "Nom de fichier invalide");
  return name;
}

export async function readDepotMultipart(req: VercelRequest): Promise<DepotMultipartPayload> {
  const contentType = Array.isArray(req.headers["content-type"])
    ? req.headers["content-type"][0]
    : req.headers["content-type"];
  if (!contentType?.toLowerCase().startsWith("multipart/form-data")) {
    throw new HttpError(415, "Le livrable doit être envoyé en multipart/form-data");
  }

  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: {
          fileSize: DEPOT_MULTIPART_MAX_FILE_BYTES,
          files: 2,
          fields: 6,
          parts: 8,
          fieldSize: 500,
          fieldNameSize: 80,
          headerPairs: 100,
        },
      });
    } catch {
      reject(new HttpError(400, "Requête multipart invalide"));
      return;
    }

    const files: DepotMultipartPayload["files"] = {};
    const fields: Record<string, string> = {};
    let boundaryError: HttpError | null = null;

    parser.on("file", (fieldName, stream, info) => {
      if (fieldName !== "fichier" && fieldName !== "rapport") {
        boundaryError ??= new HttpError(400, "Champ de fichier non autorisé");
        stream.resume();
        return;
      }
      if (files[fieldName]) {
        boundaryError ??= new HttpError(400, "Un même fichier ne peut pas être envoyé deux fois");
        stream.resume();
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      stream.on("limit", () => {
        boundaryError ??= new HttpError(413, "Le livrable multipart dépasse 4 Mo");
      });
      stream.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total <= DEPOT_MULTIPART_MAX_FILE_BYTES) chunks.push(chunk);
      });
      stream.on("end", () => {
        if (boundaryError) return;
        try {
          files[fieldName] = {
            fieldName,
            fileName: safeFileName(info.filename),
            mimeType: String(info.mimeType ?? "").toLowerCase(),
            bytes: Buffer.concat(chunks, total),
          };
        } catch (error) {
          boundaryError ??= error instanceof HttpError
            ? error
            : new HttpError(400, "Nom de fichier invalide");
        }
      });
    });
    parser.on("field", (name, value, info) => {
      if (!ALLOWED_FIELDS.has(name) || info.valueTruncated || Object.hasOwn(fields, name)) {
        boundaryError ??= new HttpError(400, "Champ multipart invalide");
        return;
      }
      fields[name] = value.normalize("NFKC").trim();
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"]) {
      parser.on(event, () => {
        boundaryError ??= new HttpError(413, "La requête multipart dépasse les limites autorisées");
      });
    }
    parser.on("error", () => reject(new HttpError(400, "Requête multipart invalide")));
    parser.on("close", () => {
      if (boundaryError) reject(boundaryError);
      else resolve({ files, fields });
    });
    req.pipe(parser);
  });
}

export async function readDepotJson(req: VercelRequest): Promise<unknown> {
  const contentType = Array.isArray(req.headers["content-type"])
    ? req.headers["content-type"][0]
    : req.headers["content-type"];
  if (contentType?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    throw new HttpError(415, "Le type de contenu n'est pas accepté");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const value of req) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    size += chunk.length;
    if (size > 8 * 1024) throw new HttpError(413, "La commande JSON est trop volumineuse");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
  } catch {
    throw new HttpError(400, "La commande JSON est invalide");
  }
}
