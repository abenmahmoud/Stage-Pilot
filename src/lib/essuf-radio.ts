export type EssufRadioTrack = { title: string; src: string };

/** Public audio only. Awaiting Adel's exact radio/playlist URL.
 *  An empty list hides the player. Do not substitute third-party music.
 *  The audio host must be permitted by media-src in vercel.json and support CORS
 *  so Web Audio can apply the requested 1% gain on mobile as well as desktop.
 *  A playlist consists of direct audio URLs, not a Spotify/YouTube webpage.
 */
export const ESSUF_RADIO_TRACKS: readonly EssufRadioTrack[] = [];

export const ESSUF_RADIO_INITIAL_VOLUME = 1;
