/**
 * The war camp every kingdom keeps (the same plan in all four): a square palisade of sharpened stakes
 * with log watchtowers at its corners, a timber gate between two towers facing the road (the +v side,
 * where mapGen's road arrives), barricades before the gate (sandbags, cheval-de-frise, a spiked ditch),
 * and inside: the fire with its benches, the five tents (survival.ts BUILDINGS), a well, racks, crates,
 * a notice board, a training dummy, torches and braziers, and trodden paths between them all.
 *
 * Offsets are in tiles from the camp's centre point (the landmark's cell centre). mapGen reads this for
 * the ground and what blocks; survivalLayer (world/campView.ts) draws it.
 */
import { BUILDINGS, BUILDING_IDS, type BuildingId } from '../survival.ts';
import { LANDMARKS, type Element } from '../eidolon.ts';

/** Half the palisade's side, in cells: the stakes stand on the cells this far out from the centre cell. (8: room to breathe.) */
export const WALL_R = 8;
/** The gate: cells (-1..1, WALL_R) are open, between gate towers at (±2, WALL_R). */
export const GATE_HALF = 1;

export type Block = 'wall' | 'solid' | null;
export interface CampPiece {
    /** Iso atlas frame (when the camp is ruined, `ruin` if it has one; '' draws nothing). */
    name: string;
    ruin?: string;
    du: number;
    dv: number;
    /** What it does to movement: 'wall' fills its cell, 'solid' stops you near its middle. */
    block: Block;
    /** A flat thing on the ground (sorted under whoever stands on it). */
    flat?: boolean;
    /** Cloth drawn over it in the kingdom's colour (an atlas frame on the same canvas). */
    cloth?: string;
    /** It burns (a flame sprite this many world px above the ground, scaled). */
    fire?: { lift: number; scale: number };
    /** Shown only while the camp is ruined (rubble, smoke), or only once it is free. */
    only?: 'ruin' | 'free';
}

const P = (name: string, du: number, dv: number, block: Block, more: Partial<CampPiece> = {}): CampPiece => ({ name, du, dv, block, ...more });

/** Cells the palisade, its towers and the gate occupy (offsets from the centre cell). */
export function wallCells(): { di: number; dj: number; kind: 'wall_u' | 'wall_v' | 'tower' | 'gate' }[] {
    const out: { di: number; dj: number; kind: 'wall_u' | 'wall_v' | 'tower' | 'gate' }[] = [];
    const R = WALL_R;
    for (let k = -R; k <= R; k++) {
        for (const [di, dj, axis] of [[k, -R, 'u'], [k, R, 'u'], [-R, k, 'v'], [R, k, 'v']] as const) {
            if (out.some((c) => c.di === di && c.dj === dj)) continue;
            const corner = Math.abs(di) === R && Math.abs(dj) === R;
            const gateTower = dj === R && Math.abs(di) === GATE_HALF + 1;
            if (corner || gateTower) out.push({ di, dj, kind: 'tower' });
            else if (dj === R && Math.abs(di) <= GATE_HALF) out.push({ di, dj, kind: 'gate' });
            else out.push({ di, dj, kind: axis === 'u' ? 'wall_u' : 'wall_v' });
        }
    }
    return out;
}

/** Cells of trodden earth: a yard round the fire, spokes out to the gate and the tents, the road in. */
export function pathCells(): [number, number][] {
    const out = new Map<string, [number, number]>();
    const add = (di: number, dj: number) => out.set(`${di},${dj}`, [di, dj]);
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (Math.max(Math.abs(di), Math.abs(dj)) >= 1) add(di, dj);
    for (let dj = 3; dj <= WALL_R + 3; dj++) add(0, dj);
    add(-1, WALL_R); add(1, WALL_R); add(-1, WALL_R + 1); add(1, WALL_R + 1);
    for (let di = 3; di <= WALL_R - 3; di++) { add(di, 0); add(-di, 0); }
    for (let dj = -WALL_R + 3; dj <= -3; dj++) add(0, dj);
    for (const id of BUILDING_IDS) {
        const [x, y] = BUILDINGS[id].at;
        // a short way from the yard to the tent's door
        const sx = Math.sign(x), sy = Math.sign(y);
        add(x - sx, y - sy);
        if (Math.abs(x) > 2 && Math.abs(y) > 2) add(x - 2 * sx, y - 2 * sy);
    }
    return [...out.values()];
}

