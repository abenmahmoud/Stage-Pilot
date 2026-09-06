// Décision pure de l'écran « ENT inactif » du coffre de codes — LOT 5 du
// plan du 6 septembre 2026
// (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`).
//
// Traduit la réponse déjà recettée de la route du LOT 3
// (`api/vault/ent-inactif.ts`, `handleEntInactifVaultRequest`) en état
// d'écran, sans réseau ni DOM : testable seul, même esprit que
// `decideFlashValidationRoute` (`shared/flash-validation-route.ts`). C'est la
// page (`src/pages/coffre/CoffreEntInactifPage.tsx`) qui appelle la route et
// cette fonction, jamais l'inverse.
//
// Depuis le LOT 3 du plan de lecture
// (`docs/operations/PLAN_LECTURE_COFFRE_2026-09-06.md`), la route peut
// renvoyer une valeur déchiffrée non nulle — mais seulement si
// `CODE_VAULT_REVEAL_ENABLED` est ouvert (fermé par défaut, jamais activé par
// ce plan). Ce module ne fait que transporter `value`/`reason` tels quels
// vers l'état `revealed` : aucune règle de déchiffrement ni de lecture de
// `code_vault_private_rows` ne vit ici (voir l'en-tête de
// `api/_shared/code-vault-read.ts` pour le point de lecture unique).

import type { VaultAccessRefusalReason } from "./code-vault-policy.js";
import type { EntInactifPhase, VaultProofChannel } from "./code-vault-journeys.js";

/**
 * Forme structurelle de `EntInactifRouteResult`
 * (`api/_shared/code-vault-ent-inactif-route.ts`), dupliquée ici pour ne pas
 * faire dépendre `shared/` de `api/_shared/` — la même raison que
 * `code-vault-journeys.ts` ne connaît que des types purs. Les deux types
 * doivent rester en phase manuellement ; un désaccord serait détecté par
 * `scripts/test-code-vault-ent-inactif-screen.mjs`, qui rejoue les formes
 * réelles renvoyées par la route.
 */
export type EntInactifRouteResultLike =
  | { outcome: "denied"; reason: VaultAccessRefusalReason }
  | {
      outcome: "step";
      action:
        | { kind: "send_proof"; channel: VaultProofChannel }
        | { kind: "await_verification" }
        | { kind: "form_fallback"; reasonCode: string }
        | { kind: "invite_password_reset" };
    }
  | {
      outcome: "displayed";
      remainingDisplaysToday: number;
      revealedAt: string;
      value: string | null;
      reason: "reveal_disabled" | "not_displayed" | null;
    };

export type EntInactifScreenState =
  | { kind: "denied"; reason: VaultAccessRefusalReason }
  | { kind: "send_proof"; channel: VaultProofChannel }
  | { kind: "awaiting_verification" }
  | { kind: "form_fallback"; reasonCode: string }
  | { kind: "password_reset_invited" }
  | {
      kind: "revealed";
      remainingDisplaysToday: number;
      revealedAt: Date;
      /** Non nul seulement si la route a effectivement déchiffré une valeur (drapeau ouvert, remise trouvée). */
      value: string | null;
      /** Motif de fermeture quand `value` est nul — `null` quand une valeur a réellement été renvoyée. */
      reason: "reveal_disabled" | "not_displayed" | null;
    };

export function decideEntInactifScreenState(result: EntInactifRouteResultLike): EntInactifScreenState {
  if (result.outcome === "denied") {
    return { kind: "denied", reason: result.reason };
  }
  if (result.outcome === "displayed") {
    return {
      kind: "revealed",
      remainingDisplaysToday: result.remainingDisplaysToday,
      revealedAt: new Date(result.revealedAt),
      value: result.value,
      reason: result.reason,
    };
  }
  switch (result.action.kind) {
    case "send_proof":
      return { kind: "send_proof", channel: result.action.channel };
    case "await_verification":
      return { kind: "awaiting_verification" };
    case "form_fallback":
      return { kind: "form_fallback", reasonCode: result.action.reasonCode };
    case "invite_password_reset":
      return { kind: "password_reset_invited" };
  }
}

/**
 * Phase à redemander après l'expiration d'un affichage
 * (`CodeVaultSecureDisplay.onExpire`) : toujours repartir de `before_proof`,
 * jamais retenter `verified`. C'est le même garde-fou que le défaut n°1 du
 * LOT 3 (une phase `verified` déclarée ne doit jamais re-remettre un
 * affichage expiré), appliqué ici côté écran : une expiration exige une
 * nouvelle demande de preuve d'identité, pas un simple nouvel essai.
 */
export const ENT_INACTIF_PHASE_AFTER_DISPLAY_EXPIRY: EntInactifPhase = "before_proof";
