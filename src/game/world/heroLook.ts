/**
 * The hero's look, chosen in the character creator: skin, eyes, outfit and its trim, a hairstyle (or a
 * hat) and its colour, headwear and its colour, something on the face, and gear on the back and
 * shoulders. The hero's sheets (images/world/char) are dressed as they load: the light skin and cloth
 * pixels recoloured (their shading kept; the legs take the trim), then the pieces drawn on every
 * frame's head (tools/build-hero-looks.py: neutral grey strips tinted here, strips drawn behind the
 * hero, and strips in their own colours), and the eyes laid back on top in their colour.
 *
 * Saves keep indices into the colour lists and names of pieces, so the lists only ever grow at the end.
 */
import { Texture, type TextureSource } from 'pixi.js';
import { HEAD_R, HERO_HEADS, PIECE_AT, PIECE_LAYERS } from './heroHeads.ts';

export interface HeroLook {
    skin: number;
    outfit: number;
    hair: string;
    hairColor: number;
    acc: string;
    accColor: number;
    /** The second cloth colour (legs, cape, hood); 0 = the outfit's own. */
    trim: number;
    /** Eye colour; 0 = the art's own dark eyes. */
    eyes: number;
    face: string;
    gear: string;
}

/** Skin tones (save order); SKIN_ORDER is how the creator lays them out, light to deep, then the uncanny. */
export const SKINS = ['#f6d7bd', '#e8c09a', '#c99470', '#9a6644', '#6e4630', '#fdfefe', '#fbe6d4', '#dcac7e', '#b98458', '#82543a', '#5a3828', '#43281c', '#b8c4d2', '#a9b994'];
export const SKIN_NAMES = ['Fair', 'Sand', 'Honey', 'Chestnut', 'Umber', 'Ghost', 'Porcelain', 'Golden', 'Bronze', 'Walnut', 'Deep', 'Ebony', 'Ashen', 'Fae'];
export const SKIN_ORDER = [6, 0, 1, 7, 2, 8, 3, 9, 4, 10, 11, 12, 13, 5];
export const OUTFITS = ['#5a6e8a', '#7a3e2a', '#3f6e4a', '#6a4a8a', '#b08a3a', '#2f4f6f', '#8a2f3a', '#d8d0c0', '#3c3a44', '#8a6448', '#2f6e6e', '#5e6a3a'];
export const OUTFIT_NAMES = ['Slate', 'Rust', 'Forest', 'Violet', 'Ochre', 'Navy', 'Wine', 'Linen', 'Charcoal', 'Hide', 'Teal', 'Olive'];
/** Trim: index 0 is "the outfit's own colour" (the colour is unused). */
export const TRIMS = ['', '#3b2a22', '#7a5236', '#26242c', '#d8d0c0', '#c39a44', '#7a2a2a', '#3a4c66', '#4a5a3a'];
export const TRIM_NAMES = ['Matching', 'Dark leather', 'Tan leather', 'Black', 'Linen', 'Gold', 'Oxblood', 'Steel blue', 'Moss'];
export const EYES = ['', '#4a7fd0', '#3f9a5a', '#b07a2a', '#6b4128', '#9a5ae0', '#e0b030', '#d04a3a'];
export const EYE_NAMES = ['Dusk', 'Blue', 'Green', 'Amber', 'Brown', 'Ley violet', 'Gold', 'Ember'];

