/**
 * Draws monster drops and floating text. Each kind of monster drops a different gem that
 * permanently raises a skill when picked up by walking over it:
 *   goblin -> ruby (Attack), skeleton -> lapis (Defence), wolf -> emerald (Speed),
 *   slime -> amber (Vitality, one more heart).
 * The simulation (shared/sim.ts) decides what drops and who takes it; this only shows the
 * list it is handed, drifts gems that are close toward the player, and asks to take one
 * once it reaches them.
 */
import { Assets, Container, Rectangle, Sprite, Text, Texture, type TextStyleOptions } from 'pixi.js';
import { DROP_LIFE_MS, type DropKind, type Skill } from '../../shared/sim.ts';
import { DROP_FRAMES } from './dropsAtlas.ts';
import { SKILL_CAP, SKILL_COLOR, SKILL_NAMES } from '../skills.ts';

export type { DropKind, Skill };
export { SKILL_CAP, SKILL_COLOR, SKILL_NAMES };

/** Glow colour of each potion drop. */
export const POTION_COLOR: Record<string, number> = { red: 0xff5a5a, blue: 0x5aa8ff, yellow: 0xffd84d, purple: 0xb070ff, black: 0x9a8ab0 };
const isPotion = (k: DropKind) => k.startsWith('potion_');
const isItem = (k: DropKind) => k.startsWith('item_');
const colorOf = (k: DropKind): number => (k === 'sword' ? 0xffe27a : isItem(k) ? 0xfff3c4 : isPotion(k) ? POTION_COLOR[k.slice(7)] : SKILL_COLOR[k as Skill]);
/** Items are drawn about 50 px across, whatever their picture's size. */
const fitItem = (t: Texture): number => (t === Texture.EMPTY ? 1 : 50 / Math.max(t.width, t.height));
/** An item's picture once the background load has it (blank until then). */
const itemTex = (k: DropKind): Texture => (Assets.cache.has(`item:${k.slice(5)}`) ? Assets.get<Texture>(`item:${k.slice(5)}`) : Texture.EMPTY);

const BLINK_MS = 8000;
/** Gems this close drift toward the player (tiles) at this speed (tiles / s); touching one asks to take it. */
const MAGNET_RANGE = 2.4;
const MAGNET_SPEED = 6.5;
const TOUCH_RANGE = 1.1;
const POP_MS = 420;
/** If a pickup request is not answered (someone else got it, or it was lost), ask again after this. */
const RETRY_MS = 1500;
/**
 * How far a drifting gem may stray from where it really lies (tiles). The simulation hands it over only to a
 * player within 2.6 tiles of that spot (sim.ts PICKUP_SLACK): a gem drawn further out could chase you and
 * cling to you, every request refused, until it expired.
 */
const LEASH = 2.0;

/** A drop as the simulation describes it. */
export interface ViewDrop {
    id: number;
    skill: DropKind;
    /** Which sword (0-29) when `skill` is 'sword'. */
    sword: number;
    u: number;
    v: number;
    /** Ms since it dropped. */
    age: number;
}

interface Shown {
    skill: DropKind;
    u: number;
    v: number;
    born: number;
    age: number;
    asked: number;
    sprite: Sprite;
    glow: Sprite;
}

export interface DropView {
    /** Show this list; `wantsSkill` says whether the player can use that gem (not at cap). */
    sync(list: ViewDrop[], dtMs: number): void;
    /** Rising text at a position in the world layer. */
    text(x: number, y: number, message: string, color?: number): void;
    destroy(): void;
}

