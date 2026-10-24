/**
 * Tiny external store bridging game code (Pixi ticker, SDK callbacks, plain
 * modules) and React — no state-library dependency. Game code calls
 * store.patch(); React components subscribe with useStore(selector).
 *
 * Keep this store for UI-FACING state only (phase, HUD numbers, popups).
 * Per-frame simulation state stays inside the Pixi scene — patching the
 * store every frame re-renders React every frame.
 */
import { useSyncExternalStore } from 'react';
import { defaultSpellSave, type SpellSave } from '../game/world/spells.ts';
import { emptyBag, emptyBuildings, type Bag, type BuildingId, type Buildings, type CardId, type ItemId } from '../game/survival.ts';
import type { Element, NpcId, Region } from '../game/eidolon.ts';

/** A story moment shown as a dialog: the intro, a new chapter, or the ending. */
/** What the Use button would do right now (it shows the matching icon). */
export type ActKind = 'talk' | 'build' | 'chop' | 'mine' | 'pick' | 'open' | 'search' | 'bench' | 'travel' | 'climb' | 'challenge' | 'fish' | 'drink' | 'wait';

export interface StoryPopup {
    /** Who tells it (Master Orin by default). */
    speaker?: string;
    title: string;
    lines: string[];
    /** Shown with the chapter's reward line, if any. */
    reward?: string;
    /** How it is framed: a cinematic beat, a golden-hour flashback, a corrupted relic vision, a recovered scroll. */
    style?: 'cinematic' | 'flashback' | 'vision' | 'scroll';
}

/** The story's live state for the HUD (Land 1: see game/story/quest.ts). */
export interface SagaHud {
    /** Lyra's soul stability and crystallization pressure, 0-100 (null while she is not in your care). */
    lyra: number | null;
    pressure: number | null;
    /** Frostbite (Aquatica), 0..1. */
    frost: number;
    /** A Flashback Surge running: the memory shown (it fades by itself). */
    surge: { line: string; id: number } | null;
    /** A boss phase on screen: the arena gone dark, your senses inverted, Lyra's mark on an unseen foe. */
    dark: boolean;
    invert: boolean;
    /** The boss nearby: how many of its four structural zones are broken, and whether it is staggered (F to mount). */
    zones: { broken: number; mount: boolean } | null;
    /** Lyra beside you (Land 4): seconds until her next synergy. */
    companion: number | null;
    /** Chisel-wedges planted (up to 3). */
    wedges: number;
    /** The next periodic siege: seconds until it comes (null when not counting). */
    nightIn: number | null;
    /** A timed task running: what it is and whole seconds left. */
    timer: { label: string; left: number; total: number } | null;
    /** The Memory Spire's health during a siege. */
    spire: { hp: number; max: number } | null;
    /** How deep in the Amnesia Mist you are (0 clear .. 1 lost), and the sulfur fog with no filter. */
    mist: number;
    sulfur: boolean;
    /** The finishing blow: beats struck of the song, and the next beat's window (0..1 through it). */
    qte: { hit: number; need: number; phase: number; label?: string } | null;
    /** Abilities the story has given: Vein-Striker, the Echo Dash, the Resonant Hymn (ms of cooldown left). */
    hymn: number | null;
    /** Carrying Lyra. */
    carrying: boolean;
}

export type PuzzleId = string;

export interface GameOverInfo {
    score: number;
    wave: number;
    kills: number;
    seconds: number;
    /** 'sending' while the score is being posted, then the outcome. */
    status: 'sending' | 'done';
    rank: number | null;
    /** Why the leaderboard did not take the score, if it did not. */
    note: string | null;
    top: { rank: number; name: string; score: number; wave: number; me: boolean }[];
}