/** Everything that stands in a camp besides its tents. */
export function campPieces(): CampPiece[] {
    const R = WALL_R;
    const out: CampPiece[] = [];
    // ---- the palisade, towers and gate
    for (const c of wallCells()) {
        const alt = (c.di + c.dj) & 1 ? '2' : '';
        if (c.kind === 'tower') out.push(P('camp_tower', c.di, c.dj, 'wall', { ruin: 'camp_tower_ruin', cloth: 'camp_tower_flag', fire: { lift: 104, scale: 0.55 } }));
        else if (c.kind === 'gate') {
            if (c.di === 0) out.push(P('camp_gate', 0, R, null, { ruin: 'camp_gate_ruin', cloth: 'camp_gate_flags' }));
        } else out.push(P(`camp_${c.kind}${alt}`, c.di, c.dj, 'wall', { ruin: `camp_${c.kind}_ruin${alt}` }));
    }
    // ---- before the gate: torches, sandbags, crates, chevaux-de-frise, a spiked ditch
    out.push(P('camp_torch', -1.42, R + 0.75, null, { fire: { lift: 88, scale: 0.6 } }));
    out.push(P('camp_torch', 1.42, R + 0.75, null, { fire: { lift: 88, scale: 0.6 } }));
    // (kept a cell clear of the gate towers' legs, so nothing is drawn into them)
    out.push(P('camp_sandbags_u', -3.6, R + 1.2, 'solid', { ruin: '' }));
    out.push(P('camp_sandbags_u', 3.6, R + 1.2, 'solid', { ruin: '' }));
    out.push(P('camp_cheval_u', -2.1, R + 2.6, 'solid'));
    out.push(P('camp_cheval_u', 2.1, R + 2.6, 'solid'));
    out.push(P('camp_cheval_v', R + 1.5, 2, 'solid'));
    out.push(P('camp_cheval_v', R + 1.5, -2, 'solid'));
    out.push(P('camp_cheval_u', -2, -R - 1.5, 'solid'));
    out.push(P('camp_cheval_u', 2, -R - 1.5, 'solid'));
    out.push(P('camp_cheval_v', -R - 1.5, -2, 'solid'));
    out.push(P('camp_cheval_v', -R - 1.5, 2, 'solid'));
    for (const di of [-7, -6, -5, 5, 6, 7]) out.push(P('camp_ditch_u', di, R + 2, 'wall', { flat: true }));
    // ---- the yard: the fire and its benches (the story's Spire, altar and loom, and the camp's people, stand a
    // little way off round it: story/land*.ts, eidolon.ts NPCS)
    out.push(P('camp_firepit', 0, 0, 'solid'));
    out.push(P('camp_bench_v', -1.5, 0.15, null));
    out.push(P('camp_bench_u', 0.15, -1.5, null));
    out.push(P('camp_bench_u', -0.6, 1.45, null));
    out.push(P('camp_banner', 1, 3.6, 'solid', { cloth: 'camp_banner_cloth', ruin: '' }));
    // ---- where the camp's people sleep: one tent in the open back corner
    out.push(P('tent_cream', -6, -6, 'wall'));
    // ---- inside the gate: braziers flanking the way in, the notice board and the stores to either side
    out.push(P('camp_brazier', -1, R - 2, 'solid', { fire: { lift: 52, scale: 0.75 } }));
    out.push(P('camp_brazier', 1, R - 2, 'solid', { fire: { lift: 52, scale: 0.75 } }));
    out.push(P('camp_board', 5, R - 2, 'solid'));
    out.push(P('camp_crates', -5.5, R - 2.5, 'solid', { ruin: '' }));
    // ---- water by the healer: the well and a barrel
    out.push(P('camp_well', -6, -1, 'solid'));
    out.push(P('camp_water', -6, 1, 'solid'));
    // ---- the forge's corner: weapon racks; the training ground: a dummy
    out.push(P('camp_rack_v', 6, -1, 'solid'));
    out.push(P('camp_rack_u', 6, -6, 'solid'));
    out.push(P('camp_dummy', 6, 2, 'solid', { ruin: '' }));
    // ---- the storehouse's stacks
    out.push(P('camp_crates', -2, -R + 2, 'solid'));
    out.push(P('camp_barrels', 2, -R + 2, 'solid'));
    // ---- torches round the inside of the wall
    for (const [du, dv] of [[-R + 1, -3], [-3, -R + 1], [R - 1, 4], [-R + 1, 4], [3, -R + 1]]) out.push(P('camp_torch', du, dv, null, { fire: { lift: 88, scale: 0.6 } }));
    return out;
}

/**
 * How far a blocking piece's footprint reaches from its centre, in tiles (the cells whose centres it covers).
 * Small, so only the cells under the art stop you: nothing blocks where nothing is drawn.
 */
const FOOT = 0.55;

/** The cell (offset from the centre cell) a piece at (du, dv) stands on. */
export const cellOf = (du: number, dv: number): [number, number] => [Math.floor(du + 0.5), Math.floor(dv + 0.5)];

/**
 * Lay every kingdom's camp into the map (mapGen calls this once, after roads and ground decor): its trodden
 * paths, the stakes, towers and barricades that block, the tents. Returns the tents (map.camps).
 */
