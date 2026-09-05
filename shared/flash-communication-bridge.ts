// LOT 4 du plan de publication publique
// (docs/operations/PLAN_FLASH_PUBLIC_2026-09-05.md) : calcule, sans base ni
// reseau, ce qu'il faut ecrire pour raccorder une publication flash a la
// file durable existante du centre de communication (spec 005) -- jamais une
// seconde file (regle commune n4). La resolution en insertions reelles est
// le travail de api/_shared/flash-communication-bridge-persistence.ts,
// jamais recalculee ici.
//
// Limite assumee et documentee (voir la migration
// 20260905160000_add_flash_communication_bridge_source_type.sql) :
// `communication_deliveries.channel` reste limite a 'email' seul depuis sa
// creation. Ni push (aucun fournisseur, aucune table, nulle part dans ce
// depot) ni sms (jamais ajoute a ce CHECK) n'ont de place dans la file
// durable aujourd'hui. Cette fonction ne retient donc que les cibles de
// canal email d'un plan d'envoi flash (shared/flash-dispatch-plan.ts) ; les
// cibles push et sms en sont exclues sans ambiguite, jamais silencieusement
// perdues -- elles restent portees par `flash_notification_dispatches`
// (LOT 3), inchange par ce lot.

import { createHash } from "node:crypto";
import type { FlashDispatchTarget } from "./flash-dispatch-plan.js";

const GROUP_REF_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{2,79}$/;
const VERSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FlashCommunicationBridgeInput = {
  flashInfoVersionId: string;
  title: string;
  bodyMarkdown: string;
  dispatchTargets: readonly FlashDispatchTarget[];
};

export type FlashCommunicationBridgeRequest = {
  sourceFingerprint: string;
  sourceLabel: string;
  title: string;
  bodyMarkdown: string;
  contentHash: string;
  groupRefs: readonly string[];
};

/**
 * `null` si aucune cible email n'existe dans le plan (normale ; importante ou
 * urgente sans email choisi) -- rien a raccorder, jamais une ligne vide.
 */
export function buildFlashCommunicationBridgeRequest(
  input: FlashCommunicationBridgeInput
): FlashCommunicationBridgeRequest | null {
  if (!VERSION_ID_PATTERN.test(input.flashInfoVersionId)) {
    throw new RangeError("flash_communication_bridge_version_id_invalid");
  }
  const title = input.title.trim();
  if (title.length < 2 || title.length > 180) {
    throw new RangeError("flash_communication_bridge_title_invalid");
  }
  if (input.bodyMarkdown.length < 1 || input.bodyMarkdown.length > 100000) {
    throw new RangeError("flash_communication_bridge_body_invalid");
  }

  const groupRefs = [...new Set(
    input.dispatchTargets
      .map((target) => (target.channel === "email" ? target.groupRef : null))
      .filter((groupRef): groupRef is string => groupRef !== null)
  )].sort();

  if (groupRefs.length === 0) return null;
  for (const groupRef of groupRefs) {
    if (!GROUP_REF_PATTERN.test(groupRef)) {
      throw new RangeError("flash_communication_bridge_group_ref_invalid");
    }
  }

  const sourceFingerprint = createHash("sha256")
    .update(`flash-communication-bridge:v1:${input.flashInfoVersionId}`)
    .digest("hex");
  const contentHash = createHash("sha256")
    .update(JSON.stringify({ title, bodyMarkdown: input.bodyMarkdown, groupRefs }))
    .digest("hex");

  return {
    sourceFingerprint,
    sourceLabel: title.slice(0, 200),
    title,
    bodyMarkdown: input.bodyMarkdown,
    contentHash,
    groupRefs,
  };
}
