// Qui a le droit de valider une information flash.
//
// La politique 2026-2027 §13 dit « le referent numerique ou la DDFPT valide ».
// Ces deux-la ne sont pas des roles LyceeGest : ce sont des SERVICES portes par
// l'appartenance d'un membre a son etablissement (`serviceCodes`), le meme
// mecanisme que la file support. C'est donc le service, jamais le role, qui
// ouvre la validation. Consequence voulue : un compte `administration` sans ce
// service ne valide pas, et la matrice reste configurable par etablissement
// sans toucher au code (§7).

import type { SupportService } from "./support-agent-access.js";

export const FLASH_VALIDATION_SERVICES: readonly SupportService[] = [
  "referent_numerique",
  "ddfpt",
];

export class FlashValidationAccessError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("L'autorisation de validation d'information flash est invalide");
    this.reason = reason;
  }
}

export type FlashValidationDecision = {
  allowed: boolean;
  /** Motif du refus, ou null quand la validation est permise. */
  reason: string | null;
  /**
   * Vrai quand la personne valide sa propre proposition. Ce n'est pas un refus
   * aujourd'hui (voir ci-dessous), mais l'information doit etre conservee avec
   * la version : c'est ce qui rend le cas visible dans le journal.
   */
  selfValidated: boolean;
  /** Service par lequel la validation est ouverte, pour la trace. */
  grantedByService: SupportService | "superadmin" | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function actorRef(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new FlashValidationAccessError(field + "_invalid");
  }
  return value;
}

function serviceList(value: unknown): SupportService[] {
  if (!Array.isArray(value)) throw new FlashValidationAccessError("service_codes_invalid");
  return value.filter((code): code is SupportService =>
    (FLASH_VALIDATION_SERVICES as readonly string[]).includes(code as string)
  );
}

/**
 * Le service (ou le superadmin) par lequel la validation est ouverte pour ce
 * role/ces services, independamment de toute proposition precise. Extrait de
 * `decideFlashValidationAccess` pour etre reutilise tel quel par la file de
 * validation (LOT 3) : savoir si un compte peut voir la file est une question
 * plus large que savoir s'il peut decider UNE proposition (qui depend en plus
 * de `selfValidated`).
 */
export function grantedFlashValidationService(
  role: unknown,
  serviceCodes: unknown
): SupportService | "superadmin" | null {
  if (typeof role !== "string" || role.length === 0) {
    throw new FlashValidationAccessError("role_invalid");
  }
  const services = serviceList(serviceCodes);
  return role === "superadmin" ? "superadmin" : services[0] ?? null;
}

/**
 * Auto-validation : decidee par Adel le 5 septembre 2026, autorisee.
 *
 * Il est aujourd'hui le seul referent numerique de l'etablissement ; exiger une
 * seconde personne bloquerait toute publication. Le drapeau existe pour que la
 * regle puisse etre resserree le jour ou un deuxieme referent est nomme, sans
 * rouvrir le code. Quand elle a lieu, l'auto-validation n'est jamais silencieuse :
 * `selfValidated` remonte au journal et a l'ecran.
 */
export const FLASH_SELF_VALIDATION_ALLOWED_BY_DEFAULT = true;

export function decideFlashValidationAccess(input: {
  role: unknown;
  serviceCodes: unknown;
  proposedBy: unknown;
  actorId: unknown;
  selfValidationAllowed?: boolean;
}): FlashValidationDecision {
  const actorId = actorRef(input.actorId, "actor_id");
  const proposedBy = actorRef(input.proposedBy, "proposed_by");
  const selfValidated = actorId === proposedBy;
  const selfValidationAllowed =
    input.selfValidationAllowed ?? FLASH_SELF_VALIDATION_ALLOWED_BY_DEFAULT;

  const refuse = (reason: string): FlashValidationDecision => ({
    allowed: false,
    reason,
    selfValidated,
    grantedByService: null,
  });

  const granted = grantedFlashValidationService(input.role, input.serviceCodes);

  if (!granted) return refuse("service_not_granted");
  if (selfValidated && !selfValidationAllowed) return refuse("self_validation_forbidden");

  return { allowed: true, reason: null, selfValidated, grantedByService: granted };
}
