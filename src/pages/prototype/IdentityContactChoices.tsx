import { useState } from 'react';
import { ArrowRight, Mail, RefreshCw, Smartphone } from 'lucide-react';

type ContactOption = { id: string; type: 'email' | 'phone'; label: string };
export function IdentityContactChoices({ options, busy, onSelect, onCorrect, onIdentify }: {
  options: ContactOption[]; busy: boolean; onSelect: (option: ContactOption) => Promise<void>;
  onCorrect: () => void; onIdentify: () => void;
}) {
  const [sendingId, setSendingId] = useState<string | null>(null);
  const disabled = busy || sendingId !== null;
  async function select(option: ContactOption) {
    if (disabled) return;
    setSendingId(option.id);
    try { await onSelect(option); } finally { setSendingId(null); }
  }
  return <div className="lycee-identity-contact-choices" aria-label="Choix du moyen de vérification" aria-busy={disabled}>
    <div className="lycee-identity-contact-grid">
      {options.map(option => <button type="button" className="lycee-identity-contact-option" key={option.id} disabled={disabled} onClick={() => void select(option)}>
        <span className="lycee-contact-icon">{option.type === 'phone' ? <Smartphone aria-hidden="true" /> : <Mail aria-hidden="true" />}</span>
        <span className="lycee-contact-copy"><strong>{option.type === 'phone' ? 'Recevoir par SMS' : 'Recevoir par email'}</strong><span>{option.label}</span></span>
        {sendingId === option.id ? <RefreshCw className="is-spinning" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
      </button>)}
    </div>
    {disabled ? <p role="status">Envoi du code en cours…</p> : <p className="lycee-contact-reassurance">Un seul choix suffit. Vous saisirez ensuite le code reçu.</p>}
    <div className="lycee-contact-other-actions">
      <button type="button" className="lycee-identity-contact-alternative" disabled={disabled} onClick={onCorrect}>Je n’ai plus accès à ces coordonnées</button>
      <button type="button" className="lycee-identity-contact-alternative" disabled={disabled} onClick={onIdentify}>Ce n’est pas moi</button>
    </div>
  </div>;
}
