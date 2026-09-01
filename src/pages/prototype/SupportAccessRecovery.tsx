import { useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Mail, Send } from "lucide-react";
import { parseSupportAccessRecoveryInput, isSupportAccessRecoveryPayload } from "../../../shared/support-access-recovery-policy";
import { readJsonApiResponse } from "../../../shared/json-api-response";

export function SupportAccessRecovery({ initialCode = "", initiallyOpen = false }: {
  initialCode?: string; initiallyOpen?: boolean;
}) {
  const [publicCode, setPublicCode] = useState(initialCode);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  async function recover(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    let input;
    try { input = parseSupportAccessRecoveryInput({ publicCode, email }); }
    catch { setError("V\u00e9rifiez le num\u00e9ro de demande et l'adresse email."); return; }
    busy.current = true;
    setSubmitting(true); setError(null); setAccepted(false);
    try {
      const response = await fetch("/api/support/access-recovery", {
        method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input), signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 429) {
        await response.body?.cancel();
        setError("Trop de liens ont \u00e9t\u00e9 demand\u00e9s. R\u00e9essayez plus tard ou contactez le lyc\u00e9e.");
        return;
      }
      const payload = await readJsonApiResponse<unknown>(response, { maxBytes: 2048 });
      if (response.status !== 202 || !isSupportAccessRecoveryPayload(payload)) throw new Error("invalid_confirmation");
      setAccepted(true); setEmail("");
    } catch {
      setError("Le renvoi n'a pas pu \u00eatre confirm\u00e9. V\u00e9rifiez votre connexion, puis r\u00e9essayez plus tard.");
    } finally { busy.current = false; setSubmitting(false); }
  }

  return (
    <details className="lycee-access-recovery" open={initiallyOpen || undefined}>
      <summary><Mail aria-hidden="true" />Recevoir un nouveau lien</summary>
      <form onSubmit={recover} className="lycee-code-access-fields">
        <label><span>{"Num\u00e9ro de demande"}</span><input name="recoveryPublicCode" autoComplete="off" autoCapitalize="characters" placeholder="BC-2026-000001" value={publicCode} onChange={(event) => { setPublicCode(event.target.value.toUpperCase().slice(0, 14)); setAccepted(false); }} maxLength={14} required disabled={submitting} /></label>
        <label><span>{"Adresse email d\u00e9j\u00e0 fournie"}</span><input name="recoveryEmail" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setAccepted(false); }} maxLength={254} required disabled={submitting} /></label>
        <button type="submit" disabled={submitting}>{submitting ? "En cours..." : "Envoyer le lien"}<Send aria-hidden="true" /></button>
      </form>
      {accepted ? <div className="lycee-recovery-result" role="status"><CheckCircle2 aria-hidden="true" /><span>{"Si cette adresse correspond \u00e0 la demande, vous recevrez un email. Pensez aussi aux courriers ind\u00e9sirables."}</span></div> : null}
      {error ? <div className="lycee-form-error" role="alert"><CircleAlert aria-hidden="true" />{error}</div> : null}
    </details>
  );
}
