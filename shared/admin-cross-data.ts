export const CROSS_DATA_FILTERS = ['all', 'missing_phone', 'missing_email', 'missing_contact', 'missing_ent', 'missing_koxo', 'missing_schedule', 'conflict'] as const;
export type CrossDataFilter = typeof CROSS_DATA_FILTERS[number];
export type CrossDataQuery = { search: string; profile: string; filter: CrossDataFilter; page: number; personRef: string | null };
export function parseCrossDataQuery(value: unknown): CrossDataQuery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Recherche invalide.');
  const x = value as Record<string, unknown>;
  if (Object.keys(x).some(k => !['search', 'profile', 'filter', 'page', 'personRef'].includes(k))) throw new Error('Recherche invalide.');
  const search = typeof x.search === 'string' ? x.search.trim() : '';
  const profile = x.profile ?? 'all'; const filter = x.filter ?? 'all'; const page = x.page ?? 0;
  if (search.length > 120 || /[\u0000-\u001f]/u.test(search) || !['all','student','guardian','staff'].includes(String(profile)) || !CROSS_DATA_FILTERS.includes(filter as CrossDataFilter) || !Number.isInteger(page) || Number(page) < 0 || Number(page) > 1000) throw new Error('Recherche invalide.');
  const personRef = x.personRef ?? null;
  if (personRef !== null && (typeof personRef !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/.test(personRef))) throw new Error('Référence invalide.');
  return { search, profile: String(profile), filter: filter as CrossDataFilter, page: Number(page), personRef: personRef as string | null };
}
export type CrossPerson = {
  personRef: string; personType: string; classRef: string | null; serviceCode: string | null;
  phone: boolean; email: boolean; ent: boolean; koxo: 'missing' | 'linked' | 'review';
  schedule: 'linked' | 'stale' | 'missing' | 'not_applicable';
  relations: number; conflict: boolean;
};
export type CrossDataDetail = {
  person: CrossPerson;
  attributes: { key: string; label: string; value: string | null; source: string; conflict: boolean }[];
  relations: { type: string; reference: string; direction: 'out' | 'in'; linked: boolean }[];
  subjects: string[];
};
export type CrossDataPayload = {
  schema: 1; refreshedAt: string; revision: string | null;
  sources: { kind: string; name: string; date: string | null; status: string; count: number }[];
  totals: { people: number; students: number; guardians: number; staff: number; missingPhone: number; missingEmail: number; missingContact: number; missingEnt: number; staffMissingKoxo: number; missingSchedule: number; conflicts: number };
  people: CrossPerson[]; total: number; page: number; pageSize: number; detail: CrossDataDetail | null;
};
export function filterCrossPeople(people: CrossPerson[], query: CrossDataQuery) {
  const search = query.search.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return people.filter(p => (query.profile === 'all' || p.personType === query.profile)
    && (!search || [p.personRef, p.classRef, p.serviceCode].some(s => search.split(/\s+/).every(token => s?.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(token))))
    && (query.filter === 'all'
      || query.filter === 'missing_phone' && !p.phone
      || query.filter === 'missing_email' && !p.email
      || query.filter === 'missing_contact' && !p.phone && !p.email
      || query.filter === 'missing_ent' && !p.ent
      || query.filter === 'missing_koxo' && p.personType === 'staff' && p.koxo === 'missing'
      || query.filter === 'missing_schedule' && ['student','staff'].includes(p.personType) && ['missing','stale'].includes(p.schedule)
      || query.filter === 'conflict' && p.conflict));
}
export function crossDataTotals(people: CrossPerson[]): CrossDataPayload['totals'] {
  return { people: people.length, students: people.filter(p=>p.personType==='student').length,
    guardians:people.filter(p=>p.personType==='guardian').length,staff:people.filter(p=>p.personType==='staff').length,
    missingPhone:people.filter(p=>!p.phone).length,missingEmail:people.filter(p=>!p.email).length,
    missingContact:people.filter(p=>!p.phone&&!p.email).length,missingEnt:people.filter(p=>!p.ent).length,
    staffMissingKoxo:people.filter(p=>p.personType==='staff'&&p.koxo==='missing').length,
    missingSchedule:people.filter(p=>['student','staff'].includes(p.personType)&&['missing','stale'].includes(p.schedule)).length,
    conflicts:people.filter(p=>p.conflict).length };
}
export function isCrossDataPayload(value: unknown): value is CrossDataPayload {
  const x=value as CrossDataPayload;
  return !!x && x.schema===1 && typeof x.refreshedAt==='string' && Array.isArray(x.sources) && x.sources.every(s=>typeof s.kind==='string'&&typeof s.name==='string'&&Number.isInteger(s.count))
    && !!x.totals && Object.values(x.totals).every(n=>Number.isInteger(n)&&n>=0)
    && Number.isInteger(x.total)&&x.total>=0 && Number.isInteger(x.page)&&x.page>=0 && x.pageSize===25
    && Array.isArray(x.people)&&x.people.length<=25&&x.people.every(p=>typeof p.personRef==='string'&&typeof p.phone==='boolean'&&typeof p.email==='boolean'&&['linked','stale','missing','not_applicable'].includes(p.schedule))
    && (x.detail===null || !!x.detail.person&&Array.isArray(x.detail.attributes)&&Array.isArray(x.detail.relations)&&Array.isArray(x.detail.subjects));
}
