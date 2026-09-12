export const FLASH_PUBLIC_GROUP: string;
export const FLASH_PROFILE_GROUPS: {ref:string;label:string}[];
export function flashClassGroup(profile:string,classRef:string):string;
export function flashAudienceOptions(classes:string[]):{ref:string;label:string}[];
export function flashViewerGroups(personType:string,classes?:Array<string|null>):string[];
