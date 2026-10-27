/**
 * Deterministic isometric map (MAP_TILES square, 384 today): terrain per cell (grass, dirt, sand,
 * rocky ground, water) plus flat decals, standing props, treasure chests and the fixed
 * places of Eidolon (game/eidolon.ts): four kingdoms with their own look (Pyraxis rocky and
 * bare, Zephyria high, Aquatica full of lakes, Terragrim thick with forest), each with a camp,
 * guardians, a warden's arena, towers and houses, and the Void Citadel in the middle. Pure data — the
 * renderer in worldScene.ts turns it into sprites a chunk at a time.
 */
import { MAP_TILES, WORLD_TILES } from './constants.ts';
import { type BuildingId } from '../survival.ts';
import { layCamps } from './campLayout.ts';
import { ELEMENTS, LANDMARKS, regionOf, type Element } from '../eidolon.ts';
import { STYLE } from './biomes.ts';
import { charAt, entranceCell, PLACED, THEMES } from './interiors.ts';

export const GRASS = 0;
export const DIRT = 1;
export const SAND = 2;
export const STONE = 3;
export const WATER = 4;
/** Nothing: the dark between the interiors beyond the continent (never drawn, never walked). */
export const VOID = 5;

/** Ocean band around the map, in tiles (jittered). */
export const OCEAN = 6;

/** Highest elevation level (mountain peaks). */
export const MAX_HEIGHT = 8;

export interface Prop {
    /** Atlas frame name. */
    name: string;
    i: number;
    j: number;
}

export interface Flat {
    /** Atlas frame name, drawn flat on the tile. */
    name: string;
    i: number;
    j: number;
}

export interface WorldMap {
    terrain: Uint8Array;
    /** 0-2: which art variant of the terrain's cube. */
    variant: Uint8Array;
    /** 1 = not walkable. */
    blocked: Uint8Array;
    /** 1 = blocked by something standing there (a tree, a rock, a chest): it stops you only near its middle. */
    solid: Uint8Array;
    /** Terrace level per cell, 0..MAX_HEIGHT. Neighbouring cells within 1 level are walkable. */
    height: Uint8Array;
    /** 0-255 ground tone (smooth noise), used to vary the shading of the ground. */
    tone: Uint8Array;
    /** For water cells: tiles to the nearest shore (0 on land). Drives depth shading. */
    shoreDist: Uint8Array;
    flats: Flat[];
    props: Prop[];
    /** Treasure chests out in the wild (solid); the index is the chest's id. */
    chests: { i: number; j: number }[];
    /** Every kingdom's camp tents (solid). */
    camps: { el: Element; id: BuildingId; i: number; j: number }[];
    /** Region per cell: 0 the citadel, 1-4 a kingdom (ELEMENTS index + 1). An interior's cells are its land's. */
    region: Uint8Array;
    /** How a cell is drawn when it is not plain ground (world/biomes.ts STYLE; 0 = plain). */
    style: Uint8Array;
    /** Which interior a cell belongs to (its index in PLACED + 1; 0 = the overworld). */
    place: Uint8Array;
    /** The doors between the overworld and the interiors, and between a dig's floors. */
    doors: Door[];
    /** Cell -> index in doors, for the cells that take you somewhere when you step on them. */
    doorAt: Map<number, number>;
    /** Light sources (torches, lanterns, crystals, glowing mushrooms), in tiles. */
    lights: { i: number; j: number; color: number; r: number }[];
    /** Where foes wait in the interiors. */
    spawns: { n: number; i: number; j: number }[];
}

/** Stepping on `at` takes you to (u, v) facing `face` (a 0-7 sector), into `place` (0 = the overworld). */
export interface Door {
    at: number;
    u: number;
    v: number;
    face: number;
    place: number;
    name: string;
}

