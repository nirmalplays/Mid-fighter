/**
 * Draws the workshop portal while it is open: the same green stone portal as before, a
 * green ring on the ground showing the safe zone (monsters cannot enter it or bite inside
 * it), and a label with the seconds left. It fades in, blinks when it is about to close,
 * and shrinks away. The simulation (shared/sim.ts) decides when and where it appears.
 */
import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { SAFE_RADIUS } from '../../shared/sim.ts';
import { TILE_DX, TILE_DY } from './constants.ts';
import type { ViewSafe } from './worldSim.ts';

const PORTAL_FRAMES = 6;
const PORTAL_W = 112;
const PORTAL_H = 128;
const PORTAL_BASE_Y = 108 / PORTAL_H;
const PORTAL_MS = 130;
const OPEN_MS = 700;
const CLOSE_MS = 600;
/** A grid circle of radius r draws as an ellipse this wide and tall on the iso screen. */
const RING_A = SAFE_RADIUS * TILE_DX * Math.SQRT2;
const RING_B = SAFE_RADIUS * TILE_DY * Math.SQRT2;

export interface SafeView {
    sync(safe: ViewSafe | null, dtMs: number): void;
    destroy(): void;
}

export function createSafeView(opts: {
    layer: Container;
    heightAt: (u: number, v: number) => number;
    toScreen: (u: number, v: number) => { x: number; y: number };
    zFor: (u: number, v: number) => number;
    levelH: number;
}): SafeView {
    const sheet = Assets.get<Texture>('portal');
    sheet.source.scaleMode = 'nearest';
    const tex = Array.from({ length: PORTAL_FRAMES }, (_, n) =>
        new Texture({ source: sheet.source, frame: new Rectangle(n * PORTAL_W, 0, PORTAL_W, PORTAL_H) }));

    let clock = 0;
    let shown: { key: string; sprite: Sprite; ring: Graphics; label: Text } | null = null;

    const remove = () => {
        if (!shown) return;
        shown.sprite.destroy();
        shown.ring.destroy();
        shown.label.destroy();
        shown = null;
    };

    return {
        sync(safe, dtMs) {
            clock += dtMs;
            if (!safe) {
                remove();
                return;
            }
            const key = `${safe.u.toFixed(1)}:${safe.v.toFixed(1)}`;
            if (shown && shown.key !== key) remove();
            if (!shown) {
                const sprite = new Sprite(tex[0]);
                sprite.anchor.set(0.5, PORTAL_BASE_Y);
                const ring = new Graphics();
                const label = new Text({
                    text: 'SAFE ZONE',
                    style: { fontFamily: 'sans-serif', fontSize: 22, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x14442a, width: 6 } },
                });
                label.anchor.set(0.5);
                label.zIndex = 1e6 - 2;
                opts.layer.addChild(ring, sprite, label);
                shown = { key, sprite, ring, label };
            }
            const pos = opts.toScreen(safe.u, safe.v);
            const z = opts.heightAt(safe.u, safe.v) * opts.levelH;
            const left = Math.max(0, safe.lasts - safe.age);
            const open01 = Math.min(1, safe.age / OPEN_MS);
            let scale = 0.2 + 0.8 * open01 * (2 - open01);
            if (left < CLOSE_MS) scale *= Math.max(0, left / CLOSE_MS);
            // Blink in the last few seconds.
            const blink = left < 4000 && Math.floor(clock / 220) % 2 === 0;
            const zi = opts.zFor(safe.u, safe.v);

            shown.sprite.texture = tex[Math.floor(clock / PORTAL_MS) % PORTAL_FRAMES];
            shown.sprite.position.set(pos.x, pos.y - z);
            shown.sprite.scale.set(1.45 * scale);
            shown.sprite.zIndex = zi + 0.3;
            shown.sprite.alpha = blink ? 0.6 : 1;

            const pulse = 0.5 + 0.5 * Math.sin(clock / 400);
            shown.ring.clear();
            shown.ring.ellipse(0, 0, RING_A * scale, RING_B * scale).fill({ color: 0x4ade80, alpha: 0.14 + 0.06 * pulse });
            shown.ring.ellipse(0, 0, RING_A * scale, RING_B * scale).stroke({ width: 4, color: 0x86efac, alpha: blink ? 0.4 : 0.85 });
            shown.ring.position.set(pos.x, pos.y - z);
            shown.ring.zIndex = zi - 0.45;

            shown.label.text = `SAFE ZONE ${Math.ceil(left / 1000)}s`;
            shown.label.position.set(pos.x, pos.y - z - 185 + Math.sin(clock / 450) * 4);
            shown.label.alpha = Math.min(1, scale * 1.5);
        },
        destroy: remove,
    };
}
