/**
 * The game's side of saving: scenes report where the player is, and this keeps the
 * save (src/saveConfig.ts) current and the HUD's play-time clock in step. Writes are
 * cheap — the save system batches them and flushes at most every few seconds, plus
 * when the app is backgrounded.
 */
import { saveSystem } from '../saveConfig.ts';
import { store } from '../state/store.ts';
import { TOOLS, type Tool } from './world/character.ts';

let fraction = 0;

export const progress = {
    /** The loaded save (always set after boot). */
    get saved() {
        return saveSystem.data;
    },

    /** The saved tool, checked against the known list. */
    savedTool(): Tool {
        const t = saveSystem.data?.tool ?? 'none';
        return (TOOLS as readonly string[]).includes(t) ? (t as Tool) : 'none';
    },

    /** The saved health, never starting someone at zero. */
    savedHp(): number {
        const hp = saveSystem.data?.hp ?? 6;
        return hp > 0 ? hp : 6;
    },

    record(p: { scene: 'world' | 'base'; u?: number; v?: number; tool: string; hp: number }): void {
        const d = saveSystem.data;
        if (!d) return;
        d.scene = p.scene;
        if (p.scene === 'world' && p.u !== undefined && p.v !== undefined) d.world = { u: p.u, v: p.v, set: true };
        d.tool = p.tool;
        d.hp = p.hp;
        saveSystem.markDirty();
    },

    /** Count play time (seconds) and let the save system flush on its schedule. */
    addTime(dt: number): void {
        const d = saveSystem.data;
        if (!d) return;
        d.playSeconds += dt;
        saveSystem.markDirty();
        saveSystem.tick(dt);
        fraction += dt;
        if (fraction >= 1) {
            fraction = 0;
            store.patch({ playSeconds: Math.floor(d.playSeconds) });
        }
    },

    /** Write now (leaving a scene, pressing New game). */
    flush(): void {
        saveSystem.save();
    },

    /** Wipe this player's progress back to a fresh game. */
    reset(): void {
        const d = saveSystem.data;
        if (!d) return;
        Object.assign(d, { scene: 'world', world: { u: 128.5, v: 128.5, set: false }, tool: 'none', hp: 6, playSeconds: 0 });
        store.patch({ playSeconds: 0 });
        saveSystem.save();
    },
};
