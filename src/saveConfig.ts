/**
 * What gets saved for each player (RUN's appStorage is per player and per game, so
 * every account — yours, a friend's — has its own save). Shape changes need a
 * version bump plus a migration; added fields fill in automatically.
 */
import { createSaveSystem, fillMissing } from './helpers/save.ts';
import { CARRY_MAX, COOLDOWN_MAX, defaultSpellSave, SPELLS, type SpellSave } from './game/world/spells.ts';

export interface FighterSave {
    version: number;
    /** Where the player was last (there is only the world). */
    scene: 'world';
    /** Last position in the world, in tiles. `set` is false until the player has moved. */
    world: { u: number; v: number; set: boolean };
    /** Equipped tool id (see world/character.ts TOOLS). */
    tool: string;
    /** Health in half hearts, 0..6. */
    hp: number;
    /** Total time played, in seconds. */
    playSeconds: number;
    /** Monsters defeated. */
    kills: number;
    /** Highest wave reached. */
    bestWave: number;
    /** Swords found (indices 0-29 into the sword sheet), and the one held (-1 = the original iron sword). */
    swords: number[];
    sword: number;
    /** Skill levels bought with gems. Vitality adds a heart each. */
    skills: { attack: number; defence: number; speed: number; vitality: number };
    /** Gems carried and not yet spent (at a frog); a death loses them. */
    gems: { attack: number; defence: number; speed: number; vitality: number };
    /** Spells unlocked from the frog, with their carry and cooldown levels. */
    spells: SpellSave;
}

export function defaultSave(): FighterSave {
    return {
        version: 1,
        scene: 'world',
        world: { u: 128.5, v: 128.5, set: false },
        tool: 'none',
        hp: 6,
        playSeconds: 0,
        kills: 0,
        bestWave: 0,
        swords: [],
        sword: -1,
        skills: { attack: 0, defence: 0, speed: 0, vitality: 0 },
        gems: { attack: 0, defence: 0, speed: 0, vitality: 0 },
        spells: defaultSpellSave(),
    };
}

export const saveSystem = createSaveSystem<FighterSave>({
    key: 'bounce-lab-save',
    version: 1,
    defaultSave,
    migrations: {},
    validate(s, def) {
        s.scene = def.scene; // older saves could be in the workshop, which is gone
        if (typeof s.world !== 'object' || !s.world) s.world = def.world;
        fillMissing(s.world, def.world);
        if (!Number.isFinite(s.world.u) || !Number.isFinite(s.world.v)) s.world = { ...def.world };
        if (typeof s.tool !== 'string') s.tool = def.tool;
        if (!(s.hp >= 0)) s.hp = def.hp;
        if (!(s.playSeconds >= 0)) s.playSeconds = 0;
        if (!(s.kills >= 0)) s.kills = 0;
        if (!(s.bestWave >= 0)) s.bestWave = 0;
        if (!Array.isArray(s.swords)) s.swords = [];
        s.swords = [...new Set((s.swords as unknown[]).filter((n): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 30))].sort((a, b) => a - b);
        if (!(s.swords.includes(s.sword) || s.sword === -1)) s.sword = -1;
        if (typeof s.skills !== 'object' || !s.skills) s.skills = { ...def.skills };
        fillMissing(s.skills, def.skills);
        for (const k of ['attack', 'defence', 'speed', 'vitality'] as const) if (!(s.skills[k] >= 0)) s.skills[k] = 0;
        if (typeof s.spells !== 'object' || !s.spells) s.spells = defaultSpellSave();
        const sp = s.spells;
        const fix = <T,>(v: unknown, make: (x: unknown) => T): T[] => SPELLS.map((_, i) => make(Array.isArray(v) ? v[i] : undefined));
        sp.unlocked = fix(sp.unlocked, (x) => x === true);
        sp.carry = fix(sp.carry, (x) => (typeof x === 'number' && x >= 0 ? Math.min(CARRY_MAX, Math.floor(x)) : 0));
        sp.cooldown = fix(sp.cooldown, (x) => (typeof x === 'number' && x >= 0 ? Math.min(COOLDOWN_MAX, Math.floor(x)) : 0));
        if (typeof s.gems !== 'object' || !s.gems) s.gems = { ...def.gems };
        fillMissing(s.gems, def.gems);
        for (const k of ['attack', 'defence', 'speed', 'vitality'] as const) if (!(s.gems[k] >= 0)) s.gems[k] = 0;
        if (!(s.hp >= 0 && s.hp <= 6 + 2 * s.skills.vitality)) s.hp = Math.min(6 + 2 * s.skills.vitality, Math.max(1, s.hp));
    },
});
