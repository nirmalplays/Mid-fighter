/**
 * Tiny command bus from the React HUD (and keyboard) to the game scene.
 * HUD buttons emit; the world scene subscribes while it exists.
 */
export type GameCommand =
    | { type: 'attack' | 'use' | 'interact' | 'dig' | 'fish' | 'sit' | 'hurt' | 'die' }
    | { type: 'tool'; delta: number }
    | { type: 'equip'; tool: string }
    /** Dev: cycle the sword drawn in the hand (-1 = the original iron sword). */
    | { type: 'sword'; delta: number };

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
