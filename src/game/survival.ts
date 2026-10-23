/**
 * The survival layer: what you gather, eat and craft, the gear you forge, the gems you fuse,
 * the camp you build up, the power cards you collect, and the Eidolon campaign's chapters
 * (the kingdoms themselves live in eidolon.ts).
 * Pure data and formulas (no store, no save import), so the save, the scene and the HUD
 * can all share them.
 *
 * Growth never stops: player level, camp buildings and cards have no cap; the numbers
 * just keep climbing with costs that rise faster than the rewards.
 */
import { KINGDOMS, NPCS, type Element, type NpcId } from './eidolon.ts';

// ---------------------------------------------------------------- items

const GEM_SKILLS = ['attack', 'defence', 'speed', 'vitality'] as const;
export type GemSkill = (typeof GEM_SKILLS)[number];

export type ItemId =
    | 'wood' | 'stone' | 'iron' | 'gold' | 'crystal' | 'berries' | 'herb' | 'fish' | 'leather' | 'horn'
    | 'meat' | 'cooked_meat' | 'water' | 'meal'
    | 'potion_red' | 'potion_blue' | 'potion_yellow' | 'potion_purple'
    | 'ess_fire' | 'ess_air' | 'ess_water' | 'ess_earth'
    | 'gem2_attack' | 'gem2_defence' | 'gem2_speed' | 'gem2_vitality'
    | 'gem3_attack' | 'gem3_defence' | 'gem3_speed' | 'gem3_vitality'
    | 'trap_spike' | 'barricade'
    | 'tool_sword' | 'tool_axe' | 'tool_pickaxe' | 'tool_fishingpole' | 'tool_shovel' | 'tool_hammer'
    | 'resin' | 'bark' | 'honey' | 'gale_blossom' | 'glowing_moss' | 'stalker_eye' | 'gland' | 'crystal_dust'
    | 'potion_night' | 'oil_fire' | 'oil_ice';

export interface ItemDef {
    name: string;
    /** Picture under public/images. */
    icon: string;
    blurb: string;
    /** Can be used from the bag (food, drink, potions). */
    usable?: boolean;
    /** Can be set down in the world (traps, barricades). */
    placeable?: boolean;
    /** Kept in full when you die (crafted goods); materials are partly lost. */
    keep?: boolean;
    /** A tool or weapon (held in the hotbar, wears out). */
    tool?: { holds: string; durability: number };
}

