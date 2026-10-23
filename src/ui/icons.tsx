/**
 * The game's own icons: one set of silhouettes, turned into pixel art (a 16 × 16 grid with an
 * outline, like the UI pack's icons) for the interface and for the radar and map canvases, so the same picture means the same thing
 * everywhere. (No emoji anywhere: they look different on every device and break the art style.)
 * Plus the kingdom sigils: a medallion in the kingdom's colour with a gold rim and its emblem.
 */
import type { CSSProperties } from 'react';
import { KINGDOMS, type Element } from '../game/eidolon.ts';

export const ICON_PATHS = {
    // the four elements
    flame: 'M12 1.5c.8 3.2 4.8 5.6 4.8 10.6A5.2 5.2 0 0 1 12 17.5 5.2 5.2 0 0 1 7.2 12c0-2.4 1.2-4 2.4-5 0 2 .9 3.3 2.1 3.8C11.4 7.8 10.9 4.4 12 1.5zM12 22.5c-2.6 0-4.2-1.7-4.2-3.6h8.4c0 1.9-1.6 3.6-4.2 3.6z',
    wind: 'M3 8.2h10.6a2.6 2.6 0 1 0-2.6-2.6h-2a4.6 4.6 0 1 1 4.6 4.6H3zM3 12h15.4a3.1 3.1 0 1 1-3.1 3.1h2a1.1 1.1 0 1 0 1.1-1.1H3zM3 15.8h7.6a2.9 2.9 0 1 1-2.9 2.9h2a.9.9 0 1 0 .9-.9H3z',
    wave: 'M2 15.5c2.5 0 3-2 5-2s2.5 2 5 2 3-2 5-2 2.5 2 5 2v3c-2.5 0-3-2-5-2s-2.5 2-5 2-3-2-5-2-2.5 2-5 2zM12 2.5l4.6 6.2a5.5 5.5 0 0 1-9.2 0z',
    mountain: 'M1.5 20.5 8.6 7.8l2.6 4.3 3.3-6.6 8 15zM14.5 5.5l1.6 3.2-1.6.8-1.5-1z',
    // places and foes
    skull: 'M12 2.5c-5 0-8.5 3.4-8.5 8 0 2.8 1.3 4.6 3 5.6V19a1.5 1.5 0 0 0 1.5 1.5h1.2v-2h1.6v2h2.4v-2h1.6v2H16a1.5 1.5 0 0 0 1.5-1.5v-2.9c1.7-1 3-2.8 3-5.6 0-4.6-3.5-8-8.5-8zM8.4 9.4a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zm7.2 0a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM12 13.6l1.3 2.2h-2.6z',
    lock: 'M7 10V7.5a5 5 0 0 1 10 0V10h1a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 18 21.5H6A1.5 1.5 0 0 1 4.5 20v-8.5A1.5 1.5 0 0 1 6 10zm2.5 0h5V7.5a2.5 2.5 0 0 0-5 0zm2.5 3.5a1.8 1.8 0 0 0-1 3.3V19h2v-2.2a1.8 1.8 0 0 0-1-3.3z',
    demon: 'M3 2.5 7.2 7a7.6 7.6 0 0 1 9.6 0L21 2.5l-1.4 7.2c.6 1.1.9 2.4.9 3.7 0 4.6-3.8 8.1-8.5 8.1s-8.5-3.5-8.5-8.1c0-1.3.3-2.6.9-3.7zM8 11.5l2.8 1.6L8 14.7zm8 0v3.2l-2.8-1.6zM9 17h6l-3 2.3z',
    vortex: 'M12 3a9 9 0 0 1 9 9h-2.2A6.8 6.8 0 0 0 12 5.2a5 5 0 0 0-5 5c0 2.2 1.8 4 4 4a2.8 2.8 0 0 0 2.8-2.8A1.6 1.6 0 0 0 12.2 10V8a3.6 3.6 0 0 1 3.6 3.6A4.8 4.8 0 0 1 11 16.4a6.2 6.2 0 0 1-6.2-6.2A7.2 7.2 0 0 1 12 3zM3 12h2.2a6.8 6.8 0 0 0 6.8 6.8V21a9 9 0 0 1-9-9z',
    house: 'M12 2.5 22 11h-2.8v10H14v-6h-4v6H4.8V11H2z',
    tower: 'M7 2.5h2v2h2v-2h2v2h2v-2h2V8l-1.5 1.5L17 20.5h2v1H5v-1h2l1.5-11L7 8zm4 7v3h2v-3a1 1 0 0 0-2 0z',
    campfire: 'M12 1.5c.7 2.6 3.8 4.4 3.8 8.2A3.9 3.9 0 0 1 12 13.6a3.9 3.9 0 0 1-3.8-4c0-1.8.9-3 1.8-3.8 0 1.5.7 2.4 1.6 2.8C11.4 6.3 11.2 3.8 12 1.5zM3.5 17.2l17-3.2.5 2.4-17 3.2zm17 2.6-17-3.2-.5 2.4 17 3.2z',
    tent: 'M12 2.5 22.5 20.5H1.5zm0 6.5-4 11.5h8z',
    anvil: 'M2.5 6.5h14c0 2.2 2 3.5 5 3.5v1.5c-2.6 0-4 .8-5 2.2V15H8.5v-1.5c-1-1.6-3.1-2.6-6-2.6zM9 16h6.5l1.5 3.5H7.5zM5.5 20h13v1.5h-13z',
    flask: 'M9 2.5h6V4h-.8v5l5.8 9.6A2 2 0 0 1 18.3 21.5H5.7A2 2 0 0 1 4 18.6L9.8 9V4H9zm-.7 11.5-2.6 4.5h12.6l-2.6-4.5z',
    cross: 'M9.2 2.5h5.6v6.7h6.7v5.6h-6.7v6.7H9.2v-6.7H2.5V9.2h6.7z',
    crystal: 'M12 1.5 18 8l-6 14.5L6 8z',
    crate: 'M3 5h18v15.5H3zm2 2v11.5h14V7zm1.2 1.2h2l9.6 9.1h-2zm11.6 0-9.6 9.1h-2l9.6-9.1z',
    talk: 'M4 3.5h16A2.5 2.5 0 0 1 22.5 6v9.5A2.5 2.5 0 0 1 20 18h-8.5l-5.5 4v-4H4a2.5 2.5 0 0 1-2.5-2.5V6A2.5 2.5 0 0 1 4 3.5zm3.5 6.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm4.5 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm4.5 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z',
    berry: 'M12 6.5c1.6-3 4.4-4 6.5-3.8-.6 2.6-3 4.4-6 4.4zM8.5 9.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm7-.5a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2zM12 15a3.7 3.7 0 1 1 0 7.4A3.7 3.7 0 0 1 12 15z',
    hourglass: 'M5 2.5h14V5h-1.4c0 3.2-2 5.3-4 7 2 1.7 4 3.8 4 7H19v2.5H5V19h1.4c0-3.2 2-5.3 4-7-2-1.7-4-3.8-4-7H5zm3.6 2.5c0 2 1.2 3.6 3.4 5.4 2.2-1.8 3.4-3.4 3.4-5.4zm3.4 9.2c-2 1.6-3 3-3.2 4.8h6.4c-.2-1.8-1.2-3.2-3.2-4.8z',
    hands: 'M12 21.5 3.6 13a5.4 5.4 0 0 1 0-7.6 5.3 5.3 0 0 1 7.5 0l.9.9.9-.9a5.3 5.3 0 0 1 7.5 0 5.4 5.4 0 0 1 0 7.6zM11 8v3H8v2h3v3h2v-3h3v-2h-3V8z',
    swords: 'M2.5 2.5H6l9 9-3.5 3.5-9-9zM10 16.5l6.5-6.5 1.5 1.5-6.5 6.5zm4.5 0 2-2 3 3-2 2zm5.7 2.1a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM21.5 2.5H18l-9 9 3.5 3.5 9-9zM14 16.5 7.5 10 6 11.5l6.5 6.5zm-4.5 0-2-2-3 3 2 2zm-5.7 2.1a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z',
    shield: 'M12 1.5 21 5v6.2c0 5.4-3.7 9.6-9 11.3-5.3-1.7-9-5.9-9-11.3V5zm0 2.6L5.5 6.7v4.5c0 4 2.6 7.3 6.5 8.7z',
    sword: 'M20.5 2 21 3.5 10.6 14.9l1.7 1.7-1.4 1.4-1.3-1.3-3.5 3.5.7 1.4-1.4 1.4L3 20.6l-1.5-1.5 1.4-1.4 1.4.7 3.5-3.5-1.3-1.3 1.4-1.4 1.7 1.7z',
    // weather and the sky
    sun: 'M12 6.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zM11 1h2v3.5h-2zm0 18.5h2V23h-2zM1 11h3.5v2H1zm18.5 0H23v2h-3.5zM4.2 2.8l2.5 2.5-1.4 1.4-2.5-2.5zm13.1 13.1 2.5 2.5-1.4 1.4-2.5-2.5zM2.8 19.8l2.5-2.5 1.4 1.4-2.5 2.5zM15.9 6.7l2.5-2.5 1.4 1.4-2.5 2.5z',
    moon: 'M14.5 2.2A9.6 9.6 0 1 0 21.8 14 7.6 7.6 0 0 1 14.5 2.2z',
    dawn: 'M12 9.5a6 6 0 0 1 6 6H6a6 6 0 0 1 6-6zM11 3h2v4h-2zM3.6 8.2l1.4-1.4 2.6 2.6-1.4 1.4zm13.2 1.2 2.6-2.6 1.4 1.4-2.6 2.6zM1 17.5h22v2H1zm4 3h14v1.5H5z',
    rain: 'M17.5 13.5h-11a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 17.4 6a3.8 3.8 0 0 1 .1 7.5zM7 15.5h2l-1.5 4h-2zm5 0h2l-1.5 4h-2zm5 0h2l-1.5 4h-2z',
    storm: 'M17.5 12h-11a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 17.4 4.5a3.8 3.8 0 0 1 .1 7.5zM11.5 13h4l-2.5 4h3l-6 6 1.5-4.5H8.5z',
    fog: 'M3 6h14v2H3zm4 4h14v2H7zm-4 4h14v2H3zm4 4h14v2H7z',
    // the player
    heart: 'M12 21.5 3.6 13a5.4 5.4 0 0 1 0-7.6 5.3 5.3 0 0 1 7.5 0l.9.9.9-.9a5.3 5.3 0 0 1 7.5 0 5.4 5.4 0 0 1 0 7.6z',
    meat: 'M14.5 2.5a7 7 0 0 1 5.6 11.2c-1.6 2.2-4.3 2.6-6.1 1.6L10.3 19a2.4 2.4 0 1 1-3.3 3.2 2.4 2.4 0 1 1-3.2-3.3l3.7-3.7c-1-1.8-.6-4.5 1.6-6.1A7 7 0 0 1 14.5 2.5z',
    drop: 'M12 1.5 18 10a6.4 6.4 0 1 1-12 0z',
    sleep: 'M13.5 2.5a8.8 8.8 0 1 0 8 12.4A7 7 0 0 1 13.5 2.5zM15 3h5.5v1.6l-3 3.4h3v1.5H15V7.9l3-3.4h-3z',
    scroll: 'M6 2.5h12.5a3 3 0 0 1 0 6H18v10.5a2.5 2.5 0 0 1-2.5 2.5H5.5a3 3 0 0 1 0-6H6zm2 2v11h5.5a2.9 2.9 0 0 1 .5 1.7V18a.5.5 0 0 0 1 0V4.5zm8.4 0A1 1 0 0 1 16.5 6.5h2a1 1 0 0 0 0-2zM9.5 7h5v1.5h-5zm0 3h5v1.5h-5z',
    pointer: 'M2.5 12 21.5 3 15 21.5l-3-7.5z',
    check: 'M9 16.2 4.8 12l-1.6 1.6L9 19.4 21 7.4l-1.6-1.6z',
    star: 'M12 1.8 15 8.4l7.2.8-5.4 4.9 1.5 7.1L12 17.6l-6.3 3.6 1.5-7.1-5.4-4.9 7.2-.8z',
    bag: 'M8 6V5a4 4 0 0 1 8 0v1h3a1.5 1.5 0 0 1 1.5 1.6l-.9 12.6A1.5 1.5 0 0 1 18.1 21.5H5.9a1.5 1.5 0 0 1-1.5-1.3L3.5 7.6A1.5 1.5 0 0 1 5 6zm2 0h4V5a2 2 0 0 0-4 0zm-2 4a1 1 0 0 0 2 0V8.5H8zm6 0a1 1 0 0 0 2 0V8.5h-2z',
    soundOn: 'M3 9h4l5-4.5v15L7 15H3zm12.2-1.4a6 6 0 0 1 0 8.8l-1.4-1.4a4 4 0 0 0 0-6zm2.9-2.9a10 10 0 0 1 0 14.6l-1.4-1.4a8 8 0 0 0 0-11.8z',
    soundOff: 'M3 9h4l5-4.5v15L7 15H3zm12.6.1 2 2 2-2 1.4 1.4-2 2 2 2-1.4 1.4-2-2-2 2-1.4-1.4 2-2-2-2z',
    // power cards
    leaf: 'M20.5 3c-8.5 0-15 3.5-15 11 0 1.4.3 2.6.8 3.6L3.5 20.4l1.1 1.1 2.8-2.8c1 .5 2.2.8 3.6.8 7.5 0 9.5-8 9.5-16.5zM9.5 15.6l7-7 .9.9-7 7z',
    rock: 'M7 5.5 15.5 4l5 6.5-1.5 9.5H5l-2.5-6.5zm1.2 2.2-3.2 6.2 1.4 3.6h3.4z',
    basket: 'M7.4 9 11 3.4l1.6 1.1L9.8 9h4.4l-2.8-4.5L13 3.4 16.6 9H21.5l-2 11a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20l-2-11zM7 12v6.5h2V12zm4 0v6.5h2V12zm4 0v6.5h2V12z',
    eye: 'M12 4.5c5.4 0 9.3 4.4 10.5 7.5-1.2 3.1-5.1 7.5-10.5 7.5S2.7 15.1 1.5 12C2.7 8.9 6.6 4.5 12 4.5zm0 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
    thorn: 'M11 2.5h2v19h-2zm2 4.5 4.5-3-1 4.5L13 9.5zm-2 4.5-4.5-3 1 4.5 3.5 1zm2 4 4.5-3-1 4.5-3.5 1z',
    fang: 'M2 6.5c3 2 6.5 2.5 10 2.5s7-.5 10-2.5c-1 5-4.5 7.5-6.5 8l-1.3 7-2.2-6.2-2.2 6.2-1.3-7c-2-.5-5.5-3-6.5-8z',
    bolt: 'M14 1.5 4.5 13.5h6.5l-1.5 9 9.5-12h-6.5z',
    ring: 'M12 7.5a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 2.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6zM9 1.5h6l2 3-5 3.5-5-3.5z',
    feather: 'M20.5 2.5C13 3 7 7.5 5.5 15.3l-2.8 2.8 1.2 1.2 1.2-1.2 2.4.9 1.6-1.6-1.4-.5 1.8-1.8 2 .6 1.6-1.6-1.4-.6 1.9-1.9 2.1.5 1.6-1.6-1.6-.7 2.4-2.4c.8-2.2 1.2-4.4 1.2-6.8z',
    gem: 'M6.5 3h11l4 5.5L12 21.5 2.5 8.5zm1.1 2L5.2 8h4.5L11 5zm5.4 0 1.3 3h4.5l-2.4-3zM5.4 10l5.4 7.3L8.6 10zm7.8 0-2.2 7.3L16.4 10zm-1.1 0H11.9z',
} as const;
export type IconName = keyof typeof ICON_PATHS;
/** Icons whose parts overlap (they fill solid instead of cutting holes where they cross). */
const SOLID = new Set<IconName>(['swords']);
const rule = (n: IconName): CanvasFillRule => (SOLID.has(n) ? 'nonzero' : 'evenodd');

