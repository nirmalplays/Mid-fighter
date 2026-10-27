/**
 * The bestiary: the design of every mythical creature (ten bosses, seven foes that take over from
 * the pack's goblins and wolves as the waves get harder). Pure data, no imports, so the HUD's codex,
 * the boss table (game/eidolon.ts bossInfo), the AI (shared/sim.ts archetypes and phases) and the
 * art brief (docs/studio/bestiary-art-brief.md) all read the same thing.
 *
 * Art: each creature's `art` id names its sheets (src/game/world/beastAtlas.ts holds their layout,
 * which can be any cell size, frame count and number of facings). The sheets shipped today are
 * PLACEHOLDERS built by tools/build-beasts.py.
 *
 * Stats live in shared/sim.ts (the BESTIARY block); this file says how a creature should behave,
 * so whoever wires the data-driven AI can map `archetype` and `phases` straight onto it.
 */

/** The AI archetypes the Opponents team is moving to (shared/sim.ts). */
export type Archetype = 'charger' | 'flanker' | 'burrower' | 'caster' | 'flyer' | 'breath' | 'guard' | 'splitter';
/** Where a creature lives: a kingdom by its element, or Malakor's citadel. */
export type Home = 'fire' | 'air' | 'water' | 'earth' | 'citadel';
/** Rough size: how many tiles across its footprint is (for collision, telegraph scale and the art brief). */
export type SizeClass = 'small' | 'medium' | 'large' | 'huge' | 'colossal';
export const SIZE_TILES: Record<SizeClass, number> = { small: 0.6, medium: 1, large: 2, huge: 3, colossal: 4 };

/** The warning drawn on the ground before a blow lands. Sizes in tiles. */
export interface Telegraph {
    shape: 'cone' | 'line' | 'circle' | 'ring' | 'arc' | 'target';
    /** Length of a cone / line, radius of a circle / ring / arc, radius of each target. */
    size: number;
    /** Width of a line, angle (degrees) of a cone or arc, thickness of a ring, how many targets. */
    width?: number;
    /** How long the warning shows before the hit (ms). */
    windupMs: number;
}
export interface Attack {
    name: string;
    what: string;
    telegraph: Telegraph;
    /** Damage as a multiple of the boss's blow. */
    dmg: number;
    cooldownMs: number;
}
export interface Phase {
    /** The phase starts when health falls to this fraction (1 = from the start). */
    at: number;
    name: string;
    archetype: Archetype;
    /** What changes: speed, new attacks, adds, the arena. */
    note: string;
    attacks: Attack[];
}
export interface Creature {
    id: string;
    /** Sheet id (beastAtlas.ts); foes add `_1` / `_2` for the colour tiers. */
    art: string;
    /** Boss code (shared/sim.ts bossSpec, game/eidolon.ts bossInfo); absent for foes. */
    code?: number;
    name: string;
    title: string;
    lore: string;
    home: Home;
    size: SizeClass;
    archetype: Archetype;
    /** Where to hit it: a weak point the art should show and the fight can reward. */
    weakPoint: string;
    phases?: Phase[];
    /** Foes: the earliest wave it joins, and the pack foes it pushes out of the mix. */
    minWave?: number;
    replaces?: string[];
}

const T = (shape: Telegraph['shape'], size: number, windupMs: number, width?: number): Telegraph => ({ shape, size, windupMs, ...(width !== undefined ? { width } : {}) });

// ---------------------------------------------------------------- bosses (codes 60-69)