export const ITEMS: Record<ItemId, ItemDef> = {
    wood: { name: 'Timber', icon: 'items/wood.png', blurb: 'Chop trees with the axe' },
    stone: { name: 'Stone shards', icon: 'items/stone.png', blurb: 'Mine rocks with the pickaxe' },
    iron: { name: 'Iron ore', icon: 'items/iron.png', blurb: 'Sometimes found in rocks' },
    gold: { name: 'Gold ore', icon: 'items/gold.png', blurb: 'Rare, deep in rocks' },
    crystal: { name: 'Raw crystal', icon: 'items/crystal.png', blurb: 'Glows in mountain rocks and chests' },
    berries: { name: 'Berries', icon: 'items/berries.png', blurb: 'A little food. Pick from bushes', usable: true },
    herb: { name: 'Red herb', icon: 'items/herb.png', blurb: 'Gather wildflowers by hand' },
    fish: { name: 'Raw fish', icon: 'items/fish.png', blurb: 'Fish at the water with the pole' },
    leather: { name: 'Leather', icon: 'items/leather.png', blurb: 'Dropped by wolves and goblins' },
    horn: { name: 'Bone & horn', icon: 'items/horn.png', blurb: 'Dropped by skeletons and scorpions' },
    meat: { name: 'Raw meat', icon: 'items/meat.png', blurb: 'Cook it at a fire. Eaten raw it may make you sick', usable: true },
    cooked_meat: { name: 'Roast meat', icon: 'items/cooked_meat.png', blurb: 'Fills you up and heals a little', usable: true, keep: true },
    water: { name: 'Water flask', icon: 'items/water.png', blurb: 'Quenches thirst. Fill at any clean water', usable: true, keep: true },
    meal: { name: 'Grilled fish', icon: 'items/meal.png', blurb: 'Fills you up and heals a lot', usable: true, keep: true },
    potion_red: { name: 'Extract of Vitality', icon: 'potions/red.png', blurb: 'Restores health at once', usable: true, keep: true },
    potion_blue: { name: 'Might tonic', icon: 'potions/blue.png', blurb: 'Attack x1.5 for a while', usable: true, keep: true },
    potion_yellow: { name: 'Stamina Tonic', icon: 'potions/yellow.png', blurb: 'Refills stamina; everything costs less of it for a while', usable: true, keep: true },
    potion_purple: { name: 'Ward elixir', icon: 'potions/purple.png', blurb: 'Blocks every bite for a while', usable: true, keep: true },
    ess_fire: { name: 'Fire blossom', icon: 'items/ess_fire.png', blurb: 'Raw fire essence, found in Pyraxis' },
    ess_air: { name: 'Storm feather', icon: 'items/ess_air.png', blurb: 'Raw air essence, found in Zephyria' },
    ess_water: { name: 'Tide droplet', icon: 'items/ess_water.png', blurb: 'Raw water essence, found in Aquatica' },
    ess_earth: { name: 'Earth core', icon: 'items/ess_earth.png', blurb: 'Raw earth essence, found in Terragrim' },
    gem2_attack: { name: 'Polished ruby', icon: 'items/gem2_attack.png', blurb: 'Socket: +10% damage', keep: true },
    gem2_defence: { name: 'Polished lapis', icon: 'items/gem2_defence.png', blurb: 'Socket: +6% block', keep: true },
    gem2_speed: { name: 'Polished emerald', icon: 'items/gem2_speed.png', blurb: 'Socket: +6% speed', keep: true },
    gem2_vitality: { name: 'Polished amber', icon: 'items/gem2_vitality.png', blurb: 'Socket: +2 max health', keep: true },
    gem3_attack: { name: 'Infernal Core', icon: 'items/gem3_attack.png', blurb: 'Socket: +20% damage, every 5th hit explodes', keep: true },
    gem3_defence: { name: 'Aegis Core', icon: 'items/gem3_defence.png', blurb: 'Socket: +15% block, bites hurt the biter', keep: true },
    gem3_speed: { name: 'Gale Core', icon: 'items/gem3_speed.png', blurb: 'Socket: +15% speed, dodges cost 40% less', keep: true },
    gem3_vitality: { name: 'Life Core', icon: 'items/gem3_vitality.png', blurb: 'Socket: +5 max health, steady healing', keep: true },
    trap_spike: { name: 'Spike trap', icon: 'items/trap_spike.png', blurb: 'Set it down: it bites monsters that step on it', placeable: true, keep: true },
    barricade: { name: 'Thorn barricade', icon: 'items/barricade.png', blurb: 'Set it down: it wounds and throws back what touches it', placeable: true, keep: true },
    tool_sword: { name: 'Weapon', icon: 'hud/sword.png', blurb: 'Your blade (its tier is forged at the Gear tab)', keep: true, tool: { holds: 'sword', durability: 80 } },
    tool_axe: { name: 'Axe', icon: 'hud/axe.png', blurb: 'Chops trees for timber, resin and bark', keep: true, tool: { holds: 'axe', durability: 150 } },
    tool_pickaxe: { name: 'Pickaxe', icon: 'hud/pickaxe.png', blurb: 'Mines rocks for stone, ore and crystal', keep: true, tool: { holds: 'pickaxe', durability: 150 } },
    tool_fishingpole: { name: 'Fishing pole', icon: 'hud/fishingpole.png', blurb: 'Catches fish at clean water', keep: true, tool: { holds: 'fishingpole', durability: 100 } },
    tool_shovel: { name: 'Shovel', icon: 'hud/shovel.png', blurb: 'Digs up herbs and berries faster (two at a time)', keep: true, tool: { holds: 'shovel', durability: 120 } },
    tool_hammer: { name: 'War hammer', icon: 'hud/hammer.png', blurb: 'Hits as hard as a club, never as fine as a blade', keep: true, tool: { holds: 'hammer', durability: 140 } },
    resin: { name: 'Resin', icon: 'items/resin.png', blurb: 'Sticky sap from trees: binds traps and barricades' },
    bark: { name: 'Bark', icon: 'items/bark.png', blurb: 'Tough strips from trees: patches armour and backpacks' },
    honey: { name: 'Honey', icon: 'items/honey.png', blurb: 'Wild honeycomb from berry bushes. Sweet, and goes in tonics', usable: true },
    gale_blossom: { name: 'Gale blossom', icon: 'items/gale_blossom.png', blurb: 'A flower that hums in the wind. Common in Zephyria' },
    glowing_moss: { name: 'Glowing moss', icon: 'items/glowing_moss.png', blurb: 'Grows on rocks, and shows itself at night' },
    stalker_eye: { name: 'Night-stalker eye', icon: 'items/stalker_eye.png', blurb: 'Taken from monsters that hunt in the dark' },
    gland: { name: 'Monster gland', icon: 'items/gland.png', blurb: 'From fallen monsters: the base of coating oils' },
    crystal_dust: { name: 'Crystal dust', icon: 'items/crystal_dust.png', blurb: 'Ground raw crystal (Craft)' },
    potion_night: { name: 'Night-Vision Elixir', icon: 'items/potion_night.png', blurb: 'See far in the dark for a while', usable: true, keep: true },
    oil_fire: { name: 'Fire coating oil', icon: 'items/oil_fire.png', blurb: 'Your hits burn for a minute', usable: true, keep: true },
    oil_ice: { name: 'Frost coating oil', icon: 'items/oil_ice.png', blurb: 'Your hits may freeze monsters for a minute', usable: true, keep: true },
};
/** Item kinds that are tools, and which tool the character holds for each. */
export const TOOL_ITEMS = (Object.keys(ITEMS) as ItemId[]).filter((k) => ITEMS[k].tool);
export const toolItemOf = (holds: string): ItemId | null => TOOL_ITEMS.find((k) => ITEMS[k].tool!.holds === holds) ?? null;

