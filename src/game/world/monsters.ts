/**
 * Angry frogs (the Isometric Frog Character art, tinted red). They spawn out of
 * sight around the player, hop toward them, lunge when close and bite for half a
 * heart. The player's swings hit those in front of them with knockback, and a
 * health bar shows once a frog is hurt. Monsters live only on this device: they
 * hunt the local player, and other players in the room do not see them.
 */
import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { TILE_DX, TILE_DY } from './constants.ts';

/** Frog sheet layout (see tools/build-monsters.py): 133 px cells, back view below the front view. */
const CELL = 133;
const BACK_Y0 = 399;
const FRONT_ANCHOR = { x: 69 / CELL, y: 127 / CELL };
const BACK_ANCHOR = { x: 70 / CELL, y: 122 / CELL };
/** (column, row) of each frame. */
const FRONT_WALK: [number, number][] = [[0, 2], [1, 2], [2, 2], [1, 2]];
const FRONT_IDLE: [number, number] = [0, 0];
const FRONT_BITE: [number, number] = [0, 1];
const BACK_WALK: [number, number][] = [[0, 1], [1, 1], [2, 1], [3, 1]];
const BACK_IDLE: [number, number] = [0, 0];
const SCALE = 0.5;
const ANGRY = 0xff9484;

const MAX_HP = 6;
const SPEED = 2.3; // tiles / s
const MAX_ALIVE = 4;
const SPAWN_EVERY_MS = 6000;
const FIRST_SPAWN_MS = 3500;
const SPAWN_MIN = 9;
const SPAWN_MAX = 13;
const LEASH = 26;
const BITE_RANGE = 1.05;
const WINDUP_MS = 380;
const RECOVER_MS = 950;
const DYING_MS = 520;
/** How far in front of the player a swing reaches, and how wide (radians either side of facing). */
const REACH = 1.9;
const ARC = 1.3;

type State = 'chase' | 'windup' | 'recover' | 'dying';

interface Monster {
    u: number;
    v: number;
    z: number;
    hp: number;
    shownHp: number;
    state: State;
    t: number;
    /** Knockback velocity, tiles / s, decaying. */
    ku: number;
    kv: number;
    flash: number;
    animT: number;
    /** Which way to sidestep when blocked. */
    side: 1 | -1;
    sprite: Sprite;
    shadow: Sprite;
    bar: Graphics;
}

export interface Monsters {
    update(dtMs: number): void;
    /** A player swing from (u, v) facing a 0-7 sector: damages frogs in reach; returns how many it killed. */
    strike(u: number, v: number, facing: number, damage: number): number;
    destroy(): void;
}

