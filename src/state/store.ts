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
    /** 'loading' → 'menu' → 'playing' (ADAPT: add your own screens/phases) */
    phase: 'loading' | 'menu' | 'playing';
    /** 0..1 progress of the critical-asset warm during 'loading' */
    loadProgress: number;
    /** Set by the host's onPause/onResume lifecycle hooks */
    paused: boolean;
    /** Player tile and chunk coordinates, and how many chunks are loaded */
    tileX: number;
    tileY: number;
    /** Health in half hearts, 0..6 */
    hp: number;
    /** Label of the equipped tool */
    tool: string;
    /** Terrace level the player stands on */
    height: number;
    chunkX: number;
    chunkY: number;
    loadedChunks: number;
}

const listeners = new Set<() => void>();

let state: AppState = {
    phase: 'loading',
    loadProgress: 0,
    paused: false,
    tileX: 0,
    tileY: 0,
    height: 0,
    hp: 6,
    tool: 'Bare hands',
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
