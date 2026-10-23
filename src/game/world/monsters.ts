/**
 * Draws the monsters (the IsometricEnemies pack: goblins, slimes, wolves, skeletons, kobolts, scorpions; later waves send redder / darker colour variants).
 * The newer foes wear the same art, recoloured, resized and dressed: the wizard (a robed skeleton
 * with a pointed hat and a glowing staff), the archer (a hooded kobolt with a bow), the brute (a
 * hulking goblin), the wraith (a pale, flickering skeleton) and the bomber (a fire slime with a
 * burning fuse that flashes as it blows). New ones
 * simply fade in where the simulation puts them (there is no portal).
 * It owns no game logic: each frame it is handed the list of monsters from the
 * simulation (the server's when online, a local one offline) and shows them, easing
 * positions between updates, picking move / attack / die animations from their state,
 * facing the player, flashing when hurt and drawing a health bar once hurt.
 */
import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
type Gear = 'hat' | 'bow' | 'fuse';
import { KINDS } from '../../shared/sim.ts';
import { FACINGS } from './character.ts';
import { TILE_DX, TILE_DY } from './constants.ts';
import { ENEMY_CELL, ENEMY_FEET, ENEMY_SHEETS } from './enemyAtlas.ts';
import { bossInfo, MIMIC_CODE } from '../eidolon.ts';

/** Drawn at 2x for sharpness (like the player); this brings enemies to the player's size. */
const SCALE = 0.5;

/** How each kind looks: size multiplier, health-bar height above the feet (screen px), bounce, frame time. */
const LOOK: Record<string, { size: number; barY: number; hop: number; moveFrameMs: number; base?: string; tint?: number; alpha?: number; gear?: Gear; art?: number }> = {
    goblin: { size: 1.3, barY: 100, hop: 0, moveFrameMs: 150 },
    slime: { size: 1.9, barY: 62, hop: 7, moveFrameMs: 130 },
    wolf: { size: 1.5, barY: 82, hop: 0, moveFrameMs: 90 },
    skeleton: { size: 1.25, barY: 108, hop: 0, moveFrameMs: 150 },
    kobolt: { size: 1.25, barY: 96, hop: 0, moveFrameMs: 110 },
    scorpion: { size: 2.5, barY: 58, hop: 0, moveFrameMs: 140 },
    wizard: { size: 1.3, barY: 132, hop: 0, moveFrameMs: 150, base: 'skeleton', tint: 0xc4a5ff, gear: 'hat' },
    archer: { size: 1.25, barY: 96, hop: 0, moveFrameMs: 110, base: 'kobolt', tint: 0x9ad07a, gear: 'bow' },
    brute: { size: 2.1, barY: 160, hop: 0, moveFrameMs: 190, base: 'goblin', tint: 0xc0906a },
    wraith: { size: 1.3, barY: 108, hop: 0, moveFrameMs: 100, base: 'skeleton', tint: 0x9fe8ff, alpha: 0.55 },
    bomber: { size: 1.6, barY: 60, hop: 9, moveFrameMs: 100, base: 'slime', tint: 0xffd0b0, gear: 'fuse', art: 2 },
};
/** The art a kind is drawn with (the newer foes borrow an older one's). */
const baseOf = (kind: string): string => LOOK[kind]?.base ?? kind;

