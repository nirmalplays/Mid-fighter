/**
 * Draws the wave portal. The simulation (shared/sim.ts) decides when and where a portal
 * opens and what it spawns; this only shows it: a red-tinted portal that opens, glows with
 * its wave number above it, and shrinks away when it closes.
 */
import { Assets, Container, Rectangle, Sprite, Text, Texture } from 'pixi.js';

const PORTAL_FRAMES = 6;
const PORTAL_W = 112;
const PORTAL_H = 128;
const PORTAL_BASE_Y = 108 / PORTAL_H;
const PORTAL_MS = 110;
const OPEN_MS = 900;
const CLOSE_MS = 700;

/** The portal as the simulation describes it. */
export interface ViewPortal {
    u: number;
    v: number;
    wave: number;
    /** Ms since it opened, and the age at which it starts closing (-1 while still spawning). */
    age: number;
    doneAt: number;
}

export interface PortalView {
    sync(portal: ViewPortal | null, dtMs: number): void;
    destroy(): void;
}

export function createPortalView(opts: {
    layer: Container;
    glowTex: Texture;
    heightAt: (u: number, v: number) => number;
    toScreen: (u: number, v: number) => { x: number; y: number };
    zFor: (u: number, v: number) => number;
    levelH: number;
}): PortalView {
    const sheet = Assets.get<Texture>('portal');
    sheet.source.scaleMode = 'nearest';
    const tex = Array.from({ length: PORTAL_FRAMES }, (_, n) =>
        new Texture({ source: sheet.source, frame: new Rectangle(n * PORTAL_W, 0, PORTAL_W, PORTAL_H) }));

    let clock = 0;
    let shown: { key: string; sprite: Sprite; glow: Sprite; label: Text } | null = null;

    const remove = () => {
        if (!shown) return;
        shown.sprite.destroy();
        shown.glow.destroy();
        shown.label.destroy();
        shown = null;
    };

    return {
        sync(portal, dtMs) {
            clock += dtMs;
            if (!portal) {
                remove();
                return;
            }
            const key = `${portal.wave}:${portal.u.toFixed(1)}:${portal.v.toFixed(1)}`;
            if (shown && shown.key !== key) remove();
            if (!shown) {
                const sprite = new Sprite(tex[0]);
                sprite.anchor.set(0.5, PORTAL_BASE_Y);
                sprite.tint = 0xff6b6b;
                const glow = new Sprite(opts.glowTex);
                glow.anchor.set(0.5);
                glow.tint = 0xff3b3b;
                const label = new Text({
                    text: `WAVE ${portal.wave}`,
                    style: { fontFamily: 'sans-serif', fontSize: 24, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x6b1010, width: 6 } },
                });
                label.anchor.set(0.5);
                label.zIndex = 1e6 - 2;
                opts.layer.addChild(glow, sprite, label);
                shown = { key, sprite, glow, label };
            }
            const pos = opts.toScreen(portal.u, portal.v);
            const z = opts.heightAt(portal.u, portal.v) * opts.levelH;
            const open01 = Math.min(1, portal.age / OPEN_MS);
            let scale = 0.2 + 0.9 * open01 * (2 - open01);
            if (portal.doneAt >= 0) scale *= Math.max(0, 1 - (portal.age - portal.doneAt) / CLOSE_MS);
            const zi = opts.zFor(portal.u, portal.v);
            shown.sprite.texture = tex[Math.floor(clock / PORTAL_MS) % PORTAL_FRAMES];
            shown.sprite.position.set(pos.x, pos.y - z);
            shown.sprite.scale.set(1.5 * scale);
            shown.sprite.zIndex = zi - 0.2;
            shown.glow.position.set(pos.x, pos.y - z);
            shown.glow.scale.set(1.2 * scale + 0.1 * Math.sin(clock / 260));
            shown.glow.alpha = 0.45 * scale;
            shown.glow.zIndex = zi - 0.4;
            shown.label.position.set(pos.x, pos.y - z - 175 + Math.sin(clock / 400) * 4);
            shown.label.alpha = Math.min(1, scale * 1.5);
        },
        destroy: remove,
    };
}
