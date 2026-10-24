/**
 * Caves, dungeons, cellars and ruins you walk into: each one is a hand-laid map (or, for the side
 * caves, one grown from a seed), stamped into the world grid beyond the edge of the continent, where
 * nothing else is. A door on the overworld (a cave mouth, a ruined gate) and its twin inside take you
 * between them with a fade; ladders join the floors of a deep dig. Because they are part of the one
 * world map, everything just works inside: monsters, co-op friends, the story's props, saves.
 *
 * Legend of the maps (rows are j, columns are i; a void cell touching floor becomes wall):
 *   '.' floor   ',' floor with rubble   '^' a raised step   '~' water (lava in Pyraxis)   '#' wall
 *   'E' the way out to the overworld    'L' a ladder up to `up`   'H' a hole down (to whatever names this one as `up`)
 *   'T' torch   'l' lantern   'c' crystal   'm' glowing mushrooms   's' stalagmite   'r' rock (to mine)
 *   'x' crate   'k' scaffold  'K' mine cart  '=' rails   'p' pillar   'P' broken pillar   'B' bookshelf
 *   'o' obsidian  'b' bones   'n' candle    'C' chest   'M' foes wait here
 *   'A', 'W', 'Y' (any letter not above) where the story's places sit (see `sites`).
 */
import { MAP_TILES, WORLD_TILES } from './constants.ts';
import { STYLE } from './biomes.ts';
import { spot, STORY_SITES_BY, type Element } from '../eidolon.ts';

export type Theme = 'ash' | 'crypt' | 'cellar' | 'archive' | 'ice' | 'sky' | 'void' | 'drowned' | 'grotto';

export interface InteriorDef {
    id: string;
    name: string;
    land: Element;
    theme: Theme;
    rows: string[];
    /** Where its door stands on the overworld: a story site's spot, or [distance, side] along the land's axis. */
    entrance?: { site: string } | { at: [number, number] };
    /** The interior its 'L' ladder climbs to (arriving at that one's 'H'). */
    up?: string;
    /** Story sites that sit inside: site id -> anchor letter. */
    sites?: Record<string, string>;
    /** How strong its foes are (wave level). */
    level: number;
}

export interface ThemeDef {
    floor: number;
    wall: number;
    /** Foes that live here. */
    foes: string[];
    light: number;
    /** How dark it is away from the lights (0..1). */
    gloom: number;
    crystal: string;
    /** The way out is a lit archway (built places) or a ladder of light (caves). */
    built: boolean;
    music: 'cave' | 'crypt';
}

export const THEMES: Record<Theme, ThemeDef> = {
    ash: { floor: STYLE.ASH_FLOOR, wall: STYLE.ASH_WALL, foes: ['hollowed', 'slime', 'kobolt'], light: 0xffa050, gloom: 0.86, crystal: 'crystal3', built: false, music: 'cave' },
    grotto: { floor: STYLE.GROTTO_FLOOR, wall: STYLE.GROTTO_WALL, foes: ['slime', 'scorpion', 'kobolt'], light: 0xffb070, gloom: 0.84, crystal: 'crystal4', built: false, music: 'cave' },
    crypt: { floor: STYLE.CRYPT_FLOOR, wall: STYLE.CRYPT_WALL, foes: ['skeleton', 'wraith', 'skeleton'], light: 0xffd890, gloom: 0.88, crystal: 'crystal1', built: true, music: 'crypt' },
    cellar: { floor: STYLE.WOOD_FLOOR, wall: STYLE.CELLAR_WALL, foes: ['slime', 'kobolt'], light: 0xffc070, gloom: 0.8, crystal: 'crystal4', built: true, music: 'crypt' },
    archive: { floor: STYLE.ARCHIVE_FLOOR, wall: STYLE.ARCHIVE_WALL, foes: ['wizard', 'skeleton'], light: 0xff9a50, gloom: 0.8, crystal: 'crystal3', built: true, music: 'crypt' },
    ice: { floor: STYLE.ICE_FLOOR, wall: STYLE.ICE_WALL, foes: ['wolf', 'slime', 'wraith'], light: 0x9fe8ff, gloom: 0.78, crystal: 'crystal2', built: false, music: 'cave' },
    sky: { floor: STYLE.SKY_FLOOR, wall: STYLE.SKY_WALL, foes: ['archer', 'wraith'], light: 0xfff0c0, gloom: 0.7, crystal: 'crystal2', built: true, music: 'crypt' },
    drowned: { floor: STYLE.DROWNED_FLOOR, wall: STYLE.DROWNED_WALL, foes: ['scorpion', 'slime', 'wraith'], light: 0x7dd3fc, gloom: 0.84, crystal: 'crystal2', built: true, music: 'crypt' },
    void: { floor: STYLE.VOID_FLOOR, wall: STYLE.VOID_WALL, foes: ['wraith', 'wizard', 'skeleton'], light: 0xc084fc, gloom: 0.88, crystal: 'crystal1', built: false, music: 'cave' },
};