export function createMonsters(opts: {
    layer: Container;
    shadowTex: Texture;
    canStand: (u: number, v: number) => boolean;
    heightAt: (u: number, v: number) => number;
    toScreen: (u: number, v: number) => { x: number; y: number };
    /** Depth-sort value for something standing at (u, v). */
    zFor: (u: number, v: number) => number;
    levelH: number;
    player: () => { u: number; v: number; alive: boolean };
    onBite: (damage: number) => void;
    onKill: () => void;
}): Monsters {
    const sheet = Assets.get<Texture>('frog');
    sheet.source.scaleMode = 'linear';
    const texCache = new Map<string, Texture>();
    const tex = (back: boolean, [c, r]: [number, number]): Texture => {
        const k = `${back ? 'b' : 'f'}${c},${r}`;
        let t = texCache.get(k);
        if (!t) {
            t = new Texture({ source: sheet.source, frame: new Rectangle(c * CELL, (back ? BACK_Y0 : 0) + r * CELL, CELL, CELL) });
            texCache.set(k, t);
        }
        return t;
    };

    const monsters: Monster[] = [];
    let spawnClock = FIRST_SPAWN_MS;

    const make = (u: number, v: number): Monster => {
        const sprite = new Sprite(tex(false, FRONT_IDLE));
        sprite.anchor.set(FRONT_ANCHOR.x, FRONT_ANCHOR.y);
        sprite.scale.set(SCALE);
        sprite.tint = ANGRY;
        const shadow = new Sprite(opts.shadowTex);
        shadow.anchor.set(0.5);
        shadow.scale.set(0.8);
        const bar = new Graphics();
        opts.layer.addChild(shadow, sprite, bar);
        return {
            u, v, z: opts.heightAt(u, v) * opts.levelH, hp: MAX_HP, shownHp: MAX_HP, state: 'chase', t: 0,
            ku: 0, kv: 0, flash: 0, animT: Math.random() * 1000, side: Math.random() < 0.5 ? 1 : -1, sprite, shadow, bar,
        };
    };
    const dispose = (m: Monster) => {
        m.sprite.destroy();
        m.shadow.destroy();
        m.bar.destroy();
    };

    const trySpawn = () => {
        const p = opts.player();
        for (let n = 0; n < 12; n++) {
            const ang = Math.random() * Math.PI * 2;
            const d = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
            const u = p.u + Math.cos(ang) * d;
            const v = p.v + Math.sin(ang) * d;
            if (u < 1 || v < 1 || u > 255 || v > 255 || !opts.canStand(u, v)) continue;
            monsters.push(make(u, v));
            return;
        }
    };

    /** Move by (du, dv) if the new spot is free, sliding along obstacles. */
    const step = (m: Monster, du: number, dv: number): boolean => {
        let moved = false;
        if (du !== 0 && opts.canStand(m.u + du, m.v)) { m.u += du; moved = true; }
        if (dv !== 0 && opts.canStand(m.u, m.v + dv)) { m.v += dv; moved = true; }
        return moved;
    };

    const drawBar = (m: Monster, x: number, y: number) => {
        m.bar.clear();
        if (m.hp >= MAX_HP || m.state === 'dying') return;
        const w = 30;
        m.bar.rect(x - w / 2, y, w, 5).fill({ color: 0x1a0c10, alpha: 0.85 });
        m.bar.rect(x - w / 2 + 1, y + 1, (w - 2) * Math.max(0, m.hp / MAX_HP), 3).fill(0xef4444);
    };

    return {
        update(dtMs) {
            const dt = Math.min(dtMs, 100) / 1000;
            const p = opts.player();

            spawnClock -= dtMs;
            if (spawnClock <= 0) {
                spawnClock = SPAWN_EVERY_MS;
                if (p.alive && monsters.filter((m) => m.state !== 'dying').length < MAX_ALIVE) trySpawn();
            }

            for (let i = monsters.length - 1; i >= 0; i--) {
                const m = monsters[i];
                const du = p.u - m.u;
                const dv = p.v - m.v;
                const dist = Math.hypot(du, dv);
                if (dist > LEASH || (m.state === 'dying' && m.t > DYING_MS)) {
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
                    if (dist < BITE_RANGE) {
                        m.state = 'windup';
                        m.t = 0;
                    } else {
                        const k = (SPEED * dt) / dist;
                        let moved = step(m, du * k, dv * k);
                        // Blocked: sidestep around whatever is in the way.
                        if (!moved) moved = step(m, -dv * k * m.side, du * k * m.side);
                        if (!moved) m.side = m.side === 1 ? -1 : 1;
                        walking = moved;
                    }
                } else if (m.state === 'windup') {
                    if (m.t >= WINDUP_MS) {
                        if (p.alive && dist < BITE_RANGE + 0.45) opts.onBite(1);
                        m.state = 'recover';
                        m.t = 0;
                    }
                } else if (m.state === 'recover' && m.t >= RECOVER_MS) {
                    m.state = 'chase';
                    m.t = 0;
                }

                // Look: front view when the player is down the screen, back view when up; mirror by side.
                const down = du + dv >= 0;
                const toRight = du - dv >= 0;
                let frame: [number, number];
                if (m.state === 'windup') frame = down ? FRONT_BITE : BACK_IDLE;
                else if (walking) frame = (down ? FRONT_WALK : BACK_WALK)[Math.floor(m.animT / 140) % 4];
                else frame = down ? FRONT_IDLE : BACK_IDLE;
                const back = !down;
                m.sprite.texture = tex(back, frame);
                const a = back ? BACK_ANCHOR : FRONT_ANCHOR;
                m.sprite.anchor.set(a.x, a.y);
                const lunge = m.state === 'windup' ? 1 + 0.18 * Math.sin((m.t / WINDUP_MS) * Math.PI) : 1;
                const fade = m.state === 'dying' ? 1 - m.t / DYING_MS : 1;
                m.sprite.scale.set(SCALE * (toRight ? -1 : 1) * lunge * (m.state === 'dying' ? 1 + 0.4 * (1 - fade) : 1), SCALE * lunge);
                m.sprite.alpha = fade;
                m.sprite.tint = m.flash > 0 ? 0xffffff : ANGRY;

                // Place on the terrain, with a little hop while walking.
                m.z += (opts.heightAt(m.u, m.v) * opts.levelH - m.z) * Math.min(1, 12 * dt);
                const pos = opts.toScreen(m.u, m.v);
                const hop = walking ? Math.abs(Math.sin(m.animT / 130)) * 5 : 0;
                m.sprite.position.set(pos.x, pos.y - m.z - hop);
                m.shadow.position.set(pos.x, pos.y - m.z + 2);
                m.shadow.alpha = fade;
                const z = opts.zFor(m.u, m.v);
                m.sprite.zIndex = z - 0.1;
                m.shadow.zIndex = z - 0.3;
                m.bar.zIndex = 1e6 - 1;
                drawBar(m, pos.x, pos.y - m.z - 84);
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
                // Screen-space direction to the frog, in the same units as the joystick's facing.
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
                    opts.onKill();
                } else if (m.state === 'windup') {
                    // A hit interrupts the lunge.
                    m.state = 'recover';
                    m.t = 0;
                }
            }
            return kills;
        },

        destroy() {
            for (const m of monsters) dispose(m);
            monsters.length = 0;
        },
    };
}
