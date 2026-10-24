/**
 * Tiny command bus from the React HUD (and keyboard) to the game scene.
 * HUD buttons emit; the world scene subscribes while it exists.
 */
export type GameCommand =
    | { type: 'attack' | 'use' | 'interact' | 'dig' | 'fish' | 'sit' | 'hurt' | 'die' }
    /** A quick roll with a moment of no damage (costs stamina). */
    | { type: 'dodge' }
    /** Take hotbar slot 0-3 in hand (a consumable there is used at once). */
    | { type: 'slot'; index: number }
    /** Unleash the home kingdom's active skill (when the combat meter is full). */
    | { type: 'skill' }
    | { type: 'hymn' }
    | { type: 'tool'; delta: number }
    | { type: 'equip'; tool: string }
    /** Cycle through the swords you own (-1 = the original iron sword). */
    | { type: 'sword'; delta: number }
    /** Cast a spell (an index into SPELLS in world/spells.ts) */
    | { type: 'spell'; index: number }
    /** Drink or eat something from the bag (an ItemId in game/survival.ts) */
    | { type: 'item'; id: string };

const listeners = new Set<(c: GameCommand) => void>();

export const commands = {
    emit(c: GameCommand): void {
        for (const l of listeners) l(c);
    },
    subscribe(l: (c: GameCommand) => void): () => void {
        listeners.add(l);
        return () => listeners.delete(l);
    },
};