/** How many of an item share one backpack slot. */
export function stackOf(id: ItemId): number {
    const d = ITEMS[id];
    if (d.tool) return 1;
    if (d.placeable) return 5;
    if (d.usable || id.startsWith('gem')) return 10;
    if (id.startsWith('ess_')) return 20;
    return 50;
}
/** The backpack: 20 slots, 5 more per upgrade. */
export const BACKPACK_BASE = 20;
export const BACKPACK_STEP = 5;
export const BACKPACK_TOP = 8;
export const backpackCost = (level: number): Partial<Record<ItemId, number>> => ({ leather: 3 + 2 * level, bark: 4 + 3 * level, resin: 2 + level, ...(level >= 3 ? { iron: level } : {}) });
/**
 * Backpack slots in use: every stack of up to stackOf(item) takes one slot. What sits in the
 * hotbar rides in your hands, so one stack of each hotbar item is free.
 */
export function slotsUsed(bag: Record<string, number>, hotbar: (string | null)[]): number {
    let used = 0;
    for (const k of Object.keys(bag) as ItemId[]) {
        const n = bag[k];
        if (!(n > 0) || !(k in ITEMS)) continue;
        const stacks = Math.ceil(n / stackOf(k));
        used += Math.max(0, stacks - (hotbar.includes(k) ? 1 : 0));
    }
    return used;
}
export const backpackSlots = (level: number): number => BACKPACK_BASE + BACKPACK_STEP * level;
/** How many more of an item fit (room in its last stack plus free slots). */
export function roomFor(bag: Record<string, number>, hotbar: (string | null)[], level: number, id: ItemId): number {
    const stack = stackOf(id);
    const have = bag[id] ?? 0;
    const free = Math.max(0, backpackSlots(level) - slotsUsed(bag, hotbar));
    const partial = have > 0 ? (stack - (have % stack)) % stack : 0;
    return partial + free * stack;
}
/** The hotbar holds four things (tools, weapons or consumables), bound to keys 1-4. */
export const HOTBAR_SLOTS = 4;
/** Most durability a tool has (the weapon's grows with its tier). */
export const maxDurability = (id: ItemId, weaponTier = 0): number => (id === 'tool_sword' ? [80, 140, 220, 340][weaponTier] ?? 340 : ITEMS[id].tool?.durability ?? 0);
/** What mending a tool costs (a workbench in camp or a house). */
export const repairCost = (id: ItemId, weaponTier = 0): Partial<Record<ItemId, number>> =>
    id === 'tool_sword' ? { wood: 2 + weaponTier, iron: 1 + weaponTier, resin: 1 } : { wood: 3, iron: 1 };
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export type Bag = Record<ItemId, number>;
export const emptyBag = (): Bag => Object.fromEntries(ITEM_IDS.map((k) => [k, 0])) as Bag;
/** Most of one item you can hold. */
export const STACK_CAP = 999;
export const essenceOf = (e: Element): ItemId => `ess_${e}` as ItemId;

/** What eating or drinking does: hunger, thirst, health, and a chance to feel sick (raw meat). */
export const FOOD: Partial<Record<ItemId, { hunger: number; thirst: number; heal: number; sick?: number }>> = {
    berries: { hunger: 8, thirst: 4, heal: 1 },
    meat: { hunger: 15, thirst: 0, heal: 0, sick: 0.5 },
    cooked_meat: { hunger: 40, thirst: 0, heal: 2 },
    meal: { hunger: 35, thirst: 5, heal: 6 },
    water: { hunger: 0, thirst: 40, heal: 0 },
    potion_red: { hunger: 0, thirst: 10, heal: 4 },
    honey: { hunger: 6, thirst: 0, heal: 1 },
};

// ---------------------------------------------------------------- recipes

