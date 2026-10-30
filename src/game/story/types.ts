/**
 * The shape of the story's data (the four lands: land1-4.ts). Each land is one object: its places,
 * the props in them, its quest line and side quests, its bosses and how their fights turn, the curse
 * that hangs over it, its relics and its puzzles. The engine (quest.ts) and the world side
 * (world/storyLayer.ts) read only this.
 */
import type { Element } from '../eidolon.ts';
import type { BuildingId, ItemId } from '../survival.ts';
import type { StoryPopup } from '../../state/store.ts';

/** A place in a land: one of its story sites, its camp ('camp'), or a boss spot ('guard:1-3', 'arena', 'citadel') by alias. */
export type SiteId = string;

/** The props with their own drawing (Land 1's), and the generic looks the other lands use. */
export type PropType =
    | 'boulder' | 'slab' | 'spire' | 'altar' | 'alembic' | 'basin' | 'geyser' | 'beam' | 'lockbox' | 'fakewall' | 'sarcophagus'
    | 'tether' | 'vent' | 'chain' | 'gearbox' | 'harmonic' | 'winch' | 'scale' | 'quartz' | 'satchel' | 'valve'
    | 'smelter' | 'lectern' | 'statue' | 'chest' | 'shelter' | 'solstice' | 'grounding' | 'ruin'
    | 'pillar' | 'rock' | 'box' | 'machine' | 'ring' | 'crystal' | 'gate' | 'vane' | 'harp' | 'bell' | 'rod' | 'pylon'
    | 'lure' | 'node' | 'fault' | 'pipe' | 'ship' | 'rift' | 'brazier' | 'loom' | 'web' | 'pad' | 'stalactite';

export interface PropDef {
    id: string;
    type: PropType;
    site: SiteId;
    /** Offset from the site's centre, in tiles. */
    at: [number, number];
    /** Blows to break it (breakable things). */
    hp?: number;
    /** Only a chisel-wedge blast breaks it (a load-bearing fault). */
    wedge?: boolean;
    /** Breaking it needs this story flag first (and what is said without it). */
    needs?: { flag: string; say: string };
    /** Hollow (it rings when pinged; a mimic waits inside). */
    hollow?: boolean;
    /** Its colour (generic looks). */
    color?: number;
    /** Its name on the prompt. */
    name?: string;
}

/** Foes the story sends (kinds of monster), and where. */
export interface Encounter {
    at: SiteId | 'player';
    foes: string[];
}
export interface SiegeWave {
    foes: string[];
    /** Seconds into the siege it comes. */
    t: number;
}
export type NpcKey = 'orin' | 'bram' | 'lyra' | 'kael' | 'lin' | 'thorne' | 'nerissa';

/** What must be true before a puzzle opens (else `say`). */
export interface Requires {
    broke?: string[];
    items?: Partial<Record<ItemId, number>>;
    flag?: string;
    say: string;
}

export type Goal =
    | { kind: 'break'; props: string[] }
    | { kind: 'carry'; label?: string }
    | { kind: 'reach'; site: SiteId; r?: number }
    | { kind: 'items'; items: Partial<Record<ItemId, number>> }
    | { kind: 'puzzle'; puzzle: string; prop: string; requires?: Requires }
    | { kind: 'place'; items: Partial<Record<ItemId, number>> }
    | { kind: 'touch'; prop: string; label?: string }
    | { kind: 'give'; item: ItemId }
    | { kind: 'build'; building: BuildingId; level: number }
    | { kind: 'siege'; waves: SiegeWave[]; secs: number }
    | { kind: 'defend'; prop: string; secs: number; foes: string[]; label?: string }
    | { kind: 'boss'; boss: string; site: SiteId }
    | { kind: 'talk'; npc: NpcKey }
    | { kind: 'chord'; props: string[]; within: number }
    | { kind: 'shelters'; props: string[]; secs: number; foes: string[] }
    | { kind: 'clear'; site: SiteId; foes: string[]; secs: number; gives: Partial<Record<ItemId, number>> }
    | { kind: 'drink'; item: ItemId }
    | { kind: 'forge'; cost: Partial<Record<ItemId, number>>; npc: NpcKey; made: string }
    | { kind: 'relics'; ids: string[] }
    /** Light a run of props by standing at each in turn (shelter domes, lift stops, stepping-pads). */
    | { kind: 'stations'; props: string[]; secs: number; foes: string[]; label: string }
    /** Strike props in the right order (the elemental locks of a rift). */
    | { kind: 'strikes'; props: string[]; label: string };

