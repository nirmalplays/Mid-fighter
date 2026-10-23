/**
 * Night over the world, drawn in screen space: the dark closes in to the circle of the
 * player's torch (wider with a Night-Vision Elixir or beside a lit fire; it flickers), and
 * dusk and dawn tint the sky. How dark it is comes from shared/daynight.ts.
 */
import { Container, Graphics, Sprite, Texture, type Application } from 'pixi.js';

export interface Darkness {
    /** `dark` 0..1, `clearPx` the torch's clear radius in screen px, `warm` 0..1 for the dusk tint. */
    update(dark: number, clearPx: number, warm: number): void;
    destroy(): void;
}

export function createDarkness(app: Application, above: Container): Darkness {
    const root = new Container();
    app.stage.addChildAt(root, app.stage.getChildIndex(above) + 1);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g2 = c.getContext('2d')!;
    const grad = g2.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(6,8,22,0)');
    grad.addColorStop(0.55, 'rgba(6,8,22,0.25)');
    grad.addColorStop(0.85, 'rgba(6,8,22,0.85)');
    grad.addColorStop(1, 'rgba(6,8,22,1)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 256, 256);
    const tex = Texture.from(c);
    const hole = new Sprite(tex);
    hole.anchor.set(0.5);
    const edge = new Graphics();
    const tint = new Graphics();
    root.addChild(tint, hole, edge);
    let sightNow = 200;
    let clock = 0;

    return {
        update(dark, clearPx, warm) {
            clock += 16;
            const W = app.screen.width;
            const H = app.screen.height;
            tint.clear();
            if (warm > 0.01) tint.rect(0, 0, W, H).fill({ color: 0xff7a3a, alpha: 0.16 * warm });
            const show = dark > 0.01;
            hole.visible = show;
            edge.clear();
            if (!show) return;
            // Ease the circle so a potion or a fire opens it smoothly.
            sightNow += (clearPx - sightNow) * 0.08;
            // The texture is clear to 55% of its radius; a torch flickers a little.
            const flicker = 1 + 0.025 * Math.sin(clock / 70) + 0.015 * Math.sin(clock / 23);
            const size = ((sightNow * 2) / 0.55) * flicker;
            hole.width = hole.height = size;
            hole.position.set(W / 2, H / 2);
            hole.alpha = 0.94 * dark;
            const x0 = W / 2 - size / 2, y0 = H / 2 - size / 2;
            const col = { color: 0x060816, alpha: 0.94 * dark };
            if (x0 > 0) edge.rect(0, 0, x0 + 1, H).fill(col).rect(W - x0 - 1, 0, x0 + 1, H).fill(col);
            if (y0 > 0) edge.rect(x0, 0, size, y0 + 1).fill(col).rect(x0, H - y0 - 1, size, y0 + 1).fill(col);
        },
        destroy() {
            root.destroy({ children: true });
            tex.destroy(true);
        },
    };
}
