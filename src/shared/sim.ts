/**
 * The shared combat simulation: monsters, waves, their shots and drops. The waves never really
 * stop: they come in onslaughts, each wave arriving a few seconds after the last has finished
 * coming in (2-5 s in the first onslaught), every one bigger than the one before. Only when a
 * whole onslaught (5 waves, then 5-10) has been beaten does a long breather come. Each wave comes
 * from its own side (the radar shows it). Players in a camp are out of reach: monsters lose them,
 * and with nobody out in the world no wave comes at all. Plain TypeScript
 * with no graphics, so the same code runs on the server (src/rooms/WorldRoom.ts, one
 * simulation for everyone in the room) and in the browser (offline play). Clients only
 * draw what it produces. Positions are grid tiles (u, v).
 *
 * Night (shared/daynight.ts, from the wall clock) makes the waves bigger, faster and closer.
 * Drops are gems, swords and potions from kills, and items players set down to share (chests, gathering in co-op).
 */
import { ITEM_IDS } from '../game/survival.ts';

export interface KindDef {
    hp: number;
    /** Shoots from a distance: how far, how close it lets you come (it backs off), how often, and its shot. */
    ranged?: { range: number; keep: number; every: number; shot: ShotKind; speed: number; damage: number };
    /** Runs at you and blows up beside you (its attack is the fuse): blast radius and damage. */
    explode?: { r: number; damage: number };
    /** Its bite, as a multiple of the wave's damage, and how far a hit throws it back (1 = normally). */
    dmgMul?: number;
    knock?: number;
    /** Tiles per second. */
    speed: number;
    /** Distance at which it starts an attack, and the farthest a landing attack still hits (+0.45). */
    reach: number;
    /** Time the attack animation plays, ms, and the fraction of it at which the hit lands. */
    attackMs: number;
    hitAt: number;
    recoverMs: number;
    weight: number;
}

export const KINDS: Record<string, KindDef> = {
    goblin: { hp: 5, speed: 2.3, reach: 1.05, attackMs: 560, hitAt: 0.55, recoverMs: 1300, weight: 3 },
    slime: { hp: 4, speed: 1.5, reach: 0.95, attackMs: 640, hitAt: 0.6, recoverMs: 1500, weight: 3 },
    wolf: { hp: 6, speed: 3.5, reach: 1.15, attackMs: 440, hitAt: 0.5, recoverMs: 1300, weight: 2 },
    skeleton: { hp: 8, speed: 1.9, reach: 1.1, attackMs: 720, hitAt: 0.6, recoverMs: 1600, weight: 2 },
    kobolt: { hp: 4, speed: 2.8, reach: 1.0, attackMs: 500, hitAt: 0.5, recoverMs: 1200, weight: 3 },
    scorpion: { hp: 10, speed: 1.6, reach: 1.2, attackMs: 700, hitAt: 0.6, recoverMs: 1700, weight: 2 },
    // The newer foes (drawn from the same art, dressed differently: see game/world/monsters.ts).
    wizard: { hp: 7, speed: 1.7, reach: 1.0, attackMs: 760, hitAt: 0.7, recoverMs: 900, weight: 1, ranged: { range: 7, keep: 4.5, every: 2600, shot: 'bolt', speed: 5, damage: 2 } },
    archer: { hp: 5, speed: 2.3, reach: 1.0, attackMs: 600, hitAt: 0.7, recoverMs: 700, weight: 2, ranged: { range: 8, keep: 5.5, every: 1900, shot: 'arrow', speed: 9.5, damage: 1 } },
    brute: { hp: 26, speed: 1.35, reach: 1.45, attackMs: 950, hitAt: 0.6, recoverMs: 1800, weight: 1, dmgMul: 2, knock: 0.25 },
    wraith: { hp: 4, speed: 3.9, reach: 1.0, attackMs: 420, hitAt: 0.5, recoverMs: 1000, weight: 2 },
    bomber: { hp: 3, speed: 3.1, reach: 1.15, attackMs: 750, hitAt: 1, recoverMs: 0, weight: 2, explode: { r: 1.9, damage: 3 } },
    // Pyraxis's Mist-maddened quarriers (the story's: knocked out with a blunt tool, they are rescued).
    hollowed: { hp: 6, speed: 1.8, reach: 1.05, attackMs: 640, hitAt: 0.55, recoverMs: 1500, weight: 0 },
};
/**
 * The story's bosses and demons, each with its own art (tools/build-demons.py). They fight like the
 * kind they are built on (the boss table sets their health, speed and blows) and never come in waves.
 */
const DEMON_BASE: Record<string, string> = {
    d_cindergore: 'brute', d_tarek: 'brute', d_pyra: 'wizard', d_ignis: 'wolf',
    d_zephyrclaw: 'wolf', d_baruch: 'slime', d_skyshredder: 'skeleton', d_vael: 'wizard',
    d_frostbite: 'brute', d_queen: 'wizard', d_paladin: 'skeleton', d_hydros: 'scorpion',
    d_voidknight: 'skeleton', d_amalgam: 'wolf', d_echo: 'wizard', d_reliquary: 'skeleton', d_malakor: 'skeleton',
};
for (const [d, base] of Object.entries(DEMON_BASE)) KINDS[d] = { ...KINDS[base], weight: 0 };

