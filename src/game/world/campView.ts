/**
 * Draws the kingdoms' war camps laid out in world/campLayout.ts: the palisade, towers, gate and barricades,
 * the yard's fire pit, benches, well, racks, crates, notice board and dummy, the torches and braziers (lit
 * at dusk; their flames and glow are lifted above the night's dark through `nightLayer`, so a camp shows
 * as a ring of fires from afar), and the kingdom's colours on every flag.
 *
 * A camp whose kingdom is not yet free stands overrun: stakes snapped and charred, towers fallen, flags
 * torn down, barricades gone, smoke rising. Freeing the kingdom rebuilds it.
 */
import { Assets, Container, Sprite, Texture, type RenderLayer } from 'pixi.js';
import { KINGDOMS, LANDMARKS, type Element } from '../eidolon.ts';
import { campPieces, WALL_R, type CampPiece } from './campLayout.ts';
import { TILE_DY } from './constants.ts';

/**
 * Where a standing piece sorts, past its cell's own place: the ground cubes have soft rounded tops that bulge
 * a little over the cell behind them, so a piece drawn under its two front neighbours' cubes would have its
 * foot covered (a bench sunk into a tile). It goes just after those cubes, still before anything on them.
 */
export const CLEAR_FRONT = TILE_DY - 0.295;

interface Placed {
    piece: CampPiece;
    s: Sprite;
    cloth?: Sprite;
    flame?: Sprite;
    glow?: Sprite;
    shadow?: Sprite;
    phase: number;
}

interface CampDraw {
    el: Element;
    u: number;
    v: number;
    placed: Placed[];
    smoke: { s: Sprite; u: number; v: number; t: number }[];
    all: Sprite[];
    free: boolean | null;
    shown: boolean;
}

export interface CampView {
    /** Lift a light (a flame or glow sprite already in the world) above the night's dark after dusk. */
    light(s: Sprite, u: number, v: number): void;
    /** The smooth glow the camps' lights use. */
    glowTex: Texture;
    /** Where each camp's gate stands (for its name board). */
    gate(el: Element): { u: number; v: number };
    update(dtMs: number, clock: number, u: number, v: number, dark: number, open: (el: Element) => boolean): void;
    destroy(): void;
}

