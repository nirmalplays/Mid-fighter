/**
 * The hero's look, chosen in the character creator: skin, outfit, hairstyle and its colour, and an
 * accessory. The hero's sheets (images/world/char) are dressed as they load: the light skin and cloth
 * pixels recoloured (their shading kept), then the hairstyle and accessory (tools/build-hero-looks.py,
 * neutral grey strips tinted here) drawn onto every frame's head, and the eyes laid back on top.
 */
import { Texture } from 'pixi.js';
import { HEAD_R, HERO_HEADS, PIECE_AT } from './heroHeads.ts';

export interface HeroLook {
    skin: number;
    outfit: number;
    hair: string;
    hairColor: number;
    acc: string;
    accColor: number;
}

export const SKINS = ['#f6d7bd', '#e8c09a', '#c99470', '#9a6644', '#6e4630', '#fdfefe'];
export const OUTFITS = ['#5a6e8a', '#7a3e2a', '#3f6e4a', '#6a4a8a', '#b08a3a', '#2f4f6f', '#8a2f3a', '#d8d0c0'];
export const HAIRS = ['none', 'short', 'long', 'bun', 'spiky', 'helmet', 'aviator'];
export const HAIR_COLORS = ['#2a1d18', '#5a3a22', '#8a3a1c', '#d8b060', '#d8d8e0', '#2f8a8a'];
export const ACCS = ['none', 'goggles', 'headband', 'scarf'];
export const ACC_COLORS = ['#e0a948', '#7dd3fc', '#c0392b', '#e7e5e4', '#6a4a8a'];
export const HAIR_NAMES: Record<string, string> = { none: 'Bare', short: 'Cropped', long: 'Long', bun: 'Bun', spiky: 'Tousled', helmet: 'Miner’s helmet', aviator: 'Aviator cap' };
export const ACC_NAMES: Record<string, string> = { none: 'None', goggles: 'Goggles', headband: 'Headband', scarf: 'Scarf' };

export const DEFAULT_LOOK: HeroLook = { skin: 1, outfit: 0, hair: 'short', hairColor: 1, acc: 'goggles', accColor: 0 };

let look: HeroLook = { ...DEFAULT_LOOK };
const dressed = new Map<string, Texture>();
const pieces = new Map<string, HTMLImageElement>();

export const getLook = (): HeroLook => look;
export function setLook(l: HeroLook): void {
    if (JSON.stringify(l) === JSON.stringify(look)) return;
    look = { ...l };
    for (const t of dressed.values()) t.destroy(true);
    dressed.clear();
}

/** Load the hair and accessory strips (once). Resolves when every piece is ready to draw. */
export function preloadPieces(): Promise<void> {
    const names = [...HAIRS.filter((h) => h !== 'none').map((h) => `hair-${h}`), ...ACCS.filter((a) => a !== 'none').map((a) => `acc-${a}`)];
    return Promise.all(names.map((n) => (pieces.has(n) ? Promise.resolve() : new Promise<void>((done) => {
        const img = new Image();
        img.onload = () => { pieces.set(n, img); done(); };
        img.onerror = () => done();
        img.src = `images/world/hero/${n}.png`;
    })))).then(() => undefined);
}

