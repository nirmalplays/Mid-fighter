/**
 * What gets saved for each player (RUN's appStorage is per player and per game, so
 * every account — yours, a friend's — has its own save). Shape changes need a
 * version bump plus a migration; added fields fill in automatically.
 */
import { createSaveSystem, fillMissing } from './helpers/save.ts';

export interface BounceSave {
    version: number;
    /** Where the player was last: the open world or the workshop. */
    scene: 'world' | 'base';
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
    /** Skill levels raised by monster drops. Vitality adds a heart each. */
    skills: { attack: number; defence: number; speed: number; vitality: number };
}

export function defaultSave(): BounceSave {
    return {
        version: 1,
        scene: 'world',
        world: { u: 128.5, v: 128.5, set: false },
        tool: 'none',
        hp: 6,
        playSeconds: 0,
        kills: 0,
        bestWave: 0,
        skills: { attack: 0, defence: 0, speed: 0, vitality: 0 },
    };
}

export const saveSystem = createSaveSystem<BounceSave>({
    key: 'bounce-lab-save',
    version: 1,
    defaultSave,
    migrations: {},
    validate(s, def) {
        if (s.scene !== 'world' && s.scene !== 'base') s.scene = def.scene;
        if (typeof s.world !== 'object' || !s.world) s.world = def.world;
        fillMissing(s.world, def.world);
        if (!Number.isFinite(s.world.u) || !Number.isFinite(s.world.v)) s.world = { ...def.world };
        if (typeof s.tool !== 'string') s.tool = def.tool;
        if (!(s.hp >= 0)) s.hp = def.hp;
        if (!(s.playSeconds >= 0)) s.playSeconds = 0;
        if (!(s.kills >= 0)) s.kills = 0;
        if (!(s.bestWave >= 0)) s.bestWave = 0;
        if (typeof s.skills !== 'object' || !s.skills) s.skills = { ...def.skills };
        fillMissing(s.skills, def.skills);
        for (const k of ['attack', 'defence', 'speed', 'vitality'] as const) if (!(s.skills[k] >= 0)) s.skills[k] = 0;
        if (!(s.hp >= 0 && s.hp <= 6 + 2 * s.skills.vitality)) s.hp = Math.min(6 + 2 * s.skills.vitality, Math.max(1, s.hp));
    },
});
