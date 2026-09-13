import { useEffect, useState } from 'react';
import type { SchoolTargetChoices } from '../../shared/family-school-chat';

export function SchoolTargetChoiceButtons({ choices, busy, onSelect, onRefresh }: {
  choices: SchoolTargetChoices; busy: boolean;
  onSelect: (key: string, expiresAt: string) => void; onRefresh: () => void;
}) {
  const [expired, setExpired] = useState(() => Date.parse(choices.expiresAt) <= Date.now());
  useEffect(() => {
    const remaining = Date.parse(choices.expiresAt) - Date.now();
    setExpired(remaining <= 0);
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [choices.expiresAt]);
  return <div className="lycee-school-target-choices" role="group" aria-label="Choisir l’enfant concerné">
    {expired ? <button type="button" disabled={busy} onClick={onRefresh}>Actualiser le choix de l’enfant</button>
      : choices.options.map(option => <button key={option.key} type="button" disabled={busy}
        onClick={() => Date.parse(choices.expiresAt) > Date.now() ? onSelect(option.key, choices.expiresAt) : onRefresh()}>{option.label}</button>)}
  </div>;
}
