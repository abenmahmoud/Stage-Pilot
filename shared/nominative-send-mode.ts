// Les trois modes d'envoi, et la garantie propre a chacun.
//
// Le mode « test » de l'ancien code prenait les trois premiers contacts et
// pouvait appeler le transport reel : un mode de demonstration capable
// d'ecrire a de vraies personnes. On le remplace par trois modes dont les
// garanties sont differentes et verifiables :
//
//   simulation   : aucun appel fournisseur, aucune adresse reelle, donnees
//                  fictives uniquement. C'est le seul mode utilisable sans
//                  drapeau ouvert.
//   sample       : un exemplaire fictif vers UNE adresse de test choisie
//                  explicitement. Rien n'est tire du fichier reel.
//   batch        : le lot approuve, vers les contacts autorises.
//
// Aucune de ces regles ne depend de l'interface : elles sont ici, testees ici,
// et l'interface comme l'agent passent par les memes fonctions.

import {
  mergeNominativeMessage,
  NominativeMergeError,
  parseNominativeBeneficiaryContext,
  type NominativeBeneficiaryContext,
  type NominativeMergedMessage,
  type NominativeTemplate,
} from "./nominative-merge.js";
import {
  parseNominativeValueRecord,
  type NominativeHasher,
  type NominativeValueRecord,
} from "./nominative-value-policy.js";
import type { FrozenNominativeBatch } from "./nominative-batch.js";

export const NOMINATIVE_SEND_MODES = ["simulation", "sample", "batch"] as const;
export type NominativeSendMode = (typeof NOMINATIVE_SEND_MODES)[number];

export class NominativeSendError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("L'envoi nominatif est refuse");
    this.reason = reason;
  }
}

export type NominativeSendFlags = {
  /** COMMUNICATIONS_ENABLED */
  moduleEnabled: boolean;
  /** COMMUNICATION_SEND_ENABLED */
  sendingEnabled: boolean;
  /** Adresse de test explicitement choisie par le referent, pour le mode sample. */
  sampleRecipientChosen: boolean;
};

export type NominativeSendAuthorization = {
  mode: NominativeSendMode;
  /** Vrai seulement si ce mode a le droit de contacter le fournisseur. */
  providerCallAllowed: boolean;
  /** Nombre maximal de destinataires reels que ce mode peut atteindre. */
  maxRealRecipients: number;
};

/**
 * Autorisation d'un mode. La simulation est toujours permise : c'est
 * precisement le mode qui ne peut rien envoyer. Les deux autres exigent que le
 * module ET l'envoi soient ouverts.
 */
export function authorizeNominativeSend(
  mode: unknown,
  flags: NominativeSendFlags
): NominativeSendAuthorization {
  if (typeof mode !== "string" || !(NOMINATIVE_SEND_MODES as readonly string[]).includes(mode)) {
    throw new NominativeSendError("mode_invalid");
  }
  if (mode === "simulation") {
    return { mode, providerCallAllowed: false, maxRealRecipients: 0 };
  }
  if (!flags.moduleEnabled) throw new NominativeSendError("module_disabled");
  if (!flags.sendingEnabled) throw new NominativeSendError("sending_disabled");
  if (mode === "sample") {
    if (!flags.sampleRecipientChosen) throw new NominativeSendError("sample_recipient_missing");
    return { mode, providerCallAllowed: true, maxRealRecipients: 1 };
  }
  return { mode: "batch", providerCallAllowed: true, maxRealRecipients: Number.MAX_SAFE_INTEGER };
}

export type NominativePreviewItem = {
  beneficiaryRef: string;
  contactRef: string;
  valueVersion: string;
  subject: string;
  preheader: string;
  bodyText: string;
};

export type NominativePreview = {
  mode: NominativeSendMode;
  providerCallsPlanned: number;
  items: NominativePreviewItem[];
  /** Ce qui manquait pour rendre une ligne du lot, s'il en manquait. */
  blocked: Array<{ beneficiaryRef: string; reason: string }>;
};

/**
 * Fusion de TOUTES les lignes du lot, une par une.
 *
 * L'ancien code calculait un corps de message avant la boucle d'envoi et le
 * reutilisait. Ici la fusion est faite par livraison, et chaque item porte la
 * version de valeur qui a servi : deux livraisons vers la meme adresse ont
 * deux corps differents et deux versions differentes.
 */