export function createDropView(opts: {
    layer: Container;
    glowTex: Texture;
    heightAt: (u: number, v: number) => number;
    toScreen: (u: number, v: number) => { x: number; y: number };
    zFor: (u: number, v: number) => number;
    levelH: number;
    player: () => { u: number; v: number; alive: boolean };
    wantsSkill: (skill: DropKind) => boolean;
    /** The player reached a gem: ask the simulation to give it to them. */
    onTouch: (id: number, skill: DropKind) => void;
}): DropView {
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
    // Rare sword drops are cut from the sword sheet.
    const swordSheet = Assets.get<Texture>('swords');
    swordSheet.source.scaleMode = 'nearest';
    const swordTexs = new Map<number, Texture>();
    const swordTex = (i: number): Texture => {
        let t = swordTexs.get(i);
        if (!t) {
            t = new Texture({ source: swordSheet.source, frame: new Rectangle((i % 6) * 32, Math.floor(i / 6) * 32, 32, 32) });
            swordTexs.set(i, t);
        }
        return t;
    };

    const shown = new Map<number, Shown>();
    const floats: { text: Text; t: number; y0: number }[] = [];
    let clock = 0;

    const dispose = (s: Shown) => {
        s.sprite.destroy();
        s.glow.destroy();
    };

    return {
        sync(list, dtMs) {
            clock += dtMs;
            const p = opts.player();
            const seen = new Set<number>();
            for (const d of list) {
                seen.add(d.id);
                let s = shown.get(d.id);
                if (!s) {
                    const isSword = d.skill === 'sword';
                    const potion = isPotion(d.skill);
                    const item = isItem(d.skill);
                    const sprite = new Sprite(isSword ? swordTex(d.sword) : item ? itemTex(d.skill) : potion ? Assets.get<Texture>(d.skill) : tex(d.skill as Skill));
                    sprite.anchor.set(0.5, isSword ? 0.5 : potion ? 0.9 : 0.85);
                    sprite.scale.set(isSword ? 2.2 : item ? fitItem(sprite.texture) : potion ? 0.3 : 0.55);
                    const glow = new Sprite(opts.glowTex);
                    glow.anchor.set(0.5);
                    glow.tint = colorOf(d.skill);
                    glow.scale.set(isSword ? 0.8 : 0.45);
                    opts.layer.addChild(glow, sprite);
                    s = { skill: d.skill, u: d.u, v: d.v, born: clock - d.age, age: d.age, asked: -1e9, sprite, glow };
                    shown.set(d.id, s);
                }
                s.age = d.age;
                // An item whose picture was still loading: show it now.
                if (isItem(s.skill) && s.sprite.texture === Texture.EMPTY) {
                    const t = itemTex(s.skill);
                    if (t !== Texture.EMPTY) {
                        s.sprite.texture = t;
                        s.sprite.scale.set(fitItem(t));
                    }
                }
                const sinceBorn = clock - s.born;

                // Gems near the player drift toward them, on a leash from where they really lie; once the player
                // is out of reach of that spot they settle back onto it.
                const away = Math.hypot(p.u - s.u, p.v - s.v);
                const reach = Math.hypot(p.u - d.u, p.v - d.v);
                const usable = p.alive && opts.wantsSkill(s.skill);
                if (usable && s.age > POP_MS && reach < MAGNET_RANGE && away > 0.05) {
                    const stepLen = Math.min(away, (MAGNET_SPEED * dtMs) / 1000);
                    s.u += ((p.u - s.u) / away) * stepLen;
                    s.v += ((p.v - s.v) / away) * stepLen;
                    const off = Math.hypot(s.u - d.u, s.v - d.v);
                    if (off > LEASH) {
                        s.u = d.u + ((s.u - d.u) / off) * LEASH;
                        s.v = d.v + ((s.v - d.v) / off) * LEASH;
                    }
                } else {
                    s.u += (d.u - s.u) * Math.min(1, dtMs / 120);
                    s.v += (d.v - s.v) * Math.min(1, dtMs / 120);
                }

                const pos = opts.toScreen(s.u, s.v);
                const ground = opts.heightAt(s.u, s.v) * opts.levelH;
                const k = Math.min(1, sinceBorn / POP_MS);
                const arc = k < 1 ? Math.sin(k * Math.PI) * 38 : 0;
                const bob = k >= 1 ? (s.skill === 'sword' ? 16 : 6) + Math.sin(clock / 260 + d.u * 3) * 4 : 0;
                s.sprite.position.set(pos.x, pos.y - ground - arc - bob);
                s.glow.position.set(pos.x, pos.y - ground);
                s.glow.alpha = (s.skill === 'sword' ? 0.8 : 0.55) + 0.2 * Math.sin(clock / 300);
                if (s.skill === 'sword') s.sprite.rotation = Math.sin(clock / 500 + d.u) * 0.12;
                const z = opts.zFor(s.u, s.v);
                s.sprite.zIndex = z + 0.05;
                s.glow.zIndex = z - 0.35;
                const blink = s.age > DROP_LIFE_MS - BLINK_MS && Math.floor(s.age / 180) % 2 === 0;
                s.sprite.alpha = blink ? 0.25 : 1;

                if (usable && sinceBorn > POP_MS && reach < MAGNET_RANGE && Math.hypot(p.u - s.u, p.v - s.v) < TOUCH_RANGE && clock - s.asked > RETRY_MS) {
                    s.asked = clock;
                    opts.onTouch(d.id, s.skill);
                }
            }
            for (const [id, s] of shown) {
                if (!seen.has(id)) {
                    dispose(s);
                    shown.delete(id);
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
            for (const s of shown.values()) dispose(s);
            shown.clear();
            for (const f of floats) f.text.destroy();
            floats.length = 0;
        },
    };
}