const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** A piece's strip tinted a colour (multiply keeps its shading and its dark outline). */
function tinted(name: string, color: string): HTMLCanvasElement | null {
    const img = pieces.get(name);
    if (!img) return null;
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

/** Dress one hero sheet (by file name without .png) in a look: returns a canvas the size of the sheet. */
export function dressCanvas(file: string, src: CanvasImageSource & { width: number; height: number }, l: HeroLook = look): HTMLCanvasElement {
    const W = src.width, H = src.height;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(src, 0, 0);
    const heads = HERO_HEADS[file];
    if (!heads) return c;
    const cols = heads[0];
    const cell = W / cols;
    const rows = Math.round(H / cell);
    const orig = g.getImageData(0, 0, W, H);
    const out = new ImageData(new Uint8ClampedArray(orig.data), W, H);
    const d = out.data;
    const skin = rgb(SKINS[l.skin] ?? SKINS[0]);
    const cloth = rgb(OUTFITS[l.outfit] ?? OUTFITS[0]);
    const R2 = (HEAD_R - 2) * (HEAD_R - 2);
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const k = 1 + 2 * (row * cols + col);
            const hx = heads[k], hy = heads[k + 1];
            const x0 = col * cell, y0 = row * cell;
            for (let y = 0; y < cell; y++) {
                let p = ((y0 + y) * W + x0) * 4;
                for (let x = 0; x < cell; x++, p += 4) {
                    if (d[p + 3] < 40) continue;
                    const r = d[p], gg = d[p + 1], b = d[p + 2];
                    const light = r > 150 && Math.abs(r - gg) < 40 && Math.abs(r - b) < 40;
                    if (light) {
                        const lum = (r + gg + b) / 759;
                        const col3 = (x - hx) * (x - hx) + (y - hy) * (y - hy) < R2 ? skin : cloth;
                        const k2 = 0.55 + 0.45 * lum;
                        d[p] = col3[0] * k2;
                        d[p + 1] = col3[1] * k2;
                        d[p + 2] = col3[2] * k2;
                    } else if (r > 90 && r < 140 && (x - hx) * (x - hx) + (y - hy) * (y - hy) >= R2) {
                        d[p] = cloth[0] * 0.6;
                        d[p + 1] = cloth[1] * 0.6;
                        d[p + 2] = cloth[2] * 0.6;
                    }
                }
            }
        }
    }
    g.putImageData(out, 0, 0);
    // The hairstyle and the accessory, on every frame's head.
    const hair = l.hair !== 'none' ? tinted(`hair-${l.hair}`, HAIR_COLORS[l.hairColor] ?? HAIR_COLORS[0]) : null;
    const acc = l.acc !== 'none' ? tinted(`acc-${l.acc}`, ACC_COLORS[l.accColor] ?? ACC_COLORS[0]) : null;
    const scale = cell / 180;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const k = 1 + 2 * (row * cols + col);
            const dx = col * cell + (heads[k] - PIECE_AT[0]) * scale, dy = row * cell + (heads[k + 1] - PIECE_AT[1]) * scale;
            for (const piece of [hair, acc]) if (piece) g.drawImage(piece, 0, (row % 5) * 180, 180, 180, dx, dy, cell, cell);
        }
    }
    // The eyes go back on top in the facing rows (no hair ever hides them).
    const after = g.getImageData(0, 0, W, H);
    const a = after.data, o = orig.data;
    const E2 = (HEAD_R * 0.62) * (HEAD_R * 0.62);
    for (let row = 0; row < Math.min(rows, 3); row++) {
        for (let col = 0; col < cols; col++) {
            const k = 1 + 2 * (row * cols + col);
            const hx = heads[k], hy = heads[k + 1];
            for (let y = Math.max(0, Math.floor(hy - HEAD_R * 0.2)); y < Math.min(cell, hy + HEAD_R); y++) {
                for (let x = Math.max(0, Math.floor(hx - HEAD_R)); x < Math.min(cell, hx + HEAD_R); x++) {
                    if ((x - hx) * (x - hx) + (y - hy) * (y - hy) >= E2) continue;
                    const p = ((row * cell + y) * W + col * cell + x) * 4;
                    if (o[p + 3] > 160 && o[p] < 90) {
                        a[p] = o[p];
                        a[p + 1] = o[p + 1];
                        a[p + 2] = o[p + 2];
                        a[p + 3] = o[p + 3];
                    }
                }
            }
        }
    }
    g.putImageData(after, 0, 0);
    return c;
}

/** A loaded hero sheet texture, dressed in the current look (cached until the look changes). */
export function dressTexture(file: string, sheet: Texture): Texture {
    const have = dressed.get(file);
    if (have) return have;
    const res = sheet.source.resource as CanvasImageSource & { width: number; height: number };
    if (!res || !HERO_HEADS[file]) return sheet;
    try {
        const tex = Texture.from(dressCanvas(file, res));
        dressed.set(file, tex);
        return tex;
    } catch {
        return sheet;
    }
}

/** A head-and-shoulders portrait of the hero in the current look (a data URL), for dialogue. */
let portrait: { key: string; url: string } | null = null;
export function heroPortrait(idle: CanvasImageSource & { width: number; height: number }): string {
    const key = JSON.stringify(look);
    if (portrait?.key === key) return portrait.url;
    const c = dressCanvas('idle', idle);
    const p = document.createElement('canvas');
    p.width = 100;
    p.height = 100;
    p.getContext('2d')!.drawImage(c, 40, 12, 100, 100, 0, 0, 100, 100);
    portrait = { key, url: p.toDataURL() };
    return portrait.url;
}