/** The UI-facing app state. ADAPT: extend alongside the initial state below. */
export interface AppState {
    /** 'loading' → 'menu' → (New Game: 'intro' → 'kingdom') → 'playing' (the world). */
    phase: 'loading' | 'menu' | 'intro' | 'kingdom' | 'playing';
    /** Bumped to start a fresh run (remounts the world). */
    runId: number;
    /** The Game Over screen: set when the player dies, with how the run went and the leaderboard. */
    gameOver: GameOverInfo | null;
    /** 0..1 progress of the critical-asset warm during 'loading' */
    loadProgress: number;
    /** Set by the host's onPause/onResume lifecycle hooks */
    paused: boolean;
    /** Player tile and chunk coordinates, and how many chunks are loaded */
    tileX: number;
    tileY: number;
    /** Multiplayer link to the shared world room, and how many players (including you) are in it */
    netStatus: 'off' | 'connecting' | 'online';
    /** The online room's shareable code (null when solo, or in the public Quick Play room if it has none) */
    roomCode: string | null;
    online: number;
    /** Monsters this player has defeated (from the save) */
    kills: number;
    /** Total time this player has played, in seconds (from the save) */
    playSeconds: number;
    /** True while the server is running the monsters (shared with everyone in the room) */
    sharedMonsters: boolean;
    /** Health in half hearts, 0..maxHp */
    hp: number;
    /** Maximum health in half hearts (6, plus 2 per Vitality level) */
    maxHp: number;
    /** Skill levels from drops, and the wave reached (0 before the first) */
    skills: { attack: number; defence: number; speed: number; vitality: number };
    /** Gems held (spent on skills and spells at a frog) */
    gems: { attack: number; defence: number; speed: number; vitality: number };
    /** Is the upgrade panel open? */
    shop: boolean;
    /** A visiting frog: bearing, distance in tiles and seconds left */
    frogAim: { angle: number; dist: number; left: number } | null;
    wave: number;
    /** Seconds until the next wave starts */
    nextWaveIn: number;
    /** Safe in camp with the waves held off (playing alone) */
    wavesCalm: boolean;
    /** The story holds the waves back (before its first Sanctuary stands). */
    wavesHeld: boolean;
    /** The cave, dungeon or ruin the player is inside (its name), or null out in the open. */
    indoors: string | null;
    /** A cinematic playing: the line on screen, a title card, the fade to black (0-1), and whether it may be skipped. */
    cine: { line: { speaker: string; text: string; who?: string } | null; title: { top: string; main: string } | null; fade: number; flash: number } | null;
    /** The fight is on (an onslaught, or its last monsters); waves still to come in this onslaught */
    fighting: boolean;
    onslaughtLeft: number;
    /** Monsters left in the current wave (alive plus still to spawn), or null between waves */
    waveLeft: number | null;
    /** Short message shown near the top (wave start, pickups), cleared by the HUD */
    banner: { text: string; id: number } | null;
    /** Potion boosts running: potion colour and whole seconds left */
    buffs: { key: string; left: number }[];
    /** Spells unlocked and their carry / cooldown levels (mirrors the save) */
    spells: SpellSave;
    /** Per spell while playing: charges held, the most it holds, and whole seconds until the next charge */
    spellState: { charges: number; max: number; cd: number }[];
    /** The sword held (0-29, or -1 for the original iron sword), and every sword found */
    swordIdx: number;
    swordsOwned: number[];
    /** Equipped tool id (a hotbar slot: see world/character.ts HOTBAR) */
    toolId: string;
    /** Terrace level the player stands on */
    height: number;
    chunkX: number;
    chunkY: number;
    loadedChunks: number;
    // ---- Survival (see game/survival.ts and game/progress.ts)
    bag: Bag;
    cards: Record<string, number>;
    equipped: CardId[];
    buildings: Buildings;
    level: number;
    xp: number;
    /** The current story objective and how far along it is. */
    objective: { title: string; task: string; have: number; need: number; step: number; how?: string; act?: number; land?: string; sides?: { title: string; task: string }[] } | null;
    /** A story dialog waiting to be read (the world keeps going behind it, but bites are held off). */
    storyPopup: StoryPopup | null;
    /** Story pages waiting their turn behind the one open. */
    storyQueue: StoryPopup[];
    /** A story puzzle open (it holds the waves like a dialog). */
    puzzle: { id: string; prop: string } | null;
    /** Bumped when the save slots' list changes (menus re-read it). */
    slotsVersion: number;
    /** The Strata-Loom (relic reconstruction) open. */
    loom: boolean;
    /** The debate with Malakor open. */
    debate: boolean;
    saga: SagaHud;
    /** The bag panel, and which tab. */
    bagTab: 'items' | 'craft' | 'gear' | 'cards' | 'camp' | 'map' | 'story' | null;
    /** Standing in camp (building works, healing is faster). */
    inCamp: boolean;
    /** Arrow to the nearest place the objective points at (a shrine, chest or camp). */
    target: { angle: number; dist: number; label: string } | null;
    /** A use prompt for what is in front of the player (a tree, a chest, a shrine). */
    hint: string | null;
    /** The same, for the action button: what kind of thing it is (its icon), what it says, and the tent it means. */
    act: { kind: ActKind; label: string; building?: BuildingId } | null;
    /** The build card for one camp tent, open. */
    buildPanel: BuildingId | null;
    /** The big map, open (the radar expanded). */
    bigMap: boolean;
    // ---- Eidolon (see game/eidolon.ts)
    kingdom: Element | null;
    wardens: Element[];
    guards: string[];
    malakor: number;
    gear: { weapon: number; armor: number; bp: number; infusion: Element | null; relics: string[]; relic: string | null };
    sockets: ItemId[];
    towers: string[];
    /** Hunger, thirst and rest (0-100), and stamina now / most / worn out. */
    meters: { hunger: number; thirst: number; rest: number };
    stamina: { now: number; max: number; tired: boolean };
    /** The region the player stands in. */
    region: Region | null;
    /** The weather where the player is, and whether a camp fire is lit (rain puts it out). */
    weather: 'clear' | 'rain' | 'storm' | 'fog';
    /** A boss nearby: its name and health, for the big bar. */
    boss: { name: string; hp: number; max: number; css: string } | null;
    /** Open panels: talking to someone, inside a house, travelling between camps, picking a kingdom. */
    npc: NpcId | null;
    house: { id: string; el: Element | null } | null;
    travel: boolean;
    /** Next to a lit fire (cooking works): a liberated camp out of the rain, or inside a house. */
    fire: boolean;
    /** Ask the world to move the player (fast travel, a kingdom chosen). */
    travelTo: { u: number; v: number } | null;
    /** Monsters close by (no resting). */
    danger: boolean;
    /** The 4-slot hotbar, the slot in hand, tool wear, and backpack slots used / available. */
    hotbar: (ItemId | null)[];
    held: number;
    durability: Record<string, number>;
    slots: { used: number; max: number };
    backpack: number;
    /** Day and night: phase, darkness 0..1, seconds left in the phase. */
    sky: { phase: 'day' | 'dusk' | 'night' | 'dawn'; dark: number; left: number };
    /** The combat meter (0-100) that charges the kingdom's active skill. */
    meter: number;
    /** Fallen in co-op and waiting for a teammate: seconds left; or a teammate down nearby you could help. */
    downed: number | null;
    reviveTarget: string | null;
    /** Holding sprint (the HUD toggle on touch screens). */
    sprint: boolean;
    /** Timed effects from potions and oils, shown as pills (key, seconds left). */
    effects: { key: string; left: number }[];
    /** Inside a house (safe to rest, a hearth to cook at). */
    sheltered: boolean;
}

