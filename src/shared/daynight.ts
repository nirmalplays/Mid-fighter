/**
 * Day and night, from the wall clock, so every player in a room (and the server, which
 * makes the night hordes bigger) agrees without sending anything. One cycle is 10 minutes:
 * 6½ of day, half a minute of dusk, 2½ of night, half a minute of dawn.
 */
export const CYCLE_MS = 10 * 60 * 1000;
const DAY = 6.5 * 60 * 1000;
const FADE = 30 * 1000;
const NIGHT = 2.5 * 60 * 1000;

export type Phase = 'day' | 'dusk' | 'night' | 'dawn';

/** Where in the cycle a moment is: the phase, how dark it is (0 day .. 1 deep night) and seconds until the phase changes. */
export function skyAt(ms: number): { phase: Phase; dark: number; left: number } {
    const t = ((ms % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
    if (t < DAY) return { phase: 'day', dark: 0, left: Math.ceil((DAY - t) / 1000) };
    if (t < DAY + FADE) return { phase: 'dusk', dark: (t - DAY) / FADE, left: Math.ceil((DAY + FADE - t) / 1000) };
    if (t < DAY + FADE + NIGHT) return { phase: 'night', dark: 1, left: Math.ceil((DAY + FADE + NIGHT - t) / 1000) };
    return { phase: 'dawn', dark: 1 - (t - DAY - FADE - NIGHT) / FADE, left: Math.ceil((CYCLE_MS - t) / 1000) };
}

/** Debug: a fixed offset so ?night starts in the dark. */
let offset = 0;
export function setSkyOffset(ms: number): void {
    offset = ms;
}
export const nowSky = () => skyAt(Date.now() + offset);
/** Starting the clock at night (for testing). */
export const NIGHT_START = DAY + FADE + 1000;
