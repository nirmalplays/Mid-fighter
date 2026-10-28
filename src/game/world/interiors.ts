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
^ *   'o' boulder   'b' bones   'n' candle    'C' chest   'M' foes wait here
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
            '     ######',
            '   ###....##',
            '  ##.....c.#',
            ' ##c......c#',
            '##c........#',
            '#cT........#     ##############',
            '#.........r# #####T..........T####',
            '#....M.....###.........M.........###',
            '##........k#.x....................k###',
            ' ##.........x..=================..r..##',
            '  ###..........=...............=......#',
            '    ##.........=.....,.........=......##',
            '     ##........=...............=.......#',
            '      ##.......=..............K=.......#',
            '       #.T.....=...............=......##',
            '       ##......=...............=....T.#',
            '        ##.....=...............=.....###',
            '         #.r...=..........,....=.....#.##',
            '         ##k...=...............=........##',
            '          ##...========================..#',
            '           ##..........=............k.=.##',
            '            ##.........=.........####.=.#',
            '             ###...r...=.......###  #.=.#',
            '               ####T...=..T#####    #.=.#',
            '                  #....=...#        #.=.####',
            '                  #....=...#       ##.=.T..##',
            '                ###....=...##     ##..=....r##',
            '             ####..l...=....#######...=......##',
            '            ##k........=...l...k##.k.........k#',
            '           ##..........=........##............#',
            '           #...........=........###......H....#',
            '           #..........K=.........##...M.......#',
            '           #...........=.........###........T.#',
            '           ##..........=.........# #####.....##',
            '            ##k................k.#     #######',
            '             #.xx............xx.##',
            '             #######......#######',
            '                   ##.E.###',
            '                    #####',
        ],
    },
    {
        id: 'dig2', name: 'Deep-Strata Dig · The Sealed Chamber', land: 'fire', theme: 'ash', level: 1, up: 'dig1', sites: { quarry: 'A' },
        rows: [
            '       ########',
            '     ###...T..###',
            '    ##..........###',
            '   ##c...........c###',
            '  ##c..............c##',
            ' ##.................T##',
            ' #T...................#',
            '##....................#',
            '#.....................#',
            '#s...................s#',
            '#s.........A..........#',
            '#.....................#',
            '##....................#',
            ' #....................##',
            ' #T..................T.#########',
            ' ##...,.........,..........T...####',
            '  #............................T..##',
            '  ##s............s###.............c##',
            '   ##...........####...............c##',
            '    ###......#### ##.................#',
            '      ########    #.~~~~~~~^^^^~~~~~~#',
            '                  ##~~~~~~~^^^^~~~~~~#',
            '                   ##................#',
            '                    ##sr............##',
            '                     ###..T.....T.c##',
            '                       ###.......###',
            '                         ####...##',
            '                            #...#',
            '                            #...#',
            '                          ###...##',
            '                         ##......##',
            '                        ##........##',
            '                        #T........T##',
            '                        #...........##',
            '                        #............#',
            '                        #r.........r.#',
            '                        ##..........##',
            '                         ###......###',
            '                           ##.L.###',
            '                            #####',
        ],
    },
    {
        id: 'catacombs', name: 'The Whispering Catacombs', land: 'fire', theme: 'crypt', level: 2, entrance: { site: 'catacombs' }, sites: { catacombs: 'A' },
        rows: [
            '              #############',
            '              #...n...n...#',
            '              #.p.......p.#',
            '              #....b......#',
            '              #n.........n#',
            '              #...........#',
            '              #.p.......p.#',
            '              #...........#',
            '             #######.#######',
            '             #.n.........n.#',
            '             #......A......#',
            '          ####T...........T####',
            '          #b.................b#',
            '          #...................#',
            '          #..b...p.....p...b..#',
            '##############.............##############',
            '#.b..T.....# #......M....,.# #.....T....#',
            '#..........# #.............# #..........#',
            '#..M.......###...p.....p...###..........#',
            '#...p..p.........................p..p...#',
            '#..............,........................#',
            '#C.....................................C#',
            '#..........###...p.....p...###..........#',
            '#...p..p...# #.............# #...p..p...#',
            '#..........# #......M......# #.......M..#',
            '#..........# #.............# #b.........#',
            '#....T....b# #...p.....p...# #.....T..b.#',
            '############ #.............# ############',
            '             #.............#',
            '             #T...........T#',
            '          ####.............####',
            '          #n..T...........T..n#',
            '          #...................#',
            '          #...................#',
            '          #...................#',
            '          #...................#',
            '          #..n.............n..#',
            '          ########..E..########',
            '                 #######',
        ],
    },
    {
        id: 'cellar', name: "Bram's Cellar", land: 'fire', theme: 'cellar', level: 2, entrance: { site: 'cellar' }, sites: { cellar: 'A' },
        rows: [
            '  ##################',
            '  #xx..l......l..xx#',
            '  #x...............#',
            '  #............M...#',
            '  #.....,....,.....#',
            '  #.......A........#',
            '  #l..............l#',
            '  #................#',
            '  #................#',
            '  #................#',
            '  #...k........k.xx#',
            '  #####........#####',
            '#######........#######',
            '#xx................xx#',
            '#x...................#',
            '#....................#',
            '#l..................l#',
            '#....................#',
            '#....b...............#',
            '#x..................x#',
            '########..E..#########',
            '       #######',
        ],
    },
    {
        // The Molten Archive: the Sanctum (its Word-Lock) and its two scriptoria, where the tablets are being melted down.
        id: 'archive', name: 'The Molten Archive', land: 'fire', theme: 'archive', level: 3, entrance: { site: 'library' }, sites: { library: 'A', scriptW: 'W', scriptE: 'Y' },
        rows: [
            '                   #########################',
            '                   #.B.B.B.B.B.B.B.B.B.B.B.#',
            '                   #.......................#',
            '                   #T....M...n...n........T#',
            '                   #.......................#',
            '#################  #...p...............p...#  #################',
            '#.B.B.B.B.B.B.B.#  #.......................#  #.B.B.B.B.B.B.B.#',
            '#...............#  #.......................#  #...............#',
            '#T.............T####.......................####T.............T#',
            '#...M......,........p.....................p...............M...#',
            '#.............................................................#',
            '#........................n.....A.....n........................#',
            '#.......W.............................................Y.......#',
            '#.............................................................#',
            '#...................p.....................p...................#',
            '#.....,.........####.......................####...............#',
            '#T.............T#  #.......................#  #T.............T#',
            '#.C.............#  #...p...............p...#  #.............C.#',
            '#...............#  #.......................#  #...............#',
            '#################  #.......................#  #################',
            '                   #T.....................T#',
            '                   #.......................#',
            '                   ########.........########',
            '                          #B.......B#',
            '                          #T.......T#',
            '                          #B.......B#',
            '                          #.........#',
            '                          #B.......B#',
            '                          #T.......T#',
            '                          #B.......B#',
            '                          #.........#',
            '                          #.........#',
            '                          ###..E..###',
            '                            #######',
        ],
    },
    {
        id: 'grotto', name: 'The Ember Grotto', land: 'fire', theme: 'grotto', level: 2, entrance: { site: 'grotto' }, sites: { grotto: 'A' },
        rows: [
            '         ########',
            '       ###......###',
            '     ###c........s##',
            '    ##sc..........m###',
            '  ###..............m.##',
            ' ##.............,...MT#',
            '##m..................~##',
            '#ms.................~~~#',
            '#m..........A........~~#',
            '#T....................c#',
            '#~~~~~................c#',
            '#~~~~~................s#',
            '##~~~~~..,............m#',
            ' #~~~~................m#',
            ' ##~~~.................#',
            '  #r..................##',
            '  ##.T..............r.#',
            '   ###.............T.##',
            '     ###............##',
            '       ####...#######',
            '          #...#',
            '         ##...##',
            '       ###.....###',
            '      ##T.......T##',
            '      #..m........#',
            '      #........m..#',
            '      ##.........##',
            '       ###.....###',
            '         ##.E.##',
            '          #####',
        ],
    },
    // ---- Zephyria.
    {
        id: 'workshop', name: "Vael's Childhood Workshop", land: 'air', theme: 'sky', level: 5, entrance: { site: 'workshop' }, sites: { workshop: 'A' },
        rows: [
            '########################',
            '#xB.B.B.k.....k.B.B.B.x# ########',
            '#......................# #xx...x#',
            '#......................# #......#',
            '#T...............,....T# #......#',
            '#......................###...M..#',
            '#..........A..............l.....#',
            '#k.............................l#',
            '#......................###......#',
            '#....,............M....# #......#',
            '#T....................k# #......#',
            '#......................# #....xx#',
            '#......................# ########',
            '#######T........T#######',
            '      #..........#',
            '      #..........#',
            '      #x........x#',
            '      ####.E..####',
            '         ######',
        ],
    },
    {
        id: 'postvault', name: 'The Wind-Post Vault', land: 'air', theme: 'sky', level: 6, entrance: { site: 'postvault' }, sites: { postvault: 'A' },
        rows: [
            '  ##########################',
            '  #xB.B.B.B.B...B.B.B.B.B.x#',
            '  #........................#',
            '  #........................#',
            '  #...................,....#',
            '  #T......................T#',
            '  #...........A............#',
            '  #........................#',
            '  #....,...................#',
            '  #........................#',
            '  #T......................T#',
            '  #........................#',
            '  #######............#######',
            '        #............#',
            '#########............#########',
            '#x.....##T..........T##.....x#',
            '#......##............##......#',
            '#...M........................#',
            '#l..........................l#',
            '#......##............##..M...#',
            '#......##............##......#',
            '#C.....##x..........x##.....C#',
            '############......############',
            '           ##.E.###',
            '            #####',
        ],
    },
    // ---- Aquatica.
    {
        id: 'cathedral', name: 'The Drowned Cathedral', land: 'water', theme: 'drowned', level: 8, entrance: { site: 'cathedral' }, sites: { cathedral: 'A' },
        rows: [
            '               ###',
            '           #####.#####',
            '         ###....l....###',
            '        ##.............##',
            '      ###...............###',
            '      #...................#',
            '      #...................#',
            '      #...................#',
            '      #...p.....A.....p...#',
            '      #...................#',
            '      #~~...............~~#',
            '      #~~...............~~#',
            '      #~~...............~~#',
            '      #~~...p.......p...~~#',
            '#######~~...............~~#######',
            '#cc...TT.................TT.....#',
            '#c..............................#',
            '#...............................#',
            '#...............................#',
            '#............M.....,...........c#',
            '#......T.................T....cc#',
            '#######~~...............~~#######',
            '      #~~...............~~#',
            '      #~~...p.......p...~~#',
            '      #~~...............~~#',
            '      #~~...............~~#',
            '      #~~.....,....M....~~#',
            '      #~~...p.......p...~~#',
            '      #~~...............~~#',
            '      #~~...............~~#',
            '      #~~...............~~#',
            '      #~~...p.......p...~~#',
            '      #...................#',
            '      #..l.............l..#',
            '      #####...........#####',
            '          #...........#',
            '          ####..E..####',
            '             #######',
        ],
    },
    {
        id: 'boilers', name: 'The Boiler Halls', land: 'water', theme: 'drowned', level: 8, entrance: { site: 'boiler1' }, sites: { boiler1: 'A' },
        rows: [
            '##############################',
            '#.K...K..l.........l...K...K.#',
            '#............................#',
            '#............................#',
            '#T..........................T#',
            '#....M........A..............#',
            '#......,.....................#',
            '#....................,.......#',
            '#T..........................T#',
            '#............................#',
            '#~~~~~~~~~~~^^^^^~~~~~~~~~~~~#',
            '#~~~~~~~~~~~^^^^^~~~~~~~~~~~~#',
            '#x...........................#',
            '#T..........................T#',
            '#............................#',
            '#......................M.....#',
            '#............................#',
            '#...........................x#',
            '#xx.........................x#',
            '###########T.....T############',
            '          #.......#',
            '          ##..E..##',
            '           #######',
        ],
    },
    {
        id: 'aconserv', name: 'The Frozen Conservatory', land: 'water', theme: 'ice', level: 9, entrance: { site: 'conservatory' }, sites: { conservatory: 'A' },
        rows: [
            '       ##############',
            '     ###.c.......c.T###',
            '   ###.T.............c###',
            '  ##c..................c##',
            ' ##c.............,.......#',
            ' #.......................##',
            '##...M....................#',
            '#............A.......M....#',
            '#.........................#',
            '#c.......................c#',
            '#c.......................c#',
            '#...~~~~.,.........~~~~...#',
            '#...~~~~...........~~~~..##',
            '##s.~~~~...........~~~~s##',
            ' ##....................##',
            '  ##..................##',
            '   ###s.............s##',
            '     ###...........###',
            '       ###T.....T###',
            '         #.......#',
            '         #.......#',
            '         #.......#',
            '         ##..E..##',
            '          #######',
        ],
    },
    // ---- The Void Wastes.
    {
        id: 'vault', name: 'The Reliquary Vault', land: 'earth', theme: 'void', level: 11, entrance: { site: 'vault' }, sites: { vault: 'A' },
        rows: [
            '    ##########################',
            '    #.......cc.......cc......#',
            '    #T......................T#',
            '    #........................#',
            '    #....o...............o...#',
            '#####........................#####',
            '#.T....M.........................#',
            '#C...............A........,......#',
            '#......,........................C#',
            '#..............................T.#',
            '#####.....................M..#####',
            '    #....o...............o...#',
            '    #........................#',
            '    #T......................T#',
            '    #........................#',
            '    ##########o.....o#########',
            '             #.......#',
            '             #.......#',
            '             #.......#',
            '             #o.....o#',
            '             #.......#',
            '             ##..E..##',
            '              #######',
        ],
    },
    {
        id: 'undercroft', name: 'The Bell Undercroft', land: 'earth', theme: 'crypt', level: 11, entrance: { site: 'bell' }, sites: { bell: 'A' },
        rows: [
            '###########################',
            '#n.......................n#',
            '#..M.......n...n.......b..#',
            '#.........................#',
            '#....p...p.......p...p....#',
            '#T.......................T#',
            '#.........................#',
            '#.b................,......#',
            '#......,.....A............#',
            '#.......................b.#',
            '#T.......................T#',
            '#.........................#',
            '#....p...p.......p...p....#',
            '#.........................#',
            '#..b...................M..#',
            '#n.......................n#',
            '#########T.......T#########',
            '        #.........#',
            '        #.........#',
            '        #.........#',
            '        ###..E..###',
            '          #######',
        ],
    },
    {
        id: 'vconserv', name: 'The Star Conservatory', land: 'earth', theme: 'void', level: 12, entrance: { site: 'conservatory' }, sites: { conservatory: 'A' },
        rows: [
            '         #########',
            '      ####...T...####',
            '    ###.............###',
            '   ##.................##',
            '  ##c.....o.....o.....c##',
            '  #c...................c#',
            ' ##...............,.....##',
            ' #....o.............o....#',
            ' #..M....................#',
            '##...........A...........##',
            '#T.......................T#',
            '##.......................##',
            ' #....o.............o....#',
            ' #.......,............M..#',
            ' ##.....................##',
            '  #.....................#',
            '  ##...................##',
            '   ##.................##',
            '    ###.............###',
            '      ####.......####',
            '         #T.....T#',
            '         #.......#',
            '         #.......#',
            '         ##..E..##',
            '          #######',
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

/** What the biggest chamber of a grown cave is built around. */
type SetPiece = 'lava' | 'lake' | 'crystals' | 'temple';
const SET_PIECE: Record<Theme, SetPiece> = { ash: 'lava', grotto: 'lava', crypt: 'temple', cellar: 'temple', archive: 'temple', sky: 'temple', ice: 'lake', drowned: 'lake', void: 'crystals' };

interface Chamber {
    x: number;
    y: number;
    rx: number;
    ry: number;
}

const STEPS4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** Map letters that stand on their cell (you walk round them). */
const STANDS = 'TlcsrxkKpPBoC';

/**
 * A cavern that breathes: a few big chambers joined by tunnels never narrower than three tiles, with
 * one set-piece chamber right past the entrance (a lava river and its bridge, an underground lake, a
 * crystal hall or a fallen temple, by theme), side alcoves holding the chests, and its things grouped
 * against the walls (crystals in clusters, stalagmites at the edges) so the middle of every chamber
 * stays open to fight in. The way out is at its south end.
 */
function growCave(seed: number, w: number, h: number, theme: Theme, extra: { chests: number; foes: number; crystals: number }): string[] {
    const rand = rng(seed);
    const between = (a: number, b: number) => a + rand() * (b - a);
    const g: string[][] = Array.from({ length: h }, () => Array<string>(w).fill(' '));
    const inside = (x: number, y: number) => x >= 2 && y >= 2 && x < w - 2 && y < h - 2;
    const get = (x: number, y: number) => (y >= 0 && y < h && x >= 0 && x < w ? g[y][x] : ' ');
    const isFloor = (x: number, y: number) => { const ch = get(x, y); return ch !== ' ' && ch !== '~'; };
    const walk = (x: number, y: number) => isFloor(x, y) && !STANDS.includes(get(x, y));
    const dig = (x: number, y: number) => { if (inside(x, y) && g[y][x] === ' ') g[y][x] = '.'; };
    const disc = (cx: number, cy: number, r: number, fn = dig) => {
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) fn(x, y);
    };
    const line = (x0: number, y0: number, x1: number, y1: number, r: number, fn = dig) => {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
        for (let s = 0; s <= n; s++) disc(x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n, r, fn);
    };
    /** A chamber: an ellipse with a wobbly rim. */
    const carve = (c: Chamber) => {
        const ph = [between(0, 6.3), between(0, 6.3), between(0, 6.3)];
        for (let y = Math.floor(c.y - c.ry - 2); y <= c.y + c.ry + 2; y++) {
            for (let x = Math.floor(c.x - c.rx - 2); x <= c.x + c.rx + 2; x++) {
                const dx = (x - c.x) / c.rx, dy = (y - c.y) / c.ry;
                const a = Math.atan2(dy, dx);
                const rim = 1 + 0.09 * Math.sin(2 * a + ph[0]) + 0.06 * Math.sin(3 * a + ph[1]) + 0.05 * Math.sin(5 * a + ph[2]);
                if (dx * dx + dy * dy <= rim * rim) dig(x, y);
            }
        }
    };
    /** A tunnel between two chambers: a gently bending line of discs, three or four tiles wide. */
    const tunnel = (a: Chamber, b: Chamber, r: number) => {
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
        const bend = between(-0.2, 0.2) * len;
        const pts: [number, number][] = [];
        for (let k = 0; k <= 4; k++) {
            const t = k / 4;
            const off = Math.sin(t * Math.PI) * bend + (k > 0 && k < 4 ? between(-1, 1) : 0);
            pts.push([a.x + (b.x - a.x) * t + nx * off, a.y + (b.y - a.y) * t + ny * off]);
        }
        for (let k = 0; k < 4; k++) line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], r);
    };

    // ---- The chambers: the entry at the south, the set piece just north of it, the rest wherever they fit.
    const entry: Chamber = { x: w / 2 + between(-0.1, 0.1) * w, y: h - 7, rx: between(5, 6), ry: 3.6 };
    const big: Chamber = { x: w / 2 + between(-0.08, 0.08) * w, y: 0, rx: between(9, 10.5), ry: between(6.5, 7.5) };
    big.y = entry.y - entry.ry - big.ry - between(3, 4.5);
    const rooms: Chamber[] = [entry, big];
    const want = w >= 58 ? 4 : 3;
    for (let tries = 0; rooms.length < 2 + want && tries < 600; tries++) {
        const c: Chamber = { x: between(8, w - 8), y: between(7, h - 7), rx: between(5, 7.5), ry: between(4, 5.5) };
        if (c.x - c.rx < 3 || c.x + c.rx > w - 4 || c.y - c.ry < 3 || c.y + c.ry > h - 4) continue;
        if (rooms.some((o) => Math.abs(c.x - o.x) < c.rx + o.rx + 2 && Math.abs(c.y - o.y) < c.ry + o.ry + 1.5)) continue;
        rooms.push(c);
    }
    rooms.forEach(carve);
    // Tunnels: the entry opens wide onto the set piece, then a spanning tree (and one loop) joins the rest.
    tunnel(entry, big, 2.2);
    const joined = new Set([0, 1]);
    const edges: [number, number][] = [];
    while (joined.size < rooms.length) {
        let best: [number, number] | null = null;
        let bd = Infinity;
        for (const a of joined) for (let b = 0; b < rooms.length; b++) {
            if (joined.has(b)) continue;
            const d = Math.hypot(rooms[a].x - rooms[b].x, rooms[a].y - rooms[b].y);
            if (d < bd) { bd = d; best = [a, b]; }
        }
        if (!best) break;
        joined.add(best[1]);
        edges.push(best);
    }
    for (const [a, b] of edges) tunnel(rooms[a], rooms[b], between(1.6, 2.1));
    if (rooms.length >= 5) {
        // One loop, so a chase can go round.
        let best: [number, number] | null = null;
        let bd = Infinity;
        for (let a = 2; a < rooms.length; a++) for (let b = a + 1; b < rooms.length; b++) {
            if (edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) continue;
            const d = Math.hypot(rooms[a].x - rooms[b].x, rooms[a].y - rooms[b].y);
            if (d < bd) { bd = d; best = [a, b]; }
        }
        if (best && bd < w * 0.6) tunnel(rooms[best[0]], rooms[best[1]], 1.6);
    }
    // Round off the rock: a pocket mostly surrounded by floor becomes floor (floor is never taken away).
    for (let pass = 0; pass < 2; pass++) {
        const add: [number, number][] = [];
        for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
            if (g[y][x] !== ' ') continue;
            let n = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && g[y + dy][x + dx] === '.') n++;
            if (n >= 5) add.push([x, y]);
        }
        for (const [x, y] of add) g[y][x] = '.';
    }

    // ---- The way out: the lowest floor below the entry chamber.
    let ex = Math.round(entry.x), ey = 0;
    for (let y = h - 1; y >= 0 && !ey; y--) for (let dx = 0; dx <= 3 && !ey; dx++) for (const x of [Math.round(entry.x) - dx, Math.round(entry.x) + dx]) if (get(x, y) === '.' && !ey) { ex = x; ey = y; }
    g[ey][ex] = 'E';
    const nearDoor = (x: number, y: number, r: number) => Math.hypot(x - ex, y - ey) < r;

    // ---- Side alcoves for the chests: a short stub off a chamber's wall into a pocket of its own.
    const chests: [number, number][] = [];
    /** The alcoves' cells: nothing stands in them but the chest. */
    const nook = new Set<number>();
    for (let k = 0, tries = 0; k < extra.chests && tries < 200; tries++) {
        const c = rooms[2 + Math.floor(rand() * (rooms.length - 2))] ?? big;
        const a = rand() * Math.PI * 2;
        const dx = Math.cos(a), dy = Math.sin(a);
        let t = 0;
        while (isFloor(Math.round(c.x + dx * t), Math.round(c.y + dy * t)) && t < 30) t += 0.5;
        const rimX = c.x + dx * t, rimY = c.y + dy * t;
        const qx = rimX + dx * 2.6, qy = rimY + dy * 2.6;
        if (!inside(Math.round(qx + dx * 2), Math.round(qy + dy * 2)) || !inside(Math.round(qx - dy * 2), Math.round(qy + dx * 2)) || !inside(Math.round(qx + dy * 2), Math.round(qy - dx * 2))) continue;
        // The pocket must not break into anything else.
        let clear = true;
        disc(qx + dx * 0.8, qy + dy * 0.8, 2.8, (x, y) => { if (get(x, y) !== ' ' && Math.hypot(x - rimX, y - rimY) > 1.6) clear = false; });
        if (!clear || nearDoor(qx, qy, 8)) continue;
        const mark = (x: number, y: number) => { dig(x, y); nook.add(y * w + x); };
        line(rimX - dx * 2, rimY - dy * 2, qx, qy, 1.5, mark);
        disc(qx, qy, 1.7, mark);
        const cx = Math.round(qx + dx * 1.2), cy = Math.round(qy + dy * 1.2);
        if (get(cx, cy) !== '.') continue;
        g[cy][cx] = 'C';
        chests.push([cx, cy]);
        k++;
    }

    // ---- The set piece.
    const piece = SET_PIECE[theme];
    const inBig = (x: number, y: number, k = 1) => ((x - big.x) / big.rx) ** 2 + ((y - big.y) / big.ry) ** 2 <= k * k;
    const bx = Math.round(big.x), by = Math.round(big.y);
    if (piece === 'lava') {
        // A river of lava across the chamber, a stone bridge over it.
        const ph = between(0, 6.3);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (g[y][x] !== '.' || !inBig(x, y, 1.15)) continue;
            const yr = big.y - 1.5 + 1.2 * Math.sin((x - big.x) / 3.2 + ph);
            if (Math.abs(y - yr) < 1.1) g[y][x] = Math.abs(x - bx) <= 1 ? '^' : '~';
        }
    } else if (piece === 'lake') {
        // A lake against the chamber's back wall, the near shore left open.
        const lx = big.x + between(-1.5, 1.5), ly = big.y - big.ry * 0.35, lrx = big.rx - 3, lry = big.ry * 0.5;
        const ph = between(0, 6.3);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (g[y][x] !== '.') continue;
            const dx = (x - lx) / lrx, dy = (y - ly) / lry;
            const a = Math.atan2(dy, dx);
            if (dx * dx + dy * dy <= (1 + 0.12 * Math.sin(3 * a + ph)) ** 2) g[y][x] = '~';
        }
    } else if (piece === 'temple') {
        // A fallen temple: a colonnade (some pillars down), a raised dais at the far end with its candles.
        const off = Math.round(big.rx * 0.5);
        for (let y = Math.round(big.y - big.ry * 0.55); y <= big.y + big.ry * 0.6; y += 3) {
            for (const x of [bx - off, bx + off]) {
                if (g[y]?.[x] !== '.') continue;
                g[y][x] = rand() < 0.3 ? 'P' : 'p';
                if (g[y][x] === 'P') for (const [dx, dy] of STEPS4) if (rand() < 0.2 && get(x + dx, y + dy) === '.') g[y + dy][x + dx] = ',';
            }
        }
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] === '.' && inBig(x, y) && y < big.y - big.ry * 0.5 && Math.abs(x - bx) <= 3) g[y][x] = '^';
        for (const x of [bx - 2, bx + 2]) {
            let y = by;
            while (y > 0 && get(x, y - 1) !== ' ') y--;
            if (get(x, y) === '^' || get(x, y) === '.') g[y][x] = 'n';
        }
    }
    // No slivers of shore: a strip of floor too thin to stand a fight in, beside the water, goes under.
    for (let pass = 0; pass < 2; pass++) {
        const sink: [number, number][] = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (g[y][x] !== '.') continue;
            let wet = false;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (get(x + dx, y + dy) === '~') wet = true;
            if (!wet) continue;
            let roomy = false;
            for (let oy = -2; oy <= 0 && !roomy; oy++) for (let ox = -2; ox <= 0 && !roomy; ox++) {
                let ok = true;
                for (let b = 0; b < 3 && ok; b++) for (let a = 0; a < 3 && ok; a++) if (!isFloor(x + ox + a, y + oy + b)) ok = false;
                roomy = ok;
            }
            if (!roomy) sink.push([x, y]);
        }
        for (const [x, y] of sink) g[y][x] = '~';
    }
    // Whatever water (or a chest pocket) cut off gets a causeway to it.
    for (let round = 0; round < 6; round++) {
        const reach = new Set<number>([ey * w + ex]);
        const q: [number, number][] = [[ex, ey]];
        for (let k = 0; k < q.length; k++) {
            const [x, y] = q[k];
            for (const [dx, dy] of STEPS4) {
                const nx = x + dx, ny = y + dy;
                if (!isFloor(nx, ny) || reach.has(ny * w + nx)) continue;
                reach.add(ny * w + nx);
                if (walk(nx, ny)) q.push([nx, ny]);
            }
        }
        let lost: [number, number] | null = null;
        for (let y = 0; y < h && !lost; y++) for (let x = 0; x < w && !lost; x++) if (walk(x, y) && !reach.has(y * w + x)) lost = [x, y];
        if (!lost) break;
        let near: [number, number] = [ex, ey];
        let nd = Infinity;
        for (const k of reach) {
            const x = k % w, y = (k - x) / w;
            const d = Math.hypot(x - lost[0], y - lost[1]);
            if (d < nd) { nd = d; near = [x, y]; }
        }
        line(near[0], near[1], lost[0], lost[1], 1.5, (x, y) => {
            if (!inside(x, y)) return;
            if (g[y][x] === '~') g[y][x] = '^';
            else if (g[y][x] === ' ') g[y][x] = '.';
        });
    }

    // ---- Things, against the walls, never closing a way to less than three tiles.
    const rockBeside = (x: number, y: number) => {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (get(x + dx, y + dy) === ' ') return true;
        return false;
    };
    const open3 = (x: number, y: number) => {
        for (let oy = -2; oy <= 0; oy++) for (let ox = -2; ox <= 0; ox++) {
            let ok = true;
            for (let b = 0; b < 3 && ok; b++) for (let a = 0; a < 3 && ok; a++) if (!walk(x + ox + a, y + oy + b)) ok = false;
            if (ok) return true;
        }
        return false;
    };
    /** Can a standing thing go here without pinching the way? */
    const roomFor = (x: number, y: number) => {
        if (get(x, y) !== '.' || nearDoor(x, y, 4) || nook.has(y * w + x)) return false;
        const keep: [number, number][] = [];
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if ((dx || dy) && walk(x + dx, y + dy) && open3(x + dx, y + dy)) keep.push([x + dx, y + dy]);
        g[y][x] = 'x';
        const ok = keep.every(([a, b]) => open3(a, b));
        g[y][x] = '.';
        return ok;
    };
    const wallCells = () => {
        const out: [number, number][] = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] === '.' && rockBeside(x, y)) out.push([x, y]);
        return out;
    };
    const anyOf = <T,>(a: T[]): T => a[Math.floor(rand() * a.length)];
    /** A cluster of `n` (as many as fit) standing things, grown along the wall from a seed cell. */
    const cluster = (ch: string, n: number, seedCell: [number, number]) => {
        let placed = 0;
        let front: [number, number][] = [seedCell];
        while (placed < n && front.length) {
            const [x, y] = front.shift()!;
            if (!rockBeside(x, y) || !roomFor(x, y)) continue;
            g[y][x] = ch;
            placed++;
            front = front.concat([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].sort(() => rand() - 0.5) as [number, number][]);
        }
        return placed;
    };
    // Crystals, in clusters along the walls (the set piece and the alcoves first).
    {
        let left = extra.crystals;
        const spots = wallCells().filter(([x, y]) => !nearDoor(x, y, 7));
        const pref = spots.filter(([x, y]) => inBig(x, y, 1.3) || chests.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 4));
        for (let tries = 0; left > 0 && tries < 60; tries++) {
            const s = anyOf(tries < 12 && pref.length ? pref : spots);
            left -= cluster('c', Math.min(left, 2 + Math.floor(rand() * 3)), s);
        }
        if (piece === 'crystals') {
            // The crystal hall: two great free-standing growths either side of the middle.
            for (const side of [-1, 1]) {
                const x = Math.round(big.x + side * big.rx * 0.5), y = Math.round(big.y - big.ry * 0.15);
                for (const [dx, dy] of [[0, 0], [side, 0], [0, -1], [side, 1]]) if (roomFor(x + dx, y + dy)) g[y + dy][x + dx] = 'c';
            }
        }
    }
    // Torches round each chamber's wall (and two flanking the way in).
    for (const c of rooms) {
        const n = Math.max(2, Math.round((c.rx + c.ry) / 3.4));
        const a0 = between(0, 6.3);
        for (let k = 0; k < n; k++) {
            const a = a0 + (k / n) * Math.PI * 2;
            const tx = c.x + Math.cos(a) * (c.rx + 1), ty = c.y + Math.sin(a) * (c.ry + 1);
            let best: [number, number] | null = null;
            let bd = 4;
            for (const [x, y] of wallCells()) {
                const d = Math.hypot(x - tx, y - ty);
                if (d < bd && roomFor(x, y)) { bd = d; best = [x, y]; }
            }
            if (best) g[best[1]][best[0]] = 'T';
        }
    }
    // Stalagmites at the chambers' edges, mushrooms and rubble at the foot of the walls, a few rocks to mine.
    const built = THEMES[theme].built;
    for (let k = 0; k < 4; k++) cluster('s', 1 + Math.floor(rand() * 2), anyOf(wallCells()));
    for (let k = 0; k < 4; k++) { const s = anyOf(wallCells()); if (roomFor(...s)) g[s[1]][s[0]] = 'r'; }
    const flats = (ch: string, n: number, spread: number) => {
        for (let k = 0, tries = 0; k < n && tries < 300; tries++) {
            const [sx, sy] = anyOf(wallCells());
            const x = sx + Math.round(between(-spread, spread)), y = sy + Math.round(between(-spread, spread));
            if (get(x, y) === '.' && !nearDoor(x, y, 2)) { g[y][x] = ch; k++; }
        }
    };
    if (!built) for (let k = 0; k < 4; k++) {
        const [sx, sy] = anyOf(wallCells());
        for (let j = 0; j < 3; j++) { const x = sx + Math.round(between(-1, 1)), y = sy + Math.round(between(-1, 1)); if (get(x, y) === '.' && rockBeside(x, y)) g[y][x] = 'm'; }
    }
    flats(',', 4, 1);
    flats('b', built ? 6 : 3, 1);
    // Foes: spread out, each in open ground, none near the door.
    {
        const dist = new Map<number, number>();
        const q: [number, number][] = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!walk(x, y)) { dist.set(y * w + x, 0); q.push([x, y]); }
        for (let k = 0; k < q.length; k++) {
            const [x, y] = q[k];
            for (const [dx, dy] of STEPS4) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h || dist.has(ny * w + nx)) continue;
                dist.set(ny * w + nx, dist.get(y * w + x)! + 1);
                q.push([nx, ny]);
            }
        }
        const cand: [number, number][] = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] === '.' && (dist.get(y * w + x) ?? 0) >= 2 && !nearDoor(x, y, 9)) cand.push([x, y]);
        const foes: [number, number][] = [];
        for (let k = 0; k < extra.foes && cand.length; k++) {
            let best = cand[0];
            let bd = -1;
            for (const c of cand) {
                const d = Math.min(Math.hypot(c[0] - ex, c[1] - ey) * 0.6, ...foes.map((f) => Math.hypot(c[0] - f[0], c[1] - f[1]))) + rand() * 1.5;
                if (d > bd) { bd = d; best = c; }
            }
            foes.push(best);
            g[best[1]][best[0]] = 'M';
        }
    }
    // Last word: nothing standing may shut off a patch of floor or a chest.
    for (let round = 0; round < 6; round++) {
        const reach = new Set<number>([ey * w + ex]);
        const q: [number, number][] = [[ex, ey]];
        for (let k = 0; k < q.length; k++) {
            const [x, y] = q[k];
            for (const [dx, dy] of STEPS4) {
                const nx = x + dx, ny = y + dy;
                if (!isFloor(nx, ny) || reach.has(ny * w + nx)) continue;
                reach.add(ny * w + nx);
                if (walk(nx, ny)) q.push([nx, ny]);
            }
        }
        let fixed = false;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (!isFloor(x, y) || reach.has(y * w + x)) continue;
            for (const [dx, dy] of STEPS4) if (STANDS.includes(get(x + dx, y + dy)) && get(x + dx, y + dy) !== 'C') { g[y + dy][x + dx] = '.'; fixed = true; }
        }
        if (!fixed) break;
    }
    // Trimmed to what is used.
    const rows = g.map((r) => r.join('').replace(/\s+$/, ''));
    while (rows.length && !rows[0]) rows.shift();
    while (rows.length && !rows[rows.length - 1]) rows.pop();
    const indent = Math.min(...rows.filter((r) => r).map((r) => r.length - r.trimStart().length));
    return rows.map((r) => r.slice(indent));
}

