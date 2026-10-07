import { ArrowRight, BookOpenCheck, ExternalLink } from "lucide-react";
import { SCHOOL_CONTINUITY } from "../../shared/school-continuity";

export function SchoolContinuityBanner({ onOpen }: { onOpen: () => void }) {
  if (!SCHOOL_CONTINUITY.active) return null;

  return (
    <section className="school-continuity-banner" aria-labelledby="school-continuity-banner-title">
      <span className="school-continuity-banner-icon"><BookOpenCheck aria-hidden="true" /></span>
      <div>
        <span>{SCHOOL_CONTINUITY.status}</span>
        <h2 id="school-continuity-banner-title">{SCHOOL_CONTINUITY.title}</h2>
        <p>{SCHOOL_CONTINUITY.summary}</p>
      </div>
      <div className="school-continuity-banner-actions">
        <button type="button" onClick={onOpen}>Découvrir les outils <ArrowRight aria-hidden="true" /></button>
        <a href={SCHOOL_CONTINUITY.entUrl} target="_blank" rel="noreferrer">Ouvrir l’ENT <ExternalLink aria-hidden="true" /></a>
      </div>
    </section>
  );
}
