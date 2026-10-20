/**
 * Wires the player's controls to a character, shared by every scene that has
 * one: HUD button commands, keyboard shortcuts, and the health rules (hurt costs
 * a heart, die empties them, getting up restores them).
 */
import { commands, type GameCommand } from '../commands.ts';
import { net } from '../net/multiplayer.ts';
import { progress } from '../progress.ts';
import { store } from '../../state/store.ts';
import { HOTBAR, type Character } from './character.ts';

const KEYS: Record<string, GameCommand> = {
    ' ': { type: 'attack' }, j: { type: 'attack' }, e: { type: 'use' }, f: { type: 'interact' },
    c: { type: 'sit' }, h: { type: 'hurt' }, x: { type: 'die' }, g: { type: 'dig' }, r: { type: 'fish' },
    q: { type: 'tool', delta: -1 }, t: { type: 'tool', delta: 1 },
    '[': { type: 'sword', delta: -1 }, ']': { type: 'sword', delta: 1 },
    // Number keys pick a hotbar slot.
    ...Object.fromEntries(HOTBAR.map((tool, i) => [String(i + 1), { type: 'equip', tool } as GameCommand])),
};

export interface Controls {
    /** Call once per frame, after the character has updated. */
    tick(): void;
    destroy(): void;
}

export function bindControls(character: Character): Controls {
    store.patch({ toolId: character.tool, hp: progress.savedHp(), maxHp: progress.maxHp() });
    const offCommands = commands.subscribe((c) => {
        // Hurt costs a heart; Die empties them all. Getting up from death restores health (see tick).
        if (c.type === 'hurt' && !character.dead) store.patch({ hp: Math.max(0, store.get().hp - 2) });
        if (c.type === 'die' && !character.dead) store.patch({ hp: 0 });
        if (c.type !== 'tool') net.sendAct(c.type);
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
            if (wasDead && !character.dead && store.get().hp === 0) store.patch({ hp: store.get().maxHp });
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
