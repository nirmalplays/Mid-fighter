/**
 * The game's side of saving: scenes report where the player is, and this keeps the
 * save (src/saveConfig.ts) current and the HUD's play-time clock in step. Writes are
 * cheap — the save system batches them and flushes at most every few seconds, plus
 * when the app is backgrounded.
 */
import { saveSystem } from '../saveConfig.ts';
import { store } from '../state/store.ts';
import { HOTBAR, type Tool } from './world/character.ts';

let fraction = 0;

export const progress = {
    /** The loaded save (always set after boot). */
    get saved() {
        return saveSystem.data;
    },

    /** The saved tool, checked against the known list. */
    savedTool(): Tool {
        const t = saveSystem.data?.tool ?? 'none';
        return (HOTBAR as readonly string[]).includes(t) ? (t as Tool) : 'none';
    },

    /** The saved health, never starting someone at zero. */
    savedHp(): number {
        const hp = saveSystem.data?.hp ?? 6;
        return hp > 0 ? hp : this.maxHp();
    },

    maxHp(): number {
        return 6 + 2 * (saveSystem.data?.skills.vitality ?? 0);
    },

    skills() {
        return saveSystem.data?.skills ?? { attack: 0, defence: 0, speed: 0, vitality: 0 };
    },

    /** Raise a skill by one level (a drop was picked up). Returns the new level. */
    raise(skill: 'attack' | 'defence' | 'speed' | 'vitality'): number {
        const d = saveSystem.data;
        if (!d) return 0;
        d.skills[skill] += 1;
        store.patch({ skills: { ...d.skills }, maxHp: 6 + 2 * d.skills.vitality });
        saveSystem.save();
        return d.skills[skill];
    },

    reachWave(n: number): void {
        const d = saveSystem.data;
        if (!d || n <= d.bestWave) return;
        d.bestWave = n;
        saveSystem.save();
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

    /** One more monster down. */
    addKill(): void {
        const d = saveSystem.data;
        if (!d) return;
        d.kills += 1;
        store.patch({ kills: d.kills });
        saveSystem.save();
    },

    /** Write now (leaving a scene, pressing New game). */
    flush(): void {
        saveSystem.save();
    },

    /** Wipe this player's progress back to a fresh game. */
    reset(): void {
        const d = saveSystem.data;
        if (!d) return;
        Object.assign(d, { scene: 'world', world: { u: 128.5, v: 128.5, set: false }, tool: 'none', hp: 6, playSeconds: 0, kills: 0, bestWave: 0, skills: { attack: 0, defence: 0, speed: 0, vitality: 0 } });
        store.patch({ playSeconds: 0, kills: 0, maxHp: 6, hp: 6, skills: { attack: 0, defence: 0, speed: 0, vitality: 0 } });
        saveSystem.save();
    },
};
