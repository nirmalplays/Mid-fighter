/**
 * The story's people as animated sprites: their sheets (tools/build-npcs.py, dressed from the hero's
 * own) or the hero's, cut into frames, and a small actor that stands, walks, faces and plays an
 * animation on the iso ground (NPCs in camp, Lyra beside you, and the actors of the cinematics).
 */
import { Assets, Rectangle, Sprite, Texture, type Container } from 'pixi.js';
import { CHAR_CELL, CHAR_FEET_X, CHAR_FEET_Y } from './characterAtlas.ts';
import { FACINGS } from './character.ts';
import { NPC_SHEETS } from './npcAtlas.ts';
import { dressTexture } from './heroLook.ts';

/** Every NPC sheet, for the asset manifest (loaded with the critical bundle). */
export const NPC_ASSETS = Object.entries(NPC_SHEETS).flatMap(([who, anims]) =>
    Object.keys(anims).map((anim) => ({ alias: `npc:${who}:${anim}`, src: `images/world/npc/${who}-${anim}.png` })));

/** Which sheet (tools/build-npcs.py) dresses each camp person, by their id in eidolon.ts NPCS. */
export const NPC_ART: Record<string, string> = { theron: 'orin', varis: 'bram', lyra: 'lyra', kael: 'kael', lin: 'lin', thorne: 'thorne', nerissa: 'nerissa' };

const cut = new Map<string, Texture[][]>();
/** Frames (5 facing rows × columns) of a person's animation: 'hero' is the player's own art. */
export function framesOf(who: string, anim: string): Texture[][] | null {
    const key = `${who}:${anim}`;
    const have = cut.get(key);
    if (have) return have;
    const alias = who === 'hero' ? `char:${anim}` : `npc:${who}:${anim}`;
    if (!Assets.cache.has(alias)) {
        // Not loaded yet (the hero's other sheets come on demand): fetch it for next time.
        if (who === 'hero') void Assets.load({ alias, src: `images/world/char/${anim}.png` }).catch(() => undefined);
        return null;
    }
    const raw = Assets.get<Texture>(alias);
    // The hero wears the look chosen in the character creator.
    const sheet = who === 'hero' ? dressTexture(anim, raw) : raw;
    sheet.source.scaleMode = 'linear';
    const cols = Math.round(sheet.width / CHAR_CELL);
    const rows = Math.round(sheet.height / CHAR_CELL);
    const frames = Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (__, col) => new Texture({ source: sheet.source, frame: new Rectangle(col * CHAR_CELL, row * CHAR_CELL, CHAR_CELL, CHAR_CELL) })));
    cut.set(key, frames);
    return frames;
}

/** The facing row and mirroring for a move of (du, dv) tiles (the same sectors as the player). */
export function facingOf(du: number, dv: number): { row: number; flip: boolean } {
    const x = du - dv, y = (du + dv) * 0.5;
    if (Math.hypot(x, y) < 1e-4) return FACINGS[2];
    const f = ((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8;
    return FACINGS[f];
}

export interface Actor {
    sprite: Sprite;
    who: string;
    u: number;
    v: number;
    /** Play an animation (looping, or once and hold its last frame). */
    play(anim: string, loop?: boolean, frameMs?: number): void;
    face(du: number, dv: number): void;
    /** Face a facing row directly (0 front .. 4 back) and mirror. */
    setFacing(row: number, flip: boolean): void;
    at(u: number, v: number): void;
    update(dtMs: number): void;
    destroy(): void;
}

export function createActor(o: {
    layer: Container;
    who: string;
    ground: (u: number, v: number) => { x: number; y: number };
    zFor: (u: number, v: number) => number;
    scale?: number;
    tint?: number;
}): Actor {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(CHAR_FEET_X / CHAR_CELL, CHAR_FEET_Y / CHAR_CELL);
    const base = 0.5 * (o.scale ?? 1);
    sprite.scale.set(base);
    if (o.tint) sprite.tint = o.tint;
    o.layer.addChild(sprite);
    let anim = 'idle';
    let loop = true;
    let frameMs = 130;
    let t = 0;
    let row = 0;
    let flip = false;
    const a: Actor = {
        sprite,
        who: o.who,
        u: 0,
        v: 0,
        play(next, lp = true, ms = 130) {
            if (next === anim && lp === loop) return;
            anim = next;
            loop = lp;
            frameMs = ms;
            t = 0;
        },
        face(du, dv) {
            const f = facingOf(du, dv);
            row = f.row;
            flip = f.flip;
        },
        setFacing(r, fl) {
            row = r;
            flip = fl;
        },
        at(u, v) {
            a.u = u;
            a.v = v;
            const p = o.ground(u, v);
            sprite.position.set(p.x, p.y);
            sprite.zIndex = o.zFor(u, v) + 0.1;
        },
        update(dtMs) {
            t += dtMs;
            const frames = framesOf(o.who, anim) ?? framesOf(o.who, 'idle');
            if (!frames) return;
            const r = frames[Math.min(row, frames.length - 1)];
            const n = r.length;
            const idx = loop ? Math.floor(t / frameMs) % n : Math.min(n - 1, Math.floor(t / frameMs));
            sprite.texture = r[idx];
            sprite.scale.x = Math.abs(sprite.scale.x) * (flip ? -1 : 1);
        },
        destroy() {
            sprite.destroy();
        },
    };
    return a;
}
