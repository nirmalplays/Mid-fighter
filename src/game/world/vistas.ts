/**
 * The vistas: places composed by hand into the wild land, there to be looked at (and found, for a little
 * fanfare). Each kingdom has a waterfall canyon out in its far country: a horseshoe of cliffs six levels
 * high with falls pouring into a pool, a brook running out of it (in Pyraxis the falls are lava). Three
 * lands have a place of their own besides: Goldenvale, a farmstead of wheat and sunflowers under a
 * windmill (Aquatica); Wyrm's Rest, a hamlet sheltering in the curl of a sleeping dragon (Pyraxis); and the
 * Lantern Archive, an open-air library under drifting lanterns (the Void Wastes).
 *
 * layVistas() runs inside generateWorld() once the heightfield and the landmarks' ground are settled. It
 * shapes each site (its cliffs, pools, fields, the dragon's coils), eases the land around it so no ledge
 * is left that cannot be climbed, and says what stands there. The lands' own painting and scatter of
 * trees and rocks keep off the cells it owns. Pure data, like the rest of the map.
 *
 * Sites are in tiles from the continent's centre, in the open ground between the story's places (they
 * keep clear of every landmark and cave mouth). Within a site, (a, b) are tiles along u and v from its
 * centre; the viewer looks from +a +b, so the tall things stand toward -a -b.
 */
import { WORLD_TILES } from './constants.ts';
import { STYLE } from './biomes.ts';
import type { Element } from '../eidolon.ts';

export type VistaKind = 'cascade' | 'farm' | 'dragon' | 'archive';
export interface VistaSite {
    id: string;
    name: string;
    kind: VistaKind;
    el: Element;
    /** Centre cell, and the radius of the ground it shapes. */
    i: number;
    j: number;
    r: number;
}

/** How many levels the waterfall art drops (tools/iso_vista.py CLIFF). */
export const FALL_H = 6;

const C = WORLD_TILES / 2;
const site = (id: string, name: string, kind: VistaKind, el: Element, di: number, dj: number, r: number): VistaSite =>
    ({ id, name, kind, el, i: C + di, j: C + dj, r });

export const VISTAS: VistaSite[] = [
    site('veiled', 'The Veiled Cascades', 'cascade', 'air', -208, -20, 16),
    site('moonwell', 'Moonwell Falls', 'cascade', 'water', 252, 42, 16),
    site('emberfall', 'The Ember Cascade', 'cascade', 'fire', 252, -38, 16),
    site('starfall', 'Starfall Springs', 'cascade', 'earth', -240, 122, 16),
    site('goldenvale', 'Goldenvale', 'farm', 'water', 188, 16, 16),
    site('wyrmrest', "Wyrm's Rest", 'dragon', 'fire', 42, -208, 15),
    site('archive', 'The Lantern Archive', 'archive', 'earth', -168, 16, 13),
];

export interface VistaProp {
    name: string;
    i: number;
    j: number;
    /** Stands in the way (stops you near its middle). */
    solid: boolean;
    /** Footprint radius in tiles (keeps the land's own scatter off it). */
    r: number;
}

export interface VistaCtx {
    N: number;
    terrain: Uint8Array;
    height: Uint8Array;
    rand: () => number;
    /** Ground a vista must not touch: the landmarks' sites and the cave mouths. */
    reserved: (i: number, j: number) => boolean;
    T: { GRASS: number; DIRT: number; SAND: number; STONE: number; WATER: number };
    maxHeight: number;
}

export interface VistasLaid {
    /** 1 where a vista owns the cell: its style, its decor (the land's painting and scatter keep off). */
    own: Uint8Array;
    /** The style of each owned cell (world/biomes.ts). */
    paint: Map<number, number>;
    props: VistaProp[];
    flats: { name: string; i: number; j: number }[];
    /** Cells walled off by something bigger than one tile (a cottage, the dragon's head). */
    blocks: number[];
    /** Where a road may lead to each site (just outside it, at its front). */
    gates: number[];
}

