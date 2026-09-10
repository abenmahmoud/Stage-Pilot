import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Laptop } from "lucide-react";
import { CHROMEBOOK_DISTRIBUTION, distributionIsUpcoming } from "../../shared/chromebook-information";
import "../pages/prototype/chromebook.css";

export function useChromebookDate() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  return now;
}

export function ChromebookNotice() {
  const upcoming = distributionIsUpcoming(useChromebookDate());
  return (
    <Link to="/chromebook" className="cb-notice">
      <span className="cb-notice-icon"><Laptop aria-hidden="true" /></span>
      <span className="cb-notice-copy"><span className="cb-eyebrow">{upcoming ? "À la une · Secondes" : "Le guide numérique"}</span>
        <strong>{upcoming ? "Votre Chromebook arrive au lycée" : "Mon Chromebook, toute l’année"}</strong>
        <span>{upcoming ? `${CHROMEBOOK_DISTRIBUTION.dates} · Grande salle polyvalente` : "Connexion, usages et dépannage : retrouvez les réponses utiles."}</span>
      </span>
      <span className="cb-notice-action">{upcoming ? "Préparer la remise" : "Ouvrir le guide"} <ArrowUpRight aria-hidden="true" /></span>
    </Link>
  );
}
