import { createHash } from 'node:crypto';
export const FLASH_PUBLIC_GROUP = 'public:site';
export const FLASH_PROFILE_GROUPS = [
  {ref:'profile:student',label:'Tous les élèves'},
  {ref:'profile:guardian',label:'Tous les parents et responsables'},
  {ref:'profile:staff',label:'Tous les personnels'},
];
export function flashClassGroup(profile, classRef) {
  if (!['student','guardian'].includes(profile) || typeof classRef!=='string' || !classRef.trim() || classRef.length>80) throw new Error('invalid_flash_class');
  return `${profile==='student'?'students':'parents'}:${createHash('sha256').update(classRef).digest('hex')}`;
}
export function flashAudienceOptions(classes) {
  return [...FLASH_PROFILE_GROUPS,...classes.flatMap(c=>[
    {ref:flashClassGroup('student',c),label:`Élèves · ${c}`},
    {ref:flashClassGroup('guardian',c),label:`Parents · ${c}`},
  ])];
}
export function flashViewerGroups(personType, classes=[]) {
  if (!['student','guardian','staff'].includes(personType)) return [FLASH_PUBLIC_GROUP];
  return [FLASH_PUBLIC_GROUP,`profile:${personType}`,...(personType==='staff'?[]:[...new Set(classes.filter(Boolean))].map(c=>flashClassGroup(personType,c)))];
}
