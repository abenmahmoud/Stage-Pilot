import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, inArray, or } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  classes,
  eleves,
  etablissement,
  fichesGrandOral,
  professeurs,
} from "../../../db/schema.js";
import { handleApi, methodNotAllowed } from "../../_shared/response.js";
import { requireUser, HttpError } from "../../_shared/auth.js";
import {
  canReadGrandOralForUser,
  getProfesseurIdForUser,
} from "../../_shared/access.js";

type ProfesseurLookup = {
  id: string;
  authUserId: string | null;
  nom: string;
  prenom: string;
  matieres: string | null;
};

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function cleanPdfText(value: string | null | undefined): string {
  return stripAccents(value ?? "")
    .replace(/[’]/g, "'")
    .replace(/[œ]/gi, "oe")
    .replace(/[–—]/g, "-")
    .replace(/[•]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR").format(date);
}

function wrapText(value: string | null | undefined, max = 84): string[] {
  const words = cleanPdfText(value || "-").split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 5);
}

function text(
  x: number,
  y: number,
  size: number,
  value: string | null | undefined,
  bold = false
): string {
  return `BT /F${bold ? "2" : "1"} ${size} Tf ${x} ${y} Td (${cleanPdfText(
    value
  )}) Tj ET\n`;
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `q 0.75 G 0.7 w ${x1} ${y1} m ${x2} ${y2} l S Q\n`;
}

function rect(x: number, y: number, w: number, h: number): string {
  return `q 0.85 G 0.7 w ${x} ${y} ${w} ${h} re S Q\n`;
}

function filledRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number
): string {
  return `q ${r} ${g} ${b} rg ${x} ${y} ${w} ${h} re f Q\n`;
}

function profLabel(prof: ProfesseurLookup | undefined): string {
  if (!prof) return "-";
  return `${prof.nom} ${prof.prenom}${prof.matieres ? ` - ${prof.matieres}` : ""}`;
}

async function loadProfesseursByReference(values: Array<string | null>) {
  const references = Array.from(new Set(values.filter(Boolean))) as string[];
  const map = new Map<string, ProfesseurLookup>();
  if (references.length === 0) return map;

  const rows = await db
    .select({
      id: professeurs.id,
      authUserId: professeurs.authUserId,
      nom: professeurs.nom,
      prenom: professeurs.prenom,
      matieres: professeurs.matieres,
    })
    .from(professeurs)
    .where(
      or(
        inArray(professeurs.id, references),
        inArray(professeurs.authUserId, references)
      )
    );

  for (const prof of rows) {
    map.set(prof.id, prof);
    if (prof.authUserId) map.set(prof.authUserId, prof);
  }
  return map;
}

