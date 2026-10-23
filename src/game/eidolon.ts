/**
 * Eidolon: the four fractured kingdoms, their bosses and powers, where everything stands
 * on the map, the camp's people and what they say, and the prologue.
 *
 * Pure data and geometry (no store, no save, no Pixi), so the map generator, the server
 * room, the scene and the HUD all agree. The map is split by the two tile axes through
 * its centre into four quadrants (one per kingdom, each in a screen direction), with
 * Malakor's Void Citadel in the middle.
 */
import { MAP_TILES } from './world/constants.ts';

export const ELEMENTS = ['fire', 'air', 'water', 'earth'] as const;
export type Element = (typeof ELEMENTS)[number];
export type Region = Element | 'citadel';

export interface Kingdom {
    name: string;
    land: string;
    theme: string;
    /** Screen direction from the centre (tile space unit vector before /√2). */
    dir: [number, number];
    color: number;
    css: string;
    glyph: string;
    /** The primal power the kingdom grants (as yours, or absorbed from its warden). */
    power: string;
    /** The active skill your home kingdom gives you (charged by the combat meter). */
    skill: { name: string; blurb: string };
    warden: { name: string; title: string; kind: string; tint: number; lines: string[] };
    guard: { name: string; kind: string; tint: number };
    /** Ground tint for the region (multiplied over the terrain art). */
    ground: number;
}

export const KINGDOMS: Record<Element, Kingdom> = {
    fire: {
        name: 'Pyraxis', land: 'The Volcanic Crags', theme: 'Fire, raw strength and relentless aggression',
        dir: [1, -1], color: 0xff6a3d, css: '#ff6a3d', glyph: '🔥',
        power: '+20% damage, hits burn',
        skill: { name: 'Flame Burst', blurb: 'A 360° wave of fire that burns everything around you' },
        warden: { name: 'Ignis Drake', title: 'the Ash-Bound General', kind: 'kobolt', tint: 0xff7a5a, lines: ['Only the strong deserve to live. Show me you are strong!', 'The ash remembers every coward. Will it remember you?'] },
        guard: { name: 'Cinder Brute', kind: 'kobolt', tint: 0xff9a7a },
        ground: 0xffc8a8,
    },
    air: {
        name: 'Zephyria', land: 'The Floating Isles', theme: 'Wind, agility, lightning and deception',
        dir: [-1, -1], color: 0x7dd3fc, css: '#7dd3fc', glyph: '🌪️',
        power: '+15% speed, faster stamina, cheaper dodges',
        skill: { name: 'Lightning Dash', blurb: 'Phase-dash forward, leaving a crackling decoy that shocks anything near it' },
        warden: { name: 'Sylphide', title: 'the Whispering Tempest', kind: 'goblin', tint: 0x9fe8ff, lines: ['Outsiders bring only lies. I taught my people that.', 'You cannot strike what you cannot see, little stranger.'] },
        guard: { name: 'Gale Stalker', kind: 'wolf', tint: 0xcdefff },
        ground: 0xe4efff,
    },
    water: {
        name: 'Aquatica', land: 'The Sunken Depths', theme: 'Water, fluid motion, healing and deep-sea pressure',
        dir: [1, 1], color: 0x38bdf8, css: '#38bdf8', glyph: '🌊',
        power: 'Healing over time (more near water and rest), stronger potions',
        skill: { name: 'Glacial Spike', blurb: 'Raise a wall of ice spikes in front of you that freezes the horde' },
        warden: { name: 'General Vane', title: "Leviathan's Husk", kind: 'skeleton', tint: 0x7ab8ff, lines: ['The tides obey me now. The surface poisoned us, they said.', 'Drown in the lie with the rest of them!'] },
        guard: { name: 'Brine Ooze', kind: 'slime', tint: 0x8fd0ff },
        ground: 0xcfeef2,
    },
    earth: {
        name: 'Terragrim', land: 'The Stone Hollows', theme: 'Stone, roots, endurance and patience',
        dir: [-1, 1], color: 0xc69c5d, css: '#c69c5d', glyph: '⛰️',
        power: '+4 max health, +10% block',
        skill: { name: 'Stone Bulwark', blurb: 'Slam up a rock wall that stuns what is in front, and harden your skin' },
        warden: { name: 'Gravok', title: 'the Rootbound Warden', kind: 'scorpion', tint: 0xd8b07a, lines: ['The mountains do not forgive, and neither do I.', 'Roots grow through stone. I will grow through you.'] },
        guard: { name: 'Hollow Crawler', kind: 'scorpion', tint: 0xb89a70 },
        ground: 0xf0e0b8,
    },
};
/** The order the seals fall in: each warden's defeat opens the next kingdom around the ring. */
export const RING: Element[] = ['fire', 'air', 'water', 'earth'];
export const nextKingdom = (e: Element): Element => RING[(RING.indexOf(e) + 1) % RING.length];
/** The kingdoms in the order a player meets them, starting from home. */
export const orderFrom = (home: Element): Element[] => RING.map((_, n) => RING[(RING.indexOf(home) + n) % RING.length]);

