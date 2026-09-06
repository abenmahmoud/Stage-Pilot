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
// Ce module ne reçoit jamais la valeur déchiffrée du code : la route LOT 3
// s'arrête à la décision d'autorisation, à l'attribution et à la comptabilité
// d'affichage (voir son en-tête : « Ce module ne déchiffre et ne renvoie
// jamais la valeur du code »). L'état `revealed` ci-dessous porte donc un
// champ `value` structurellement nul aujourd'hui — documenté explicitement
// dans `docs/operations/night-logs/BRANCHE-LOT5.md` comme le point qui
// empêche un affichage réellement rempli, pas seulement monté. Le champ
// existe pour que la page reste prête le jour où un point de lecture unique
// (symétrique de `api/_shared/code-vault-write.ts`, LOT 1) sera tranché.

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
  | { outcome: "displayed"; remainingDisplaysToday: number; revealedAt: string };

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
      /** Toujours `null` tant qu'aucun point de lecture du coffre n'existe (voir en-tête). */
      value: string | null;
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
      value: null,
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