// ================================================================ BESTIARY (Bestiary team) ======
// Mythical foes and bosses (designs, archetypes and phases: src/game/bestiary.ts). Registration only:
// the two hooks outside this block are `...BEAST_KIND_NAMES` at the end of KIND_NAMES (wire order)
// and the `mythicBossSpec` line at the top of bossSpec. Weight 0 = not in waves yet; whoever owns
// waveSpec adds them by bestiary.ts `minWave` / `replaces`, and maps `archetype` onto the AI.
const BEAST_FOES: Record<string, KindDef> = {
    imp: { hp: 5, speed: 3.0, reach: 1.0, attackMs: 600, hitAt: 0.6, recoverMs: 900, weight: 0, ranged: { range: 7, keep: 4, every: 2200, shot: 'bolt', speed: 6.5, damage: 1 } },
    harpy: { hp: 8, speed: 3.3, reach: 1.25, attackMs: 620, hitAt: 0.55, recoverMs: 1300, weight: 0 },
    hellhound: { hp: 10, speed: 4.0, reach: 1.2, attackMs: 460, hitAt: 0.5, recoverMs: 1100, weight: 0, dmgMul: 1.2 },
    gargoyle: { hp: 18, speed: 2.2, reach: 1.25, attackMs: 760, hitAt: 0.6, recoverMs: 1500, weight: 0, dmgMul: 1.5, knock: 0.5 },
    salamander: { hp: 14, speed: 2.1, reach: 1.5, attackMs: 700, hitAt: 0.6, recoverMs: 1300, weight: 0, dmgMul: 1.3 },
    wisp: { hp: 6, speed: 2.0, reach: 1.0, attackMs: 800, hitAt: 0.7, recoverMs: 900, weight: 0, ranged: { range: 8, keep: 5, every: 2400, shot: 'bolt', speed: 5.5, damage: 2 } },
    deathknight: { hp: 24, speed: 1.7, reach: 1.4, attackMs: 900, hitAt: 0.62, recoverMs: 1500, weight: 0, dmgMul: 1.8, knock: 0.4 },
};
/** Each mythical boss's kind fights from this body until the boss phases are data-driven. */
const BEAST_BOSS_BASE: Record<string, string> = {
    b_dragon: 'brute', b_griffin: 'wolf', b_hydra: 'scorpion', b_kraken: 'scorpion', b_colossus: 'brute',
    b_minotaur: 'brute', b_basilisk: 'scorpion', b_phoenix: 'wizard', b_cerberus: 'wolf', b_manticore: 'wolf',
};
Object.assign(KINDS, BEAST_FOES);
for (const [k, base] of Object.entries(BEAST_BOSS_BASE)) KINDS[k] = { ...KINDS[base], attackMs: Math.max(800, KINDS[base].attackMs), weight: 0 };
/** Wire names for the new kinds (appended after the old ones, so old indices stay valid). */
const BEAST_KIND_NAMES = ['imp', 'harpy', 'hellhound', 'gargoyle', 'salamander', 'wisp', 'deathknight',
    'b_dragon', 'b_griffin', 'b_hydra', 'b_kraken', 'b_colossus', 'b_minotaur', 'b_basilisk', 'b_phoenix', 'b_cerberus', 'b_manticore'] as const;
/** Mythical bosses, codes 60-69 (game/eidolon.ts names them): kind, health, speed, blow, reach, slam ms, [shot fan every ms, count]. */
const MYTHIC_BOSSES: Record<number, StoryBossRow> = {
    60: ['b_dragon', 620, 0.95, 3, 2.0, 5600, [3400, 7]],
    61: ['b_griffin', 420, 1.35, 3, 1.6, 0, [3000, 4]],
    62: ['b_hydra', 640, 0.85, 3, 2.1, 0, [2600, 3]],
    63: ['b_kraken', 700, 0.6, 3, 2.4, 4800, [3600, 5]],
    64: ['b_colossus', 800, 0.7, 4, 2.0, 4200],
    65: ['b_minotaur', 560, 1.2, 4, 1.7, 5200],
    66: ['b_basilisk', 520, 1.1, 3, 1.8, 0, [3200, 3]],
    67: ['b_phoenix', 480, 1.25, 3, 1.5, 6000, [2400, 6]],
    68: ['b_cerberus', 600, 1.3, 3, 1.8, 0, [3800, 3]],
    69: ['b_manticore', 540, 1.3, 3, 1.7, 0, [2800, 5]],
};
type StoryBossRow = [string, number, number, number, number, number, [number, number]?];
function mythicBossSpec(code: number, tier: number) {
    const row = MYTHIC_BOSSES[code];
    if (!row) return null;
    const [kind, target, speedMul, damage, reachMul, slamMs, volley] = row;
    const t = Math.min(5, Math.max(0, Math.floor(tier)));
    return { kind, hpMul: (target * Math.pow(1.3, t)) / KINDS[kind].hp, speedMul, damage: damage + Math.floor(t / 2), reachMul, slamMs, ...(volley ? { volley: { every: volley[0], n: volley[1] } } : {}) };
}
// ============================================================== end BESTIARY ======
/** What enemies shoot. */
export const SHOT_KINDS = ['bolt', 'arrow'] as const;
export type ShotKind = (typeof SHOT_KINDS)[number];
/** Index order used on the wire. */
export const KIND_NAMES = ['goblin', 'slime', 'wolf', 'skeleton', 'kobolt', 'scorpion', 'wizard', 'archer', 'brute', 'wraith', 'bomber', 'hollowed',
    'd_cindergore', 'd_tarek', 'd_pyra', 'd_ignis', 'd_zephyrclaw', 'd_baruch', 'd_skyshredder', 'd_vael',
    'd_frostbite', 'd_queen', 'd_paladin', 'd_hydros', 'd_voidknight', 'd_amalgam', 'd_echo', 'd_reliquary', 'd_malakor', ...BEAST_KIND_NAMES] as const;