// ------------------------------------------------------------------ the story's places

const DEFS: InteriorDef[] = [
    // ---- Pyraxis: the dig where it all began, two floors down.
    {
        id: 'dig1', name: 'Deep-Strata Dig · Upper Galleries', land: 'fire', theme: 'ash', level: 1, entrance: { site: 'quarry' },
        rows: [
            '        ###########            ',
            '      ##....k....x.##          ',
            '     #..T.....,.....#####      ',
            '    #.....,...........M.##     ',
            '    #..r.....=======......#    ',
            '    #.....##.=.....=..c...#    ',
            '    ##...####=..K..=...T..#    ',
            '     #.T.#  #=.....=......#    ',
            '     #...#  #=======..r...#    ',
            '    ##.,.#  ##.....#..M...#    ',
            '    #....####...,..##.....#    ',
            '    #..M..........,.......#    ',
            '    #..c.....T.......x..H.#    ',
            '    ##.......l.....T.....##    ',
            '      ###.........#######      ',
            '         ##..E..##             ',
            '           #####               ',
        ],
    },
    {
        id: 'dig2', name: 'Deep-Strata Dig · The Sealed Chamber', land: 'fire', theme: 'ash', level: 1, up: 'dig1', sites: { quarry: 'A' },
        rows: [
            '          #########                 ',
            '       ###....c....###              ',
            '      #..,.........,..#             ',
            '     #..T...........T..#            ',
            '    #...................#           ',
            '    #...................#           ',
            '    #.........A.........#           ',
            '    #...................#           ',
            '    #..s.............s..#           ',
            '     #.................#  ~~~       ',
            '      #..T.........T..#~~~~~~       ',
            '       ##...........##~~~..~~       ',
            '         ##.......##.......c.#      ',
            '           #...........,.....#      ',
            '           ##..r.####........#      ',
            '            #....#   ##......#      ',
            '            #..,..# #....s...#      ',
            '             #.....T.......L.#      ',
            '              ###.........###       ',
            '                 #########          ',
        ],
    },
    {
        id: 'catacombs', name: 'The Whispering Catacombs', land: 'fire', theme: 'crypt', level: 2, entrance: { site: 'catacombs' }, sites: { catacombs: 'A' },
        rows: [
            '            #########             ',
            '           #n.......n#            ',
            '           #..p...p..#            ',
            '           #.........#            ',
            '           #..p...p..#            ',
            '           #....b....#            ',
            '            ####.####             ',
            '               #.#                ',
            '    #########  #.#  #########     ',
            '   #b..C..b..###.###..b..C..b#    ',
            '   #...M.....n..A..n.....M...#    ',
            '   #.........#.....#.........#    ',
            '   ###.###.###..T..###.###.###    ',
            '     #.# #.##.......##.# #.#      ',
            '     #.# #.##...p...##.# #.#      ',
            '   ###.###.##.......##.###.###    ',
            '   #..........,.....,........#    ',
            '   #.b..T....M.......M...T..b#    ',
            '   #.............E...........#    ',
            '    ##########.......#########    ',
            '              #######             ',
        ],
    },
    {
        id: 'cellar', name: "Bram's Cellar", land: 'fire', theme: 'cellar', level: 2, entrance: { site: 'cellar' }, sites: { cellar: 'A' },
        rows: [
            '   ###########      ',
            '  #x.x...l..xx#     ',
            '  #...........#     ',
            '  #x....A.....#     ',
            '  #...........##    ',
            '  #l..M....x...#    ',
            '  ##..........x#    ',
            '   ###...E...###    ',
            '      #######       ',
        ],
    },
    {
        // The Molten Archive: the Sanctum (its Word-Lock) and its two scriptoria, where the tablets are being melted down.
        id: 'archive', name: 'The Molten Archive', land: 'fire', theme: 'archive', level: 3, entrance: { site: 'library' }, sites: { library: 'A', scriptW: 'W', scriptE: 'Y' },
        rows: [
            '',
            '                .B.B.B.B.B.B.B.B.B..',
            '                ....................',
            '                .T................T.',
            '  .B.B.B.B.B.   ....................   .B.B.B.B.B.',
            '  ...........   ....................   ...........',
            '  ...........   .B................B.   ...........',
            '  ...........   ....................   ...........',
            '  ...........   .........A..........   ...........',
            '  .....W....................................Y.....',
            '  ...............B................B...............',
            '  ...C.......   ....................   .......C...',
            '  .......,...   ....................   ...,.......',
            '  .T.......T.   .T..p..........p..T.   .T.......T.',
            '  ...........   .........M..........   ...........',
            '                ....................',
            '                       ......',
            '                       ..E...',
        ],
    },
    {
        id: 'grotto', name: 'The Ember Grotto', land: 'fire', theme: 'grotto', level: 2, entrance: { site: 'grotto' }, sites: { grotto: 'A' },
        rows: [
            '      ########       ',
            '    ##..m..c..##     ',
            '   #..,....,....#    ',
            '   #m....A....m.#    ',
            '   #..~~.....,..#    ',
            '   #.~~~~..M....#    ',
            '    #~~~.....r.#     ',
            '     ##...E...#      ',
            '       #######       ',
        ],
    },
    // ---- Zephyria.
    {
        id: 'workshop', name: "Vael's Childhood Workshop", land: 'air', theme: 'sky', level: 5, entrance: { site: 'workshop' }, sites: { workshop: 'A' },
        rows: [
            '   ###########     ',
            '  #B..x...k..B#    ',
            '  #...........#    ',
            '  #T....A....T#    ',
            '  #...........#    ',
            '  #x...M...x..#    ',
            '  ##....E....##    ',
            '    #########      ',
        ],
    },
    {
        id: 'postvault', name: 'The Wind-Post Vault', land: 'air', theme: 'sky', level: 6, entrance: { site: 'postvault' }, sites: { postvault: 'A' },
        rows: [
            '    #############    ',
            '   #x.B.B.B.B.B.x#   ',
            '   #.............#   ',
            '   #T.....A.....T#   ',
            '   #.............#   ',
            '   ###.##...##.###   ',
            '     #C#.....#C#     ',
            '     #M#..M..#.#     ',
            '     #.........#     ',
            '     ##...E...##     ',
            '       #######       ',
        ],
    },
    // ---- Aquatica.
    {
        id: 'cathedral', name: 'The Drowned Cathedral', land: 'water', theme: 'drowned', level: 8, entrance: { site: 'cathedral' }, sites: { cathedral: 'A' },
        rows: [
            '      ###############      ',
            '     #~~.....l.....~~#     ',
            '    #~~...p.....p...~~#    ',
            '    #~...............~#    ',
            '    #...p....A....p...#    ',
            '    #.................#    ',
            '    #~..p.........p..~#    ',
            '    #~~.....M.M.....~~#    ',
            '    #~~..p.......p..~~#    ',
            '     ##~.....,.....~##     ',
            '       ##....E....##       ',
            '         #########         ',
        ],
    },
    {
        id: 'boilers', name: 'The Boiler Halls', land: 'water', theme: 'drowned', level: 8, entrance: { site: 'boiler1' }, sites: { boiler1: 'A' },
        rows: [
            '    ###########    ',
            '   #K..x...x..K#   ',
            '   #...........#   ',
            '   #T....A....T#   ',
            '   #.....,.....#   ',
            '   #~~..M...~~.#   ',
            '   ##~~.....~~##   ',
            '     ##..E..##     ',
            '       #####       ',
        ],
    },
    {
        id: 'aconserv', name: 'The Frozen Conservatory', land: 'water', theme: 'ice', level: 9, entrance: { site: 'conservatory' }, sites: { conservatory: 'A' },
        rows: [
            '     ###########     ',
            '    #c...c...c..#    ',
            '   #..,.......,..#   ',
            '   #c.....A.....c#   ',
            '   #.............#   ',
            '   #..s...M...s..#   ',
            '    ##.........##    ',
            '      ###.E.###      ',
            '        #####        ',
        ],
    },
    // ---- The Void Wastes.
    {
        id: 'vault', name: 'The Reliquary Vault', land: 'earth', theme: 'void', level: 11, entrance: { site: 'vault' }, sites: { vault: 'A' },
        rows: [
            '     #############     ',
            '    #C.o.......o.C#    ',
            '    #.............#    ',
            '    #T.....A.....T#    ',
            '    #..p.......p..#    ',
            '    #.....M.M.....#    ',
            '    ##o.........o##    ',
            '      ###..E..###      ',
            '         #####         ',
        ],
    },
    {
        id: 'undercroft', name: 'The Bell Undercroft', land: 'earth', theme: 'crypt', level: 11, entrance: { site: 'bell' }, sites: { bell: 'A' },
        rows: [
            '     ###########     ',
            '    #n..p...p..n#    ',
            '    #...........#    ',
            '    #T....A....T#    ',
            '    #...........#    ',
            '    #b...M.M...b#    ',
            '    ##.........##    ',
            '      ##..E..##      ',
            '        #####        ',
        ],
    },
    {
        id: 'vconserv', name: 'The Star Conservatory', land: 'earth', theme: 'void', level: 12, entrance: { site: 'conservatory' }, sites: { conservatory: 'A' },
        rows: [
            '     ###########     ',
            '    #c...o...o..c#   ',
            '    #............#   ',
            '    #T....A.....T#   ',
            '    #............#   ',
            '    #..M......M..#   ',
            '    ##....E.....##   ',
            '      ##########     ',
        ],
    },
];

