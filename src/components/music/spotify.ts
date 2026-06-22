// Spotify embed helpers for the Music section.
// We only ever EMBED Spotify (never host/upload audio) to stay on the right
// side of copyright — these helpers just reshape public Spotify links into
// their iframe-embed equivalents.

export interface RadioStation {
  label: string;
  embedId: string;
}

/**
 * Curated public Spotify playlists for the Lounge Radio.
 * IDs are well-known public playlists and are swappable by the team.
 */
export const RADIO: Record<string, RadioStation> = {
  jazz: { label: "Jazz", embedId: "37i9dQZF1DXbITWG1ZJKYt" }, // Jazz Vibes
  soul: { label: "Soul", embedId: "37i9dQZF1DWULEW2RfoSCi" }, // Soul mix
  lofi: { label: "Lo-fi", embedId: "37i9dQZF1DWWQRwui0ExPn" }, // Lo-Fi Beats
  focus: { label: "Focus", embedId: "37i9dQZF1DWZeKCadgRdKQ" }, // Deep Focus
};

export type RadioKey = keyof typeof RADIO;

export const RADIO_KEYS = Object.keys(RADIO) as RadioKey[];

/** Build the embed URL for a radio station playlist id. */
export function radioEmbedUrl(embedId: string): string {
  return `https://open.spotify.com/embed/playlist/${embedId}?utm_source=generator&theme=0`;
}

/** True if the given string looks like a Spotify share link. */
export function isSpotifyUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.hostname === "open.spotify.com" || u.hostname === "spotify.com";
  } catch {
    return false;
  }
}

/**
 * Convert a shared Spotify link (playlist/track/album/show/episode/artist) into
 * its embed form, e.g.
 *   https://open.spotify.com/playlist/{id}?si=... → https://open.spotify.com/embed/playlist/{id}
 * Returns null if the URL can't be parsed into an embeddable resource.
 */
export function toSpotifyEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!(u.hostname === "open.spotify.com" || u.hostname === "spotify.com")) return null;
    // Path looks like /playlist/{id} or /intl-xx/track/{id}
    const segments = u.pathname.split("/").filter(Boolean);
    // Drop any locale prefix like "intl-de".
    const start = segments[0]?.startsWith("intl-") ? 1 : 0;
    const type = segments[start];
    const id = segments[start + 1];
    const embeddable = ["playlist", "track", "album", "show", "episode", "artist"];
    if (!type || !id || !embeddable.includes(type)) return null;
    return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
  } catch {
    return null;
  }
}
