import { SUPPORT_SERVICES, type SupportService } from "./support-agent-access.ts";
import type {
  KnowledgeClassification,
  SkillEvaluation,
} from "./skill-registry-policy.ts";

export const KNOWLEDGE_SOURCE_TYPES = [
  "official_url",
  "internal_document",
  "procedure",
  "directory",
  "calendar",
] as const;

export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export type KnowledgeSourceInput = {
  title: string;
  sourceType: KnowledgeSourceType;
  uri: string;
  classification: KnowledgeClassification;
  serviceCodes: SupportService[];
  validFrom: Date;
  expiresAt: Date | null;
  checksum: string;
};

export type AgentSkillDraftInput = {
  skillKey: string;
  name: string;
  domain: string;
  version: string;
  dataClassification: KnowledgeClassification;
  instructions: string;
  allowedTools: string[];
  sourceIds: string[];
  reviewDueAt: Date;
  evaluations: SkillEvaluation[];
};

const CLASSIFICATIONS: KnowledgeClassification[] = [
  "public",
  "internal",
  "personal",
  "sensitive",
];

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Les données sont invalides");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string") throw new Error(`${label} est obligatoire`);
  const clean = value.trim();
  if (clean.length < min || clean.length > max) {
    throw new Error(`${label} doit contenir entre ${min} et ${max} caractères`);
  }
  return clean;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${label} est invalide`);
  }
  return value as T;
}

function dateValue(value: unknown, label: string): Date {
  if (typeof value !== "string") throw new Error(`${label} est obligatoire`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} est invalide`);
  return parsed;
}

function optionalDate(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  return dateValue(value, label);
}

function uniqueStrings(value: unknown, label: string, max: number): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} doit être une liste`);
  const values = [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))];
  if (values.length > max) throw new Error(`${label} contient trop d’éléments`);
  return values;
}

function serviceCodes(value: unknown): SupportService[] {
  return uniqueStrings(value ?? [], "Services", SUPPORT_SERVICES.length).map((entry) =>
    enumValue(entry, SUPPORT_SERVICES, "Service")
  );
}

function uuidList(value: unknown): string[] {
  const values = uniqueStrings(value, "Sources", 20);
  if (values.some((entry) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry))) {
    throw new Error("Une source est invalide");
  }
  return values;
}

function evaluations(value: unknown): SkillEvaluation[] {
  if (!Array.isArray(value) || value.length > 50) {
    throw new Error("Les tests sont invalides");
  }
  return value.map((entry) => {
    const item = record(entry);
    const testCaseKey = text(item.testCaseKey, "Identifiant du test", 2, 100);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(testCaseKey)) {
      throw new Error("L’identifiant d’un test est invalide");
    }
    return {
      testCaseKey,
      kind: enumValue(item.kind, ["positive", "ambiguous", "forbidden"] as const, "Type de test"),
      result: enumValue(item.result, ["pass", "fail", "needs_review"] as const, "Résultat du test"),
    };
  });
}

export function parseKnowledgeSourceInput(value: unknown): KnowledgeSourceInput {
  const input = record(value);
  const classification = enumValue(input.classification, CLASSIFICATIONS, "Classification");
  const services = serviceCodes(input.serviceCodes);
  if (classification === "public" && services.length > 0) {
    throw new Error("Une source publique ne doit pas être limitée à un service");
  }
  const validFrom = dateValue(input.validFrom, "Début de validité");
  const expiresAt = optionalDate(input.expiresAt, "Fin de validité");
  if (expiresAt && expiresAt <= validFrom) {
    throw new Error("La fin de validité doit suivre le début");
  }
  const checksum = text(input.checksum, "Empreinte SHA-256", 64, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error("L’empreinte SHA-256 est invalide");
  return {
    title: text(input.title, "Titre", 2, 180),
    sourceType: enumValue(input.sourceType, KNOWLEDGE_SOURCE_TYPES, "Type de source"),
    uri: text(input.uri, "Adresse ou référence privée", 3, 1000),
    classification,
    serviceCodes: services,
    validFrom,
    expiresAt,
    checksum,
  };
}

export function parseAgentSkillDraftInput(value: unknown): AgentSkillDraftInput {
  const input = record(value);
  const skillKey = text(input.skillKey, "Identifiant de compétence", 2, 100);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillKey)) {
    throw new Error("L’identifiant de compétence est invalide");
  }
  const version = text(input.version, "Version", 5, 30);
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("La version doit suivre le format 1.0.0");
  const reviewDueAt = dateValue(input.reviewDueAt, "Prochaine révision");
  if (reviewDueAt <= new Date()) throw new Error("La prochaine révision doit être dans le futur");
  const allowedTools = uniqueStrings(input.allowedTools ?? [], "Outils", 20);
  if (allowedTools.some((tool) => !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(tool))) {
    throw new Error("Un outil autorisé est invalide");
  }
  return {
    skillKey,
    name: text(input.name, "Nom", 2, 160),
    domain: text(input.domain, "Domaine", 2, 100),
    version,
    dataClassification: enumValue(input.dataClassification, CLASSIFICATIONS, "Classification"),
    instructions: text(input.instructions, "Instructions", 20, 12_000),
    allowedTools,
    sourceIds: uuidList(input.sourceIds ?? []),
    reviewDueAt,
    evaluations: evaluations(input.evaluations ?? []),
  };
}
