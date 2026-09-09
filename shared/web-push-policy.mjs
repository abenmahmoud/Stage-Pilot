export function validPushEndpoint(value) {
  try {
    const url = new URL(value);
    const hosts = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', 'notify.windows.com'];
    return typeof value === 'string' && value.length <= 2048 && url.protocol === 'https:' && !url.username && !url.password
      && !url.port && !url.hash && hosts.some(host => url.hostname === host || (host !== 'fcm.googleapis.com' && url.hostname.endsWith('.' + host)));
  } catch { return false; }
}

export function parsePushSubscription(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['endpoint', 'keys', 'expirationTime'].includes(key))) throw new Error('push_input_invalid');
  if (!validPushEndpoint(input.endpoint) || !input.keys || typeof input.keys !== 'object' || Object.keys(input.keys).length !== 2
    || typeof input.keys.p256dh !== 'string' || typeof input.keys.auth !== 'string'
    || !/^[A-Za-z0-9_-]{87}=?$/.test(input.keys.p256dh) || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(input.keys.auth)) throw new Error('push_input_invalid');
  return { endpoint: input.endpoint, keys: { p256dh: input.keys.p256dh, auth: input.keys.auth } };
}

export function pushNotice(agent) {
  return { title: 'Lycée Blaise Cendrars', body: agent ? 'Une demande attend votre attention dans votre espace service.' : 'Une réponse ou une mise à jour est disponible dans Mes demandes.',
    tag: agent ? 'lycee-service' : 'lycee-demandes', destination: agent ? '/?view=agent' : '/?view=requests' };
}
