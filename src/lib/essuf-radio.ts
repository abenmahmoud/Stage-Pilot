export type EssufRadioTrack = { title: string; src: string };

/** Direct public audio only. ESSUF supplied a Spotify embed, configured separately below.
 *  The direct stream required for 1% gain is still missing. Do not substitute third-party music.
 *  The audio host must be permitted by media-src in vercel.json and support CORS
 *  so Web Audio can apply the requested 1% gain on mobile as well as desktop.
 *  A playlist consists of direct audio URLs, not a Spotify/YouTube webpage.
 */
export const ESSUF_RADIO_TRACKS: readonly EssufRadioTrack[] = [];

export const ESSUF_RADIO_INITIAL_VOLUME = 1;

// Public playlist supplied by ESSUF. Never pass this webpage to HTMLAudioElement.
// The official embed has no API to enforce the native player's 1% volume.
export const ESSUF_SPOTIFY_RADIO = {
  title: "Radio ESSUF — ASSMA & Pop française",
  url: "https://open.spotify.com/playlist/2QHUYT3UGNRrO3F8xHHrZ6",
  embedUrl: "https://open.spotify.com/embed/playlist/2QHUYT3UGNRrO3F8xHHrZ6?utm_source=generator&theme=0",
} as const;