// ------------------------------------------------------------------ the side caves, grown from a seed

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

/** A winding cave: cellular automaton rock, kept to the one big open pocket, the door at its south end. */
function growCave(seed: number, w: number, h: number, extra: { chests: number; foes: number; crystals: number; pools: number }): string[] {
    const rand = rng(seed);
    let g: boolean[][] = Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => i > 1 && j > 1 && i < w - 2 && j < h - 2 && rand() < 0.56));
    for (let pass = 0; pass < 5; pass++) {
        g = g.map((row, j) => row.map((_, i) => {
            if (i < 2 || j < 2 || i > w - 3 || j > h - 3) return false;
            let n = 0;
            for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && g[j + dj][i + di]) n++;
            return n >= 5 || (g[j][i] && n >= 4);
        }));
    }
    // Keep the largest connected pocket.
    const seen: number[][] = g.map((r) => r.map(() => 0));
    let best: [number, number][] = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        if (!g[j][i] || seen[j][i]) continue;
        const q: [number, number][] = [[i, j]];
        seen[j][i] = 1;
        for (let k = 0; k < q.length; k++) {
            const [x, y] = q[k];
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy;
                if (g[ny]?.[nx] && !seen[ny][nx]) { seen[ny][nx] = 1; q.push([nx, ny]); }
            }
        }
        if (q.length > best.length) best = q;
    }
    const keep = new Set(best.map(([x, y]) => y * w + x));
    const out: string[][] = Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => (keep.has(j * w + i) ? '.' : ' ')));
    // The way out: the floor cell farthest down the map.
    const floor = best.slice().sort((a, b) => b[1] + b[0] * 0.01 - (a[1] + a[0] * 0.01));
    const [ex, ey] = floor[0];
    out[ey][ex] = 'E';
    // Things, spread over the floor (never next to the door).
    const free = best.filter(([x, y]) => Math.hypot(x - ex, y - ey) > 4);
    const take = (ch: string, n: number, wallSide = false) => {
        for (let k = 0, tries = 0; k < n && tries < 400; tries++) {
            const [x, y] = free[Math.floor(rand() * free.length)];
            if (out[y][x] !== '.') continue;
            const walls = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => out[y + dy]?.[x + dx] === ' ').length;
            if (wallSide && walls === 0) continue;
            if (!wallSide && walls > 1) continue;
            out[y][x] = ch;
            k++;
        }
    };
    for (let p = 0; p < extra.pools; p++) {
        const [x, y] = free[Math.floor(rand() * free.length)];
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (out[y + dj]?.[x + di] === '.' && rand() < 0.75 && Math.hypot(x + di - ex, y + dj - ey) > 5) out[y + dj][x + di] = '~';
    }
    take('C', extra.chests, true);
    take('c', extra.crystals, true);
    take('T', 3 + Math.floor(w / 10), true);
    take('m', 4, true);
    take('s', 5, true);
    take('r', 4);
    take(',', 14);
    take('b', 3);
    take('M', extra.foes);
    // Pools must not cut the cave in two: whatever cannot be walked to from the door is rock.
    const reach = new Set<number>([ey * w + ex]);
    const q: [number, number][] = [[ex, ey]];
    for (let k = 0; k < q.length; k++) {
        const [x, y] = q[k];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            const ch = out[ny]?.[nx];
            if (!ch || ch === ' ' || ch === '~' || reach.has(ny * w + nx)) continue;
            reach.add(ny * w + nx);
            // (a crystal, a rock or a torch stops you: what lies only beyond one is cut off too)
            if (!'csrTC'.includes(ch)) q.push([nx, ny]);
        }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (out[y][x] !== ' ' && out[y][x] !== '~' && !reach.has(y * w + x)) out[y][x] = ' ';
    return out.map((r) => r.join(''));
}

