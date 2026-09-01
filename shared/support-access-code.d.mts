export function supportAccessCodeSecret(value: unknown): string;
export function supportAccessCodeFromTokenHash(input: {
  tokenHash: string;
  secret: string;
}): string;
export function supportAccessCodeFromToken(input: {
  token: string;
  secret: string;
}): string;
export function supportAccessCodeMatches(input: {
  code: string;
  tokenHash: string;
  secret: string;
}): boolean;
