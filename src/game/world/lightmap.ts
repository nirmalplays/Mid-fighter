/**
 * The dark of caves and dungeons: everything is dim but what a light falls on. Each frame a screen-sized
 * mask is drawn (the gloom, with a soft hole cut where every torch, lantern, crystal and the hero's own
 * light shine) and laid over the world, then each light adds a little of its colour on top, so torchlight
 * is warm, crystals glow blue or violet, and the walls flicker.
 */
import { Container, Graphics, RenderTexture, Sprite, Texture, type Application } from 'pixi.js';

export interface Light {
    /** Screen position (px) and radius (px). */
    x: number;
    y: number;
    r: number;
    color: number;
    /** 0..1: how much it flickers. */
    flicker?: number;
    /** 0..1: how much of the gloom it lifts at its heart (default 1: a torch); a cave's soft glow lifts less. */
    a?: number;
}

export interface LightMap {
    /** `gloom` 0 (off) .. 1 (black away from lights). */
    update(gloom: number, lights: Light[], dtMs: number): void;
    destroy(): void;
}

function radial(stops: [number, string][]): Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    for (const [at, col] of stops) grad.addColorStop(at, col);
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return Texture.from(c);
}

export function createLightMap(app: Application, above: Container): LightMap {
    const holeTex = radial([[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.85)'], [0.8, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]);
    const glowTex = radial([[0, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]);
    // The mask: gloom, with holes erased where the lights are.
    const mask = new Container();
    const fill = new Graphics();
    mask.addChild(fill);
    const holes: Sprite[] = [];
    let rt = RenderTexture.create({ width: Math.max(1, app.screen.width), height: Math.max(1, app.screen.height) });
    const shade = new Sprite(rt);
    // The colour each light throws, added over the shade.
    const glows = new Container();
    const glowSprites: Sprite[] = [];
    const root = new Container();
    root.addChild(shade, glows);
    app.stage.addChildAt(root, app.stage.getChildIndex(above) + 1);
    let clock = 0;

    const sprite = (list: Sprite[], parent: Container, tex: Texture, n: number, blend: 'erase' | 'add') => {
        while (list.length < n) {
            const s = new Sprite(tex);
            s.anchor.set(0.5);
            s.blendMode = blend;
            parent.addChild(s);
            list.push(s);
        }
        for (let k = 0; k < list.length; k++) list[k].visible = k < n;
    };

    return {
        update(gloom, lights, dtMs) {
            clock += dtMs;
            root.visible = gloom > 0.01;
            if (!root.visible) return;
            const W = app.screen.width, H = app.screen.height;
            if (rt.width !== Math.ceil(W) || rt.height !== Math.ceil(H)) {
                rt.destroy(true);
                rt = RenderTexture.create({ width: Math.max(1, Math.ceil(W)), height: Math.max(1, Math.ceil(H)) });
                shade.texture = rt;
            }
            fill.clear().rect(0, 0, W, H).fill({ color: 0x05030a, alpha: gloom });
            const shown = lights.filter((l) => l.x > -l.r && l.y > -l.r && l.x < W + l.r && l.y < H + l.r).slice(0, 64);
            sprite(holes, mask, holeTex, shown.length, 'erase');
            sprite(glowSprites, glows, glowTex, shown.length, 'add');
            shown.forEach((l, k) => {
                const f = 1 + (l.flicker ?? 0) * (0.05 * Math.sin(clock / 70 + k * 1.7) + 0.03 * Math.sin(clock / 23 + k));
                const h = holes[k];
                h.position.set(l.x, l.y);
                h.width = h.height = l.r * 2 * f;
                h.alpha = l.a ?? 1;
                const g = glowSprites[k];
                g.position.set(l.x, l.y);
                g.width = l.r * 1.6 * f;
                g.height = l.r * 1.1 * f;
                g.tint = l.color;
                g.alpha = 0.55 * gloom * (l.a ?? 1);
            });
            app.renderer.render({ container: mask, target: rt, clear: true });
        },
        destroy() {
            root.destroy({ children: true });
            mask.destroy({ children: true });
            rt.destroy(true);
            holeTex.destroy(true);
            glowTex.destroy(true);
        },
    };
}