export const MALAKOR = { name: 'Malakor', title: 'the Sovereign of Discord', kind: 'skeleton', tint: 0xb06bff };
export const CITADEL = { name: 'The Void Citadel', color: 0x8b5cf6 };

// ---------------------------------------------------------------- geometry

const C = MAP_TILES / 2;
/** Tiles from the centre that belong to the Void Citadel. */
export const CITADEL_R = 22;

export function regionOf(u: number, v: number): Region {
    const dx = u - C;
    const dy = v - C;
    if (Math.hypot(dx, dy) < CITADEL_R) return 'citadel';
    const sx = dx - dy; // screen right
    const sy = dx + dy; // screen down
    if (Math.abs(sx) > Math.abs(sy)) return sx > 0 ? 'fire' : 'earth';
    return sy > 0 ? 'water' : 'air';
}

/** A tile `d` tiles from the centre toward a kingdom, shifted `side` tiles across. */
function spot(e: Element, d: number, side: number): { i: number; j: number } {
    const [x, y] = KINGDOMS[e].dir;
    const ux = x / Math.SQRT2, uy = y / Math.SQRT2; // along
    const px = -uy, py = ux; // across
    return { i: Math.round(C + ux * d + px * side), j: Math.round(C + uy * d + py * side) };
}

export type LandmarkKind = 'camp' | 'arena' | 'guard' | 'tower' | 'house' | 'citadel';
export interface Landmark {
    kind: LandmarkKind;
    el: Element | null;
    /** Which of its kind in the kingdom (guards 1-3, towers 0-1, houses 0-2). */
    n: number;
    i: number;
    j: number;
    /** Flat clear ground around it, in tiles. */
    r: number;
    id: string;
}

/** Every fixed place in the world: a camp, three guardians, a warden's arena, two towers and three houses per kingdom, and the citadel. */
export const LANDMARKS: Landmark[] = (() => {
    const out: Landmark[] = [{ kind: 'citadel', el: null, n: 0, i: C, j: C, r: 9, id: 'citadel' }];
    for (const e of ELEMENTS) {
        const add = (kind: LandmarkKind, n: number, d: number, side: number, r: number) => {
            const p = spot(e, d, side);
            out.push({ kind, el: e, n, i: p.i, j: p.j, r, id: `${kind}:${e}:${n}` });
        };
        add('camp', 0, 70, 0, 7);
        add('guard', 1, 94, -28, 3);
        add('guard', 2, 94, 28, 3);
        add('guard', 3, 112, 0, 3);
        add('arena', 0, 134, 0, 4);
        add('tower', 0, 46, 32, 2);
        add('tower', 1, 120, -44, 2);
        add('house', 0, 58, -34, 3);
        add('house', 1, 80, 44, 3);
        add('house', 2, 124, 38, 3);
    }
    return out;
})();
export const landmark = (kind: LandmarkKind, el: Element | null, n = 0): Landmark =>
    LANDMARKS.find((l) => l.kind === kind && l.el === el && l.n === n)!;
/** Where a player of this kingdom starts: beside its camp fire. */
export const homeOf = (e: Element): { u: number; v: number } => {
    const c = landmark('camp', e);
    return { u: c.i + 2, v: c.j + 0.5 };
};

// ---------------------------------------------------------------- bosses
// A boss code travels in the combat snapshot: kingdom index × 10 + 1..3 for a guardian,
// × 10 + 9 for the warden, 99 for Malakor. shared/sim.ts turns a code into its stats.

export const guardCode = (e: Element, n: number): number => (ELEMENTS.indexOf(e) + 1) * 10 + n;
export const wardenCode = (e: Element): number => (ELEMENTS.indexOf(e) + 1) * 10 + 9;
export const MALAKOR_CODE = 99;
/** A chest that was a monster all along. */
export const MIMIC_CODE = 98;

export interface BossInfo {
    name: string;
    kind: string;
    tint: number;
    el: Element | null;
    rank: 'guard' | 'warden' | 'malakor';
    n: number;
}
export function bossInfo(code: number): BossInfo | null {
    if (code === MIMIC_CODE) return { name: 'Mimic', kind: 'slime', tint: 0xffffff, el: null, rank: 'guard', n: 0 };
    if (code === MALAKOR_CODE) return { name: `${MALAKOR.name}, ${MALAKOR.title}`, kind: MALAKOR.kind, tint: MALAKOR.tint, el: null, rank: 'malakor', n: 0 };
    const e = ELEMENTS[Math.floor(code / 10) - 1];
    const n = code % 10;
    if (!e) return null;
    const k = KINGDOMS[e];
    if (n === 9) return { name: `${k.warden.name}, ${k.warden.title}`, kind: k.warden.kind, tint: k.warden.tint, el: e, rank: 'warden', n: 0 };
    if (n >= 1 && n <= 3) return { name: `${k.guard.name} of ${k.name}`, kind: k.guard.kind, tint: k.guard.tint, el: e, rank: 'guard', n };
    return null;
}

// ---------------------------------------------------------------- story text