export const SKILLS = ['attack', 'defence', 'speed', 'vitality'] as const;
export type Skill = (typeof SKILLS)[number];
/** Potions: a drink that gives a short boost (red heals, blue Attack, yellow Speed, purple a shield, black Rage). */
export const POTIONS = ['red', 'blue', 'yellow', 'purple', 'black'] as const;
export type Potion = (typeof POTIONS)[number];
/** What a drop can be: a skill gem, a rare sword, or a potion (named 'potion_<colour>'). */
export type DropKind = Skill | 'sword' | `potion_${Potion}` | `item_${string}`;
/** Order of drop kinds on the wire (a sword is index 4, potions 5-9). */
export const DROP_KINDS: readonly DropKind[] = [...SKILLS, 'sword', ...POTIONS.map((p) => `potion_${p}` as const), ...ITEM_IDS.map((i) => `item_${i}` as const)];
/** Most of one item a shared drop may hold. */
export const LOOT_MAX = 10;
/** Chance a kill also drops a random potion (before the wave bonus). */
export const POTION_CHANCE = 0.12;
/** How many swords exist (src/assets/File.png is 6 x 5). */
export const SWORD_COUNT = 30;
/** Chance a kill also drops a random sword, by monster kind (before the wave bonus). */
export const SWORD_CHANCE: Record<string, number> = { hollowed: 0, goblin: 0.025, slime: 0.025, wolf: 0.035, skeleton: 0.05, kobolt: 0.03, scorpion: 0.05, wizard: 0.07, archer: 0.04, brute: 0.09, wraith: 0.04, bomber: 0.02 };
/** What each monster kind drops, and the chance. */
export const DROP_TABLE: Record<string, { skill: Skill; chance: number }> = {
    goblin: { skill: 'attack', chance: 0.8 },
    skeleton: { skill: 'defence', chance: 0.9 },
    wolf: { skill: 'speed', chance: 0.8 },
    slime: { skill: 'vitality', chance: 0.6 },
    kobolt: { skill: 'speed', chance: 0.7 },
    scorpion: { skill: 'vitality', chance: 0.7 },
    wizard: { skill: 'attack', chance: 0.9 },
    archer: { skill: 'speed', chance: 0.8 },
    brute: { skill: 'vitality', chance: 1 },
    wraith: { skill: 'speed', chance: 0.7 },
    bomber: { skill: 'attack', chance: 0.6 },
};
/**
 * Bosses: a code (see game/eidolon.ts) picks the stats. Guardians are tough, wardens much tougher and slam
 * the ground around them, Malakor calls minions when half beaten. `tier` (0-5) is how far into the
 * campaign the boss is met, so later kingdoms hit harder.
 */
export function bossSpec(code: number, tier: number) {
    const t = Math.min(5, Math.max(0, Math.floor(tier)));
    const kinds = ['kobolt', 'goblin', 'skeleton', 'scorpion'];
    const guardKinds = ['kobolt', 'wolf', 'slime', 'scorpion'];
    // Health is set directly (whatever the kind's own health), so every kingdom's bosses are as tough.
    const hp = (kind: string, target: number) => target / KINDS[kind].hp;
    if (code >= 60 && code <= 69) return mythicBossSpec(code, t); // BESTIARY hook (see the block above)
    if (code === 98) return { kind: 'slime', hpMul: hp('slime', 30 * Math.pow(1.5, t)), speedMul: 1.4, damage: 2 + Math.ceil(t / 2), reachMul: 1.3, slamMs: 0 };
    if (code === 99) return { kind: 'd_malakor', hpMul: hp('d_malakor', 500 * Math.pow(1.35, t)), speedMul: 1.15, damage: 4 + Math.min(4, t), reachMul: 2.2, slamMs: 4200, volley: { every: 3200, n: 6 } };
    const e = Math.floor(code / 10) - 1;
    const n = code % 10;
    if (e < 0 || e > 3) return null;
    // The story's lands: each land's three sub-bosses and its demon (Pyraxis, Zephyria, Aquatica, the Void Wastes).
    const lift = Math.pow(1.3, t);
    const story = STORY_BOSSES[e][n];
    if (story) {
        const [kind, target, speedMul, damage, reachMul, slamMs, volley] = story;
        return { kind, hpMul: hp(kind, target * lift), speedMul, damage: damage + Math.floor(t / 2), reachMul, slamMs, ...(volley ? { volley: { every: volley[0], n: volley[1] } } : {}) };
    }
    if (n === 9) return { kind: kinds[e], hpMul: hp(kinds[e], 90 * Math.pow(1.6, t)), speedMul: 1.1, damage: 2 + t, reachMul: 1.9, slamMs: 5200 };
    if (n >= 1 && n <= 3) return { kind: guardKinds[e], hpMul: hp(guardKinds[e], 24 * Math.pow(1.55, t)), speedMul: 1.05, damage: 1 + Math.ceil(t / 2), reachMul: 1.4, slamMs: 0 };
    return null;
}

/** Each land's bosses by sub-boss number (9 = its demon): kind, health, speed, damage, reach, slam ms, and a fan of shots [every ms, how many]. */
type StoryBoss = [string, number, number, number, number, number, [number, number]?];
const STORY_BOSSES: Record<number, Record<number, StoryBoss>> = {
    0: { 1: ['d_cindergore', 110, 1.05, 2, 1.25, 0], 2: ['d_tarek', 170, 0.85, 2, 1.5, 4600], 3: ['d_pyra', 150, 1, 2, 1.2, 0, [2600, 3]], 9: ['d_ignis', 420, 0.95, 3, 1.9, 5200, [3600, 5]] },
    1: { 1: ['d_zephyrclaw', 120, 1.25, 2, 1.3, 0], 2: ['d_baruch', 180, 1.1, 2, 1.5, 4400], 3: ['d_skyshredder', 170, 1, 2, 1.4, 0, [3000, 4]], 9: ['d_vael', 440, 1.1, 3, 1.6, 5000, [2400, 5]] },
    2: { 1: ['d_frostbite', 140, 0.9, 3, 1.4, 4800], 2: ['d_queen', 160, 1, 2, 1.2, 0, [2800, 3]], 3: ['d_paladin', 190, 0.95, 3, 1.5, 0], 9: ['d_hydros', 480, 0.9, 3, 2, 5000, [3400, 5]] },
    3: { 1: ['d_voidknight', 170, 1.15, 3, 1.5, 0], 2: ['d_amalgam', 220, 1, 3, 1.7, 4600, [3200, 3]], 3: ['d_echo', 180, 1, 3, 1.2, 0, [2600, 4]], 9: ['d_reliquary', 260, 1, 3, 1.5, 4800] },
};

export const STATES = ['chase', 'attack', 'recover', 'dying'] as const;
export type State = (typeof STATES)[number];