/** The extras a dressed-up foe wears, in its sprite's own pixels (feet at 0, 0; they flip and scale with it). */
function gearFor(g: Gear): { gfx: Graphics; glow: Graphics } {
    const gfx = new Graphics();
    const glow = new Graphics();
    if (g === 'hat') {
        // A staff with a glowing orb, then a tall pointed hat with a gold band.
        gfx.moveTo(40, -10).lineTo(48, -150).stroke({ width: 8, color: 0x4a2c16 });
        glow.circle(48, -160, 22).fill({ color: 0xc084fc, alpha: 0.35 }).circle(48, -160, 11).fill(0xf5d0fe);
        gfx.ellipse(0, -150, 46, 12).fill(0x4c1d95).stroke({ width: 4, color: 0x1a0c2a });
        gfx.poly([-28, -152, 28, -152, 10, -228, -4, -212]).fill(0x6d28d9).stroke({ width: 4, color: 0x1a0c2a, join: 'round' });
        gfx.rect(-25, -166, 50, 9).fill(0xfbbf24);
    } else if (g === 'bow') {
        gfx.moveTo(30, -36).quadraticCurveTo(66, -80, 30, -124).stroke({ width: 7, color: 0x6b3f1a });
        gfx.moveTo(30, -36).lineTo(30, -124).stroke({ width: 2, color: 0xf5f5f4 });
        gfx.poly([-34, -150, 34, -150, 0, -196]).fill(0x3f6212).stroke({ width: 4, color: 0x14280a, join: 'round' }); // the hood
    } else {
        gfx.moveTo(0, -62).quadraticCurveTo(10, -76, 6, -90).stroke({ width: 5, color: 0x3a2a1a });
        glow.circle(6, -94, 14).fill({ color: 0xffb340, alpha: 0.45 }).circle(6, -94, 6).fill(0xfff1a0);
    }
    gfx.addChild(glow);
    return { gfx, glow };
}
/** The art id of a kind in a colour tier: `goblin`, `goblin_1`, `goblin_2` (see tools/build-enemies.py). */
const artOf = (kind: string, tier: number): string => (tier > 0 ? `${kind}_${tier}` : kind);
const KIND_LIST = [...new Set(Object.keys(LOOK).map(baseOf))];
const DIE_FRAME_MS = 110;
const DYING_FADE_MS = 450;
/** A monster fades in and pops up over this long when it first appears. */
const SPAWN_IN_MS = 550;

/** A monster as the simulation describes it. */
export interface ViewMonster {
    id: number;
    kind: string;
    u: number;
    v: number;
    hp: number;
    max: number;
    state: 'chase' | 'attack' | 'recover' | 'dying';
    /** Ms in the current state (used to start animations in step; the view keeps its own clock after). */
    t: number;
    /** Colour variant (0-2): tougher waves send tougher-looking monsters. */
    tier: number;
    /** Boss code (0 = ordinary; see game/eidolon.ts). */
    boss?: number;
}

interface Shown {
    kind: string;
    /** Which sheets it is drawn from (its kind and colour tier). */
    art: string;
    u: number;
    v: number;
    z: number;
    hp: number;
    state: ViewMonster['state'];
    t: number;
    animT: number;
    /** Ms since it appeared (drives the fade-in). */
    born: number;
    flash: number;
    walking: boolean;
    /** Size multiplier and colour for bosses (1 and white otherwise). */
    big: number;
    tint: number;
    /** A Mimic: drawn as the chest it pretended to be, snapping its lid. */
    mimic: boolean;
    /** What it wears (a hat, a bow, a fuse) and the part of it that glows. */
    gear: { gfx: Graphics; glow: Graphics } | null;
    sprite: Sprite;
    shadow: Sprite;
    bar: Graphics;
}

export interface MonsterView {
    /** Show this list; `smoothMs` eases positions (0 = snap, for a locally simulated list). */
    sync(list: ViewMonster[], dtMs: number, smoothMs: number): void;
    /** Whether a kind's sheets have finished loading. */
    ready(kind: string): boolean;
    destroy(): void;
}

