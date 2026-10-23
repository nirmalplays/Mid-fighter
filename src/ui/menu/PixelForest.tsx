/**
 * The home screen's world, painted as pixel art on a 320 × 180 canvas and shown scaled up crisp:
 * a deep forest, an ancient arch of mossy stone with a rune burning on its keystone and a light
 * waiting inside, shafts of light with dust turning in them, a stream, and a wanderer with a
 * lantern on its bank. Fireflies wander, leaves fall, the stream glitters; the layers part as the
 * pointer moves (`look`, -0.5..0.5 each way).
 * The still layers are painted once (dithered, a small palette); only what moves is drawn each frame.
 */
import { useEffect, useRef } from 'react';

const W = 320;
const H = 180;
/** Extra width each layer has for the parallax. */
const M = 16;

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const layer = () => {
    const c = document.createElement('canvas');
    c.width = W + M * 2;
    c.height = H;
    return c;
};

/** A pixel painter over a canvas: rects, discs, dithered fills, a few sprites. */
function painter(c: HTMLCanvasElement) {
    const ctx = c.getContext('2d')!;
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const px = (x: number, y: number, col: RGB, a = 255) => {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
        const i = (y * c.width + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = a;
    };
    const rect = (x: number, y: number, w: number, h: number, col: RGB) => {
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) px(x + xx, y + yy, col);
    };
    const disc = (cx: number, cy: number, r: number, col: RGB, top?: RGB) => {
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) px(cx + x, cy + y, top && y < -r * 0.35 && (x + y) % 2 === 0 ? top : col);
    };
    /** Between two colours with ordered dithering: k is 0..1. */
    const mix = (x: number, y: number, a: RGB, b: RGB, k: number) => px(x, y, k > BAYER[(y % 4) * 4 + (x % 4)] ? b : a);
    const done = () => ctx.putImageData(img, 0, 0);
    return { px, rect, disc, mix, done, w: c.width };
}