export const DROP_LIFE_MS = 45000;
/** Dying monsters stay this long (animation + fade) before they are removed. */
export const DYING_MS = 1400;
const LEASH = 60;
/** A player swing reaches this far, within this many radians of where they face. */
const REACH = 1.9;
const ARC = 1.3;
/** A wave sends in its monsters over this long. */
const WAVE_SPAWN_WINDOW_MS = 14000;
/** Once a wave has sent everyone, stragglers that will not come (stuck, or lost) give up after this long. */
const STRAGGLER_MS = 120000;
/** How wide (radians) the side a wave comes from is. */
const WAVE_SPREAD = 1.3;
/** Monsters appear this far from a player (tiles), just outside the screen. */
const DIST_MIN = 10;
const DIST_MAX = 16;
/** A player must be this close (tiles) to a drop to take it (a little slack for lag). */
const PICKUP_SLACK = 2.6;
/** Most monsters alive at once, so phones keep up. */
export const MAX_ALIVE = 60;

/** Which colour variant of each monster fights in wave n (0 = first, 1 = second, 2 = third). */
export function tierOf(n: number): number {
    return n >= 10 ? 2 : n >= 5 ? 1 : 0;
}

/** The gap (ms) after a wave has finished coming in before the next: short in the first onslaught, a little longer later. */
export function waveGap(n: number, rand: () => number): number {
    return n <= 5 ? 2000 + rand() * 3000 : 3000 + rand() * 3000;
}
/** How many waves an onslaught has before the respite: always five. */
export const ONSLAUGHT = 5;
export function onslaughtSize(_first: boolean, _rand: () => number): number {
    return ONSLAUGHT;
}

/** Monster count, toughness and kinds for wave n and a number of players. Every wave is bigger than the last. */
export function waveSpec(n: number, players = 1, night = 0) {
    const kinds = ['goblin', 'slime'];
    if (n >= 2) kinds.push('wolf', 'kobolt');
    if (n >= 3) kinds.push('skeleton', 'bomber');
    if (n >= 4) kinds.push('scorpion', 'archer');
    if (n >= 6) kinds.push('wizard', 'wraith');
    if (n >= 8) kinds.push('brute');
    const extra = Math.max(0, players - 1);
    return {
        count: Math.min(100, Math.round((4 + 3 * (n - 1) + Math.floor(n * n / 12)) * (1 + 0.6 * extra) * (1 + 0.5 * night))),
        kinds,
        hpMul: Math.pow(1.25, n - 1) * (1 + 0.25 * extra),
        speedMul: Math.min(1.8, 1 + 0.06 * (n - 1)) * (1 + 0.15 * night),
        damage: n >= 15 ? 4 : n >= 9 ? 3 : n >= 4 ? 2 : 1,
    };
}

export interface SimPlayer {
    id: string;
    u: number;
    v: number;
}

export interface SimEnv {
    /** Alive players currently in the open world (the only ones monsters hunt). */
    players(): SimPlayer[];
    /** May an enemy step from one spot to another (plants do not stop them; water and cliffs do). */
    canMove(fromU: number, fromV: number, toU: number, toV: number): boolean;
    /** Is this a good place to stand (spawn spots)? */
    canStand(u: number, v: number): boolean;
    /** May a wave's monsters come in here (open ground, not inside a cave or a ruin)? */
    wild?(u: number, v: number): boolean;
    rand(): number;
    /** How dark it is, 0 (day) .. 1 (night): night hordes are bigger and come in closer. */
    night?(): number;
    /** Every player is reading a story page or talking: the waves hold their breath meanwhile. */
    calm?(): boolean;
}

/** A shot in flight (a wizard's bolt, an archer's arrow): tiles, tiles per second, ms left. */
export interface SimShot {
    id: number;
    /** Struck back by a player (it now hits monsters, and counts as theirs). */
    by?: string;
    kind: ShotKind;
    u: number;
    v: number;
    du: number;
    dv: number;
    life: number;
    damage: number;
}

export interface SimMonster {
    id: number;
    kind: string;
    u: number;
    v: number;
    hp: number;
    max: number;
    state: State;
    /** Ms spent in the current state. */
    t: number;
    speedMul: number;
    damage: number;
    ku: number;
    kv: number;
    hit: boolean;
    side: 1 | -1;
    /** Colour variant (0-2), from the wave it spawned in. */
    tier: number;
    /** Boss code (0 = an ordinary monster), its reach multiplier, slam timer and whether it has called help. */
    boss: number;
    reachMul: number;
    slamMs: number;
    slamT: number;
    called: boolean;
    /** Ms until a shooter may shoot again. */
    shotT: number;
    /** Share of each blow that gets through (a boss's ward: 1 = none). */
    ward: number;
    /** A boss's spread of shots: how often, how many, ms until the next. */
    volleyMs: number;
    volleyN: number;
    volleyT: number;
}

export interface SimDrop {
    id: number;
    skill: DropKind;
    /** Which sword (0-29) when `skill` is 'sword', else -1. */
    sword: number;
    u: number;
    v: number;
    age: number;
}

/** A wave while it is still sending in monsters (there is no portal: they just appear off-screen). */
export interface SimWave {
    wave: number;
    age: number;
    /** Monsters still to come, ms until the next one, and the average gap. */
    toSpawn: number;
    nextIn: number;
    every: number;
}

/** Things the host must act on. */
export type SimEvent =
    | { type: 'bite'; playerId: string; damage: number }
    | { type: 'kill'; playerId: string; kind: string; boss: number }
    | { type: 'wave'; wave: number }
    /** A whole onslaught is beaten: the long breather begins. */
    | { type: 'cleared'; wave: number }
    /** A boss slammed the ground at (u, v): everyone within r took a hit (sent so clients can show it). */
    | { type: 'slam'; u: number; v: number; r: number }
    /** A boss fell (sent to everyone, so all who fought it can count it). */
    | { type: 'boss'; code: number; u: number; v: number };

export interface SimOptions {
    /** The breather after an onslaught is beaten, before the next one comes. */
    everyMs: number;
    firstMs: number;
    /** Multiplies every sword drop chance (1 normally; raised only for testing). */
    swordMul?: number;
    /** Multiplies the potion drop chance (1 normally; raised only for testing). */
    potionMul?: number;
}