export function createMonsterView(opts: {
    layer: Container;
    shadowTex: Texture;
    heightAt: (u: number, v: number) => number;
    toScreen: (u: number, v: number) => { x: number; y: number };
    /** Depth-sort value for something standing at (u, v). */
    zFor: (u: number, v: number) => number;
    levelH: number;
    player: () => { u: number; v: number };
}): MonsterView {
    // Sheets load in the background; a monster is drawn once its kind's sheets are in.
    const frames = new Map<string, Texture[][]>();
    const ready = new Set<string>();
    let destroyed = false;
    const load = (art: string) =>
        Promise.all((['move', 'attack', 'die'] as const).map(async (anim) => {
            const key = `${art}-${anim}`;
            const sheet = await Assets.load<Texture>({ alias: `enemy:${key}`, src: `images/world/enemy/${key}.png` });
            const cols = ENEMY_SHEETS[key];
            frames.set(key, Array.from({ length: 5 }, (_, row) =>
                Array.from({ length: cols }, (__, col) =>
                    new Texture({ source: sheet.source, frame: new Rectangle(col * ENEMY_CELL, row * ENEMY_CELL, ENEMY_CELL, ENEMY_CELL) }))));
        })).then(() => { if (!destroyed) ready.add(art); }).catch(() => { /* this one just is not drawn */ });
    // The first colour of every kind now; the tougher colours right after (a monster of a colour that is not in yet wears the first).
    void Promise.all(KIND_LIST.map((kind) => load(kind))).then(() => {
        for (const tier of [1, 2]) for (const kind of KIND_LIST) void load(artOf(kind, tier));
    });

    const shown = new Map<number, Shown>();

    const create = (m: ViewMonster): Shown => {
        const look = LOOK[m.kind];
        const base = baseOf(m.kind);
        // (a few foes always wear one colour of their art: the bomber is the red slime)
        const want = artOf(base, look.art ?? m.tier);
        const art = ready.has(want) ? want : base;
        const mimic = m.boss === MIMIC_CODE;
        const sprite = new Sprite(mimic ? Assets.get<Texture>('chest') : frames.get(`${art}-move`)![0][0]);
        const [fx, fy] = ENEMY_FEET[art];
        if (mimic) sprite.anchor.set(0.5, 0.85);
        else sprite.anchor.set(fx / ENEMY_CELL, fy / ENEMY_CELL);
        const info = m.boss ? bossInfo(m.boss) : null;
        const big = mimic ? 1 : info ? (info.rank === 'malakor' ? 2.8 : info.rank === 'warden' ? 2.2 : 1.5) : 1;
        sprite.scale.set(mimic ? 0.9 : SCALE * look.size * big);
        const shadow = new Sprite(opts.shadowTex);
        shadow.anchor.set(0.5);
        shadow.scale.set(0.7 * look.size * big);
        const bar = new Graphics();
        opts.layer.addChild(shadow, sprite, bar);
        const gear = look.gear && !info ? gearFor(look.gear) : null;
        if (gear) sprite.addChild(gear.gfx);
        return {
            kind: m.kind, art, u: m.u, v: m.v, z: opts.heightAt(m.u, m.v) * opts.levelH, hp: m.hp, state: m.state, t: m.t,
            animT: Math.random() * 1000, born: 0, flash: 0, walking: false, big, tint: info?.tint ?? look.tint ?? 0xffffff, mimic, gear, sprite, shadow, bar,
        };
    };
    const dispose = (s: Shown) => {
        s.sprite.destroy();
        s.shadow.destroy();
        s.bar.destroy();
    };

    return {
        ready: (kind) => ready.has(kind),

        sync(list, dtMs, smoothMs) {
            const dt = Math.min(dtMs, 100) / 1000;
            const seen = new Set<number>();
            const p = opts.player();

            for (const m of list) {
                if (!ready.has(baseOf(m.kind))) continue;
                seen.add(m.id);
                let s = shown.get(m.id);
                if (!s) {
                    s = create(m);
                    shown.set(m.id, s);
                }
                // Ease toward the simulation's position (snap if it jumped far, e.g. knockback glitches).
                const prevU = s.u;
                const prevV = s.v;
                const gap = Math.hypot(m.u - s.u, m.v - s.v);
                if (smoothMs <= 0 || gap > 5) {
                    s.u = m.u;
                    s.v = m.v;
                } else {
                    const k = 1 - Math.exp(-dtMs / smoothMs);
                    s.u += (m.u - s.u) * k;
                    s.v += (m.v - s.v) * k;
                }
                s.walking = m.state === 'chase' && Math.hypot(s.u - prevU, s.v - prevV) / Math.max(dt, 0.001) > 0.35;
                if (m.hp < s.hp) s.flash = 150;
                s.hp = m.hp;
                if (m.state !== s.state) {
                    s.state = m.state;
                    s.t = m.t;
                } else {
                    s.t += dtMs;
                }
                s.animT += dtMs;
                s.born += dtMs;
                s.flash = Math.max(0, s.flash - dtMs);

                const look = LOOK[s.kind];
                const def = KINDS[s.kind];
                // Face the player (the screen-space direction to them), using the five-row sheets.
                const du = p.u - s.u;
                const dv = p.v - s.v;
                const sx = (du - dv) * TILE_DX;
                const sy = (du + dv) * TILE_DY;
                const sector = ((Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) % 8) + 8) % 8;
                const face = FACINGS[sector];

                let rows: Texture[][];
                let idx: number;
                let fade = 1;
                if (s.state === 'dying') {
                    rows = frames.get(`${s.art}-die`)!;
                    idx = Math.min(rows[0].length - 1, Math.floor(s.t / DIE_FRAME_MS));
                    const dieMs = rows[0].length * DIE_FRAME_MS;
                    fade = Math.max(0, 1 - Math.max(0, s.t - dieMs) / DYING_FADE_MS);
                } else if (s.state === 'attack') {
                    rows = frames.get(`${s.art}-attack`)!;
                    idx = Math.min(rows[0].length - 1, Math.floor((s.t / def.attackMs) * rows[0].length));
                } else {
                    rows = frames.get(`${s.art}-move`)!;
                    idx = s.walking ? Math.floor(s.animT / look.moveFrameMs) % rows[0].length : 0;
                }
                if (!s.mimic) s.sprite.texture = rows[face.row][idx];
                // Just appeared: fade in with a small overshoot pop.
                const inK = Math.min(1, s.born / SPAWN_IN_MS);
                const pop = 0.7 + 0.3 * inK + 0.12 * Math.sin(inK * Math.PI);
                if (s.mimic) {
                    // Hops along, its lid snapping.
                    const snap = 1 + 0.18 * Math.abs(Math.sin(s.animT / 110));
                    s.sprite.scale.set(0.9 * pop * (face.flip ? -1 : 1), 0.9 * pop * snap);
                    s.sprite.alpha = fade * inK;
                } else s.sprite.scale.set(SCALE * look.size * s.big * pop * (face.flip ? -1 : 1), SCALE * look.size * s.big * pop);
                // A wraith flickers, half there.
                s.sprite.alpha = fade * inK * (look.alpha ? look.alpha + 0.18 * Math.sin(s.animT / 90) : 1);
                // A bomber's fuse burning down: it flashes faster and faster.
                const fusing = s.kind === 'bomber' && s.state === 'attack';
                const blink = fusing && Math.sin(s.t / Math.max(25, 90 - s.t / 10)) > 0;
                s.sprite.tint = s.flash > 0 || blink ? 0xffb0b0 : s.mimic ? 0xffd6d6 : s.tint;
                if (blink) s.sprite.tint = 0xffffff;
                if (s.gear) s.gear.glow.alpha = 0.6 + 0.4 * Math.sin(s.animT / (fusing ? 40 : 160));

                // Place on the terrain, with a little hop while moving.
                s.z += (opts.heightAt(s.u, s.v) * opts.levelH - s.z) * Math.min(1, 12 * dt);
                const pos = opts.toScreen(s.u, s.v);
                const hop = s.walking && look.hop ? Math.abs(Math.sin(s.animT / 160)) * look.hop : 0;
                s.sprite.position.set(pos.x, pos.y - s.z - hop);
                s.shadow.position.set(pos.x, pos.y - s.z + 2);
                s.shadow.alpha = fade * inK;
                const z = opts.zFor(s.u, s.v);
                s.sprite.zIndex = z - 0.1;
                s.shadow.zIndex = z - 0.3;
                s.bar.zIndex = 1e6 - 1;

                s.bar.clear();
                if ((m.hp < m.max || s.big > 1) && s.state !== 'dying') {
                    const w = 30 * s.big;
                    const x = pos.x;
                    const y = pos.y - s.z - look.barY * s.big;
                    s.bar.rect(x - w / 2, y, w, 5).fill({ color: 0x1a0c10, alpha: 0.85 });
                    s.bar.rect(x - w / 2 + 1, y + 1, (w - 2) * Math.max(0, m.hp / m.max), 3).fill(0xef4444);
                }
            }
            for (const [id, s] of shown) {
                if (!seen.has(id)) {
                    dispose(s);
                    shown.delete(id);
                }
            }
        },

        destroy() {
            destroyed = true;
            for (const s of shown.values()) dispose(s);
            shown.clear();
        },
    };
}
