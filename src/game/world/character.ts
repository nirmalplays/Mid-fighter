/**
 * The player character (Character0 art): 5 facing rows (right-facing mirrors the
 * left), a movement layer (idle / walk / run) and one-shot actions (attack, use,
 * interact, dig, fish, sit, hurt, die), each with tool variants. Sheets for the
 * equipped tool load on demand; until one arrives the bare-handed sheet stands in.
 */
import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import type { GameCommand } from '../commands.ts';
import { CHAR_CELL, CHAR_FEET_X, CHAR_FEET_Y, CHAR_SHEETS } from './characterAtlas.ts';

/** Drawn at 2x for sharpness on dense phone screens; this brings it to ~66 world px tall. */
const SCALE = 0.5;

export const TOOLS = ['none', 'sword', 'axe', 'pickaxe', 'hammer', 'shovel', 'fishingpole', 'watercan', 'shield', 'hold'] as const;
export type Tool = (typeof TOOLS)[number];
/** The nine hotbar slots, in order: bare hands first, then the tools. ('hold' is not a slot.) */
export const HOTBAR: readonly Tool[] = ['none', 'sword', 'axe', 'pickaxe', 'hammer', 'shovel', 'fishingpole', 'watercan', 'shield'];
export const TOOL_LABELS: Record<Tool, string> = {
    none: 'Bare hands', sword: 'Sword', axe: 'Axe', pickaxe: 'Pickaxe', hammer: 'Hammer', shovel: 'Shovel',
    fishingpole: 'Fishing pole', watercan: 'Watering can', shield: 'Shield', hold: 'Carrying',
};

/** Facing by 45° sector of the screen-space direction (0 = right, clockwise): sheet row and mirroring. */
export const FACINGS: { row: number; flip: boolean }[] = [
    { row: 2, flip: true }, { row: 1, flip: true }, { row: 0, flip: false }, { row: 1, flip: false },
    { row: 2, flip: false }, { row: 3, flip: false }, { row: 4, flip: false }, { row: 3, flip: true },
];

/** Milliseconds per frame, by action. */
const FRAME_MS: Record<string, number> = {
    idle: 170, walk: 120, run: 95, attack: 80, swing: 85, interact: 140, dig: 120, fish: 150,
    sit: 130, getup: 110, damage: 120, die: 150,
};

const attackKey = (t: Tool): string =>
    t === 'sword' ? 'attack:sword' : t === 'axe' ? 'swing:axe' : t === 'pickaxe' ? 'swing:pickaxe' : t === 'hammer' ? 'swing:hammer' : 'attack';
const useKey = (t: Tool): string => {
    switch (t) {
        case 'sword': return 'interact:sword';
        case 'axe': return 'swing:axe';
        case 'pickaxe': return 'swing:pickaxe';
        case 'hammer': return 'swing:hammer';
        case 'shovel': return 'dig:shovel';
        case 'fishingpole': return 'fish:fishingpole';
        case 'watercan': return 'interact:watercan';
        case 'shield': return 'interact:shield';
        case 'hold': return 'interact:hold';
        default: return 'interact';
    }
};

type Mode = 'move' | 'act' | 'seated' | 'dead';

interface ActState {
    key: string;
    clock: number;
    /** Keep the last frame after the animation ends (sit, die). */
    hold: boolean;
    /** What to switch to when it ends. */
    then: Mode;
    tint?: number;
}

export interface Character {
    /** Add to the sorted world layer; origin is the character's feet. */
    player: Container;
    /** Faint copy to draw above everything. */
    xray: Container;
    /** True while an action, sitting or death holds the character in place. */
    readonly locked: boolean;
    readonly dead: boolean;
    readonly seated: boolean;
    readonly tool: Tool;
    /** Facing sector 0-7 (0 = right, clockwise), and the current movement animation. */
    readonly facing: number;
    readonly anim: 'idle' | 'walk' | 'run';
    /** For remote players: set the tool and facing directly instead of from input. */
    setTool(tool: Tool): void;
    setFacing(sector: number): void;
    command(c: GameCommand): void;
    /** Call once per frame; `dir` is the input vector, `moved` whether the character actually moved. */
    update(dtMs: number, dir: { x: number; y: number }, moved: boolean): void;
    destroy(): void;
}