export const MYTHIC_BOSSES: Creature[] = [
    {
        id: 'vulkaris', art: 'b_dragon', code: 60, name: 'Vulkaris', title: 'the Ember Dragon', home: 'fire', size: 'huge', archetype: 'breath',
        lore: 'She slept under the Crags so long the mountain grew a crust over her. Malakor\'s spikes woke her, and she has been burning the world for the insult ever since.',
        weakPoint: 'The glowing furnace in her throat, open only while she breathes.',
        phases: [
            { at: 1, name: 'Grounded', archetype: 'breath', note: 'Walks the arena, sweeps fire at whoever is in front.', attacks: [
                { name: 'Cinder Breath', what: 'A long cone of fire, swept slowly left to right.', telegraph: T('cone', 6, 1100, 50), dmg: 1.5, cooldownMs: 5200 },
                { name: 'Tail Lash', what: 'Spins and whips anything behind or beside her.', telegraph: T('ring', 3, 700, 1.2), dmg: 1, cooldownMs: 3600 },
            ] },
            { at: 0.6, name: 'On the Wing', archetype: 'flyer', note: 'Takes off: untargetable while airborne, strafes in lines, lands to breathe.', attacks: [
                { name: 'Strafing Run', what: 'Flies across the arena raining fire along her path.', telegraph: T('line', 12, 1300, 2), dmg: 1.5, cooldownMs: 7000 },
                { name: 'Ember Rain', what: 'Molten drops fall on marked spots.', telegraph: T('target', 1.2, 1200, 6), dmg: 1, cooldownMs: 6000 },
            ] },
            { at: 0.25, name: 'Molten Heart', archetype: 'breath', note: 'Lands for good, her scales cracking with lava; the ground burns where she walks.', attacks: [
                { name: 'Inferno Nova', what: 'Fire bursts out of her in every direction.', telegraph: T('circle', 5, 1600), dmg: 2, cooldownMs: 8000 },
                { name: 'Cinder Breath', what: 'As before, faster.', telegraph: T('cone', 7, 800, 60), dmg: 1.5, cooldownMs: 4000 },
            ] },
        ],
    },
    {
        id: 'tempestra', art: 'b_griffin', code: 61, name: 'Tempestra', title: 'the Storm Griffin', home: 'air', size: 'large', archetype: 'flyer',
        lore: 'The isles\' sky-kings rode her kind into war once. She remembers the riders, and she kills anyone who climbs high enough to look like one.',
        weakPoint: 'Her wing joints, which stay low and open for a beat after every dive.',
        phases: [
            { at: 1, name: 'Circling', archetype: 'flyer', note: 'Circles out of reach, then dives at a marked spot and lands for a moment.', attacks: [
                { name: 'Stoop', what: 'A diving talon strike on where you stood.', telegraph: T('target', 1.6, 1000, 1), dmg: 1.5, cooldownMs: 4200 },
                { name: 'Gale Buffet', what: 'A wing-beat that shoves everyone back.', telegraph: T('cone', 4, 700, 90), dmg: 0.5, cooldownMs: 5000 },
            ] },
            { at: 0.5, name: 'Eye of the Storm', archetype: 'caster', note: 'Calls the storm: lightning falls on marked tiles while she keeps diving.', attacks: [
                { name: 'Thunderclap', what: 'Three bolts strike marked spots in turn.', telegraph: T('target', 1.3, 900, 3), dmg: 1.2, cooldownMs: 3800 },
                { name: 'Stoop', what: 'Now chains two dives.', telegraph: T('target', 1.6, 800, 2), dmg: 1.5, cooldownMs: 4600 },
            ] },
        ],
    },
    {
        id: 'thalassa', art: 'b_hydra', code: 62, name: 'Thalassa', title: 'the Abyssal Hydra', home: 'water', size: 'huge', archetype: 'guard',
        lore: 'Three heads, three grudges. Cut one and the trench gives her two more; the Depths\' old priests fed her prisoners until there were no priests left.',
        weakPoint: 'The stump of a severed neck: burn or freeze it before it regrows.',
        phases: [
            { at: 1, name: 'Three Heads', archetype: 'guard', note: 'Holds the middle of the pool, each head guarding a third of the circle.', attacks: [
                { name: 'Triple Strike', what: 'Each head lunges in turn along a line.', telegraph: T('line', 5, 800, 1.4), dmg: 1, cooldownMs: 3000 },
                { name: 'Brine Spit', what: 'A glob of acid that leaves a puddle.', telegraph: T('target', 1.4, 900, 1), dmg: 1, cooldownMs: 3400 },
            ] },
            { at: 0.66, name: 'Five Heads', archetype: 'splitter', note: 'The first head lost becomes two: more lunges, shorter gaps.', attacks: [
                { name: 'Hydra Fan', what: 'All heads lunge at once in a fan.', telegraph: T('cone', 5, 1100, 140), dmg: 1.2, cooldownMs: 5000 },
            ] },
            { at: 0.3, name: 'The Deep Head', archetype: 'breath', note: 'A fourth, ancient head surfaces from the pool and breathes a freezing torrent.', attacks: [
                { name: 'Abyssal Torrent', what: 'A freezing line of water that slows.', telegraph: T('line', 9, 1300, 2.2), dmg: 1.5, cooldownMs: 6000 },
            ] },
        ],
    },
    {
        id: 'mothermaw', art: 'b_kraken', code: 63, name: 'Mother Maw', title: 'the Kraken Below the Breakers', home: 'water', size: 'colossal', archetype: 'burrower',
        lore: 'Fishermen of the coast still leave her the first catch. The ones who stopped are the reason the coast has so few fishermen.',
        weakPoint: 'Her great eye, which surfaces to look for you when a tentacle misses.',
        phases: [
            { at: 1, name: 'Tentacles', archetype: 'burrower', note: 'Only tentacles: they burst up from the water under marked tiles and slam.', attacks: [
                { name: 'Breach', what: 'A tentacle erupts under you.', telegraph: T('circle', 1.3, 1000), dmg: 1, cooldownMs: 2200 },
                { name: 'Slam', what: 'A tentacle falls across a line.', telegraph: T('line', 7, 1100, 1.6), dmg: 1.5, cooldownMs: 4000 },
            ] },
            { at: 0.5, name: 'Surfaced', archetype: 'guard', note: 'The head rises; the eye can be hit. Tentacles sweep around her.', attacks: [
                { name: 'Sweep', what: 'Tentacles sweep an arc in front.', telegraph: T('arc', 5, 1000, 160), dmg: 1.5, cooldownMs: 4200 },
                { name: 'Ink Cloud', what: 'Darkens the arena around her; foes in it are hidden.', telegraph: T('circle', 4, 900), dmg: 0, cooldownMs: 9000 },
            ] },
            { at: 0.2, name: 'Whirlpool', archetype: 'breath', note: 'The water spins: everyone is dragged toward the beak.', attacks: [
                { name: 'Maelstrom Pull', what: 'Pulls you in for three seconds, then bites.', telegraph: T('ring', 6, 1500, 1.5), dmg: 2, cooldownMs: 9000 },
            ] },
        ],
    },
    {
        id: 'ostrakon', art: 'b_colossus', code: 64, name: 'Ostrakon', title: 'the Stone Colossus', home: 'earth', size: 'colossal', archetype: 'charger',
        lore: 'Built to guard the Ley-Nexus before the Shattering, it still guards it. It has not noticed that there is nothing left inside.',
        weakPoint: 'The violet rune-core in its back, bared when it bends to pull a fist out of the ground.',
        phases: [
            { at: 1, name: 'Sentinel', archetype: 'charger', note: 'Slow walk, enormous blows; every slam leaves it stuck for a moment.', attacks: [
                { name: 'Hammerfall', what: 'Both fists brought down in front.', telegraph: T('circle', 2.4, 1300), dmg: 2, cooldownMs: 4200 },
                { name: 'Quake', what: 'A shockwave ring spreads from its feet.', telegraph: T('ring', 5, 1500, 1), dmg: 1, cooldownMs: 6500 },
            ] },
            { at: 0.5, name: 'Shedding', archetype: 'splitter', note: 'Its shell falls off as small stone golems (use gargoyles as adds); faster, more runes lit.', attacks: [
                { name: 'Boulder Toss', what: 'Throws a piece of itself at you.', telegraph: T('target', 1.8, 1200, 1), dmg: 1.5, cooldownMs: 3800 },
                { name: 'Hammerfall', what: 'As before, twice in a row.', telegraph: T('circle', 2.4, 1000), dmg: 2, cooldownMs: 3800 },
            ] },
        ],
    },
    {
        id: 'asterion', art: 'b_minotaur', code: 65, name: 'Asterion', title: 'Lord of the Labyrinth', home: 'citadel', size: 'large', archetype: 'charger',
        lore: 'Malakor\'s arena-master. He has walked the citadel\'s maze for three hundred years, and he knows every turn of it better than you.',
        weakPoint: 'His horns: when a charge ends in a wall he is stuck and stunned.',
        phases: [
            { at: 1, name: 'Bull Rush', archetype: 'charger', note: 'Paws the ground, then charges in a straight line until he hits something.', attacks: [
                { name: 'Gore Charge', what: 'A straight charge across the arena.', telegraph: T('line', 12, 1200, 1.8), dmg: 2, cooldownMs: 5000 },
                { name: 'Labrys Cleave', what: 'An overhead double-axe blow.', telegraph: T('cone', 2.5, 800, 70), dmg: 1.5, cooldownMs: 2600 },
            ] },
            { at: 0.4, name: 'Bloodied', archetype: 'flanker', note: 'Snorting steam, he feints and circles; chains the cleave into a spin.', attacks: [
                { name: 'Whirling Labrys', what: 'Spins with the axe out.', telegraph: T('circle', 2.8, 900), dmg: 1.5, cooldownMs: 4200 },
                { name: 'Gore Charge', what: 'Now bounces off walls once.', telegraph: T('line', 12, 1000, 1.8), dmg: 2, cooldownMs: 4400 },
            ] },
        ],
    },
    {
        id: 'sarrazh', art: 'b_basilisk', code: 66, name: 'Sarrazh', title: 'the Basilisk of the Glass Dunes', home: 'fire', size: 'large', archetype: 'burrower',
        lore: 'The badlands\' statues are not statues. Sarrazh keeps them; she likes an audience.',
        weakPoint: 'The crimson crest, which flares before every gaze. A mirror (a parry) turns the gaze back on her.',
        phases: [
            { at: 1, name: 'Under the Sand', archetype: 'burrower', note: 'Swims under the ground (a moving ripple), bursts up under you.', attacks: [
                { name: 'Ambush', what: 'Erupts under you and bites.', telegraph: T('circle', 1.6, 900), dmg: 1.5, cooldownMs: 3600 },
                { name: 'Venom Fang', what: 'A quick strike that poisons.', telegraph: T('cone', 2.2, 600, 50), dmg: 1, cooldownMs: 2400 },
            ] },
            { at: 0.5, name: 'Petrifying Gaze', archetype: 'caster', note: 'Rears up: the crest flares and her stare turns whoever is in front to stone for a while.', attacks: [
                { name: 'Stone Gaze', what: 'A cone of green light: look away (turn your back) or be petrified.', telegraph: T('cone', 7, 1400, 40), dmg: 0.5, cooldownMs: 7000 },
                { name: 'Sand Coil', what: 'Coils round and squeezes.', telegraph: T('ring', 2.5, 900, 1), dmg: 1.5, cooldownMs: 4000 },
            ] },
        ],
    },
    {
        id: 'cinderwake', art: 'b_phoenix', code: 67, name: 'Cinderwake', title: 'the Twice-Born Phoenix', home: 'air', size: 'large', archetype: 'flyer',
        lore: 'Every five hundred years she burns and is born again, like the Heart she was made from. She is due. She would rather take you with her.',
        weakPoint: 'The ash egg she becomes at the end: break it before she hatches.',
        phases: [
            { at: 1, name: 'Firebird', archetype: 'flyer', note: 'Hovers out of reach, swoops through you leaving a line of fire.', attacks: [
                { name: 'Flame Swoop', what: 'A swoop that leaves a burning trail.', telegraph: T('line', 9, 1000, 1.6), dmg: 1.2, cooldownMs: 4000 },
                { name: 'Feather Volley', what: 'A fan of burning feathers.', telegraph: T('cone', 7, 800, 60), dmg: 0.8, cooldownMs: 3200 },
            ] },
            { at: 0.35, name: 'Pyre', archetype: 'caster', note: 'Lands in a blaze; the arena edge catches fire and closes in.', attacks: [
                { name: 'Sunburst', what: 'A ring of fire rolls outward.', telegraph: T('ring', 6, 1300, 1), dmg: 1.5, cooldownMs: 5000 },
            ] },
            { at: 0, name: 'Rebirth', archetype: 'guard', note: 'At zero she collapses into an ash egg with 25% health: break it in 12 s or she rises with half her health back.', attacks: [] },
        ],
    },
    {
        id: 'grimmaw', art: 'b_cerberus', code: 68, name: 'Grimmaw', title: 'the Hound of Three Gates', home: 'earth', size: 'huge', archetype: 'flanker',
        lore: 'Three heads, one leash, and the leash broke when the world did. Each head guards a gate that no longer exists, and each is still hungry.',
        weakPoint: 'The collar\'s chain: hit it during a lunge and the heads snap at each other.',
        phases: [
            { at: 1, name: 'Three Hungers', archetype: 'flanker', note: 'Circles you; each head bites on its own side.', attacks: [
                { name: 'Triple Bite', what: 'Three bites, left, centre, right.', telegraph: T('arc', 2.6, 700, 150), dmg: 1.2, cooldownMs: 2800 },
                { name: 'Pounce', what: 'Leaps onto a marked spot.', telegraph: T('target', 2, 1000, 1), dmg: 1.5, cooldownMs: 4400 },
            ] },
            { at: 0.5, name: 'Howl', archetype: 'breath', note: 'Howls up a pack of hellhounds; each head breathes fire in turn.', attacks: [
                { name: 'Hellfire Triad', what: 'Three narrow fire cones in sequence.', telegraph: T('cone', 5, 900, 25), dmg: 1.2, cooldownMs: 5000 },
                { name: 'Call the Pack', what: 'Three hellhounds join.', telegraph: T('circle', 0.1, 600), dmg: 0, cooldownMs: 15000 },
            ] },
        ],
    },
    {
        id: 'kharzul', art: 'b_manticore', code: 69, name: 'Kharzul', title: 'the Manticore', home: 'air', size: 'large', archetype: 'flanker',
        lore: 'A lion\'s body, a bat\'s wings and a scorpion\'s patience. Kharzul hunts the isles\' rope bridges, and leaves the ropes.',
        weakPoint: 'The base of the tail: sever it and the venom phase never comes.',
        phases: [
            { at: 1, name: 'Stalker', archetype: 'flanker', note: 'Slinks to your side or back before striking; short hops on its wings.', attacks: [
                { name: 'Claw Rake', what: 'Two quick swipes.', telegraph: T('cone', 2.2, 600, 80), dmg: 1, cooldownMs: 2200 },
                { name: 'Sting', what: 'The tail strikes over its head at long range.', telegraph: T('line', 5, 900, 1), dmg: 1.5, cooldownMs: 3400 },
            ] },
            { at: 0.45, name: 'Venom Barrage', archetype: 'caster', note: 'Takes to the air and fires volleys of tail spikes.', attacks: [
                { name: 'Spike Volley', what: 'A fan of poison spikes.', telegraph: T('cone', 8, 900, 70), dmg: 0.8, cooldownMs: 3000 },
                { name: 'Venom Pool', what: 'A puddle of poison where the spikes land.', telegraph: T('target', 1.5, 1000, 3), dmg: 0.5, cooldownMs: 6000 },
            ] },
        ],
    },
];