const listeners = new Set<() => void>();

let state: AppState = {
    phase: 'loading',
    runId: 0,
    gameOver: null,
    loadProgress: 0,
    paused: false,
    tileX: 0,
    tileY: 0,
    height: 0,
    netStatus: 'off',
    roomCode: null,
    online: 0,
    kills: 0,
    playSeconds: 0,
    sharedMonsters: false,
    hp: 6,
    maxHp: 6,
    skills: { attack: 0, defence: 0, speed: 0, vitality: 0 },
    gems: { attack: 0, defence: 0, speed: 0, vitality: 0 },
    shop: false,
    frogAim: null,
    wave: 0,
    nextWaveIn: 0,
    wavesCalm: false,
    wavesHeld: false,
    indoors: null,
    cine: null,
    fighting: false,
    onslaughtLeft: 0,
    waveLeft: null,
    banner: null,
    buffs: [],
    spells: defaultSpellSave(),
    spellState: [0, 1, 2, 3].map(() => ({ charges: 0, max: 1, cd: 0 })),
    toolId: 'none',
    swordIdx: -1,
    swordsOwned: [],
    chunkX: 0,
    chunkY: 0,
    loadedChunks: 0,
    bag: emptyBag(),
    cards: {},
    equipped: [],
    buildings: emptyBuildings(),
    level: 1,
    xp: 0,
    objective: null,
    storyPopup: null,
    storyQueue: [],
    puzzle: null,
    saga: { lyra: null, pressure: null, frost: 0, surge: null, dark: false, invert: false, zones: null, companion: null, wedges: 0, nightIn: null, timer: null, spire: null, mist: 0, sulfur: false, qte: null, hymn: null, carrying: false },
    loom: false,
    debate: false,
    slotsVersion: 0,
    bagTab: null,
    inCamp: false,
    target: null,
    hint: null,
    act: null,
    buildPanel: null,
    bigMap: false,
    kingdom: null,
    wardens: [],
    guards: [],
    malakor: 0,
    gear: { weapon: 0, armor: 0, bp: 0, infusion: null, relics: [], relic: null },
    sockets: [],
    towers: [],
    meters: { hunger: 100, thirst: 100, rest: 100 },
    stamina: { now: 100, max: 100, tired: false },
    region: null,
    weather: 'clear',
    boss: null,
    npc: null,
    house: null,
    travel: false,
    fire: false,
    travelTo: null,
    danger: false,
    hotbar: ['tool_sword', 'tool_axe', 'tool_pickaxe', null],
    held: 0,
    durability: {},
    slots: { used: 0, max: 20 },
    backpack: 0,
    sky: { phase: 'day', dark: 0, left: 0 },
    meter: 0,
    downed: null,
    reviveTarget: null,
    sprint: false,
    effects: [],
    sheltered: false,
};

