/**
 * What gets saved for each player (RUN's appStorage is per player and per game, so
 * every account — yours, a friend's — has its own save). Shape changes need a
 * version bump plus a migration; added fields fill in automatically.
 */
import { createSaveSystem, fillMissing } from './helpers/save.ts';
import { CARRY_MAX, COOLDOWN_MAX, defaultSpellSave, SPELLS, type SpellSave } from './game/world/spells.ts';
import { MAP_TILES } from './game/world/constants.ts';
import {
    BACKPACK_TOP, BUILDING_IDS, CARD_IDS, emptyBag, emptyBuildings, emptyStats, GEAR_TOP, HOTBAR_SLOTS, ITEM_IDS, ITEMS, maxDurability, TOOL_ITEMS,
    type Bag, type Buildings, type CardId, type ItemId, type Stats,
} from './game/survival.ts';
import { ELEMENTS, LANDMARKS, NPCS, type Element, type NpcId } from './game/eidolon.ts';

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
    /** Materials, potions and keys held (see game/survival.ts ITEMS). */
    bag: Bag;
    /** Copies of each power card found (the level comes from the copies). */
    cards: Record<string, number>;
    /** Cards worn, up to the Card totem's slots. */
    equipped: CardId[];
    /** Camp building levels (no cap). */
    buildings: Buildings;
    /** Player level (no cap) and XP toward the next. */
    level: number;
    xp: number;
    /** The kingdom this player pledged to (null until chosen). Its camp is home. */
    kingdom: Element | null;
    /** Wardens defeated (each opens the next kingdom and grants its power), guardians defeated ('fire:1'), Malakor's defeats. */
    wardens: Element[];
    guards: string[];
    malakor: number;
    /** Gear tiers (0-3), the highest blueprint owned, and the weapon's elemental infusion. */
    gear: { weapon: number; armor: number; bp: number; infusion: Element | null; relics: string[]; relic: string | null };
    /** Gems socketed in the weapon (items, see survival.ts). */
    sockets: ItemId[];
    /** Hunger, thirst and rest, 0-100. */
    meters: { hunger: number; thirst: number; rest: number };
    /** Map cells (8 × 8 tiles) seen, as a base64 bit field; watchtowers climbed (landmark ids). */
    explored: string;
    towers: string[];
    /** Houses searched: landmark id -> play seconds when searched (they refill). */
    houses: Record<string, number>;
    /** People in camp spoken to (some give something the first time). */
    talked: NpcId[];
    /** The four hotbar slots (item kinds held: tools, weapons, consumables) and which one is in hand. */
    hotbar: (ItemId | null)[];
    held: number;
    /** Wear left on each tool you own (0 = broken until repaired). */
    durability: Record<string, number>;
    /** Backpack upgrades (each adds slots). */
    backpack: number;
    /** Story: the chapter reached, the stat value when it began, and whether the intro was seen. */
    story: { step: number; base: number; introSeen: boolean };
    /** Lifetime counters the story objectives read. */
    stats: Stats;
    /** Chests opened: chest id -> play seconds when opened (they refill after a while). */
    chests: Record<string, number>;
}

export function defaultSave(): FighterSave {
    return {
        version: 4,
        scene: 'world',
        world: { u: MAP_TILES / 2 + 0.5, v: MAP_TILES / 2 + 0.5, set: false },
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
        bag: { ...emptyBag(), tool_sword: 1, tool_axe: 1, tool_pickaxe: 1, tool_fishingpole: 1 },
        cards: {},
        equipped: [],
        buildings: emptyBuildings(),
        level: 1,
        xp: 0,
        kingdom: null,
        wardens: [],
        guards: [],
        malakor: 0,
        gear: { weapon: 0, armor: 0, bp: 0, infusion: null, relics: [], relic: null },
        sockets: [],
        meters: { hunger: 100, thirst: 100, rest: 100 },
        explored: '',
        towers: [],
        houses: {},
        talked: [],
        hotbar: ['tool_sword', 'tool_axe', 'tool_pickaxe', null],
        held: 0,
        durability: { tool_sword: 80, tool_axe: 150, tool_pickaxe: 150, tool_fishingpole: 100 },
        backpack: 0,
        story: { step: 0, base: 0, introSeen: false },
        stats: emptyStats(),
        chests: {},
    };
}