export class GameSim {
    monsters = new Map<number, SimMonster>();
    drops = new Map<number, SimDrop>();
    shots = new Map<number, SimShot>();
    /** The wave still sending in monsters (one at a time). */
    runs: SimWave[] = [];
    wave = 0;
    /** Ms until the next wave starts (between the waves of an onslaught, and through the breather). */
    clock: number;
    /**
     * onslaught: waves keep coming; clearing: the last wave of the onslaught is in, the field must be
     * beaten; breather: the long rest before the next onslaught.
     */
    phase: 'onslaught' | 'clearing' | 'breather' = 'onslaught';
    /** Waves still to come in this onslaught. */
    left: number;
    /** Ms since the onslaught sent its last monster. */
    sentFor = 0;
    /** The side (an angle in tile space) the next or current wave comes from. */
    dir: number;
    /** Waves hold while every player reads or talks. */
    calm = false;
    /** Is the fight on (an onslaught, or its last monsters)? */
    get fighting(): boolean {
        return this.phase !== 'breather';
    }
    private nextId = 1;
    private readonly env: SimEnv;
    private readonly opts: SimOptions;

    constructor(env: SimEnv, opts: SimOptions) {
        this.env = env;
        this.opts = opts;
        this.clock = opts.firstMs;
        this.dir = env.rand() * Math.PI * 2;
        this.left = onslaughtSize(true, env.rand);
    }

    /** Remove every monster, shot, drop and running wave (the wave counter stays; the next onslaught comes after a breather). */
    clear(): void {
        this.monsters.clear();
        this.drops.clear();
        this.shots.clear();
        this.runs = [];
        if (this.phase !== 'breather') {
            this.phase = 'breather';
            this.clock = this.opts.everyMs;
        }
    }

    update(dtMs: number): SimEvent[] {
        const events: SimEvent[] = [];
        const dt = Math.min(dtMs, 250) / 1000;
        const players = this.env.players();

        // Everyone reading or talking: the clock and the arrivals hold still.
        this.calm = players.length > 0 && !!this.env.calm?.();
        const live = players.length > 0 && !this.calm;
        if (this.phase === 'onslaught') {
            // The next wave comes a little after the last one has finished coming in.
            if (live && this.runs.length === 0) {
                this.clock -= dtMs;
                if (this.clock <= 0) this.startWave(players, events);
            }
        } else if (this.phase === 'clearing') {
            this.sentFor += dtMs;
            // Stragglers that never arrive (stuck behind water, or the players hid) give up in the end.
            if (this.sentFor > STRAGGLER_MS) for (const m of this.monsters.values()) if (!m.boss && m.state !== 'dying') this.monsters.delete(m.id);
            if (!this.waveAlive()) {
                this.phase = 'breather';
                this.clock = this.opts.everyMs;
                events.push({ type: 'cleared', wave: this.wave });
            }
        } else if (live) {
            this.clock -= dtMs;
            if (this.clock <= 0) {
                this.phase = 'onslaught';
                this.left = onslaughtSize(false, this.env.rand);
                this.startWave(players, events);
            }
        }
        if (live) for (const w of this.runs) this.updateWave(w, dtMs, players);
        const before = this.runs.length;
        this.runs = this.runs.filter((w) => w.toSpawn > 0);
        if (before > 0 && this.runs.length === 0 && this.phase === 'onslaught') {
            // This wave is all in: the next comes after a short gap, or the onslaught ends.
            if (this.left > 0) this.clock = waveGap(this.wave, this.env.rand);
            else {
                this.phase = 'clearing';
                this.sentFor = 0;
            }
        }

        for (const m of [...this.monsters.values()]) this.updateMonster(m, dt, dtMs, players, events);
        this.updateShots(dt, dtMs, players, events);

        for (const d of [...this.drops.values()]) {
            d.age += dtMs;
            if (d.age > DROP_LIFE_MS) this.drops.delete(d.id);
        }
        return events;
    }

    /** The next wave of the onslaught: from a fresh side, bigger than the last. */
    private startWave(players: SimPlayer[], events: SimEvent[]): void {
        this.wave += 1;
        this.left -= 1;
        this.dir = this.env.rand() * Math.PI * 2;
        const spec = waveSpec(this.wave, players.length, this.env.night?.() ?? 0);
        this.runs.push({ wave: this.wave, age: 0, toSpawn: spec.count, nextIn: 600, every: WAVE_SPAWN_WINDOW_MS / spec.count });
        this.clock = 0;
        events.push({ type: 'wave', wave: this.wave });
    }

