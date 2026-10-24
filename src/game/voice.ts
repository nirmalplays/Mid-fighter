/**
 * Spoken lines (public/voice) go through one channel: a new line stops whatever was being said, so
 * two voices never talk over each other, and the music dips under whoever speaks. Lines can be loaded
 * ahead of time so their length is known before they play (the cinematic waits for each to finish).
 */
import { music } from './audio.ts';
import { settings } from './settings.ts';

const cache = new Map<string, HTMLAudioElement>();
let current: HTMLAudioElement | null = null;

function element(file: string): HTMLAudioElement | null {
    let el = cache.get(file);
    if (el) return el;
    try {
        el = new Audio(`voice/${file}`);
        el.preload = 'auto';
        el.addEventListener('error', () => { el!.dataset.missing = '1'; });
        cache.set(file, el);
        return el;
    } catch {
        return null;
    }
}

export const voice = {
    /** Start loading lines now (their lengths are then known when they play). */
    preload(files: string[]): void {
        for (const f of files) element(f);
    },
    /** How long a line lasts in ms (once loaded), or null if not known (yet). */
    length(file: string): number | null {
        const el = cache.get(file);
        return el && !el.dataset.missing && Number.isFinite(el.duration) && el.duration > 0 ? el.duration * 1000 : null;
    },
    /** Say a line: whatever was being said stops first. */
    play(file: string): void {
        this.stop();
        const el = element(file);
        if (!el || el.dataset.missing) return;
        const st = settings.get();
        el.volume = st.sound ? Math.min(1, 0.4 + 0.55 * st.volume) : 0;
        el.currentTime = 0;
        current = el;
        music.duck(0.6);
        el.onended = () => {
            if (current === el) {
                current = null;
                music.duck(1);
            }
        };
        void el.play().catch(() => undefined);
    },
    /** Silence (a skip, the end of a scene). */
    stop(): void {
        if (current) {
            current.pause();
            current = null;
            music.duck(1);
        }
    },
};