/** The still layers, painted once. */
function paintWorld() {
    const R = rng(11);
    // ---- the sky behind the trees: deep green to a misty glow low down
    const sky = layer();
    {
        const p = painter(sky);
        const stops = ['#050f0c', '#0a1d17', '#10302a', '#1b4a3a', '#2a6a52'].map(hex);
        for (let y = 0; y < H; y++) {
            const t = Math.min(0.999, Math.pow(y / 128, 1.3)) * (stops.length - 1);
            const n = Math.floor(t);
            for (let x = 0; x < p.w; x++) p.mix(x, y, stops[n], stops[Math.min(n + 1, stops.length - 1)], t - n);
        }
        p.done();
    }
    // ---- the far forest: thin trunks in the haze, a heavy canopy above
    const far = layer();
    {
        const p = painter(far);
        const trunk = hex('#0f2a22'), trunkLit = hex('#17382d'), leaf = hex('#0b2219'), leafLit = hex('#123329');
        for (let n = 0; n < 26; n++) {
            const x = Math.floor(R() * p.w), w = 2 + Math.floor(R() * 5);
            p.rect(x, 0, w, 150, trunk);
            p.rect(x + w - 1, 0, 1, 150, trunkLit);
        }
        for (let n = 0; n < 22; n++) p.disc(Math.floor(R() * p.w), Math.floor(R() * 26) - 4, 10 + Math.floor(R() * 14), leaf, leafLit);
        // the haze over the far forest
        const haze = hex('#2a6a52');
        for (let y = 86; y < 132; y++) for (let x = 0; x < p.w; x++) if (BAYER[(y % 4) * 4 + (x % 4)] < 0.18 * Math.sin(((y - 86) / 46) * Math.PI)) p.px(x, y, haze);
        p.done();
    }
    // ---- the ruin: two pillars and a broken arch of mossy stone, rubble at their feet
    const mid = layer();
    const ARCH = { cx: 168 + M, top: 62, base: 140 };
    {
        const p = painter(mid);
        const st = ['#3d4a3e', '#56655a', '#6f8070', '#8c9c88'].map(hex);
        const dark = hex('#1a2219'), moss = ['#2f5a24', '#4a7f2e', '#74a63a'].map(hex);
        const door = hex('#0a120f');
        const { cx } = ARCH;
        // the doorway's darkness
        for (let y = 72; y < 140; y++) for (let x = cx - 18; x <= cx + 18; x++) if (y > 90 || (x - cx) ** 2 + (y - 90) ** 2 <= 18 * 18) p.px(x, y, door);
        // pillars, laid in blocks
        for (const px0 of [cx - 32, cx + 19]) {
            for (let y = 88; y < 140; y++) {
                const row = Math.floor((y - 88) / 7);
                for (let x = px0; x < px0 + 13; x++) {
                    const edgeY = (y - 88) % 7 === 0, edgeX = (x - px0 + (row % 2) * 6) % 13 === 0;
                    const c = edgeY || edgeX ? st[0] : x === px0 ? st[3] : x > px0 + 9 ? st[1] : st[2];
                    p.px(x, y, x === px0 - 1 || x === px0 + 13 ? dark : c);
                }
                p.px(px0 - 1, y, dark);
                p.px(px0 + 13, y, dark);
            }
        }
        // the arch: a ring of voussoirs, one missing on the right
        for (let y = ARCH.top - 2; y < 96; y++) {
            for (let x = cx - 34; x <= cx + 34; x++) {
                const dx = x - cx, dy = y - 90, d = Math.hypot(dx, dy * 1.05);
                if (y > 90 || d < 18 || d > 32) continue;
                const a = Math.atan2(dy, dx);
                if (a > -0.62 && a < -0.3) continue; // the fallen stone
                const seg = Math.floor(((a + Math.PI) / Math.PI) * 9);
                const seam = Math.abs(((a + Math.PI) / Math.PI) * 9 - Math.round(((a + Math.PI) / Math.PI) * 9)) < 0.07;
                const c = seam || d > 31 ? dark : d < 19.2 ? st[0] : dy < -24 ? st[3] : seg % 2 ? st[2] : st[1];
                p.px(x, y, c);
            }
        }
        // the keystone (its rune is drawn alive each frame)
        p.rect(cx - 5, ARCH.top - 6, 11, 14, st[1]);
        p.rect(cx - 4, ARCH.top - 5, 9, 1, st[3]);
        for (let y = ARCH.top - 6; y < ARCH.top + 8; y++) p.px(cx - 6, y, dark), p.px(cx + 6, y, dark);
        p.rect(cx - 6, ARCH.top - 7, 13, 1, dark);
        // moss on the arch and pillar tops, hanging moss strands
        for (let n = 0; n < 220; n++) {
            const a = -Math.PI + R() * Math.PI, r = 30 + R() * 4;
            const x = cx + Math.cos(a) * r, y = 90 + Math.sin(a) * r - R() * 2;
            if (Math.sin(a) < -0.15 || R() < 0.3) p.px(x, y, moss[Math.floor(R() * 3)]);
        }
        for (const x0 of [cx - 32, cx + 19]) for (let n = 0; n < 30; n++) p.px(x0 + R() * 13, 87 + R() * 3, moss[Math.floor(R() * 3)]);
        for (let n = 0; n < 9; n++) {
            const x = cx - 30 + Math.floor(R() * 60), y0 = 90 - Math.floor(Math.sqrt(Math.max(0, 31 * 31 - (x - cx) ** 2)));
            const len = 6 + Math.floor(R() * 16);
            for (let y = 0; y < len; y++) p.px(x + (y % 5 === 4 ? 1 : 0), y0 + y, moss[y < len - 2 ? 0 : 1]);
        }
        // rubble and the fallen voussoir
        for (const [x, y, w, h] of [[cx + 26, 133, 9, 7], [cx + 36, 136, 6, 4], [cx - 44, 135, 8, 5], [cx + 8, 136, 5, 4]]) {
            p.rect(x - 1, y - 1, w + 2, h + 1, dark);
            p.rect(x, y, w, h, st[1]);
            p.rect(x, y, w, 1, st[3]);
        }
        // a big near trunk on each side
        const bark = hex('#0b1a13'), barkLit = hex('#163126');
        for (const [x0, w] of [[M + 6, 26], [M + W - 34, 30]]) {
            for (let y = 0; y < H; y++) {
                const sway = Math.round(Math.sin(y / 30) * 2);
                p.rect(x0 + sway, y, w, 1, bark);
                p.px(x0 + sway + w - 3, y, barkLit);
                if (y % 9 === 0) p.px(x0 + sway + 6, y, barkLit);
            }
        }
        p.done();
    }
    // ---- the ground: grass, the stream, the wanderer on the bank
    const ground = layer();
    const WANDER = { x: 216 + M, y: 128 };
    {
        const p = painter(ground);
        const soil = hex('#0f2216'), grass = ['#1f4424', '#2d5f2c', '#4c8a36'].map(hex);
        const water = ['#0d2a2c', '#143a3b', '#1f5550'].map(hex);
        for (let x = 0; x < p.w; x++) {
            const g = 138 + Math.round(Math.sin(x / 23) * 2 + Math.sin(x / 7) * 0.8);
            for (let y = g; y < H; y++) p.px(x, y, soil);
            p.px(x, g, grass[2]);
            p.px(x, g + 1, grass[1]);
            p.px(x, g + 2, grass[0]);
            if (R() < 0.35) for (let k = 1; k <= 1 + Math.floor(R() * 3); k++) p.px(x, g - k, grass[k === 1 ? 1 : 2]);
            // the stream, winding across the front
            const s0 = 152 + Math.round(Math.sin(x / 40) * 3), s1 = s0 + 9 + Math.round(Math.sin(x / 17) * 1.5);
            for (let y = s0; y < s1; y++) p.px(x, y, water[y === s0 ? 2 : y < s0 + 3 ? 1 : 0]);
            p.px(x, s0 - 1, grass[0]);
        }
        // the wanderer: a hooded traveller with a pack and a staff
        const SPR = [
            '.....kkk.....',
            '....kHHHk....',
            '...kHHHHHk...',
            '..kkkkkkkkk..',
            '....kfffk....',
            '....krrrk....',
            '...kcccccks..',
            '..kccccccks..',
            '..kcpcccck.s.',
            '..kcpcccck.s.',
            '..kccccccks..',
            '...kccccck.s.',
            '...kccccck.s.',
            '....kc.ck..s.',
            '....kb.bk..s.',
        ];
        const C: Record<string, RGB> = { k: hex('#0a0c0b'), H: hex('#a8873a'), f: hex('#d9b08a'), r: hex('#b8442c'), c: hex('#2e2a3a'), p: hex('#5a3a2a'), b: hex('#1a1414'), s: hex('#5a3d22') };
        SPR.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && p.px(WANDER.x + x, WANDER.y + y - SPR.length + 10, C[ch])));
        p.done();
    }
    // ---- the near dark: ferns and leaves at the edges
    const near = layer();
    {
        const p = painter(near);
        const f = hex('#040a07'), f2 = hex('#0a1a10');
        const fern = (x0: number, y0: number, dir: number, len: number) => {
            for (let n = 0; n < 5; n++) {
                const ang = -Math.PI / 2 + dir * (0.4 + n * 0.28);
                for (let t = 0; t < len - n * 4; t++) {
                    const x = x0 + Math.cos(ang) * t + dir * (t * t) / 60, y = y0 + Math.sin(ang) * t + (t * t) / 40;
                    p.px(x, y, f);
                    p.px(x, y + 1, f);
                    if (t % 3 === 0) p.px(x + dir, y + 2, f2), p.px(x - dir, y - 1, f2);
                }
            }
        };
        fern(M + 4, H + 4, 1, 46);
        fern(M + 30, H + 6, 1, 30);
        fern(M + W - 4, H + 4, -1, 50);
        fern(M + W - 36, H + 8, -1, 28);
        // the canopy's edge hanging into the top corners
        for (let n = 0; n < 14; n++) p.disc(M + (n < 7 ? n * 9 : W - (n - 7) * 9), -2 + (n % 3) * 4, 8 + (n % 4) * 2, f, f2);
        p.done();
    }
    // ---- the frame's shadow
    const vig = document.createElement('canvas');
    vig.width = W;
    vig.height = H;
    {
        const ctx = vig.getContext('2d')!;
        const img = ctx.createImageData(W, H);
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const d = Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2));
                const k = Math.max(0, (d - 0.62) / 0.6);
                if (k > BAYER[(y % 4) * 4 + (x % 4)] * 0.9) img.data[(y * W + x) * 4 + 3] = Math.min(200, 70 + k * 120);
            }
        }
        ctx.putImageData(img, 0, 0);
    }
    return { sky, far, mid, ground, near, vig, ARCH, WANDER };
}

