/**
 * Eidolon: the four fractured kingdoms, their bosses and powers, where everything stands
 * on the map, the camp's people and what they say, and the prologue.
 *
 * Pure data and geometry (no store, no save, no Pixi), so the map generator, the server
 * room, the scene and the HUD all agree. The map is split by the two tile axes through
 * its centre into four quadrants (one per kingdom, each in a screen direction), with
 * Malakor's Void Citadel in the middle.
 */
import { WORLD_SCALE, WORLD_TILES } from './world/constants.ts';
import { creatureByCode, MYTHIC_CODE_MAX, MYTHIC_CODE_MIN } from './bestiary.ts'; // BESTIARY

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
    /** Its emblem (an icon name: ui/icons.tsx). */
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
        dir: [1, -1], color: 0xff6a3d, css: '#ff6a3d', glyph: 'flame',
        power: '+20% damage, hits burn',
        skill: { name: 'Flame Burst', blurb: 'A 360° wave of fire that burns everything around you' },
        warden: { name: 'Ignis', title: 'the Molten Scourge', kind: 'd_ignis', tint: 0xffffff, lines: ['Little carver. I have her name in my belly. Come and dig for it.', 'Every memory I swallow burns hotter than the last.'] },
        guard: { name: 'Cinder Warden', kind: 'brute', tint: 0xff9a7a },
        ground: 0xffc8a8,
    },
    air: {
        name: 'Zephyria', land: 'The Floating Isles', theme: 'Wind, agility, lightning and deception',
        dir: [-1, -1], color: 0x7dd3fc, css: '#7dd3fc', glyph: 'wind',
        power: '+15% speed, faster stamina, cheaper dodges',
        skill: { name: 'Lightning Dash', blurb: 'Phase-dash forward, leaving a crackling decoy that shocks anything near it' },
        warden: { name: 'Sylphide', title: 'the Whispering Tempest', kind: 'goblin', tint: 0x9fe8ff, lines: ['Outsiders bring only lies. I taught my people that.', 'You cannot strike what you cannot see, little stranger.'] },
        guard: { name: 'Gale Stalker', kind: 'wolf', tint: 0xcdefff },
        ground: 0xe4efff,
    },
    water: {
        name: 'Aquatica', land: 'The Sunken Depths', theme: 'Water, fluid motion, healing and deep-sea pressure',
        dir: [1, 1], color: 0x38bdf8, css: '#38bdf8', glyph: 'wave',
        power: 'Healing over time (more near water and rest), stronger potions',
        skill: { name: 'Glacial Spike', blurb: 'Raise a wall of ice spikes in front of you that freezes the horde' },
        warden: { name: 'General Vane', title: "Leviathan's Husk", kind: 'skeleton', tint: 0x7ab8ff, lines: ['The tides obey me now. The surface poisoned us, they said.', 'Drown in the lie with the rest of them!'] },
        guard: { name: 'Brine Ooze', kind: 'slime', tint: 0x8fd0ff },
        ground: 0xcfeef2,
    },
    earth: {
        name: 'The Void Wastes', land: "Malakor's Citadel", theme: 'Shattered obsidian, inverted gravity and raw primordial mana',
        dir: [-1, 1], color: 0x9d6bff, css: '#9d6bff', glyph: 'vortex',
        power: '+4 max health, +10% block',
        skill: { name: 'Stone Bulwark', blurb: 'Slam up a rock wall that stuns what is in front, and harden your skin' },
        warden: { name: 'The Reliquary Warden', title: 'Keeper of Stolen Names', kind: 'skeleton', tint: 0xc4a5ff, lines: ['Every name in this vault is mine to keep.', 'You will forget yours here, too.'] },
        guard: { name: 'Void Shade', kind: 'wraith', tint: 0xb89aff },
        ground: 0xd8ccf0,
    },
};
/** The order the seals fall in: each warden's defeat opens the next kingdom around the ring. */
export const RING: Element[] = ['fire', 'air', 'water', 'earth'];
export const nextKingdom = (e: Element): Element => RING[(RING.indexOf(e) + 1) % RING.length];
/** The kingdoms in the order a player meets them, starting from home. */
export const orderFrom = (home: Element): Element[] => RING.map((_, n) => RING[(RING.indexOf(home) + n) % RING.length]);

export const MALAKOR = { name: 'Malakor', title: 'Arbiter of the Broken Axis', kind: 'd_malakor', tint: 0xffffff };
export const CITADEL = { name: 'The Void Citadel', color: 0x8b5cf6 };

