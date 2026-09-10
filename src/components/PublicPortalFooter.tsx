import { Link } from "react-router-dom";
import { SCHOOL_PUBLIC_INFORMATION as school } from "../../shared/school-public-information";

export function PublicPortalFooter() {
  return (
    <footer className="lycee-public-footer">
      <div><strong>{school.name}</strong><span>{school.address} · {school.locality}</span></div>
      <nav aria-label="Liens de pied de page">
        <Link to="/?view=school#infos-pratiques">Contact et accès</Link>
        <Link to="/?view=requests">Suivre une demande</Link>
        <Link to="/?view=trust">Confidentialité</Link>
        <a href={school.phoneHref}>{school.phone}</a>
      </nav>
      <div className="lycee-site-credit">
        <a href="https://essuf.fr/" target="_blank" rel="noopener noreferrer" aria-label="Powered by ESSUF Group — conception et réalisation du site, nouvel onglet">
          <span>Powered by</span> <strong>ESSUF Group</strong>
        </a>
      </div>
    </footer>
  );
}