const SIDE: InteriorDef[] = [
    { id: 'cinderhollow', name: 'Cinder Hollow', land: 'fire', theme: 'ash', level: 2, entrance: { at: [84, -14] }, rows: growCave(11, 30, 22, { chests: 3, foes: 4, crystals: 6, pools: 2 }) },
    { id: 'magmavein', name: 'The Magma Vein', land: 'fire', theme: 'grotto', level: 4, entrance: { at: [160, 24] }, rows: growCave(23, 34, 24, { chests: 4, foes: 6, crystals: 8, pools: 3 }) },
    { id: 'galecave', name: 'The Gale Gullet', land: 'air', theme: 'sky', level: 5, entrance: { at: [84, -14] }, rows: growCave(37, 30, 22, { chests: 3, foes: 4, crystals: 6, pools: 1 }) },
    { id: 'stormcrypt', name: 'Stormwell Crypt', land: 'air', theme: 'crypt', level: 7, entrance: { at: [160, 24] }, rows: growCave(41, 34, 24, { chests: 4, foes: 6, crystals: 5, pools: 0 }) },
    { id: 'tidecave', name: 'Tidewater Grotto', land: 'water', theme: 'ice', level: 8, entrance: { at: [84, -14] }, rows: growCave(53, 30, 22, { chests: 3, foes: 4, crystals: 7, pools: 4 }) },
    { id: 'abyssgrotto', name: 'The Abyssal Shelf', land: 'water', theme: 'drowned', level: 10, entrance: { at: [160, 24] }, rows: growCave(67, 34, 24, { chests: 4, foes: 6, crystals: 6, pools: 4 }) },
    { id: 'saltmine', name: 'The Old Salt Mine', land: 'earth', theme: 'void', level: 11, entrance: { at: [84, -14] }, rows: growCave(71, 30, 22, { chests: 3, foes: 5, crystals: 8, pools: 0 }) },
    { id: 'hollowdeep', name: 'The Hollow Deep', land: 'earth', theme: 'void', level: 13, entrance: { at: [160, 24] }, rows: growCave(83, 34, 24, { chests: 4, foes: 7, crystals: 9, pools: 1 }) },
];

