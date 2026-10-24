/**
 * Wires the player's controls to a character, shared by every scene that has
 * one: HUD button commands, keyboard shortcuts, and the health rules (hurt costs
 * a heart, die empties them, getting up restores them).
 */
import { commands, type GameCommand } from '../commands.ts';
import { net } from '../net/multiplayer.ts';
import { progress } from '../progress.ts';
import { store } from '../../state/store.ts';
import type { Character } from './character.ts';
import { HOTBAR_SLOTS, ITEMS } from '../survival.ts';

const KEYS: Record<string, GameCommand> = {
    ' ': { type: 'attack' }, j: { type: 'attack' }, e: { type: 'use' }, f: { type: 'interact' },
    c: { type: 'sit' }, g: { type: 'dig' }, r: { type: 'hymn' }, k: { type: 'dodge' }, l: { type: 'dodge' }, q: { type: 'skill' },
    // Number keys 1-4 pick a hotbar slot. (Shift is held to sprint: see below.)
    ...Object.fromEntries(Array.from({ length: HOTBAR_SLOTS }, (_, i) => [String(i + 1), { type: 'slot', index: i } as GameCommand])),
};

export interface Controls {
    /** Call once per frame, after the character has updated. */
    tick(): void;
    destroy(): void;
}

export function bindControls(character: Character): Controls {
    store.patch({ toolId: character.tool, hp: progress.savedHp(), maxHp: progress.maxHp() });
    // Tapping the sword slot again cycles through the swords you own (the original iron sword first).
    character.setSword(progress.equippedSword());
    const offCommands = commands.subscribe((c) => {
        if (c.type === 'item' || c.type === 'dodge' || c.type === 'skill') return; // the scene handles the bag, rolls and skills
        // A hotbar slot: a tool goes in hand; something to eat, drink or set down is used at once.
        if (c.type === 'slot') {
            const id = progress.hotbar()[c.index] ?? null;
            if (id && !ITEMS[id].tool) {
                commands.emit({ type: 'item', id });
                return;
            }
            progress.hold(c.index);
            commands.emit({ type: 'equip', tool: id ? ITEMS[id].tool!.holds : 'none' });
            return;
        }
        // Only tools you own can be held.
        if (c.type === 'equip' && !progress.hasTool(c.tool)) return;
        if (c.type === 'tool') return;
        if (c.type === 'sword') {
            const list = [-1, ...progress.ownedSwords()];
            const at = Math.max(0, list.indexOf(character.sword));
            const next = list[(at + c.delta + list.length) % list.length];
            character.setSword(next);
            progress.equipSword(next);
            return;
        }
        // Hurt costs a heart; Die empties them all. Getting up from death restores health (see tick).
        if (c.type === 'hurt' && !character.dead) store.patch({ hp: Math.max(0, store.get().hp - 2) });
        if (c.type === 'die' && !character.dead) store.patch({ hp: 0 });
        if (c.type !== 'equip' && c.type !== 'spell') net.sendAct(c.type);
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
    // Hold Shift to sprint.
    const onShift = (e: KeyboardEvent) => {
        if (e.key === 'Shift') store.patch({ sprint: e.type === 'keydown' });
    };
    window.addEventListener('keydown', onShift);
    window.addEventListener('keyup', onShift);

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
            window.removeEventListener('keydown', onShift);
            window.removeEventListener('keyup', onShift);
            store.patch({ sprint: false });
        },
    };
}
