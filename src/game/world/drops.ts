/**
 * Monster drops and floating text. Each kind of monster drops a different gem that
 * permanently raises a skill when picked up by walking over it:
 *   goblin -> ruby (Attack), skeleton -> lapis (Defence), wolf -> emerald (Speed),
 *   slime -> amber (Vitality, one more heart).
 * Drops pop out of the monster, bob, and fade away after about 45 seconds.
 */
import { Assets, Container, Rectangle, Sprite, Text, Texture, type TextStyleOptions } from 'pixi.js';
import { DROP_FRAMES } from './dropsAtlas.ts';

export type Skill = 'attack' | 'defence' | 'speed' | 'vitality';

export const SKILL_NAMES: Record<Skill, string> = { attack: 'Attack', defence: 'Defence', speed: 'Speed', vitality: 'Vitality' };
export const SKILL_CAP: Record<Skill, number> = { attack: 10, defence: 10, speed: 10, vitality: 4 };
/** What each monster kind drops, and the chance. */
export const DROP_TABLE: Record<string, { skill: Skill; chance: number }> = {
    goblin: { skill: 'attack', chance: 0.8 },
    skeleton: { skill: 'defence', chance: 0.9 },
    wolf: { skill: 'speed', chance: 0.8 },
    slime: { skill: 'vitality', chance: 0.6 },
};
export const SKILL_COLOR: Record<Skill, number> = { attack: 0xff6b6b, defence: 0x6ba8ff, speed: 0x5ee08a, vitality: 0xffc94d };

const LIFE_MS = 45000;
const BLINK_MS = 8000;
const PICKUP_RANGE = 1.15;
const POP_MS = 420;
/** Gems this close drift toward the player (tiles) at this speed (tiles / s). */
const MAGNET_RANGE = 2.4;
const MAGNET_SPEED = 6.5;

interface Drop {
    skill: Skill;
    u: number;
    v: number;
    /** Where it lands after popping out. */
    tu: number;
    tv: number;
    age: number;
    sprite: Sprite;
    glow: Sprite;
}

export interface Drops {
    spawn(skill: Skill, u: number, v: number): void;
    update(dtMs: number): void;
    /** Rising text at a screen position in the world layer. */
    text(x: number, y: number, message: string, color?: number): void;
    destroy(): void;
}

export function createDrops(opts: {
    layer: Container;
    glowTex: Texture;
    canStand: (u: number, v: number) => boolean;
    heightAt: (u: number, v: number) => number;
    toScreen: (u: number, v: number) => { x: number; y: number };
    zFor: (u: number, v: number) => number;
    levelH: number;
    player: () => { u: number; v: number; alive: boolean };
    /** Return true if the pickup was taken (it is removed), false to leave it. */
    onPickup: (skill: Skill) => boolean;
}): Drops {
    const sheet = Assets.get<Texture>('drops');
    sheet.source.scaleMode = 'linear';
    const texs = new Map<string, Texture>();
    const tex = (skill: Skill): Texture => {
        let t = texs.get(skill);
        if (!t) {
            const [x, y, w, h] = DROP_FRAMES[skill];
            t = new Texture({ source: sheet.source, frame: new Rectangle(x, y, w, h) });
            texs.set(skill, t);
        }
        return t;
    };

    const drops: Drop[] = [];
    const floats: { text: Text; t: number; y0: number }[] = [];
    let clock = 0;

    const remove = (d: Drop) => {
        d.sprite.destroy();
        d.glow.destroy();
    };

    return {
        spawn(skill, u, v) {
            // Pop out a little to a free spot.
            let tu = u;
            let tv = v;
            for (let n = 0; n < 8; n++) {
                const cu = u + (Math.random() - 0.5) * 1.6;
                const cv = v + (Math.random() - 0.5) * 1.6;
                if (opts.canStand(cu, cv)) { tu = cu; tv = cv; break; }
            }
            const sprite = new Sprite(tex(skill));
            sprite.anchor.set(0.5, 0.85);
            sprite.scale.set(0.55);
            const glow = new Sprite(opts.glowTex);
            glow.anchor.set(0.5);
            glow.tint = SKILL_COLOR[skill];
            glow.scale.set(0.45);
            opts.layer.addChild(glow, sprite);
            drops.push({ skill, u, v, tu, tv, age: 0, sprite, glow });
        },

        update(dtMs) {
            clock += dtMs;
            const p = opts.player();
            for (let i = drops.length - 1; i >= 0; i--) {
                const d = drops[i];
                d.age += dtMs;
                if (d.age > LIFE_MS) {
                    remove(d);
                    drops.splice(i, 1);
                    continue;
                }
                const k = Math.min(1, d.age / POP_MS);
                const away = Math.hypot(p.u - d.u, p.v - d.v);
                if (p.alive && d.age > POP_MS && away < MAGNET_RANGE && away > 0.05) {
                    // Drift toward the player; keep the landing spot in step so it does not pull back.
                    const stepLen = Math.min(away, (MAGNET_SPEED * dtMs) / 1000);
                    d.u += ((p.u - d.u) / away) * stepLen;
                    d.v += ((p.v - d.v) / away) * stepLen;
                    d.tu = d.u;
                    d.tv = d.v;
                } else {
                    d.u += (d.tu - d.u) * Math.min(1, dtMs / 90);
                    d.v += (d.tv - d.v) * Math.min(1, dtMs / 90);
                }
                const pos = opts.toScreen(d.u, d.v);
                const ground = opts.heightAt(d.u, d.v) * opts.levelH;
                const arc = k < 1 ? Math.sin(k * Math.PI) * 38 : 0;
                const bob = k >= 1 ? 6 + Math.sin(clock / 260 + d.u * 3) * 4 : 0;
                d.sprite.position.set(pos.x, pos.y - ground - arc - bob);
                d.glow.position.set(pos.x, pos.y - ground);
                d.glow.alpha = 0.55 + 0.2 * Math.sin(clock / 300);
                const z = opts.zFor(d.u, d.v);
                d.sprite.zIndex = z + 0.05;
                d.glow.zIndex = z - 0.35;
                const blink = d.age > LIFE_MS - BLINK_MS && Math.floor(d.age / 180) % 2 === 0;
                d.sprite.alpha = blink ? 0.25 : 1;

                if (p.alive && d.age > POP_MS && Math.hypot(p.u - d.u, p.v - d.v) < PICKUP_RANGE && opts.onPickup(d.skill)) {
                    remove(d);
                    drops.splice(i, 1);
                }
            }
            for (let i = floats.length - 1; i >= 0; i--) {
                const f = floats[i];
                f.t += dtMs;
                const k = f.t / 1100;
                f.text.y = f.y0 - 46 * k;
                f.text.alpha = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
                if (k >= 1) {
                    f.text.destroy();
                    floats.splice(i, 1);
                }
            }
        },

        text(x, y, message, color = 0xffffff) {
            const style: TextStyleOptions = {
                fontFamily: 'sans-serif', fontSize: 22, fontWeight: '900', fill: color, stroke: { color: 0x1a0c10, width: 5 },
            };
            const text = new Text({ text: message, style });
            text.anchor.set(0.5, 1);
            text.position.set(x, y);
            text.zIndex = 1e6;
            opts.layer.addChild(text);
            floats.push({ text, t: 0, y0: y });
        },

        destroy() {
            for (const d of drops) remove(d);
            drops.length = 0;
            for (const f of floats) f.text.destroy();
            floats.length = 0;
        },
    };
}
