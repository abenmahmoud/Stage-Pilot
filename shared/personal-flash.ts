export type PersonalFlash = {validUntil:string;items:{id:string;title:string;bodyMarkdown:string;importance:'normale'|'importante'|'urgente';expiresAt:string}[]};
export function parsePersonalFlash(value:unknown):PersonalFlash|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const v=value as PersonalFlash;
  if(Object.keys(v).some(k=>!['validUntil','items'].includes(k))||typeof v.validUntil!=='string'||!Number.isFinite(Date.parse(v.validUntil))||!Array.isArray(v.items)||v.items.length>20)return null;
  if(v.items.some(i=>!i||Object.keys(i).some(k=>!['id','title','bodyMarkdown','importance','expiresAt'].includes(k))||typeof i.id!=='string'||!/^[a-f0-9-]{36}$/.test(i.id)||typeof i.title!=='string'||i.title.length>180||typeof i.bodyMarkdown!=='string'||i.bodyMarkdown.length>20000||!['normale','importante','urgente'].includes(i.importance)||typeof i.expiresAt!=='string'||!Number.isFinite(Date.parse(i.expiresAt))))return null;
  return v;
}
