/**
 * The game's side of saving: scenes report where the player is, and this keeps the
 * save (src/saveConfig.ts) current and the HUD's play-time clock in step. Writes are
 * cheap — the save system batches them and flushes at most every few seconds, plus
 * when the app is backgrounded.
 *
 * It also owns the survival rules that touch the save: the bag, crafting, gear and gems,
 * the camp, cards, XP, the meters, the kingdoms and their bosses, and the story.
 */
import type { Skill } from '../shared/sim.ts';
import { saveSystem } from '../saveConfig.ts';
import { sfx } from './audio.ts';
import { store } from '../state/store.ts';
import { GEM_CAP, SKILL_CAP, upgradeCost } from './skills.ts';
import { HOTBAR, type Tool } from './world/character.ts';
import { CARRY_MAX, COOLDOWN_MAX, defaultSpellSave, levelCost, SPELLS, UNLOCK_COST, type SpellSave } from './world/spells.ts';
import { WORLD_TILES } from './world/constants.ts';
import {
    ARMORS, buildCost, BUILDINGS, cardScale, cardSlots, CARDS, chapterAt, CHAPTER_COUNT, emptyBag, emptyBuildings, emptyStats,
    essenceOf, FOOD, FUSE_N, GEAR_FORGE, GEAR_TOP, gearCost, gem2Of, gem3Of, gemKeep, infuseCost, ITEMS, keepShare, levelDamage, levelHp,
    RARE_POTIONS, RECIPES, regenEvery, relicMul, relicOf, rollCard, socketsFor, STACK_CAP, STAMINA_COST, stormEvery, WEAPONS, xpToNext,
    BACKPACK_TOP, backpackCost, backpackSlots, HOTBAR_SLOTS, roomFor, slotsUsed, TOOL_ITEMS,
    type Bag, type BuildingId, type CardId, type GemSkill, type ItemId, type StatId,
} from './survival.ts';
import {
    bossInfo, CITADEL_R, EPILOGUE_EIDOLON, homeOf, KINGDOMS, MIMIC_CODE, nextKingdom, orderFrom,
    type Element, type NpcId, type Region,
} from './eidolon.ts';
import type { FighterSave } from '../saveConfig.ts';
import { npcIdOf, quest, STORY_NPC } from './story/quest.ts';

/** Card level from the copies found: 1 copy is level 1, 1+2 copies level 2, 1+2+3 level 3, ... */
export const levelFromCopies = (copies: number): number => Math.floor((Math.sqrt(8 * copies + 1) - 1) / 2);

/** Everything that changes how strong the player is, worked out from the save. */
export interface Power {
    /** Damage multiplier for every hit (attack skill, forge, level, cards, fire, gems). */
    damage: number;
    /** The weapon's own multiplier on sword hits (Rust-Eaten Dagger 0.7 .. Mythic 2.2). */
    weapon: number;
    spellDamage: number;
    spellCooldown: number;
    /** Chance (0..0.75) to block a bite outright, and the share of a bite armour soaks up. */
    block: number;
    armor: number;
    speed: number;
    maxHp: number;
    /** Healing over time from every source, as seconds per point (Infinity = none). */
    regenEvery: number;
    xp: number;
    /** Chance of extra materials when gathering. */
    extra: number;
    thorns: number;
    vampire: number;
    /** Every n-th swing calls lightning (0 = no Storm Caller). */
    storm: number;
    /** Potions and food strength multiplier. */
    potion: number;
    /** Health share a Phoenix Feather brings you back with (0 = none). */
    phoenix: number;
    /** Stamina a dodge roll costs. */
    dodgeCost: number;
    /** Infernal Core socketed: every 5th hit explodes. */
    infernal: boolean;
    infusion: Element | null;
}

const powersOf = (d: FighterSave | null | undefined): Element[] => (d?.kingdom ? [...new Set([d.kingdom, ...d.wardens])] : []);

const maxHpOf = (d: FighterSave): number => {
    const giant = d.equipped.includes('giant') ? Math.round(2 * cardScale(levelFromCopies(d.cards.giant ?? 0), d.buildings.totem)) : 0;
    const sock = (id: ItemId) => d.sockets.filter((x) => x === id).length;
    return 6 + 2 * d.skills.vitality + levelHp(d.level) + giant + (powersOf(d).includes('earth') ? 4 : 0) + 2 * sock('gem2_vitality') + 5 * sock('gem3_vitality');
};

// ---- fog of war: the map is FOG_N × FOG_N cells of FOG_CELL tiles, one bit each.
export const FOG_CELL = 8;
export const FOG_N = WORLD_TILES / FOG_CELL;
let fogCache: { s: string; bits: Uint8Array } | null = null;
function exploredBits(s: string): Uint8Array {
    if (fogCache && fogCache.s === s) return fogCache.bits;
    const bits = new Uint8Array(Math.ceil((FOG_N * FOG_N) / 8));
    try {
        const raw = atob(s);
        for (let n = 0; n < Math.min(raw.length, bits.length); n++) bits[n] = raw.charCodeAt(n);
    } catch {
        /* a bad string reads as nothing seen */
    }
    fogCache = { s, bits };
    return bits;
}
function encodeBits(bits: Uint8Array): string {
    let raw = '';
    for (let n = 0; n < bits.length; n++) raw += String.fromCharCode(bits[n]);
    const s = btoa(raw);
    fogCache = { s, bits };
    return s;
}