// ---------------------------------------------------------------- geometry

const C = WORLD_TILES / 2;
/** Tiles from the centre that belong to the Void Citadel. */
export const CITADEL_R = Math.round(22 * WORLD_SCALE);

export function regionOf(u: number, v: number): Region {
    const dx = u - C;
    const dy = v - C;
    if (Math.hypot(dx, dy) < CITADEL_R) return 'citadel';
    const sx = dx - dy; // screen right
    const sy = dx + dy; // screen down
    if (Math.abs(sx) > Math.abs(sy)) return sx > 0 ? 'fire' : 'earth';
    return sy > 0 ? 'water' : 'air';
}

/**
 * A place `d` out from the centre toward a kingdom, shifted `side` across. Both are in layout units (tiles on
 * the 384-tile continent the places were laid out on), so the layout spreads with the map (WORLD_SCALE).
 */
export function spot(e: Element, d: number, side: number): { i: number; j: number } {
    d *= WORLD_SCALE;
    side *= WORLD_SCALE;
    const [x, y] = KINGDOMS[e].dir;
    const ux = x / Math.SQRT2, uy = y / Math.SQRT2; // along
    const px = -uy, py = ux; // across
    return { i: Math.round(C + ux * d + px * side), j: Math.round(C + uy * d + py * side) };
}

export type LandmarkKind = 'camp' | 'arena' | 'guard' | 'tower' | 'house' | 'citadel' | 'site';
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

/**
 * The story's places in each land (game/story/land1-4.ts): distance out from the centre along the
 * kingdom's axis, how far across, and the flat ground each needs. Every land uses the same layout of
 * slots (so each fits the map the same way); four zones lie one beyond the next (Acts I-IV), each
 * sealed until the act before it is done.
 */
const SLOTS: [number, number, number][] = [
    [100, 44, 6], [92, -42, 7], [106, -62, 5], [78, -60, 3], [114, -22, 5],
    [137, -34, 4], [145, 6, 4], [138, 46, 4], [154, -46, 4], [152, 52, 4],
    [178, -34, 4], [178, 34, 4], [184, 0, 5],
    [208, -20, 3], [216, 18, 3], [223, -10, 3], [230, 0, 4], [62, 12, 4],
];
const slots = (names: string[]) => Object.fromEntries(names.map((n, k) => [n, SLOTS[k]])) as Record<string, [number, number, number]>;
export const STORY_SITES_BY: Record<Element, Record<string, [number, number, number]>> = {
    fire: slots(['quarry', 'oakhaven', 'springs', 'cellar', 'catacombs', 'siphonA', 'siphonB', 'siphonG', 'guildhall', 'grotto', 'scriptW', 'scriptE', 'library', 'shelter1', 'shelter2', 'shelter3', 'gate']),
    air: slots(['ravine', 'shrine', 'gorge', 'academy', 'gullet', 'turbineE', 'turbineW', 'turbineN', 'workshop', 'cloudsea', 'harps', 'postvault', 'crownBase', 'debris1', 'debris2', 'debris3', 'summit', 'bridge']),
    water: slots(['shelf', 'glacier', 'wave', 'vents', 'kelp', 'boiler1', 'boiler2', 'boiler3', 'conservatory', 'trench', 'engine', 'chasm', 'cathedral', 'lift1', 'lift2', 'lift3', 'wound', 'icefall']),
    earth: slots(['rift1', 'rift2', 'rift3', 'rift4', 'conservatory', 'siphon1', 'siphon2', 'siphon3', 'vault', 'bailey', 'stair1', 'stair2', 'bell', 'axis1', 'axis2', 'axis3', 'cradle', 'bridgehead']),
};
/** Pyraxis's sites, by name (Land 1). */
export const STORY_SITES = STORY_SITES_BY.fire as Record<'quarry' | 'oakhaven' | 'springs' | 'cellar' | 'catacombs' | 'siphonA' | 'siphonB' | 'siphonG' | 'guildhall' | 'grotto' | 'scriptW' | 'scriptE' | 'library' | 'shelter1' | 'shelter2' | 'shelter3' | 'gate', [number, number, number]>;
/** Where each land's three sub-bosses and its demon stand in the story (the same in every land). */
const STORY_BOSS_SPOTS: Record<string, [number, number, number]> = { 'guard:1': [124, 0, 7], 'guard:2': [162, 0, 8], 'guard:3': [194, 0, 7], 'arena:0': [240, 0, 9] };
/** How far out (along the axis) each story zone ends: Act I, II, III; beyond the last is Act IV. */
export const STORY_ZONES = [131, 170, 202] as const;
export const FIRE_ZONES = STORY_ZONES;
/** How far out along a kingdom's axis a tile lies, in layout units (as spot() and STORY_ZONES). */
export function axisDistance(e: Element, u: number, v: number): number {
    const [x, y] = KINGDOMS[e].dir;
    return ((u - C) * x + (v - C) * y) / Math.SQRT2 / WORLD_SCALE;
}

