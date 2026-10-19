/**
 * Draws the monsters (the IsometricEnemies pack: goblins, slimes, wolves, skeletons).
 * It owns no game logic: each frame it is handed the list of monsters from the
 * simulation (the server's when online, a local one offline) and shows them, easing
 * positions between updates, picking move / attack / die animations from their state,
 * facing the player, flashing when hurt and drawing a health bar once hurt.
 */
import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { KINDS } from '../../shared/sim.ts';
import { FACINGS } from './character.ts';
import { TILE_DX, TILE_DY } from './constants.ts';
import { ENEMY_CELL, ENEMY_FEET, ENEMY_SHEETS } from './enemyAtlas.ts';

/** Drawn at 2x for sharpness (like the player); this brings enemies to the player's size. */
const SCALE = 0.5;

/** How each kind looks: size multiplier, health-bar height above the feet (screen px), bounce, frame time. */
const LOOK: Record<string, { size: number; barY: number; hop: number; moveFrameMs: number }> = {
    goblin: { size: 1.3, barY: 100, hop: 0, moveFrameMs: 150 },
    slime: { size: 1.9, barY: 62, hop: 7, moveFrameMs: 130 },
    wolf: { size: 1.5, barY: 82, hop: 0, moveFrameMs: 90 },
    skeleton: { size: 1.25, barY: 108, hop: 0, moveFrameMs: 150 },
};
const KIND_LIST = Object.keys(LOOK);
const DIE_FRAME_MS = 110;
const DYING_FADE_MS = 450;

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
}

interface Shown {
    kind: string;
    u: number;
    v: number;
    z: number;
    hp: number;
    state: ViewMonster['state'];
    t: number;
    animT: number;
    flash: number;
    walking: boolean;
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
    for (const kind of KIND_LIST) {
        Promise.all((['move', 'attack', 'die'] as const).map(async (anim) => {
            const key = `${kind}-${anim}`;
            const sheet = await Assets.load<Texture>({ alias: `enemy:${key}`, src: `images/world/enemy/${key}.png` });
            const cols = ENEMY_SHEETS[key];
            frames.set(key, Array.from({ length: 5 }, (_, row) =>
                Array.from({ length: cols }, (__, col) =>
                    new Texture({ source: sheet.source, frame: new Rectangle(col * ENEMY_CELL, row * ENEMY_CELL, ENEMY_CELL, ENEMY_CELL) }))));
        })).then(() => { if (!destroyed) ready.add(kind); }).catch(() => { /* this kind just is not drawn */ });
    }

    const shown = new Map<number, Shown>();

    const create = (m: ViewMonster): Shown => {
        const look = LOOK[m.kind];
        const sprite = new Sprite(frames.get(`${m.kind}-move`)![0][0]);
        const [fx, fy] = ENEMY_FEET[m.kind];
        sprite.anchor.set(fx / ENEMY_CELL, fy / ENEMY_CELL);
        sprite.scale.set(SCALE * look.size);
        const shadow = new Sprite(opts.shadowTex);
        shadow.anchor.set(0.5);
        shadow.scale.set(0.7 * look.size);
        const bar = new Graphics();
        opts.layer.addChild(shadow, sprite, bar);
        return {
            kind: m.kind, u: m.u, v: m.v, z: opts.heightAt(m.u, m.v) * opts.levelH, hp: m.hp, state: m.state, t: m.t,
            animT: Math.random() * 1000, flash: 0, walking: false, sprite, shadow, bar,
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
                if (!ready.has(m.kind)) continue;
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
                    rows = frames.get(`${s.kind}-die`)!;
                    idx = Math.min(rows[0].length - 1, Math.floor(s.t / DIE_FRAME_MS));
                    const dieMs = rows[0].length * DIE_FRAME_MS;
                    fade = Math.max(0, 1 - Math.max(0, s.t - dieMs) / DYING_FADE_MS);
                } else if (s.state === 'attack') {
                    rows = frames.get(`${s.kind}-attack`)!;
                    idx = Math.min(rows[0].length - 1, Math.floor((s.t / def.attackMs) * rows[0].length));
                } else {
                    rows = frames.get(`${s.kind}-move`)!;
                    idx = s.walking ? Math.floor(s.animT / look.moveFrameMs) % rows[0].length : 0;
                }
                s.sprite.texture = rows[face.row][idx];
                s.sprite.scale.set(SCALE * look.size * (face.flip ? -1 : 1), SCALE * look.size);
                s.sprite.alpha = fade;
                s.sprite.tint = s.flash > 0 ? 0xffb0b0 : 0xffffff;

                // Place on the terrain, with a little hop while moving.
                s.z += (opts.heightAt(s.u, s.v) * opts.levelH - s.z) * Math.min(1, 12 * dt);
                const pos = opts.toScreen(s.u, s.v);
                const hop = s.walking && look.hop ? Math.abs(Math.sin(s.animT / 160)) * look.hop : 0;
                s.sprite.position.set(pos.x, pos.y - s.z - hop);
                s.shadow.position.set(pos.x, pos.y - s.z + 2);
                s.shadow.alpha = fade;
                const z = opts.zFor(s.u, s.v);
                s.sprite.zIndex = z - 0.1;
                s.shadow.zIndex = z - 0.3;
                s.bar.zIndex = 1e6 - 1;

                s.bar.clear();
                if (m.hp < m.max && s.state !== 'dying') {
                    const w = 30;
                    const x = pos.x;
                    const y = pos.y - s.z - look.barY;
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