export const HAIRS = ['none', 'short', 'long', 'bun', 'spiky', 'helmet', 'aviator', 'ponytail', 'braids', 'mohawk', 'curls', 'hood'];
export const HAIR_COLORS = ['#2a1d18', '#5a3a22', '#8a3a1c', '#d8b060', '#d8d8e0', '#2f8a8a', '#c8642a', '#8a6a48', '#f0e2b8', '#4a2a5e', '#a83040'];
export const HAIR_COLOR_NAMES = ['Raven', 'Brown', 'Auburn', 'Blond', 'Silver', 'Tide teal', 'Copper', 'Ash brown', 'Platinum', 'Nightshade', 'Ember red'];
export const ACCS = ['none', 'goggles', 'headband', 'scarf', 'bandana', 'circlet', 'crown'];
export const ACC_COLORS = ['#e0a948', '#7dd3fc', '#c0392b', '#e7e5e4', '#6a4a8a', '#b8c0cc', '#34303a', '#3f7a4a', '#b8733a'];
export const ACC_COLOR_NAMES = ['Gold', 'Sky', 'Red', 'White', 'Violet', 'Silver', 'Black', 'Green', 'Copper'];
export const FACES = ['none', 'eyepatch', 'earrings'];
export const GEARS = ['none', 'cape', 'pauldron', 'mantle'];

export const HAIR_NAMES: Record<string, string> = {
    none: 'Shaved', short: 'Cropped', long: 'Long', bun: 'Bun', spiky: 'Tousled', ponytail: 'Ponytail', braids: 'Braids',
    mohawk: 'Mohawk', curls: 'Curls', hood: 'Hood', helmet: 'Miner’s helmet', aviator: 'Aviator cap',
};
export const ACC_NAMES: Record<string, string> = { none: 'None', goggles: 'Goggles', headband: 'Headband', scarf: 'Scarf', bandana: 'Bandana', circlet: 'Circlet', crown: 'Crown' };
export const FACE_NAMES: Record<string, string> = { none: 'None', eyepatch: 'Eyepatch', earrings: 'Earrings' };
export const GEAR_NAMES: Record<string, string> = { none: 'None', cape: 'Cape', pauldron: 'Pauldron', mantle: 'Cape and pauldron' };

/** Hats take the hair's place: the helmet and the cap keep their own colours, the hood is the trim's cloth. */
export const HATS = new Set(['helmet', 'aviator', 'hood']);
/** Whether a hairstyle shows a hair colour at all. */
export const hairTakesColor = (hair: string) => hair !== 'none' && !HATS.has(hair);
/** Headwear that sits on the scalp, hidden under a hat. */
const ON_SCALP = new Set(['headband', 'bandana', 'circlet', 'crown']);
/** Whether a headwear piece shows with this hairstyle (the creator greys out the ones that would not). */
export const accFits = (hair: string, acc: string) => !(HATS.has(hair) && ON_SCALP.has(acc));
/** Whether a face piece shows with this hairstyle (earrings vanish under a hood, helmet straps or cap flaps). */
export const faceFits = (hair: string, face: string) => !(face === 'earrings' && HATS.has(hair));
/** Whether headwear takes a colour (the goggles' lenses, the band, the metal). */
export const accTakesColor = (acc: string) => acc !== 'none';
const GEAR_PIECES: Record<string, string[]> = { none: [], cape: ['gear-cape'], pauldron: ['gear-pauldron'], mantle: ['gear-cape', 'gear-pauldron'] };

export const DEFAULT_LOOK: HeroLook = { skin: 1, outfit: 0, hair: 'short', hairColor: 1, acc: 'goggles', accColor: 0, trim: 0, eyes: 0, face: 'none', gear: 'none' };

/** A look with every field in range (old saves lack the newer fields; anything unknown falls back). */
export function normalizeLook(l: Partial<HeroLook> | null | undefined): HeroLook {
    const src = l && typeof l === 'object' ? l : {};
    const idx = (v: unknown, n: number, d: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < n ? (v as number) : d);
    const one = (v: unknown, list: string[], d: string) => (typeof v === 'string' && list.includes(v) ? v : d);
    const D = DEFAULT_LOOK;
    return {
        skin: idx(src.skin, SKINS.length, D.skin),
        outfit: idx(src.outfit, OUTFITS.length, D.outfit),
        hair: one(src.hair, HAIRS, D.hair),
        hairColor: idx(src.hairColor, HAIR_COLORS.length, D.hairColor),
        acc: one(src.acc, ACCS, D.acc),
        accColor: idx(src.accColor, ACC_COLORS.length, D.accColor),
        trim: idx(src.trim, TRIMS.length, D.trim),
        eyes: idx(src.eyes, EYES.length, D.eyes),
        face: one(src.face, FACES, D.face),
        gear: one(src.gear, GEARS, D.gear),
    };
}

