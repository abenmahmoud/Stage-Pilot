import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ESSUF_RADIO_INITIAL_VOLUME, ESSUF_RADIO_TRACKS } from "../lib/essuf-radio";

type Status = "paused" | "loading" | "playing" | "error";
type RadioControls = {
  available: boolean; title: string; status: Status; volume: number; error: string;
  toggle: () => void; setVolume: (value: number) => void; next: (() => void) | null;
};
const RadioContext = createContext<RadioControls | null>(null);
export const useEssufRadio = () => useContext(RadioContext);

/** One audio element across public route changes. No audio request until a click. */
export function EssufRadioProvider({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const isPublic = ((pathname === "/" || pathname === "/prototype") && new URLSearchParams(search).get("view") !== "agent")
    || pathname === "/chromebook" || pathname.startsWith("/site/");
  const available = isPublic && ESSUF_RADIO_TRACKS.length > 0;
  const [status, setStatus] = useState<Status>("paused");
  const [volume, setVolumeState] = useState(ESSUF_RADIO_INITIAL_VOLUME);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const engine = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  const operation = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requested = useRef(false);

  const clearLoadingTimer = () => { if (timeout.current) clearTimeout(timeout.current); timeout.current = null; };

  function pause() {
    operation.current += 1;
    requested.current = false;
    clearLoadingTimer();
    audio.current?.pause();
    setStatus("paused");
  }

  function fail(message: string) {
    pause();
    setError(message);
    setStatus("error");
  }

  useEffect(() => {
    if (available) return;
    requested.current = false;
    operation.current += 1;
    clearLoadingTimer();
    audio.current?.pause();
    audio.current?.removeAttribute("src");
    audio.current?.load();
    setStatus("paused");
    setError("");
  }, [available]);

  useEffect(() => () => {
    operation.current += 1;
    requested.current = false;
    clearLoadingTimer();
    void engine.current?.context.close().catch(() => undefined);
  }, []);

  async function playAt(nextIndex: number) {
    const element = audio.current;
    const track = ESSUF_RADIO_TRACKS[nextIndex];
    if (!available || !element || !track) return;
    const attempt = ++operation.current;
    requested.current = true;
    setError("");
    setStatus("loading");
    setIndex(nextIndex);
    clearLoadingTimer();
    try {
      if (!engine.current) {
        const context = new AudioContext();
        const gain = context.createGain();
        gain.gain.value = volume / 100;
        context.createMediaElementSource(element).connect(gain);
        gain.connect(context.destination);
        engine.current = { context, gain };
      }
      engine.current.gain.gain.value = volume / 100;
      const source = new URL(track.src, window.location.origin);
      if (source.protocol !== "https:" && source.origin !== window.location.origin) throw new Error("Unsupported radio source");
      if (element.src !== source.href) element.src = source.href;
      timeout.current = setTimeout(() => {
        if (attempt === operation.current) fail("La radio ne répond pas pour le moment. Réessayez plus tard.");
      }, 15_000);
      // Both calls occur within the user's activation, before awaiting either.
      await Promise.all([engine.current.context.resume(), element.play()]);
      if (attempt !== operation.current) return;
      clearLoadingTimer();
      setStatus("playing");
    } catch {
      if (attempt !== operation.current) return;
      fail("La lecture n’a pas pu démarrer. Vous pouvez réessayer.");
    }
  }

  function setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    const bounded = Math.min(100, Math.max(0, Math.round(value)));
    setVolumeState(bounded);
    if (engine.current) engine.current.gain.gain.value = bounded / 100;
  }

  return <RadioContext.Provider value={{
    available, title: ESSUF_RADIO_TRACKS[index]?.title ?? "Radio ESSUF", status, volume, error,
    toggle: () => status === "playing" || status === "loading" ? pause() : void playAt(index),
    setVolume,
    next: ESSUF_RADIO_TRACKS.length > 1 ? () => void playAt((index + 1) % ESSUF_RADIO_TRACKS.length) : null,
  }}>
    {children}
    <audio ref={audio} preload="none" crossOrigin="anonymous" aria-hidden="true"
      onEnded={() => { if (requested.current) void playAt((index + 1) % ESSUF_RADIO_TRACKS.length); }}
      onError={() => { if (requested.current) fail("La radio est momentanément indisponible. Réessayez plus tard."); }}
    />
  </RadioContext.Provider>;
}