export interface Recipe {
    out: ItemId;
    n: number;
    cost: Partial<Bag>;
    /** Alchemy tent level needed (0 = none). */
    alchemy: number;
    /** Needs a lit fire: a liberated camp out of the rain, or a house's hearth. */
    fire?: boolean;
    /** Where it is made: the alchemy tent (in a liberated camp), a fire, or a workbench (camp or a house). */
    at: Station;
}
export type Station = 'alchemy' | 'fire' | 'bench';
/** Where each station is, in words (for the Craft tab and the objective). */
export const STATION_NAME: Record<Station, string> = { alchemy: 'the Alchemy tent in camp', fire: 'a lit fire', bench: 'a workbench (camp or a house)' };
export const RECIPES: Recipe[] = [
    { out: 'cooked_meat', n: 1, cost: { meat: 1, wood: 1 }, alchemy: 0, fire: true, at: 'fire' },
    { out: 'meal', n: 1, cost: { fish: 2, wood: 1 }, alchemy: 0, fire: true, at: 'fire' },
    { out: 'potion_red', n: 1, cost: { herb: 2, water: 1 }, alchemy: 1, at: 'alchemy' },
    { out: 'potion_yellow', n: 1, cost: { gale_blossom: 2, honey: 1 }, alchemy: 1, at: 'alchemy' },
    { out: 'crystal_dust', n: 3, cost: { crystal: 1 }, alchemy: 0, at: 'alchemy' },
    { out: 'potion_night', n: 1, cost: { glowing_moss: 2, stalker_eye: 1 }, alchemy: 2, at: 'alchemy' },
    { out: 'oil_fire', n: 1, cost: { crystal_dust: 2, gland: 1, ess_fire: 1 }, alchemy: 2, at: 'alchemy' },
    { out: 'oil_ice', n: 1, cost: { crystal_dust: 2, gland: 1, ess_water: 1 }, alchemy: 2, at: 'alchemy' },
    { out: 'trap_spike', n: 1, cost: { wood: 4, iron: 1, resin: 1 }, alchemy: 0, at: 'bench' },
    { out: 'barricade', n: 1, cost: { wood: 6, stone: 3, resin: 1 }, alchemy: 0, at: 'bench' },
    { out: 'potion_blue', n: 1, cost: { herb: 3, horn: 1, iron: 1 }, alchemy: 3, at: 'alchemy' },
    { out: 'potion_purple', n: 1, cost: { herb: 4, crystal: 1, horn: 2 }, alchemy: 4, at: 'alchemy' },
    { out: 'tool_shovel', n: 1, cost: { wood: 4, iron: 1 }, alchemy: 0, at: 'bench' },
    { out: 'tool_hammer', n: 1, cost: { wood: 3, iron: 3 }, alchemy: 0, at: 'bench' },
    { out: 'tool_fishingpole', n: 1, cost: { wood: 3, leather: 1 }, alchemy: 0, at: 'bench' },
    { out: 'tool_axe', n: 1, cost: { wood: 3, stone: 2 }, alchemy: 0, at: 'bench' },
    { out: 'tool_pickaxe', n: 1, cost: { wood: 3, stone: 3 }, alchemy: 0, at: 'bench' },
];

// ---------------------------------------------------------------- gear

export const WEAPONS = [
    { name: 'Rust-Eaten Dagger', mul: 0.7 },
    { name: 'Bone Club', mul: 1 },
    { name: 'Iron Blade', mul: 1.5 },
    { name: 'Mythic Alloy Sword', mul: 2.2 },
];
export const ARMORS = [
    { name: 'Cloth Rags', guard: 0 },
    { name: 'Hide Vest', guard: 0.15 },
    { name: 'Iron Mail', guard: 0.3 },
    { name: 'Mythic Plate', guard: 0.45 },
];
export const GEAR_TOP = 3;
/** Forge level each gear tier needs, and its blueprint (tier 1's comes from Varis). */
export const GEAR_FORGE = [0, 0, 2, 4];
export function gearCost(kind: 'weapon' | 'armor', tier: number): Partial<Bag> {
    if (kind === 'weapon') return [{}, { wood: 8, stone: 3, leather: 1 }, { iron: 8, wood: 4, leather: 2 }, { iron: 12, gold: 4, crystal: 6 }][tier] ?? {};
    return [{}, { leather: 4, wood: 3 }, { iron: 10, leather: 4 }, { iron: 14, gold: 5, crystal: 4 }][tier] ?? {};
}
/** Infusing the weapon with an element: essence of that element and some crystal. */
export const infuseCost = (e: Element): Partial<Bag> => ({ [essenceOf(e)]: 5, crystal: 2 });
export const INFUSION: Record<Element, string> = {
    fire: 'Hits burn the ground in front of you',
    air: 'Hits sometimes chain lightning to a nearby monster',
    water: 'Hits sometimes heal you',
    earth: 'Every 4th hit sends out a shockwave',
};
/** Gem sockets on the weapon: one, plus one per tier. */
export const socketsFor = (weaponTier: number): number => 1 + weaponTier;
export const GEM_SKILL_LIST = GEM_SKILLS;
export const gem2Of = (g: GemSkill): ItemId => `gem2_${g}` as ItemId;
export const gem3Of = (g: GemSkill): ItemId => `gem3_${g}` as ItemId;
/** Fusing: three raw gems make a polished one; three polished make a core. */
export const FUSE_N = 3;

// ---------------------------------------------------------------- relics (guardian loot)

/**
 * Relic weapons: each of the twelve guardians carries one, found nowhere else. Held, a relic
 * replaces the forged weapon's damage with its own (stronger the deeper into the campaign its
 * kingdom lies) and brings its kingdom's element, and shows its own blade.
 */
