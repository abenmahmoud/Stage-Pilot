export function equipmentExternalSecret(value: unknown): string;
export function generateEquipmentExternalCode(): string;
export function equipmentExternalCodeHash(input: { grantId: string; code: string; secret: string }): string;
export function equipmentExternalCodeMatches(input: { grantId: string; code: string; codeHash: string; secret: string }): boolean;
export function createEquipmentExternalSession(input: { grantId: string; expiresAt: Date | number; secret: string; nonce?: string }): string;
export function verifyEquipmentExternalSession(input: { token: string; secret: string; now?: number }): { grantId: string; expiresAt: Date } | null;