// ---- every icon is pixel art: the vector shape is laid on a small grid, each square either in or
// out, with a dark one-pixel outline and a light top edge and dark bottom edge (the UI pack's style).
const GRID = 16;
const OUTLINE: [number, number, number] = [27, 20, 32];
const rgbOf = (() => {
    let ctx: CanvasRenderingContext2D | null = null;
    return (color: string): [number, number, number] => {
        ctx ??= document.createElement('canvas').getContext('2d')!;
        ctx.fillStyle = '#000';
        ctx.fillStyle = color === 'currentColor' ? '#f3eefb' : color;
        const v = String(ctx.fillStyle);
        if (v.startsWith('#')) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
        const m = v.match(/[\d.]+/g) ?? ['243', '238', '251'];
        return [Number(m[0]), Number(m[1]), Number(m[2])];
    };
})();
const shade = (c: [number, number, number], k: number): [number, number, number] => (k > 1 ? c.map((x) => Math.min(255, x + (255 - x) * (k - 1))) : c.map((x) => x * k)) as [number, number, number];

/** A shape as a mask on an n × n grid (the vector drawn small, then each square in or out). */
function mask(d: string, n: number, inset: number, solid: boolean): boolean[] {
    const cv = document.createElement('canvas');
    cv.width = cv.height = n;
    const ctx = cv.getContext('2d')!;
    ctx.translate(inset, inset);
    ctx.scale((n - inset * 2) / 24, (n - inset * 2) / 24);
    ctx.fill(new Path2D(d), solid ? 'nonzero' : 'evenodd');
    const px = ctx.getImageData(0, 0, n, n).data;
    return Array.from({ length: n * n }, (_, i) => px[i * 4 + 3] >= 120);
}
/** Paint a grid: each square's colour (or none). */
function paint(n: number, at: (x: number, y: number) => [number, number, number] | null): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = cv.height = n;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const c = at(x, y);
            if (!c) continue;
            const i = (y * n + x) * 4;
            img.data[i] = c[0];
            img.data[i + 1] = c[1];
            img.data[i + 2] = c[2];
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
}