export interface Relic {
    /** Same as the guardian's id ('fire:1'). */
    id: string;
    el: Element;
    n: number;
    name: string;
    /** Its blade (a sword picture, 0-29). */
    sword: number;
    blurb: string;
}
export const RELICS: Relic[] = [
    { id: 'fire:1', el: 'fire', n: 1, name: 'Emberfang', sword: 0, blurb: 'Still hot from the Cinder Brute\'s forge' },
    { id: 'fire:2', el: 'fire', n: 2, name: 'Magma Talon', sword: 16, blurb: 'Cooled lava, sharp as obsidian' },
    { id: 'fire:3', el: 'fire', n: 3, name: 'Sunforge Blade', sword: 4, blurb: 'Hammered in the heart of the volcano' },
    { id: 'air:1', el: 'air', n: 1, name: 'Galefeather', sword: 14, blurb: 'Weighs nothing, cuts like a storm' },
    { id: 'air:2', el: 'air', n: 2, name: 'Skywing Saber', sword: 19, blurb: 'Feathers of the highest isle' },
    { id: 'air:3', el: 'air', n: 3, name: 'Stormcaller', sword: 12, blurb: 'Lightning sleeps in its edge' },
    { id: 'water:1', el: 'water', n: 1, name: 'Tidecutter', sword: 8, blurb: 'Drips with seawater that never dries' },
    { id: 'water:2', el: 'water', n: 2, name: 'Frostbrand', sword: 1, blurb: 'Ice from the deepest trench' },
    { id: 'water:3', el: 'water', n: 3, name: 'Abyssal Crescent', sword: 5, blurb: 'Shaped like the moon over drowned cities' },
    { id: 'earth:1', el: 'earth', n: 1, name: 'Mossgrip Cleaver', sword: 17, blurb: 'Roots still cling to the hilt' },
    { id: 'earth:2', el: 'earth', n: 2, name: 'Rootwarden', sword: 2, blurb: 'A living branch, harder than iron' },
    { id: 'earth:3', el: 'earth', n: 3, name: 'Thornbloom', sword: 25, blurb: 'Flowers in the blood of its foes' },
];
export const relicOf = (id: string | null | undefined): Relic | null => RELICS.find((r) => r.id === id) ?? null;
/** A relic's damage multiplier: its kingdom's place in your campaign (0 = home .. 3) and which guardian held it. */
export const relicMul = (tier: number, n: number): number => Math.round((1.25 + 0.3 * tier + 0.08 * (n - 1)) * 100) / 100;
/** Rare potions a guardian may carry (two of them fall). */
export const RARE_POTIONS: ItemId[] = ['potion_purple', 'potion_blue', 'potion_night', 'oil_fire', 'oil_ice'];

// ---------------------------------------------------------------- camp buildings

export type BuildingId = 'healer' | 'forge' | 'alchemy' | 'totem' | 'store';
export interface BuildingDef {
    name: string;
    /** Tent art under public/images/world/camp. */
    art: string;
    /** Offset from the camp centre, in tiles. */
    at: [number, number];
    blurb: (level: number) => string;
}
export const BUILDINGS: Record<BuildingId, BuildingDef> = {
    healer: { name: "Healer's tent", art: 'tent_cream', at: [-3, 3], blurb: (l) => (l === 0 ? 'Build it to heal over time and rest' : `Heal 1 every ${regenEvery(l).toFixed(1)}s (x3 by a lit fire)`) },
    forge: { name: 'Forge', art: 'tent_red', at: [3, -3], blurb: (l) => `Weapon damage +${l * 12}% · gear tier ${l >= 4 ? 3 : l >= 2 ? 2 : 1} unlocked` },
    alchemy: { name: 'Alchemy tent', art: 'tent_blue', at: [-3, -3], blurb: (l) => `Unlocks potions (${Math.min(l, 4)}/4 recipes) · potions +${l * 15}% stronger` },
    totem: { name: 'Arcane totem', art: 'tent_green', at: [3, 3], blurb: (l) => `${cardSlots(l)} card slots · cards +${l * 5}% stronger · ${l > 0 ? 'gem fusing open' : 'fuses gems once built'}` },
    store: { name: 'Storehouse', art: 'tent_yellow', at: [0, -5], blurb: (l) => `Keep ${Math.round(keepShare(l) * 100)}% of materials and ${Math.round(gemKeep(l) * 100)}% of gems when you fall` },
};
export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];
export type Buildings = Record<BuildingId, number>;
export const emptyBuildings = (): Buildings => ({ healer: 0, forge: 0, alchemy: 0, totem: 0, store: 0 });

/** Seconds per point of healing from the healer's tent (level 0: none). */
export const regenEvery = (level: number): number => (level <= 0 ? Infinity : 14 / (1 + 0.35 * (level - 1)));
export const cardSlots = (totem: number): number => Math.min(6, 1 + Math.floor((totem + 1) / 2));
export const keepShare = (store: number): number => Math.min(0.9, 0.25 + 0.1 * store);
export const gemKeep = (store: number): number => Math.min(0.75, 0.08 * store);

/** What the next level of a building costs. Climbs ~45% a level, and asks for rarer stuff as it goes. */
export function buildCost(level: number): Partial<Bag> {
    const g = Math.pow(1.45, level);
    const c: Partial<Bag> = { wood: Math.round(6 * g), stone: Math.round(4 * g) };
    if (level >= 2) c.iron = Math.round(2 * Math.pow(1.4, level - 2));
    if (level >= 4) c.gold = Math.round(1 * Math.pow(1.35, level - 4));
    if (level >= 6) c.crystal = Math.round(1 * Math.pow(1.3, level - 6));
    return c;
}
/** Tiles from a camp centre that count as "in camp" (building, faster healing, the fire). */
export const CAMP_RADIUS = 8;

// ---------------------------------------------------------------- survival meters