export function PixelForest({ look }: { look: { x: number; y: number } }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const lookRef = useRef(look);
    lookRef.current = look;
    useEffect(() => {
        const c = ref.current;
        if (!c) return;
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d')!;
        const world = paintWorld();
        const R = rng(5);
        const flies = Array.from({ length: 22 }, () => ({ x: R() * W, y: 70 + R() * 90, ph: R() * 6, sp: 0.4 + R() * 0.6 }));
        const leaves = Array.from({ length: 9 }, () => ({ x: R() * W, y: R() * H, v: 6 + R() * 6, ph: R() * 6 }));
        const motes = Array.from({ length: 30 }, () => ({ s: R(), d: R(), ph: R() * 6 }));
        const eased = { x: 0, y: 0 };
        let raf = 0;
        let last = performance.now();
        const t0 = last;
        const step = (now: number) => {
            raf = requestAnimationFrame(step);
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            const t = (now - t0) / 1000;
            eased.x += (lookRef.current.x - eased.x) * Math.min(1, dt * 4);
            eased.y += (lookRef.current.y - eased.y) * Math.min(1, dt * 4);
            const off = (depth: number) => Math.round(-M - eased.x * M * 2 * depth);
            ctx.clearRect(0, 0, W, H);
            ctx.drawImage(world.sky, off(0.1), 0);
            ctx.drawImage(world.far, off(0.25), 0);
            // shafts of light through the canopy, and dust turning in them
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const shafts = [[40, 22, 0], [92, 14, 1.3], [150, 26, 2.1], [210, 12, 0.6]];
            for (const [x, w, ph] of shafts) {
                ctx.globalAlpha = 0.06 + 0.035 * Math.sin(t * 0.7 + ph);
                ctx.fillStyle = '#d8ffb8';
                ctx.beginPath();
                ctx.moveTo(x + off(0.2) + M, -2);
                ctx.lineTo(x + w + off(0.2) + M, -2);
                ctx.lineTo(x + w + 70 + off(0.2) + M, H);
                ctx.lineTo(x + 70 + off(0.2) + M, H);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            for (const m of motes) {
                const [sx, sw] = shafts[Math.floor(m.s * shafts.length)];
                const y = ((m.d * H + t * 4) % H);
                const x = sx + off(0.2) + M + (y / H) * 70 + ((m.ph * 7) % sw) + Math.sin(t + m.ph) * 2;
                ctx.fillStyle = `rgba(240,255,210,${0.35 + 0.35 * Math.sin(t * 2 + m.ph)})`;
                ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
            }
            ctx.restore();
            // the ruin, its doorway's light and the rune
            const mo = off(0.5);
            ctx.drawImage(world.mid, mo, 0);
            const cx = world.ARCH.cx + mo;
            const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let r = 16; r >= 2; r -= 3) {
                ctx.globalAlpha = (0.05 + 0.04 * pulse) * (1 - r / 18) * 3;
                ctx.fillStyle = '#8a6cff';
                ctx.fillRect(Math.round(cx - r), Math.round(118 - r * 1.4), r * 2 + 1, Math.round(r * 2.8));
            }
            ctx.restore();
            const runeOn = 0.55 + 0.45 * pulse;
            ctx.fillStyle = `rgba(150,240,255,${runeOn})`;
            for (const [x, y] of [[0, -3], [0, -2], [0, -1], [0, 0], [0, 1], [-2, -1], [2, -1], [-1, -2], [1, -2], [-1, 1], [1, 1]]) ctx.fillRect(cx + x, world.ARCH.top + 1 + y, 1, 1);
            ctx.fillStyle = `rgba(150,240,255,${0.12 * runeOn})`;
            ctx.fillRect(cx - 5, world.ARCH.top - 4, 11, 10);
            // the ground and the wanderer's lantern
            const go = off(0.7);
            ctx.drawImage(world.ground, go, 0);
            const lx = world.WANDER.x + go + 11, ly = world.WANDER.y + 1;
            const flick = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let r = 10; r >= 2; r -= 2) {
                ctx.globalAlpha = 0.06 * flick * (11 - r) / 3;
                ctx.fillStyle = '#ffb84a';
                ctx.fillRect(lx - r, ly - r, r * 2 + 1, r * 2 + 1);
            }
            ctx.restore();
            ctx.fillStyle = '#ffe9a0';
            ctx.fillRect(lx, ly, 1, 2);
            // the stream glittering
            for (let n = 0; n < 18; n++) {
                const x = Math.round(((n * 53 + t * 9) % (W + 40)) - 20 + go + M);
                const y = 154 + (n % 4) * 2 + Math.round(Math.sin(x / 40) * 2);
                ctx.fillStyle = `rgba(160,230,220,${0.35 + 0.3 * Math.sin(t * 3 + n)})`;
                ctx.fillRect(x, y, 2 + (n % 3), 1);
            }
            // fireflies
            for (const f of flies) {
                f.ph += dt * f.sp;
                const x = Math.round(f.x + Math.sin(f.ph * 1.3) * 10 + off(0.6) + M), y = Math.round(f.y + Math.cos(f.ph) * 6);
                const on = Math.max(0, Math.sin(f.ph * 2.4));
                if (on < 0.05) continue;
                ctx.fillStyle = `rgba(220,255,140,${on * 0.35})`;
                ctx.fillRect(x - 1, y, 3, 1);
                ctx.fillRect(x, y - 1, 1, 3);
                ctx.fillStyle = `rgba(250,255,210,${on})`;
                ctx.fillRect(x, y, 1, 1);
            }
            // leaves falling
            for (const l of leaves) {
                l.y += l.v * dt;
                l.ph += dt * 2;
                if (l.y > H + 4) {
                    l.y = -4;
                    l.x = Math.random() * W;
                }
                const x = Math.round(l.x + Math.sin(l.ph) * 8);
                ctx.fillStyle = Math.sin(l.ph) > 0 ? '#5a8a2e' : '#3d6a24';
                ctx.fillRect(x, Math.round(l.y), 2, 1);
            }
            ctx.drawImage(world.near, off(1), 0);
            ctx.drawImage(world.vig, 0, 0);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, []);
    return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" style={{ imageRendering: 'pixelated', objectFit: 'cover' }} />;
}
