/**
 * The world map currently in play, for the HUD's map panel (the scene sets it; generating
 * the map again would take half a second).
 */
import type { WorldMap } from './mapGen.ts';

let current: WorldMap | null = null;
export const mapRef = {
    set(m: WorldMap | null): void {
        current = m;
    },
    get(): WorldMap | null {
        return current;
    },
};

/** Where the player and the monsters are, for the HUD's radar (the scene fills it a few times a second). */
export const radar: {
    u: number;
    v: number;
    /** Where the player faces, as a screen angle (0 = right, π/2 = down). */
    facing: number;
    monsters: { u: number; v: number; boss: number }[];
    /** The side (tile-space angle) the next or current wave comes from, while it is worth warning about; null otherwise. */
    threat: number | null;
} = { u: 0, v: 0, facing: Math.PI / 2, monsters: [], threat: null };