export interface Reward {
    xp?: number;
    items?: Partial<Record<ItemId, number>>;
    /** Story flags set (abilities, unlocked zones, people, keys, relic shards: 'shard:<relic>'). */
    flags?: string[];
    /** Lyra's soul stability (added, 0-100). */
    lyra?: number;
}

export interface Step {
    id: string;
    /** The quest it belongs to (shown as the tracker's heading). */
    quest: string;
    act: 1 | 2 | 3 | 4;
    task: string;
    /** Exactly how, in plain words, with the keys. */
    how: string;
    goal: Goal;
    /** What the marker points at: a site, a prop, or someone. */
    at?: string;
    /** A side quest this step cannot be done without (its reward opens the way): the tracker follows it first. */
    via?: string;
    /** Story told as the step begins, and as it ends. */
    intro?: StoryPopup[];
    outro?: StoryPopup[];
    /** Foes the step brings (when you get near). */
    spawn?: Encounter;
    reward?: Reward;
}

/** Side quests: each opens when a flag is set, and runs beside the main line. */
export interface SideQuest {
    id: string;
    title: string;
    /** The flag that opens it ('done:<step>' for a main step finished). */
    unlock: string;
    steps: Step[];
}

/** How a boss fight turns (generic pieces each land configures). */
export type Mech =
    /** Below `at` of its health it armours up (blows do `share`); striking one of `props` near it (or E / the Hymn, if allowed) cracks it open for `open` ms. */
    | { kind: 'armor'; at: number; share: number; props?: string[]; near?: number; byE?: boolean; byHymn?: boolean; open: number; msg: string; openMsg: string }
    /** Below `at`, it calls these foes once. */
    | { kind: 'adds'; at: number; foes: string[]; msg?: string }
    /** Between `from` and `to` of its health, every `every` ms the floor floods for `dur` ms: stand on a raised prop of `safe` type (strike it to raise it). */
    | { kind: 'flood'; from: number; to: number; every: number; dur: number; safe: string; msg: string }
    /** Below `at`, the finishing blow: strike on the beat `beats` times. */
    | { kind: 'finisher'; at: number; beats: number; msg: string }
    /** Between `from` and `to`, it pulls and pushes you every `every` ms unless you stand at a `anchor` prop. */
    | { kind: 'polarity'; from: number; to: number; every: number; anchor: string; msg: string }
    /** Below `at`, your controls are inverted until the Hymn rings (every `every` ms it sings again). */
    | { kind: 'invert'; at: number; every: number; msg: string }
    /** Below `at`, the arena goes dark until you strike a lit `props` prop near it. */
    | { kind: 'dark'; at: number; props: string; msg: string }
    /** Its frontal shield: blows do `share` unless you rolled within the last 1.5 s (over the shield, behind it). */
    | { kind: 'shield'; share: number; msg: string }
    /** It heals while it stands within 2.5 tiles of a `props` prop. */
    | { kind: 'heal'; props: string; msg: string }
    /** Its heads cycle every `every` ms; blows do little unless your blade is imbued (strike a brazier) with the counter-element. */
    | { kind: 'heads'; every: number; msg: string }
    /** Below `at`, it fades from sight; Lyra marks where it is. */
    | { kind: 'unseen'; at: number; msg: string };

export interface BossDef {
    code: number;
    site: SiteId;
    /** Called out when it comes. */
    intro: string;
    mechs: Mech[];
}