export function layVistas(c: VistaCtx): VistasLaid {
    const { N, terrain, height, rand, T } = c;
    const W = WORLD_TILES;
    const at = (i: number, j: number) => j * N + i;
    const own = new Uint8Array(N * N);
    const paint = new Map<number, number>();
    const props: VistaProp[] = [];
    const flats: VistasLaid['flats'] = [];
    const blocks: number[] = [];
    const gates: number[] = [];
    const pick = <X,>(a: X[]): X => a[Math.floor(rand() * a.length)];

    for (const s of VISTAS) {
        /** Land cells this site sets the height of; the land around eases toward them. */
        const fixed = new Map<number, number>();
        /** Every cell it shaped (the land around them is eased afterwards). */
        const touched: number[] = [];
        const inLand = (i: number, j: number) => i >= 3 && j >= 3 && i < W - 3 && j < W - 3;
        const cell = (a: number, b: number) => at(s.i + a, s.j + b);
        const ok = (a: number, b: number) => inLand(s.i + a, s.j + b);
        /** Ground: its terrain, a style, and (if given) a height held fixed. */
        const ground = (a: number, b: number, t: number, st: number, h?: number) => {
            if (!ok(a, b)) return;
            const k = cell(a, b);
            own[k] = 1;
            touched.push(k);
            terrain[k] = t;
            paint.set(k, st);
            if (h !== undefined) {
                fixed.set(k, h);
                height[k] = h;
            }
        };
        const water = (a: number, b: number) => {
            if (!ok(a, b)) return;
            const k = cell(a, b);
            own[k] = 1;
            touched.push(k);
            terrain[k] = T.WATER;
            height[k] = 0;
            paint.delete(k);
            fixed.delete(k);
        };
        const isWater = (a: number, b: number) => ok(a, b) && terrain[cell(a, b)] === T.WATER;
        const prop = (name: string, a: number, b: number, solid = true, r = 0.6) => {
            if (ok(a, b)) props.push({ name, i: s.i + a, j: s.j + b, solid, r });
        };
        const flat = (name: string, a: number, b: number) => {
            if (ok(a, b)) flats.push({ name, i: s.i + a, j: s.j + b });
        };
        const block = (a: number, b: number) => {
            if (ok(a, b)) blocks.push(cell(a, b));
        };
        /** Every cell of the site's disc, nearest the centre first. */
        const disc = (r: number): [number, number][] => {
            const out: [number, number][] = [];
            for (let b = -Math.ceil(r); b <= Math.ceil(r); b++) for (let a = -Math.ceil(r); a <= Math.ceil(r); a++) if (Math.hypot(a, b) <= r) out.push([a, b]);
            return out.sort((p, q) => Math.hypot(...p) - Math.hypot(...q));
        };
        /** Claim the disc: its own ground (the lakes at its heart filled in, those at its rim kept). */
        const claim = (t: number, st: number) => {
            for (const [a, b] of disc(s.r)) {
                if (!ok(a, b)) continue;
                const k = cell(a, b);
                own[k] = 1;
                if (terrain[k] === T.WATER && Math.hypot(a, b) > s.r - 2) continue;
                terrain[k] = t;
                paint.set(k, st);
            }
        };
        /** Walk a line of cells from (a0, b0) to (a1, b1). */
        const line = (a0: number, b0: number, a1: number, b1: number, fn: (a: number, b: number) => void) => {
            const n = Math.max(Math.abs(a1 - a0), Math.abs(b1 - b0));
            for (let q = 0; q <= n; q++) fn(Math.round(a0 + ((a1 - a0) * q) / Math.max(1, n)), Math.round(b0 + ((b1 - b0) * q) / Math.max(1, n)));
        };
        /** Free ground for decor: owned, dry, not yet built on. */
        const taken = new Set<number>();
        const take = (a: number, b: number) => taken.add(cell(a, b));
        const freeAt = (a: number, b: number) => ok(a, b) && own[cell(a, b)] === 1 && !taken.has(cell(a, b)) && terrain[cell(a, b)] !== T.WATER;
        const put = (name: string, a: number, b: number, solid = true, r = 0.6) => {
            if (!freeAt(a, b)) return false;
            prop(name, a, b, solid, r);
            take(a, b);
            return true;
        };
        /** A scatter over the site: `n` tries at cells that pass `where`. */
        const sprinkle = (n: number, where: (a: number, b: number) => boolean, fn: (a: number, b: number) => void) => {
            for (const [a, b] of disc(s.r)) if (freeAt(a, b) && where(a, b) && rand() < n) fn(a, b);
        };
        const flowers = (density: number, where: (a: number, b: number) => boolean) =>
            sprinkle(density, where, (a, b) => flat(rand() < 0.7 ? `flower${1 + Math.floor(rand() * 12)}` : `clover${1 + Math.floor(rand() * 4)}`, a, b));

        if (s.kind === 'cascade') {
            const lava = s.el === 'fire';
            const theme = {
                air: { cliff: STYLE.MOSS_CLIFF, ground: T.GRASS, st: STYLE.MEADOW, trees: ['tree_pine', 'tree_pine', 'tree_cherry', 'tree_birch'], bush: ['dbush_pink', 'dbush_blue'], aqueduct: true, lanterns: 0 },
                water: { cliff: STYLE.MOSS_CLIFF, ground: T.GRASS, st: STYLE.MEADOW, trees: ['tree_cherry', 'tree_oak', 'tree_pine', 'tree_cherry'], bush: ['dbush_blue', 'dbush_pink'], aqueduct: true, lanterns: 0 },
                fire: { cliff: STYLE.BASALT, ground: T.DIRT, st: STYLE.SCORCH, trees: ['pine_scorched', 'pine_scorched', 'deadtree'], bush: [], aqueduct: false, lanterns: 0 },
                earth: { cliff: STYLE.MOSS_CLIFF, ground: T.GRASS, st: STYLE.MEADOW, trees: ['tree_fantasy', 'tree_fantasy_fall', 'tree_plum'], bush: ['dbush_pink', 'dbush_blue'], aqueduct: false, lanterns: 7 },
            }[s.el];
            claim(theme.ground, theme.st);
            // The pool: square at its back where the cliffs meet, rounded toward the viewer.
            const wob = rand() * 6.28;
            for (let b = -6; b <= 6; b++) {
                for (let a = -6; a <= 6; a++) {
                    const f = Math.hypot(Math.max(0, a - 1), Math.max(0, b - 1));
                    if (f <= 5.2 + 0.7 * Math.sin(Math.atan2(b, a) * 3 + wob)) water(a, b);
                }
            }
            // The cliffs: an L three cells thick behind the pool, FALL_H high, falling away toward its ends.
            const wallH = (along: number) => (along <= 3 ? FALL_H : Math.max(2, FALL_H - (along - 3)));
            for (let along = -9; along <= 7; along++) {
                for (let d = -9; d <= -7; d++) {
                    ground(d, along, T.STONE, theme.cliff, wallH(along));
                    ground(along, d, T.STONE, theme.cliff, wallH(along));
                }
            }
            // A sandy (or, in Pyraxis, ashen) shore round the pool.
            for (let b = -6; b <= 8; b++) {
                for (let a = -6; a <= 8; a++) {
                    if (isWater(a, b) || fixed.has(cell(a, b))) continue;
                    let wet = false;
                    for (let db = -1; db <= 1; db++) for (let da = -1; da <= 1; da++) if (isWater(a + da, b + db)) wet = true;
                    if (wet) ground(a, b, lava ? T.DIRT : T.SAND, lava ? STYLE.ASH : STYLE.BEACH, 0);
                }
            }
            // The falls: one wide and one narrow on each face (where the cliff stands its full height), each fed by
            // a brook across the clifftop and churning white where it lands.
            const shift = Math.floor(rand() * 2);
            const onI = [-5 + shift, -3 + shift, -2 + shift, -1 + shift, 1 + shift, 2 + shift]; // along b, on the face toward +i
            const onJ = [-5 + shift, -4 + shift, -1 + shift, 1 + shift, 2 + shift]; // along a, on the face toward +j
            const l = lava ? 'l' : '';
            for (const b of onI) {
                prop(`${l}fall_r_f1`, -7, b, true, 0.5);
                prop(`${l}foam_r_f1`, -6, b, false, 0.3);
                flat(`${l}rill_u`, -8, b);
                flat(`${l}rill_u`, -9, b);
            }
            for (const a of onJ) {
                prop(`${l}fall_l_f1`, a, -7, true, 0.5);
                prop(`${l}foam_l_f1`, a, -6, false, 0.3);
                flat(`${l}rill_v`, a, -8);
                flat(`${l}rill_v`, a, -9);
            }
            for (const b of onI) { take(-7, b); take(-8, b); take(-9, b); }
            for (const a of onJ) { take(a, -7); take(a, -8); take(a, -9); }
            // Boulders breaking the surface of the pool.
            for (const [a, b] of [[1, 2], [-2, 3], [3, -2]] as [number, number][]) if (isWater(a, b)) prop(`rock${1 + Math.floor(rand() * 5)}`, a, b, true, 0.6);
            // The brook out of the pool, winding off along u until it meets other water (or would meet a landmark).
            const phase = rand() * 6.28;
            for (let a = 6; a < 60; a++) {
                const b = Math.round(1.5 + 1.6 * Math.sin(a * 0.27 + phase));
                const i = s.i + a, j = s.j + b;
                if (!inLand(i, j + 1) || c.reserved(i, j) || c.reserved(i, j + 1)) break;
                const meets = a > 8 && !own[at(i, j)] && (terrain[at(i, j)] === T.WATER || terrain[at(i, j + 1)] === T.WATER);
                water(a, b);
                water(a, b + 1);
                if (meets) break;
            }
            // Its banks are sand (in Pyraxis ash), like every other shore.
            for (let a = 6; a < 62; a++) {
                for (let b = -4; b <= 7; b++) {
                    if (!ok(a, b) || isWater(a, b) || fixed.has(cell(a, b))) continue;
                    let wet = false;
                    for (let db = -1; db <= 1; db++) for (let da = -1; da <= 1; da++) if (own[cell(a + da, b + db)] && isWater(a + da, b + db)) wet = true;
                    if (wet) {
                        terrain[cell(a, b)] = lava ? T.DIRT : T.SAND;
                        if (own[cell(a, b)]) paint.set(cell(a, b), lava ? STYLE.ASH : STYLE.BEACH);
                    }
                }
            }
            // An old aqueduct striding across the brook in front of the falls.
            if (theme.aqueduct) {
                for (let b = -5; b <= 8; b++) if (ok(13, b)) { prop('arch_v', 13, b, true, 0.55); take(13, b); }
                put('pillar_broken', 13, -6, true, 0.6);
                put('pillar_broken', 13, 9, true, 0.6);
            }
            // Trees on the clifftop and round the sides (never in front of the falls), flowers and shrubs on the shore.
            sprinkle(0.5, (a, b) => (a <= -9 || b <= -9) && Math.hypot(a, b) > 10, (a, b) => put(pick(theme.trees), a, b, true, 1.2));
            sprinkle(0.18, (a, b) => Math.hypot(a, b) > 9 && Math.abs(a - b) > 9 && !fixed.has(cell(a, b)), (a, b) => put(pick(theme.trees), a, b, true, 1.2));
            if (theme.bush.length) {
                sprinkle(0.14, (a, b) => Math.hypot(a, b) > 7 && (a > 7 || b > 7), (a, b) => put(pick(theme.bush), a, b, false, 0.55));
                flowers(0.35, (a, b) => !fixed.has(cell(a, b)));
            } else {
                sprinkle(0.06, (a, b) => Math.hypot(a, b) > 8, (a, b) => put(`rock${1 + Math.floor(rand() * 5)}`, a, b, true, 0.7));
                sprinkle(0.08, () => true, (a, b) => flat('lavacrack', a, b));
            }
            for (let n = 0; n < theme.lanterns; n++) {
                const a = Math.round(-3 + rand() * 12), b = Math.round(-3 + rand() * 12);
                if (isWater(a, b) || freeAt(a, b)) prop(`float_lantern${1 + (n % 3)}`, a, b, false, 0.2);
            }
            gate(s, 13, 13);
        } else if (s.kind === 'farm') {
            claim(T.GRASS, STYLE.MEADOW);
            const h0 = 1;
            for (const [a, b] of disc(12)) ground(a, b, T.GRASS, STYLE.MEADOW, h0);
            // A knoll for the great oak.
            for (const [a, b] of disc(2.3)) ground(a - 8, b - 3, T.GRASS, STYLE.MEADOW, h0 + 1);
            put('great_oak', -8, -3, true, 1.8);
            put('camp_bench_u', -6, -1, true, 0.5);
            // Lanes of trodden earth: from the front up to the cottage door, a branch to the mill.
            const lane = (pts: [number, number][]) => {
                for (let n = 1; n < pts.length; n++) {
                    line(pts[n - 1][0], pts[n - 1][1], pts[n][0], pts[n][1], (a, b) => {
                        ground(a, b, T.DIRT, STYLE.NONE, h0);
                        if (rand() < 0.75) flat(`path${1 + Math.floor(rand() * 3)}`, a, b);
                        take(a, b);
                    });
                }
            };
            lane([[12, 12], [8, 8], [4, 4], [0, 0], [-2, -3], [-3, -5]]);
            lane([[0, 0], [3, -3], [5, -5]]);
            // The cottage (on its front cell, covering four) with its yard; the mill behind the wheat.
            for (const [a, b] of [[-3, -6], [-4, -6], [-3, -7], [-4, -7]] as [number, number][]) { take(a, b); block(a, b); }
            prop('cottage_a', -3, -6, false, 1.6);
            put('camp_well', 0, -5, true, 0.6);
            put('barrelish', -1, -7, true, 0.5);
            put('crate', -5, -5, true, 0.5);
            put('lamp_post', -1, -4, true, 0.3);
            put('windmill_f1', 5, -7, true, 1.1);
            for (const [a, b] of [[3, -7], [7, -6], [8, -8], [6, -9]] as [number, number][]) put('haybale', a, b, true, 0.6);
            // The fields: wheat in front of the mill, sunflowers below the oak, a patch of pumpkins by the lane.
            const field = (a0: number, a1: number, b0: number, b1: number, fn: (a: number, b: number) => void) => {
                for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) if (freeAt(a, b)) { ground(a, b, T.DIRT, STYLE.FIELD, h0); fn(a, b); }
            };
            const fenceAround = (a0: number, a1: number, b0: number, b1: number, gapA: number) => {
                for (let a = a0; a <= a1; a++) { if (a !== gapA) put('fence_u', a, b0 - 1, true, 0.45); put('fence_u', a, b1 + 1, true, 0.45); }
                for (let b = b0; b <= b1; b++) { put('fence_v', a0 - 1, b, true, 0.45); put('fence_v', a1 + 1, b, true, 0.45); }
            };
            field(2, 9, -3, 2, (a, b) => put('wheat', a, b, false, 0.45));
            fenceAround(2, 9, -3, 2, 6);
            field(-9, -4, 2, 6, (a, b) => put(rand() < 0.5 ? 'sunflower1' : 'sunflower2', a, b, false, 0.5));
            field(5, 8, 5, 8, (a, b) => { if ((a + b) % 2 === 0) put('pumpkin', a, b, false, 0.45); });
            // An aqueduct across the back of the vale, broken where the lane would cross it.
            for (let a = -10; a <= 8; a++) {
                if (a === 0 || a === 1) continue;
                ground(a, -12, T.GRASS, STYLE.MEADOW, h0);
                put('arch_u', a, -12, true, 0.55);
            }
            put('pillar_broken', -11, -12);
            put('pillar_broken', 9, -12);
            // Orchards down the sides, flowers everywhere, shrubs along the lanes.
            sprinkle(0.16, (a, b) => Math.hypot(a, b) > 10.5 && Math.abs(a - b) > 8, (a, b) => put(pick(['tree_apple', 'tree_pear', 'tree_apple_s3', 'tree_pear_s3', 'tree_cherry']), a, b, true, 1.1));
            sprinkle(0.05, (a, b) => Math.hypot(a, b) > 4, (a, b) => put(pick(['dbush_pink', 'dbush_orange', 'dbush_blue']), a, b, false, 0.55));
            flowers(0.4, () => true);
            gate(s, 13, 13);
        } else if (s.kind === 'dragon') {
            claim(T.DIRT, STYLE.SCORCH);
            const h0 = 1;
            // The hollow in its curl stays green: the sleeper's warmth.
            const RING = 7.6, IN = 5.6;
            for (const [a, b] of disc(IN)) ground(a, b, T.GRASS, STYLE.MEADOW, h0);
            // The coils: a ring of scaled hide round the hollow, open toward the viewer between its head and tail.
            const HEAD = 77, TAIL = 22; // degrees: the ring runs from the head round the back to the tail
            const deg = (a: number, b: number) => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
            for (const [a, b] of disc(RING + 2)) {
                const r = Math.hypot(a, b);
                if (r < IN) continue;
                const t = deg(a, b);
                if (t > TAIL && t < HEAD) continue;
                const d = Math.abs(r - RING);
                if (d > 2.05) continue;
                // Toward the tail the body thins and lies lower.
                const fromTail = (t - TAIL + 360) % 360;
                const taper = Math.min(1, (360 - fromTail) / 70);
                const full = d < 0.8 ? 3 : d < 1.4 ? 2 : 1;
                const h = h0 + Math.max(1, Math.round(full * (fromTail > 290 ? taper : 1)));
                ground(a, b, T.STONE, STYLE.SCALES, h);
                take(a, b);
            }
            // Its head on the ground by the gap, its tail's tip at the other side, a wing folded over its back.
            for (let b = 7; b <= 11; b++) for (let a = 0; a <= 4; a++) {
                ground(a, b, T.DIRT, STYLE.SCORCH, h0);
                take(a, b);
                if (Math.abs(a - 2) <= 1 && Math.abs(b - 9) <= 1) block(a, b);
            }
            prop('dragon_head', 2, 9, false, 2.4);
            ground(7, 2, T.DIRT, STYLE.SCORCH, h0);
            put('dragon_tail', 7, 2, true, 0.6);
            prop('dragon_wing', -5, -5, false, 1.5);
            // The hamlet: two cottages, a fire with benches, lamps, stores, flowers and a few young trees.
            for (const [a0, b0, name] of [[-1, -2, 'cottage_b'], [3, 0, 'cottage_c']] as [number, number, string][]) {
                for (const [da, db] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { take(a0 + da, b0 + db); block(a0 + da, b0 + db); }
                prop(name, a0, b0, false, 1.6);
            }
            put('camp_firepit', 0, 2, true, 0.6);
            put('camp_bench_u', 0, 3, true, 0.4);
            put('camp_bench_v', -1, 2, true, 0.4);
            put('lamp_post', -3, 1, true, 0.3);
            put('lamp_post', 3, 3, true, 0.3);
            put('camp_barrels', -4, 0, true, 0.5);
            put('camp_crates', 1, -4, true, 0.5);
            put('tree_cherry_s3', -4, 2, true, 0.9);
            line(6, 6, 1, 2, (a, b) => { if (freeAt(a, b)) flat(`path${1 + Math.floor(rand() * 3)}`, a, b); });
            sprinkle(0.1, (a, b) => Math.hypot(a, b) < 5.3, (a, b) => put(pick(['dbush_pink', 'dbush_orange']), a, b, false, 0.5));
            flowers(0.5, (a, b) => Math.hypot(a, b) < 5.5);
            // The ash around it: scorched pines keeping their distance (and out of the way of its face), embers in cracks.
            sprinkle(0.08, (a, b) => Math.hypot(a, b) > 10.5 && !(a > -2 && b > 4), (a, b) => put(pick(['pine_scorched', 'pine_scorched', 'deadtree']), a, b, true, 1.1));
            sprinkle(0.06, (a, b) => Math.hypot(a, b) > 10, (a, b) => flat('lavacrack', a, b));
            gate(s, 12, 12);
        } else {
            claim(T.GRASS, STYLE.MEADOW);
            const h0 = 1;
            // A paved court with a dais at its heart.
            for (const [a, b] of disc(8.6)) ground(a, b, T.STONE, STYLE.PLAZA, Math.hypot(a, b) <= 3.2 ? h0 + 1 : h0);
            // Shelves in a broken ring round the back of the court, pillars in its gaps.
            const deg = (a: number, b: number) => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
            let n = 0;
            for (const [a, b] of disc(8.4).filter(([a, b]) => Math.hypot(a, b) >= 7.3).sort((p, q) => deg(...p) - deg(...q))) {
                const t = deg(a, b);
                if (t < 100 || t > 350) continue;
                put(n++ % 5 === 4 ? 'pillar' : 'bookshelf', a, b, true, 0.55);
            }
            // The great window at the back.
            for (const [a, b] of [[-7, -7], [-6, -8], [-8, -6]] as [number, number][]) { ground(a, b, T.STONE, STYLE.PLAZA, h0); take(a, b); block(a, b); }
            prop('stained_arch', -7, -7, false, 1.5);
            // Reading tables on the dais and about the court, books piled everywhere, lamps at its front edge.
            for (const [a, b] of [[-1, 1], [1, -1], [-4, 2], [2, -4], [4, 3], [-3, -3]] as [number, number][]) put('reading_table', a, b, true, 0.5);
            sprinkle(0.12, (a, b) => Math.hypot(a, b) < 7, (a, b) => put(rand() < 0.5 ? 'books1' : 'books2', a, b, false, 0.4));
            sprinkle(0.05, (a, b) => Math.hypot(a, b) < 7, (a, b) => put('candle', a, b, false, 0.3));
            for (const [a, b] of [[7, 2], [2, 7], [6, 6], [8, -2], [-2, 8]] as [number, number][]) put('lamp_post', a, b, true, 0.3);
            // Lanterns drifting over it all.
            for (const [a, b] of disc(11)) if (rand() < 0.06) prop(`float_lantern${1 + Math.floor(rand() * 3)}`, a, b, false, 0.2);
            // A garden of the ruins round about.
            sprinkle(0.06, (a, b) => Math.hypot(a, b) > 9.5, (a, b) => put(pick(['ruinwall', 'pillar_broken', 'pillar']), a, b, true, 0.7));
            sprinkle(0.12, (a, b) => Math.hypot(a, b) > 9.5, (a, b) => put(pick(['tree_fantasy', 'tree_fantasy_fall', 'tree_plum_s3']), a, b, true, 1.1));
            flowers(0.45, (a, b) => Math.hypot(a, b) > 8.8);
            gate(s, 11, 11);
        }

        relax(c, fixed, touched);
    }

    /** The first dry, open cell from (a, b) outward: where a road comes in. */
    function gate(s: VistaSite, a: number, b: number) {
        for (let k = 0; k < 6; k++) {
            const i = s.i + a + k, j = s.j + b + k;
            if (i >= W - 3 || j >= W - 3) return;
            const n = at(i, j);
            if (terrain[n] !== T.WATER && !own[n]) { gates.push(n); return; }
        }
    }

    return { own, paint, props, flats, blocks, gates };
}

