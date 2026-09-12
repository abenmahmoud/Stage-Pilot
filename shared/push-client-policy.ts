export type PushConfig={available:boolean;publicKey:string|null;flashAvailable:boolean};
export function parsePushConfig(value:unknown):PushConfig|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const v=value as Record<string,unknown>;
  if(Object.keys(v).some(k=>!['available','publicKey','flashAvailable'].includes(k))||typeof v.available!=='boolean'||typeof v.flashAvailable!=='boolean')return null;
  if(v.available ? typeof v.publicKey!=='string'||!/^[A-Za-z0-9_-]{87}$/.test(v.publicKey) : v.publicKey!==null)return null;
  if(v.flashAvailable&&!v.available)return null;
  return v as PushConfig;
}
export function parsePushState(value:unknown):{enabled:boolean;flashEnabled:boolean}|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const v=value as Record<string,unknown>;
  return Object.keys(v).length===2&&typeof v.enabled==='boolean'&&typeof v.flashEnabled==='boolean'&&(!v.flashEnabled||v.enabled)?v as {enabled:boolean;flashEnabled:boolean}:null;
}
export function pushInstallHint(userAgent:string,platform:string,maxTouchPoints:number,standalone:boolean):boolean {
  return !standalone && (/iPad|iPhone|iPod/.test(userAgent)||(platform==='MacIntel'&&maxTouchPoints>1));
}