/** Hunger, thirst and rest run from 100 down to 0. Seconds per point lost. */
export const METER_DRAIN = { hunger: 12, thirst: 8, rest: 14 };
export const STAMINA_MAX = 100;
export const STAMINA_COST = { swing: 7, gather: 5, dodge: 25, sprint: 18 };
/** The dodge roll: anticipation, the tumble (when you cannot be hurt), and the recovery skid (ms). */
export const DODGE_MS = { windup: 90, tumble: 350, recover: 150 };
/** Critical hits: chance and multiplier. */
export const CRIT = { chance: 0.1, mul: 1.5 };
/** At night only a torch's circle of light is clear (design units); wider by a fire or with a Night-Vision Elixir. */
export const TORCH_R = { base: 120, fire: 200, elixir: 260 };
/** Sprinting speed, and the combat meter that charges a kingdom's active skill. */
export const SPRINT_MUL = 1.55;
export const METER_MAX = 100;
export const METER_GAIN = { hit: 5, kill: 12, hurt: 6 };

// ---------------------------------------------------------------- cards

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITY_COLOR: Record<Rarity, string> = { common: '#9ca3af', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b' };
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 28, epic: 10, legendary: 2 };

export type CardId =
    | 'ember' | 'stoneskin' | 'tailwind' | 'troll' | 'vampire' | 'gatherer'
    | 'giant' | 'storm' | 'owl' | 'thorns' | 'alchemist' | 'phoenix';

export interface CardDef {
    name: string;
    rarity: Rarity;
    glyph: string;
    /** The power at a card level (1+). */
    power: (level: number) => string;
}
/** Card strength: grows with level, and the totem multiplies it. */
export const cardScale = (level: number, totem: number): number => (level <= 0 ? 0 : (1 + 0.5 * (level - 1)) * (1 + 0.05 * totem));
export const CARDS: Record<CardId, CardDef> = {
    ember: { name: 'Ember Fang', rarity: 'common', glyph: '🔥', power: (l) => `+${pct(0.1 * cardScale(l, 0))} damage` },
    stoneskin: { name: 'Stoneskin', rarity: 'common', glyph: '🪨', power: (l) => `+${pct(0.06 * cardScale(l, 0))} chance to block a bite` },
    tailwind: { name: 'Tailwind', rarity: 'common', glyph: '🍃', power: (l) => `+${pct(0.08 * cardScale(l, 0))} move speed` },
    gatherer: { name: 'Gatherer', rarity: 'common', glyph: '🧺', power: (l) => `${pct(Math.min(1, 0.25 * cardScale(l, 0)))} chance of extra materials` },
    troll: { name: 'Troll Blood', rarity: 'rare', glyph: '🧪', power: (l) => `Heal 1 every ${(10 / cardScale(l, 0)).toFixed(1)}s` },
    giant: { name: "Giant's Heart", rarity: 'rare', glyph: '❤️', power: (l) => `+${Math.round(2 * cardScale(l, 0))} max health` },
    owl: { name: 'Wise Owl', rarity: 'rare', glyph: '🦉', power: (l) => `+${pct(0.2 * cardScale(l, 0))} XP` },
    thorns: { name: 'Thorns', rarity: 'rare', glyph: '🌵', power: (l) => `Bites hurt the biter for ${Math.round(2 * cardScale(l, 0))}` },
    vampire: { name: 'Vampire Kiss', rarity: 'epic', glyph: '🦇', power: (l) => `${pct(Math.min(0.8, 0.15 * cardScale(l, 0)))} chance to heal 1 on a kill` },
    storm: { name: 'Storm Caller', rarity: 'epic', glyph: '⚡', power: (l) => `Every ${stormEvery(l)}th swing calls lightning` },
    alchemist: { name: "Alchemist's Ring", rarity: 'epic', glyph: '💍', power: (l) => `Potions and food +${pct(0.4 * cardScale(l, 0))} stronger` },
    phoenix: { name: 'Phoenix Feather', rarity: 'legendary', glyph: '🪶', power: (l) => `Once per run, rise again with ${pct(Math.min(1, 0.4 + 0.1 * l))} health` },
};
export const CARD_IDS = Object.keys(CARDS) as CardId[];
export const stormEvery = (level: number): number => Math.max(3, 7 - level);
const pct = (x: number) => `${Math.round(x * 100)}%`;
/** Copies of a card needed to go from `level` to the next (the first copy gives level 1). */
export const cardLevelCost = (level: number): number => level + 1;

/** Pick a random card, weighted by rarity; `luck` (0..1) tilts toward rarer ones. */
export function rollCard(rand: () => number, luck = 0): CardId {
    const w = (id: CardId) => {
        const r = CARDS[id].rarity;
        return RARITY_WEIGHT[r] * (r === 'common' ? 1 - luck * 0.5 : 1 + luck);
    };
    const total = CARD_IDS.reduce((s, id) => s + w(id), 0);
    let x = rand() * total;
    for (const id of CARD_IDS) {
        x -= w(id);
        if (x <= 0) return id;
    }
    return 'ember';
}

// ---------------------------------------------------------------- player level