export const store = {
    /** Read the current state (from game code; in React use useStore). */
    get: (): AppState => state,
    /** Show story pages: at once if nothing is open, else after what is. */
    tell(...pages: StoryPopup[]): void {
        if (pages.length === 0) return;
        if (state.storyPopup) store.patch({ storyQueue: [...state.storyQueue, ...pages] });
        else store.patch({ storyPopup: pages[0], storyQueue: [...state.storyQueue, ...pages.slice(1)] });
    },
    /** Close the open page; the next one waiting takes its place. */
    nextPage(): void {
        const [next, ...rest] = state.storyQueue;
        store.patch({ storyPopup: next ?? null, storyQueue: rest });
    },
    /** Patch the saga HUD (a shallow merge). */
    saga(partial: Partial<SagaHud>): void {
        store.patch({ saga: { ...state.saga, ...partial } });
    },
    /** Shallow-merge a partial update and notify React subscribers. */
    patch(partial: Partial<AppState>): void {
        state = { ...state, ...partial };
        for (const l of listeners) l();
    },
    subscribe(l: () => void): () => void {
        listeners.add(l);
        return () => listeners.delete(l);
    },
};

/**
 * React hook. IMPORTANT: the selector must return a primitive or a stable
 * reference (e.g. s => s.phase). Returning a fresh object/array each call
 * makes React re-render forever.
 */
export function useStore<T = AppState>(
    selector: (s: AppState) => T = (s) => s as unknown as T
): T {
    return useSyncExternalStore(store.subscribe, () => selector(state));
}