export const INTERIORS: InteriorDef[] = [...DEFS, ...SIDE];

// ------------------------------------------------------------------ where each one is laid in the grid

export interface Placed {
    def: InteriorDef;
    /** Its index + 1 in map.place. */
    n: number;
    i0: number;
    j0: number;
    w: number;
    h: number;
}

/** Every interior's spot in the strip beyond the continent (a shelf packing; pure, so anyone can ask). */
export const PLACED: Placed[] = (() => {
    const out: Placed[] = [];
    let x = 6, y = WORLD_TILES + 8, shelf = 0;
    INTERIORS.forEach((def, k) => {
        const w = Math.max(...def.rows.map((r) => r.length)) + 2;
        const h = def.rows.length + 2;
        if (x + w > MAP_TILES - 6) { x = 6; y += shelf + 6; shelf = 0; }
        out.push({ def, n: k + 1, i0: x, j0: y, w, h });
        x += w + 6;
        shelf = Math.max(shelf, h);
    });
    return out;
})();

export const placedOf = (n: number): Placed | null => PLACED[n - 1] ?? null;

/** The character at a cell of an interior's map (space outside it). */
export function charAt(p: Placed, i: number, j: number): string {
    const r = p.def.rows[j - p.j0 - 1];
    return r?.[i - p.i0 - 1] ?? ' ';
}

/** Where a story site sits when it is inside: { land: { site: centre } }. */
export const INTERIOR_SITES: Partial<Record<Element, Record<string, { u: number; v: number; n: number }>>> = (() => {
    const out: Partial<Record<Element, Record<string, { u: number; v: number; n: number }>>> = {};
    for (const p of PLACED) {
        for (const [site, ch] of Object.entries(p.def.sites ?? {})) {
            p.def.rows.forEach((r, j) => {
                const i = r.indexOf(ch);
                if (i >= 0) (out[p.def.land] ??= {})[site] = { u: p.i0 + 1 + i + 0.5, v: p.j0 + 1 + j + 0.5, n: p.n };
            });
        }
    }
    return out;
})();

/** The overworld cell of an interior's front door (its mouth or gate). */
export function entranceCell(def: InteriorDef): { i: number; j: number } | null {
    const e = def.entrance;
    if (!e) return null;
    const at = 'site' in e ? STORY_SITES_BY[def.land][e.site] : e.at;
    if (!at) return null;
    // (a story site that moved inside leaves its flat ground on the overworld for the door)
    return spot(def.land, at[0], at[1]);
}