    /** Shots fly straight; one that reaches a player bites, one that hits a wall or flies too far is gone. */
    private updateShots(dt: number, dtMs: number, players: SimPlayer[], events: SimEvent[]): void {
        for (const sh of [...this.shots.values()]) {
            const nu = sh.u + sh.du * dt, nv = sh.v + sh.dv * dt;
            sh.life -= dtMs;
            if (sh.life <= 0 || !this.env.canMove(sh.u, sh.v, nu, nv)) {
                this.shots.delete(sh.id);
                continue;
            }
            sh.u = nu;
            sh.v = nv;
            if (sh.by) {
                // Struck back: it bursts on the first monster it reaches.
                for (const m of this.monsters.values()) {
                    if (m.state === 'dying' || Math.hypot(m.u - sh.u, m.v - sh.v) > (m.boss ? 1.4 : 0.8)) continue;
                    this.shots.delete(sh.id);
                    events.push(...this.strike(sh.by, m.u, m.v, 0, sh.damage, 0.6));
                    break;
                }
                continue;
            }
            const hit = players.find((p) => Math.hypot(p.u - sh.u, p.v - sh.v) < 0.55);
            if (hit) {
                events.push({ type: 'bite', playerId: hit.id, damage: sh.damage });
                this.shots.delete(sh.id);
            }
        }
    }
    /** A player swing from (u, v) facing a 0-7 sector, or with a `radius` a spell blast hitting everything within it. Returns events (kills). */
    strike(playerId: string, pu: number, pv: number, facing: number, damage: number, radius = 0, stunMs = 0): SimEvent[] {
        const events: SimEvent[] = [];
        const aim = (facing * Math.PI) / 4;
        // A swing knocks shots out of the air and back the way they came (they now hit monsters).
        if (!radius) {
            for (const sh of this.shots.values()) {
                if (sh.by || Math.hypot(sh.u - pu, sh.v - pv) > REACH + 0.4) continue;
                sh.by = playerId;
                sh.du *= -1.35;
                sh.dv *= -1.35;
                sh.life = 2400;
                sh.damage = Math.max(6, damage * 2);
            }
        }
        for (const m of this.monsters.values()) {
            if (m.state === 'dying') continue;
            const du = m.u - pu;
            const dv = m.v - pv;
            const dist = Math.hypot(du, dv);
            if (dist > (radius || REACH)) continue;
            // Screen-space direction to the monster, in the same units as the joystick's facing.
            const sx = (du - dv) * 62;
            const sy = (du + dv) * 31 * 2;
            let diff = Math.abs(Math.atan2(sy, sx) - aim);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (!radius && dist > 0.9 && diff > ARC) continue;
            m.hp -= Math.max(1, Math.round(damage * m.ward));
            const kd = dist || 1;
            const kb = KINDS[m.kind]?.knock ?? 1;
            m.ku = (du / kd) * (radius ? 10 : 7) * kb;
            m.kv = (dv / kd) * (radius ? 10 : 7) * kb;
            if (m.hp <= 0) {
                m.state = 'dying';
                m.t = 0;
                events.push({ type: 'kill', playerId, kind: m.kind, boss: m.boss });
                if (m.boss) events.push({ type: 'boss', code: m.boss, u: m.u, v: m.v });
                const drop = DROP_TABLE[m.kind];
                if (drop && this.env.rand() < drop.chance) this.addDrop(drop.skill, m.u, m.v);
                // A rare chance of a random sword on top, a little likelier in later waves.
                const rare = (SWORD_CHANCE[m.kind] ?? 0.02) * (1 + 0.04 * this.wave) * (this.opts.swordMul ?? 1);
                if (this.env.rand() < rare) this.addDrop('sword', m.u, m.v, Math.floor(this.env.rand() * SWORD_COUNT));
                // A moderate chance of a random potion.
                if (this.env.rand() < POTION_CHANCE * (this.opts.potionMul ?? 1)) {
                    this.addDrop(`potion_${POTIONS[Math.floor(this.env.rand() * POTIONS.length)]}`, m.u, m.v);
                }
            } else if (stunMs > 0) {
                // Frozen or stunned: stands still for a while (bosses shake it off twice as fast).
                m.state = 'recover';
                m.t = -Math.min(3000, stunMs) / (m.boss ? 2 : 1);
            } else if (m.state === 'attack') {
                m.state = 'recover'; // a hit interrupts the attack
                m.t = 0;
            }
        }
        return events;
    }

    /** A player asks to take a drop. Returns the skill if allowed. */
    pickup(dropId: number, pu: number, pv: number): { skill: DropKind; sword: number } | null {
        const d = this.drops.get(dropId);
        if (!d || Math.hypot(d.u - pu, d.v - pv) > PICKUP_SLACK) return null;
        this.drops.delete(dropId);
        return { skill: d.skill, sword: d.sword };
    }

    /** Bring a boss in at (u, v), unless one with that code is already alive. Returns it, or null. */
    summon(code: number, tier: number, u: number, v: number): SimMonster | null {
        const spec = bossSpec(code, tier);
        if (!spec) return null;
        for (const m of this.monsters.values()) if (m.boss === code && m.state !== 'dying') return null;
        const m = this.spawn(spec.kind, u, v, { hpMul: spec.hpMul, speedMul: spec.speedMul, damage: spec.damage });
        m.boss = code;
        m.reachMul = spec.reachMul;
        m.slamMs = spec.slamMs;
        m.slamT = spec.slamMs * 0.6;
        m.tier = 2;
        if ('volley' in spec && spec.volley) {
            m.volleyMs = spec.volley.every;
            m.volleyN = spec.volley.n;
            m.volleyT = spec.volley.every;
        }
        return m;
    }

    /** The story's foes, set around a place (3-7 tiles from it), as strong as wave `level`'s. */
    encounter(kinds: string[], u: number, v: number, level: number): void {
        const spec = waveSpec(Math.max(1, level));
        for (const kind of kinds.slice(0, 12)) {
            if (!KINDS[kind] || this.aliveCount() >= MAX_ALIVE) continue;
            for (let n = 0; n < 20; n++) {
                const a = this.env.rand() * Math.PI * 2;
                const d = 3 + this.env.rand() * 4;
                const su = u + Math.cos(a) * d, sv = v + Math.sin(a) * d;
                if (!this.env.canStand(su, sv)) continue;
                this.spawn(kind, su, sv, { hpMul: spec.hpMul, speedMul: spec.speedMul, damage: spec.damage });
                break;
            }
        }
    }

    /** A structural fracture on a boss: slower, weaker, no slam or shots, or staggered (stands helpless for a while). */
    cripple(code: number, what: 'slow' | 'weak' | 'calm' | 'stagger'): void {
        for (const m of this.monsters.values()) {
            if (m.boss !== code || m.state === 'dying') continue;
            if (what === 'slow') m.speedMul *= 0.75;
            else if (what === 'weak') m.damage = Math.max(1, m.damage - 1);
            else if (what === 'calm') { m.slamMs = 0; m.volleyMs = 0; }
            else { m.state = 'recover'; m.t = -6000; }
        }
    }

    /** Set a boss's ward (the share of each blow that gets through: 1 = none, 0.15 = armoured). */
    ward(code: number, share: number): void {
        for (const m of this.monsters.values()) if (m.boss === code) m.ward = Math.min(1, Math.max(0.05, share));
    }

    spawn(kind: string, u: number, v: number, mods: { hpMul: number; speedMul: number; damage: number }): SimMonster {
        const def = KINDS[kind];
        const hp = Math.max(1, Math.round(def.hp * mods.hpMul));
        const m: SimMonster = {
            id: this.nextId++, kind, u, v, hp, max: hp, state: 'chase', t: 0,
            speedMul: mods.speedMul, damage: Math.round(mods.damage * (def.dmgMul ?? 1)), ku: 0, kv: 0, hit: false,
            side: this.env.rand() < 0.5 ? 1 : -1, tier: tierOf(this.wave),
            boss: 0, reachMul: 1, slamMs: 0, slamT: 0, called: false, ward: 1, volleyMs: 0, volleyN: 0, volleyT: 0, shotT: def.ranged ? def.ranged.every * (0.4 + this.env.rand() * 0.6) : 0,
        };
        this.monsters.set(m.id, m);
        return m;
    }