export function buildNominativePreview(input: {
  mode: NominativeSendMode;
  batch: FrozenNominativeBatch;
  template: NominativeTemplate;
  beneficiaries: ReadonlyMap<string, NominativeBeneficiaryContext>;
  records: ReadonlyMap<string, NominativeValueRecord>;
}): NominativePreview {
  const items: NominativePreviewItem[] = [];
  const blocked: Array<{ beneficiaryRef: string; reason: string }> = [];

  for (const line of input.batch.lines) {
    const beneficiary = input.beneficiaries.get(line.beneficiaryRef);
    const record = input.records.get(line.beneficiaryRef);
    if (!beneficiary) {
      blocked.push({ beneficiaryRef: line.beneficiaryRef, reason: "beneficiary_unknown" });
      continue;
    }
    if (!record) {
      blocked.push({ beneficiaryRef: line.beneficiaryRef, reason: "value_unknown" });
      continue;
    }
    if (record.valueVersion !== line.valueVersion) {
      // La valeur a change depuis la validation : on ne remplace pas en
      // silence, on signale.
      blocked.push({ beneficiaryRef: line.beneficiaryRef, reason: "value_version_changed" });
      continue;
    }
    let merged: NominativeMergedMessage;
    try {
      merged = mergeNominativeMessage({ template: input.template, beneficiary, record });
    } catch (error) {
      if (error instanceof NominativeMergeError) {
        blocked.push({ beneficiaryRef: line.beneficiaryRef, reason: error.reason });
        continue;
      }
      throw error;
    }
    items.push({
      beneficiaryRef: line.beneficiaryRef,
      contactRef: line.contactRef,
      valueVersion: merged.valueVersion,
      subject: merged.subject,
      preheader: merged.preheader,
      bodyText: merged.bodyText,
    });
  }

  return {
    mode: input.mode,
    providerCallsPlanned: input.mode === "simulation" ? 0 : items.length,
    items,
    blocked,
  };
}

/**
 * Un exemplaire fictif, pour se rendre compte du rendu. Rien n'est lu dans le
 * fichier reel : le beneficiaire et la valeur sont inventes ici.
 */
export function buildNominativeSampleMessage(input: {
  template: NominativeTemplate;
  schoolYear: string;
  sourceRef: string;
  hasherFactory: () => NominativeHasher;
}): NominativeMergedMessage {
  const beneficiary = parseNominativeBeneficiaryContext({
    beneficiaryRef: "eleve:exemple0000",
    firstName: "Prenom",
    lastName: "Exemple",
    classLabel: "2nde 0",
  });
  const record = parseNominativeValueRecord(
    {
      beneficiaryRef: beneficiary.beneficiaryRef,
      valueFunction: "cantine_information",
      value: "0000",
      schoolYear: input.schoolYear,
      sourceRef: input.sourceRef,
    },
    input.hasherFactory
  );
  return mergeNominativeMessage({ template: input.template, beneficiary, record });
}

export type NominativeDeliveryState =
  | "simulated"
  | "pending"
  | "handed_to_provider"
  | "delivered"
  | "failed"
  | "result_uncertain";

export const NOMINATIVE_DELIVERY_STATES: readonly NominativeDeliveryState[] = [
  "simulated",
  "pending",
  "handed_to_provider",
  "delivered",
  "failed",
  "result_uncertain",
];

/**
 * Etat d'une livraison a partir du recu fournisseur.
 *
 * Une reponse incomplete ne devient jamais un succes : sans identifiant
 * fournisseur, l'etat est « resultat a verifier », et le rapprochement des
 * recus doit avoir lieu avant tout renvoi. On n'invente pas l'identifiant
 * manquant.
 */
export function nominativeDeliveryState(input: {
  mode: NominativeSendMode;
  handedToProvider: boolean;
  providerMessageRef: string | null;
  providerConfirmedDelivery: boolean;
  failureCode: string | null;
}): NominativeDeliveryState {
  if (input.mode === "simulation") return "simulated";
  if (!input.handedToProvider) return input.failureCode ? "failed" : "pending";
  if (!input.providerMessageRef) return "result_uncertain";
  if (input.failureCode) return "failed";
  return input.providerConfirmedDelivery ? "delivered" : "handed_to_provider";
}

/** Le renvoi n'est admissible que sur un echec avere, jamais sur un doute. */
export function isNominativeRetryAllowed(state: NominativeDeliveryState): boolean {
  return state === "failed";
}