const pixelCache = new Map<string, { canvas: HTMLCanvasElement; url: string }>();
/** An icon as a pixel-art canvas (cached). */
export function pixelIcon(name: IconName, color: string): { canvas: HTMLCanvasElement; url: string } {
    const key = `${name}|${color}`;
    let hit = pixelCache.get(key);
    if (hit) return hit;
    const m = mask(ICON_PATHS[name], GRID, 1, SOLID.has(name));
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID && m[y * GRID + x];
    const base = rgbOf(color);
    const canvas = paint(GRID, (x, y) => {
        if (on(x, y)) return !on(x, y - 1) ? shade(base, 1.35) : !on(x, y + 1) ? shade(base, 0.62) : base;
        return on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) ? OUTLINE : null;
    });
    hit = { canvas, url: canvas.toDataURL() };
    pixelCache.set(key, hit);
    return hit;
}

/** An icon in the interface (pixel art, scaled up crisp). */
export function Ico({ name, size = 18, color = 'currentColor', style, className }: { name: IconName; size?: number; color?: string; style?: CSSProperties; className?: string }) {
    return <img src={pixelIcon(name, color).url} width={size} height={size} alt="" aria-hidden="true" draggable={false} className={className} style={{ display: 'inline-block', flexShrink: 0, verticalAlign: '-0.15em', imageRendering: 'pixelated', ...style }} />;
}