    /** Items set on the ground for anyone to take (a chest's loot, gathering in co-op). `n` rides in the sword field. */
    addLoot(item: string, n: number, u: number, v: number): void {
        const kind = `item_${item}` as DropKind;
        if (!DROP_KINDS.includes(kind) || !(n >= 1)) return;
        const a = this.env.rand() * Math.PI * 2;
        const r = 0.3 + this.env.rand() * 0.6;
        this.addDrop(kind, u + Math.cos(a) * r, v + Math.sin(a) * r, Math.min(LOOT_MAX, Math.floor(n)));
    }

    addDrop(skill: DropKind, u: number, v: number, sword = -1): void {
        this.drops.set(this.nextId, { id: this.nextId, skill, sword, u, v, age: 0 });
        this.nextId++;
    }

    /** Are any of the wave's monsters (not bosses) still alive? */
    waveAlive(): boolean {
        for (const m of this.monsters.values()) if (!m.boss && m.state !== 'dying') return true;
        return false;
    }

    aliveCount(): number {
        let n = 0;
        for (const m of this.monsters.values()) if (m.state !== 'dying') n++;
        return n;
    }

    /** Compact snapshot for the wire (arrays keep it small at 10 per second). */
    snapshot() {
        const total = this.runs.reduce((n, w) => n + w.toSpawn, 0);
        const p = this.runs.length > 0 ? this.runs[this.runs.length - 1] : null;
        return {
            m: [...this.monsters.values()].map((m) => [
                m.id, KIND_NAMES.indexOf(m.kind as (typeof KIND_NAMES)[number]), round(m.u), round(m.v), m.hp, m.max, STATES.indexOf(m.state), Math.round(m.t), m.tier, m.boss,
            ]),
            d: [...this.drops.values()].map((d) => [d.id, DROP_KINDS.indexOf(d.skill), round(d.u), round(d.v), Math.round(d.age), d.sword]),
            s: [...this.shots.values()].map((sh) => [sh.id, SHOT_KINDS.indexOf(sh.kind), round(sh.u), round(sh.v), round(sh.du), round(sh.dv)]),
            p: p ? [p.wave, Math.round(p.age), total] : null,
            w: this.wave,
            /** Seconds until the next wave: in the gaps of an onslaught, and through the breather. */
            nx: this.phase === 'clearing' || this.runs.length > 0 ? 0 : Math.max(0, Math.ceil(this.clock / 1000)),
            /** The side the next or current wave comes from (radians × 100), and whether a wave is on. */
            wd: Math.round(this.dir * 100),
            f: this.fighting ? 1 : 0,
            /** 1 while the waves hold (everyone reading or talking). */
            c: this.calm ? 1 : 0,
            /** Waves still to come in this onslaught. */
            ol: this.phase === 'onslaught' ? this.left : 0,
        };
    }

    // ---- internals ----

    /** Send in the wave's monsters one by one, each appearing off-screen around a random player. */
    private updateWave(w: SimWave, dtMs: number, players: SimPlayer[]): void {
        w.age += dtMs;
        if (w.toSpawn > 0 && players.length > 0) {
            w.nextIn -= dtMs;
            if (w.nextIn <= 0 && this.aliveCount() >= MAX_ALIVE) {
                w.nextIn = 400; // the field is full; wait for room
            } else if (w.nextIn <= 0) {
                const spec = waveSpec(w.wave, players.length, this.env.night?.() ?? 0);
                const spot = this.findSpawnSpot(players);
                if (spot) {
                    const kind = spec.kinds[Math.floor(this.env.rand() * spec.kinds.length)];
                    this.spawn(kind, spot.u, spot.v, { hpMul: spec.hpMul, speedMul: spec.speedMul, damage: spec.damage });
                    w.toSpawn -= 1;
                    w.nextIn = w.every * (0.7 + this.env.rand() * 0.6);
                } else {
                    w.nextIn = 500; // no free ground just now; try again shortly
                }
            }
        }
    }

    /** A spot 10-16 tiles from a random player (and 9+ from all), on the wave's side if there is room: free ground. */
    private findSpawnSpot(players: SimPlayer[]): { u: number; v: number } | null {
        const anchor = players[Math.floor(this.env.rand() * players.length)];
        for (let n = 0; n < 30; n++) {
            const ang = n < 20 ? this.dir + (this.env.rand() - 0.5) * WAVE_SPREAD : this.env.rand() * Math.PI * 2;
            const near = DIST_MIN - 3 * (this.env.night?.() ?? 0);
            const d = near + this.env.rand() * (DIST_MAX - near);
            const u = anchor.u + Math.cos(ang) * d;
            const v = anchor.v + Math.sin(ang) * d;
            if (!this.env.canStand(u, v) || (this.env.wild && !this.env.wild(u, v))) continue;
            // Never right next to anyone: at least 9 tiles from every player.
            if (players.some((p) => Math.hypot(p.u - u, p.v - v) < near - 1)) continue;
            return { u, v };
        }
        return null;
    }

    private step(m: SimMonster, du: number, dv: number): boolean {
        let moved = false;
        if (du !== 0 && this.env.canMove(m.u, m.v, m.u + du, m.v)) { m.u += du; moved = true; }
        if (dv !== 0 && this.env.canMove(m.u, m.v, m.u, m.v + dv)) { m.v += dv; moved = true; }
        return moved;
    }

