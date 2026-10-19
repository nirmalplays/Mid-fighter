/**
 * Tiny external store bridging game code (Pixi ticker, SDK callbacks, plain
 * modules) and React — no state-library dependency. Game code calls
 * store.patch(); React components subscribe with useStore(selector).
 *
 * Keep this store for UI-FACING state only (phase, HUD numbers, popups).
 * Per-frame simulation state stays inside the Pixi scene — patching the
 * store every frame re-renders React every frame.
 */
import { useSyncExternalStore } from 'react';

/** The UI-facing app state. ADAPT: extend alongside the initial state below. */
export interface AppState {
    /** 'loading' → 'menu' → 'playing' (the world); the home portal leads to 'base' and back. */
    phase: 'loading' | 'menu' | 'playing' | 'base';
    /** Where the world scene puts the player: map centre, or beside the home portal (coming back from the base). */
    spawnAt: 'center' | 'portal';
    /** 0..1 progress of the critical-asset warm during 'loading' */
    loadProgress: number;
    /** Set by the host's onPause/onResume lifecycle hooks */
    paused: boolean;
    /** Player tile and chunk coordinates, and how many chunks are loaded */
    tileX: number;
    tileY: number;
    /** Multiplayer link to the shared world room, and how many players (including you) are in it */
    netStatus: 'off' | 'connecting' | 'online';
    online: number;
    /** Monsters this player has defeated (from the save) */
    kills: number;
    /** Total time this player has played, in seconds (from the save) */
    playSeconds: number;
    /** True while the server is running the monsters (shared with everyone in the room) */
    sharedMonsters: boolean;
    /** Health in half hearts, 0..maxHp */
    hp: number;
    /** Maximum health in half hearts (6, plus 2 per Vitality level) */
    maxHp: number;
    /** Skill levels from drops, and the wave the portal has reached (0 before the first) */
    skills: { attack: number; defence: number; speed: number; vitality: number };
    wave: number;
    /** Seconds until the next portal opens, and the portal's bearing/distance for the HUD arrow (null if none) */
    nextWaveIn: number;
    portalAim: { angle: number; dist: number } | null;
    /** Short message shown near the top (wave start, pickups), cleared by the HUD */
    banner: { text: string; id: number } | null;
    /** Equipped tool id (a hotbar slot: see world/character.ts HOTBAR) */
    toolId: string;
    /** Terrace level the player stands on */
    height: number;
    chunkX: number;
    chunkY: number;
    loadedChunks: number;
}

const listeners = new Set<() => void>();

let state: AppState = {
    phase: 'loading',
    spawnAt: 'center',
    loadProgress: 0,
    paused: false,
    tileX: 0,
    tileY: 0,
    height: 0,
    netStatus: 'off',
    online: 0,
    kills: 0,
    playSeconds: 0,
    sharedMonsters: false,
    hp: 6,
    maxHp: 6,
    skills: { attack: 0, defence: 0, speed: 0, vitality: 0 },
    wave: 0,
    nextWaveIn: 0,
    portalAim: null,
    banner: null,
    toolId: 'none',
    chunkX: 0,
    chunkY: 0,
    loadedChunks: 0,
};

export const store = {
    /** Read the current state (from game code; in React use useStore). */
    get: (): AppState => state,
    /** Shallow-merge a partial update and notify React subscribers. */
    patch(partial: Partial<AppState>): void {
        state = { ...state, ...partial };
        for (const l of listeners) l();
    },
    subscribe(l: () => void): () => void {
        listeners.add(l);
        return () => listeners.delete(l);
    },
};

/**
 * React hook. IMPORTANT: the selector must return a primitive or a stable
 * reference (e.g. s => s.phase). Returning a fresh object/array each call
 * makes React re-render forever.
 */
export function useStore<T = AppState>(
    selector: (s: AppState) => T = (s) => s as unknown as T
): T {
    return useSyncExternalStore(store.subscribe, () => selector(state));
}
