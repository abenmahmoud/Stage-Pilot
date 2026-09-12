import { flashAudienceOptions, FLASH_PUBLIC_GROUP } from '../../shared/flash-audience-groups.mjs';
import { readContentAudienceClasses } from './content-audiences.js';
import { HttpError } from './auth.js';
export async function readKnownFlashAudiences() {
  return new Set([FLASH_PUBLIC_GROUP,...flashAudienceOptions(await readContentAudienceClasses()).map(g=>g.ref)]);
}
export async function assertKnownFlashAudiences(groups:string[],smsContacts:string[]=[],knownGroups?:Set<string>) {
  if(smsContacts.length)throw new HttpError(409,'La diffusion SMS nominative doit être préparée dans le centre de communication.');
  if(groups.length===1 && groups[0]===FLASH_PUBLIC_GROUP)return;
  const known=knownGroups ?? await readKnownFlashAudiences();
  if(groups.some(g=>!known.has(g)))throw new HttpError(409,'Le public choisi doit être actualisé depuis l’annuaire du lycée.');
}