export const PROLOGUE: { title: string; text: string }[] = [
    { title: 'Eidolon', text: 'In the beginning the world was one realm, Eidolon, fed by a great pulsing core called the Heart of Eidolon. Its light kept sickness away and the tribes in harmony.' },
    { title: 'The Guardian', text: 'Malakor was its chosen Guardian and High Scholar. He studied the Heart until he wanted all of it, to become a god. The Council of Elders stripped him of his power and banished him to the chasms beneath the world.' },
    { title: 'The Fracture', text: 'Unity was their armour, so Malakor broke it from the inside. He whispered false prophecies: Pyraxis believed Zephyria stole its heat; Aquatica believed the surface poisoned its waters. When war came, he sundered the land into four.' },
    { title: 'The Kingdoms', text: 'Now Pyraxis, Zephyria, Aquatica and Terragrim sit behind dark barriers, each ruled by a corrupted warden who holds the seal to the next land. Malakor feeds on their hatred from the Void Citadel at the centre.' },
    { title: 'You', text: 'You wake in a camp on the brink of ruin. Pledge yourself to one kingdom and its primal essence will flow into you. Then break the seals, unite the lands, and end Malakor.' },
];

export const EPILOGUE_EIDOLON = [
    'Malakor falls, and the dark magic holding the world apart dissolves. The shattered lands drift back together.',
    '"He was one of us once," says Elder Theron. "Remember that, and never let anyone whisper us apart again." But the Heart is restless, and the dark smells blood. Survive, and grow stronger still.',
];

// ---------------------------------------------------------------- the camp's people

export type NpcId = 'theron' | 'varis' | 'lyra';
export interface Npc {
    name: string;
    role: string;
    /** Where they stand, relative to the camp centre (tiles). */
    at: [number, number];
    tint: number;
    greet: string;
    talk: { q: string; a: string }[];
}
export const NPCS: Record<NpcId, Npc> = {
    theron: {
        name: 'Elder Theron', role: 'Village elder', at: [0, 2], tint: 0xd8c8ff,
        greet: 'Unite us, or we perish in the dark.',
        talk: [
            { q: 'Why are the creatures around here so aggressive?', a: "They aren't just wild beasts; they are the corrupted remnants of our own neighbours, twisted by Malakor's lies. To pass into the next kingdom, you must first defeat the guardians, and then face the regional warden holding the seal. Do not let Malakor's trickery fool you into thinking we were always enemies." },
            { q: 'Who is Malakor?', a: 'Our Guardian, once. He wanted the Heart of Eidolon for himself. We banished him, and he answered by making us hate each other. As long as we stay divided, he bleeds the Heart dry.' },
            { q: 'Where do I go next?', a: 'Follow the objective. The guardians wait farther out in each kingdom, skulls on your radar; the warden holds the seal at its far edge, behind a gate that opens only when all three guardians fall. Climb the old watchtowers to see the land.' },
            { q: 'When do the hordes come?', a: 'Always. Wave after wave, each bigger than the last, a few breaths apart. Beat a whole onslaught and the dark falls back for a while: rest, build and brew then. Only the camp is safe ground; out there they never stop. Your radar shows which side each wave comes from, a red mark on its rim. And the guardians? Each carries a relic blade from the old days. Take them.' },
        ],
    },
    varis: {
        name: 'Varis', role: 'Blacksmith', at: [2, -2], tint: 0xffc89a,
        greet: 'Steel that remembers what strength feels like. That is what I make.',
        talk: [
            { q: "How's the metal holding up against the night hordes?", a: "Terribly, traveller. Ever since Malakor split the lands, the iron in this region has grown brittle, full of spite. Back when Eidolon was whole, our steel could cut through stone like silk. Now? It shatters if you look at a shadow wrong. Bring me ore and elemental essence, and I'll reforge your blade so it remembers what strength feels like." },
            { q: 'How do I get better gear?', a: 'Blueprints. I have the first one for you. Wardens and old houses hold the rest. Then iron, gold and crystal, and a good forge.' },
            { q: 'What are these elemental essences?', a: 'Bits of each kingdom, caught in flowers, stones and water. Five of a kind and some crystal, and I can infuse your weapon with that element.' },
        ],
    },
    lyra: {
        name: 'Lyra', role: 'Wandering herbalist', at: [-2, -2], tint: 0xb6f2b0,
        greet: 'You look pale. Sit, and let me look at you.',
        talk: [
            { q: 'I took a bad hit out there. Got any remedies?', a: "Never try to brave the night out there without a proper brew. Here, take this wild mint. If you rest by a campfire or in a cleared house, your body's natural healing kicks in twice as fast. But don't stay in one place too long; the dark smells blood." },
            { q: 'What should I eat?', a: 'Cook your meat at the fire. Raw meat will turn your stomach. Berries and fish keep you going, and drink at any clean water.' },
            { q: 'Why am I so tired?', a: 'Nobody can fight forever. When your rest runs low, your stamina shrinks. Rest at the healer\'s tent or inside a house.' },
        ],
    },
};