/** The curse that hangs over a land. */
export type Hazard =
    /** Amnesia Mist round a site: your sight whitens and stamina slows outside the light of a way-torch or a Spire. */
    | { kind: 'mist'; site: SiteId; r: number }
    /** Choking fog round a site: it hurts without the draught `item` drunk. */
    | { kind: 'fog'; site: SiteId; r: number; item: ItemId; say: string }
    /** Sky-lightning strikes near you now and then, unless you stand near a copper rod or in camp. */
    | { kind: 'static'; every: number }
    /** Gale shear: gusts push you, unless you wear iron-sole boots. */
    | { kind: 'gale'; every: number }
    /** Frostbite builds while you stand still away from a brazier or camp (crampons keep your footing). */
    | { kind: 'frost' }
    /** Gravity tips now and then, sliding you across the ground. */
    | { kind: 'gravity'; every: number }
    /** A void rift that spills shades until it is sealed (flag 'sealed:<id>'). */
    | { kind: 'rift'; id: string; site: SiteId };

/** A Corrupted Memory Relic: dug up in shards (flag 'shard:<id>'), mended at the Strata-Loom (flag 'relic:<id>'), and its vision. */
export interface RelicDef {
    id: string;
    n: number;
    title: string;
    shards: number;
    vision: StoryPopup;
}

/** A puzzle described as data (the generic puzzle panel draws it). */
export type PuzzleDef =
    | { kind: 'sequence'; title: string; hint: string; items: { label: string; color: string; freq: number }[]; order: number[] }
    | { kind: 'dials'; title: string; hint: string; size: number; start: number[]; target: number[]; couple?: boolean; labels?: string[]; show?: 'angle' | 'level' }
    | { kind: 'weights'; title: string; hint: string; items: { label: string; w: number; color: string }[]; target: number; count?: number }
    | { kind: 'route'; title: string; hint: string; grid: string[]; rot: string[] }
    | { kind: 'slide'; title: string; hint: string; size: number; blocks: [number, number][]; switches: [number, number][]; walls: [number, number][]; pillars: number }
    | { kind: 'levels'; title: string; hint: string; start: number[]; target: number; step: number }
    | { kind: 'debate' };

export interface Land {
    n: 1 | 2 | 3 | 4;
    el: Element;
    title: string;
    /** The camp's name in the story, and the Spire's. */
    camp: string;
    /** Boss spots and other places by alias. */
    alias: Record<string, 'guard:1' | 'guard:2' | 'guard:3' | 'arena' | 'citadel' | 'camp'>;
    siteNames: Record<string, string>;
    /** The site the land begins at. */
    start: SiteId;
    props: PropDef[];
    main: Step[];
    sides: SideQuest[];
    bosses: Record<string, BossDef>;
    hazards: Hazard[];
    relics: RelicDef[];
    puzzles: Record<string, PuzzleDef>;
    /** What Lyra is like at her alcove (the latest whose flag is set). */
    bedside: { flag: string; line: string }[];
    /** The draught that eases her (given at the altar). */
    draught: ItemId | null;
    /** The conduits' colour in the Sanctuary. */
    conduit: number;
    /** Flashback memories this land unlocks (shown in a Flashback Surge once learnt), by flag. */
    memories: { flag: string; line: string }[];
}

export const say = (speaker: string, title: string, ...lines: string[]): StoryPopup => ({ speaker, title, lines });
export const flashback = (title: string, ...lines: string[]): StoryPopup => ({ speaker: 'Flashback', title, lines, style: 'flashback' });
export const vision = (title: string, ...lines: string[]): StoryPopup => ({ speaker: 'Relic vision', title, lines, style: 'vision' });
export const scroll = (title: string, ...lines: string[]): StoryPopup => ({ speaker: 'Recovered scroll', title, lines, style: 'scroll' });
export const cine = (speaker: string, title: string, ...lines: string[]): StoryPopup => ({ speaker, title, lines, style: 'cinematic' });