const SIDE: InteriorDef[] = [
    { id: 'cinderhollow', name: 'Cinder Hollow', land: 'fire', theme: 'ash', level: 2, entrance: { at: [84, -14] }, rows: growCave(11, 54, 44, 'ash', { chests: 3, foes: 5, crystals: 8 }) },
    { id: 'magmavein', name: 'The Magma Vein', land: 'fire', theme: 'grotto', level: 4, entrance: { at: [160, 24] }, rows: growCave(23, 60, 46, 'grotto', { chests: 4, foes: 7, crystals: 10 }) },
    { id: 'galecave', name: 'The Gale Gullet', land: 'air', theme: 'sky', level: 5, entrance: { at: [84, -14] }, rows: growCave(37, 54, 44, 'sky', { chests: 3, foes: 5, crystals: 8 }) },
    { id: 'stormcrypt', name: 'Stormwell Crypt', land: 'air', theme: 'crypt', level: 7, entrance: { at: [160, 24] }, rows: growCave(41, 60, 46, 'crypt', { chests: 4, foes: 7, crystals: 6 }) },
    { id: 'tidecave', name: 'Tidewater Grotto', land: 'water', theme: 'ice', level: 8, entrance: { at: [84, -14] }, rows: growCave(53, 54, 44, 'ice', { chests: 3, foes: 5, crystals: 9 }) },
    { id: 'abyssgrotto', name: 'The Abyssal Shelf', land: 'water', theme: 'drowned', level: 10, entrance: { at: [160, 24] }, rows: growCave(67, 60, 46, 'drowned', { chests: 4, foes: 7, crystals: 8 }) },
    { id: 'saltmine', name: 'The Old Salt Mine', land: 'earth', theme: 'void', level: 11, entrance: { at: [84, -14] }, rows: growCave(71, 54, 44, 'void', { chests: 3, foes: 6, crystals: 10 }) },
    { id: 'hollowdeep', name: 'The Hollow Deep', land: 'earth', theme: 'void', level: 13, entrance: { at: [160, 24] }, rows: growCave(83, 60, 46, 'void', { chests: 4, foes: 8, crystals: 12 }) },
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

/** Rock between two interiors, so one never shows at the edge of the screen in another. */
const GAP = 10;

/**
 * Every interior's spot beyond the continent (pure, so anyone can ask): shelf-packed, tallest first,
 * into the strip south of the continent and then the strip east of it. Each keeps its index (`n`).
 */
export const PLACED: Placed[] = (() => {
    const strips = [
        { x0: 6, x1: MAP_TILES - 6, y0: WORLD_TILES + 8, y1: MAP_TILES - 6 },
        { x0: WORLD_TILES + 8, x1: MAP_TILES - 6, y0: 6, y1: WORLD_TILES + 8 - GAP },
    ].map((s) => ({ ...s, x: s.x0, y: s.y0, shelf: 0 }));
    const out: Placed[] = new Array(INTERIORS.length);
    const order = INTERIORS.map((def, k) => ({ def, k, w: Math.max(...def.rows.map((r) => r.length)) + 2, h: def.rows.length + 2 }));
    order.sort((a, b) => b.h - a.h || a.k - b.k);
    for (const { def, k, w, h } of order) {
        let done = false;
        for (const s of strips) {
            if (s.x + w > s.x1) { s.x = s.x0; s.y += s.shelf + GAP; s.shelf = 0; }
            if (s.y + h > s.y1 || s.x + w > s.x1) continue;
            out[k] = { def, n: k + 1, i0: s.x, j0: s.y, w, h };
            s.x += w + GAP;
            s.shelf = Math.max(s.shelf, h);
            done = true;
            break;
        }
        if (!done) throw new Error(`interiors: no room beyond the continent for ${def.id} (raise MAP_TILES)`);
    }
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

/** A soft pool of light (no lamp of its own): the cave's own dim glow, in a map's cells. */
export interface Glow {
    i: number;
    j: number;
    r: number;
    color: number;
    /** How much of the gloom it lifts at its heart (0..1); torches lift all of it. */
    a: number;
}

const glowCache = new Map<string, Glow[]>();

/**
 * The soft light of an interior: a dim pool in the open middle of every room (so a big chamber reads as
 * a cave, not a black box between the torches), and the glow off its lava or water.
 */
export function glowsOf(def: InteriorDef): Glow[] {
    const hit = glowCache.get(def.id);
    if (hit) return hit;
    const rows = def.rows;
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const at = (x: number, y: number) => rows[y]?.[x] ?? ' ';
    const open = (x: number, y: number) => { const ch = at(x, y); return ch !== ' ' && ch !== '#'; };
    // How far each open cell is from the rock.
    const dist = new Int16Array(w * h).fill(-1);
    const q: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!open(x, y)) { dist[y * w + x] = 0; q.push(y * w + x); }
    for (let k = 0; k < q.length; k++) {
        const x = q[k] % w, y = (q[k] - x) / w;
        for (const [dx, dy] of STEPS4) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || dist[ny * w + nx] >= 0) continue;
            dist[ny * w + nx] = dist[q[k]] + 1;
            q.push(ny * w + nx);
        }
    }
    const th = THEMES[def.theme];
    const out: Glow[] = [];
    const far = (x: number, y: number, d: number) => out.every((g) => Math.hypot(g.i - x, g.j - y) >= d);
    // Pools in the open, the roomiest spots first.
    const spots: number[] = [];
    for (let k = 0; k < w * h; k++) if (dist[k] >= 3 && open(k % w, Math.floor(k / w))) spots.push(k);
    spots.sort((a, b) => dist[b] - dist[a] || a - b);
    for (const k of spots) {
        const x = k % w, y = (k - x) / w;
        if (!far(x, y, 8)) continue;
        out.push({ i: x, j: y, r: Math.min(3.6, 1.6 + dist[k] * 0.5), color: th.light, a: 0.3 });
    }
    // Lava glows hot, water faintly.
    const lava = def.land === 'fire';
    const wet: Glow[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (at(x, y) !== '~' || !wet.every((g) => Math.hypot(g.i - x, g.j - y) >= 4.5)) continue;
        wet.push({ i: x, j: y, r: lava ? 2.4 : 2.2, color: lava ? 0xff7a30 : 0x7dd3fc, a: lava ? 0.45 : 0.25 });
    }
    out.push(...wet);
    glowCache.set(def.id, out);
    return out;
}
