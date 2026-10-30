/**
 * Player settings, kept per device in the RUN SDK's deviceCache (browser storage is blocked
 * in the game's sandbox). They load in the background; until then, and if the cache is
 * unavailable, everything works with the defaults.
 */
import { useSyncExternalStore } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

export interface Settings {
    /** Rain, storm and fog drawn over the world. */
    weatherFx: boolean;
    /** How dark nights get. */
    night: 'soft' | 'normal' | 'deep';
    /** The "Use: ..." hint above the Use button. */
    hints: boolean;
    /** The radar in the corner. */
    radar: boolean;
    /** Sound effects on, and their volume (0-1). */
    sound: boolean;
    volume: number;
    /** Music on, and its volume (0-1). */
    music: boolean;
    musicVolume: number;
    /** The quest tracker folded down to one line (tap it to open it again). */
    questCollapsed: boolean;
    /** A buzz in the hand on hits, kills and levels (game/haptics.ts). */
    haptics: boolean;
    /** The screen shakes on heavy blows (off for anyone it unsettles). */
    shake: boolean;
    /** An attack turns you to the nearest foe in reach (a tap on a phone has no aim of its own). */
    aimAssist: boolean;
}
const DEFAULTS: Settings = { weatherFx: true, night: 'normal', hints: true, radar: true, sound: true, volume: 0.7, music: true, musicVolume: 0.45, questCollapsed: false, haptics: true, shake: true, aimAssist: true };
const KEY = 'meh-fighter-settings';

let current: Settings = { ...DEFAULTS };
const listeners = new Set<() => void>();
const notify = () => {
    for (const l of listeners) l();
};
void (async () => {
    try {
        const raw = await RundotGameAPI.deviceCache.getItem(KEY);
        if (raw) {
            current = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
            notify();
        }
    } catch {
        /* no cache here: keep the defaults */
    }
})();

export const settings = {
    get: (): Settings => current,
    set(patch: Partial<Settings>): void {
        current = { ...current, ...patch };
        RundotGameAPI.deviceCache.setItem(KEY, JSON.stringify(current)).catch(() => {
            /* no cache: the change still holds for this session */
        });
        notify();
    },
    subscribe(l: () => void): () => void {
        listeners.add(l);
        return () => listeners.delete(l);
    },
};

export function useSettings(): Settings {
    return useSyncExternalStore(settings.subscribe, () => current);
}

/** How much of the night's darkness to draw. */
export const settingsDark = (): number => ({ soft: 0.6, normal: 0.9, deep: 1 })[current.night];