/** A look in a few characters, for sending to the other players ("s.o.hair.hc.acc.ac.t.e.face.gear"). */
export function encodeLook(l: HeroLook): string {
    return [l.skin, l.outfit, l.hair, l.hairColor, l.acc, l.accColor, l.trim, l.eyes, l.face, l.gear].join('.');
}
export function decodeLook(s: unknown): HeroLook | null {
    if (typeof s !== 'string' || s.length > 80) return null;
    const p = s.split('.');
    if (p.length < 6) return null;
    const n = (x: string | undefined) => (x !== undefined && /^\d{1,2}$/.test(x) ? Number(x) : -1);
    return normalizeLook({ skin: n(p[0]), outfit: n(p[1]), hair: p[2], hairColor: n(p[3]), acc: p[4], accColor: n(p[5]), trim: n(p[6]), eyes: n(p[7]), face: p[8], gear: p[9] });
}
export const lookKey = (l: HeroLook) => encodeLook(l);

let look: HeroLook = { ...DEFAULT_LOOK };
/** Dressed sheets: by look, then by sheet file. The local hero's look and a few others (co-op) are kept. */
const dressed = new Map<string, Map<string, Texture>>();
/** Every dressed source -> the sheet it came from, so another look can be swapped in (remote players). */
const origin = new WeakMap<TextureSource, { file: string; raw: CanvasImageSource & { width: number; height: number } }>();
const pieces = new Map<string, HTMLImageElement>();

export const getLook = (): HeroLook => look;
export function setLook(l: HeroLook): void {
    const n = normalizeLook(l);
    if (lookKey(n) === lookKey(look)) return;
    // The old textures are not destroyed: a live character may still show them for a frame. Dropping
    // the cache lets them go once nothing holds them.
    dressed.delete(lookKey(look));
    look = n;
}

/** Every piece strip's file name (without .png). */
function pieceFiles(): string[] {
    const out: string[] = [];
    for (const [name, layers] of Object.entries(PIECE_LAYERS)) {
        for (const layer of layers) out.push(layer === 'over' ? name : `${name}-${layer}`);
    }
    return out;
}

/** Load the piece strips (once). Resolves when every piece is ready to draw. */
let preloading: Promise<void> | null = null;
export function preloadPieces(): Promise<void> {
    if (!preloading) {
        preloading = Promise.all(pieceFiles().map((n) => new Promise<void>((done) => {
            const img = new Image();
            img.onload = () => { pieces.set(n, img); done(); };
            img.onerror = () => done();
            img.src = `images/world/hero/${n}.png`;
        }))).then(() => undefined);
    }
    return preloading;
}

const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const darken = (c: number[], k: number) => c.map((v) => Math.round(v * k));
const hex = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;

/** The look's colours, resolved. */
export function lookColors(l: HeroLook) {
    const cloth = rgb(OUTFITS[l.outfit] ?? OUTFITS[0]);
    const trim = l.trim > 0 ? rgb(TRIMS[l.trim]) : null;
    return {
        skin: rgb(SKINS[l.skin] ?? SKINS[0]),
        cloth,
        /** The legs: the trim, or the outfit itself. */
        legs: trim ?? cloth,
        /** Cape and hood cloth: the trim, or a deeper shade of the outfit. */
        accent: hex(trim ?? darken(cloth, 0.72)),
        hair: HAIR_COLORS[l.hairColor] ?? HAIR_COLORS[0],
        acc: ACC_COLORS[l.accColor] ?? ACC_COLORS[0],
        eyes: l.eyes > 0 ? rgb(EYES[l.eyes]) : null,
    };
}

/** A piece's strip tinted a colour (multiply keeps its shading and its dark outline); untinted when color is null. */
function strip(name: string, color: string | null): CanvasImageSource | null {
    const img = pieces.get(name);
    if (!img) return null;
    if (!color) return img;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(img, 0, 0);
    return c;
}

