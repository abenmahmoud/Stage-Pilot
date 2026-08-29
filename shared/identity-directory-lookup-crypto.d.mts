import type { KeyObject } from "node:crypto";

export const IDENTITY_LOOKUP_SCHEMA_VERSION: 1;
export const IDENTITY_LOOKUP_TTL_SECONDS: 300;

export type IdentityLookupApiConfig = {
  keyVersion: string;
  publicKey: KeyObject;
  receiptKey: Buffer;
};

export type IdentityLookupWorkerConfig = {
  keyVersion: string;
  privateKey: KeyObject;
};

export type IdentityLookupEnvelope = {
  schema: number;
  keyVersion?: string;
  wrappedKey?: string;
  iv: string;
  authTag: string;
  ciphertext: string;
};

export function identityLookupApiConfig(env?: NodeJS.ProcessEnv): IdentityLookupApiConfig;
export function identityLookupWorkerConfig(env?: NodeJS.ProcessEnv): IdentityLookupWorkerConfig;
export function encryptIdentityLookupRequest(input: {
  value: Record<string, unknown>;
  requestId: string;
  institutionId: string;
  actorId: string;
  config: IdentityLookupApiConfig;
}): IdentityLookupEnvelope & { keyVersion: string; wrappedKey: string };
export function decryptIdentityLookupRequest(input: {
  envelope: IdentityLookupEnvelope & { keyVersion: string; wrappedKey: string };
  requestId: string;
  institutionId: string;
  actorId: string;
  privateKey: KeyObject;
}): Record<string, unknown>;
export function encryptIdentityLookupResult(input: {
  value: Record<string, unknown>;
  responseKey: Buffer | string;
  requestId: string;
  institutionId: string;
  actorId: string;
}): IdentityLookupEnvelope;
export function decryptIdentityLookupResult(input: {
  envelope: IdentityLookupEnvelope;
  responseKey: Buffer | string;
  requestId: string;
  institutionId: string;
  actorId: string;
}): Record<string, unknown>;
export function sealIdentityLookupReceipt(
  value: Record<string, unknown>,
  receiptKey: Buffer | string
): string;
export function openIdentityLookupReceipt(
  token: string,
  receiptKey: Buffer | string
): Record<string, unknown>;