export function createCampView(o: {
    layer: Container;
    nightLayer?: RenderLayer | null;
    glowTex: Texture;
    shadowTex: Texture;
    flames: Texture[];
    isoSprite: (name: string, x: number, y: number) => Sprite;
    ground: (u: number, v: number) => { x: number; y: number };
    zFor: (u: number, v: number) => number;
}): CampView {
    const pieces = campPieces();
    // A smooth warm pool of light (and, tinted grey, a puff of smoke): a radial fade squashed to the ground's 2:1.
    const soft = (() => {
        const c = document.createElement('canvas');
        c.width = 180;
        c.height = 90;
        const g = c.getContext('2d')!;
        g.setTransform(1, 0, 0, 0.5, 0, 0);
        const grad = g.createRadialGradient(90, 90, 0, 90, 90, 90);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.35, 'rgba(255,255,255,0.5)');
        grad.addColorStop(0.7, 'rgba(255,255,255,0.15)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 180, 180);
        return Texture.from(c);
    })();
    /** Every flame and glow, and whether it is lifted over the dark right now. */
    const lights: { s: Sprite; u: number; v: number; up: boolean }[] = [];
    /** The camp's people sleep in tents of the same canvas as the five you build. */
    const tent = (name: string, x: number, y: number) => {
        const tex = Assets.get<Texture>(name);
        tex.source.scaleMode = 'linear';
        const s = new Sprite(tex);
        s.anchor.set(0.5, 0.78);
        s.scale.set(0.2);
        s.position.set(x, y);
        return s;
    };
    const camps: CampDraw[] = LANDMARKS.filter((l) => l.kind === 'camp' && l.el).map((L) => {
        const cu = L.i + 0.5, cv = L.j + 0.5;
        const color = KINGDOMS[L.el!].color;
        const all: Sprite[] = [];
        const add = <T extends Sprite>(s: T): T => {
            o.layer.addChild(s);
            all.push(s);
            return s;
        };
        const placed = pieces.map((piece, n): Placed => {
            const pu = cu + piece.du, pv = cv + piece.dv;
            const at = o.ground(pu, pv);
            // Clear of the ground in front (CLEAR_FRONT); flat pieces lie under whoever stands on them.
            const z = piece.flat ? o.zFor(pu, pv) - 0.27 : o.zFor(pu, pv) + CLEAR_FRONT;
            const s = add(piece.name.startsWith('tent_') ? tent(piece.name, at.x, at.y) : o.isoSprite(piece.name, at.x, at.y));
            s.zIndex = z;
            const p: Placed = { piece, s, phase: n * 1.37 };
            if (piece.cloth) {
                const c = add(o.isoSprite(piece.cloth, at.x, at.y));
                c.tint = color;
                c.zIndex = z + 0.001;
                p.cloth = c;
            }
            if (piece.fire) {
                const f = add(new Sprite(o.flames[0]));
                f.anchor.set(0.5, 0.9);
                f.scale.set(piece.fire.scale);
                f.position.set(at.x, at.y - piece.fire.lift);
                f.zIndex = z + 0.002;
                const g = add(new Sprite(soft));
                g.anchor.set(0.5);
                g.tint = 0xffa040;
                g.blendMode = 'add';
                g.scale.set(piece.fire.scale * 0.9);
                g.position.set(at.x, at.y - piece.fire.lift + 4);
                g.zIndex = z + 0.003;
                p.flame = f;
                p.glow = g;
                lights.push({ s: f, u: pu, v: pv, up: false }, { s: g, u: pu, v: pv, up: false });
            }
            if (!piece.flat && !piece.name.startsWith('camp_wall') && !piece.name.startsWith('camp_torch') && piece.name !== 'camp_gate') {
                const sh = add(new Sprite(o.shadowTex));
                sh.anchor.set(0.5);
                sh.scale.set(piece.name === 'camp_tower' ? 1.5 : 1);
                sh.position.set(at.x, at.y + 10);
                sh.zIndex = o.zFor(pu, pv) - 0.4;
                sh.alpha = 0.8;
                p.shadow = sh;
            }
            return p;
        });
        // Smoke over an overrun camp: from its tents and a few broken stretches of wall.
        const smoke: CampDraw['smoke'] = [];
        const vents: [number, number][] = [[-4, 4], [4, -4], [-4, -4], [0, -6], [WALL_R, 2], [-2, -WALL_R], [-WALL_R, 1], [2, WALL_R]];
        for (const [du, dv] of vents) {
            for (let k = 0; k < 3; k++) {
                const s = add(new Sprite(soft));
                s.anchor.set(0.5);
                s.tint = 0x8a8088;
                s.zIndex = 1e5 - 10;
                smoke.push({ s, u: cu + du, v: cv + dv, t: k / 3 + du * 0.07 });
            }
        }
        return { el: L.el!, u: cu, v: cv, placed, smoke, all, free: null, shown: true };
    });

    const setFree = (c: CampDraw, free: boolean) => {
        c.free = free;
        for (const p of c.placed) {
            const { piece } = p;
            const ruinName = piece.ruin ?? piece.name;
            const gone = free ? piece.only === 'ruin' : piece.only === 'free' || ruinName === '';
            p.s.visible = !gone;
            if (piece.name.startsWith('tent_')) p.s.tint = free ? 0xffffff : 0x3a3036;
            else if (!gone) {
                const want = free ? piece.name : ruinName;
                const fresh = o.isoSprite(want, 0, 0);
                p.s.texture = fresh.texture;
                p.s.anchor.copyFrom(fresh.anchor);
                fresh.destroy();
                // An overrun camp's leftovers are scorched.
                p.s.tint = free || piece.ruin ? 0xffffff : 0x6a5a58;
            }
            if (p.cloth) p.cloth.visible = free;
            if (p.shadow) p.shadow.visible = !gone;
        }
        for (const sm of c.smoke) sm.s.visible = !free;
    };

    return {
        glowTex: soft,
        light(s, u, v) {
            lights.push({ s, u, v, up: false });
        },
        gate(el) {
            const c = camps.find((x) => x.el === el)!;
            return { u: c.u, v: c.v + WALL_R };
        },
        update(dtMs, clock, u, v, dark, open) {
            // After dusk the fires show through the dark (the night layer draws over it). Those close by stay in
            // the world's own order (inside the torch's circle they show anyway), so you never walk under a flame.
            if (o.nightLayer) {
                const lift = dark > 0.2;
                for (const l of lights) {
                    const up = lift && Math.hypot(u - l.u, v - l.v) > 2;
                    if (up === l.up) continue;
                    l.up = up;
                    if (up) o.nightLayer.attach(l.s);
                    else o.nightLayer.detach(l.s);
                }
            }
            for (const c of camps) {
                const near = Math.abs(u - c.u) < 34 && Math.abs(v - c.v) < 34;
                if (near !== c.shown) {
                    c.shown = near;
                    for (const s of c.all) s.renderable = near;
                }
                if (!near) continue;
                const free = open(c.el);
                if (free !== c.free) setFree(c, free);
                for (const p of c.placed) {
                    if (p.cloth) p.cloth.skew.y = 0.03 * Math.sin(clock / 420 + p.phase);
                    if (!p.flame || !p.glow) continue;
                    // Torches and tower braziers burn from dusk; the braziers by the gate burn all day. Nothing burns in a fallen camp.
                    const allDay = p.piece.name === 'camp_brazier';
                    const lit = free && (allDay || dark > 0.12);
                    p.flame.visible = lit;
                    p.glow.visible = lit;
                    if (!lit) continue;
                    p.flame.texture = o.flames[Math.floor((clock + p.phase * 300) / 85) % o.flames.length];
                    const k = p.piece.fire!.scale;
                    p.flame.scale.set(k * (1 + 0.05 * Math.sin(clock / 70 + p.phase)), k * (1 + 0.09 * Math.sin(clock / 53 + p.phase)));
                    p.glow.alpha = (0.35 + 0.35 * Math.min(1, dark * 1.5)) * (0.85 + 0.15 * Math.sin(clock / 110 + p.phase));
                    p.glow.scale.set(k * (0.9 + 1.1 * Math.min(1, dark * 1.5)));
                }
                if (!free) {
                    for (const sm of c.smoke) {
                        sm.t = (sm.t + dtMs / 5200) % 1;
                        const at = o.ground(sm.u, sm.v);
                        sm.s.position.set(at.x + Math.sin(sm.t * 6 + sm.u) * 10 + sm.t * 30, at.y - 40 - sm.t * 170);
                        sm.s.scale.set(0.35 + sm.t * 0.9);
                        sm.s.alpha = Math.sin(sm.t * Math.PI);
                    }
                }
            }
        },
        destroy() {
            if (o.nightLayer) for (const l of lights) if (l.up) o.nightLayer.detach(l.s);
            for (const c of camps) for (const s of c.all) s.destroy();
            soft.destroy(true);
        },
    };
}
