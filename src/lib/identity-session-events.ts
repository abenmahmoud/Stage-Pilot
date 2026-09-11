const CHANNEL = 'lycee-identity-session';
/** Notifications contain no identity, contact, code, or other personal data. */
export function notifyIdentitySessionChanged() {
  window.dispatchEvent(new Event(CHANNEL));
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage('changed'); channel.close();
  }
}
export function listenForIdentitySessionChanges(callback: () => void) {
  window.addEventListener(CHANNEL, callback);
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
  if (channel) channel.onmessage = () => callback();
  return () => { window.removeEventListener(CHANNEL, callback); channel?.close(); };
}
