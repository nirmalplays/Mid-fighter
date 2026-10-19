/**
 * Wires the player's controls to a character, shared by every scene that has
 * one: HUD button commands, keyboard shortcuts, and the health rules (hurt costs
 * a heart, die empties them, getting up restores them).
 */
import { commands, type GameCommand } from '../commands.ts';
import { store } from '../../state/store.ts';
import { TOOL_LABELS, type Character } from './character.ts';

const KEYS: Record<string, GameCommand> = {
    ' ': { type: 'attack' }, j: { type: 'attack' }, e: { type: 'use' }, f: { type: 'interact' },
    c: { type: 'sit' }, h: { type: 'hurt' }, x: { type: 'die' }, g: { type: 'dig' }, r: { type: 'fish' },
    q: { type: 'tool', delta: -1 }, t: { type: 'tool', delta: 1 },
};

export interface Controls {
    /** Call once per frame, after the character has updated. */
    tick(): void;
    destroy(): void;
}

export function bindControls(character: Character): Controls {
    store.patch({ tool: TOOL_LABELS[character.tool], hp: 6 });
    const offCommands = commands.subscribe((c) => {
        // Hurt costs a heart; Die empties them all. Getting up from death restores health (see tick).
        if (c.type === 'hurt' && !character.dead) store.patch({ hp: Math.max(0, store.get().hp - 2) });
        if (c.type === 'die' && !character.dead) store.patch({ hp: 0 });
        character.command(c);
    });
    const onKey = (e: KeyboardEvent) => {
        if (e.repeat) return;
        const cmd = KEYS[e.key.toLowerCase()];
        if (cmd) {
            e.preventDefault();
            commands.emit(cmd);
        }
    };
    window.addEventListener('keydown', onKey);

    let wasDead = false;
    return {
        tick() {
            if (wasDead && !character.dead && store.get().hp === 0) store.patch({ hp: 6 });
            wasDead = character.dead;
            // Out of hearts: collapse once any action has finished.
            if (store.get().hp === 0 && !character.dead && !character.locked) character.command({ type: 'die' });
        },
        destroy() {
            offCommands();
            window.removeEventListener('keydown', onKey);
        },
    };
}
