/**
 * Enemies from the IsometricEnemies pack: goblins, slimes, wolves and skeletons.
 * The wave portal (waves.ts) spawns them; they hunt the player, attack when close (each kind
 * has its own speed, health, reach and timing) and die with their death animation.
 * The player's swings hit those in front of them with knockback; a health bar shows
 * once an enemy is hurt. Enemies live only on this device: they hunt the local
 * player, and other players in the room do not see them.
 */
import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { FACINGS } from './character.ts';
import { TILE_DX, TILE_DY } from './constants.ts';
import { ENEMY_CELL, ENEMY_FEET, ENEMY_SHEETS } from './enemyAtlas.ts';

/** Drawn at 2x for sharpness (like the player); this brings enemies to the player's size. */
const SCALE = 0.5;

interface Kind {
    hp: number;
    /** Tiles per second. */
    speed: number;
    /** Distance at which it starts an attack, and the farthest a landing attack still hits. */
    reach: number;
    /** Time the attack animation plays, ms, and the fraction of it at which the hit lands. */
    attackMs: number;
    hitAt: number;
    recoverMs: number;
    moveFrameMs: number;
    /** Sprite scale multiplier, health-bar height above the feet (screen px), and a bounce while moving. */
    size: number;
    barY: number;
    hop: number;
    weight: number;
}

const KINDS: Record<string, Kind> = {
    goblin: { hp: 5, speed: 2.3, reach: 1.05, attackMs: 560, hitAt: 0.55, recoverMs: 1300, moveFrameMs: 150, size: 1.3, barY: 100, hop: 0, weight: 3 },
    slime: { hp: 4, speed: 1.5, reach: 0.95, attackMs: 640, hitAt: 0.6, recoverMs: 1500, moveFrameMs: 130, size: 1.9, barY: 62, hop: 7, weight: 3 },
    wolf: { hp: 6, speed: 3.5, reach: 1.15, attackMs: 440, hitAt: 0.5, recoverMs: 1300, moveFrameMs: 90, size: 1.5, barY: 82, hop: 0, weight: 2 },
    skeleton: { hp: 8, speed: 1.9, reach: 1.1, attackMs: 720, hitAt: 0.6, recoverMs: 1600, moveFrameMs: 150, size: 1.25, barY: 108, hop: 0, weight: 2 },
};
export const KIND_NAMES = Object.keys(KINDS);

const LEASH = 40;
const DYING_FADE_MS = 450;
/** How far in front of the player a swing reaches, and how wide (radians either side of facing). */
const REACH = 1.9;
const ARC = 1.3;

type State = 'chase' | 'attack' | 'recover' | 'dying';

interface Monster {
    kind: string;
    def: Kind;
    u: number;
    v: number;
    z: number;
    hp: number;
    maxHp: number;
    speedMul: number;
    damage: number;
    state: State;
    t: number;
    /** Knockback velocity, tiles / s, decaying. */
    ku: number;
    kv: number;
    flash: number;
    animT: number;
    hit: boolean;
    /** Which way to sidestep when blocked. */
    side: 1 | -1;
    sprite: Sprite;
    shadow: Sprite;
    bar: Graphics;
}

export interface Monsters {
    update(dtMs: number): void;
    /** Whether a kind's sheets have finished loading (it cannot be spawned before). */
    ready(kind: string): boolean;
    /** Put a monster of `kind` at (u, v); `hpMul` / `speedMul` toughen it, `damage` is its bite in half hearts. */
    spawn(kind: string, u: number, v: number, mods: { hpMul: number; speedMul: number; damage: number }): void;
    /** How many are alive (not counting ones already dying). */
    alive(): number;
    /** A player swing from (u, v) facing a 0-7 sector: damages enemies in reach; returns how many it killed. */
    strike(u: number, v: number, facing: number, damage: number): number;
    destroy(): void;
}

