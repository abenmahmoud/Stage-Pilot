import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { useEssufRadio } from "./EssufRadioProvider";
import "../styles/portal-welcome.css";

const VISITED_KEY = "lycee-welcome-seen-v1";

/** An optional first entrance, never an obstacle to a direct service or tracking link. */
export function PublicPortalWelcome() {
  const location = useLocation();
  const navigate = useNavigate();
  const radio = useEssufRadio();
  const params = new URLSearchParams(location.search);
  const isHome = (location.pathname === "/" || location.pathname === "/prototype")
    && (!params.get("view") || params.get("view") === "home") && !location.hash
    && [...params.keys()].every(key => key === "view" || key === "bienvenue" || key.startsWith("utm_"));
  const preview = params.get("bienvenue") === "1";
  const [open, setOpen] = useState(() => {
    let visited = false;
    try {
      visited = sessionStorage.getItem(VISITED_KEY) === "1";
    } catch { /* Restricted storage must not prevent entrance. */ }
    return isHome && (!visited || preview);
  });
  const dialog = useRef<HTMLDialogElement>(null);
  const enterButton = useRef<HTMLButtonElement>(null);
  const visible = open && isHome;

  useEffect(() => {
    try { sessionStorage.setItem(VISITED_KEY, "1"); } catch { /* Optional UI preference. */ }
  }, []);
  useEffect(() => {
    if (!isHome) setOpen(false);
    else if (preview) setOpen(true);
  }, [isHome, preview, location.key]);

  useEffect(() => {
    if (!visible) return;
    const element = dialog.current;
    if (!element) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    enterButton.current?.focus({ preventScroll: true });
    return () => { element.close(); document.body.style.overflow = previousOverflow; };
  }, [visible]);

  function enter(withMusic: boolean, discoverSpotify = false) {
    // Stay inside this click's activation: start the audio before any navigation.
    if (withMusic && radio?.available) radio.startQuietly();
    else radio?.pause();
    if (discoverSpotify) radio?.openSpotify();
    else if (radio?.spotifyOpen) radio.closeSpotify();
    setOpen(false);
    if (preview) {
      params.delete("bienvenue");
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
    requestAnimationFrame(() => {
      const target = discoverSpotify ? document.querySelector<HTMLButtonElement>("#essuf-spotify-panel button") : document.getElementById("lycee-main");
      target?.focus({ preventScroll: true });
    });
  }

  if (!visible) return null;
  return <dialog ref={dialog} className="portal-welcome" aria-labelledby="portal-welcome-title" aria-describedby="portal-welcome-description" onCancel={event => { event.preventDefault(); enter(false); }}>
    <div className="portal-welcome-layout">
      <div className="portal-welcome-copy">
        <div className="portal-welcome-brand"><strong>Lycée Blaise Cendrars</strong><span>Sevran</span></div>
        <div className="portal-welcome-message">
          <h1 id="portal-welcome-title">Bienvenue<br />au lycée<br /><span>Blaise Cendrars.</span></h1>
          <p id="portal-welcome-description">Vos informations, vos services et la vie du lycée, au même endroit.</p>
          <button ref={enterButton} className="portal-welcome-enter" type="button" onClick={() => enter(true)}>Entrer au lycée <ArrowRight aria-hidden="true" /></button>
          <p className="portal-welcome-audio-note">{radio?.available ? "Une ambiance musicale très douce, à 1 %." : "Radio ESSUF vous accompagne, quand vous le souhaitez."}</p>
          {radio?.available ? <button className="portal-welcome-silent" type="button" onClick={() => enter(false)}>Continuer sans musique</button> : null}
          {radio?.spotifyAvailable ? <button className="portal-welcome-silent" type="button" onClick={() => enter(false, true)}>Découvrir la radio</button> : null}
        </div>
        <a className="portal-welcome-credit" href="https://essuf.fr/" target="_blank" rel="noopener noreferrer">Powered by ESSUF Group</a>
      </div>
      <img className="portal-welcome-photo" src="/lycee-blaise-hero.webp" alt="Entrée du lycée Blaise Cendrars à Sevran" fetchPriority="high" />
    </div>
    <button className="portal-welcome-close" type="button" aria-label="Fermer l’accueil et entrer sans musique" onClick={() => enter(false)}><X aria-hidden="true" /></button>
  </dialog>;
}
