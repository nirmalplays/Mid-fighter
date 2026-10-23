/**
 * The MEH FIGHTER title, as pixel art: classical relic capitals (Cinzel Decorative) cut to hard pixels on a small canvas shown
 * scaled up crisp, every edge hard. The letters are struck from banded gold with a dark outline and
 * a drop shadow, a relic sword stands behind them, a gold rule with a gem runs beneath, and embers
 * drift up past them; now and then a glint runs across the gold.
 *
 * With `intro`, it is forged in front of you: darkness and embers, the sword falls and strikes
 * (a white flash, a shockwave, the screen shakes, sparks fly: `onImpact` fires then), the letters
 * burn in from the centre white-hot and cool to gold, and the rule draws itself out. `onDone`
 * fires when it has settled.
 */
import { useEffect, useRef, type CSSProperties } from 'react';

const TEXT = 'MEH FIGHTER';
const FONT_PX = 40;
/** Classical relic capitals, cut to hard pixels. */
const FONT = `900 ${FONT_PX}px 'Cinzel Decorative'`;
const H = 128;
/** The sword behind the letters (images/swords.png, 6 × 5 swords of 32 px). */
const SWORD = 10;
/** Gold, top to bottom, in hard bands. */
const BANDS = ['#fffbe6', '#ffe9a8', '#ffd66b', '#f5b843', '#d98b24', '#a8611a'];
const INK = '#1b0f08';

/** When things happen in the intro (seconds). */
const T = { fall: 0.45, impact: 0.8, reveal: 1.6, cool: 2.6, done: 3.1 };
const ease = (k: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);

/** Keep only solid pixels (no soft edges): alpha below the line goes, above becomes full. */
function harden(c: HTMLCanvasElement): void {
    const ctx = c.getContext('2d')!;
    const img = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] >= 110 ? 255 : 0;
    ctx.putImageData(img, 0, 0);
}
const canvasOf = (w: number, h: number) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
};

