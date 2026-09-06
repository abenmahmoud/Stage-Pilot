// LOT 5 du plan de connaissance OB1 (2026-09-05) : file de validation des
// propositions de connaissance et passage « publié -> connaissance ».
//
// Reutilise sans les reecrire les helpers de validation de
// `shared/knowledge-registry-input.ts` (LOT 1/registre existant) et la regle
// de compatibilite provenance/politique d'usage de
// `shared/knowledge-use-policy.ts` (LOT 1/LOT 2). Aucune base, aucun reseau :
// module pur, comme le reste de la famille OB1.

import {
  dateValue,
  enumValue,
  optionalDate,
  record,
  serviceCodes,
  text,
} from "./knowledge-registry-input.js";
import {
  provenanceAllowsUsePolicy,
  type KnowledgeSourceProvenanceStatus,
  type KnowledgeSourceUsePolicy,
} from "./knowledge-use-policy.js";
import type { KnowledgeClassification } from "./skill-registry-policy.js";
import type { SupportService } from "./support-agent-access.js";
import { detectForbiddenSupportSecret } from "./support-secret-policy.js";

export const KNOWLEDGE_SOURCE_PROPOSAL_ORIGINS = ["conversation", "flash_publication"] as const;
export type KnowledgeSourceProposalOrigin = (typeof KNOWLEDGE_SOURCE_PROPOSAL_ORIGINS)[number];

export const KNOWLEDGE_SOURCE_PROPOSAL_STATUSES = ["pending_review", "approved", "rejected"] as const;
export type KnowledgeSourceProposalStatus = (typeof KNOWLEDGE_SOURCE_PROPOSAL_STATUSES)[number];

// Une affirmation nee en conversation reste, par construction, une
// observation ou une inference — jamais un import ni un document officiel
// (regle 2 du plan : « une affirmation IA commence en proposition »).
const CONVERSATION_PROVENANCE_STATUSES: readonly KnowledgeSourceProvenanceStatus[] = [
  "observed",
  "inferred",
  "user_confirmed",
  "generated",
];

// Une actualite deja publiee est un contenu humain officiel : jamais
// « inferred »/« generated » (reserves a une affirmation nee d'une
// conversation), jamais « observed » (reserve a une observation brute).
const FLASH_PUBLICATION_PROVENANCE_STATUSES: readonly KnowledgeSourceProvenanceStatus[] = [
  "imported",
  "user_confirmed",
];

export function allowedProvenanceStatuses(
  origin: KnowledgeSourceProposalOrigin
): readonly KnowledgeSourceProvenanceStatus[] {
  return origin === "conversation"
    ? CONVERSATION_PROVENANCE_STATUSES
    : FLASH_PUBLICATION_PROVENANCE_STATUSES;
}

// Le type de source refletant l'origine de la file (LOT 5), distinct des
// types de saisie directe du registre (LOT 1).
export function knowledgeSourceTypeForOrigin(
  origin: KnowledgeSourceProposalOrigin
): "conversation" | "flash_publication" {
  return origin;
}

export type KnowledgeSourceProposalCommonFields = {
  classification: KnowledgeClassification;
  serviceCodes: SupportService[];
  provenanceStatus: KnowledgeSourceProvenanceStatus;
  usePolicy: KnowledgeSourceUsePolicy;
};

const CLASSIFICATIONS: KnowledgeClassification[] = ["public", "internal", "personal", "sensitive"];

function parseCommonFields(
  input: Record<string, unknown>,
  origin: KnowledgeSourceProposalOrigin
): KnowledgeSourceProposalCommonFields {
  const classification = enumValue(input.classification, CLASSIFICATIONS, "Classification");
  const services = serviceCodes(input.serviceCodes);
  if (classification === "public" && services.length > 0) {
    throw new Error("Une proposition publique ne doit pas être limitée à un service");
  }
  const allowedProvenance = allowedProvenanceStatuses(origin);
  const provenanceStatus = enumValue(
    input.provenanceStatus,
    allowedProvenance,
    "Origine déclarée de la proposition"
  );
  const usePolicy = enumValue(
    input.usePolicy,
    ["can_use_as_instruction", "can_use_as_evidence", "requires_human_confirmation", "do_not_inject_automatically"] as const,
    "Politique d'usage"
  );
  if (!provenanceAllowsUsePolicy(provenanceStatus, usePolicy)) {
    throw new Error(
      "Une proposition générée ou inférée ne peut jamais être utilisée comme consigne (can_use_as_instruction)"
    );
  }
  return { classification, serviceCodes: services, provenanceStatus, usePolicy };
}