interface Layered { under: CanvasImageSource[]; over: CanvasImageSource[]; late: CanvasImageSource[] }

/** The strips to draw for a look, in order: gear, earrings, hair (or a hat), headwear; an eyepatch after the eyes. */
function layersFor(l: HeroLook): Layered {
    const col = lookColors(l);
    const out: Layered = { under: [], over: [], late: [] };
    const add = (piece: string, tint: string | null, late = false) => {
        const layers = PIECE_LAYERS[piece];
        if (!layers) return;
        const dest = late ? out.late : out.over;
        if (layers.includes('under')) { const s = strip(`${piece}-under`, tint); if (s) out.under.push(s); }
        if (layers.includes('over')) { const s = strip(piece, tint); if (s) dest.push(s); }
        if (layers.includes('fix')) { const s = strip(`${piece}-fix`, null); if (s) dest.push(s); }
    };
    const face = l.face !== 'none' && faceFits(l.hair, l.face) ? `face-${l.face}` : null;
    for (const g of GEAR_PIECES[l.gear] ?? []) add(g, col.accent);
    // Earrings hang under the hair; an eyepatch goes over the eyes, after them.
    if (face && face !== 'face-eyepatch') add(face, null);
    if (l.hair !== 'none') add(`hair-${l.hair}`, l.hair === 'hood' ? col.accent : col.hair);
    if (l.acc !== 'none' && accFits(l.hair, l.acc)) add(`acc-${l.acc}`, col.acc);
    if (face === 'face-eyepatch') add(face, null, true);
    return out;
}

/** One frame to dress: its row and column in the source sheet, and where it goes in the output. */
interface CellJob { row: number; col: number; ox: number; oy: number }

