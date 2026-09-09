import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { apiFetch } from "../lib/api";

export function PushNotificationsButton({ audience = "requester" }: { audience?: "requester" | "agent" }) {
  const route = `support/push?audience=${audience}`;
  const [available, setAvailable] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    let active = true;
    void apiFetch<{ available: boolean; publicKey: string | null }>(route).then(async config => {
      if (!active || config.available !== true || typeof config.publicKey !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(config.publicKey)) return;
      setPublicKey(config.publicKey);
      setAvailable(true);
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (active && subscription) {
        // Renew only an existing consent; this does not display a permission prompt.
        const result = await apiFetch<{ enabled: boolean }>(route, { method: "POST", body: JSON.stringify(subscription.toJSON()) });
        if (active) setEnabled(result.enabled === true);
      }
    }).catch(() => { /* The ordinary tracking remains available. */ });
    return () => { active = false; };
  }, [route]);
  async function toggle() {
    setBusy(true); setNotice("");
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (enabled && subscription) {
        await apiFetch(route, { method: "DELETE", body: JSON.stringify(subscription.toJSON()) });
        await subscription.unsubscribe(); setEnabled(false); setNotice("Notifications désactivées sur cet appareil."); return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setNotice("Les notifications sont bloquées. Vous pouvez les autoriser dans les réglages de votre navigateur."); return; }
      const applicationServerKey = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/") + "="), char => char.charCodeAt(0));
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      const result = await apiFetch<{ enabled: boolean }>(route, { method: "POST", body: JSON.stringify(subscription.toJSON()) });
      if (result.enabled !== true) throw new Error("subscription_failed");
      setEnabled(true); setNotice("Les notifications du lycée sont activées sur cet appareil.");
    } catch { setNotice("La modification des notifications n’a pas abouti. Réessayez depuis votre espace connecté."); }
    finally { setBusy(false); }
  }
  if (!available) return null;
  return <span className="lycee-push-control"><button type="button" disabled={busy} aria-pressed={enabled} onClick={() => void toggle()}><Bell aria-hidden="true" />{busy ? "Un instant…" : enabled ? "Notifications activées" : "Me prévenir"}</button>{notice ? <small role="status">{notice}</small> : null}</span>;
}