export function createMonsters(opts: {
    layer: Container;
    shadowTex: Texture;
    /** Whether an enemy may step from one spot to another (they push through plants; water and cliffs stop them). */
    canMove: (fromU: number, fromV: number, toU: number, toV: number) => boolean;
    heightAt: (u: number, v: number) => number;
    toScreen: (u: number, v: number) => { x: number; y: number };
    /** Depth-sort value for something standing at (u, v). */
    zFor: (u: number, v: number) => number;
    levelH: number;
    player: () => { u: number; v: number; alive: boolean };
    onBite: (damage: number) => void;
    /** An enemy died at (u, v). */
    onKill: (kind: string, u: number, v: number) => void;
}): Monsters {
    // Sheets load in the background; a kind spawns once all three of its sheets are in.
    const frames = new Map<string, Texture[][]>();
    const ready = new Set<string>();
    let destroyed = false;
    for (const kind of KIND_NAMES) {
        Promise.all((['move', 'attack', 'die'] as const).map(async (anim) => {
            const key = `${kind}-${anim}`;
            const sheet = await Assets.load<Texture>({ alias: `enemy:${key}`, src: `images/world/enemy/${key}.png` });
            const cols = ENEMY_SHEETS[key];
            frames.set(key, Array.from({ length: 5 }, (_, row) =>
                Array.from({ length: cols }, (__, col) =>
                    new Texture({ source: sheet.source, frame: new Rectangle(col * ENEMY_CELL, row * ENEMY_CELL, ENEMY_CELL, ENEMY_CELL) }))));
        })).then(() => { if (!destroyed) ready.add(kind); }).catch(() => { /* this kind just never spawns */ });
    }

    const monsters: Monster[] = [];

    const make = (kind: string, u: number, v: number, mods: { hpMul: number; speedMul: number; damage: number }): Monster => {
        const def = KINDS[kind];
        const sprite = new Sprite(frames.get(`${kind}-move`)![0][0]);
        const [fx, fy] = ENEMY_FEET[kind];
        sprite.anchor.set(fx / ENEMY_CELL, fy / ENEMY_CELL);
        sprite.scale.set(SCALE * def.size);
        const shadow = new Sprite(opts.shadowTex);
        shadow.anchor.set(0.5);
        shadow.scale.set(0.7 * def.size);
        const bar = new Graphics();
        opts.layer.addChild(shadow, sprite, bar);
        return {
            kind, def, u, v, z: opts.heightAt(u, v) * opts.levelH, hp: Math.round(def.hp * mods.hpMul), maxHp: Math.round(def.hp * mods.hpMul),
            speedMul: mods.speedMul, damage: mods.damage, state: 'chase', t: 0,
            ku: 0, kv: 0, flash: 0, animT: Math.random() * 1000, hit: false, side: Math.random() < 0.5 ? 1 : -1,
            sprite, shadow, bar,
        };
    };
    const dispose = (m: Monster) => {
        m.sprite.destroy();
        m.shadow.destroy();
        m.bar.destroy();
    };

    /** Move by (du, dv) if the new spot is free, sliding along obstacles. */
    const step = (m: Monster, du: number, dv: number): boolean => {
        let moved = false;
        if (du !== 0 && opts.canMove(m.u, m.v, m.u + du, m.v)) { m.u += du; moved = true; }
        if (dv !== 0 && opts.canMove(m.u, m.v, m.u, m.v + dv)) { m.v += dv; moved = true; }
        return moved;
    };

    const drawBar = (m: Monster, x: number, y: number) => {
        m.bar.clear();
        if (m.hp >= m.maxHp || m.state === 'dying') return;
        const w = 30;
        m.bar.rect(x - w / 2, y, w, 5).fill({ color: 0x1a0c10, alpha: 0.85 });
        m.bar.rect(x - w / 2 + 1, y + 1, (w - 2) * Math.max(0, m.hp / m.maxHp), 3).fill(0xef4444);
    };

    return {
        ready: (kind) => ready.has(kind),
        spawn(kind, u, v, mods) {
            if (!ready.has(kind)) return;
            monsters.push(make(kind, u, v, mods));
        },
        alive: () => monsters.filter((m) => m.state !== 'dying').length,

        update(dtMs) {
            const dt = Math.min(dtMs, 100) / 1000;
            const p = opts.player();

            for (let i = monsters.length - 1; i >= 0; i--) {
                const m = monsters[i];
                const def = m.def;
                const du = p.u - m.u;
                const dv = p.v - m.v;
                const dist = Math.hypot(du, dv);
                const dieFrames = frames.get(`${m.kind}-die`)![0].length;
                const dieMs = dieFrames * 110;
                if (dist > LEASH || (m.state === 'dying' && m.t > dieMs + DYING_FADE_MS)) {
                    dispose(m);
                    monsters.splice(i, 1);
                    continue;
                }
                m.t += dtMs;
                m.animT += dtMs;
                m.flash = Math.max(0, m.flash - dtMs);

                // Knockback glides and fades.
                if (Math.abs(m.ku) + Math.abs(m.kv) > 0.05) {
                    step(m, m.ku * dt, m.kv * dt);
                    const decay = Math.exp(-dt * 7);
                    m.ku *= decay;
                    m.kv *= decay;
                }

                let walking = false;
                if (m.state === 'chase' && p.alive) {
                    if (dist < def.reach) {
                        m.state = 'attack';
                        m.t = 0;
                        m.hit = false;
                    } else {
                        const k = (def.speed * m.speedMul * dt) / dist;
                        let moved = step(m, du * k, dv * k);
                        // Blocked: sidestep around whatever is in the way.
                        if (!moved) moved = step(m, -dv * k * m.side, du * k * m.side);
                        if (!moved) m.side = m.side === 1 ? -1 : 1;
                        walking = moved;
                    }
                } else if (m.state === 'attack') {
                    if (!m.hit && m.t >= def.attackMs * def.hitAt) {
                        m.hit = true;
                        if (p.alive && dist < def.reach + 0.45) opts.onBite(m.damage);
                    }
                    if (m.t >= def.attackMs) {
                        m.state = 'recover';
                        m.t = 0;
                    }
                } else if (m.state === 'recover' && m.t >= def.recoverMs) {
                    m.state = 'chase';
                    m.t = 0;
                }

                // Face the player (the screen-space direction to them), using the five-row sheets.
                const sx = (du - dv) * TILE_DX;
                const sy = (du + dv) * TILE_DY;
                const sector = ((Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) % 8) + 8) % 8;
                const face = FACINGS[sector];

                let rows: Texture[][];
                let idx: number;
                if (m.state === 'dying') {
                    rows = frames.get(`${m.kind}-die`)!;
                    idx = Math.min(rows[0].length - 1, Math.floor(m.t / 110));
                } else if (m.state === 'attack') {
                    rows = frames.get(`${m.kind}-attack`)!;
                    idx = Math.min(rows[0].length - 1, Math.floor((m.t / def.attackMs) * rows[0].length));
                } else {
                    rows = frames.get(`${m.kind}-move`)!;
                    idx = walking ? Math.floor(m.animT / def.moveFrameMs) % rows[0].length : 0;
                }
                m.sprite.texture = rows[face.row][idx];
                const fade = m.state === 'dying' ? Math.max(0, 1 - Math.max(0, m.t - dieMs) / DYING_FADE_MS) : 1;
                m.sprite.scale.set(SCALE * def.size * (face.flip ? -1 : 1), SCALE * def.size);
                m.sprite.alpha = fade;
                m.sprite.tint = m.flash > 0 ? 0xffb0b0 : 0xffffff;

                // Place on the terrain, with a little hop while moving.
                m.z += (opts.heightAt(m.u, m.v) * opts.levelH - m.z) * Math.min(1, 12 * dt);
                const pos = opts.toScreen(m.u, m.v);
                const hop = walking && def.hop ? Math.abs(Math.sin(m.animT / 160)) * def.hop : 0;
                m.sprite.position.set(pos.x, pos.y - m.z - hop);
                m.shadow.position.set(pos.x, pos.y - m.z + 2);
                m.shadow.alpha = fade;
                const z = opts.zFor(m.u, m.v);
                m.sprite.zIndex = z - 0.1;
                m.shadow.zIndex = z - 0.3;
                m.bar.zIndex = 1e6 - 1;
                drawBar(m, pos.x, pos.y - m.z - def.barY);
            }
        },

        strike(pu, pv, facing, damage) {
            let kills = 0;
            const aim = (facing * Math.PI) / 4;
            for (const m of monsters) {
                if (m.state === 'dying') continue;
                const du = m.u - pu;
                const dv = m.v - pv;
                const dist = Math.hypot(du, dv);
                if (dist > REACH) continue;
                // Screen-space direction to the enemy, in the same units as the joystick's facing.
                const sx = (du - dv) * TILE_DX;
                const sy = (du + dv) * TILE_DY * 2;
                let diff = Math.abs(Math.atan2(sy, sx) - aim);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                if (dist > 0.9 && diff > ARC) continue;
                m.hp -= damage;
                m.flash = 150;
                const kd = dist || 1;
                m.ku = (du / kd) * 7;
                m.kv = (dv / kd) * 7;
                if (m.hp <= 0) {
                    m.state = 'dying';
                    m.t = 0;
                    kills++;
                    opts.onKill(m.kind, m.u, m.v);
                } else if (m.state === 'attack') {
                    // A hit interrupts the attack.
                    m.state = 'recover';
                    m.t = 0;
                }
            }
            return kills;
        },

        destroy() {
            destroyed = true;
            for (const m of monsters) dispose(m);
            monsters.length = 0;
        },
    };
}
