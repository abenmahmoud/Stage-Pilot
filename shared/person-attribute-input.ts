import Papa from "papaparse";

const HEADERS = [
  "reference_personne",
  "cle",
  "valeur",
  "valide_depuis",
  "valide_jusquau",
  "source",
];
const FORBIDDEN_KEY = /(?:^|_)(?:password|mot_de_passe|mdp|otp|token|api_key|cle_api|secret|code_(?:ent|pronote|educonnect|academique))(?:_|$)/u;

export type PersonAttributeInputRow = {
  personRef: string;
  attributeKey: string;
  value: string;
  validFrom: string;
  validUntil: string | null;
  source: string;
};

function day(value: string, required: boolean): string | null {
  const clean = value.trim();
  if (!clean && !required) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) throw new Error("person_attribute_date_invalid");
  const parsed = new Date(`${clean}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== clean) {
    throw new Error("person_attribute_date_invalid");
  }
  return clean;
}

export function parsePersonAttributeCsv(bytes: Buffer): PersonAttributeInputRow[] {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > 4 * 1024 * 1024 || bytes.includes(0)) {
    throw new Error("person_attribute_file_invalid");
  }
  const text = bytes.toString("utf8");
  if (text.includes("\uFFFD")) throw new Error("person_attribute_encoding_invalid");
  const parsed = Papa.parse<string[]>(text, {
    delimiter: ",",
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length || parsed.data.length < 2 || parsed.data.length > 25_001) {
    throw new Error("person_attribute_csv_invalid");
  }
  const headers = parsed.data[0].map((value) => String(value).trim());
  if (headers.length !== HEADERS.length || headers.some((value, index) => value !== HEADERS[index])) {
    throw new Error("person_attribute_headers_invalid");
  }
  const seen = new Set<string>();
  return parsed.data.slice(1).map((values) => {
    if (values.length !== HEADERS.length) throw new Error("person_attribute_row_invalid");
    const [personRefRaw, keyRaw, valueRaw, fromRaw, untilRaw, sourceRaw] = values.map(String);
    const personRef = personRefRaw.normalize("NFKC").trim();
    const attributeKey = keyRaw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const value = valueRaw.normalize("NFKC").trim();
    const source = sourceRaw.normalize("NFKC").trim();
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{3,199}$/.test(personRef)
      || !/^[a-z][a-z0-9_]{1,63}$/.test(attributeKey)
      || FORBIDDEN_KEY.test(attributeKey)
      || value.length < 1 || value.length > 2000
      || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
      || source.length < 1 || source.length > 120
    ) throw new Error("person_attribute_row_invalid");
    const validFrom = day(fromRaw, true);
    const validUntil = day(untilRaw, false);
    if (!validFrom || (validUntil && validUntil < validFrom)) {
      throw new Error("person_attribute_date_invalid");
    }
    const identity = `${personRef}:${attributeKey}:${validFrom}`;
    if (seen.has(identity)) throw new Error("person_attribute_duplicate");
    seen.add(identity);
    return { personRef, attributeKey, value, validFrom, validUntil, source };
  });
}