let fraction = 0;
let fullNote = 0;

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
        const d = saveSystem.data;
        return d ? maxHpOf(d) : 6;
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
        const maxHp = maxHpOf(d);
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
        // Another blade in hand: a relic held lets go (its power is in its blade).
        if (d.gear.relic && relicOf(d.gear.relic)?.sword !== i) {
            d.gear.relic = null;
            store.patch({ gear: { ...d.gear } });
        }
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

    /**
     * The player died: carried gems and part of the materials are lost (the Storehouse keeps a share).
     * Crafted goods, cards, buildings, gear, level and the campaign stay. The next run starts at home, rested and fed.
     */
    endRun(): { lostItems: number; lostGems: number } {
        const d = saveSystem.data;
        if (!d) return { lostItems: 0, lostGems: 0 };
        const keep = keepShare(d.buildings.store);
        let lostItems = 0;
        for (const id of Object.keys(d.bag) as ItemId[]) {
            if (ITEMS[id].keep) continue;
            const kept = Math.floor(d.bag[id] * keep);
            lostItems += d.bag[id] - kept;
            d.bag[id] = kept;
        }
        const gk = gemKeep(d.buildings.store);
        let lostGems = 0;
        for (const k of ['attack', 'defence', 'speed', 'vitality'] as const) {
            const kept = Math.floor(d.gems[k] * gk);
            lostGems += d.gems[k] - kept;
            d.gems[k] = kept;
        }
        const maxHp = maxHpOf(d);
        const h = this.home();
        Object.assign(d, { scene: 'world', world: { u: h.u, v: h.v, set: false }, hp: maxHp, meters: { hunger: 100, thirst: 100, rest: 100 } });
        store.patch({ gems: { ...d.gems }, bag: { ...d.bag }, hp: maxHp, maxHp });
        this.publishMeters(true);
        saveSystem.save();
        return { lostItems, lostGems };
    },

    /** Wipe this player's progress back to a fresh game. */
    reset(): void {
        const d = saveSystem.data;
        if (!d) return;
        Object.assign(d, { bag: emptyBag(), cards: {}, equipped: [], buildings: emptyBuildings(), level: 1, xp: 0, story: { step: 0, base: 0, introSeen: false }, stats: emptyStats(), chests: {} });
        d.quest = { land: 1, main: 0, side: {}, flags: [], n: {}, lyra: 30, pressure: 0, done: false, placed: [] };
        store.patch({ storyQueue: [], storyPopup: null, puzzle: null, saga: { ...store.get().saga, lyra: null, pressure: null, timer: null, spire: null, mist: 0, sulfur: false, qte: null, hymn: null, carrying: false } });
        Object.assign(d, { hotbar: ['tool_sword', 'tool_axe', 'tool_pickaxe', null], held: 0, durability: { tool_sword: 80, tool_axe: 150, tool_pickaxe: 150, tool_fishingpole: 100 }, backpack: 0 });
        Object.assign(d.bag, { tool_sword: 1, tool_axe: 1, tool_pickaxe: 1, tool_fishingpole: 1 });
        Object.assign(d, { kingdom: null, wardens: [], guards: [], malakor: 0, gear: { weapon: 0, armor: 0, bp: 0, infusion: null, relics: [], relic: null }, sockets: [], meters: { hunger: 100, thirst: 100, rest: 100 }, explored: '', towers: [], houses: {}, talked: [], found: [] });
        Object.assign(d, { scene: 'world', world: { u: WORLD_TILES / 2 + 0.5, v: WORLD_TILES / 2 + 0.5, set: false }, tool: 'none', hp: 6, playSeconds: 0, kills: 0, bestWave: 0, swords: [], sword: -1, skills: { attack: 0, defence: 0, speed: 0, vitality: 0 }, gems: { attack: 0, defence: 0, speed: 0, vitality: 0 }, spells: defaultSpellSave() });
        store.patch({ playSeconds: 0, kills: 0, swordsOwned: [], swordIdx: -1, maxHp: 6, hp: 6, skills: { attack: 0, defence: 0, speed: 0, vitality: 0 }, gems: { attack: 0, defence: 0, speed: 0, vitality: 0 }, spells: defaultSpellSave() });
        saveSystem.save();
        this.syncSurvival();
    },

    // ------------------------------------------------------------ survival

    /** Push every survival field to the HUD (after boot, a reset, or a big change). */
    syncSurvival(): void {
        const d = saveSystem.data;
        if (!d) return;
        store.patch({
            bag: { ...d.bag }, cards: { ...d.cards }, equipped: [...d.equipped], buildings: { ...d.buildings },
            level: d.level, xp: d.xp, maxHp: maxHpOf(d), hp: Math.min(store.get().hp, maxHpOf(d)),
            kingdom: d.kingdom, wardens: [...d.wardens], guards: [...d.guards], malakor: d.malakor,
            gear: { ...d.gear }, sockets: [...d.sockets], towers: [...d.towers],
            hotbar: [...d.hotbar], held: d.held, durability: { ...d.durability }, backpack: d.backpack,
            meters: { hunger: Math.round(d.meters.hunger), thirst: Math.round(d.meters.thirst), rest: Math.round(d.meters.rest) },
        });
        this.publishObjective();
    },

    /** Kingdom powers this player holds: their own, plus every kingdom whose warden they beat. */
    powers(): Element[] {
        return powersOf(saveSystem.data);
    },

    power(): Power {
        const d = saveSystem.data;
        const none: Power = {
            damage: 1, weapon: 0.7, spellDamage: 1, spellCooldown: 1, block: 0, armor: 0, speed: 1, maxHp: 6, regenEvery: Infinity, xp: 1, extra: 0,
            thorns: 0, vampire: 0, storm: 0, potion: 1, phoenix: 0, dodgeCost: STAMINA_COST.dodge, infernal: false, infusion: null,
        };
        if (!d) return none;
        const card = (id: CardId): number => (d.equipped.includes(id) ? cardScale(levelFromCopies(d.cards[id] ?? 0), d.buildings.totem) : 0);
        const lv = (id: CardId): number => (d.equipped.includes(id) ? levelFromCopies(d.cards[id] ?? 0) : 0);
        const el = powersOf(d);
        const has = (e: Element) => el.includes(e);
        const sock = (id: ItemId) => d.sockets.filter((x) => x === id).length;
        const held = relicOf(d.gear.relic);
        const damage = (1 + 0.15 * d.skills.attack) * (1 + 0.12 * d.buildings.forge) * (1 + levelDamage(d.level)) * (1 + 0.1 * card('ember'))
            * (has('fire') ? 1.2 : 1) * (1 + 0.1 * sock('gem2_attack') + 0.2 * sock('gem3_attack'));
        // Healing over time adds up from every source (rates add, so convert to points per second).
        const rate = (every: number) => (Number.isFinite(every) && every > 0 ? 1 / every : 0);
        const perSec = rate(regenEvery(d.buildings.healer)) + (card('troll') > 0 ? rate(10 / card('troll')) : 0) + (has('water') ? 1 / 9 : 0) + (sock('gem3_vitality') > 0 ? 1 / 8 : 0);
        return {
            damage,
            weapon: held ? relicMul(this.tierOf(held.el), held.n) : WEAPONS[d.gear.weapon].mul,
            spellDamage: damage,
            spellCooldown: 1,
            block: Math.min(0.75, 0.07 * d.skills.defence + 0.06 * card('stoneskin') + (has('earth') ? 0.1 : 0) + 0.06 * sock('gem2_defence') + 0.15 * sock('gem3_defence')),
            armor: ARMORS[d.gear.armor].guard,
            speed: (1 + 0.05 * d.skills.speed) * (1 + 0.08 * card('tailwind')) * (has('air') ? 1.15 : 1) * (1 + 0.06 * sock('gem2_speed') + 0.15 * sock('gem3_speed')),
            maxHp: maxHpOf(d),
            regenEvery: perSec > 0 ? 1 / perSec : Infinity,
            xp: 1 + 0.2 * card('owl'),
            extra: Math.min(1, 0.25 * card('gatherer')),
            thorns: (card('thorns') > 0 ? Math.round(2 * card('thorns')) : 0) + (sock('gem3_defence') > 0 ? 3 : 0),
            vampire: Math.min(0.8, 0.15 * card('vampire')),
            storm: lv('storm') > 0 ? stormEvery(lv('storm')) : 0,
            potion: (1 + 0.15 * d.buildings.alchemy) * (1 + 0.4 * card('alchemist')) * (has('water') ? 1.25 : 1),
            phoenix: lv('phoenix') > 0 ? Math.min(1, 0.4 + 0.1 * lv('phoenix')) : 0,
            dodgeCost: Math.round(STAMINA_COST.dodge * (has('air') ? 0.7 : 1) * (sock('gem3_speed') > 0 ? 0.6 : 1)),
            infernal: sock('gem3_attack') > 0,
            infusion: held ? held.el : d.gear.infusion,
        };
    },

    has(cost: Partial<Bag>): boolean {
        const d = saveSystem.data;
        return !!d && (Object.keys(cost) as ItemId[]).every((k) => d.bag[k] >= (cost[k] ?? 0));
    },

    /** Add to the bag; returns how many fit. */
    addItem(id: ItemId, n = 1): number {
        const d = saveSystem.data;
        if (!d || n <= 0) return 0;
        const add = Math.min(n, STACK_CAP - d.bag[id], roomFor(d.bag, d.hotbar, d.backpack, id));
        if (add <= 0) {
            if (Date.now() - fullNote > 4000) {
                fullNote = Date.now();
                store.patch({ banner: { text: 'Backpack full! Drop or use something, or upgrade it (Bag › Gear)', id: Date.now() } });
            }
            return 0;
        }
        d.bag[id] += add;
        const stat = id as StatId;
        if (stat in d.stats) d.stats[stat] += add;
        if (id.startsWith('ess_')) d.stats.essence += add;
        store.patch({ bag: { ...d.bag } });
        saveSystem.markDirty();
        this.checkStory();
        return add;
    },

    /** Take one from the bag. */
    useItem(id: ItemId): boolean {
        const d = saveSystem.data;
        if (!d || d.bag[id] < 1) return false;
        d.bag[id] -= 1;
        store.patch({ bag: { ...d.bag } });
        saveSystem.markDirty();
        return true;
    },

    pay(cost: Partial<Bag>): boolean {
        const d = saveSystem.data;
        if (!d || !this.has(cost)) return false;
        for (const k of Object.keys(cost) as ItemId[]) d.bag[k] -= cost[k] ?? 0;
        store.patch({ bag: { ...d.bag } });
        return true;
    },

    /** Craft a recipe; `fire` says whether a lit fire is at hand (cooking needs one). */
    /** Make a recipe where you stand: potions at the alchemy tent (in camp), food at a fire, the rest at a workbench. */
    craft(index: number, at: { fire: boolean; camp: boolean; bench: boolean }): boolean {
        const d = saveSystem.data;
        const r = RECIPES[index];
        if (!d || !r || d.buildings.alchemy < r.alchemy || d.bag[r.out] >= STACK_CAP) return false;
        if (!(r.at === 'fire' ? at.fire : r.at === 'alchemy' ? at.camp : at.bench)) return false;
        if (ITEMS[r.out].tool && d.bag[r.out] > 0) return false;
        if (roomFor(d.bag, d.hotbar, d.backpack, r.out) < r.n || !this.pay(r.cost)) return false;
        d.bag[r.out] += r.n;
        d.stats.crafted += 1;
        sfx('craft');
        if (r.out.startsWith('potion_')) d.stats.potions += 1;
        store.patch({ bag: { ...d.bag } });
        this.gainXp(4);
        saveSystem.save();
        this.checkStory();
        return true;
    },

    // ---- eating, drinking and the meters

    /** Eat or drink: moves the meters, returns what it does to health (the scene applies it). */
    consume(id: ItemId): { heal: number; sick: boolean } | null {
        const d = saveSystem.data;
        const f = FOOD[id];
        if (!d || !f || d.bag[id] < 1) return null;
        d.bag[id] -= 1;
        const sick = !!f.sick && Math.random() < f.sick;
        d.meters.hunger = Math.min(100, d.meters.hunger + f.hunger);
        d.meters.thirst = Math.max(0, Math.min(100, d.meters.thirst + f.thirst - (sick ? 10 : 0)));
        if (id === 'cooked_meat' || id === 'meal') d.stats.cooked += 1;
        store.patch({ bag: { ...d.bag } });
        this.publishMeters(true);
        saveSystem.markDirty();
        this.checkStory();
        return { heal: f.heal, sick };
    },

    /** Drink straight from water (and fill a flask if there is room). */
    drink(): boolean {
        const d = saveSystem.data;
        if (!d) return false;
        d.meters.thirst = Math.min(100, d.meters.thirst + 35);
        const filled = d.bag.water < 5;
        if (filled) d.bag.water += 1;
        store.patch({ bag: { ...d.bag } });
        this.publishMeters(true);
        saveSystem.markDirty();
        return filled;
    },

    /** Change the meters (the scene drains them over time). */
    addMeters(dHunger: number, dThirst: number, dRest: number): void {
        const d = saveSystem.data;
        if (!d) return;
        const m = d.meters;
        m.hunger = Math.max(0, Math.min(100, m.hunger + dHunger));
        m.thirst = Math.max(0, Math.min(100, m.thirst + dThirst));
        m.rest = Math.max(0, Math.min(100, m.rest + dRest));
        this.publishMeters(false);
        saveSystem.markDirty();
    },

    meters(): { hunger: number; thirst: number; rest: number } {
        return saveSystem.data?.meters ?? { hunger: 100, thirst: 100, rest: 100 };
    },

    /** Only whole-number changes reach the HUD. */
    publishMeters(force: boolean): void {
        const d = saveSystem.data;
        if (!d) return;
        const next = { hunger: Math.round(d.meters.hunger), thirst: Math.round(d.meters.thirst), rest: Math.round(d.meters.rest) };
        const cur = store.get().meters;
        if (force || cur.hunger !== next.hunger || cur.thirst !== next.thirst || cur.rest !== next.rest) store.patch({ meters: next });
    },

    rest(): void {
        const d = saveSystem.data;
        if (!d) return;
        d.meters.rest = 100;
        sfx('revive', 0.7);
        this.publishMeters(true);
        saveSystem.save();
    },

    // ---- camp, cards, xp

    /** Raise a camp building one level (only in a liberated camp; the HUD checks that). */
    upgrade(id: BuildingId): boolean {
        const d = saveSystem.data;
        if (!d || !this.pay(buildCost(d.buildings[id]))) return false;
        d.buildings[id] += 1;
        sfx('craft');
        const maxHp = maxHpOf(d);
        store.patch({ buildings: { ...d.buildings }, maxHp });
        store.patch({ banner: { text: `${BUILDINGS[id].name} is now level ${d.buildings[id]}`, id: Date.now() } });
        this.gainXp(10 + 5 * d.buildings[id]);
        saveSystem.save();
        this.checkStory();
        return true;
    },

    cardLevel(id: CardId): number {
        return levelFromCopies(saveSystem.data?.cards[id] ?? 0);
    },

    /** A card was found. Returns its level after (a new card is level 1). */
    addCard(id: CardId): number {
        const d = saveSystem.data;
        if (!d) return 0;
        d.cards[id] = (d.cards[id] ?? 0) + 1;
        sfx('card');
        // The first card you ever find goes straight into a free slot.
        if (d.equipped.length === 0 && d.cards[id] === 1) d.equipped.push(id);
        store.patch({ cards: { ...d.cards }, equipped: [...d.equipped], maxHp: maxHpOf(d) });
        saveSystem.save();
        this.checkStory();
        return levelFromCopies(d.cards[id]);
    },

    /** A random card (for chests and rewards). */
    rollCard(luck = 0): CardId {
        return rollCard(Math.random, luck);
    },

    toggleCard(id: CardId): boolean {
        const d = saveSystem.data;
        if (!d || !(d.cards[id] > 0)) return false;
        if (d.equipped.includes(id)) d.equipped = d.equipped.filter((c) => c !== id);
        else if (d.equipped.length < cardSlots(d.buildings.totem)) d.equipped = [...d.equipped, id];
        else return false;
        const maxHp = maxHpOf(d);
        store.patch({ equipped: [...d.equipped], maxHp, hp: Math.min(store.get().hp, maxHp) });
        saveSystem.save();
        this.checkStory();
        return true;
    },

    /** XP (scaled by the Wise Owl card). Levels up as far as it goes, each healing you in full. */
    /** The first time inside a cave, dungeon or ruin: it is found (true the first time only). */
    discover(id: string): boolean {
        const d = saveSystem.data;
        if (!d || d.found.includes(id)) return false;
        d.found = [...d.found, id];
        this.gainXp(25);
        saveSystem.save();
        return true;
    },
    gainXp(n: number): number {
        const d = saveSystem.data;
        if (!d || n <= 0) return 0;
        d.xp += Math.round(n * this.power().xp);
        let ups = 0;
        while (d.xp >= xpToNext(d.level)) {
            d.xp -= xpToNext(d.level);
            d.level += 1;
            ups++;
        }
        if (ups > 0) {
            sfx('levelup');
            const maxHp = maxHpOf(d);
            store.patch({ level: d.level, xp: d.xp, maxHp, hp: maxHp, banner: { text: `Level ${d.level}! Fully healed`, id: Date.now() } });
            saveSystem.save();
            this.checkStory();
        } else {
            store.patch({ xp: d.xp });
            saveSystem.markDirty();
        }
        return ups;
    },

    stat(stat: StatId, n = 1): void {
        const d = saveSystem.data;
        if (!d) return;
        d.stats[stat] += n;
        this.checkStory();
    },

    // ---- the kingdoms

    kingdom(): Element | null {
        return saveSystem.data?.kingdom ?? null;
    },

    /** Pledge to a kingdom (once; a new game resets it). Its camp becomes home. */
    chooseKingdom(e: Element): void {
        const d = saveSystem.data;
        if (!d || d.kingdom) return;
        d.kingdom = e;
        const h = homeOf(e);
        d.world = { u: h.u, v: h.v, set: false };
        const maxHp = maxHpOf(d);
        store.patch({ kingdom: e, maxHp, hp: maxHp, travelTo: { u: h.u, v: h.v } });
        saveSystem.save();
        this.publishObjective();
    },

    /** Where this player's runs start. */
    home(): { u: number; v: number } {
        const e = saveSystem.data?.kingdom;
        return e ? homeOf(e) : { u: WORLD_TILES / 2 + 0.5, v: WORLD_TILES / 2 + 0.5 + CITADEL_R + 4 };
    },

    /** The kingdoms in the order this player meets them. */
    order(): Element[] | null {
        const e = saveSystem.data?.kingdom;
        return e ? orderFrom(e) : null;
    },

    /** May the player walk into this region? Home, and the kingdom after each beaten warden; the citadel after all four. */
    open(r: Region): boolean {
        const d = saveSystem.data;
        if (!d || !d.kingdom) return true;
        if (quest.active()) return quest.open(r);
        if (r === 'citadel') return d.wardens.length >= 4;
        return r === d.kingdom || d.wardens.some((w) => nextKingdom(w) === r);
    },

    /** How far into the campaign a kingdom is (0 for home .. 3), which sets its bosses' strength. */
    tierOf(e: Element | null): number {
        const order = this.order();
        if (!e) return 4 + Math.min(1, saveSystem.data?.malakor ?? 0);
        return order ? order.indexOf(e) : 0;
    },

    guardDone(e: Element, n: number): boolean {
        return !!saveSystem.data?.guards.includes(`${e}:${n}`);
    },
    guardsLeft(e: Element): number {
        return [1, 2, 3].filter((n) => !this.guardDone(e, n)).length;
    },
    wardenDone(e: Element): boolean {
        return !!saveSystem.data?.wardens.includes(e);
    },

    /** A boss fell near this player: count it and hand out its reward. Returns the banner text, or null if it did not count. */
    defeatBoss(code: number): string | null {
        const d = saveSystem.data;
        const info = bossInfo(code);
        if (!d || !info) return null;
        sfx('victory');
        if (code === MIMIC_CODE) {
            this.gainXp(40);
            return 'The Mimic is dead! Its hoard spills out';
        }
        if (info.rank === 'guard' && info.el) {
            const id = `${info.el}:${info.n}`;
            if (d.guards.includes(id)) return null;
            d.guards = [...d.guards, id];
            d.bag[essenceOf(info.el)] = Math.min(STACK_CAP, d.bag[essenceOf(info.el)] + 3);
            d.stats.essence += 3;
            // The spoils: its relic weapon, two rare potions, and a polished gem (the third guardian carries a core).
            const relic = relicOf(id)!;
            if (!d.gear.relics.includes(id)) d.gear.relics = [...d.gear.relics, id];
            if (!d.swords.includes(relic.sword)) d.swords = [...d.swords, relic.sword].sort((a, b) => a - b);
            const potions = [0, 1].map(() => RARE_POTIONS[Math.floor(Math.random() * RARE_POTIONS.length)]);
            for (const p of potions) d.bag[p] = Math.min(STACK_CAP, d.bag[p] + 1);
            const gemKind = (['attack', 'defence', 'speed', 'vitality'] as GemSkill[])[Math.floor(Math.random() * 4)];
            const gem = info.n >= 3 ? gem3Of(gemKind) : gem2Of(gemKind);
            d.bag[gem] = Math.min(STACK_CAP, d.bag[gem] + 1);
            this.gainXp(60 + 30 * this.tierOf(info.el));
            const left = this.guardsLeft(info.el);
            const k = KINGDOMS[info.el];
            const count = (ids: ItemId[]) => [...new Set(ids)].map((x) => `${ids.filter((y) => y === x).length > 1 ? `${ids.filter((y) => y === x).length} × ` : ''}${ITEMS[x].name}`);
            const story = quest.active();
            store.patch({ guards: [...d.guards], bag: { ...d.bag }, gear: { ...d.gear }, swordsOwned: [...d.swords] });
            store.tell({
                    speaker: info.name,
                    title: `Spoils: ${relic.name}`,
                    lines: [
                        `A relic of ${k.name}. ${relic.blurb}. Sword damage x${relicMul(this.tierOf(info.el), info.n)}, with ${k.name}'s ${info.el}. Hold it from the Gear tab.`,
                        `Also: ${[...count(potions), ITEMS[gem].name, `3 × ${ITEMS[essenceOf(info.el)].name}`].join(', ')}.`,
                        ...(story ? [] : [left > 0 ? `${left} guardian${left > 1 ? 's' : ''} of ${k.name} still stand${left > 1 ? '' : 's'}. The arena stays sealed until they fall.` : `The last guardian has fallen: the arena of ${k.name} is open. ${k.warden.name} waits.`]),
                    ],
            });
            saveSystem.save();
            this.checkStory();
            if (story) return `${info.name} falls!`;
            return `${info.name} is free! ${left > 0 ? `${left} guardian${left > 1 ? 's' : ''} left` : `The arena of ${k.name} is open`}`;
        }
        if (info.rank === 'warden' && info.el) {
            if (d.wardens.includes(info.el)) return null;
            d.wardens = [...d.wardens, info.el];
            // Blueprints: the first warden has the Iron plans, the third the Mythic ones.
            if (d.wardens.length >= 1) d.gear.bp = Math.max(d.gear.bp, 2);
            if (d.wardens.length >= 3) d.gear.bp = Math.max(d.gear.bp, 3);
            d.bag[essenceOf(info.el)] = Math.min(STACK_CAP, d.bag[essenceOf(info.el)] + 6);
            d.stats.essence += 6;
            const c = rollCard(Math.random, 0.5);
            d.cards[c] = (d.cards[c] ?? 0) + 1;
            // A demon's hoard: a gem core and a healer's kit.
            const core = gem3Of((['attack', 'defence', 'speed', 'vitality'] as GemSkill[])[Math.floor(Math.random() * 4)]);
            d.bag[core] = Math.min(STACK_CAP, d.bag[core] + 1);
            d.bag.potion_red = Math.min(STACK_CAP, d.bag.potion_red + 2);
            d.bag.potion_purple = Math.min(STACK_CAP, d.bag.potion_purple + 1);
            this.gainXp(300 + 150 * this.tierOf(info.el));
            const maxHp = maxHpOf(d);
            store.patch({ wardens: [...d.wardens], gear: { ...d.gear }, bag: { ...d.bag }, cards: { ...d.cards }, maxHp, hp: maxHp });
            saveSystem.save();
            this.checkStory();
            const next = nextKingdom(info.el);
            return d.wardens.length >= 4
                ? `${info.name} falls. The mists part: the Void Citadel is open!`
                : `${info.name} falls! You absorb the power of ${KINGDOMS[info.el].name}. The seal to ${KINGDOMS[next].name} is broken`;
        }
        // Malakor.
        d.malakor += 1;
        const c = rollCard(Math.random, 0.8);
        d.cards[c] = (d.cards[c] ?? 0) + 1;
        this.gainXp(1000 * d.malakor);
        store.patch({ malakor: d.malakor, cards: { ...d.cards } });
        saveSystem.save();
        this.checkStory();
        return d.malakor === 1 ? 'Malakor is defeated! Eidolon is whole again' : `Malakor falls again (${d.malakor} times)`;
    },

    // ---- gear and gems

    /** Forge the next tier of weapon or armour (blueprint, forge level and materials). */
    craftGear(kind: 'weapon' | 'armor'): boolean {
        const d = saveSystem.data;
        if (!d) return false;
        const tier = d.gear[kind] + 1;
        if (tier > GEAR_TOP || d.gear.bp < tier || d.buildings.forge < GEAR_FORGE[tier] || !this.pay(gearCost(kind, tier))) return false;
        d.gear[kind] = tier;
        sfx('craft');
        store.patch({ gear: { ...d.gear }, banner: { text: `Forged: ${(kind === 'weapon' ? WEAPONS : ARMORS)[tier].name}`, id: Date.now() } });
        this.gainXp(30 * tier);
        saveSystem.save();
        this.checkStory();
        return true;
    },

    infuse(e: Element): boolean {
        const d = saveSystem.data;
        if (!d || d.gear.weapon < 1 || !this.pay(infuseCost(e))) return false;
        d.gear.infusion = e;
        sfx('spell');
        store.patch({ gear: { ...d.gear }, banner: { text: `Your weapon is infused with ${KINGDOMS[e].name}'s ${e}`, id: Date.now() } });
        saveSystem.save();
        return true;
    },

    /** Hold a relic weapon (its blade, damage and element), or null to go back to the forged weapon. */
    equipRelic(id: string | null): void {
        const d = saveSystem.data;
        if (!d || (id && !d.gear.relics.includes(id))) return;
        const relic = relicOf(id);
        d.gear.relic = relic ? relic.id : null;
        d.sword = relic ? relic.sword : -1;
        if (relic && !d.swords.includes(relic.sword)) d.swords = [...d.swords, relic.sword].sort((a, b) => a - b);
        sfx(relic ? 'spell' : 'click');
        store.patch({ gear: { ...d.gear }, swordIdx: d.sword, swordsOwned: [...d.swords], banner: { text: relic ? `${relic.name} in hand` : `${WEAPONS[d.gear.weapon].name} in hand`, id: Date.now() } });
        saveSystem.save();
    },

    /** Fuse three of a kind: raw gems into a polished one (from = 1), or polished ones into a core (from = 2). */
    fuse(g: GemSkill, from: 1 | 2): boolean {
        const d = saveSystem.data;
        if (!d || d.buildings.totem < 1) return false;
        if (from === 1) {
            if (d.gems[g] < FUSE_N) return false;
            d.gems[g] -= FUSE_N;
            d.bag[gem2Of(g)] += 1;
        } else {
            if (d.bag[gem2Of(g)] < FUSE_N) return false;
            d.bag[gem2Of(g)] -= FUSE_N;
            d.bag[gem3Of(g)] += 1;
        }
        store.patch({ gems: { ...d.gems }, bag: { ...d.bag } });
        saveSystem.save();
        return true;
    },

    socket(id: ItemId): boolean {
        const d = saveSystem.data;
        if (!d || d.bag[id] < 1 || d.sockets.length >= socketsFor(d.gear.weapon)) return false;
        d.bag[id] -= 1;
        d.sockets = [...d.sockets, id];
        const maxHp = maxHpOf(d);
        store.patch({ bag: { ...d.bag }, sockets: [...d.sockets], maxHp });
        saveSystem.save();
        return true;
    },

    unsocket(index: number): void {
        const d = saveSystem.data;
        const id = d?.sockets[index];
        if (!d || !id) return;
        d.sockets = d.sockets.filter((_, n) => n !== index);
        d.bag[id] += 1;
        const maxHp = maxHpOf(d);
        store.patch({ bag: { ...d.bag }, sockets: [...d.sockets], maxHp, hp: Math.min(store.get().hp, maxHp) });
        saveSystem.save();
    },

    // ---- people, towers, houses, chests, the map

    /** Talking to someone in camp. Some give something the first time. Returns a gift line, if any. */
    talk(npc: NpcId): string | null {
        const d = saveSystem.data;
        if (!d) return null;
        const first = !d.talked.includes(npc);
        if (first) d.talked = [...d.talked, npc];
        let gift: string | null = null;
        const story = quest.active();
        // A forging step: the smith (or artificer) makes it if you bring what it needs.
        const forge = story ? quest.live().find((l) => l.step.goal.kind === 'forge' && npcIdOf(l.step.goal.npc) === npc) : undefined;
        if (forge && forge.step.goal.kind === 'forge') {
            const g = forge.step.goal;
            if (this.pay(g.cost)) {
                quest.flag(forge.step.id === 'masterwork' ? 'masterwork' : `forged:${forge.step.id}`);
                gift = g.made;
                quest.on({ type: 'done', step: forge.step.id });
            } else gift = `Bring ${(Object.entries(g.cost) as [ItemId, number][]).map(([k, n]) => `${n} ${ITEMS[k].name}`).join(', ')}, and it can be made.`;
        }
        if (story) quest.on({ type: 'talk', npc: STORY_NPC[npc] });
        if (first && npc === 'varis') {
            d.gear.bp = Math.max(d.gear.bp, 1);
            gift = 'Bram gives you the Bone Club and Hide Vest blueprints';
        } else if (first && npc === 'lyra' && !story) {
            d.bag.herb += 2;
            d.bag.potion_red += 1;
            gift = 'Lyra gives you wild mint (2 herbs) and a Healing draught';
        }
        store.patch({ gear: { ...d.gear }, bag: { ...d.bag } });
        saveSystem.save();
        this.checkStory();
        return gift;
    },

    climbTower(id: string): boolean {
        const d = saveSystem.data;
        if (!d || d.towers.includes(id)) return false;
        d.towers = [...d.towers, id];
        sfx('levelup', 0.8);
        store.patch({ towers: [...d.towers] });
        this.gainXp(40);
        saveSystem.save();
        this.checkStory();
        return true;
    },

    /** Mark the map cells within `r` tiles of (u, v) as seen. Returns true if anything new showed. */
    reveal(u: number, v: number, r: number): boolean {
        const d = saveSystem.data;
        if (!d) return false;
        const bits = exploredBits(d.explored);
        let changed = false;
        const c0 = Math.max(0, Math.floor((u - r) / FOG_CELL)), c1 = Math.min(FOG_N - 1, Math.floor((u + r) / FOG_CELL));
        const r0 = Math.max(0, Math.floor((v - r) / FOG_CELL)), r1 = Math.min(FOG_N - 1, Math.floor((v + r) / FOG_CELL));
        for (let y = r0; y <= r1; y++) {
            for (let x = c0; x <= c1; x++) {
                if (Math.hypot((x + 0.5) * FOG_CELL - u, (y + 0.5) * FOG_CELL - v) > r + FOG_CELL / 2) continue;
                const n = y * FOG_N + x;
                if (!(bits[n >> 3] & (1 << (n & 7)))) {
                    bits[n >> 3] |= 1 << (n & 7);
                    changed = true;
                }
            }
        }
        if (changed) {
            d.explored = encodeBits(bits);
            saveSystem.markDirty();
        }
        return changed;
    },
    explored(): Uint8Array {
        return exploredBits(saveSystem.data?.explored ?? '');
    },

    /** Houses refill this many play seconds after they are searched. */
    houseReady(id: string): boolean {
        const d = saveSystem.data;
        const t = d?.houses[id];
        return !!d && (t === undefined || d.playSeconds - t > 600);
    },
    /** Search a house: food, materials, sometimes essence or a blueprint. Returns what was found. */
    searchHouse(id: string, el: Element | null): string[] {
        const d = saveSystem.data;
        if (!d || !this.houseReady(id)) return [];
        d.houses[id] = d.playSeconds;
        const got: string[] = [];
        const add = (k: ItemId, n: number) => {
            const a = this.addItem(k, n);
            if (a > 0) got.push(`${a} ${ITEMS[k].name}`);
        };
        add(Math.random() < 0.5 ? 'cooked_meat' : 'water', 1 + Math.floor(Math.random() * 2));
        const pool: ItemId[] = ['wood', 'stone', 'iron', 'leather', 'herb', 'crystal'];
        add(pool[Math.floor(Math.random() * pool.length)], 2 + Math.floor(Math.random() * 3));
        if (el && Math.random() < 0.5) add(essenceOf(el), 1);
        // A blueprint one tier beyond what you have, now and then.
        if (d.gear.bp < GEAR_TOP && d.gear.bp >= 1 && Math.random() < 0.15) {
            d.gear.bp += 1;
            store.patch({ gear: { ...d.gear } });
            got.push(`a blueprint: ${WEAPONS[d.gear.bp].name} and ${ARMORS[d.gear.bp].name}`);
        }
        this.gainXp(12);
        saveSystem.save();
        return got;
    },

    /** Chests refill this many play seconds after they are opened. */
    chestReady(id: number): boolean {
        const d = saveSystem.data;
        const t = d?.chests[id];
        return !!d && (t === undefined || d.playSeconds - t > 600);
    },
    chestOpenedAt(id: number): number {
        return saveSystem.data?.chests[id] ?? 0;
    },
    openChest(id: number): void {
        const d = saveSystem.data;
        if (!d) return;
        d.chests[id] = d.playSeconds;
        d.stats.chests += 1;
        saveSystem.save();
        this.checkStory();
    },

    // ---- hotbar, tools and the backpack

    /** Put an item kind in a hotbar slot (null empties it). An item sits in one slot at most. */
    setHotbar(slot: number, id: ItemId | null): void {
        const d = saveSystem.data;
        if (!d || slot < 0 || slot >= HOTBAR_SLOTS) return;
        d.hotbar = d.hotbar.map((x) => (x === id ? null : x));
        d.hotbar[slot] = id;
        store.patch({ hotbar: [...d.hotbar] });
        saveSystem.save();
    },
    /** Take a hotbar slot in hand. Returns what is there. */
    hold(slot: number): ItemId | null {
        const d = saveSystem.data;
        if (!d || slot < 0 || slot >= HOTBAR_SLOTS) return null;
        d.held = slot;
        store.patch({ held: slot });
        saveSystem.markDirty();
        return d.hotbar[slot];
    },
    hotbar(): (ItemId | null)[] {
        return saveSystem.data?.hotbar ?? [];
    },
    /** Whether the player owns a tool (by the tool the character holds, e.g. 'axe'). */
    hasTool(holds: string): boolean {
        if (holds === 'none') return true;
        const d = saveSystem.data;
        const id = TOOL_ITEMS.find((k) => ITEMS[k].tool!.holds === holds);
        return !!d && !!id && d.bag[id] > 0;
    },
    // Tools never wear out or break (the old save field `durability` is kept only so old saves load).
    /** Throw away some of an item (to free backpack slots). */
    discard(id: ItemId, n: number): void {
        const d = saveSystem.data;
        if (!d || ITEMS[id].tool) return;
        d.bag[id] = Math.max(0, d.bag[id] - n);
        store.patch({ bag: { ...d.bag } });
        saveSystem.markDirty();
    },
    upgradeBackpack(): boolean {
        const d = saveSystem.data;
        if (!d || d.backpack >= BACKPACK_TOP || !this.pay(backpackCost(d.backpack))) return false;
        d.backpack += 1;
        sfx('craft');
        store.patch({ backpack: d.backpack, banner: { text: `Backpack: ${backpackSlots(d.backpack)} slots`, id: Date.now() } });
        saveSystem.save();
        return true;
    },
    slots(): { used: number; max: number } {
        const d = saveSystem.data;
        return d ? { used: slotsUsed(d.bag, d.hotbar), max: backpackSlots(d.backpack) } : { used: 0, max: 20 };
    },

    // ---- the story

    introSeen(): boolean {
        return !!saveSystem.data?.story.introSeen;
    },
    markIntroSeen(): void {
        const d = saveSystem.data;
        if (!d || d.story.introSeen) return;
        d.story.introSeen = true;
        saveSystem.save();
    },

    chapter() {
        return chapterAt(saveSystem.data?.story.step ?? 0, this.order());
    },

    /** How far along the current objective is. */
    goalProgress(): { have: number; need: number } {
        const d = saveSystem.data;
        if (!d) return { have: 0, need: 1 };
        const g = this.chapter().goal;
        switch (g.kind) {
            case 'stat': return { have: Math.max(0, d.stats[g.stat] - d.story.base), need: g.n };
            case 'build': return { have: g.building === 'any' ? Math.max(...Object.values(d.buildings)) : d.buildings[g.building], need: g.level };
            case 'wave': return { have: store.get().wave, need: g.n };
            case 'equip': return { have: d.equipped.length > 0 ? 1 : 0, need: 1 };
            case 'level': return { have: d.level, need: g.n };
            case 'gear': return { have: d.gear.weapon, need: g.n };
            case 'towers': return { have: d.towers.length, need: g.n };
            case 'guards': return { have: d.guards.length, need: g.n };
            case 'wardens': return { have: d.wardens.length, need: g.n };
            case 'malakor': return { have: d.malakor, need: g.n };
            case 'talk': return { have: d.talked.includes(g.npc) ? 1 : 0, need: 1 };
        }
    },

    publishObjective(): void {
        const d = saveSystem.data;
        if (!d) return;
        if (quest.active()) {
            quest.publish();
            return;
        }
        const ch = this.chapter();
        const p = this.goalProgress();
        const cur = store.get().objective;
        const next = { title: ch.title, task: ch.task, have: Math.min(p.have, p.need), need: p.need, step: d.story.step };
        if (!cur || cur.have !== next.have || cur.step !== next.step || cur.need !== next.need || cur.task !== next.task) store.patch({ objective: next });
    },

    /** Finish the current chapter if its goal is met: pay the reward and open the next one (Master Orin explains it). */
    checkStory(): void {
        const d = saveSystem.data;
        if (!d || !d.kingdom) {
            this.publishObjective();
            return;
        }
        if (quest.active()) {
            quest.check();
            return;
        }
        for (let guard = 0; guard < 5; guard++) {
            const p = this.goalProgress();
            if (p.have < p.need) break;
            const done = this.chapter();
            const got: string[] = [];
            for (const [k, n] of Object.entries(done.reward.items ?? {}) as [ItemId, number][]) {
                d.bag[k] = Math.min(STACK_CAP, d.bag[k] + n);
                got.push(`${n} ${ITEMS[k].name}`);
            }
            if (done.reward.card) {
                const c = rollCard(Math.random, 0.3);
                d.cards[c] = (d.cards[c] ?? 0) + 1;
                got.push(`card: ${CARDS[c].name}`);
            }
            got.unshift(`${done.reward.xp} XP`);
            d.story.step += 1;
            const next = this.chapter();
            d.story.base = next.goal.kind === 'stat' ? d.stats[next.goal.stat] : 0;
            store.patch({ bag: { ...d.bag }, cards: { ...d.cards } });
            const finale = d.story.step === CHAPTER_COUNT;
            sfx(finale ? 'fanfare' : 'chapter');
            store.tell({
                speaker: 'Master Orin',
                title: finale ? 'Eidolon Restored' : `Chapter complete: ${done.title}`,
                lines: finale ? [...EPILOGUE_EIDOLON, `Next: ${next.title}. ${next.task}.`] : [...next.say, `Next: ${next.title}. ${next.task}.`],
                reward: `Reward: ${got.join(' · ')}`,
            });
            saveSystem.save();
            this.gainXp(done.reward.xp);
        }
        this.publishObjective();
    },
};