function buildPdf(objects: string[]): Buffer {
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

function buildFichePdf(params: {
  fiche: {
    eleveNom: string;
    elevePrenom: string;
    classeNom: string | null;
    numeroCanditat: string | null;
    question1: string | null;
    specialitesQuestion1: string | null;
    question2: string | null;
    specialitesQuestion2: string | null;
    profSpe1Id: string | null;
    profSpe2Id: string | null;
    commentaireProf1: string | null;
    commentaireProf2: string | null;
    signeProf1At: Date | null;
    signeProf2At: Date | null;
    cachetApposeAt: Date | null;
  };
  etablissementRow: {
    nom: string;
    ville: string;
    uai: string | null;
    civiliteProviseur: string | null;
    nomProviseur: string;
  };
  professeursMap: Map<string, ProfesseurLookup>;
}): Buffer {
  const { fiche, etablissementRow, professeursMap } = params;
  const prof1 = fiche.profSpe1Id
    ? profLabel(professeursMap.get(fiche.profSpe1Id))
    : "-";
  const prof2 = fiche.profSpe2Id
    ? profLabel(professeursMap.get(fiche.profSpe2Id))
    : "-";
  const cachetDate = formatDate(fiche.cachetApposeAt);
  const chefNom = `${etablissementRow.civiliteProviseur ?? ""} ${
    etablissementRow.nomProviseur
  }`.trim();

  let stream = "";
  stream += filledRect(40, 772, 515, 38, 0.94, 0.97, 1);
  stream += text(55, 795, 16, etablissementRow.nom, true);
  stream += text(55, 779, 9, `${etablissementRow.ville} - UAI ${etablissementRow.uai ?? "-"}`);
  stream += text(352, 790, 13, "FICHE GRAND ORAL", true);
  stream += text(352, 775, 10, "Session 2026 - fiche finalisee");
  stream += line(40, 758, 555, 758);

  stream += text(50, 735, 13, "Eleve", true);
  stream += text(50, 716, 11, `${fiche.eleveNom} ${fiche.elevePrenom}`);
  stream += text(50, 700, 10, `Classe : ${fiche.classeNom ?? "-"}`);
  stream += text(250, 700, 10, `Numero candidat : ${fiche.numeroCanditat ?? "-"}`);

  stream += rect(45, 575, 505, 105);
  stream += text(60, 660, 12, "Question 1", true);
  let y = 640;
  for (const lineText of wrapText(fiche.question1, 92)) {
    stream += text(60, y, 10, lineText);
    y -= 13;
  }
  stream += text(60, 592, 9, `Specialite(s) : ${fiche.specialitesQuestion1 ?? "-"}`);

  stream += rect(45, 445, 505, 105);
  stream += text(60, 530, 12, "Question 2", true);
  y = 510;
  for (const lineText of wrapText(fiche.question2, 92)) {
    stream += text(60, y, 10, lineText);
    y -= 13;
  }
  stream += text(60, 462, 9, `Specialite(s) : ${fiche.specialitesQuestion2 ?? "-"}`);

  stream += text(50, 412, 13, "Circuit de validation", true);
  stream += line(50, 404, 545, 404);
  stream += text(60, 382, 10, "Professeur de specialite 1", true);
  stream += text(240, 382, 10, prof1);
  stream += text(60, 365, 9, `Valide le : ${formatDate(fiche.signeProf1At)}`);
  if (fiche.commentaireProf1) {
    stream += text(60, 350, 8, `Commentaire : ${fiche.commentaireProf1}`);
  }

  stream += text(60, 322, 10, "Professeur de specialite 2", true);
  stream += text(240, 322, 10, prof2);
  stream += text(60, 305, 9, `Valide le : ${formatDate(fiche.signeProf2At)}`);
  if (fiche.commentaireProf2) {
    stream += text(60, 290, 8, `Commentaire : ${fiche.commentaireProf2}`);
  }

  stream += rect(335, 135, 190, 105);
  stream += text(352, 216, 10, "CACHET ET SIGNATURE", true);
  stream += text(352, 199, 9, etablissementRow.nom);
  stream += text(352, 184, 9, `Chef d'etablissement : ${chefNom}`);
  stream += text(352, 169, 9, `Signe et cachete le : ${cachetDate}`);
  stream += text(352, 149, 12, chefNom, true);
  stream += line(352, 158, 500, 158);

  stream += text(50, 115, 8, "Document genere par LyceeGest. Cachet et signature numeriques visuels apposes dans le circuit interne de l'etablissement.");
  stream += text(50, 98, 8, `PDF genere le ${formatDate(new Date())}`);

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`,
  ];

  return buildPdf(objects);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  await handleApi(res, async () => {
    const user = await requireUser(req);
    const professeurId = await getProfesseurIdForUser(user);

    const ficheId = (req.query.id as string) || "";
    if (!ficheId || !/^[0-9a-fA-F-]{36}$/.test(ficheId)) {
      throw new HttpError(400, "Identifiant fiche invalide");
    }

    const [fiche] = await db
      .select({
        id: fichesGrandOral.id,
        statut: fichesGrandOral.statut,
        eleveAuthUserId: eleves.authUserId,
        professeurPrincipalId: classes.professeurPrincipalId,
        eleveNom: eleves.nom,
        elevePrenom: eleves.prenom,
        classeNom: classes.nom,
        numeroCanditat: fichesGrandOral.numeroCanditat,
        question1: fichesGrandOral.question1,
        specialitesQuestion1: fichesGrandOral.specialitesQuestion1,
        question2: fichesGrandOral.question2,
        specialitesQuestion2: fichesGrandOral.specialitesQuestion2,
        profSpe1Id: fichesGrandOral.profSpe1Id,
        profSpe2Id: fichesGrandOral.profSpe2Id,
        commentaireProf1: fichesGrandOral.commentaireProf1,
        commentaireProf2: fichesGrandOral.commentaireProf2,
        signeProf1At: fichesGrandOral.signeProf1At,
        signeProf2At: fichesGrandOral.signeProf2At,
        cachetApposeAt: fichesGrandOral.cachetApposeAt,
      })
      .from(fichesGrandOral)
      .innerJoin(eleves, eq(fichesGrandOral.eleveId, eleves.id))
      .leftJoin(classes, eq(eleves.classeId, classes.id))
      .where(eq(fichesGrandOral.id, ficheId))
      .limit(1);

    if (!fiche) throw new HttpError(404, "Fiche introuvable");
    if (!canReadGrandOralForUser(fiche, user, professeurId)) {
      throw new HttpError(403, "Acces interdit a cette fiche Grand Oral");
    }
    if (fiche.statut !== "finalise") {
      throw new HttpError(400, "La fiche n'est pas encore finalisee.");
    }

    const [etablissementRow] = await db.select().from(etablissement).limit(1);
    const professeursMap = await loadProfesseursByReference([
      fiche.profSpe1Id,
      fiche.profSpe2Id,
    ]);

    const pdf = buildFichePdf({
      fiche,
      etablissementRow: {
        nom: etablissementRow?.nom ?? "Lycee Blaise Cendrars",
        ville: etablissementRow?.ville ?? "Sevran",
        uai: etablissementRow?.uai ?? "0932048W",
        civiliteProviseur: etablissementRow?.civiliteProviseur ?? "Mme",
        nomProviseur: etablissementRow?.nomProviseur ?? "VER-EECKE",
      },
      professeursMap,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="fiche-grand-oral-${fiche.eleveNom}-${fiche.elevePrenom}.pdf"`
    );
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(pdf);
    return null;
  });
}
