/**
 * The game's side of saving: scenes report where the player is, and this keeps the
 * save (src/saveConfig.ts) current and the HUD's play-time clock in step. Writes are
 * cheap — the save system batches them and flushes at most every few seconds, plus
 * when the app is backgrounded.
 */
import type { Skill } from '../shared/sim.ts';
import { saveSystem } from '../saveConfig.ts';
import { store } from '../state/store.ts';
import { GEM_CAP, SKILL_CAP, upgradeCost } from './skills.ts';
import { HOTBAR, type Tool } from './world/character.ts';
import { CARRY_MAX, COOLDOWN_MAX, defaultSpellSave, levelCost, SPELLS, UNLOCK_COST, type SpellSave } from './world/spells.ts';

let fraction = 0;

const copySpells = (s: SpellSave): SpellSave => ({ unlocked: [...s.unlocked], carry: [...s.carry], cooldown: [...s.cooldown] });

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

    /** Keep a gem from a drop (it does nothing until spent). Returns false if that colour is full. */
    addGem(skill: Skill, n = 1): boolean {
        const d = saveSystem.data;
        if (!d || d.gems[skill] >= GEM_CAP) return false;
        d.gems[skill] = Math.min(GEM_CAP, d.gems[skill] + n);
        store.patch({ gems: { ...d.gems } });
        saveSystem.save();
        return true;
    },

    /** Spend gems on one level of a skill. Returns true if it was bought. */
    buy(skill: Skill): boolean {
        const d = saveSystem.data;
        if (!d || d.skills[skill] >= SKILL_CAP[skill]) return false;
        const cost = upgradeCost(d.skills[skill]);
        if (d.gems[skill] < cost) return false;
        d.gems[skill] -= cost;
        d.skills[skill] += 1;
        const maxHp = 6 + 2 * d.skills.vitality;
        store.patch({ gems: { ...d.gems }, skills: { ...d.skills }, maxHp, ...(skill === 'vitality' ? { hp: Math.min(maxHp, store.get().hp + 2) } : {}) });
        saveSystem.save();
        return true;
    },

    /** Swords this player has found. */
    ownedSwords(): number[] {
        return saveSystem.data?.swords ?? [];
    },

    /** The sword held (-1 = the original iron sword). */
    equippedSword(): number {
        return saveSystem.data?.sword ?? -1;
    },

    /** Add a sword to the collection. Returns true if it is new, false if the player already had it. */
    addSword(i: number): boolean {
        const d = saveSystem.data;
        if (!d || i < 0 || i >= 30) return false;
        if (d.swords.includes(i)) return false;
        d.swords = [...d.swords, i].sort((a, b) => a - b);
        store.patch({ swordsOwned: d.swords });
        saveSystem.save();
        return true;
    },

    equipSword(i: number): void {
        const d = saveSystem.data;
        if (!d) return;
        d.sword = i;
        store.patch({ swordIdx: i });
        saveSystem.save();
    },

    reachWave(n: number): void {
        const d = saveSystem.data;
        if (!d || n <= d.bestWave) return;
        d.bestWave = n;
        saveSystem.save();
    },

    record(p: { scene: 'world'; u?: number; v?: number; tool: string; hp: number }): void {
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

    /** Spend gems to unlock a spell (it is locked until bought from the frog). */
    unlockSpell(i: number): boolean {
        const d = saveSystem.data;
        const sp = SPELLS[i];
        if (!d || !sp || d.spells.unlocked[i] || d.gems[sp.gem] < UNLOCK_COST) return false;
        d.gems[sp.gem] -= UNLOCK_COST;
        d.spells.unlocked[i] = true;
        store.patch({ gems: { ...d.gems }, spells: copySpells(d.spells) });
        saveSystem.save();
        return true;
    },

    /** Spend gems to carry one more charge of a spell, or to cool it down faster. */
    upgradeSpell(i: number, what: 'carry' | 'cooldown'): boolean {
        const d = saveSystem.data;
        const sp = SPELLS[i];
        if (!d || !sp || !d.spells.unlocked[i]) return false;
        const level = d.spells[what][i];
        if (level >= (what === 'carry' ? CARRY_MAX : COOLDOWN_MAX)) return false;
        const cost = levelCost(level);
        if (d.gems[sp.gem] < cost) return false;
        d.gems[sp.gem] -= cost;
        d.spells[what][i] = level + 1;
        store.patch({ gems: { ...d.gems }, spells: copySpells(d.spells) });
        saveSystem.save();
        return true;
    },

    /** The player died: the gems carried are lost and the next run starts at the beginning with full health. */
    endRun(): void {
        const d = saveSystem.data;
        if (!d) return;
        const none = { attack: 0, defence: 0, speed: 0, vitality: 0 };
        const maxHp = 6 + 2 * d.skills.vitality;
        Object.assign(d, { scene: 'world', world: { u: 128.5, v: 128.5, set: false }, hp: maxHp, gems: { ...none } });
        store.patch({ gems: { ...none }, hp: maxHp, maxHp });
        saveSystem.save();
    },

    /** Wipe this player's progress back to a fresh game. */
    reset(): void {
        const d = saveSystem.data;
        if (!d) return;
        Object.assign(d, { scene: 'world', world: { u: 128.5, v: 128.5, set: false }, tool: 'none', hp: 6, playSeconds: 0, kills: 0, bestWave: 0, swords: [], sword: -1, skills: { attack: 0, defence: 0, speed: 0, vitality: 0 }, gems: { attack: 0, defence: 0, speed: 0, vitality: 0 }, spells: defaultSpellSave() });
        store.patch({ playSeconds: 0, kills: 0, swordsOwned: [], swordIdx: -1, maxHp: 6, hp: 6, skills: { attack: 0, defence: 0, speed: 0, vitality: 0 }, gems: { attack: 0, defence: 0, speed: 0, vitality: 0 }, spells: defaultSpellSave() });
        saveSystem.save();
    },
};