export const saveSystem = createSaveSystem<FighterSave>({
    key: 'bounce-lab-save',
    version: 4,
    defaultSave,
    migrations: {
        // v2: the map grew from 256 to 384 tiles, so an old position no longer matches the land.
        2: (s, def) => {
            s.world = { ...def.world };
        },
        // v3: Eidolon. The Heartstone story is gone and the map is now four kingdoms: the story starts over
        // (with its new prologue and a kingdom to choose); level, buildings, cards and items stay.
        3: (s, def) => {
            s.world = { ...def.world };
            s.story = { ...def.story };
            delete s.stones;
            if (s.bag && typeof s.bag === 'object') delete (s.bag as Record<string, unknown>).shrine_key;
        },
        // v4: tools are items in a 4-slot hotbar with durability; give existing players the tools they used to have.
        4: (s, def) => {
            const bag = (s.bag && typeof s.bag === 'object' ? s.bag : {}) as Record<string, number>;
            for (const k of ['tool_sword', 'tool_axe', 'tool_pickaxe', 'tool_fishingpole', 'tool_shovel', 'tool_hammer']) bag[k] = 1;
            s.bag = bag;
            s.hotbar = [...def.hotbar];
            s.durability = { ...def.durability, tool_shovel: 120, tool_hammer: 140 };
        },
    },
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
        const count = (o: unknown, keys: readonly string[]): Record<string, number> => {
            const src = (typeof o === 'object' && o ? o : {}) as Record<string, unknown>;
            return Object.fromEntries(keys.map((k) => [k, typeof src[k] === 'number' && (src[k] as number) >= 0 ? Math.floor(src[k] as number) : 0]));
        };
        s.bag = count(s.bag, ITEM_IDS) as Bag;
        s.cards = Object.fromEntries(Object.entries(count(s.cards, CARD_IDS)).filter(([, n]) => n > 0));
        s.equipped = Array.isArray(s.equipped) ? [...new Set((s.equipped as unknown[]).filter((c): c is CardId => (CARD_IDS as unknown[]).includes(c) && (s.cards[c as string] ?? 0) > 0))] : [];
        s.buildings = count(s.buildings, BUILDING_IDS) as Buildings;
        s.stats = count(s.stats, Object.keys(def.stats)) as Stats;
        if (!(Number.isInteger(s.level) && s.level >= 1)) s.level = 1;
        if (!(s.xp >= 0)) s.xp = 0;
        const isEl = (x: unknown): x is Element => (ELEMENTS as readonly unknown[]).includes(x);
        if (!isEl(s.kingdom)) s.kingdom = null;
        s.wardens = Array.isArray(s.wardens) ? [...new Set((s.wardens as unknown[]).filter(isEl))] : [];
        const guardIds = LANDMARKS.filter((l) => l.kind === 'guard').map((l) => `${l.el}:${l.n}`);
        s.guards = Array.isArray(s.guards) ? [...new Set((s.guards as unknown[]).filter((x): x is string => guardIds.includes(x as string)))] : [];
        if (!(Number.isInteger(s.malakor) && s.malakor >= 0)) s.malakor = 0;
        if (typeof s.gear !== 'object' || !s.gear) s.gear = { ...def.gear };
        fillMissing(s.gear, def.gear);
        const tier = (x: unknown) => (Number.isInteger(x) ? Math.min(GEAR_TOP, Math.max(0, x as number)) : 0);
        s.gear.weapon = tier(s.gear.weapon);
        s.gear.armor = tier(s.gear.armor);
        s.gear.bp = tier(s.gear.bp);
        if (!isEl(s.gear.infusion)) s.gear.infusion = null;
        // Relics: one per guardian beaten (older saves beat guardians before relics existed, so they get theirs).
        const relicIds = Array.isArray(s.gear.relics) ? (s.gear.relics as unknown[]).filter((x): x is string => typeof x === 'string' && guardIds.includes(x)) : [];
        s.gear.relics = [...new Set([...relicIds, ...s.guards])];
        if (!(typeof s.gear.relic === 'string' && s.gear.relics.includes(s.gear.relic))) s.gear.relic = null;
        s.sockets = Array.isArray(s.sockets) ? (s.sockets as unknown[]).filter((x): x is ItemId => typeof x === 'string' && x in ITEMS && /^gem[23]_/.test(x)).slice(0, 1 + s.gear.weapon) : [];
        if (typeof s.meters !== 'object' || !s.meters) s.meters = { ...def.meters };
        fillMissing(s.meters, def.meters);
        for (const k of ['hunger', 'thirst', 'rest'] as const) s.meters[k] = Number.isFinite(s.meters[k]) ? Math.min(100, Math.max(0, s.meters[k])) : 100;
        if (typeof s.explored !== 'string') s.explored = '';
        const towerIds = LANDMARKS.filter((l) => l.kind === 'tower').map((l) => l.id);
        s.towers = Array.isArray(s.towers) ? [...new Set((s.towers as unknown[]).filter((x): x is string => towerIds.includes(x as string)))] : [];
        if (typeof s.houses !== 'object' || !s.houses || Array.isArray(s.houses)) s.houses = {};
        s.hotbar = Array.from({ length: HOTBAR_SLOTS }, (_, n) => {
            const x = Array.isArray(s.hotbar) ? (s.hotbar as unknown[])[n] : null;
            return typeof x === 'string' && x in ITEMS ? (x as ItemId) : null;
        });
        if (!(Number.isInteger(s.held) && s.held >= 0 && s.held < HOTBAR_SLOTS)) s.held = 0;
        if (typeof s.durability !== 'object' || !s.durability || Array.isArray(s.durability)) s.durability = {};
        for (const k of TOOL_ITEMS) {
            const max = maxDurability(k, s.gear.weapon);
            const v = (s.durability as Record<string, unknown>)[k];
            s.durability[k] = typeof v === 'number' && v >= 0 ? Math.min(max, v) : max;
        }
        if (!(Number.isInteger(s.backpack) && s.backpack >= 0)) s.backpack = 0;
        s.backpack = Math.min(BACKPACK_TOP, s.backpack);
        s.talked = Array.isArray(s.talked) ? [...new Set((s.talked as unknown[]).filter((x): x is NpcId => typeof x === 'string' && x in NPCS))] : [];
        if (typeof s.story !== 'object' || !s.story) s.story = { ...def.story };
        fillMissing(s.story, def.story);
        if (!(Number.isInteger(s.story.step) && s.story.step >= 0)) s.story.step = 0;
        if (!(s.story.base >= 0)) s.story.base = 0;
        s.story.introSeen = s.story.introSeen === true;
        if (typeof s.chests !== 'object' || !s.chests || Array.isArray(s.chests)) s.chests = {};
        if (s.world.u >= MAP_TILES || s.world.v >= MAP_TILES) s.world = { ...def.world };
        if (!(s.hp >= 0)) s.hp = 1;
    },
});
