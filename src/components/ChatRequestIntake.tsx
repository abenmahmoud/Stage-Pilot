import { useState } from "react";
import { ArrowLeft, CheckCircle2, Paperclip, Send } from "lucide-react";
import type { SupportDraftFormValues } from "../lib/support-device-memory";

type Props = {
  profile: string;
  setProfile: (value: string) => void;
  values: SupportDraftFormValues;
  update: <K extends keyof SupportDraftFormValues>(key: K, value: SupportDraftFormValues[K]) => void;
  description: string;
  category: string;
  fileNames: string[];
  busy: boolean;
  reuseIdentityDetails?: boolean;
  error: string | null;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onAttach: () => void;
};

/** Private intake stays in the browser and is never sent to the language model. */
export function ChatRequestIntake(p: Props) {
  const [step, setStep] = useState(0);
  const [editingIdentity, setEditingIdentity] = useState(false);
  // Reuse only details entered during this conversation after a successful OTP.
  // This skips duplicate questions; it never grants any server-side permission.
  const reuseIdentity = p.reuseIdentityDetails && !editingIdentity
    && p.values.requesterFirstName.trim() && p.values.requesterLastName.trim()
    && (p.values.preferredChannel === "phone" ? p.values.phone.trim() : p.values.email.trim());
  const steps = reuseIdentity
    ? p.profile === "parent" ? ["child", "review"] : ["review"]
    : p.profile === "parent" ? ["person", "child", "contact", "review"] : ["person", "contact", "review"];
  const current = steps[Math.min(step, steps.length - 1)];
  const review = current === "review";
  const labels: Record<string, string> = {
    person: "À quel nom dois-je préparer la demande ?",
    child: "Quel élève est concerné ?",
    contact: "Comment le lycée peut-il vous répondre ?",
    review: "Tout est prêt. Voulez-vous envoyer cette demande ?",
  };
  const field = (key: keyof SupportDraftFormValues, label: string, type = "text", required = false) => (
    <label><span>{label}</span><input type={type} value={String(p.values[key])} required={required}
      maxLength={type === "email" ? 254 : 100} autoComplete={type === "email" ? "email" : type === "tel" ? "tel" : "off"}
      onChange={event => p.update(key, event.target.value)} /></label>
  );
  return <form className="lycee-chat-step" aria-label="Préparer ma demande dans le chat" onSubmit={event => {
    if (!review) { event.preventDefault(); setStep(value => Math.min(value + 1, steps.length - 1)); }
    else p.onSubmit(event);
  }}>
    <div className="lycee-chat-step-heading"><strong>{labels[current]}</strong><small>Étape {step + 1} sur {steps.length}</small></div>
    {Object.entries(p.values).map(([name, value]) => typeof value === "boolean"
      ? value ? <input key={name} type="hidden" name={name} value="on" /> : null
      : <input key={name} type="hidden" name={name} value={value} />)}
    <input type="hidden" name="requesterProfile" value={p.profile} />
    <input type="hidden" name="website" value="" />
    <div className="lycee-chat-step-fields" key={current}>
      {current === "person" ? <>
        <label><span>Vous êtes</span><select value={p.profile} required onChange={event => p.setProfile(event.target.value)}>
          <option value="">Choisir mon profil</option><option value="eleve">Élève</option><option value="parent">Parent ou responsable</option>
          <option value="professeur">Professeur</option><option value="personnel">Personnel</option><option value="autre">Visiteur ou autre personne</option>
        </select></label>
        {field("requesterFirstName", "Votre prénom", "text", true)}{field("requesterLastName", "Votre nom", "text", true)}
      </> : current === "child" ? <>
        {field("beneficiaryFirstName", "Prénom de l’élève", "text", true)}{field("beneficiaryLastName", "Nom de l’élève", "text", true)}
        {field("className", "Classe, si vous la connaissez")}
      </> : current === "contact" ? <>
        <label><span>Je préfère être contacté par</span><select value={p.values.preferredChannel} onChange={event => p.update("preferredChannel", event.target.value as "email" | "phone")}><option value="email">Email</option><option value="phone">Téléphone</option></select></label>
        {p.values.preferredChannel === "email" ? field("email", "Votre adresse email", "email", true) : field("phone", "Votre téléphone", "tel", true)}
        <details><summary>Ajouter une précision ou un autre contact</summary>
          {p.values.preferredChannel === "email" ? field("phone", "Autre contact : téléphone", "tel") : field("email", "Autre contact : email", "email")}
          <label className="lycee-chat-check"><input type="checkbox" checked={p.values.fallbackAllowed} onChange={event => p.update("fallbackAllowed", event.target.checked)} />Le lycée peut utiliser cet autre contact si nécessaire.</label>
          {p.profile === "eleve" ? field("className", "Classe, si connue") : null}
          {p.profile === "personnel" || p.profile === "professeur" ? field("subjectArea", "Matière ou service") : null}
          <label className="lycee-chat-check"><input type="checkbox" checked={p.values.communicationSupport} onChange={event => p.update("communicationSupport", event.target.checked)} />J’ai besoin d’un rappel pour mieux comprendre la réponse.</label>
        </details>
      </> : <div className="lycee-chat-review">
        <span><CheckCircle2 aria-hidden="true" /> {p.category}</span>
        <p>{p.description}</p>
        <small>{p.values.requesterFirstName} {p.values.requesterLastName} · {p.values.preferredChannel === "phone" ? p.values.phone : p.values.email}</small>
        {p.profile === "parent" ? <small>Pour {p.values.beneficiaryFirstName} {p.values.beneficiaryLastName}</small> : null}
        {reuseIdentity ? <button type="button" onClick={() => { setEditingIdentity(true); setStep(0); }}>Modifier mes coordonnées</button> : null}
        <p className="lycee-chat-review-note">La réponse et les documents seront regroupés dans « Mes demandes ». Le délai dépend du service concerné.</p>
        {p.fileNames.map((name, index) => <small key={index}>Pièce jointe : {name}</small>)}
        <button type="button" onClick={p.onAttach} disabled={p.fileNames.length >= 5}><Paperclip aria-hidden="true" />Joindre un document</button>
      </div>}
    </div>
    {p.error ? <p role="alert" className="lycee-form-error">{p.error}</p> : null}
    <div className="lycee-chat-step-actions">
      <button type="button" disabled={p.busy} onClick={() => step === 0 ? p.onBack() : setStep(value => value - 1)}><ArrowLeft aria-hidden="true" />{step === 0 ? "Revenir au message" : "Modifier"}</button>
      <button className="lycee-primary-action" type="submit" disabled={p.busy}>{p.busy ? "Enregistrement…" : review ? "Confirmer et envoyer" : "Continuer"}{review ? <Send aria-hidden="true" /> : null}</button>
    </div>
  </form>;
}