function dressCells(file: string, src: CanvasImageSource & { width: number; height: number }, l: HeroLook, out: HTMLCanvasElement, jobs: CellJob[]): void {
    const heads = HERO_HEADS[file];
    const cols = heads[0];
    const cell = src.width / cols;
    const g = out.getContext('2d', { willReadFrequently: true })!;
    const W = out.width, H = out.height;
    for (const j of jobs) g.drawImage(src, j.col * cell, j.row * cell, cell, cell, j.ox, j.oy, cell, cell);
    const orig = g.getImageData(0, 0, W, H);
    const work = new ImageData(new Uint8ClampedArray(orig.data), W, H);
    const d = work.data;
    const col = lookColors(l);
    const R2 = (HEAD_R - 2) * (HEAD_R - 2);
    const hipY = HEAD_R * 1.78;
    const headAt = (j: CellJob) => {
        const k = 1 + 2 * (j.row * cols + j.col);
        return [heads[k] ?? PIECE_AT[0], heads[k + 1] ?? PIECE_AT[1]];
    };
    // Skin and cloth: the art's light pixels take the colours (their shading kept), the plum strap
    // lines a darker shade of the cloth; below the hips the legs take the trim.
    for (const j of jobs) {
        const [hx, hy] = headAt(j);
        for (let y = 0; y < cell; y++) {
            const yy = j.oy + y;
            if (yy < 0 || yy >= H) continue;
            let p = (yy * W + j.ox) * 4;
            for (let x = 0; x < cell; x++, p += 4) {
                if (d[p + 3] < 40) continue;
                const r = d[p], gg = d[p + 1], b = d[p + 2];
                const inHead = (x - hx) * (x - hx) + (y - hy) * (y - hy) < R2;
                const light = r > 150 && Math.abs(r - gg) < 40 && Math.abs(r - b) < 40;
                if (light) {
                    const lum = (r + gg + b) / 759;
                    const c3 = inHead ? col.skin : y - hy > hipY ? col.legs : col.cloth;
                    const k2 = 0.55 + 0.45 * lum;
                    d[p] = c3[0] * k2;
                    d[p + 1] = c3[1] * k2;
                    d[p + 2] = c3[2] * k2;
                } else if (r > 90 && r <= 170) {
                    // The soft edge between the light art and its dark outline: take the new colour too, shaded by
                    // how light it was. (Left alone, these pale pixels showed as white grain round every outline.)
                    const lum = (r + gg + b) / 759;
                    const c3 = inHead ? col.skin : y - hy > hipY ? col.legs : col.cloth;
                    const k2 = 0.25 + 0.6 * lum;
                    d[p] = c3[0] * k2;
                    d[p + 1] = c3[1] * k2;
                    d[p + 2] = c3[2] * k2;
                }
            }
        }
    }
    g.putImageData(work, 0, 0);
    // The pieces, shifted onto each frame's head: behind the hero, then over it.
    const layers = layersFor(l);
    const scale = cell / 180;
    const place = (list: CanvasImageSource[], op: GlobalCompositeOperation) => {
        if (!list.length) return;
        g.save();
        g.globalCompositeOperation = op;
        for (const j of jobs) {
            const [hx, hy] = headAt(j);
            const dx = j.ox + (hx - PIECE_AT[0]) * scale, dy = j.oy + (hy - PIECE_AT[1]) * scale;
            // Clip to the frame so a piece never spills into its neighbour.
            g.save();
            g.beginPath();
            g.rect(j.ox, j.oy, cell, cell);
            g.clip();
            for (const s of list) g.drawImage(s, 0, (j.row % 5) * 180, 180, 180, dx, dy, cell, cell);
            g.restore();
        }
        g.restore();
    };
    place(layers.under, 'destination-over');
    place(layers.over, 'source-over');
    // The eyes go back on top in the facing rows (no hair ever hides them), in their colour.
    const after = g.getImageData(0, 0, W, H);
    const a = after.data, o = orig.data;
    const E2 = (HEAD_R * 0.62) * (HEAD_R * 0.62);
    const eye = (p: number) => o[p + 3] > 160 && o[p] < 90;
    for (const j of jobs) {
        if (j.row >= 3) continue;
        const [hx, hy] = headAt(j);
        for (let y = Math.max(0, Math.floor(hy - HEAD_R * 0.2)); y < Math.min(cell, hy + HEAD_R); y++) {
            for (let x = Math.max(0, Math.floor(hx - HEAD_R)); x < Math.min(cell, hx + HEAD_R); x++) {
                if ((x - hx) * (x - hx) + (y - hy) * (y - hy) >= E2) continue;
                const p = ((j.oy + y) * W + j.ox + x) * 4;
                if (!eye(p)) continue;
                a[p] = o[p];
                a[p + 1] = o[p + 1];
                a[p + 2] = o[p + 2];
                a[p + 3] = o[p + 3];
                if (col.eyes) {
                    // The iris: eye pixels inside the eye (a one-pixel dark rim stays), lighter at the top.
                    const row4 = W * 4;
                    if (x < 1 || x + 1 >= cell || y < 1 || y + 1 >= cell) continue;
                    if (!eye(p - 4) || !eye(p + 4) || !eye(p - row4) || !eye(p + row4)) continue;
                    let up = 0, down = 0;
                    while (up < 24 && y - up - 1 >= 0 && eye(p - (up + 1) * row4)) up++;
                    while (down < 24 && y + down + 1 < cell && eye(p + (down + 1) * row4)) down++;
                    const k = 1.2 - 0.5 * (up / Math.max(1, up + down));
                    a[p] = col.eyes[0] * k;
                    a[p + 1] = col.eyes[1] * k;
                    a[p + 2] = col.eyes[2] * k;
                }
            }
        }
    }
    g.putImageData(after, 0, 0);
    // Things worn over the eyes go last.
    place(layers.late, 'source-over');
}

