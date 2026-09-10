import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Music2, Pause, Play, SkipForward, SlidersHorizontal, Volume2, VolumeX, X } from "lucide-react";
import { useEssufRadio } from "./EssufRadioProvider";
import "../styles/essuf-radio.css";

export function EssufRadioControls() {
  const radio = useEssufRadio();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const playButton = useRef<HTMLButtonElement>(null);
  const settings = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); playButton.current?.focus(); }
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onPointer); };
  }, [open]);
  if (!radio?.available) return null;
  const active = radio.status === "playing" || radio.status === "loading";
  return <div className="essuf-radio" ref={container}>
    <div className="essuf-radio-compact" data-active={active}>
      <button type="button" ref={playButton} onClick={() => { radio.toggle(); setOpen(true); }}
        title={active ? "Mettre la radio ESSUF en pause" : "Écouter la radio ESSUF"}
        aria-label={active ? "Mettre la radio ESSUF en pause" : "Écouter la radio ESSUF"}>
        {radio.status === "loading" ? <LoaderCircle className="essuf-radio-loading" aria-hidden="true" /> : active ? <Pause aria-hidden="true" /> : <Music2 aria-hidden="true" />}
      </button>
      <button type="button" ref={settings} className="essuf-radio-settings" aria-expanded={open} aria-controls="essuf-radio-panel" aria-label="Régler le volume de la radio ESSUF" onClick={() => setOpen(!open)}>
        <SlidersHorizontal aria-hidden="true" />
      </button>
    </div>
    {open ? <section id="essuf-radio-panel" className="essuf-radio-panel" aria-label="Radio ESSUF">
      <header><div><strong>Radio ESSUF</strong><span>{radio.title}</span></div><button type="button" aria-label="Fermer les réglages de la radio" onClick={() => { setOpen(false); playButton.current?.focus(); }}><X aria-hidden="true" /></button></header>
      <div className="essuf-radio-actions"><button type="button" onClick={radio.toggle}>{active ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{active ? "Pause" : "Écouter"}</button>{radio.next ? <button type="button" onClick={radio.next}><SkipForward aria-hidden="true" /> Suivant</button> : null}</div>
      <label htmlFor="essuf-radio-volume">Volume <output>{radio.volume} %</output></label>
      <div className="essuf-radio-volume">{radio.volume === 0 ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}<input id="essuf-radio-volume" type="range" min="0" max="100" step="1" value={radio.volume} onChange={event => radio.setVolume(Number(event.target.value))} /></div>
      {radio.error ? <p role="status">{radio.error}</p> : null}
      <p>Musique proposée par <a href="https://essuf.fr/" target="_blank" rel="noopener noreferrer">ESSUF Group</a>.</p>
    </section> : null}
    {radio.error && !open ? <div className="essuf-radio-error" role="status">{radio.error}</div> : null}
  </div>;
}
