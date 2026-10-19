/**
 * Waves: every two minutes a hostile portal opens at a random spot near the player
 * and spawns that wave's monsters for about half a minute before it closes. Each
 * wave brings more monsters, tougher and faster, and new kinds unlock as waves go
 * up (wolves from wave 2, skeletons from wave 3). The wave counter and countdown
 * survive trips to the workshop (they only run while the world is on screen).
 */
import { Assets, Container, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { store } from '../../state/store.ts';
import { TILE_DX, TILE_DY } from './constants.ts';
import type { Monsters } from './monsters.ts';

const PORTAL_FRAMES = 6;
const PORTAL_W = 112;
const PORTAL_H = 128;
const PORTAL_BASE_Y = 108 / PORTAL_H;
const PORTAL_MS = 110;
const OPEN_MS = 900;
const CLOSE_MS = 700;
/** How long a portal keeps spawning, and how long it lingers after the last one. */
const SPAWN_WINDOW_MS = 26000;
const LINGER_MS = 2500;
const DIST_MIN = 12;
const DIST_MAX = 19;

export interface WaveOptions {
    layer: Container;
    glowTex: Texture;
    canStand: (u: number, v: number) => boolean;
    heightAt: (u: number, v: number) => number;
    toScreen: (u: number, v: number) => { x: number; y: number };
    zFor: (u: number, v: number) => number;
    levelH: number;
    player: () => { u: number; v: number; alive: boolean };
    monsters: Monsters;
    /** Seconds between portals, and until the first one (debug URL options can shorten both). */
    everySec: number;
    firstSec: number;
    onWave: (n: number) => void;
}

/** Survives the scene being rebuilt (world → workshop → world). */
const runtime = { wave: 0, clock: -1 };

/** Monster count, toughness and kinds for wave n. */
export function waveSpec(n: number) {
    const kinds = ['goblin', 'slime'];
    if (n >= 2) kinds.push('wolf');
    if (n >= 3) kinds.push('skeleton');
    return {
        count: Math.min(16, 3 + 2 * (n - 1)),
        kinds,
        hpMul: 1 + 0.3 * (n - 1),
        speedMul: Math.min(1.5, 1 + 0.05 * (n - 1)),
        damage: n >= 5 ? 2 : 1,
    };
}

export interface Waves {
    update(dtMs: number): void;
    destroy(): void;
}

interface Portal {
    u: number;
    v: number;
    sprite: Sprite;
    glow: Sprite;
    label: Text;
    age: number;
    toSpawn: number;
    nextIn: number;
    every: number;
    doneAt: number | null;
}

export function createWaves(o: WaveOptions): Waves {
    const sheet = Assets.get<Texture>('portal');
    sheet.source.scaleMode = 'nearest';
    const tex = Array.from({ length: PORTAL_FRAMES }, (_, n) =>
        new Texture({ source: sheet.source, frame: new Rectangle(n * PORTAL_W, 0, PORTAL_W, PORTAL_H) }));

    if (runtime.clock < 0) runtime.clock = o.firstSec * 1000;
    let portal: Portal | null = null;
    let clock = 0;
    let lastHud = 0;

    const open = (): boolean => {
        const p = o.player();
        for (let n = 0; n < 40; n++) {
            const ang = Math.random() * Math.PI * 2;
            const d = DIST_MIN + Math.random() * (DIST_MAX - DIST_MIN);
            const u = p.u + Math.cos(ang) * d;
            const v = p.v + Math.sin(ang) * d;
            if (u < 4 || v < 4 || u > 252 || v > 252 || !o.canStand(u, v)) continue;
            const spec = waveSpec(runtime.wave);
            const pos = o.toScreen(u, v);
            const z = o.heightAt(u, v) * o.levelH;
            const glow = new Sprite(o.glowTex);
            glow.anchor.set(0.5);
            glow.tint = 0xff3b3b;
            glow.position.set(pos.x, pos.y - z);
            glow.zIndex = o.zFor(u, v) - 0.4;
            const sprite = new Sprite(tex[0]);
            sprite.anchor.set(0.5, PORTAL_BASE_Y);
            sprite.tint = 0xff6b6b;
            sprite.position.set(pos.x, pos.y - z);
            sprite.zIndex = o.zFor(u, v) - 0.2;
            const label = new Text({
                text: `WAVE ${runtime.wave}`,
                style: { fontFamily: 'sans-serif', fontSize: 24, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x6b1010, width: 6 } },
            });
            label.anchor.set(0.5);
            label.position.set(pos.x, pos.y - z - 175);
            label.zIndex = 1e6 - 2;
            o.layer.addChild(glow, sprite, label);
            portal = { u, v, sprite, glow, label, age: 0, toSpawn: spec.count, nextIn: 600, every: SPAWN_WINDOW_MS / spec.count, doneAt: null };
            return true;
        }
        return false;
    };

    const close = () => {
        if (!portal) return;
        portal.sprite.destroy();
        portal.glow.destroy();
        portal.label.destroy();
        portal = null;
        store.patch({ portalAim: null });
    };

    const spawnOne = (p: Portal) => {
        const spec = waveSpec(runtime.wave);
        const ready = spec.kinds.filter((k) => o.monsters.ready(k));
        if (!ready.length) return;
        const kind = ready[Math.floor(Math.random() * ready.length)];
        // Land beside the portal on free ground.
        let u = p.u;
        let v = p.v;
        for (let n = 0; n < 8; n++) {
            const cu = p.u + (Math.random() - 0.5) * 2.4;
            const cv = p.v + (Math.random() - 0.5) * 2.4;
            if (o.canStand(cu, cv)) { u = cu; v = cv; break; }
        }
        o.monsters.spawn(kind, u, v, { hpMul: spec.hpMul, speedMul: spec.speedMul, damage: spec.damage });
    };

    return {
        update(dtMs) {
            clock += dtMs;
            const p = o.player();

            // Countdown to the next portal (paused while one is still spawning).
            if (!portal) {
                runtime.clock -= dtMs;
                if (runtime.clock <= 0) {
                    runtime.wave += 1;
                    if (open()) {
                        runtime.clock = o.everySec * 1000;
                        store.patch({ wave: runtime.wave });
                        o.onWave(runtime.wave);
                    } else {
                        runtime.wave -= 1;
                        runtime.clock = 8000; // no room near the player; try again shortly
                    }
                }
            }

            if (portal) {
                portal.age += dtMs;
                const open01 = Math.min(1, portal.age / OPEN_MS);
                let scale = 0.2 + 0.9 * open01 * (2 - open01);
                if (portal.doneAt !== null) scale *= Math.max(0, 1 - (portal.age - portal.doneAt) / CLOSE_MS);
                portal.sprite.texture = tex[Math.floor(clock / PORTAL_MS) % PORTAL_FRAMES];
                portal.sprite.scale.set(1.5 * scale);
                portal.glow.scale.set(1.2 * scale + 0.1 * Math.sin(clock / 260));
                portal.glow.alpha = 0.45 * scale;
                portal.label.alpha = Math.min(1, scale * 1.5);
                portal.label.y = portal.sprite.y - 175 + Math.sin(clock / 400) * 4;

                if (portal.toSpawn > 0 && p.alive) {
                    portal.nextIn -= dtMs;
                    if (portal.nextIn <= 0) {
                        spawnOne(portal);
                        portal.toSpawn -= 1;
                        portal.nextIn = portal.every * (0.7 + Math.random() * 0.6);
                    }
                }
                if (portal.toSpawn <= 0 && portal.doneAt === null) portal.doneAt = portal.age + LINGER_MS;
                if (portal.doneAt !== null && portal.age >= portal.doneAt + CLOSE_MS) close();
            }

            // HUD: countdown and a pointer to the portal.
            lastHud -= dtMs;
            if (lastHud <= 0) {
                lastHud = 150;
                const aim = portal
                    ? (() => {
                        const dx = (portal.u - p.u - (portal.v - p.v)) * TILE_DX;
                        const dy = (portal.u - p.u + (portal.v - p.v)) * TILE_DY;
                        return { angle: Math.atan2(dy, dx), dist: Math.hypot(portal.u - p.u, portal.v - p.v) };
                    })()
                    : null;
                store.patch({ nextWaveIn: portal ? 0 : Math.max(0, Math.ceil(runtime.clock / 1000)), portalAim: aim });
            }
        },
        destroy() {
            close();
        },
    };
}