// ---------------------------------------------------------------- foes (colour tiers: art, art_1, art_2)

export const MYTHIC_FOES: Creature[] = [
    {
        id: 'imp', art: 'imp', name: 'Imp', title: 'Cinder Imp', home: 'fire', size: 'small', archetype: 'flyer', minWave: 4, replaces: ['kobolt'],
        lore: 'A spark that learned to laugh. They flit just out of reach and pelt you with fire until the bigger things arrive.',
        weakPoint: 'Fragile: one clean hit drops it, if you can catch it on the ground after it throws.',
    },
    {
        id: 'harpy', art: 'harpy', name: 'Harpy', title: 'Gale Harpy', home: 'air', size: 'medium', archetype: 'flyer', minWave: 5, replaces: ['wolf'],
        lore: 'Half woman, half hawk, all grudge. Harpies hover, shriek, and drop on you talons first.',
        weakPoint: 'Grounded for a beat after each swoop.',
    },
    {
        id: 'hellhound', art: 'hellhound', name: 'Hellhound', title: 'Ashen Warg', home: 'fire', size: 'medium', archetype: 'flanker', minWave: 6, replaces: ['wolf'],
        lore: 'Black as a burned-out hearth and nothing like the camp\'s wolves. They come in threes and never from the front.',
        weakPoint: 'Its embers dim before it lunges: strike then.',
    },
    {
        id: 'gargoyle', art: 'gargoyle', name: 'Gargoyle', title: 'Ruin Gargoyle', home: 'earth', size: 'medium', archetype: 'guard', minWave: 8, replaces: ['skeleton'],
        lore: 'It sits on a ruin pretending to be part of it, stone-hard while it waits, then drops on whoever walks past.',
        weakPoint: 'Soft while it moves; stone (no damage) while perched.',
    },
    {
        id: 'salamander', art: 'salamander', name: 'Salamander', title: 'Salamander Spearwarden', home: 'fire', size: 'medium', archetype: 'guard', minWave: 7, replaces: ['goblin'],
        lore: 'Lizard-folk of the lava tubes, disciplined as soldiers. The shield comes up the moment you swing.',
        weakPoint: 'Its back: the shield only covers the front.',
    },
    {
        id: 'wisp', art: 'wisp', name: 'Will-o\'-wisp', title: 'Mist Wisp', home: 'water', size: 'small', archetype: 'caster', minWave: 9, replaces: ['wizard'],
        lore: 'A lost memory the Mist set alight. It drifts away from you and fires cold bolts, and the Mist grows where it goes.',
        weakPoint: 'It must stop to cast; it cannot move and shoot at once.',
    },
    {
        id: 'deathknight', art: 'deathknight', name: 'Death Knight', title: 'Hollow Knight of the Citadel', home: 'citadel', size: 'medium', archetype: 'guard', minWave: 10, replaces: ['skeleton', 'brute'],
        lore: 'Malakor\'s old guard, still in their armour, long after they stopped needing to breathe in it.',
        weakPoint: 'A heavy overhead swing leaves it open; its shield breaks after three blocked blows.',
    },
];

export const BESTIARY: Creature[] = [...MYTHIC_BOSSES, ...MYTHIC_FOES];
export const creatureByCode = (code: number): Creature | undefined => MYTHIC_BOSSES.find((c) => c.code === code);
export const creatureByArt = (art: string): Creature | undefined => BESTIARY.find((c) => c.art === art || art.startsWith(`${c.art}_`));
/** The mythical bosses' codes: 60-69. */
export const MYTHIC_CODE_MIN = 60;
export const MYTHIC_CODE_MAX = 69;
