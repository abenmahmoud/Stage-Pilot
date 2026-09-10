import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LoaderCircle, Pause, Play, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { useEssufRadio } from "./EssufRadioProvider";
import "../styles/essuf-radio.css";

export function EssufRadioControls() {
  const radio = useEssufRadio();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const toggleButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggleButton.current?.focus(); }
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onPointer); };
  }, [open]);
  if (!radio?.isPublic) return null;
  if (radio.spotifyAvailable) return <div className="essuf-radio">
    <button type="button" className="essuf-radio-word" title="Radio ESSUF"
      aria-label="Radio ESSUF — ouvrir le lecteur" aria-expanded={radio.spotifyOpen}
      aria-controls="essuf-spotify-panel" onClick={radio.spotifyOpen ? radio.closeSpotify : radio.openSpotify}>radio</button>
  </div>;
  const active = radio.status === "playing" || radio.status === "loading";
  return <div className="essuf-radio" ref={container} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button type="button" ref={toggleButton} className="essuf-radio-word" data-active={active}
      title="Radio ESSUF" aria-label={active ? "Radio ESSUF, en lecture — ouvrir les réglages" : "Radio ESSUF — ouvrir les réglages"}
      aria-expanded={open} aria-controls="essuf-radio-panel" onClick={() => setOpen(!open)}>radio</button>
    {open ? <section id="essuf-radio-panel" className="essuf-radio-panel" aria-label="Radio ESSUF">
      <header><div><strong>Radio ESSUF</strong><span>{radio.available ? radio.title : "La playlist ESSUF sera bientôt disponible."}</span></div><button type="button" aria-label="Fermer les réglages de la radio" onClick={() => { setOpen(false); toggleButton.current?.focus(); }}><X aria-hidden="true" /></button></header>
      <div className="essuf-radio-actions"><button type="button" disabled={!radio.available} onClick={radio.toggle}>
        {radio.status === "loading" ? <LoaderCircle className="essuf-radio-loading" aria-hidden="true" /> : active ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        {radio.status === "loading" ? "Annuler" : active ? "Pause" : "Écouter"}
      </button>{radio.next ? <button type="button" onClick={radio.next}><SkipForward aria-hidden="true" /> Suivant</button> : null}</div>
      <label htmlFor="essuf-radio-volume">Volume <output>{radio.volume} %</output></label>
      <div className="essuf-radio-volume">{radio.volume === 0 ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}<input id="essuf-radio-volume" type="range" min="0" max="100" step="1" value={radio.volume} onChange={event => radio.setVolume(Number(event.target.value))} /></div>
      {radio.error ? <p role="status">{radio.error}</p> : null}
      <p className="essuf-radio-credit">Musique proposée par <a href="https://essuf.fr/" target="_blank" rel="noopener noreferrer">ESSUF Group</a>.</p>
      <Link className="essuf-radio-welcome-link" to="/?bienvenue=1" onClick={() => setOpen(false)}>Revoir l’accueil de bienvenue</Link>
    </section> : null}
    {radio.error && !open ? <div className="essuf-radio-error" role="status">{radio.error}</div> : null}
  </div>;
}