export function PixelLogo({ intro = false, width = '100%', onImpact, onDone, style }: { intro?: boolean; width?: number | string; onImpact?: () => void; onDone?: () => void; style?: CSSProperties }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const cb = useRef({ onImpact, onDone });
    cb.current = { onImpact, onDone };
    useEffect(() => {
        let raf = 0;
        let dead = false;
        const start = async () => {
            try {
                await document.fonts.load(FONT);
            } catch { /* draw with whatever is there */ }
            if (dead || !ref.current) return;
            const view = ref.current;
            // Size the canvas to the words.
            const probe = canvasOf(8, 8).getContext('2d')!;
            probe.font = FONT;
            const tw = Math.ceil(probe.measureText(TEXT).width);
            const W = tw + 56;
            view.width = W;
            view.height = H;
            const ty = 66; // the letters' middle
            const draw = (c: HTMLCanvasElement, color: string, dx = 0, dy = 0) => {
                const x = c.getContext('2d')!;
                x.font = FONT;
                x.textAlign = 'center';
                x.textBaseline = 'middle';
                x.fillStyle = color;
                x.fillText(TEXT, W / 2 + dx, ty + dy);
            };
            // The pieces, made once: the outline and shadow, the gold face, the letters' shape (for glints and glow).
            const shape = canvasOf(W, H);
            draw(shape, '#fff');
            harden(shape);
            const edge = canvasOf(W, H);
            for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (Math.abs(dx) + Math.abs(dy) <= 3) draw(edge, INK, dx, dy);
            draw(edge, INK, 0, 4);
            draw(edge, INK, 1, 4);
            harden(edge);
            const face = canvasOf(W, H);
            {
                // the gold in hard bands, cut to the letters' shape
                const x = face.getContext('2d')!;
                const top = ty - FONT_PX * 0.42, span = FONT_PX * 0.84;
                BANDS.forEach((c, n) => {
                    x.fillStyle = c;
                    const y0 = n === 0 ? 0 : Math.round(top + (span * n) / BANDS.length);
                    x.fillRect(0, y0, W, H - y0);
                });
                x.globalCompositeOperation = 'destination-in';
                x.drawImage(shape, 0, 0);
                // a one-pixel highlight on each letter's top edge
                x.globalCompositeOperation = 'source-atop';
                x.fillStyle = '#ffffff';
                const m = shape.getContext('2d')!.getImageData(0, 0, W, H).data;
                for (let yy = 1; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (m[(yy * W + xx) * 4 + 3] && !m[((yy - 1) * W + xx) * 4 + 3]) x.fillRect(xx, yy, 1, 1);
            }
            const glow = canvasOf(W, H);
            {
                const x = glow.getContext('2d')!;
                x.filter = 'blur(5px)';
                x.drawImage(shape, 0, 0);
                x.globalCompositeOperation = 'source-in';
                x.fillStyle = '#ff9a2a';
                x.fillRect(0, 0, W, H);
            }
            const swordImg = new Image();
            swordImg.src = 'images/swords.png';

            const ctx = view.getContext('2d')!;
            ctx.imageSmoothingEnabled = false;
            const embers: { x: number; y: number; vx: number; vy: number; life: number; max: number; hot: boolean }[] = [];
            const sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
            const t0 = performance.now() - (intro ? 0 : T.done * 1000);
            let last = performance.now();
            let impacted = !intro, finished = !intro;
            const tmp = canvasOf(W, H);
            const tctx = tmp.getContext('2d')!;
            const step = (now: number) => {
                raf = requestAnimationFrame(step);
                const t = (now - t0) / 1000;
                const dt = Math.min(0.05, (now - last) / 1000);
                last = now;
                if (!impacted && t >= T.impact) {
                    impacted = true;
                    cb.current.onImpact?.();
                    for (let n = 0; n < 40; n++) {
                        const a = Math.PI + Math.random() * Math.PI;
                        const v = 30 + Math.random() * 110;
                        sparks.push({ x: W / 2, y: ty + 18, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.6 });
                    }
                }
                if (!finished && t >= T.done) {
                    finished = true;
                    cb.current.onDone?.();
                }
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, W, H);
                // the shake after the strike
                const shake = t > T.impact && t < T.impact + 0.35 ? (1 - (t - T.impact) / 0.35) * 3 : 0;
                ctx.translate(Math.round((Math.random() - 0.5) * 2 * shake), Math.round((Math.random() - 0.5) * 2 * shake));

                // embers drifting up
                if (Math.random() < dt * 22) embers.push({ x: Math.random() * W, y: H + 2, vx: (Math.random() - 0.5) * 8, vy: -12 - Math.random() * 20, life: 0, max: 2 + Math.random() * 3, hot: Math.random() < 0.4 });
                for (let n = embers.length - 1; n >= 0; n--) {
                    const e = embers[n];
                    e.life += dt;
                    if (e.life > e.max) { embers.splice(n, 1); continue; }
                    e.x += (e.vx + Math.sin(e.life * 3 + n) * 6) * dt;
                    e.y += e.vy * dt;
                    ctx.globalAlpha = Math.sin((e.life / e.max) * Math.PI);
                    ctx.fillStyle = e.hot ? '#ffe08a' : '#ff7a2a';
                    ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
                }
                ctx.globalAlpha = 1;

                // the sword: falls, strikes, stands behind the words
                const fallK = ease((t - T.fall) / (T.impact - T.fall));
                if (t >= T.fall && swordImg.complete && swordImg.naturalWidth) {
                    const sy = -80 + (ty - 8 + 80) * fallK;
                    ctx.save();
                    ctx.translate(W / 2, Math.round(sy));
                    ctx.rotate((225 * Math.PI) / 180); // the sheet's blades point up-left: turn them point-down
                    ctx.scale(3, 3);
                    ctx.drawImage(swordImg, (SWORD % 6) * 32, Math.floor(SWORD / 6) * 32, 32, 32, -16, -16, 32, 32);
                    ctx.restore();
                }

                // the letters: burning in from the centre after the strike, white-hot, cooling to gold
                const reveal = intro ? ease((t - T.impact) / (T.reveal - T.impact)) : 1;
                if (reveal > 0) {
                    const half = (W / 2) * reveal;
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(W / 2 - half, 0, half * 2, H);
                    ctx.clip();
                    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 2.2);
                    ctx.drawImage(glow, 0, 0);
                    ctx.globalAlpha = 1;
                    ctx.drawImage(edge, 0, 0);
                    // the face, with the heat on it and a glint passing now and then
                    tctx.clearRect(0, 0, W, H);
                    tctx.globalCompositeOperation = 'source-over';
                    tctx.drawImage(face, 0, 0);
                    tctx.globalCompositeOperation = 'source-atop';
                    const heat = intro ? 1 - Math.max(0, Math.min(1, (t - T.reveal + 0.4) / (T.cool - T.reveal + 0.4))) : 0;
                    if (heat > 0) {
                        tctx.globalAlpha = heat;
                        tctx.fillStyle = '#fffaf0';
                        tctx.fillRect(0, 0, W, H);
                        tctx.globalAlpha = 1;
                    }
                    const g = (t - T.done) % 5;
                    if (g > 0 && g < 0.9) {
                        const gx = -40 + (W + 80) * (g / 0.9);
                        tctx.fillStyle = 'rgba(255,255,255,.85)';
                        tctx.beginPath();
                        tctx.moveTo(gx, 0); tctx.lineTo(gx + 10, 0); tctx.lineTo(gx - 20, H); tctx.lineTo(gx - 30, H);
                        tctx.fill();
                    }
                    ctx.drawImage(tmp, 0, 0);
                    ctx.restore();
                }

                // the gold rule and its gem, drawing outward
                const ruleK = intro ? ease((t - T.reveal + 0.3) / 0.8) : 1;
                if (ruleK > 0) {
                    const ry = ty + 28, len = Math.round((W / 2 - 36) * ruleK);
                    ctx.fillStyle = INK;
                    ctx.fillRect(W / 2 - len - 1, ry - 1, len * 2 + 2, 4);
                    ctx.fillStyle = '#f5b843';
                    ctx.fillRect(W / 2 - len, ry, len * 2, 1);
                    ctx.fillStyle = '#a8611a';
                    ctx.fillRect(W / 2 - len, ry + 1, len * 2, 1);
                    // dotted tails
                    for (let n = 1; n <= 4; n++) {
                        ctx.fillStyle = n % 2 ? '#f5b843' : '#a8611a';
                        ctx.fillRect(W / 2 - len - 1 - n * 3, ry, 1, 1);
                        ctx.fillRect(W / 2 + len + n * 3, ry, 1, 1);
                    }
                    // the gem
                    const pulse = Math.sin(t * 3) > 0.6;
                    const gem = [[0, -3], [-1, -2], [0, -2], [1, -2], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]];
                    ctx.fillStyle = INK;
                    for (const [x, y] of gem) ctx.fillRect(W / 2 + x - 1, ry + y, 3, 1), ctx.fillRect(W / 2 + x, ry + y - 1, 1, 3);
                    for (const [x, y] of gem) {
                        ctx.fillStyle = y < 0 ? (pulse ? '#ffffff' : '#ffe9a8') : x + y > 0 ? '#c0441c' : '#ff7a3a';
                        ctx.fillRect(W / 2 + x, ry + y, 1, 1);
                    }
                }

                // sparks from the strike
                for (let n = sparks.length - 1; n >= 0; n--) {
                    const s = sparks[n];
                    s.life -= dt;
                    if (s.life <= 0) { sparks.splice(n, 1); continue; }
                    s.vy += 160 * dt;
                    s.x += s.vx * dt;
                    s.y += s.vy * dt;
                    ctx.fillStyle = s.life > 0.3 ? '#fffbe6' : '#ff9a2a';
                    ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
                }
                // the shockwave: a ring of pixels racing out from the strike
                if (t > T.impact && t < T.impact + 0.5) {
                    const k = (t - T.impact) / 0.5;
                    const r = 6 + k * W * 0.55;
                    ctx.fillStyle = `rgba(255,240,200,${1 - k})`;
                    for (let a = 0; a < Math.PI * 2; a += 1.5 / r) ctx.fillRect(Math.round(W / 2 + Math.cos(a) * r), Math.round(ty + 18 + Math.sin(a) * r * 0.35), 1, 1);
                }
                // the flash
                if (t > T.impact && t < T.impact + 0.25) {
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.fillStyle = `rgba(255,250,235,${(1 - (t - T.impact) / 0.25) * 0.9})`;
                    ctx.fillRect(0, 0, W, H);
                }
            };
            raf = requestAnimationFrame(step);
        };
        void start();
        return () => {
            dead = true;
            cancelAnimationFrame(raf);
        };
    }, [intro]);
    return <canvas ref={ref} role="img" aria-label="Meh Fighter" style={{ width, height: 'auto', imageRendering: 'pixelated', display: 'block', ...style }} />;
}