    private updateMonster(m: SimMonster, dt: number, dtMs: number, players: SimPlayer[], events: SimEvent[]): void {
        const def = KINDS[m.kind];
        m.t += dtMs;
        if (m.state === 'dying') {
            if (m.t > DYING_MS) this.monsters.delete(m.id);
            return;
        }

        // Hunt the nearest player in the world .
        let target: SimPlayer | null = null;
        let best = Infinity;
        for (const p of players) {
            const d = Math.hypot(p.u - m.u, p.v - m.v);
            if (d < best) { best = d; target = p; }
        }
        if (!target || best > LEASH) {
            if (!target && m.state === 'chase') return; // nobody to hunt: stand
            if (best > LEASH * (m.boss ? 2 : 1)) { this.monsters.delete(m.id); return; }
        }

        // Knockback glides and fades.
        if (Math.abs(m.ku) + Math.abs(m.kv) > 0.05) {
            this.step(m, m.ku * dt, m.kv * dt);
            const decay = Math.exp(-dt * 7);
            m.ku *= decay;
            m.kv *= decay;
        }

        if (!target) return;
        // Bosses slam the ground now and then, hitting everyone close; Malakor calls minions once at half health.
        if (m.slamMs > 0) {
            m.slamT -= dtMs;
            if (m.slamT <= 0 && best < 4) {
                m.slamT = m.slamMs;
                const r = 2.6 * (m.boss === 99 ? 1.2 : 1);
                events.push({ type: 'slam', u: m.u, v: m.v, r });
                for (const p of players) if (Math.hypot(p.u - m.u, p.v - m.v) < r) events.push({ type: 'bite', playerId: p.id, damage: m.damage + 1 });
            }
        }
        // Some bosses throw a fan of shots at their target now and then.
        if (m.volleyMs > 0 && best < 12) {
            m.volleyT -= dtMs;
            if (m.volleyT <= 0) {
                m.volleyT = m.volleyMs;
                const base = Math.atan2(target.v - m.v, target.u - m.u);
                for (let n = 0; n < m.volleyN; n++) {
                    const a = base + (n - (m.volleyN - 1) / 2) * 0.28;
                    this.shots.set(this.nextId, { id: this.nextId, kind: 'bolt', u: m.u + Math.cos(a) * 0.8, v: m.v + Math.sin(a) * 0.8, du: Math.cos(a) * 4.2, dv: Math.sin(a) * 4.2, life: 3600, damage: m.damage });
                    this.nextId++;
                }
            }
        }
        if (m.boss === 99 && !m.called && m.hp < m.max / 2) {
            m.called = true;
            for (let n = 0; n < 4; n++) {
                const a = (n / 4) * Math.PI * 2;
                const su = m.u + Math.cos(a) * 3;
                const sv = m.v + Math.sin(a) * 3;
                if (this.env.canStand(su, sv)) this.spawn(n % 2 ? 'skeleton' : 'wolf', su, sv, { hpMul: 6, speedMul: 1.3, damage: 3 }).tier = 2;
            }
        }
        const du = target.u - m.u;
        const dv = target.v - m.v;
        const dist = best;
        // Shooters keep their distance and fire when they have a clear line and their bow (or staff) is ready.
        if (def.ranged && m.state === 'chase' && !m.boss) {
            const r = def.ranged;
            m.shotT -= dtMs;
            if (dist <= r.range && dist >= 1.4 && m.shotT <= 0) {
                m.state = 'attack';
                m.t = 0;
                m.hit = false;
                m.shotT = r.every * (0.85 + this.env.rand() * 0.3);
                return;
            }
            if (dist < r.keep) {
                // Too close: back away (sideways if blocked).
                const k = (def.speed * m.speedMul * 0.8 * dt) / Math.max(dist, 0.01);
                if (!this.step(m, -du * k, -dv * k)) this.step(m, -dv * k * m.side, du * k * m.side);
                return;
            }
            if (dist <= r.range) return; // in range, waiting for the next shot
        }
        if (m.state === 'chase') {
            if (dist < def.reach * m.reachMul) {
                m.state = 'attack';
                m.t = 0;
                m.hit = false;
            } else {
                const k = (def.speed * m.speedMul * dt) / dist;
                let moved = this.step(m, du * k, dv * k);
                // Blocked: sidestep around whatever is in the way.
                if (!moved) moved = this.step(m, -dv * k * m.side, du * k * m.side);
                if (!moved) m.side = m.side === 1 ? -1 : 1;
            }
        } else if (m.state === 'attack' && def.explode && !m.boss) {
            // The fuse burns down, then it bursts: everyone close takes the blast, and it is gone.
            if (m.t >= def.attackMs) {
                const e = def.explode;
                events.push({ type: 'slam', u: m.u, v: m.v, r: e.r });
                for (const p of players) if (Math.hypot(p.u - m.u, p.v - m.v) < e.r) events.push({ type: 'bite', playerId: p.id, damage: e.damage + Math.max(0, m.damage - 1) });
                m.state = 'dying';
                m.t = 0;
            }
        } else if (m.state === 'attack' && def.ranged && !m.boss) {
            // Let fly at the moment of the cast, aimed where the target stands.
            if (!m.hit && m.t >= def.attackMs * def.hitAt) {
                m.hit = true;
                const r = def.ranged;
                const d = Math.max(dist, 0.01);
                this.shots.set(this.nextId, { id: this.nextId, kind: r.shot, u: m.u + (du / d) * 0.5, v: m.v + (dv / d) * 0.5, du: (du / d) * r.speed, dv: (dv / d) * r.speed, life: ((r.range + 2) / r.speed) * 1000, damage: r.damage + Math.max(0, m.damage - 1) });
                this.nextId++;
            }
            if (m.t >= def.attackMs) {
                m.state = 'recover';
                m.t = 0;
            }
        } else if (m.state === 'attack') {
            if (!m.hit && m.t >= def.attackMs * def.hitAt) {
                m.hit = true;
                // Whoever is in reach when the blow lands takes it.
                for (const p of players) {
                    if (Math.hypot(p.u - m.u, p.v - m.v) < def.reach * m.reachMul + 0.45) events.push({ type: 'bite', playerId: p.id, damage: m.damage });
                }
            }
            if (m.t >= def.attackMs) {
                m.state = 'recover';
                m.t = 0;
            }
        } else if (m.state === 'recover' && m.t >= def.recoverMs) {
            m.state = 'chase';
            m.t = 0;
        }
    }
}

function round(x: number): number {
    return Math.round(x * 100) / 100;
}