/** XP from level `level` to the next. No cap. */
export const xpToNext = (level: number): number => Math.round(25 * Math.pow(1.16, level - 1) + 12 * level);
/** Max health from the player level: +1 every 3 levels. */
export const levelHp = (level: number): number => Math.floor((level - 1) / 3);
/** Damage from the player level: +3% a level. */
export const levelDamage = (level: number): number => 0.03 * (level - 1);

// ---------------------------------------------------------------- stats used by the story

export type StatId = 'kills' | 'wood' | 'stone' | 'iron' | 'berries' | 'herb' | 'fish' | 'meat' | 'crafted' | 'potions' | 'chests' | 'cooked' | 'essence';
export type Stats = Record<StatId, number>;
export const emptyStats = (): Stats => ({ kills: 0, wood: 0, stone: 0, iron: 0, berries: 0, herb: 0, fish: 0, meat: 0, crafted: 0, potions: 0, chests: 0, cooked: 0, essence: 0 });

// ---------------------------------------------------------------- the campaign

export type Goal =
    | { kind: 'stat'; stat: StatId; n: number }
    | { kind: 'build'; building: BuildingId | 'any'; level: number }
    | { kind: 'wave'; n: number }
    | { kind: 'equip' }
    | { kind: 'level'; n: number }
    | { kind: 'gear'; n: number }
    | { kind: 'towers'; n: number }
    | { kind: 'guards'; n: number }
    | { kind: 'wardens'; n: number }
    | { kind: 'malakor'; n: number }
    | { kind: 'talk'; npc: NpcId };

export interface Chapter {
    title: string;
    /** What the objective line says. */
    task: string;
    goal: Goal;
    /** Told by Elder Theron when the chapter starts. */
    say: string[];
    reward: { xp: number; items?: Partial<Bag>; card?: boolean };
}

/**
 * The chapters. In the text, {K1}..{K4} are the kingdoms in the order this player meets them
 * (home first), {W1}..{W4} their wardens.
 */
const CHAPTER_TEXT: Chapter[] = [
    { title: 'Awakening', task: 'Defeat 5 monsters', goal: { kind: 'stat', stat: 'kills', n: 5 }, say: ['The hordes come in waves, one after another, and they never stop out there. Show me you can hold even that rusty dagger. The camp is safe ground: come back here to breathe.'], reward: { xp: 30, items: { potion_red: 1 } } },
    { title: 'The Smith', task: 'Talk to Varis at the forge (press Use beside him)', goal: { kind: 'talk', npc: 'varis' }, say: ['Varis keeps the forge. He has a blueprint for you, if you can stand his grumbling.'], reward: { xp: 20 } },
    { title: 'Timber', task: 'Chop 6 timber (Use at a tree)', goal: { kind: 'stat', stat: 'wood', n: 6 }, say: ['Trees give timber. Take the axe to them. Hold Use near one and the axe comes to hand.'], reward: { xp: 30 } },
    { title: 'Stone Shards', task: 'Mine 6 stone (Use at a rock)', goal: { kind: 'stat', stat: 'stone', n: 6 }, say: ['Rocks give stone, and sometimes iron, gold or crystal.'], reward: { xp: 30 } },
    { title: 'Steel Remembers', task: 'Forge the Bone Club at the Forge in camp', goal: { kind: 'gear', n: 1 }, say: ["Varis's blueprint, your materials. A real weapon at last."], reward: { xp: 50, items: { leather: 2 } } },
    { title: 'Shelter', task: "Build the Healer's tent in camp (Use at its plot)", goal: { kind: 'build', building: 'healer', level: 1 }, say: ['A healer\'s tent. Rest there, and your wounds close by themselves.'], reward: { xp: 40, items: { berries: 3 } } },
    { title: 'A Full Belly', task: 'Cook meat at the camp fire and eat it', goal: { kind: 'stat', stat: 'cooked', n: 1 }, say: ['Hunger and thirst will kill you as surely as any beast. Wolves and goblins carry meat. Cook it at the fire (Bag › Craft) before you eat it.'], reward: { xp: 30, items: { water: 2 } } },
    { title: 'The Herbalist', task: 'Talk to Lyra in camp', goal: { kind: 'talk', npc: 'lyra' }, say: ['Lyra knows every leaf in the four kingdoms. Listen to her.'], reward: { xp: 20 } },
    { title: 'Brew', task: 'Brew a Healing draught at the Alchemy tent in camp', goal: { kind: 'stat', stat: 'potions', n: 1 }, say: ['Draughts are brewed at the Alchemy tent, here in camp, nowhere else. Build it (stand by its plot and press Use), bring red herbs and water, then brew.'], reward: { xp: 50, card: true } },
    { title: 'Eyes on the Horizon', task: 'Climb a watchtower', goal: { kind: 'towers', n: 1 }, say: ["Malakor's fog hides the land. Climb an old watchtower and you will see what lies around it on your map."], reward: { xp: 50 } },
    { title: 'The Guardians', task: 'Defeat the three guardians of {K1}', goal: { kind: 'guards', n: 3 }, say: ['Three corrupted guardians watch over {K1}. They were our neighbours once. Free them.'], reward: { xp: 120, card: true } },
    { title: 'The First Seal', task: 'Defeat {W1} at the arena of {K1}', goal: { kind: 'wardens', n: 1 }, say: ['{W1} holds the seal to {K2}. Go to the arena at the far edge of {K1} and press Use at the seal.'], reward: { xp: 200, items: { potion_red: 2 } } },
    { title: 'Across the Border', task: 'Defeat the three guardians of {K2}', goal: { kind: 'guards', n: 6 }, say: ['The barrier to {K2} is broken. Its people have been taught to hate us. Show them otherwise.'], reward: { xp: 180, card: true } },
    { title: 'The Second Seal', task: 'Defeat {W2}', goal: { kind: 'wardens', n: 2 }, say: ['{W2} rules {K2} now. Break the seal and {K3} opens.'], reward: { xp: 260 } },
    { title: 'Iron Age', task: 'Forge the Iron Blade (needs Forge level 2)', goal: { kind: 'gear', n: 2 }, say: ['Brittle steel will not carry you further. Varis can make an Iron Blade with the blueprint you won.'], reward: { xp: 150, items: { gold: 2 } } },
    { title: 'The Third Land', task: 'Defeat the three guardians of {K3}', goal: { kind: 'guards', n: 9 }, say: ['{K3} lies open. Its guardians are the strongest yet.'], reward: { xp: 240, card: true } },
    { title: 'The Third Seal', task: 'Defeat {W3}', goal: { kind: 'wardens', n: 3 }, say: ['{W3} holds the seal to {K4}, the last of the kingdoms.'], reward: { xp: 320, items: { potion_purple: 1 } } },
    { title: 'The Last Land', task: 'Defeat the three guardians of {K4}', goal: { kind: 'guards', n: 12 }, say: ['One kingdom left. Then only the Citadel stands between us and peace.'], reward: { xp: 300, card: true } },
    { title: 'The Last Seal', task: 'Defeat {W4}', goal: { kind: 'wardens', n: 4 }, say: ['When {W4} falls, the mists around the Void Citadel part.'], reward: { xp: 400, card: true } },
    { title: 'The Void Citadel', task: 'Defeat Malakor at the centre of the world', goal: { kind: 'malakor', n: 1 }, say: ['All four lands stand behind you. Go to the Citadel at the heart of Eidolon and end Malakor. He will twist what you have learned against you. Do not let him.'], reward: { xp: 800, card: true } },
];
export const CHAPTER_COUNT = CHAPTER_TEXT.length;