export function layCamps(m: {
    N: number;
    terrain: Uint8Array;
    style: Uint8Array;
    blocked: Uint8Array;
    solid: Uint8Array;
    flats: { name: string; i: number; j: number }[];
    occupied: Set<number>;
    /** mapGen's DIRT terrain code. */
    dirt: number;
}): { el: Element; id: BuildingId; i: number; j: number }[] {
    const { N } = m;
    const at = (i: number, j: number) => j * N + i;
    const camps: { el: Element; id: BuildingId; i: number; j: number }[] = [];
    const pieces = campPieces();
    const paths = pathCells();
    const ext = WALL_R + 3;
    for (const L of LANDMARKS) {
        if (L.kind !== 'camp' || !L.el) continue;
        // Clear the old decals (flowers, road stones) off the camp's ground, then lay the paths.
        const keep = m.flats.filter((f) => Math.abs(f.i - L.i) > ext || Math.abs(f.j - L.j) > ext);
        m.flats.length = 0;
        m.flats.push(...keep);
        for (let dj = -ext; dj <= ext; dj++) {
            for (let di = -ext; di <= ext; di++) {
                const k = at(L.i + di, L.j + dj);
                m.occupied.add(k);
                // The ground in and round the camp is the land's plain earth (no badland or ash patches).
                if (Math.max(Math.abs(di), Math.abs(dj)) <= WALL_R + 2) m.style[k] = 0;
            }
        }
        for (const [di, dj] of paths) {
            const k = at(L.i + di, L.j + dj);
            m.terrain[k] = m.dirt;
            m.style[k] = 0;
            m.flats.push({ name: 'camp_trodden', i: L.i + di, j: L.j + dj });
        }
        for (const p of pieces) {
            if (!p.block) continue;
            // A piece set between cells is drawn across them: it stops you on every cell under it, not only the
            // one its centre rounds to (or you would walk through its other half).
            const cells = [cellOf(p.du, p.dv)];
            for (let dj = Math.floor(p.dv) - 1; dj <= Math.ceil(p.dv) + 1; dj++) {
                for (let di = Math.floor(p.du) - 1; di <= Math.ceil(p.du) + 1; di++) if (Math.hypot(di - p.du, dj - p.dv) <= FOOT) cells.push([di, dj]);
            }
            for (const [di, dj] of cells) {
                const k = at(L.i + di, L.j + dj);
                m.blocked[k] = 1;
                if (p.block === 'solid') m.solid[k] = 1;
            }
        }
        for (const id of BUILDING_IDS) {
            const c = { el: L.el, id, i: L.i + BUILDINGS[id].at[0], j: L.j + BUILDINGS[id].at[1] };
            camps.push(c);
            // A tent (or its pegged-out plot) stops you at its middle, not at the edge of its cell.
            m.blocked[at(c.i, c.j)] = 1;
            m.solid[at(c.i, c.j)] = 1;
        }
    }
    return camps;
}

// ---------------------------------------------------------------- the camps as walls (for monsters)

const CAMP_LANDMARKS = LANDMARKS.filter((l) => l.kind === 'camp' && l.el);

/** Every camp's palisade and tower cells, as map cell indices (gate cells are open). Monsters never cross them. */
export function campWallCells(N: number): Set<number> {
    const out = new Set<number>();
    const walls = wallCells().filter((c) => c.kind !== 'gate');
    for (const L of CAMP_LANDMARKS) for (const c of walls) out.add((L.j + c.dj) * N + L.i + c.di);
    return out;
}

/**
 * The way round a palisade: where something at (fu, fv) should head first to reach (tu, tv) when a camp's wall
 * stands between them (one is inside, the other out), or null when the way is open. Coming in: round the
 * outside of the wall to the front, then to the gate, then through it. Going out: to the gate and through.
 */
export function campVia(fu: number, fv: number, tu: number, tv: number): { u: number; v: number } | null {
    const R = WALL_R;
    for (const L of CAMP_LANDMARKS) {
        const cu = L.i + 0.5, cv = L.j + 0.5;
        const inside = (u: number, v: number) => Math.abs(u - cu) < R - 0.4 && Math.abs(v - cv) < R - 0.4;
        const inF = inside(fu, fv), inT = inside(tu, tv);
        if (inF === inT) continue;
        const gateOut = { u: cu, v: cv + R + 1.6 }, gateIn = { u: cu, v: cv + R - 1.8 };
        // In the gateway itself: straight on through.
        const inGate = Math.abs(fu - cu) < GATE_HALF + 0.6 && fv > cv + R - 2.2 && fv < cv + R + 2.4;
        if (inT) {
            if (inGate) return gateIn;
            const du = fu - cu, dv = fv - cv;
            if (dv >= R + 1) return gateOut; // in front: to the gate
            const side = du >= 0 ? 1 : -1;
            if (Math.abs(du) >= R + 1) return { u: cu + side * (R + 2.5), v: cv + R + 2.5 }; // beside: to the front corner
            return { u: cu + side * (R + 2.5), v: cv - R - 2.5 }; // behind: to a back corner first
        }
        return inGate ? gateOut : gateIn;
    }
    return null;
}