/** Dress one hero sheet (by file name without .png) in a look: returns a canvas the size of the sheet. */
export function dressCanvas(file: string, src: CanvasImageSource & { width: number; height: number }, l: HeroLook = look): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const heads = HERO_HEADS[file];
    if (!heads) {
        c.getContext('2d')!.drawImage(src, 0, 0);
        return c;
    }
    const cols = heads[0];
    const cell = src.width / cols;
    const rows = Math.round(src.height / cell);
    const jobs: CellJob[] = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) jobs.push({ row, col, ox: col * cell, oy: row * cell });
    dressCells(file, src, normalizeLook(l), c, jobs);
    return c;
}

/** Dress a single frame of a sheet: a canvas one cell (180 px) square. For the creator's thumbnails. */
export function dressFrame(file: string, src: CanvasImageSource & { width: number; height: number }, row: number, col: number, l: HeroLook): HTMLCanvasElement {
    const heads = HERO_HEADS[file];
    const cell = heads ? src.width / heads[0] : 180;
    const c = document.createElement('canvas');
    c.width = cell;
    c.height = cell;
    if (!heads) {
        c.getContext('2d')!.drawImage(src, col * cell, row * cell, cell, cell, 0, 0, cell, cell);
        return c;
    }
    dressCells(file, src, normalizeLook(l), c, [{ row, col, ox: 0, oy: 0 }]);
    return c;
}

function dressedFor(key: string): Map<string, Texture> {
    let m = dressed.get(key);
    if (!m) {
        // Keep the local hero's look and the few most recent others (co-op partners).
        if (dressed.size >= 6) {
            for (const k of dressed.keys()) {
                if (k !== lookKey(look)) { dressed.delete(k); break; }
            }
        }
        dressed.set(key, (m = new Map()));
    }
    return m;
}

/** A loaded hero sheet texture, dressed in a look (the hero's own by default; cached per look). */
export function dressTexture(file: string, sheet: Texture, l: HeroLook = look): Texture {
    const key = lookKey(l);
    const cache = dressedFor(key);
    const have = cache.get(file);
    if (have) return have;
    const res = sheet.source.resource as CanvasImageSource & { width: number; height: number };
    if (!res || !HERO_HEADS[file]) return sheet;
    try {
        const tex = Texture.from(dressCanvas(file, res, l));
        origin.set(tex.source, { file, raw: res });
        cache.set(file, tex);
        return tex;
    } catch {
        return sheet;
    }
}

/**
 * The same frame in another look: for a texture cut from a dressed sheet (a character's current
 * frame), the matching frame of that sheet dressed in `l`. Other players' characters use it so each
 * shows its own look. Returns the texture itself when it is not a dressed hero frame.
 */
const frames = new Map<string, Texture>();
export function relook(tex: Texture, l: HeroLook): Texture {
    const from = origin.get(tex.source);
    if (!from) return tex;
    const key = lookKey(l);
    const fk = `${key}|${from.file}|${tex.frame.x}|${tex.frame.y}|${tex.frame.width}|${tex.frame.height}`;
    let t = frames.get(fk);
    const sheet = dressedFor(key).get(from.file);
    if (t && sheet && t.source === sheet.source) return t;
    let dressedSheet = sheet;
    if (!dressedSheet) {
        try {
            dressedSheet = Texture.from(dressCanvas(from.file, from.raw, l));
        } catch {
            return tex;
        }
        origin.set(dressedSheet.source, from);
        dressedFor(key).set(from.file, dressedSheet);
    }
    t = new Texture({ source: dressedSheet.source, frame: tex.frame.clone() });
    if (frames.size > 4000) frames.clear();
    frames.set(fk, t);
    return t;
}

/** A head-and-shoulders portrait of the hero in the current look (a data URL), for dialogue. */
let portrait: { key: string; url: string } | null = null;
export function heroPortrait(idle: CanvasImageSource & { width: number; height: number }): string {
    const key = lookKey(look);
    if (portrait?.key === key) return portrait.url;
    const c = dressFrame('idle', idle, 0, 0, look);
    const p = document.createElement('canvas');
    p.width = 100;
    p.height = 100;
    p.getContext('2d')!.drawImage(c, 40, 12, 100, 100, 0, 0, 100, 100);
    portrait = { key, url: p.toDataURL() };
    return portrait.url;
}