export function createCharacter(onTool: (tool: Tool) => void): Character {
    const frames = new Map<string, Texture[][]>();
    const loading = new Map<string, Promise<void>>();

    const sheetOf = (key: string): Texture[][] | undefined => frames.get(key);
    const load = (key: string): Promise<void> => {
        if (!CHAR_SHEETS[key]) return Promise.resolve();
        let p = loading.get(key);
        if (!p) {
            const cols = CHAR_SHEETS[key];
            p = Assets.load<Texture>({ alias: `char:${key}`, src: `images/world/char/${key.replace(':', '-')}.png` })
                .then((sheet) => {
                    frames.set(key, Array.from({ length: 5 }, (_, row) =>
                        Array.from({ length: cols }, (__, col) =>
                            new Texture({ source: sheet.source, frame: new Rectangle(col * CHAR_CELL, row * CHAR_CELL, CHAR_CELL, CHAR_CELL) }))));
                })
                .catch(() => { /* a missing sheet just keeps the fallback */ });
            loading.set(key, p);
        }
        return p;
    };
    const loadTool = (t: Tool) => {
        for (const key of Object.keys(CHAR_SHEETS)) if (t === 'none' ? !key.includes(':') : key.endsWith(`:${t}`)) void load(key);
    };
    // Bare-handed sheets arrive in the background; idle / walk / run are already warmed at boot.
    loadTool('none');

    /** Best loaded sheet for an action with the current tool, falling back to bare hands. */
    const resolve = (action: string, tool: Tool): Texture[][] | undefined => {
        const chain: string[] = [];
        if (tool !== 'none') {
            chain.push(`${action}:${tool}`);
            if (action === 'walk') chain.push(`run:${tool}`);
            if (action === 'run') chain.push(`walk:${tool}`);
        }
        chain.push(action);
        for (const k of chain) {
            if (CHAR_SHEETS[k]) void load(k);
            const s = sheetOf(k);
            if (s) return s;
        }
        return sheetOf('idle');
    };
    const resolveKey = (key: string, tool: Tool): Texture[][] | undefined => {
        // A fully-specified key ("swing:axe"); fall back to its bare action.
        if (CHAR_SHEETS[key]) void load(key);
        return sheetOf(key) ?? resolve(key.split(':')[0], 'none');
    };

    const makeBody = (): Sprite => {
        const b = new Sprite(Texture.EMPTY);
        b.anchor.set(CHAR_FEET_X / CHAR_CELL, CHAR_FEET_Y / CHAR_CELL);
        b.scale.set(SCALE);
        return b;
    };
    const player = new Container();
    const body = makeBody();
    const shadow = new Graphics().ellipse(0, 0, 20, 9).fill({ color: 0x000000, alpha: 0.3 });
    player.addChild(shadow, body);
    const xray = new Container();
    const xrayBody = makeBody();
    xray.addChild(xrayBody);
    xray.alpha = 0.3;

    let tool: Tool = 'none';
    let facing = 2; // front
    let mode: Mode = 'move';
    let act: ActState | null = null;
    let clock = 0;
    let lastAnim = 'idle';
    let shown: Texture | null = null;

    const start = (key: string, opts: Partial<ActState> = {}) => {
        act = { key, clock: 0, hold: false, then: 'move', ...opts };
        mode = 'act';
    };

    const getUpKey = () => (tool === 'none' ? 'getup' : `getup:${tool}`);

    const command = (c: GameCommand) => {
        if (c.type === 'tool' || c.type === 'equip') {
            if (mode === 'dead') return;
            if (c.type === 'equip') {
                if (!(HOTBAR as readonly string[]).includes(c.tool)) return;
                tool = c.tool as Tool;
            } else {
                const at = Math.max(0, HOTBAR.indexOf(tool));
                tool = HOTBAR[(at + c.delta + HOTBAR.length) % HOTBAR.length];
            }
            loadTool(tool);
            onTool(tool);
            return;
        }
        // Dead or seated characters only respond to getting up.
        if (mode === 'dead') {
            if (c.type === 'die' || c.type === 'sit') start(getUpKey(), { then: 'move' });
            return;
        }
        if (mode === 'seated') {
            if (c.type === 'sit') start(getUpKey(), { then: 'move' });
            return;
        }
        if (mode === 'act') return;
        switch (c.type) {
            case 'attack': start(attackKey(tool)); break;
            case 'use': start(useKey(tool)); break;
            case 'interact': start(tool === 'none' ? 'interact' : `interact:${tool}`); break;
            case 'dig': start(tool === 'shovel' ? 'dig:shovel' : 'dig'); break;
            case 'fish': start(tool === 'fishingpole' ? 'fish:fishingpole' : 'fish'); break;
            case 'sit': start(tool === 'none' ? 'sit' : `sit:${tool}`, { hold: true, then: 'seated' }); break;
            case 'hurt': start(tool === 'none' ? 'damage' : `damage:${tool}`, { tint: 0xff9a9a }); break;
            case 'die': start('die', { hold: true, then: 'dead' }); break;
        }
    };

    const setFrame = (tex: Texture | undefined, flip: boolean, tint: number) => {
        if (tex && tex !== shown) {
            shown = tex;
            body.texture = tex;
            xrayBody.texture = tex;
        }
        const sx = flip ? -SCALE : SCALE;
        if (body.scale.x !== sx) {
            body.scale.x = sx;
            xrayBody.scale.x = sx;
        }
        if (body.tint !== tint) body.tint = tint;
    };

    const update = (dtMs: number, dir: { x: number; y: number }, moved: boolean) => {
        const push = Math.hypot(dir.x, dir.y);
        if (push > 0.12 && mode === 'move') {
            facing = ((Math.round(Math.atan2(dir.y, dir.x) / (Math.PI / 4)) % 8) + 8) % 8;
        }
        const face = FACINGS[facing];

        // Pushing the stick while seated stands the character up.
        if (mode === 'seated' && push > 0.25) start(getUpKey(), { then: 'move' });

        if (mode === 'act' && act) {
            act.clock += dtMs;
            const action = act.key.split(':')[0];
            const sheet = resolveKey(act.key, tool);
            const row = sheet?.[face.row];
            const ms = FRAME_MS[action] ?? 110;
            const idx = Math.floor(act.clock / ms);
            if (row && idx >= row.length) {
                if (act.hold) {
                    setFrame(row[row.length - 1], face.flip, 0xffffff);
                    mode = act.then;
                    act = null;
                    return;
                }
                mode = act.then;
                act = null;
                clock = 0;
            } else if (row) {
                setFrame(row[idx], face.flip, act.tint ?? 0xffffff);
                return;
            }
            if (mode === 'act') return; // sheet still loading: wait on the fallback frame
        }
        if (mode === 'seated' || mode === 'dead') return; // holding the last frame

        const anim = push > 0.12 && moved ? (push > 0.6 ? 'run' : 'walk') : 'idle';
        if (anim !== lastAnim) {
            lastAnim = anim;
            clock = 0;
        }
        clock += dtMs;
        const sheet = resolve(anim, tool);
        const row = sheet?.[face.row];
        if (row) setFrame(row[Math.floor(clock / FRAME_MS[anim]) % row.length], face.flip, 0xffffff);
    };

    return {
        player,
        xray,
        get locked() { return mode !== 'move'; },
        get dead() { return mode === 'dead'; },
        get seated() { return mode === 'seated'; },
        get facing() { return facing; },
        get anim() { return lastAnim as 'idle' | 'walk' | 'run'; },
        setTool(t: Tool) {
            if (t === tool) return;
            tool = t;
            loadTool(t);
        },
        setFacing(sector: number) {
            facing = ((Math.round(sector) % 8) + 8) % 8;
        },
        get tool() { return tool; },
        command,
        update,
        destroy() {
            player.destroy({ children: true });
            xray.destroy({ children: true });
        },
    };
}
