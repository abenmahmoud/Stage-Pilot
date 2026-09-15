import { useEffect, useState } from 'react';
import { Check, RefreshCw, Sparkles } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { isSupportReplySuggestion, type SupportReplySuggestion as Suggestion } from '../../../shared/support-reply-suggestion';

export function SupportReplySuggestion({ publicCode, revision, disabled, hasDraft, onApply }: {
  publicCode: string; revision: string; disabled: boolean; hasDraft: boolean; onApply: (text: string) => boolean;
}) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [used, setUsed] = useState(false);
  const [replace, setReplace] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true); setError(null); setSuggestion(null); setUsed(false); setReplace(false);
    void apiFetch<unknown>(`support/agent/requests/${publicCode}/suggestion`, { signal: controller.signal }).then(result => {
      if (!active) return;
      if (!isSupportReplySuggestion(result, publicCode, revision)) throw new Error('Le dossier a évolué. Actualisez-le avant de préparer la réponse.');
      setSuggestion(result);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'La proposition est indisponible. Vous pouvez rédiger votre réponse.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [publicCode, revision, attempt]);
  return <aside className="lycee-reply-suggestion" aria-label="Proposition pour ce dossier" aria-busy={loading}>
    <header><Sparkles aria-hidden="true" /><strong>{loading ? 'Préparation de la réponse…' : used ? 'Proposition ajoutée à votre réponse' : suggestion ? 'Réponse proposée — à relire' : 'Réponse proposée indisponible'}</strong>
      <button type="button" title="Actualiser la proposition" aria-label="Actualiser la proposition" disabled={loading || disabled} onClick={() => setAttempt(v => v + 1)}><RefreshCw aria-hidden="true" /></button>
    </header>
    {error ? <p role="status">{error} Votre brouillon est conservé.</p> : null}
    {suggestion ? <>
      {!used ? <><p className="lycee-suggestion-context"><strong>{suggestion.title}</strong><small>{suggestion.facts[0]}</small></p><p className="lycee-suggestion-preview" aria-label="Texte proposé à envoyer">{suggestion.draft}</p>{replace ? <div className="lycee-suggestion-replace" role="group" aria-label="Remplacer le brouillon"><p>Vous avez déjà commencé une réponse. Voulez-vous la remplacer ?</p><button type="button" disabled={disabled} onClick={() => setReplace(false)}>Garder mon brouillon</button><button type="button" disabled={disabled} onClick={() => { if (onApply(suggestion.draft)) { setUsed(true); setReplace(false); } }}>Remplacer par la proposition</button></div> : <button className="lycee-suggestion-apply" type="button" disabled={disabled} onClick={() => { if (hasDraft) { setReplace(true); return; } if (onApply(suggestion.draft)) setUsed(true); }}><Check aria-hidden="true" /> Utiliser cette réponse</button>}<small>Ajoute le texte dans votre brouillon. Rien n’est envoyé avant « Valider et envoyer ».</small></> : <p>Adaptez le texte ci-dessous, puis cliquez sur « Valider et envoyer ».</p>}
      <details><summary>Informations vérifiées et sources</summary><ul>{suggestion.facts.map(fact => <li key={fact}>{fact}</li>)}</ul><p>{suggestion.sources.join(' · ')}</p><small>Consulté le {new Date(suggestion.checkedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}. Aucun code d’accès n’est inséré dans cette réponse.</small></details>
    </> : null}
  </aside>;
}