/** Every fixed place in the world: a camp, three guardians, a warden's arena, two towers and three houses per kingdom, the citadel, and Pyraxis's story sites. */
export const LANDMARKS: Landmark[] = (() => {
    const out: Landmark[] = [{ kind: 'citadel', el: null, n: 0, i: C, j: C, r: 9, id: 'citadel' }];
    for (const e of ELEMENTS) {
        const add = (kind: LandmarkKind, n: number, d: number, side: number, r: number) => {
            const story = STORY_BOSS_SPOTS[`${kind}:${n}`];
            if (story) [d, side, r] = story;
            const p = spot(e, d, side);
            out.push({ kind, el: e, n, i: p.i, j: p.j, r, id: `${kind}:${e}:${n}` });
        };
        add('camp', 0, 70, 0, 12); // r 12: the walled war camp (world/campLayout.ts) and the barricades before its gate
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
    for (const e of ELEMENTS) {
        for (const [id, [d, side, r]] of Object.entries(STORY_SITES_BY[e])) {
            const p = spot(e, d, side);
            out.push({ kind: 'site', el: e, n: 0, i: p.i, j: p.j, r, id: `site:${e}:${id}` });
        }
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

/** Each land's three sub-bosses (the Arch-Mage's unwilling champions), and its demon. */
const STORY_GUARDS: Record<Element, Record<number, { name: string; kind: string; tint: number }>> = {
    fire: {
        1: { name: 'Cinder-Gore the Cleaver', kind: 'd_cindergore', tint: 0xffffff },
        2: { name: 'Goliath Tarek, the Grand Mason', kind: 'd_tarek', tint: 0xffffff },
        3: { name: 'Pyra the Flame-Weaver', kind: 'd_pyra', tint: 0xffffff },
    },
    air: {
        1: { name: 'Zephyr-Claw', kind: 'd_zephyrclaw', tint: 0xffffff },
        2: { name: 'Volt-Lord Baruch', kind: 'd_baruch', tint: 0xffffff },
        3: { name: 'The Sky-Shredder', kind: 'd_skyshredder', tint: 0xffffff },
        9: { name: 'Vael the Storm-Reaper', kind: 'd_vael', tint: 0xffffff },
    },
    water: {
        1: { name: 'Frost-Bite the Trench Brute', kind: 'd_frostbite', tint: 0xffffff },
        2: { name: 'Queen of the Trench', kind: 'd_queen', tint: 0xffffff },
        3: { name: 'The Frozen Paladin', kind: 'd_paladin', tint: 0xffffff },
        9: { name: 'Hydros the Frozen Leviathan', kind: 'd_hydros', tint: 0xffffff },
    },
    earth: {
        1: { name: 'The Void Knight', kind: 'd_voidknight', tint: 0xffffff },
        2: { name: 'The Amalgamation', kind: 'd_amalgam', tint: 0xffffff },
        3: { name: "Malakor's Echo", kind: 'd_echo', tint: 0xffffff },
        9: { name: 'The Reliquary Warden', kind: 'd_reliquary', tint: 0xffffff },
    },
};

export interface BossInfo {
    name: string;
    kind: string;
    tint: number;
    el: Element | null;
    rank: 'guard' | 'warden' | 'malakor';
    n: number;
}
// ================================================================ BESTIARY (Bestiary team) ======
// The mythical bosses, codes 60-69 (designs in game/bestiary.ts, stats in shared/sim.ts). They count as
// wardens for size (drawn big) but belong to no kingdom's quest line (`el` null), so beating one
// changes no story progress; their rewards are for whoever places them in the world to decide.
function mythicBossInfo(code: number): BossInfo | null {
    const c = creatureByCode(code);
    return c ? { name: `${c.name}, ${c.title}`, kind: c.art, tint: 0xffffff, el: null, rank: 'warden', n: 0 } : null;
}
// ============================================================== end BESTIARY ======

export function bossInfo(code: number): BossInfo | null {
    if (code >= MYTHIC_CODE_MIN && code <= MYTHIC_CODE_MAX) return mythicBossInfo(code); // BESTIARY hook
    if (code === MIMIC_CODE) return { name: 'Mimic', kind: 'slime', tint: 0xffffff, el: null, rank: 'guard', n: 0 };
    if (code === MALAKOR_CODE) return { name: `${MALAKOR.name}, ${MALAKOR.title}`, kind: MALAKOR.kind, tint: MALAKOR.tint, el: null, rank: 'malakor', n: 0 };
    const e = ELEMENTS[Math.floor(code / 10) - 1];
    const n = code % 10;
    if (!e) return null;
    const k = KINGDOMS[e];
    // The story's own demon of a land (where it has one) before the kingdom's old warden.
    const sg = STORY_GUARDS[e][n];
    if (sg && n === 9) return { ...sg, el: e, rank: 'warden', n: 0 };
    if (n === 9) return { name: `${k.warden.name}, ${k.warden.title}`, kind: k.warden.kind, tint: k.warden.tint, el: e, rank: 'warden', n: 0 };
    if (sg) return { ...sg, el: e, rank: 'guard', n };
    if (n >= 1 && n <= 3) return { name: `${k.guard.name} of ${k.name}`, kind: k.guard.kind, tint: k.guard.tint, el: e, rank: 'guard', n };
    return null;
}

// ---------------------------------------------------------------- story text

export const PROLOGUE: { title: string; text: string }[] = [
    { title: 'The Heart of the World', text: 'Eidolon was one land, fed by the Heart of the World. Every five hundred years the Heart grows unstable. The Grand Arcane Tide rises, and the demons of the abyss climb out of the depths to make war on the living.' },
    { title: 'The Wars of the Tide', text: 'Three times the Tide came. Three times the nations of Eidolon stood together, fought, and drove the abyss back into the dark. United, they always won.' },
    { title: 'The Arch-Mage', text: 'Then Malakor, Grand Arch-Mage of the Ley-Nexus, read the Fourth Tide in his celestial charts: a war worse than any the world had seen. He looked at the kings and councils of his age, and judged that they could not win it.' },
    { title: 'The Shattering', text: 'So he chose to end the cycle forever. He drove obsidian spikes into the world’s veins and broke Eidolon into four lands adrift on the Abyssal Maelstrom. The abyss did not close: its demons still rise, and a pale Mist eats the memories of the people.' },
    { title: 'You', text: 'Three hundred years later, your guild broke the seal of Ignis in the ash-caverns of Pyraxis. It swallowed the Memory Pillar whole, and with it everything Lyra remembered. She is unhurt, and she does not know you. Carve her memories back out of the beast.' },
];

export const EPILOGUE_EIDOLON = [
    'Malakor falls, and the incantation that held the world apart unravels. The four lands drift back together over the Maelstrom.',
    '"He was one of us once," says Master Orin. "Remember that." Lyra squeezes your hand. She remembers. But the Tide is restless, and the Demons smell memory. Survive, and grow stronger still.',
];

// ---------------------------------------------------------------- the Sanctuary's people

export type NpcId = 'theron' | 'varis' | 'lyra' | 'kael' | 'lin' | 'thorne' | 'nerissa';
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
        name: 'Master Orin', role: 'Guild apothecary', at: [2.6, 1.6], tint: 0xd8c8ff,
        greet: 'Keep to the light of the Spire, child. The Mist cannot follow you here.',
        talk: [
            { q: 'What happened to Lyra?', a: 'Ignis did not want her body, child. It drank the Memory Pillar, and her memories with it. She is whole, and she is empty. Her memories sit unmelted in the beast’s belly. Crack it open before the Mist fills the space they left, and we can pour them back.' },
            { q: 'What are the Wave Demons?', a: 'The army of the abyss. Every five hundred years the Heart of the World breaks open and they march; the nations of old stood together and threw them back. Malakor broke the world to end that war, and the cracks never closed: now they come every night. Only the Spire’s light is safe ground.' },
            { q: 'Who was Malakor?', a: 'The Grand Arch-Mage of the Ley-Nexus. His charts said the Fourth Tide would be the worst war the world had ever seen, and he did not believe the kings of his age could win it. So he made sure there would never be another Tide to fight. History calls him a monster. Find the truth, if you can.' },
            { q: 'Where do I go next?', a: 'Follow the gold marker; the tracker says exactly how. And come back to the Spire to breathe, to brew, and to sit with her. She hears more than you think.' },
        ],
    },
    varis: {
        name: 'Bram', role: 'Blacksmith', at: [3.2, -1.4], tint: 0xffc89a,
        greet: 'I know my name. I know my trade. My hands still shake at the anvil.',
        talk: [
            { q: 'Can you improve my gear?', a: 'Bring me ore, and the forge hot. The Mist took twenty years of my life, but iron remembers what I forgot. I can raise the forge, and with it your blade.' },
            { q: 'What do you remember?', a: 'A cellar in Oakhaven. A hammer I was proud of. And a little wooden doll I cannot place. I think it matters more than the hammer.' },
            { q: 'What is a Slag-Breaker?', a: 'An edge hard enough to cut the tether nodes of a slag barrier. I can forge one, if you find my old cross-peen hammer.' },
        ],
    },
    lyra: {
        name: 'Lyra', role: 'Your partner, who does not remember you', at: [-2.8, -1.8], tint: 0xb6f2b0,
        greet: 'She does not look at you.',
        talk: [
            { q: 'Sit with her a while.', a: 'You sit beside her. She lets you, politely, the way you let a stranger share a bench. You tell her about the cedar tree, the first chisel, the northern meadows. She listens as if it were a story about somebody else.' },
        ],
    },
    kael: {
        name: 'Kael', role: "Tarek's apprentice", at: [-2.8, 2.2], tint: 0x9ad0ff,
        greet: 'I owe you my life. Ask me anything about the old machines.',
        talk: [
            { q: 'Tell me about Goliath Tarek.', a: 'The Grand Mason. Malakor bound him into a golem of magma and brass to hold the Siphon Trench shut. My grandfather drafted the chassis; Tarek built in a secret quench, in case the magic ever drove him mad.' },
            { q: 'What do you build now?', a: 'Turrets, if you bring the parts. Ballistas, flame turrets, catapults, tesla coils, steam-mortars: craft them at the bench and set them down in the Sanctuary. Lay Ley-Conduits from the Spire so they have power.' },
        ],
    },
    lin: {
        name: 'Artificer Lin', role: 'Master sky-weaver', at: [2.6, 1.6], tint: 0xc4f1ff,
        greet: 'Mind the gusts, Archaeologist. The Aerie holds, for now.',
        talk: [
            { q: 'What happened to Zephyria?', a: 'Vael reversed the Atmospheric Turbines. They were built to filter the Mist out of the sky; now they grind it into Storm-Miasma. Turn them back, and the islands breathe again.' },
            { q: 'Who is Vael?', a: "Malakor's adoptive little sister. The cleverest sky-architect who ever lived. He locked her in the turbine core of Tempest Crown, and three centuries made her into a storm." },
            { q: 'What can you make me?', a: 'Bring me Gale-Silk and I will make you a grapple. Bring me copper and quartz and I will temper you a blade that can carry lightning.' },
        ],
    },
    thorne: {
        name: 'Captain Thorne', role: 'Zephyr-Captain, sky-scout', at: [3.2, -1.4], tint: 0xfde68a,
        greet: 'Wind from the west today. Good flying weather, if you have wings.',
        talk: [
            { q: 'Where is Elena?', a: 'My navigator. My wife. I was flying her the charts when I came down. I keep the voice-crystal in my coat. One day I will be brave enough to play it.' },
            { q: 'How do I ride the updrafts?', a: 'Spread the glider over a thermal vent and let it take you. Lean into the wind, never away.' },
        ],
    },
    nerissa: {
        name: 'Scholar Nerissa', role: 'Scholar-diver of Thalassia', at: [2.6, 1.6], tint: 0x99f6e4,
        greet: 'I remember the night the sea froze. I remember everything. It is a heavy gift.',
        talk: [
            { q: 'What happened to Admiral Kaelis?', a: 'He led an armada to stop Malakor on the night of the Shattering. Malakor froze the ocean with him at the bottom of it. His grief became Hydros.' },
            { q: 'How do I survive the cold?', a: 'Keep moving. Stand still away from a brazier and the frostbite climbs. Crampons keep your footing on the ice.' },
            { q: 'Your husband?', a: 'Lieutenant Varian. Signal officer on the Dawn-Breaker. She is still up there, frozen at the top of the wave.' },
        ],
    },
};
