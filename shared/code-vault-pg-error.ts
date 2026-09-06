// Sanitisation d'une erreur PostgreSQL au point d'écriture du coffre — LOT 2
// du plan du 6 septembre 2026
// (`docs/operations/PLAN_BRANCHEMENT_COFFRE_2026-09-06.md`).
//
// Le `detail` d'une violation de contrainte `CHECK` ou `UNIQUE` répète la
// ligne refusée en clair (« Failing row contains (...) »), donc toute valeur
// qu'un appelant aurait tenté d'insérer dans `code_vault_private_rows` — y
// compris un code en clair rejeté par
// `code_vault_private_rows_ciphertext_check`. Personne ne journalise cette
// erreur aujourd'hui ; la règle doit exister avant qu'un appelant existe.
//
// Ce module ne garde jamais que deux champs d'une erreur Postgres (paquet
// npm `postgres`, voir `errorFields` dans `node_modules/postgres/src/
// connection.js`) : `message` et `constraint_name`. Tout le reste — en
// particulier `detail`, `hint`, `internal_query`, `where`, ou l'objet
// d'erreur complet — est jeté, jamais lu au-delà de ces deux champs, jamais
// copié, jamais transmis en `cause`.

const MAX_MESSAGE_LENGTH = 300;
const CONSTRAINT_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]{0,127}$/;

export type SanitizedPgError = {
  message: string;
  constraintName?: string;
};

function sanitizedMessage(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return "pg_error_unknown";
  }
  return value.length > MAX_MESSAGE_LENGTH ? value.slice(0, MAX_MESSAGE_LENGTH) : value;
}

function sanitizedConstraintName(value: unknown): string | undefined {
  if (typeof value !== "string" || !CONSTRAINT_NAME_PATTERN.test(value)) {
    return undefined;
  }
  return value;
}

/**
 * Ne lit que `message` et `constraint_name` de l'erreur reçue. N'accède à
 * aucun autre champ (donc jamais à `detail`), que l'erreur vienne réellement
 * du pilote `postgres` ou d'ailleurs.
 */
export function sanitizePgError(error: unknown): SanitizedPgError {
  if (error === null || typeof error !== "object") {
    return { message: sanitizedMessage(undefined) };
  }
  const raw = error as Record<string, unknown>;
  return {
    message: sanitizedMessage(raw.message),
    constraintName: sanitizedConstraintName(raw.constraint_name),
  };
}

/**
 * Erreur à lancer à la place de l'erreur Postgres brute. Ne porte que le
 * message court et le nom de contrainte sanitisés — pas de `cause`, pas de
 * référence à l'erreur d'origine, pour qu'un `console.error` ou une
 * sérialisation JSON de cette erreur ne puisse jamais faire réapparaître
 * `detail`.
 */
export class SanitizedPgWriteError extends Error {
  readonly constraintName?: string;

  constructor(sanitized: SanitizedPgError) {
    super(sanitized.message);
    this.name = "SanitizedPgWriteError";
    this.constraintName = sanitized.constraintName;
  }
}

/**
 * Même garantie que `SanitizedPgWriteError`, côté point de lecture unique
 * (`api/_shared/code-vault-read.ts`, LOT 1 du plan du 6 septembre 2026,
 * `docs/operations/PLAN_LECTURE_COFFRE_2026-09-06.md`) : une erreur Postgres
 * levée pendant la lecture de `code_vault_private_rows` ne doit jamais
 * remonter avec son `detail` d'origine.
 */
export class SanitizedPgReadError extends Error {
  readonly constraintName?: string;

  constructor(sanitized: SanitizedPgError) {
    super(sanitized.message);
    this.name = "SanitizedPgReadError";
    this.constraintName = sanitized.constraintName;
  }
}
