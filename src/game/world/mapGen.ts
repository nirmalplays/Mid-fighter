/**
 * Deterministic isometric map (MAP_TILES square, 384 today): terrain per cell (grass, dirt, sand,
 * rocky ground, water) plus flat decals, standing props, treasure chests and the fixed
 * places of Eidolon (game/eidolon.ts): four kingdoms with their own look (Pyraxis rocky and
 * bare, Zephyria high, Aquatica full of lakes, Terragrim thick with forest), each with a camp,
 * guardians, a warden's arena, towers and houses, and the Void Citadel in the middle. Pure data — the
 * renderer in worldScene.ts turns it into sprites a chunk at a time.
 */
import { MAP_TILES } from './constants.ts';
import { BUILDINGS, BUILDING_IDS, type BuildingId } from '../survival.ts';
import { ELEMENTS, LANDMARKS, regionOf, type Element } from '../eidolon.ts';

export const GRASS = 0;
export const DIRT = 1;
export const SAND = 2;
export const STONE = 3;
export const WATER = 4;

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
    /** Region per cell: 0 the citadel, 1-4 a kingdom (ELEMENTS index + 1). */
    region: Uint8Array;
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
    const SPAWN = N / 2;
    /** The layout was tuned on a 256 map: positions scale by S, counts by S². */
    const S = N / 256;
    const S2 = S * S;
    const at = (i: number, j: number) => j * N + i;
    const inMap = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N;
    const pick = <T,>(a: T[]): T => a[Math.floor(rand() * a.length)];
    const intIn = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

    const terrain = new Uint8Array(N * N);
    const variant = new Uint8Array(N * N);
    const blocked = new Uint8Array(N * N);
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
        const fromEdge = N - 1 - j;
        const inner = OCEAN + BEACH_SEA + BEACH_DEEP + 4 * Math.sin(i * 0.09) + 3 * Math.sin(i * 0.23 + 1);
        return span * (1 - smooth(inner - 5, inner + 6, fromEdge));
    };

    // ---- Ocean: a jittered band of water around the edge, wider in front of the beach.
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const edge = Math.min(i, j, N - 1 - i, N - 1 - j);
            const sea = j > N / 2 ? BEACH_SEA * beachSpan(i) : 0;
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
        if (terrain[at(i, j)] !== WATER || t === WATER) terrain[at(i, j)] = t;
    };
    const farFrom = (ci: number, cj: number, r: number) =>
        Math.min(ci, cj, N - 1 - ci, N - 1 - cj) > OCEAN + r + 3 && !nearSpawn(ci, cj, r + 12) && beachAmt(ci, cj) < 0.02 && beachAmt(ci, cj + r + 6) < 0.02;

    // ---- Rocky ground and dirt patches (under the lakes so water wins).
    for (let n = 0, tries = 0; n < Math.round(9 * S2) && tries < 200 * S2; tries++) {
        const ci = intIn(20, N - 20), cj = intIn(20, N - 20), r = intIn(3, 6);
        if (!farFrom(ci, cj, r)) continue;
        blob(ci, cj, r, r * (0.6 + rand() * 0.5), setTerrain(STONE));
        n++;
    }
    for (let n = 0, tries = 0; n < Math.round(14 * S2) && tries < 200 * S2; tries++) {
        const ci = intIn(20, N - 20), cj = intIn(20, N - 20), r = intIn(3, 7);
        if (!farFrom(ci, cj, r)) continue;
        blob(ci, cj, r, r * (0.6 + rand() * 0.5), setTerrain(DIRT));
        n++;
    }

    // ---- Lakes.
    for (let n = 0, tries = 0; n < Math.round(14 * S2) && tries < 300 * S2; tries++) {
        const ci = intIn(20, N - 20), cj = intIn(20, N - 20), r = intIn(4, 9);
        if (!farFrom(ci, cj, r)) continue;
        blob(ci, cj, r, r * (0.55 + rand() * 0.5), setTerrain(WATER));
        n++;
    }

    // ---- Kingdom character: Aquatica gets many more lakes, Pyraxis bare rock.
    const inKingdom = (i: number, j: number, e: Element) => regionOf(i + 0.5, j + 0.5) === e;
    for (let n = 0, tries = 0; n < Math.round(7 * S2) && tries < 600 * S2; tries++) {
        const ci = intIn(20, N - 20), cj = intIn(20, N - 20), r = intIn(4, 10);
        if (!inKingdom(ci, cj, 'water') || !farFrom(ci, cj, r)) continue;
        blob(ci, cj, r, r * (0.55 + rand() * 0.5), setTerrain(WATER));
        n++;
    }
    for (let n = 0, tries = 0; n < Math.round(6 * S2) && tries < 600 * S2; tries++) {
        const ci = intIn(20, N - 20), cj = intIn(20, N - 20), r = intIn(4, 9);
        if (!inKingdom(ci, cj, 'fire') || !farFrom(ci, cj, r)) continue;
        blob(ci, cj, r, r * (0.6 + rand() * 0.5), setTerrain(n % 3 === 0 ? DIRT : STONE));
        n++;
    }

    // ---- Rivers: two wandering channels with grass fords every so often.
    const river = (vertical: boolean, c0: number, amp: number, phase: number, fords: number[]) => {
        for (let t = OCEAN; t < N - OCEAN; t++) {
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
            if (terrain[at(i, j)] === WATER) continue;
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
            const edge = Math.min(i, j, N - 1 - i, N - 1 - j);
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
                if (terrain[k] === WATER || lattice(i, j, 90) < 0.08) continue;
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
        if (height[k] >= 6 || (height[k] >= 4 && vnoise(i * 0.25, j * 0.25, 70) > 0.5)) terrain[k] = STONE;
    }

    // The beach itself is sand (grass pokes through at its ragged inland edge).
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const k = at(i, j);
            if (terrain[k] === WATER) continue;
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

    for (let k = 0; k < terrain.length; k++) if (terrain[k] === WATER) blocked[k] = 1;

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
    const passable = (i: number, j: number) => inMap(i, j) && terrain[at(i, j)] !== WATER;
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
            Math.min(N - OCEAN - 14, Math.max(OCEAN + 14, Math.round(SPAWN + Math.cos(ang) * d))),
            Math.min(N - OCEAN - 14, Math.max(OCEAN + 14, Math.round(SPAWN + Math.sin(ang) * d))),
        );
        if (k !== null) waypoints.push(k);
    }
    // One waypoint on the beach itself, so a road leads down to it.
    for (let dj = 0; dj < 30; dj++) {
        const bj = N - 1 - (OCEAN + BEACH_SEA + 20) - dj, bi = Math.round(130 * S);
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
    // Every kingdom's camp has the same five tents (only liberated camps can use them).
    const camps: { el: Element; id: BuildingId; i: number; j: number }[] = [];
    for (const L of LANDMARKS) {
        if (L.kind !== 'camp' || !L.el) continue;
        for (const id of BUILDING_IDS) {
            const c = { el: L.el, id, i: L.i + BUILDINGS[id].at[0], j: L.j + BUILDINGS[id].at[1] };
            camps.push(c);
            blocked[at(c.i, c.j)] = 1;
        }
    }
    const nearLandmark = (i: number, j: number, pad: number) => LANDMARKS.some((L) => Math.hypot(i - L.i, j - L.j) <= L.r + pad);

    const place = (name: string, i: number, j: number, solid: boolean) => {
        props.push({ name, i, j });
        occupied.add(at(i, j));
        if (solid) blocked[at(i, j)] = 1;
    };
    const free = (i: number, j: number, gap: number): boolean => {
        if (!inMap(i, j) || terrain[at(i, j)] === WATER || nearSpawn(i, j, 6)) return false;
        for (let dj = -gap; dj <= gap; dj++) for (let di = -gap; di <= gap; di++) if (occupied.has(at(i + di, j + dj))) return false;
        return true;
    };
    // Groves and thickets: vegetation gathers in clusters instead of spreading evenly.
    const scatter = (
        count: number, gap: number, fn: (i: number, j: number) => void, onTerrain: number[],
        maxH = MAX_HEIGHT, salt = 0, bias = 0.5,
    ) => {
        for (let n = 0, tries = 0; n < count && tries < count * 14; tries++) {
            const i = intIn(3, N - 4), j = intIn(3, N - 4);
            if (!onTerrain.includes(terrain[at(i, j)]) || height[at(i, j)] > maxH) continue;
            if (salt && vnoise(i * 0.07, j * 0.07, salt) < bias - 0.25 * rand()) continue;
            if (!free(i, j, gap)) continue;
            fn(i, j);
            n++;
        }
    };
    const broadleaf = ['tree_oak', 'tree_oak', 'tree_birch', 'tree_birch', 'tree_apple', 'tree_ginkgo', 'tree_pear', 'tree_plum', 'tree_cherry', 'tree_fantasy'];
    const bushes = ['gbush1', 'gbush2', 'gbush3', 'gbush1', 'gbush2', 'gbush3', 'bbush1', 'bbush2', 'bbush3', 'bbush1b', 'bbush2b', 'bbush3b', 'bbush1w', 'bbush2w', 'bbush3w'];
    // Treasure chests, spread out over the land (never near the camp).
    const chests: { i: number; j: number }[] = [];
    for (let tries = 0; chests.length < Math.round(22 * S2) && tries < 4000; tries++) {
        const i = intIn(OCEAN + 6, N - OCEAN - 7), j = intIn(OCEAN + 6, N - OCEAN - 7);
        const k = at(i, j);
        if (terrain[k] === WATER || terrain[k] === SAND || nearSpawn(i, j, 16) || nearLandmark(i, j, 5) || !free(i, j, 2)) continue;
        if (chests.some((c) => Math.hypot(c.i - i, c.j - j) < 14)) continue;
        chests.push({ i, j });
        occupied.add(k);
        blocked[k] = 1;
    }
    scatter(1700 * S2, 2, (i, j) => {
        if (inKingdom(i, j, 'fire') && rand() < 0.75) place(rand() < 0.6 ? `rock${intIn(1, 5)}` : 'stump', i, j, true);
        else place(height[at(i, j)] >= 2 && rand() < 0.7 ? 'tree_pine' : pick(broadleaf), i, j, true);
    }, [GRASS, DIRT], 5, 300, 0.48);
    scatter(700 * S2, 1, (i, j) => { if (inKingdom(i, j, 'earth')) place(pick(broadleaf), i, j, true); }, [GRASS, DIRT], 5);
    scatter(40 * S2, 3, (i, j) => place('stump', i, j, true), [GRASS], 3);
    scatter(4200 * S2, 1, (i, j) => place(pick(bushes), i, j, true), [GRASS, DIRT], 6, 310, 0.42);
    scatter(900 * S2, 1, (i, j) => place(`rock${intIn(1, 5)}`, i, j, true), [GRASS, STONE, DIRT]);
    scatter(1100 * S2, 1, (i, j) => place(pick(['dbush_blue', 'dbush_orange', 'dbush_pink']), i, j, false), [GRASS], 6, 320, 0.45);
    scatter(9000 * S2, 0, (i, j) => place(`tallgrass${intIn(1, 4)}`, i, j, false), [GRASS, DIRT], 6, 330, 0.35);
    // The beach: driftwood, rocks and reeds (no trees or bushes); sand piles and pebbles on the ground.
    scatter(120 * S, 3, (i, j) => place(rand() < 0.6 ? 'driftwood1' : 'driftwood2', i, j, true), [SAND], 1, 340, 0.3);
    scatter(60 * S, 3, (i, j) => place(`rock${intIn(1, 5)}`, i, j, true), [SAND], 1);
    scatter(260 * S, 1, (i, j) => place(`tallgrass${intIn(1, 4)}`, i, j, false), [SAND], 1, 350, 0.55);
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const k = at(i, j);
            if (terrain[k] !== SAND || beachAmt(i, j) < 0.5 || road.has(k) || occupied.has(k)) continue;
            const r = rand();
            if (r < 0.035) flats.push({ name: 'sandpile', i, j });
            else if (r < 0.075) flats.push({ name: 'pebbles', i, j });
        }
    }

    // Reeds along the shore, and stones breaking the surface of shallow water.
    for (let k = 0; k < terrain.length; k++) {
        const i = k % N, j = (k - i) / N;
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

    return { terrain, variant, blocked, height, tone, shoreDist, flats: keptFlats, props, chests, camps, region };
}