function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function generateWorld(seed = 1337): WorldMap {
    const rand = rng(seed);
    const N = MAP_TILES;
    /** The continent (the rest of the grid is the interiors' strip). */
    const W = WORLD_TILES;
    const SPAWN = W / 2;
    /** The layout was tuned on a 256 map: positions scale by S, counts by S². */
    const S = W / 256;
    const S2 = S * S;
    const at = (i: number, j: number) => j * N + i;
    const inMap = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N;
    const pick = <T,>(a: T[]): T => a[Math.floor(rand() * a.length)];
    const intIn = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

    const terrain = new Uint8Array(N * N);
    const variant = new Uint8Array(N * N);
    const blocked = new Uint8Array(N * N);
    const solidAt = new Uint8Array(N * N);
    const height = new Uint8Array(N * N);
    const tone = new Uint8Array(N * N);
    const shoreDist = new Uint8Array(N * N);
    const flats: Flat[] = [];
    const props: Prop[] = [];
    for (let k = 0; k < variant.length; k++) variant[k] = intIn(0, 2);

    const nearSpawn = (i: number, j: number, r: number) => Math.abs(i - SPAWN) <= r && Math.abs(j - SPAWN) <= r;

    // ---- The beach: a big flat sandy stretch along the south coast (high j), between two headlands.
    // beachAmt is 1 on the beach, 0 inland, and fades smoothly at its ends and inland edge.
    const smooth = (a: number, b: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    };
    const BEACH_SEA = 11; // extra tiles of open sea in front of the beach
    const BEACH_DEEP = 36; // how far inland the sand reaches from the waterline
    const beachSpan = (i: number) => smooth(52 * S, 80 * S, i) * (1 - smooth(186 * S, 214 * S, i));
    const beachAmt = (i: number, j: number): number => {
        const span = beachSpan(i);
        if (span <= 0) return 0;
        const fromEdge = W - 1 - j;
        const inner = OCEAN + BEACH_SEA + BEACH_DEEP + 4 * Math.sin(i * 0.09) + 3 * Math.sin(i * 0.23 + 1);
        return span * (1 - smooth(inner - 5, inner + 6, fromEdge));
    };

    // ---- Ocean: a jittered band of water around the edge, wider in front of the beach.
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            if (i >= W || j >= W) {
                terrain[at(i, j)] = VOID;
                continue;
            }
            const edge = Math.min(i, j, W - 1 - i, W - 1 - j);
            const sea = j > W / 2 ? BEACH_SEA * beachSpan(i) : 0;
            const depth = OCEAN + sea + 1.4 * Math.sin(i * 0.17 + j * 0.05) + 1.4 * Math.sin(j * 0.13 - i * 0.07);
            if (edge < depth) terrain[at(i, j)] = WATER;
        }
    }

    // Blob helper: an irregular ellipse of cells.
    const blob = (ci: number, cj: number, ri: number, rj: number, fn: (i: number, j: number) => void) => {
        const phase = rand() * 6.28;
        for (let j = Math.floor(cj - rj - 2); j <= Math.ceil(cj + rj + 2); j++) {
            for (let i = Math.floor(ci - ri - 2); i <= Math.ceil(ci + ri + 2); i++) {
                if (!inMap(i, j)) continue;
                const a = Math.atan2(j - cj, i - ci);
                const wob = 1 + 0.18 * Math.sin(a * 3 + phase) + 0.1 * Math.sin(a * 5 - phase);
                const d = ((i - ci) / ri) ** 2 + ((j - cj) / rj) ** 2;
                if (d <= wob * wob) fn(i, j);
            }
        }
    };
    const setTerrain = (t: number) => (i: number, j: number) => {
        if (terrain[at(i, j)] !== VOID && (terrain[at(i, j)] !== WATER || t === WATER)) terrain[at(i, j)] = t;
    };
    const farFrom = (ci: number, cj: number, r: number) =>
        Math.min(ci, cj, W - 1 - ci, W - 1 - cj) > OCEAN + r + 3 && !nearSpawn(ci, cj, r + 12) && beachAmt(ci, cj) < 0.02 && beachAmt(ci, cj + r + 6) < 0.02;

    // ---- Rocky ground and dirt patches (under the lakes so water wins).
    for (let n = 0, tries = 0; n < Math.round(9 * S2) && tries < 200 * S2; tries++) {
        const ci = intIn(20, W - 20), cj = intIn(20, W - 20), r = intIn(3, 6);
        if (!farFrom(ci, cj, r)) continue;
        blob(ci, cj, r, r * (0.6 + rand() * 0.5), setTerrain(STONE));
        n++;
    }
    for (let n = 0, tries = 0; n < Math.round(14 * S2) && tries < 200 * S2; tries++) {
        const ci = intIn(20, W - 20), cj = intIn(20, W - 20), r = intIn(3, 7);
        if (!farFrom(ci, cj, r)) continue;
        blob(ci, cj, r, r * (0.6 + rand() * 0.5), setTerrain(DIRT));
        n++;
    }

    // ---- Lakes.
    for (let n = 0, tries = 0; n < Math.round(14 * S2) && tries < 300 * S2; tries++) {
        const ci = intIn(20, W - 20), cj = intIn(20, W - 20), r = intIn(4, 9);
        if (!farFrom(ci, cj, r)) continue;
        blob(ci, cj, r, r * (0.55 + rand() * 0.5), setTerrain(WATER));
        n++;
    }

    // ---- Kingdom character: Aquatica gets many more lakes, Pyraxis bare rock.
    const inKingdom = (i: number, j: number, e: Element) => regionOf(i + 0.5, j + 0.5) === e;
    for (let n = 0, tries = 0; n < Math.round(7 * S2) && tries < 600 * S2; tries++) {
        const ci = intIn(20, W - 20), cj = intIn(20, W - 20), r = intIn(4, 10);
        if (!inKingdom(ci, cj, 'water') || !farFrom(ci, cj, r)) continue;
        blob(ci, cj, r, r * (0.55 + rand() * 0.5), setTerrain(WATER));
        n++;
    }
    for (let n = 0, tries = 0; n < Math.round(6 * S2) && tries < 600 * S2; tries++) {
        const ci = intIn(20, W - 20), cj = intIn(20, W - 20), r = intIn(4, 9);
        if (!inKingdom(ci, cj, 'fire') || !farFrom(ci, cj, r)) continue;
        blob(ci, cj, r, r * (0.6 + rand() * 0.5), setTerrain(n % 3 === 0 ? DIRT : STONE));
        n++;
    }

    // ---- Rivers: two wandering channels with grass fords every so often.
    const river = (vertical: boolean, c0: number, amp: number, phase: number, fords: number[]) => {
        for (let t = OCEAN; t < W - OCEAN; t++) {
            if (fords.some((f) => Math.abs(t - f) <= 2)) continue;
            const c = c0 + amp * Math.sin(t * 0.06 + phase) + amp * 0.4 * Math.sin(t * 0.17);
            for (let w = -1; w <= 1; w++) {
                const k = Math.round(c) + w;
                const i = vertical ? k : t, j = vertical ? t : k;
                if (inMap(i, j) && !nearSpawn(i, j, 10)) terrain[at(i, j)] = WATER;
            }
        }
    };
    river(true, 70 * S, 12 * S, 0.4, [60, 120, 190, 250, 320].map((f) => f * S * 0.75));
    river(false, 196 * S, 10 * S, 2.1, [90, 160, 215, 290, 350].map((f) => f * S * 0.75));

    // ---- Every landmark stands on dry land.
    for (const L of LANDMARKS) {
        for (let j = L.j - L.r - 2; j <= L.j + L.r + 2; j++) {
            for (let i = L.i - L.r - 2; i <= L.i + L.r + 2; i++) {
                if (inMap(i, j) && Math.hypot(i - L.i, j - L.j) <= L.r + 2 && terrain[at(i, j)] === WATER) terrain[at(i, j)] = GRASS;
            }
        }
    }

    // ---- Sand shore around all water.
    const shore: number[] = [];
    for (let j = 1; j < N - 1; j++) {
        for (let i = 1; i < N - 1; i++) {
            if (terrain[at(i, j)] === WATER || terrain[at(i, j)] === VOID) continue;
            let w = false;
            for (let dj = -1; dj <= 1 && !w; dj++) for (let di = -1; di <= 1; di++) if (terrain[at(i + di, j + dj)] === WATER) { w = true; break; }
            if (w) shore.push(at(i, j));
        }
    }
    for (const k of shore) terrain[k] = SAND;

    // ---- Elevation: a map-wide heightfield. Rolling hills and valleys everywhere,
    // mountain ranges toward the edges, flat only around the spawn.
    const sstep = (a: number, b: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    };
    const lattice = (ix: number, iy: number, salt: number) => {
        let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(salt, 2147483647) ^ seed;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const vnoise = (x: number, y: number, salt: number) => {
        const ix = Math.floor(x), iy = Math.floor(y);
        const fx = x - ix, fy = y - iy;
        const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
        const a = lattice(ix, iy, salt), b = lattice(ix + 1, iy, salt);
        const c = lattice(ix, iy + 1, salt), d = lattice(ix + 1, iy + 1, salt);
        return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    };
    const fbm = (x: number, y: number, octaves: number, salt: number) => {
        let sum = 0, amp = 1, norm = 0, f = 1;
        for (let o = 0; o < octaves; o++) {
            sum += amp * vnoise(x * f, y * f, salt + o);
            norm += amp;
            amp *= 0.5;
            f *= 2.07;
        }
        return sum / norm;
    };
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const e = fbm(i * 0.013, j * 0.013, 4, 10);
            const ridge = 1 - Math.abs(2 * fbm(i * 0.022 + 40, j * 0.022 + 17, 3, 30) - 1);
            const detail = fbm(i * 0.07, j * 0.07, 2, 50);
            if (i >= W || j >= W) continue;
            const edge = Math.min(i, j, W - 1 - i, W - 1 - j);
            const range = sstep(0, 1, (78 - edge) / 60);
            const raw = 8 * (0.9 * e + 0.32 * ridge + 0.6 * range * (0.55 + 0.9 * e)) - 3.1 + 2.2 * detail + (regionOf(i + 0.5, j + 0.5) === 'air' ? 2.4 : 0);
            // Soft-cap the peaks so ranges keep their shape instead of clipping flat at the top.
            const level = raw > 4.5 ? 4.5 + (raw - 4.5) * 0.62 : raw;
            const hillness = sstep(5, 22, Math.hypot(i - SPAWN, j - SPAWN));
            const k = at(i, j);
            const beach = beachAmt(i, j);
            height[k] = Math.max(0, Math.min(MAX_HEIGHT, Math.floor(level * hillness * (1 - beach) + 0.5)));
            // Low dunes: a few ridges one level high on the middle of the beach.
            if (beach > 0.85 && fbm(i * 0.11 + 7, j * 0.16 + 3, 2, 60) > 0.74) height[k] = Math.max(height[k], 1);
            if (terrain[k] === WATER) height[k] = 0;
        }
    }
    // Shores and valleys: ground near water descends toward it, one level per ~1.5 tiles.
    const dist = new Int16Array(N * N).fill(-1);
    const queue: number[] = [];
    for (let k = 0; k < terrain.length; k++) if (terrain[k] === WATER) { dist[k] = 0; queue.push(k); }
    for (let q = 0; q < queue.length; q++) {
        const k = queue[q];
        const i = k % N, j = (k - i) / N;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ni = i + di, nj = j + dj;
            if (!inMap(ni, nj) || dist[at(ni, nj)] >= 0) continue;
            dist[at(ni, nj)] = dist[k] + 1;
            queue.push(at(ni, nj));
        }
    }
    for (let k = 0; k < height.length; k++) height[k] = Math.min(height[k], Math.floor(dist[k] / 1.5));
    // Trim ledges taller than one level, but leave ~8% as crags that block the way.
    for (let pass = 0; pass < 6; pass++) {
        for (let j = 1; j < N - 1; j++) {
            for (let i = 1; i < N - 1; i++) {
                const k = at(i, j);
                // (no crags left standing: a ledge you cannot climb reads as an invisible wall)
                if (terrain[k] === WATER) continue;
                const low = Math.min(height[k - 1], height[k + 1], height[k - N], height[k + N]);
                if (height[k] > low + 1) height[k] = low + 1;
            }
        }
    }
    // High ground is rock (with some grass pockets); the rest keeps its ground.
    for (let k = 0; k < terrain.length; k++) {
        const t = terrain[k];
        if (t !== GRASS && t !== DIRT) continue;
        const i = k % N, j = (k - i) / N;
        if (height[k] >= 6 || (height[k] >= 5 && vnoise(i * 0.25, j * 0.25, 70) > 0.6)) terrain[k] = STONE;
    }

    // The beach itself is sand (grass pokes through at its ragged inland edge).
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const k = at(i, j);
            if (terrain[k] === WATER || terrain[k] === VOID) continue;
            const amt = beachAmt(i, j);
            if (amt > 0.5 + 0.25 * (vnoise(i * 0.35, j * 0.35, 80) - 0.5)) terrain[k] = SAND;
        }
    }

    // Landmark sites are flat, ringed by a gentle ramp so they can be walked onto from every side.
    for (const L of LANDMARKS) {
        const h0 = L.kind === 'citadel' ? 0 : Math.min(4, height[at(L.i, L.j)]);
        const ground = L.kind === 'citadel' || L.kind === 'arena' ? STONE : L.el === 'fire' ? DIRT : GRASS;
        const R = L.r + 9;
        for (let j = L.j - R; j <= L.j + R; j++) {
            for (let i = L.i - R; i <= L.i + R; i++) {
                if (!inMap(i, j)) continue;
                const k = at(i, j);
                const d = Math.hypot(i - L.i, j - L.j);
                if (d <= L.r + 0.5) {
                    height[k] = h0;
                    terrain[k] = ground;
                } else if (d <= R && terrain[k] !== WATER) {
                    const slack = Math.floor(d - L.r);
                    height[k] = Math.min(h0 + slack, Math.max(h0 - slack, height[k]));
                }
            }
        }
    }

    // The doors into the caves and ruins stand on a little flat apron (on dry land).
    const doorways = PLACED.map((p) => ({ p, at: entranceCell(p.def) })).filter((d): d is { p: (typeof PLACED)[number]; at: { i: number; j: number } } => !!d.at);
    for (const { at: e } of doorways) {
        const h0 = Math.min(4, height[at(e.i, e.j)]);
        for (let j = e.j - 6; j <= e.j + 6; j++) {
            for (let i = e.i - 6; i <= e.i + 6; i++) {
                if (!inMap(i, j)) continue;
                const k = at(i, j);
                const d = Math.hypot(i - e.i, j - e.j);
                if (d <= 3.5) {
                    height[k] = h0;
                    if (terrain[k] === WATER) terrain[k] = DIRT;
                } else if (terrain[k] !== WATER) {
                    const slack = Math.floor(d - 3);
                    height[k] = Math.min(h0 + slack, Math.max(h0 - slack, height[k]));
                }
            }
        }
    }

    // ---- The lands' own ground. Pyraxis: scorched earth, ash flats, ochre badlands, obsidian heights.
    // Zephyria: wind-meadows under white cliffs. Aquatica: wide beaches, coral sand. The Void Wastes:
    // salt flats and crystal-shot rock.
    const style = new Uint8Array(N * N);
    for (let j = 0; j < W; j++) {
        for (let i = 0; i < W; i++) {
            const k = at(i, j);
            const t = terrain[k];
            if (t === WATER || t === VOID) continue;
            const land = regionOf(i + 0.5, j + 0.5);
            const n = fbm(i * 0.018, j * 0.018, 3, 400);
            const m = vnoise(i * 0.09, j * 0.09, 410);
            if (land === 'fire') {
                if (t === STONE) style[k] = STYLE.OBSIDIAN;
                else if (t === SAND || n < 0.42) { style[k] = STYLE.ASH; if (t !== SAND) terrain[k] = DIRT; }
                else if (n > 0.6) { style[k] = STYLE.BADLANDS; terrain[k] = DIRT; }
                else { style[k] = STYLE.SCORCH; terrain[k] = DIRT; }
            } else if (land === 'air') {
                // Wind-meadows climb the hills; only the true heights are bare white cliff.
                if (t === STONE && height[k] < 7) terrain[k] = GRASS;
                style[k] = terrain[k] === STONE ? STYLE.CLIFF : terrain[k] === GRASS ? STYLE.MEADOW : 0;
            } else if (land === 'water') {
                // Beaches: the low ground by the water is sand.
                if (t !== SAND && t !== STONE && dist[k] <= 3 && height[k] <= 1) terrain[k] = SAND;
                if (terrain[k] === SAND) style[k] = m > 0.66 ? STYLE.CORAL : STYLE.BEACH;
            } else if (land === 'earth') {
                if (t === STONE) style[k] = STYLE.CRYSTAL;
                else if (n < 0.45) { style[k] = STYLE.SALT; terrain[k] = DIRT; }
            }
        }
    }
    const styleAt = (i: number, j: number) => style[at(i, j)];
    const ARID = new Set<number>([STYLE.ASH, STYLE.BADLANDS, STYLE.SCORCH, STYLE.SALT, STYLE.BEACH, STYLE.CORAL]);

    for (let k = 0; k < terrain.length; k++) if (terrain[k] === WATER || terrain[k] === VOID) blocked[k] = 1;

    // Ground tone: broad light/dark patches plus fine speckle.
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            tone[at(i, j)] = Math.round(255 * (0.65 * fbm(i * 0.05, j * 0.05, 3, 200) + 0.35 * vnoise(i * 0.45, j * 0.45, 210)));
        }
    }
    // Distance from each water cell to the nearest shore, for depth shading.
    const wq: number[] = [];
    for (let k = 0; k < terrain.length; k++) {
        if (terrain[k] === WATER) shoreDist[k] = 255;
        else wq.push(k);
    }
    for (let q = 0; q < wq.length; q++) {
        const k = wq[q];
        const i = k % N, j = (k - i) / N;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ni = i + di, nj = j + dj;
            if (!inMap(ni, nj) || shoreDist[at(ni, nj)] !== 255) continue;
            shoreDist[at(ni, nj)] = Math.min(254, shoreDist[k] + 1);
            wq.push(at(ni, nj));
        }
    }

    // ---- Roads: winding stone paths from spawn out to a handful of waypoints.
    const road = new Set<number>();
    const passable = (i: number, j: number) => i < W && j < W && inMap(i, j) && terrain[at(i, j)] !== WATER;
    const findPath = (from: number, to: number): number[] | null => {
        const g = new Float32Array(N * N).fill(Infinity);
        const prev = new Int32Array(N * N).fill(-1);
        const heap: [number, number][] = [[0, from]];
        g[from] = 0;
        const ti = to % N, tj = (to - ti) / N;
        const push = (item: [number, number]) => {
            heap.push(item);
            let c = heap.length - 1;
            while (c > 0) {
                const par = (c - 1) >> 1;
                if (heap[par][0] <= heap[c][0]) break;
                [heap[par], heap[c]] = [heap[c], heap[par]];
                c = par;
            }
        };
        const pop = (): [number, number] => {
            const top = heap[0];
            const last = heap.pop()!;
            if (heap.length) {
                heap[0] = last;
                let c = 0;
                for (;;) {
                    const l = 2 * c + 1, r = l + 1;
                    let m = c;
                    if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                    if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                    if (m === c) break;
                    [heap[m], heap[c]] = [heap[c], heap[m]];
                    c = m;
                }
            }
            return top;
        };
        while (heap.length) {
            const [, k] = pop();
            if (k === to) break;
            const i = k % N, j = (k - i) / N;
            for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                const ni = i + di, nj = j + dj;
                if (!passable(ni, nj)) continue;
                // A diagonal step needs both side cells open, so roads never clip water corners.
                const diag = di !== 0 && dj !== 0;
                if (diag && (!passable(i + di, j) || !passable(i, j + dj))) continue;
                const nk = at(ni, nj);
                const dh = Math.abs(height[nk] - height[k]);
                if (dh > 1) continue;
                const wander = 3 * vnoise(ni * 0.3, nj * 0.3, 120);
                const cost = g[k] + (diag ? 1.41 : 1) + 2.5 * dh + wander + (height[nk] >= 6 ? 4 : 0) + (terrain[nk] === SAND ? 1.5 : 0);
                if (cost < g[nk]) {
                    g[nk] = cost;
                    prev[nk] = k;
                    const dx = Math.abs(ni - ti), dy = Math.abs(nj - tj);
                    push([cost + Math.max(dx, dy) + 0.41 * Math.min(dx, dy), nk]);
                }
            }
        }
        if (prev[to] < 0 && to !== from) return null;
        const path: number[] = [];
        for (let k = to; k !== -1; k = prev[k]) path.push(k);
        return path.reverse();
    };
    const landNear = (ci: number, cj: number): number | null => {
        for (let r = 0; r < 12; r++) {
            for (let dj = -r; dj <= r; dj++) {
                for (let di = -r; di <= r; di++) {
                    const i = ci + di, j = cj + dj;
                    if (inMap(i, j) && terrain[at(i, j)] !== WATER && terrain[at(i, j)] !== SAND && height[at(i, j)] <= 4) return at(i, j);
                }
            }
        }
        return null;
    };
    const waypoints: number[] = [];
    const spawnCell = at(SPAWN, SPAWN);
    const a0 = rand() * 6.28;
    const WAYS = 0; // roads lead to the landmarks below instead
    for (let n = 0; n < WAYS; n++) {
        const ang = a0 + (n / WAYS) * 6.28 + (rand() - 0.5) * 0.9;
        const d = intIn(Math.round(38 * S), Math.round(108 * S));
        const k = landNear(
            Math.min(W - OCEAN - 14, Math.max(OCEAN + 14, Math.round(SPAWN + Math.cos(ang) * d))),
            Math.min(W - OCEAN - 14, Math.max(OCEAN + 14, Math.round(SPAWN + Math.sin(ang) * d))),
        );
        if (k !== null) waypoints.push(k);
    }
    // One waypoint on the beach itself, so a road leads down to it.
    for (let dj = 0; dj < 30; dj++) {
        const bj = W - 1 - (OCEAN + BEACH_SEA + 20) - dj, bi = Math.round(130 * S);
        if (inMap(bi, bj) && terrain[at(bi, bj)] === SAND && height[at(bi, bj)] === 0) { waypoints.push(at(bi, bj)); break; }
    }
    // A road to every landmark (to the edge of its flat ground).
    for (const L of LANDMARKS) if (L.kind !== 'citadel') waypoints.push(at(L.i, Math.min(N - 1, L.j + L.r)));

    const nodes = [spawnCell, ...waypoints];
    const linked = new Set<number>([0]);
    // Connect each node to its nearest already-linked node (a spanning tree), plus two cross-links.
    const gridDist = (a: number, b: number) => Math.hypot((a % N) - (b % N), Math.floor(a / N) - Math.floor(b / N));
    const links: [number, number][] = [];
    while (linked.size < nodes.length) {
        let best: [number, number] | null = null;
        let bd = Infinity;
        for (let u = 0; u < nodes.length; u++) {
            if (linked.has(u)) continue;
            for (const v of linked) {
                const d = gridDist(nodes[u], nodes[v]);
                if (d < bd) { bd = d; best = [u, v]; }
            }
        }
        if (!best) break;
        links.push(best);
        linked.add(best[0]);
    }
    for (let n = 0; n < 2 && nodes.length > 3; n++) links.push([intIn(1, nodes.length - 1), intIn(1, nodes.length - 1)]);
    for (const [u, v] of links) {
        if (u === v) continue;
        const path = findPath(nodes[u], nodes[v]);
        if (!path) continue;
        for (let n = 0; n < path.length; n++) {
            const k = path[n];
            road.add(k);
            // Fill the corner of diagonal steps so the road stays connected.
            if (n > 0) {
                const pi = path[n - 1] % N, pj = Math.floor(path[n - 1] / N);
                if (pi !== k % N && pj !== Math.floor(k / N)) road.add(at(k % N, pj));
            }
            // Sometimes a road is two tiles wide.
            if (rand() < 0.22) {
                const i = k % N, j = (k - i) / N;
                const [di, dj] = rand() < 0.5 ? [1, 0] : [0, 1];
                if (passable(i + di, j + dj) && Math.abs(height[at(i + di, j + dj)] - height[k]) <= 1) road.add(at(i + di, j + dj));
            }
        }
    }
    // A dirt bed with stones set in it.
    for (const k of road) {
        if (terrain[k] !== SAND) terrain[k] = DIRT;
        if (rand() < 0.7) flats.push({ name: `path${intIn(1, 3)}`, i: k % N, j: Math.floor(k / N) });
    }

    // ---- Flat decor on grass: flowers, clovers; pebbles on rocky ground.
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const k = at(i, j);
            if (road.has(k)) continue;
            const t = terrain[k];
            const r = rand();
            if (t === GRASS) {
                // Meadows: flowers and clovers gather where the tone is light.
                const meadow = vnoise(i * 0.09, j * 0.09, 230);
                if (r < 0.04 + 0.16 * meadow * meadow) flats.push({ name: `flower${intIn(1, 12)}`, i, j });
                else if (r < 0.1 + 0.2 * meadow) flats.push({ name: `clover${intIn(1, 4)}`, i, j });
            } else if (t === STONE && r < 0.12) flats.push({ name: 'pebbles', i, j });
        }
    }

    // ---- Props: bushes, boulders, tall grass.
    const occupied = new Set<number>(road);
    // Landmark ground stays clear of plants.
    for (const L of LANDMARKS) {
        for (let j = L.j - L.r - 1; j <= L.j + L.r + 1; j++) {
            for (let i = L.i - L.r - 1; i <= L.i + L.r + 1; i++) if (inMap(i, j) && Math.hypot(i - L.i, j - L.j) <= L.r + 1) occupied.add(at(i, j));
        }
        // What stands there is solid: the arena seal, the citadel gate and towers (one tile). Houses can be walked into.
        if (L.kind === 'arena' || L.kind === 'citadel' || L.kind === 'tower') blocked[at(L.i, L.j)] = 1;
    }
    // ---- CAMP TEAM: every kingdom's walled war camp (world/campLayout.ts): its trodden paths, the palisade, towers,
    // barricades and tents that block. All of a camp's own ground and blocking is laid here, in this one call.
    const camps = layCamps({ N, terrain, style, blocked, solid: solidAt, flats, occupied, dirt: DIRT });
    // ---- end CAMP TEAM
    const nearLandmark = (i: number, j: number, pad: number) => LANDMARKS.some((L) => Math.hypot(i - L.i, j - L.j) <= L.r + pad);
    for (const { at: e } of doorways) for (let j = e.j - 3; j <= e.j + 3; j++) for (let i = e.i - 3; i <= e.i + 3; i++) if (inMap(i, j)) occupied.add(at(i, j));

    // Every standing thing has a footprint (a radius in tiles). Nothing is set down inside another's, so a bush
    // never grows out of a tree trunk and the art never piles up into an unreadable heap.
    const BUCKET = 4;
    const BUCKETS = Math.ceil(N / BUCKET);
    const foot = new Map<number, { i: number; j: number; r: number }[]>();
    const roomFor = (i: number, j: number, r: number, tight = 1): boolean => {
        const bi = Math.floor(i / BUCKET), bj = Math.floor(j / BUCKET);
        for (let y = bj - 1; y <= bj + 1; y++) {
            for (let x = bi - 1; x <= bi + 1; x++) {
                for (const o of foot.get(y * BUCKETS + x) ?? []) if (Math.hypot(o.i - i, o.j - j) < (o.r + r) * tight) return false;
            }
        }
        return true;
    };
    /** Claim ground of radius r at (i, j). */
    const reserve = (i: number, j: number, r: number) => {
        occupied.add(at(i, j));
        const b = Math.floor(j / BUCKET) * BUCKETS + Math.floor(i / BUCKET);
        let list = foot.get(b);
        if (!list) foot.set(b, (list = []));
        list.push({ i, j, r });
    };
    const place = (name: string, i: number, j: number, solid: boolean, r = 0.6) => {
        props.push({ name, i, j });
        reserve(i, j, r);
        if (solid) {
            blocked[at(i, j)] = 1;
            solidAt[at(i, j)] = 1;
        }
    };
    const free = (i: number, j: number, gap: number): boolean => {
        if (!inMap(i, j) || terrain[at(i, j)] === WATER || nearSpawn(i, j, 6)) return false;
        for (let dj = -gap; dj <= gap; dj++) for (let di = -gap; di <= gap; di++) if (occupied.has(at(i + di, j + dj))) return false;
        return true;
    };
    // Roads keep a verge: nothing tall within a tile of the stones.
    const verge = new Set<number>();
    for (const k of road) {
        const i = k % N, j = (k - i) / N;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (inMap(i + di, j + dj)) verge.add(at(i + di, j + dj));
    }
    /** Can something of radius r stand on (i, j)? `tall` things also keep off the road's verge. */
    const canStand = (i: number, j: number, r: number, tall: boolean, tight = 1) =>
        free(i, j, 0) && !(tall && verge.has(at(i, j))) && roomFor(i, j, r, tight);
    /** Dart-throwing in a shuffled order over the continent, so placement has no row-by-row bias. */
    const cells = new Int32Array(W * W);
    for (let k = 0; k < cells.length; k++) cells[k] = k;
    for (let k = cells.length - 1; k > 0; k--) {
        const r = Math.floor(rand() * (k + 1));
        const t = cells[k];
        cells[k] = cells[r];
        cells[r] = t;
    }
    const eachCell = (fn: (i: number, j: number) => void) => {
        for (let n = 0; n < cells.length; n++) fn(cells[n] % W, Math.floor(cells[n] / W));
    };
    // Kept for the few places that still want a simple scatter (the beach).
    const scatter = (
        count: number, r: number, fn: (i: number, j: number) => void, onTerrain: number[],
        maxH = MAX_HEIGHT, salt = 0, bias = 0.5,
    ) => {
        for (let n = 0, tries = 0; n < count && tries < count * 14; tries++) {
            const i = intIn(3, W - 4), j = intIn(3, W - 4);
            if (!onTerrain.includes(terrain[at(i, j)]) || height[at(i, j)] > maxH) continue;
            if (salt && vnoise(i * 0.07, j * 0.07, salt) < bias - 0.25 * rand()) continue;
            if (!canStand(i, j, r, true)) continue;
            fn(i, j);
            n++;
        }
    };
    const bushes = ['gbush1', 'gbush2', 'gbush3', 'gbush1', 'gbush2', 'gbush3', 'bbush1', 'bbush2', 'bbush3', 'bbush1b', 'bbush2b', 'bbush3b', 'bbush1w', 'bbush2w', 'bbush3w'];
    // Treasure chests, spread out over the land (never near the camp).
    const chests: { i: number; j: number }[] = [];
    for (let tries = 0; chests.length < Math.round(22 * S2) && tries < 4000; tries++) {
        const i = intIn(OCEAN + 6, W - OCEAN - 7), j = intIn(OCEAN + 6, W - OCEAN - 7);
        const k = at(i, j);
        if (terrain[k] === WATER || terrain[k] === SAND || nearSpawn(i, j, 16) || nearLandmark(i, j, 5) || !free(i, j, 2)) continue;
        if (chests.some((c) => Math.hypot(c.i - i, c.j - j) < 14)) continue;
        chests.push({ i, j });
        reserve(i, j, 1.2);
        blocked[k] = 1;
        solidAt[k] = 1;
    }
    const rock = () => `rock${intIn(1, 5)}`;

    // ---- The lie of the land: woods, woodland edges and open meadows, from a broad noise field, so the
    // land reads as places (a forest, a clearing, a meadow) instead of an even sprinkle.
    const woodAt = (i: number, j: number) => fbm(i * 0.017, j * 0.017, 3, 300) + 0.12 * (vnoise(i * 0.09, j * 0.09, 305) - 0.5);
    const CORE = 0.57, EDGE = 0.5;
    // Groves: patches of one kind of tree with wobbly borders (a jittered cell grid), a few in their autumn coats.
    const grove = (i: number, j: number) => {
        const gi = Math.floor((i + 7 * (vnoise(i * 0.05, j * 0.05, 620) - 0.5) * 2) / 18);
        const gj = Math.floor((j + 7 * (vnoise(i * 0.05, j * 0.05, 630) - 0.5) * 2) / 18);
        return lattice(gi, gj, 640);
    };
    const LAND_TREES: Record<string, string[]> = {
        air: ['birch', 'birch', 'cherry', 'ginkgo', 'oak', 'pear'],
        water: ['oak', 'pear', 'apple', 'ginkgo', 'birch', 'plum'],
        earth: ['fantasy_fall', 'fantasy', 'plum_fall', 'ginkgo_fall', 'fantasy', 'fantasy_fall'],
        fire: ['oak_fall', 'birch_fall', 'apple_fall', 'oak', 'ginkgo_fall'],
        citadel: ['fantasy', 'plum', 'cherry', 'oak'],
    };
    const FALLS = new Set(['oak', 'birch', 'apple', 'cherry', 'ginkgo', 'fantasy', 'pear', 'plum']);
    /** The tree for a grove: mostly its own kind, now and then a neighbour's; young ones toward the edge. */
    const treeFor = (i: number, j: number, w: number): { name: string; r: number } => {
        const land = regionOf(i + 0.5, j + 0.5);
        const h = height[at(i, j)];
        const g = grove(i, j);
        const kinds = LAND_TREES[land];
        let kind = rand() < 0.8 ? kinds[Math.floor(g * kinds.length)] : pick(kinds);
        // Hills grow pine; Zephyria's heights are under snow.
        if (h >= 2 && rand() < (h >= 5 ? 0.75 : h >= 3 ? 0.4 : 0.15)) kind = 'pine';
        if (land === 'air' && h >= 6) kind = rand() < 0.7 ? 'pine_snow' : pick(['birch_snow', 'oak_snow']);
        // A few groves of the green lands have turned.
        else if ((land === 'air' || land === 'water') && g > 0.88 && FALLS.has(kind)) kind = `${kind}_fall`;
        const core = w > CORE;
        const age = rand();
        const snowy = kind.endsWith('_snow');
        const base = kind.replace(/_(fall|snow)$/, '');
        if (!snowy && (core ? age < 0.12 : age < 0.3)) return { name: `tree_${base}_s3`, r: 1.05 };
        if (!snowy && !core && age < 0.42) return { name: `tree_${base}_s2`, r: 0.75 };
        return { name: `tree_${kind}`, r: 1.45 };
    };

    // Trees: thick in the woods' cores (crowns touching), thinning through the edge, lone ones in the meadows.
    eachCell((i, j) => {
        const k = at(i, j);
        const t = terrain[k];
        if ((t !== GRASS && t !== DIRT) || ARID.has(style[k]) || style[k] === STYLE.OBSIDIAN) return;
        const w = woodAt(i, j);
        const chance = w > CORE ? 0.5 : w > EDGE ? 0.12 : 0.008;
        if (rand() >= chance) return;
        const tr = treeFor(i, j, w);
        // Woods pack tighter than open ground, where a lone tree wants room around it.
        if (!canStand(i, j, tr.r, true, w > CORE ? 0.78 : w > EDGE ? 0.95 : 2.2)) return;
        place(tr.name, i, j, true, tr.r);
    });
    // Bamboo stands along Zephyria's and Aquatica's lakes.
    eachCell((i, j) => {
        const k = at(i, j);
        if (terrain[k] !== GRASS || dist[k] < 2 || dist[k] > 4) return;
        const land = regionOf(i + 0.5, j + 0.5);
        if ((land !== 'air' && land !== 'water') || vnoise(i * 0.06, j * 0.06, 650) < 0.6 || rand() > 0.35) return;
        if (canStand(i, j, 0.7, true, 0.9)) place(rand() < 0.6 ? 'tree_bamboo3' : 'tree_bamboo2', i, j, true, 0.7);
    });
    // The arid lands: their own kinds of growth, sparse, in loose stands (still thicker where the wood field is).
    eachCell((i, j) => {
        const k = at(i, j);
        const t = terrain[k];
        const st = style[k];
        if (!(t === GRASS || t === DIRT || t === SAND) || !ARID.has(st)) return;
        const w = woodAt(i, j);
        if (rand() >= (w > CORE ? 0.2 : w > EDGE ? 0.08 : 0.03)) return;
        let name: string;
        // Pyraxis: stands of scorched pine (the resin the story asks for), dead trees, obsidian, cacti in the badlands.
        if (st === STYLE.ASH) name = rand() < 0.45 ? 'pine_scorched' : rand() < 0.5 ? 'deadtree' : rand() < 0.5 ? 'obsidian' : rock();
        else if (st === STYLE.BADLANDS) name = rand() < 0.45 ? 'cactus' : rand() < 0.4 ? 'pine_scorched' : rock();
        else if (st === STYLE.SCORCH) name = rand() < 0.6 ? 'pine_scorched' : rand() < 0.5 ? 'deadtree' : rand() < 0.6 ? rock() : 'stump';
        else if (st === STYLE.SALT) name = rand() < 0.4 ? 'deadtree' : rand() < 0.5 ? 'ruinwall' : rand() < 0.5 ? 'pillar_broken' : 'crystal1';
        else if (st === STYLE.BEACH || st === STYLE.CORAL) {
            if (w < EDGE && rand() < 0.6) return;
            name = 'palm';
        } else return;
        const r = name.startsWith('rock') || name === 'stump' ? 0.8 : 1.2;
        if (canStand(i, j, r, true, w > CORE ? 0.85 : 1.3)) place(name, i, j, true, r);
    });
    // Stumps where the woods were cut back, at their edges.
    eachCell((i, j) => {
        const k = at(i, j);
        if (terrain[k] !== GRASS || ARID.has(style[k])) return;
        const w = woodAt(i, j);
        if (w > EDGE && w < CORE + 0.02 && rand() < 0.012 && canStand(i, j, 0.7, true)) place('stump', i, j, true, 0.7);
    });
    // Undergrowth: bushes gather along the woods' edges and in small thickets out in the open (walked through:
    // a bush that stops you reads as an invisible wall).
    const clump = (ci: number, cj: number, n: number, spread: number, fn: (i: number, j: number) => boolean) => {
        for (let tries = 0, got = 0; got < n && tries < n * 6; tries++) {
            const i = Math.round(ci + (rand() - 0.5) * 2 * spread), j = Math.round(cj + (rand() - 0.5) * 2 * spread);
            if (inMap(i, j) && i < W && j < W && fn(i, j)) got++;
        }
    };
    const bushOk = (i: number, j: number) => {
        const k = at(i, j);
        return (terrain[k] === GRASS || terrain[k] === DIRT) && !ARID.has(style[k]) && height[k] <= 6;
    };
    eachCell((i, j) => {
        if (!bushOk(i, j)) return;
        const w = woodAt(i, j);
        const chance = w > CORE ? 0.006 : w > EDGE - 0.03 ? 0.03 : 0.003;
        if (rand() >= chance) return;
        // One kind per thicket (the berries all red, or all white), a few plants close together.
        const kind = pick(bushes);
        clump(i, j, intIn(2, 4), 2, (bi, bj) => {
            if (!bushOk(bi, bj) || !canStand(bi, bj, 0.62, false, 0.95)) return false;
            place(rand() < 0.75 ? kind : pick(bushes), bi, bj, false, 0.62);
            return true;
        });
    });
    // Flowering shrubs: bright clumps out in the meadows.
    eachCell((i, j) => {
        if (terrain[at(i, j)] !== GRASS || ARID.has(style[at(i, j)]) || woodAt(i, j) > EDGE || rand() >= 0.0022) return;
        const kind = pick(['dbush_blue', 'dbush_orange', 'dbush_pink']);
        clump(i, j, intIn(2, 4), 1.6, (bi, bj) => {
            if (terrain[at(bi, bj)] !== GRASS || !canStand(bi, bj, 0.55, false, 0.9)) return false;
            place(kind, bi, bj, false, 0.55);
            return true;
        });
    });
    // Tall grass in tufts of a few, in the open and along the woods' edges (never a carpet of it).
    eachCell((i, j) => {
        if (!bushOk(i, j) || rand() >= (woodAt(i, j) > CORE ? 0.002 : 0.009)) return;
        clump(i, j, intIn(3, 6), 2.2, (bi, bj) => {
            if (!bushOk(bi, bj) || !canStand(bi, bj, 0.42, false, 0.95)) return false;
            place(`tallgrass${intIn(1, 4)}`, bi, bj, false, 0.42);
            return true;
        });
    });
    // Boulders: scattered on rocky ground, now and then a pair or three together elsewhere.
    eachCell((i, j) => {
        const k = at(i, j);
        const t = terrain[k];
        if (t === WATER || t === SAND || t === VOID) return;
        const chance = t === STONE ? 0.014 : 0.002;
        if (rand() >= chance) return;
        clump(i, j, rand() < 0.35 ? intIn(2, 3) : 1, 1.5, (bi, bj) => {
            const tt = terrain[at(bi, bj)];
            if (tt === WATER || tt === SAND || !canStand(bi, bj, 0.75, true, 0.9)) return false;
            place(rock(), bi, bj, true, 0.75);
            return true;
        });
    });
    // Each land's own landmarks of nature: obsidian spires on Pyraxis's heights, crystal outcrops in
    // the Void Wastes, ruins standing in the salt, coral in Aquatica's shallows.
    eachCell((i, j) => {
        const k = at(i, j);
        if (terrain[k] !== STONE) return;
        if (style[k] === STYLE.OBSIDIAN && rand() < 0.03 && canStand(i, j, 1.2, true, 1.4)) place('obsidian', i, j, true, 1.2);
        else if (style[k] === STYLE.CRYSTAL && rand() < 0.045 && canStand(i, j, 0.9, true, 1.3)) place(pick(['crystal1', 'crystal1', 'crystal2']), i, j, true, 0.9);
    });
    for (let n = 0, tries = 0; n < Math.round(14 * S2) && tries < 2000; tries++) {
        const ci = intIn(30, W - 30), cj = intIn(30, W - 30);
        if (!inKingdom(ci, cj, 'earth') || styleAt(ci, cj) !== STYLE.SALT || !free(ci, cj, 4) || !roomFor(ci, cj, 5)) continue;
        // A fallen colonnade: a ring of pillars, some broken, a stretch of wall.
        for (let a = 0; a < 8; a++) {
            const i = Math.round(ci + Math.cos(a * 0.785) * 4), j = Math.round(cj + Math.sin(a * 0.785) * 4);
            if (free(i, j, 0) && terrain[at(i, j)] !== SAND) place(rand() < 0.45 ? 'pillar' : rand() < 0.6 ? 'pillar_broken' : 'ruinwall', i, j, true, 0.7);
        }
        n++;
    }
    // The beach: driftwood, rocks and reeds (no trees or bushes); sand piles and pebbles on the ground.
    scatter(120 * S, 1.2, (i, j) => place(rand() < 0.6 ? 'driftwood1' : 'driftwood2', i, j, true, 1.2), [SAND], 1, 340, 0.3);
    scatter(60 * S, 0.8, (i, j) => place(`rock${intIn(1, 5)}`, i, j, true, 0.8), [SAND], 1);
    scatter(260 * S, 0.42, (i, j) => place(`tallgrass${intIn(1, 4)}`, i, j, false, 0.42), [SAND], 1, 350, 0.55);
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const k = at(i, j);
            if (terrain[k] !== SAND || beachAmt(i, j) < 0.5 || road.has(k) || occupied.has(k)) continue;
            const r = rand();
            if (r < 0.035) flats.push({ name: 'sandpile', i, j });
            else if (r < 0.075) flats.push({ name: 'pebbles', i, j });
        }
    }

    // Tide pools on Aquatica's beaches.
    for (let j = 0; j < W; j++) {
        for (let i = 0; i < W; i++) {
            const k = at(i, j);
            if (style[k] !== STYLE.BEACH || occupied.has(k) || road.has(k) || shoreDist[k] > 3) continue;
            if (rand() < 0.07) flats.push({ name: `puddle${intIn(1, 3)}`, i, j });
        }
    }
    // Reeds along the shore, and stones (in Aquatica, coral) breaking the surface of shallow water.
    for (let k = 0; k < terrain.length; k++) {
        const i = k % N, j = (k - i) / N;
        if (terrain[k] === WATER && shoreDist[k] >= 2 && shoreDist[k] <= 3 && !occupied.has(k) && regionOf(i + 0.5, j + 0.5) === 'water' && rand() < 0.05) {
            place(rand() < 0.5 ? 'coral1' : 'coral2', i, j, true);
            continue;
        }
        if (terrain[k] === SAND && shoreDist[k] === 1 && !road.has(k) && !occupied.has(k) && rand() < 0.22) place(`tallgrass${intIn(1, 4)}`, i, j, false);
        else if (terrain[k] === WATER && shoreDist[k] >= 2 && shoreDist[k] <= 4 && !occupied.has(k) && rand() < 0.03) place(`rock${intIn(1, 5)}`, i, j, true);
    }

    // No flat decals on stone plazas (arenas, the citadel).
    const plaza = new Set<number>();
    for (const L of LANDMARKS) {
        if (L.kind !== 'arena' && L.kind !== 'citadel') continue;
        for (let j = L.j - L.r; j <= L.j + L.r; j++) for (let i = L.i - L.r; i <= L.i + L.r; i++) if (inMap(i, j)) plaza.add(at(i, j));
    }
    const keptFlats = flats.filter((f) => !plaza.has(at(f.i, f.j)));
    const region = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const r = regionOf(i + 0.5, j + 0.5);
            region[at(i, j)] = r === 'citadel' ? 0 : ELEMENTS.indexOf(r) + 1;
        }
    }

    // ---- The caves, dungeons and ruins, laid in beyond the continent, and the doors between.
    const countFlats = flats.length;
    const placeOf = new Uint8Array(N * N);
    const doors: Door[] = [];
    const lights: WorldMap['lights'] = [];
    const spawns: WorldMap['spawns'] = [];
    const sector = (du: number, dv: number) => {
        // The facing (0-7, as the hero's) of a step of (du, dv) in tiles.
        const x = du - dv, y = (du + dv) * 0.5;
        return ((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8;
    };
    const FLOORISH = (ch: string) => ch !== ' ' && ch !== '#' && ch !== '~';
    /** Per interior: its 'E', 'L' and 'H' cells and the floor cell beside each where you arrive. */
    const ends = new Map<string, Record<string, { k: number; arrive: { u: number; v: number }; face: number }>>();
    for (const p of PLACED) {
        const th = THEMES[p.def.theme];
        const reg = ELEMENTS.indexOf(p.def.land) + 1;
        const got: Record<string, { k: number; arrive: { u: number; v: number }; face: number }> = {};
        const isFloor = (i: number, j: number) => FLOORISH(charAt(p, i, j));
        const isOpen = (i: number, j: number) => isFloor(i, j) || charAt(p, i, j) === '~';
        const nearOpen = (i: number, j: number, r: number) => {
            for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (isOpen(i + di, j + dj)) return true;
            return false;
        };
        for (let j = p.j0; j < p.j0 + p.h; j++) {
            for (let i = p.i0; i < p.i0 + p.w; i++) {
                const k = at(i, j);
                const ch = charAt(p, i, j);
                placeOf[k] = p.n;
                region[k] = reg;
                variant[k] = intIn(0, 2);
                if (isFloor(i, j)) {
                    terrain[k] = DIRT;
                    height[k] = ch === '^' ? 2 : 1;
                    style[k] = th.floor;
                    blocked[k] = 0;
                } else if (ch === '~') {
                    terrain[k] = WATER;
                    height[k] = 0;
                    shoreDist[k] = 1;
                    blocked[k] = 1;
                } else if (nearOpen(i, j, 1)) {
                    // Rock or masonry: taller where it is deep in the rock, so caves look rugged.
                    terrain[k] = STONE;
                    height[k] = th.built ? 3 : nearOpen(i, j, 0) ? 3 : 3 + (lattice(i, j, 500) < 0.5 ? 1 : 0);
                    style[k] = th.wall;
                    blocked[k] = 1;
                } else {
                    terrain[k] = VOID;
                    blocked[k] = 1;
                }
            }
        }
        // What is in it.
        const stand = (name: string, i: number, j: number) => { props.push({ name, i, j }); blocked[at(i, j)] = 1; solidAt[at(i, j)] = 1; };
        const loose = (name: string, i: number, j: number) => props.push({ name, i, j });
        const light = (i: number, j: number, color: number, r: number) => lights.push({ i, j, color, r });
        for (let j = p.j0; j < p.j0 + p.h; j++) {
            for (let i = p.i0; i < p.i0 + p.w; i++) {
                const ch = charAt(p, i, j);
                switch (ch) {
                    case ',': flats.push({ name: th.built ? 'rubble' : pick(['rubble', 'pebbles']), i, j }); break;
                    case '=': flats.push({ name: charAt(p, i - 1, j) === '=' || charAt(p, i + 1, j) === '=' ? 'rail_u' : 'rail_v', i, j }); break;
                    case 'T': stand('torch', i, j); light(i, j, th.light, 5); break;
                    case 'l': stand('lantern', i, j); light(i, j, 0xffd27a, 4); break;
                    case 'c': stand(th.crystal, i, j); light(i, j, th.crystal === 'crystal1' ? 0xc084fc : th.crystal === 'crystal2' ? 0x7dd3fc : th.crystal === 'crystal3' ? 0xf87171 : 0xfbbf24, 3); break;
                    case 'm': loose(`mush_glow${intIn(1, 3)}`, i, j); light(i, j, 0xa7f3d0, 2); break;
                    case 's': stand(rand() < 0.5 ? 'stalag1' : 'stalag2', i, j); break;
                    case 'r': stand(`rock${intIn(1, 5)}`, i, j); break;
                    case 'x': stand(rand() < 0.5 ? 'crate' : 'crate2', i, j); break;
                    case 'k': stand('scaffold', i, j); break;
                    case 'K': stand('minecart', i, j); break;
                    case 'p': stand('pillar', i, j); break;
                    case 'P': stand('pillar_broken', i, j); break;
                    case 'B': stand('bookshelf', i, j); break;
                    case 'o': stand('obsidian', i, j); break;
                    case 'b': loose(rand() < 0.5 ? 'skull' : 'bones', i, j); break;
                    case 'n': loose('candle', i, j); light(i, j, 0xffd890, 2); break;
                    case 'C': chests.push({ i, j }); blocked[at(i, j)] = 1; solidAt[at(i, j)] = 1; break;
                    case 'M': spawns.push({ n: p.n, i, j }); break;
                    case 'E': case 'L': case 'H': {
                        // Arrive on the open floor beside it, facing away from it.
                        let best: [number, number] | null = null;
                        let score = -1;
                        for (const [di, dj] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
                            const ni = i + di, nj = j + dj;
                            const c2 = charAt(p, ni, nj);
                            if (!FLOORISH(c2) || 'ELH'.includes(c2)) continue;
                            let n = 0;
                            for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (FLOORISH(charAt(p, ni + a, nj + b))) n++;
                            if (n > score) { score = n; best = [ni, nj]; }
                        }
                        const [ai, aj] = best ?? [i, j];
                        got[ch] = { k: at(i, j), arrive: { u: ai + 0.5, v: aj + 0.5 }, face: sector(ai - i, aj - j) };
                        if (ch === 'E') loose(th.built ? 'big_exit' : 'ladder_up', i, j);
                        else if (ch === 'L') loose('ladder_up', i, j);
                        else loose('hole_ladder', i, j);
                        light(i, j, ch === 'H' ? th.light : 0xfff0c0, ch === 'H' ? 2 : 4);
                        break;
                    }
                }
            }
        }
        ends.set(p.def.id, got);
    }
    // The doors: each interior's way out and its mouth on the overworld; a dig's ladders between its floors.
    const doorAt = new Map<number, number>();
    const door = (d: Door) => { doorAt.set(d.at, doors.length); doors.push(d); };
    for (const p of PLACED) {
        const got = ends.get(p.def.id)!;
        const e = entranceCell(p.def);
        if (e && got.E) {
            const ek = at(e.i, e.j);
            // The mouth: a hill of rock (or a ruined gate) with its opening toward the viewer.
            const built = THEMES[p.def.theme].built;
            props.push({ name: built ? 'big_gate' : 'big_cave', i: e.i, j: e.j });
            // Only what the art covers stops you: the hill of rock behind and beside a cave mouth, the wall behind a gate.
            const covered = built ? [[-1, 0], [0, -1], [-1, -1]] : [[-1, 0], [0, -1], [-1, -1], [-1, 1], [1, -1]];
            for (const [di, dj] of covered) blocked[at(e.i + di, e.j + dj)] = 1;
            blocked[ek] = 0;
            door({ at: ek, u: got.E.arrive.u, v: got.E.arrive.v, face: got.E.face, place: p.n, name: p.def.name });
            door({ at: got.E.k, u: e.i + 1.5, v: e.j + 1.5, face: sector(1, 1), place: 0, name: '' });
            lights.push({ i: e.i, j: e.j, color: 0xffd27a, r: 3 });
        }
        if (p.def.up && got.L) {
            const above = PLACED.find((q) => q.def.id === p.def.up);
            const hole = above && ends.get(above.def.id)?.H;
            if (above && hole) {
                door({ at: got.L.k, u: hole.arrive.u, v: hole.arrive.v, face: hole.face, place: above.n, name: above.def.name });
                door({ at: hole.k, u: got.L.arrive.u, v: got.L.arrive.v, face: got.L.face, place: p.n, name: p.def.name });
            }
        }
    }

    return { terrain, variant, blocked, height, tone, shoreDist, flats: keptFlats.concat(flats.slice(countFlats)), props, chests, camps, region, style, solid: solidAt, place: placeOf, doors, doorAt, lights, spawns };
}
