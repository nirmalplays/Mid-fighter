/**
 * Draws what enemies shoot: a wizard's bolt (a violet orb with a fading trail) and an archer's
 * arrow (a shaft pointing the way it flies). Like the monsters, it owns no logic: each frame it
 * is handed the shots in flight (worldSim.ts) and shows them, a little above the ground.
 */
import { Container, Graphics } from 'pixi.js';
import type { ViewShot } from './worldSim.ts';
import { TILE_DX, TILE_DY } from './constants.ts';

export interface ShotView {
    sync(list: ViewShot[], dtMs: number): void;
    destroy(): void;
}

/** Shots fly at about chest height. */
const LIFT = 26;

export function createShotView(opts: {
    layer: Container;
    toScreen: (u: number, v: number) => { x: number; y: number };
    heightAt: (u: number, v: number) => number;
    zFor: (u: number, v: number) => number;
    levelH: number;
}): ShotView {
    const shown = new Map<number, { g: Graphics; age: number }>();
    const draw = (g: Graphics, sh: ViewShot, age: number) => {
        g.clear();
        // The direction of flight on screen.
        const sx = (sh.du - sh.dv) * TILE_DX, sy = (sh.du + sh.dv) * TILE_DY;
        const len = Math.hypot(sx, sy) || 1;
        const ux = sx / len, uy = sy / len;
        if (sh.kind === 'bolt') {
            const pulse = 1 + 0.15 * Math.sin(age / 60);
            for (let n = 4; n >= 1; n--) g.circle(-ux * n * 7, -uy * n * 7, (7 - n) * 1.1).fill({ color: 0xa855f7, alpha: 0.12 * (5 - n) });
            g.circle(0, 0, 11 * pulse).fill({ color: 0xc084fc, alpha: 0.35 });
            g.circle(0, 0, 6 * pulse).fill({ color: 0xf5d0fe });
        } else {
            g.moveTo(-ux * 16, -uy * 16).lineTo(ux * 10, uy * 10).stroke({ width: 3, color: 0x6b4a2a });
            g.poly([ux * 15, uy * 15, ux * 7 - uy * 4, uy * 7 + ux * 4, ux * 7 + uy * 4, uy * 7 - ux * 4]).fill(0xe5e7eb);
            g.moveTo(-ux * 16 - uy * 4, -uy * 16 + ux * 4).lineTo(-ux * 11, -uy * 11).lineTo(-ux * 16 + uy * 4, -uy * 16 - ux * 4).stroke({ width: 2, color: 0xfca5a5 });
        }
    };
    return {
        sync(list, dtMs) {
            const seen = new Set<number>();
            for (const sh of list) {
                seen.add(sh.id);
                let s = shown.get(sh.id);
                if (!s) {
                    s = { g: new Graphics(), age: 0 };
                    opts.layer.addChild(s.g);
                    shown.set(sh.id, s);
                }
                s.age += dtMs;
                draw(s.g, sh, s.age);
                const p = opts.toScreen(sh.u, sh.v);
                s.g.position.set(p.x, p.y - opts.heightAt(sh.u, sh.v) * opts.levelH - LIFT);
                s.g.zIndex = opts.zFor(sh.u, sh.v) + 0.2;
            }
            for (const [id, s] of shown) {
                if (seen.has(id)) continue;
                s.g.destroy();
                shown.delete(id);
            }
        },
        destroy() {
            for (const s of shown.values()) s.g.destroy();
            shown.clear();
        },
    };
}
