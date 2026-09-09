export type DirectoryContactOption = { id: 'phone' | 'academic_email' | 'personal_email'; type: 'phone' | 'email'; value: string };
export type PublicIdentityContactOption = Omit<DirectoryContactOption, 'value'> & { label: string };
export function comparableIdentityName(value: unknown): string;
export function directoryIdentityMatches(claim: { claimedProfile: string; claimedFirstName: string; claimedLastName: string }, person: { personType: string; firstName: string; lastName: string }): boolean;
export function directoryContactOptions(vault: { phone?: unknown; academicEmail?: unknown; personalEmail?: unknown }): DirectoryContactOption[];
export function maskIdentityContact(type: string, value: string): string;
export function publicIdentityContactOptions(options: DirectoryContactOption[]): PublicIdentityContactOption[];
