import { Link } from "react-router-dom";

export function PublicPortalFooter() {
  return (
    <footer className="lycee-public-footer">
      <div><strong>Lycée Blaise Cendrars</strong><span>12 avenue Léon Jouhaux · 93270 Sevran</span></div>
      <nav aria-label="Liens de pied de page">
        <Link to="/?view=school#infos-pratiques">Contact et accès</Link>
        <Link to="/?view=requests">Suivre une demande</Link>
        <Link to="/?view=trust">Confidentialité</Link>
        <a href="tel:+33149362050">01 49 36 20 50</a>
      </nav>
    </footer>
  );
}