/** Draw an icon on a canvas, centred on (x, y), `size` pixels across (pixel art, never smoothed). */
export function drawIcon(ctx: CanvasRenderingContext2D, name: IconName, x: number, y: number, size: number, color: string): void {
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pixelIcon(name, color).canvas, Math.round(x - size / 2), Math.round(y - size / 2), Math.round(size), Math.round(size));
    ctx.imageSmoothingEnabled = smooth;
}

/** Each kingdom's emblem. */
export const ELEMENT_ICON: Record<Element, IconName> = { fire: 'flame', air: 'wind', water: 'wave', earth: 'mountain' };

/** A kingdom's sigil: a pixel medallion, its colour inside a gold rim, its emblem in light. */
const sigilCache = new Map<Element, string>();
function sigilUrl(el: Element): string {
    let url = sigilCache.get(el);
    if (url) return url;
    const N = 20, c = (N - 1) / 2;
    const k = rgbOf(KINGDOMS[el].css);
    const emblem = mask(ICON_PATHS[ELEMENT_ICON[el]], N, 4.5, false);
    url = paint(N, (x, y) => {
        const d = Math.hypot(x - c, y - c);
        if (d > 9.6) return null;
        if (d > 8.4) return OUTLINE;
        if (d > 6.9) return x + y < N - 1 ? [255, 224, 138] : [168, 105, 28];
        if (emblem[y * N + x]) return [255, 246, 216];
        return y < c ? k : shade(k, 0.6);
    }).toDataURL();
    sigilCache.set(el, url);
    return url;
}
export function Sigil({ el, size = 24, style }: { el: Element; size?: number; style?: CSSProperties }) {
    return <img src={sigilUrl(el)} width={size} height={size} alt={KINGDOMS[el].name} draggable={false} style={{ display: 'inline-block', flexShrink: 0, verticalAlign: '-0.2em', imageRendering: 'pixelated', ...style }} />;
}