/** After the campaign: endless Echo objectives that keep scaling, with Malakor reforming now and then. */
export function echoChapter(n: number): Chapter {
    const t = n % 7;
    const k = Math.floor(n / 7) + 1;
    const xp = Math.round(150 * Math.pow(1.25, n));
    const base = { reward: { xp, card: n % 2 === 1 }, say: [] as string[] };
    switch (t) {
        case 0: return { ...base, title: `Echo ${n + 1}: Slayer`, task: `Defeat ${30 + 20 * k} monsters`, goal: { kind: 'stat', stat: 'kills', n: 30 + 20 * k } };
        case 1: return { ...base, title: `Echo ${n + 1}: Lumber`, task: `Chop ${20 + 15 * k} timber`, goal: { kind: 'stat', stat: 'wood', n: 20 + 15 * k } };
        case 2: return { ...base, title: `Echo ${n + 1}: Deep Mine`, task: `Mine ${4 + 3 * k} iron ore`, goal: { kind: 'stat', stat: 'iron', n: 4 + 3 * k } };
        case 3: return { ...base, title: `Echo ${n + 1}: Endure`, task: `Reach wave ${12 + 3 * k}`, goal: { kind: 'wave', n: 12 + 3 * k } };
        case 4: return { ...base, title: `Echo ${n + 1}: Builder`, task: `Raise any building to level ${3 + 2 * k}`, goal: { kind: 'build', building: 'any', level: 3 + 2 * k } };
        case 5: return { ...base, title: `Echo ${n + 1}: Essence`, task: `Gather ${6 + 4 * k} elemental essences`, goal: { kind: 'stat', stat: 'essence', n: 6 + 4 * k } };
        default: return { ...base, title: `Echo ${n + 1}: Malakor Reforms`, task: 'Defeat Malakor again at the Citadel', goal: { kind: 'malakor', n: 1 + k }, say: ['The dark gathers again at the Citadel. Malakor reforms, stronger than before.'] };
    }
}

/** The chapter at `step`, with this player's kingdoms filled into the text. */
export function chapterAt(step: number, order: Element[] | null): Chapter {
    const ch = step < CHAPTER_TEXT.length ? CHAPTER_TEXT[step] : echoChapter(step - CHAPTER_TEXT.length);
    if (!order) return ch;
    const fill = (s: string) => s.replace(/\{([KW])([1-4])\}/g, (_, t: string, n: string) => {
        const k = KINGDOMS[order[Number(n) - 1]];
        return t === 'K' ? k.name : k.warden.name;
    });
    return { ...ch, title: fill(ch.title), task: fill(ch.task), say: ch.say.map(fill) };
}
export const npcName = (id: NpcId): string => NPCS[id].name;