export type ConversationProposalInput = KnowledgeSourceProposalCommonFields & {
  origin: "conversation";
  conversationId: string;
  title: string;
  candidateText: string;
  validFrom: Date;
  expiresAt: Date | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valide la soumission d'une proposition « issue d'une discussion » (bullet 1
 * du plan, LOT 5). `candidateText` est le texte deja recopie/redige par un
 * responsable a partir d'une conversation reelle — ce module ne lit aucune
 * conversation lui-meme (aucune base ici). La detection des donnees
 * personnelles/secrets se fait cote appelant (reutilise
 * `documentPrivacySignals`, deja utilise par le pipeline documentaire), pas
 * ici : ce module ne fait que valider la forme des champs declaratifs.
 */
export function parseConversationProposalInput(value: unknown): ConversationProposalInput {
  const input = record(value);
  const conversationId = text(input.conversationId, "Identifiant de conversation", 36, 36);
  if (!UUID_PATTERN.test(conversationId)) {
    throw new Error("Identifiant de conversation est invalide");
  }
  const validFrom = dateValue(input.validFrom, "Début de validité");
  const expiresAt = optionalDate(input.expiresAt, "Fin de validité");
  if (expiresAt && expiresAt <= validFrom) {
    throw new Error("La fin de validité doit suivre le début");
  }
  return {
    origin: "conversation",
    conversationId,
    title: text(input.title, "Titre", 2, 180),
    candidateText: text(input.candidateText, "Texte proposé", 20, 8_000),
    validFrom,
    expiresAt,
    ...parseCommonFields(input, "conversation"),
  };
}

export type FlashProposalActivationInput = KnowledgeSourceProposalCommonFields & {
  origin: "flash_publication";
};

/**
 * Valide les seuls champs que l'administrateur choisit reellement pour
 * « Rendre utilisable par l'agent » (bullet 2 du plan, LOT 5). Le titre, le
 * texte, `validFrom` et `expiresAt` viennent de la version flash publiee
 * elle-meme (jamais d'une saisie libre) : voir
 * `api/flash/proposals/[id]/knowledge.ts`. Copier `expiresAt` depuis la
 * version flash est ce qui garantit qu'une expiration flash retire aussi la
 * connaissance derivee, sans code de retrait supplementaire (LOT 3 exclut
 * deja toute source expiree).
 */
export function parseFlashProposalActivationInput(value: unknown): FlashProposalActivationInput {
  const input = record(value);
  return { origin: "flash_publication", ...parseCommonFields(input, "flash_publication") };
}

// Reutilise `detectForbiddenSupportSecret` (deja partage, deja utilise par
// `shared/knowledge-registry-input.ts` pour les preuves de test des
// competences) plutot que de dupliquer le detecteur de secrets du pipeline
// documentaire (`workers/knowledge-document-extractor.mjs`), qui vit dans
// `workers/` — sens de dependance inverse a celui de ce module partage.
// Seules les deux expressions email/telephone sont reprises telles quelles
// (bullet 1 du plan : « expurgee des donnees personnelles »).
export function detectPersonalOrSecretSignals(value: string): string[] {
  const signals: string[] = [];
  if (/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(value)) signals.push("email_address");
  if (/(?:\+33|0)[1-9](?:[ .()-]*\d{2}){4}\b/.test(value)) signals.push("phone_number");
  const secret = detectForbiddenSupportSecret(value);
  if (secret) signals.push(secret);
  return signals;
}

export type KnowledgeSourceProposalDecisionInput = { action: "approve" | "reject"; note: string };

export function parseKnowledgeSourceProposalDecisionInput(
  value: unknown
): KnowledgeSourceProposalDecisionInput {
  const input = record(value);
  const action = enumValue(input.action, ["approve", "reject"] as const, "Décision");
  const note = text(input.note, "Note de validation", 10, 1_000);
  return { action, note };
}
