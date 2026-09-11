export const CONTENT_TARGET_PROFILES = ['eleves', 'parents', 'personnels'] as const;
export type ContentTargetProfile = typeof CONTENT_TARGET_PROFILES[number];
export type ContentTargeting = { profiles: ContentTargetProfile[]; classRefs: string[] };

/** Missing metadata preserves legacy audiences; malformed metadata never becomes public. */
export function parseContentTargeting(value: unknown): ContentTargeting | null {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Le public choisi est invalide.');
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !['profiles', 'classRefs'].includes(key))
    || !Array.isArray(row.profiles) || !row.profiles.length || row.profiles.length > 3
    || !row.profiles.every(p => CONTENT_TARGET_PROFILES.includes(p)) || new Set(row.profiles).size !== row.profiles.length
    || !Array.isArray(row.classRefs) || row.classRefs.length > 100
    || !row.classRefs.every(c => typeof c === 'string' && c.trim() === c && c.length > 0 && c.length <= 80 && !/[\u0000-\u001f\u007f]/.test(c))
    || new Set(row.classRefs).size !== row.classRefs.length) throw new Error('Vérifiez les profils et les classes choisis.');
  if (row.classRefs.length && row.profiles.includes('personnels')) throw new Error('Le ciblage par classe concerne les élèves et leurs responsables.');
  return { profiles: row.profiles as ContentTargetProfile[], classRefs: row.classRefs as string[] };
}

export function contentMatchesIdentity(content: { audience: string; targeting?: ContentTargeting | null }, scope: { personType: 'student' | 'guardian' | 'staff'; classRefs: string[] }): boolean {
  const profile = { student: 'eleves', guardian: 'parents', staff: 'personnels' }[scope.personType] as ContentTargetProfile;
  if (!content.targeting) return content.audience === 'tous' || content.audience === profile;
  return content.targeting.profiles.includes(profile)
    && (!content.targeting.classRefs.length || content.targeting.classRefs.some(ref => scope.classRefs.includes(ref)));
}
