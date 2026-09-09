// Public-safe formatting only. Full directory contacts stay inside the private
// worker and the server endpoints, never in assistant messages or public JSON.
export function comparableIdentityName(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[^\p{L}]/gu, '');
}

export function directoryIdentityMatches(claim, person) {
  const first = comparableIdentityName(claim.claimedFirstName);
  const last = comparableIdentityName(claim.claimedLastName);
  const firstNames = String(person.firstName ?? '').split(/[\s,;-]+/).map(comparableIdentityName);
  return Boolean(first && last && claim.claimedProfile === person.personType
    && (first === comparableIdentityName(person.firstName) || firstNames.includes(first))
    && last === comparableIdentityName(person.lastName));
}

export function directoryContactOptions(vault) {
  const options = [];
  const seen = new Set();
  let phone = String(vault.phone ?? '').trim().replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (/^0\d{9}$/.test(phone)) phone = `+33${phone.slice(1)}`;
  if (/^\+[1-9]\d{7,14}$/.test(phone) && (!phone.startsWith('+33') || /^\+33[67]\d{8}$/.test(phone))) {
    options.push({ id: 'phone', type: 'phone', value: phone });
  }
  for (const [id, raw] of [['academic_email', vault.academicEmail], ['personal_email', vault.personalEmail]]) {
    const value = String(raw ?? '').normalize('NFKC').trim().toLowerCase();
    if (value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !seen.has(value)) {
      seen.add(value);
      options.push({ id, type: 'email', value });
    }
  }
  return options;
}

export function maskIdentityContact(type, value) {
  if (type === 'phone') {
    const local = /^\+33\d{9}$/.test(value) ? `0${value.slice(3)}` : value;
    return `${local.slice(0, 2)} ** ** ** ${local.slice(-2)}`;
  }
  const [local, domain] = value.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

export function publicIdentityContactOptions(options) {
  return options.map(({ id, type, value }) => ({ id, type, label: maskIdentityContact(type, value) }));
}
