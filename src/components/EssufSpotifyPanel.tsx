import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Music2, X } from "lucide-react";
import { ESSUF_SPOTIFY_RADIO } from "../lib/essuf-radio";
import "../styles/essuf-radio.css";

/** Official player stays mounted across public routes; closing unloads it and stops audio. */
export function EssufSpotifyPanel({ onClose }: { onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [delayed, setDelayed] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!loaded || frameLoaded) return;
    const timer = setTimeout(() => setDelayed(true), 15_000);
    return () => clearTimeout(timer);
  }, [loaded, frameLoaded]);

  return <div className="essuf-radio essuf-spotify-dock">
    <section id="essuf-spotify-panel" className="essuf-radio-panel essuf-spotify-panel" aria-label="Radio ESSUF">
      <header><div><strong>Radio ESSUF</strong><span>ASSMA &amp; Pop française</span></div>
        <button ref={closeButton} type="button" aria-label="Fermer la radio et arrêter l’écoute" onClick={onClose}><X aria-hidden="true" /></button>
      </header>
      {!loaded ? <div className="essuf-spotify-consent">
        <Music2 aria-hidden="true" />
        <p>La playlist ESSUF, à votre rythme.</p>
        <p>En chargeant ce lecteur, vous contactez Spotify, qui peut utiliser des cookies. Vous choisissez ensuite de lancer la musique.</p>
        <div className="essuf-radio-actions"><button type="button" onClick={() => setLoaded(true)}>Charger le lecteur Spotify</button></div>
      </div> : <>
        {!frameLoaded ? <p role="status">{delayed ? "Le lecteur met du temps à répondre. Vous pouvez ouvrir la playlist sur Spotify." : "Chargement du lecteur Spotify…"}</p> : null}
        <iframe title={ESSUF_SPOTIFY_RADIO.title} src={ESSUF_SPOTIFY_RADIO.embedUrl}
          width="100%" height="352" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          referrerPolicy="no-referrer" onLoad={() => setFrameLoaded(true)} />
        <p>Réglez le son sur votre appareil. Fermer ce panneau arrête l’écoute.</p>
      </>}
      <a className="essuf-spotify-external" href={ESSUF_SPOTIFY_RADIO.url} target="_blank" rel="noopener noreferrer">Ouvrir dans Spotify <ExternalLink aria-hidden="true" /></a>
      <a className="essuf-spotify-privacy" href="https://www.spotify.com/fr/legal/privacy-policy/" target="_blank" rel="noopener noreferrer">Confidentialité chez Spotify</a>
      <p className="essuf-radio-credit">Musique proposée par <a href="https://essuf.fr/" target="_blank" rel="noopener noreferrer">ESSUF Group</a>.</p>
      <Link className="essuf-radio-welcome-link" to="/?bienvenue=1" onClick={onClose}>Revoir l’accueil de bienvenue</Link>
    </section>
  </div>;
}