/**
 * Ease the land around a site so every step is at most one level (water aside): each free cell keeps its
 * height as far as it can while staying within a level a tile of every height the site set (and below
 * the water's, a level a tile, as every shore does). The bounds are 1-Lipschitz, so the result is too.
 */
function relax(c: VistaCtx, fixed: Map<number, number>, touched: number[]) {
    const { N, terrain, height, T } = c;
    // Far enough out that no bound can reach the edge of the box (heights only go to MAX_HEIGHT).
    const MARGIN = 12;
    let i0 = N, i1 = 0, j0 = N, j1 = 0;
    for (const k of touched) {
        const i = k % N, j = (k - i) / N;
        i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j);
    }
    i0 = Math.max(0, i0 - MARGIN); j0 = Math.max(0, j0 - MARGIN);
    i1 = Math.min(WORLD_TILES - 1, i1 + MARGIN); j1 = Math.min(WORLD_TILES - 1, j1 + MARGIN);
    const bw = i1 - i0 + 1, bh = j1 - j0 + 1;
    const lo = new Float32Array(bw * bh).fill(-99);
    const hi = new Float32Array(bw * bh).fill(99);
    const free = new Uint8Array(bw * bh);
    for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
            const k = j * N + i, q = (j - j0) * bw + (i - i0);
            if (terrain[k] === T.WATER) hi[q] = 0;
            else if (fixed.has(k) || c.reserved(i, j)) lo[q] = hi[q] = height[k];
            else free[q] = 1;
        }
    }
    for (let pass = 0, changed = true; changed && pass < 80; pass++) {
        changed = false;
        for (let dir = 0; dir < 2; dir++) {
            for (let n = 0; n < bw * bh; n++) {
                const q = dir === 0 ? n : bw * bh - 1 - n;
                if (!free[q]) continue;
                const x = q % bw, y = (q - x) / bw;
                let l = lo[q], h = hi[q];
                if (x > 0) { l = Math.max(l, lo[q - 1] - 1); h = Math.min(h, hi[q - 1] + 1); }
                if (x < bw - 1) { l = Math.max(l, lo[q + 1] - 1); h = Math.min(h, hi[q + 1] + 1); }
                if (y > 0) { l = Math.max(l, lo[q - bw] - 1); h = Math.min(h, hi[q - bw] + 1); }
                if (y < bh - 1) { l = Math.max(l, lo[q + bw] - 1); h = Math.min(h, hi[q + bw] + 1); }
                if (l !== lo[q] || h !== hi[q]) { lo[q] = l; hi[q] = h; changed = true; }
            }
        }
    }
    for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
            const q = (j - j0) * bw + (i - i0);
            if (!free[q]) continue;
            const k = j * N + i;
            const h = lo[q] > hi[q] ? hi[q] : Math.min(hi[q], Math.max(lo[q], height[k]));
            height[k] = Math.max(0, Math.min(c.maxHeight, Math.round(h)));
        }
    }
}
