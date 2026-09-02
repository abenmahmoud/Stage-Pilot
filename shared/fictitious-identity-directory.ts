const HEADERS = [
  "record_type",
  "person_ref",
  "person_type",
  "first_name",
  "last_name",
  "academic_email",
  "personal_email",
  "phone",
  "class_ref",
  "service_code",
  "active_from",
  "active_until",
  "subject_person_ref",
  "relationship_type",
  "object_ref",
  "valid_from",
  "valid_until",
];

const SERVICES = [
  "referent_numerique",
  "ddfpt",
  "secretariat",
  "vie_scolaire",
  "intendance",
  "direction",
  "administration",
];

const STUDENT_COUNT = 1200;
const GUARDIAN_COUNT = 2600;
const STAFF_COUNT = 200;

export const FICTITIOUS_IDENTITY_DIRECTORY_PERSON_COUNT =
  STUDENT_COUNT + GUARDIAN_COUNT + STAFF_COUNT;
export const FICTITIOUS_IDENTITY_DIRECTORY_RELATIONSHIP_COUNT =
  GUARDIAN_COUNT + STUDENT_COUNT;

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function line(values: string[]): string {
  return values.map(csvCell).join(",");
}

function number(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function personRow(input: {
  reference: string;
  type: "student" | "guardian" | "staff";
  firstName: string;
  lastName: string;
  academicEmail?: string;
  personalEmail?: string;
  phone?: string;
  classRef?: string;
  serviceCode?: string;
}): string[] {
  return [
    "person",
    input.reference,
    input.type,
    input.firstName,
    input.lastName,
    input.academicEmail ?? "",
    input.personalEmail ?? "",
    input.phone ?? "",
    input.classRef ?? "",
    input.serviceCode ?? "",
    "2026-09-01",
    "2027-08-31",
    "",
    "",
    "",
    "",
    "",
  ];
}

function relationshipRow(subject: string, type: string, object: string): string[] {
  return [
    "relationship",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    subject,
    type,
    object,
    "2026-09-01",
    "2027-08-31",
  ];
}

export function generateFictitiousIdentityDirectory(): string {
  const rows: string[][] = [];

  for (let index = 1; index <= STUDENT_COUNT; index += 1) {
    const id = number(index, 4);
    rows.push(personRow({
      reference: `STU-DEMO-${id}`,
      type: "student",
      firstName: `Eleve${id}`,
      lastName: `Fictif${id}`,
      academicEmail: `eleve.${id}@example.test`,
      classRef: `CLASSE-DEMO-${number(((index - 1) % 40) + 1, 2)}`,
    }));
  }

  for (let index = 1; index <= GUARDIAN_COUNT; index += 1) {
    const id = number(index, 4);
    rows.push(personRow({
      reference: `RESP-DEMO-${id}`,
      type: "guardian",
      firstName: `Responsable${id}`,
      lastName: `Fictif${id}`,
      personalEmail: `responsable.${id}@example.test`,
      phone: `+337${number(index, 8)}`,
    }));
  }

  for (let index = 1; index <= STAFF_COUNT; index += 1) {
    const id = number(index, 3);
    rows.push(personRow({
      reference: `STAFF-DEMO-${id}`,
      type: "staff",
      firstName: `Personnel${id}`,
      lastName: `Fictif${id}`,
      academicEmail: `personnel.${id}@example.test`,
      serviceCode: SERVICES[(index - 1) % SERVICES.length],
    }));
  }

  for (let index = 1; index <= GUARDIAN_COUNT; index += 1) {
    const guardianId = number(index, 4);
    const studentId = number(((index - 1) % STUDENT_COUNT) + 1, 4);
    rows.push(relationshipRow(
      `RESP-DEMO-${guardianId}`,
      "guardian_of",
      `STU-DEMO-${studentId}`
    ));
  }

  for (let index = 1; index <= STUDENT_COUNT; index += 1) {
    const id = number(index, 4);
    rows.push(relationshipRow(
      `STU-DEMO-${id}`,
      "member_of",
      `CLASSE-DEMO-${number(((index - 1) % 40) + 1, 2)}`
    ));
  }

  return [line(HEADERS), ...rows.map(line)].join("\n");
}
