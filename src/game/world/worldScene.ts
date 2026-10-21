/**
 * The explorable region: a 256 × 256 tile isometric map streamed in 16 × 16
 * chunks. The 3 × 3 chunks around the player stay loaded, plus any chunk the
 * camera can see. Ground, decals, trees and props come from the Ultimate
 * Isometric Pack atlas. Terrain has elevation (up to mountain peaks, drawn as
 * columns of cubes) and tiles spring when the player steps on them. Every
 * cell, prop and the player live in one layer sorted back to front, so tall
 * terrain hides what is behind it; an x-ray copy of the player shows through.
 * Ground is shaded by height and a noise tone, props cast soft shadows, and
 * water deepens away from the shore with foam along the edge and ripples.
 * A wave of monsters starts every 20 seconds, harder each time; dying ends the run.
 */
import {
    Assets, Container, Graphics, Rectangle, Sprite, Text, Texture,
    type Application, type Ticker,
} from 'pixi.js';
import { store } from '../../state/store.ts';
import type { Scene } from '../scene.ts';
import type { Stage } from '../stage.ts';
import { commands } from '../commands.ts';
import { net } from '../net/multiplayer.ts';
import { myRank, runScore, submitRun, topScores } from '../leaderboard.ts';
import { progress } from '../progress.ts';
import { createRemotePlayers } from '../net/remotePlayers.ts';
import { createCharacter } from './character.ts';
import { bindControls } from './controls.ts';
import {
    CHUNK_TILES, LOAD_RADIUS, MAP_CHUNKS, MAP_TILES, TILE_DX, TILE_DY, ZOOM,
} from './constants.ts';
import { createInput, JOY_RADIUS } from './input.ts';
import { GEM_CAP } from '../skills.ts';
import { FX, type FxName } from './fxAtlas.ts';
import { cooldownFor, maxCharges, SPELLS } from './spells.ts';
import { createDropView, POTION_COLOR, SKILL_COLOR, SKILL_NAMES, type DropKind, type Skill } from './drops.ts';
import { createMonsterView } from './monsters.ts';
import { createWorldSim } from './worldSim.ts';
import { ISO_FRAMES, ISO_SCALE } from './isoAtlas.ts';
import { generateWorld, GRASS, MAX_HEIGHT, SAND, STONE, WATER, type Flat, type Prop } from './mapGen.ts';

/** Walking speed in screen px / s (vertical movement is halved by the 2:1 view). */
const SPEED_PX = 340;
/** Player collision half-size, in tiles. */
const RADIUS = 0.28;
const WAVE_MS = 700;
/** Screen px each step of water depth lowers the surface. */
const DEPTH_STEP = 18;
const MAX_DEPTH = 3;
const RIPPLE_MS = 2800;
/** The water art's surface sits this far below the shore's top, in screen px. */
const SURFACE = 18;
/** Shallow-water glow strength by tiles from shore (1, 2, 3). */
const GLOW = [0, 0.4, 0.26, 0.13];
/** Screen px one terrace level lifts a tile. */
const LEVEL_H = 38;
/** Tile spring: stiffness / damping, and the downward kick when stepped on (px/s). */
const SPRING_K = 240;
const SPRING_C = 9;
const KICK = 190;
const KICK_NEIGHBOUR = 60;
/** Elevation from which a stone tile is capped with snow. */
const SNOW_LEVEL = 7;
/** Damage a swing does to a monster (they have 6 health), by equipped tool. */
const TOOL_DAMAGE: Record<string, number> = {
    none: 1, sword: 3, axe: 2, pickaxe: 2, hammer: 3, shovel: 2, fishingpole: 1, watercan: 1, shield: 1,
};
/** Source px of the iso art → atlas px. Top-face centre of a 500 px tile is (250, 139). */
const ANCHOR_X = 250 * ISO_SCALE;
const ANCHOR_CUBE_Y = 139 * ISO_SCALE;
const ANCHOR_TALL_Y = (500 + 139) * ISO_SCALE;

/** Screen position of grid point (u, v). */
const sx = (u: number, v: number) => (u - v) * TILE_DX;
const sy = (u: number, v: number) => (u + v) * TILE_DY;

interface Wave {
    sprite: Sprite;
    baseY: number;
    phase: number;
    /** Foam on shore water, moves with the surface. */
    foam?: Sprite;
    foamBase?: number;
}

interface Ripple {
    sprite: Sprite;
    baseY: number;
    phase: number;
}

/** Everything drawn on one cell, so a spring can move it together. */
interface CellSprites {
    sprites: Sprite[];
    base: number[];
}

interface Spring {
    y: number;
    vy: number;
}

interface Chunk {
    /** Every sprite this chunk added to the world layer. */
    sprites: Sprite[];
    waves: Wave[];
    ripples: Ripple[];
    cells: Map<number, CellSprites>;
}

export function createWorldScene(app: Application, stage: Stage): Scene {
    const map = generateWorld();
    const iso = Assets.get<Texture>('iso');

    const frameTex = new Map<string, Texture>();
    const frame = (name: string): Texture => {
        let t = frameTex.get(name);
        if (!t) {
            const [x, y, w, h] = ISO_FRAMES[name];
            t = new Texture({ source: iso.source, frame: new Rectangle(x, y, w, h) });
            frameTex.set(name, t);
        }
        return t;
    };

    /** Sprite for an iso-art frame whose tile centre sits at screen (x, y). */
    const isoSprite = (name: string, x: number, y: number): Sprite => {
        const tex = frame(name);
        const s = new Sprite(tex);
        const tall = tex.height > 200;
        s.anchor.set(ANCHOR_X / tex.width, (tall ? ANCHOR_TALL_Y : ANCHOR_CUBE_Y) / tex.height);
        s.position.set(Math.round(x), Math.round(y));
        return s;
    };

    // Generated textures: a diamond outline (foam, ripples), a soft ground shadow and a diamond fill.
    const diamond = (w: number, h: number) => [w / 2, 0, w, h / 2, w / 2, h, 0, h / 2];
    const foamGfx = new Graphics().poly(diamond(2 * TILE_DX - 4, 2 * TILE_DY - 2)).stroke({ width: 3, color: 0xffffff, alpha: 1 });
    const foamTex = app.renderer.generateTexture({ target: foamGfx, resolution: 2 });
    foamGfx.destroy();
    const shadowGfx = new Graphics().ellipse(40, 14, 40, 14).fill({ color: 0x0b2410, alpha: 0.32 });
    const shadowTex = app.renderer.generateTexture({ target: shadowGfx, resolution: 2 });
    shadowGfx.destroy();

    // Ground shading: higher ground is lighter, and a noise tone mottles it.
    const shade = (h: number, tone: number): number => {
        const v = Math.min(1, 0.8 + 0.022 * h + 0.2 * (tone / 255 - 0.5));
        const c = Math.round(255 * v);
        return (c << 16) | (c << 8) | c;
    };
    // Water: shallow is bright teal, deep is dark blue.
    const waterTint = (depth: number): number => {
        const t = Math.min(1, depth / MAX_DEPTH);
        return (Math.round(255 - 105 * t) << 16) | (Math.round(255 - 85 * t) << 8) | Math.round(255 - 45 * t);
    };
    const glowGfx = new Graphics().poly(diamond(2 * TILE_DX, 2 * TILE_DY)).fill({ color: 0x5eead4, alpha: 1 });
    const glowTex = app.renderer.generateTexture({ target: glowGfx, resolution: 1 });
    glowGfx.destroy();

    // Display tree: world (scaled by ZOOM) → one layer of cells, props and the
    // player, sorted back to front by zIndex, plus the player's x-ray copy.
    const world = new Container();
    world.scale.set(ZOOM);
    const objects = new Container();
    objects.sortableChildren = true;
    world.addChild(objects);
    stage.root.addChild(world);

    // Player: the Character0 art with tools and actions (world/character.ts).
    const character = createCharacter((tool) => store.patch({ toolId: tool }));
    const player = character.player;
    objects.addChild(player);
    // Faint copy above everything, so the player stays visible behind mountains.
    const xray = character.xray;
    world.addChild(xray);
    // Equip what this player last carried; controls.ts then shows it in the HUD.
    character.setTool(progress.savedTool());
    // HUD buttons, keyboard shortcuts and the health rules (world/controls.ts).
    const controls = bindControls(character);
    // The other players in the shared room (world/../net).
    const remotes = createRemotePlayers({
        scene: 'world',
        layer: objects,
        toScreen: (u, v) => ({ x: sx(u, v), y: sy(u, v) }),
        zFor: (u, v) => sy(Math.floor(u) + 0.5, Math.floor(v) + 0.5) + Z_PLAYER,
    });

    let pz = 0; // smoothed terrace lift under the player, screen px
    let pu = MAP_TILES / 2 + 0.5;
    let pv = MAP_TILES / 2 + 0.5;
    // Debug: ?spawn=i,j starts the player on that tile (clamped to the map).
    const spawn = new URLSearchParams(window.location.search).get('spawn')?.split(',').map(Number);
    if (spawn && spawn.length === 2 && spawn.every(Number.isFinite)) {
        pu = Math.min(MAP_TILES - 1, Math.max(0, spawn[0])) + 0.5;
        pv = Math.min(MAP_TILES - 1, Math.max(0, spawn[1])) + 0.5;
    }
    // Resume where this player left off .
    if (progress.saved?.world.set) {
        const { u, v } = progress.saved.world;
        if (u >= 0 && v >= 0 && u < MAP_TILES && v < MAP_TILES && map.blocked[Math.floor(v) * MAP_TILES + Math.floor(u)] === 0) {
            pu = u;
            pv = v;
        }
    }
    // Debug: with ?spawn= the player is exposed for automated checks.
    if (spawn) (window as unknown as { __player?: Container }).__player = player;

    // Joystick overlay, drawn in screen space above the stage.
    const joyGfx = new Graphics();
    app.stage.addChild(joyGfx);
    const input = createInput(app.canvas);

    // Per-chunk lookups.
    const chunkOf = (i: number, j: number) => Math.floor(j / CHUNK_TILES) * MAP_CHUNKS + Math.floor(i / CHUNK_TILES);
    const propsByChunk = new Map<number, Prop[]>();
    for (const p of map.props) {
        const k = chunkOf(p.i, p.j);
        let list = propsByChunk.get(k);
        if (!list) propsByChunk.set(k, (list = []));
        list.push(p);
    }
    const flatsByCell = new Map<number, Flat[]>();
    for (const f of map.flats) {
        const k = f.j * MAP_TILES + f.i;
        let list = flatsByCell.get(k);
        if (!list) flatsByCell.set(k, (list = []));
        list.push(f);
    }

    const chunks = new Map<number, Chunk>();
    const key = (cx: number, cy: number) => cy * MAP_CHUNKS + cx;

    // zIndex = the cell's centre y, plus a small offset per layer: cube < overlay < decal < prop < player.
    const Z_OVERLAY = 0.01;
    const Z_DECAL = 0.02;
    const Z_PROP = 0.3;
    const Z_PLAYER = 0.5;

    const loadChunk = (cx: number, cy: number): Chunk => {
        const sprites: Sprite[] = [];
        const waves: Wave[] = [];
        const ripples: Ripple[] = [];
        const cells = new Map<number, CellSprites>();

        for (let dj = 0; dj < CHUNK_TILES; dj++) {
            for (let di = 0; di < CHUNK_TILES; di++) {
                const i = cx * CHUNK_TILES + di;
                const j = cy * CHUNK_TILES + dj;
                const k = j * MAP_TILES + i;
                const t = map.terrain[k];
                const h = map.height[k];
                const v = map.variant[k] + 1;
                const x = sx(i + 0.5, j + 0.5);
                const y = sy(i + 0.5, j + 0.5);
                const base = t === WATER ? 'water' : t === SAND ? 'sand' : t === STONE ? `stone${v}` : `dirt${v}`;
                const tone = map.tone[k];
                const depth = t === WATER ? Math.min(MAX_DEPTH, map.shoreDist[k] - 1) : 0;
                const lift = t === WATER ? depth * DEPTH_STEP : 0; // screen px the surface sits below the shore
                const cell: CellSprites = { sprites: [], base: [] };
                const add = (s: Sprite, z: number) => {
                    s.zIndex = y + z;
                    objects.addChild(s);
                    sprites.push(s);
                    cell.sprites.push(s);
                    cell.base.push(s.y);
                };
                // Only the two faces toward the viewer show: stack cubes (each covers two
                // levels of side) down to the lower of the two front neighbours.
                const hAt = (ni: number, nj: number) => {
                    if (ni >= MAP_TILES || nj >= MAP_TILES) return 0;
                    const nk = nj * MAP_TILES + ni;
                    // Deeper water sits lower, so its banks show more side.
                    return map.terrain[nk] === WATER
                        ? -Math.min(MAX_DEPTH, map.shoreDist[nk] - 1) * (DEPTH_STEP / LEVEL_H)
                        : map.height[nk];
                };
                const drop = Math.max(h - hAt(i + 1, j), h - hAt(i, j + 1), 0);
                for (let level = h - 2 * Math.max(0, Math.ceil(drop / 2) - 1); level < h; level += 2) {
                    const sp = isoSprite(base, x, y - Math.max(0, level) * LEVEL_H + lift);
                    sp.tint = shade(h, tone);
                    add(sp, 0);
                }
                const topCube = isoSprite(base, x, y - h * LEVEL_H + lift);
                topCube.tint = t === WATER ? waterTint(depth) : shade(h, tone);
                add(topCube, 0);
                const top = y - h * LEVEL_H;
                if (t === WATER) {
                    const wave: Wave = { sprite: topCube, baseY: topCube.y, phase: (i + j) * 0.55 + tone * 0.01 };
                    const sd = map.shoreDist[k];
                    // Shallows glow turquoise.
                    if (sd <= 3) {
                        const glow = new Sprite(glowTex);
                        glow.anchor.set(0.5);
                        glow.alpha = GLOW[sd];
                        glow.position.set(Math.round(x), Math.round(y + SURFACE + lift));
                        glow.zIndex = y + Z_OVERLAY * 0.5;
                        objects.addChild(glow);
                        sprites.push(glow);
                    }
                    // Foam rims the shore; open water gets the occasional ripple.
                    if (sd === 1) {
                        const foam = new Sprite(foamTex);
                        foam.anchor.set(0.5);
                        foam.position.set(Math.round(x), Math.round(y + SURFACE));
                        foam.zIndex = y + Z_OVERLAY;
                        objects.addChild(foam);
                        sprites.push(foam);
                        wave.foam = foam;
                        wave.foamBase = foam.y;
                    } else if (sd >= 3 && tone % 11 === 0) {
                        const ring = new Sprite(foamTex);
                        ring.anchor.set(0.5);
                        ring.position.set(Math.round(x), Math.round(y + SURFACE + lift));
                        ring.zIndex = y + Z_OVERLAY;
                        objects.addChild(ring);
                        sprites.push(ring);
                        ripples.push({ sprite: ring, baseY: ring.y, phase: ((i * 131 + j * 71) % 100) / 100 * RIPPLE_MS });
                    }
                    waves.push(wave);
                }
                if (t === GRASS) {
                    const g = isoSprite(`grass${v}`, x, top);
                    g.tint = shade(h, tone);
                    add(g, Z_OVERLAY);
                } else if (t === STONE && h >= SNOW_LEVEL) add(isoSprite('snow', x, top), Z_OVERLAY);
                for (const f of flatsByCell.get(k) ?? []) add(isoSprite(f.name, x, top), Z_DECAL);
                cells.set(k, cell);
            }
        }

        for (const p of propsByChunk.get(key(cx, cy)) ?? []) {
            const k = p.j * MAP_TILES + p.i;
            const x = sx(p.i + 0.5, p.j + 0.5);
            const y = sy(p.i + 0.5, p.j + 0.5);
            const inWater = map.terrain[k] === WATER;
            const py = y - map.height[k] * LEVEL_H + (inWater ? Math.min(MAX_DEPTH, map.shoreDist[k] - 1) * DEPTH_STEP : 0);
            const s = isoSprite(p.name, x, py);
            s.zIndex = y + Z_PROP + p.i * 0.0001;
            objects.addChild(s);
            sprites.push(s);
            // A soft shadow grounds everything that stands (tall grass and flowers excepted).
            if (!p.name.startsWith('tallgrass') && !p.name.startsWith('dbush')) {
                const big = p.name.startsWith('tree') ? 1.45 : p.name.startsWith('rock') ? 0.95 : 1.1;
                const sh = new Sprite(shadowTex);
                sh.anchor.set(0.5);
                sh.scale.set(big);
                sh.position.set(Math.round(x), Math.round(py + 14));
                sh.zIndex = y + Z_PROP - 0.1;
                objects.addChild(sh);
                sprites.push(sh);
            }
            const cell = cells.get(k);
            if (cell) {
                cell.sprites.push(s);
                cell.base.push(s.y);
            }
        }
        return { sprites, waves, ripples, cells };
    };

    const unloadChunk = (c: Chunk) => {
        for (const s of c.sprites) s.destroy();
    };

    const clampChunk = (c: number) => Math.min(MAP_CHUNKS - 1, Math.max(0, c));
    let curCx = -1;
    let curCy = -1;
    let viewKey = '';
    /**
     * Keep the 3 × 3 chunks around the player loaded, plus any chunk the
     * camera can see (props rise well above their tile, so the view is padded).
     */
    const syncChunks = () => {
        const ci = Math.floor(pu / CHUNK_TILES);
        const cj = Math.floor(pv / CHUNK_TILES);
        const x0 = -world.x / ZOOM - 80;
        const x1 = (stage.designWidth() - world.x) / ZOOM + 80;
        const y0 = -world.y / ZOOM;
        const y1 = (stage.height - world.y) / ZOOM + 220 + MAX_HEIGHT * LEVEL_H;
        let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
        for (const [X, Y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
            const u = (X / TILE_DX + Y / TILE_DY) / 2;
            const v = (Y / TILE_DY - X / TILE_DX) / 2;
            uMin = Math.min(uMin, u); uMax = Math.max(uMax, u);
            vMin = Math.min(vMin, v); vMax = Math.max(vMax, v);
        }
        const ci0 = clampChunk(Math.floor(uMin / CHUNK_TILES));
        const ci1 = clampChunk(Math.floor(uMax / CHUNK_TILES));
        const cj0 = clampChunk(Math.floor(vMin / CHUNK_TILES));
        const cj1 = clampChunk(Math.floor(vMax / CHUNK_TILES));
        const vk = `${ci0},${ci1},${cj0},${cj1}`;
        if (ci === curCx && cj === curCy && vk === viewKey) return;
        curCx = ci;
        curCy = cj;
        viewKey = vk;
        const want = new Set<number>();
        for (let y = Math.min(cj - LOAD_RADIUS, cj0); y <= Math.max(cj + LOAD_RADIUS, cj1); y++) {
            for (let x = Math.min(ci - LOAD_RADIUS, ci0); x <= Math.max(ci + LOAD_RADIUS, ci1); x++) {
                if (x < 0 || y < 0 || x >= MAP_CHUNKS || y >= MAP_CHUNKS) continue;
                const k = key(x, y);
                want.add(k);
                if (!chunks.has(k)) chunks.set(k, loadChunk(x, y));
            }
        }
        for (const [k, c] of chunks) {
            if (!want.has(k)) {
                unloadChunk(c);
                chunks.delete(k);
            }
        }
    };

    /**
     * Whether the player's box may stand at (u, v): inside the map, clear of
     * obstacles, and over cells that differ by at most one level. The rule
     * depends only on position, so the player can never be left pinned by a
     * ledge they stepped onto from another side.
     */
    const boxOk = (u: number, v: number): boolean => {
        let lo = Infinity;
        let hi = -Infinity;
        for (let j = Math.floor(v - RADIUS); j <= Math.floor(v + RADIUS); j++) {
            for (let i = Math.floor(u - RADIUS); i <= Math.floor(u + RADIUS); i++) {
                if (i < 0 || j < 0 || i >= MAP_TILES || j >= MAP_TILES) return false;
                const k = j * MAP_TILES + i;
                if (map.blocked[k] === 1) return false;
                lo = Math.min(lo, map.height[k]);
                hi = Math.max(hi, map.height[k]);
            }
        }
        return hi - lo <= 1;
    };
    const heightAt = (u: number, v: number): number => map.height[Math.floor(v) * MAP_TILES + Math.floor(u)];

    const placeCamera = () => {
        // Aim a little above the feet so the player sits near the screen centre.
        world.position.set(
            stage.designWidth() / 2 - sx(pu, pv) * ZOOM,
            stage.height / 2 - (sy(pu, pv) - pz - 20) * ZOOM,
        );
    };

    let lastTile = -1;
    let lastLoaded = -1;
    const publish = () => {
        const i = Math.floor(pu);
        const j = Math.floor(pv);
        const t = j * MAP_TILES + i;
        if (t === lastTile && chunks.size === lastLoaded) return;
        lastTile = t;
        lastLoaded = chunks.size;
        store.patch({ tileX: i, tileY: j, height: map.height[t], chunkX: curCx, chunkY: curCy, loadedChunks: chunks.size });
    };


    // Monsters, waves and drops: shown from the shared simulation (the server's when
    // online, a local copy offline) via world/worldSim.ts; swings and pickups are sent to it.
    let invuln = 0; // ms of grace after being bitten
    let bannerId = 0;
    const banner = (text: string) => store.patch({ banner: { text, id: ++bannerId } });
    const worldPoint = (u: number, v: number) => ({ x: sx(u, v), y: sy(u, v) });
    const sortZ = (u: number, v: number) => sy(Math.floor(u) + 0.5, Math.floor(v) + 0.5) + Z_PLAYER;
    // Potion boosts: ms left for each (red heals at once, so it has none).
    const buffMs: Record<string, number> = { blue: 0, yellow: 0, purple: 0, black: 0 };
    const BUFF_MS: Record<string, number> = { blue: 20000, yellow: 15000, purple: 12000, black: 15000 };
    let buffShown = '';
    const hurtPlayer = (n: number) => {
        if (invuln > 0 || character.dead || store.get().shop) return; // no bites while shopping
        invuln = 1500;
        if (buffMs.purple > 0) {
            dropView.text(player.x, player.y - 70, 'Shielded!', POTION_COLOR.purple);
            return;
        }
        if (buffMs.black > 0) n *= 2;
        // Defence gives a chance to block a bite outright.
        if (Math.random() < Math.min(0.6, 0.07 * store.get().skills.defence)) {
            dropView.text(player.x, player.y - 70, 'Blocked!', SKILL_COLOR.defence);
            return;
        }
        store.patch({ hp: Math.max(0, store.get().hp - n) });
        character.command({ type: 'hurt' });
        net.sendAct('hurt');
    };
    // The run: it ends when the player dies (Game Over screen + leaderboard).
    let runKills = 0;
    let runSeconds = 0;
    let deadFor = 0;
    let runOver = false;
    const q = new URLSearchParams(window.location.search);
    const sim = createWorldSim({
        map,
        player: () => ({ id: 'me', u: pu, v: pv, alive: !character.dead }),
        // Debug: ?firstWave=<s>&waveEvery=<s> shorten the wave timers when playing offline.
        everySec: Number(q.get('waveEvery')) || 20,
        firstSec: Number(q.get('firstWave')) || 20,
        // Debug: ?swordMul=40 makes sword drops common when playing offline, for testing.
        swordMul: Number(q.get('swordMul')) || 1,
        potionMul: Number(q.get('potionMul')) || 1,
        on: {
            bite: hurtPlayer,
            kill: () => {
                runKills++;
                progress.addKill();
            },
            gain: (kind: DropKind, sword: number) => {
                if (kind.startsWith('potion_')) {
                    const c = kind.slice(7);
                    const colour = POTION_COLOR[c];
                    if (c === 'red') {
                        store.patch({ hp: Math.min(store.get().maxHp, store.get().hp + 3) });
                        dropView.text(player.x, player.y - 78, '+3 Health', colour);
                        banner('Red potion: healed 3');
                    } else {
                        buffMs[c] = BUFF_MS[c];
                        const what = { blue: 'Attack x1.5', yellow: 'Speed x1.4', purple: 'Shield: bites blocked', black: 'Rage: double damage, double bites' }[c];
                        dropView.text(player.x, player.y - 78, what ?? c, colour);
                        banner(`${c[0].toUpperCase()}${c.slice(1)} potion: ${what} for ${BUFF_MS[c] / 1000}s`);
                    }
                    return;
                }
                if (kind === 'sword') {
                    // A rare sword: new ones are kept and held at once; a duplicate becomes an Attack level instead.
                    if (progress.addSword(sword)) {
                        character.setSword(sword);
                        progress.equipSword(sword);
                        commands.emit({ type: 'equip', tool: 'sword' });
                        dropView.text(player.x, player.y - 78, 'New sword!', 0xffe27a);
                        banner('Rare drop! You found a new sword');
                    } else {
                        progress.addGem('attack');
                        dropView.text(player.x, player.y - 78, 'Duplicate · Attack gem +1', SKILL_COLOR.attack);
                        banner('You already have that sword: +1 Attack gem');
                    }
                    return;
                }
                // A gem: kept until you spend it on an upgrade at a visiting frog (it is lost if you die first).
                const skill = kind as Skill;
                if (!progress.addGem(skill)) return;
                dropView.text(player.x, player.y - 78, `+1 ${SKILL_NAMES[skill]} gem`, SKILL_COLOR[skill]);
            },
            wave: (n) => {
                progress.reachWave(n);
                banner(`Wave ${n}! Monsters are coming`);
            },
        },
    });
    const monsterView = createMonsterView({
        layer: objects,
        shadowTex,
        heightAt,
        toScreen: worldPoint,
        zFor: sortZ,
        levelH: LEVEL_H,
        player: () => ({ u: pu, v: pv }),
    });
    const dropView = createDropView({
        layer: objects,
        glowTex,
        heightAt,
        toScreen: worldPoint,
        zFor: sortZ,
        levelH: LEVEL_H,
        player: () => ({ u: pu, v: pv, alive: !character.dead }),
        wantsSkill: (kind: DropKind) => {
            if (kind === 'potion_red') return store.get().hp < store.get().maxHp;
            return kind === 'sword' || kind.startsWith('potion_') || store.get().gems[kind as Skill] < GEM_CAP;
        },
        onTouch: (id) => sim.take(id),
    });
    const endRun = () => {
        runOver = true;
        const wave = Math.max(1, sim.view().wave);
        const score = runScore(wave, runKills);
        net.sendAway();
        progress.endRun();
        store.patch({ gameOver: { score, wave, kills: runKills, seconds: runSeconds, status: 'sending', rank: null, note: null, top: [] } });
        void (async () => {
            const r = await submitRun(score, runSeconds, wave, runKills);
            const top = await topScores(10);
            const rank = r.accepted ? r.rank : await myRank();
            if (store.get().gameOver) store.patch({ gameOver: { score, wave, kills: runKills, seconds: runSeconds, status: 'done', rank, note: r.accepted ? null : r.reason, top } });
        })();
    };
    // Debug: with ?spawn= the game exposes the current combat view for automated checks.
    if (q.has('spawn')) {
        (window as unknown as { __game?: unknown }).__game = { view: () => sim.view(), pos: () => ({ u: pu, v: pv }), store, progress };
    }
    let hudClock = 0;
    // A swing that actually started (the character was free) lands a moment later.
    const strikes: number[] = [];
    let wasLocked = false;
    // Spells (the chest menu), drawn with the Super Pixel Effects sheets (public/images/fx), and a cooldown per spell.
    // Charges held per spell (a new run, or unlocking one, starts it full) and ms until the next charge.
    const charges = SPELLS.map(() => 0);
    const recharge = SPELLS.map(() => 0);
    const lastMax = SPELLS.map(() => 0);
    let spellShown = '';
    const fxTex = new Map<string, Texture>();
    const fxFrame = (name: FxName, f: number): Texture => {
        const k = `${name}:${f}`;
        let t = fxTex.get(k);
        if (!t) {
            const sheet = Assets.get<Texture>(`fx_${name}`);
            sheet.source.scaleMode = 'nearest';
            t = new Texture({ source: sheet.source, frame: new Rectangle(f * FX[name].w, 0, FX[name].w, FX[name].h) });
            fxTex.set(k, t);
        }
        return t;
    };
    const fx: { s: Sprite; name: FxName; t: number; life: number }[] = [];
    /** Play an effect once at a spot on the ground (squash < 1 lays a round effect flat on the isometric ground). */
    const playFx = (name: FxName, u: number, v: number, o: { scale: number; life: number; squash?: number; anchorY?: number; lift?: number }) => {
        const s = new Sprite(fxFrame(name, 0));
        s.anchor.set(0.5, o.anchorY ?? 0.5);
        s.scale.set(o.scale, o.scale * (o.squash ?? 1));
        const at = worldPoint(u, v);
        s.position.set(at.x, at.y - heightAt(u, v) * LEVEL_H - (o.lift ?? 0));
        s.zIndex = 1e5;
        objects.addChild(s);
        fx.push({ s, name, t: 0, life: o.life });
    };
    /** Thrown spells still in the air: the blast happens where they land. */
    const flying: { s: Sprite; fu: number; fv: number; tu: number; tv: number; t: number; flight: number; dmg: number; radius: number; facing: number }[] = [];
    const spellDamage = (base: number) =>
        Math.max(1, Math.round(base * (1 + 0.15 * store.get().skills.attack) * (buffMs.blue > 0 ? 1.5 : 1) * (buffMs.black > 0 ? 2 : 1)));
    /** The nearest living monster within `range` tiles, optionally only ahead of where the player faces. */
    const nearestMonster = (range: number, ahead: boolean): { u: number; v: number } | null => {
        const aim = (character.facing * Math.PI) / 4;
        let best = range;
        let found: { u: number; v: number } | null = null;
        for (const m of sim.view().monsters) {
            if (m.state === 'dying') continue;
            const d = Math.hypot(m.u - pu, m.v - pv);
            if (d >= best) continue;
            if (ahead) {
                let diff = Math.abs(Math.atan2(((m.u - pu) + (m.v - pv)) * 62, ((m.u - pu) - (m.v - pv)) * 62) - aim);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                if (diff > 1.3) continue;
            }
            best = d;
            found = { u: m.u, v: m.v };
        }
        return found;
    };
    const castSpell = (index: number) => {
        const sp = SPELLS[index];
        if (!sp || !store.get().spells.unlocked[index] || charges[index] < 1 || character.dead) return;
        const dmg = spellDamage(sp.damage);
        if (sp.kind === 'heal') {
            store.patch({ hp: Math.min(store.get().maxHp, store.get().hp + sp.heal) });
            dropView.text(player.x, player.y - 78, `+${sp.heal} Health`, sp.color);
            playFx('heal', pu, pv, { scale: 1.3, life: 1000, lift: 56 });
        } else if (sp.kind === 'nova') {
            sim.strike(pu, pv, character.facing, dmg, sp.radius);
            const w = (sp.radius * 176) / FX.frost.w;
            playFx('frost', pu, pv, { scale: w * 0.95, squash: 0.55, life: 600 });
            playFx('sparkle', pu, pv, { scale: w * 1.3, squash: 0.55, life: 750 });
        } else if (sp.kind === 'bolt') {
            const target = nearestMonster(sp.seek, false);
            if (!target) {
                dropView.text(player.x, player.y - 78, 'No target', 0xffffff);
                return;
            }
            sim.strike(target.u, target.v, character.facing, dmg, sp.radius);
            playFx('bolt', target.u, target.v, { scale: 2.6, life: 600, anchorY: 0.92 });
            playFx('boltburst', target.u, target.v, { scale: 3.2, squash: 0.55, life: 500 });
        } else {
            // Thrown: toward the nearest monster ahead, else straight ahead.
            const a = (character.facing * Math.PI) / 4;
            const target = nearestMonster(sp.seek, true) ?? {
                u: pu + ((Math.cos(a) + Math.sin(a)) / Math.SQRT2) * 5.5,
                v: pv + ((Math.sin(a) - Math.cos(a)) / Math.SQRT2) * 5.5,
            };
            const s = new Sprite(fxFrame('fireball', 0));
            s.anchor.set(0.5, 0.75);
            s.scale.set(0.8);
            s.zIndex = 1e5;
            objects.addChild(s);
            const dist = Math.hypot(target.u - pu, target.v - pv);
            flying.push({ s, fu: pu, fv: pv, tu: target.u, tv: target.v, t: 0, flight: Math.max(260, (dist / 13) * 1000), dmg, radius: sp.radius, facing: character.facing });
        }
        charges[index] -= 1;
        if (recharge[index] <= 0) recharge[index] = cooldownFor(sp, store.get().spells.cooldown[index]);
    };
    // The sword's crescent slash (the frog pack's "Slash 3"): 9 frames, one colour row per sword.
    const slashSheet = Assets.get<Texture>('slashes');
    slashSheet.source.scaleMode = 'nearest';
    const slashTex = new Map<number, Texture>();
    const slashFrame = (row: number, f: number): Texture => {
        const k = row * 9 + f;
        let t = slashTex.get(k);
        if (!t) {
            t = new Texture({ source: slashSheet.source, frame: new Rectangle(f * 128, row * 128, 128, 128) });
            slashTex.set(k, t);
        }
        return t;
    };
    const slashes: { s: Sprite; t: number; row: number }[] = [];
    let slashFlip = 1;
    const SLASH_MS = 300;
    const slashAt = () => {
        const row = character.sword < 0 ? 4 : character.sword % 5;
        const s = new Sprite(slashFrame(row, 0));
        s.anchor.set(0.5);
        const a = (character.facing * Math.PI) / 4;
        // The crescent bulges upward in the art, so turn it to bulge toward the facing; every other swing is mirrored left-right (a backhand).
        s.rotation = a + Math.PI / 2;
        s.scale.set(slashFlip * 0.95, 0.95);
        s.position.set(player.x + Math.cos(a) * 44, player.y - 46 + Math.sin(a) * 22);
        s.zIndex = 1e5;
        objects.addChild(s);
        slashes.push({ s, t: 0, row });
        slashFlip = -slashFlip;
    };
    // A frog shopkeeper visits now and then: walk up to it to spend gems on upgrades.
    const frogSheet = Assets.get<Texture>('frog');
    frogSheet.source.scaleMode = 'linear';
    const frogTex = [0, 1, 2].map((n) => new Texture({ source: frogSheet.source, frame: new Rectangle(n * 175, 0, 175, 175) }));
    const frogSprite = new Sprite(frogTex[0]);
    frogSprite.anchor.set(0.5, 0.92);
    frogSprite.scale.set(0.85);
    const frogGlow = new Sprite(glowTex);
    frogGlow.anchor.set(0.5);
    frogGlow.tint = 0x7cfc8a;
    frogGlow.scale.set(0.7);
    const frogShadow = new Sprite(shadowTex);
    frogShadow.anchor.set(0.5);
    frogSprite.visible = frogGlow.visible = frogShadow.visible = false;
    objects.addChild(frogGlow, frogShadow, frogSprite);
    // Debug: ?frogFirst=<s>&frogEvery=<s> change the timing, ?frogNear puts it beside the player.
    const FROG_FIRST = (Number(q.get('frogFirst')) || 70) * 1000;
    const FROG_EVERY = (Number(q.get('frogEvery')) || 170) * 1000;
    const FROG_STAYS = 40000;
    let frog: { u: number; v: number; age: number } | null = null;
    let frogClock = FROG_FIRST;
    let frogSeen = false;
    const findFrogSpot = (): { u: number; v: number } | null => {
        if (q.has('frogNear')) return { u: Math.floor(pu) + 2.5, v: Math.floor(pv) + 0.5 }; // debug: right beside the player
        const free = (i: number, j: number) => {
            for (let dj = -1; dj <= 1; dj++) {
                for (let di = -1; di <= 1; di++) {
                    const k = (j + dj) * MAP_TILES + (i + di);
                    if (map.terrain[k] === 4 || map.blocked[k] === 1) return false;
                }
            }
            return true;
        };
        for (let n = 0; n < 60; n++) {
            const ang = Math.random() * Math.PI * 2;
            const d = 7 + Math.random() * 7;
            const u = pu + Math.cos(ang) * d;
            const v = pv + Math.sin(ang) * d;
            const i = Math.floor(u);
            const j = Math.floor(v);
            if (i < 6 || j < 6 || i > MAP_TILES - 7 || j > MAP_TILES - 7 || !free(i, j)) continue;
            if (Math.abs(heightAt(i, j) - heightAt(i + 1, j)) > 1 || Math.abs(heightAt(i, j) - heightAt(i, j + 1)) > 1) continue;
            return { u: i + 0.5, v: j + 0.5 };
        }
        return null;
    };
    const updateFrog = (dtMs: number) => {
        if (!frog) {
            if (!character.dead) frogClock -= dtMs;
            if (frogClock <= 0) {
                const spot = findFrogSpot();
                if (spot) {
                    frog = { ...spot, age: 0 };
                    frogSeen = false;
                    banner('A frog is here! Find it to spend your gems');
                } else {
                    frogClock = 5000;
                }
            }
        } else {
            frog.age += dtMs;
            if (frog.age >= FROG_STAYS) {
                frog = null;
                frogClock = FROG_EVERY * (0.8 + Math.random() * 0.4);
            } else if (!character.dead) {
                const near = Math.hypot(frog.u - pu, frog.v - pv);
                if (near < 1.9 && !frogSeen && !store.get().shop) {
                    frogSeen = true;
                    store.patch({ shop: true });
                } else if (near > 3.8) frogSeen = false;
            }
        }
        frogSprite.visible = frogGlow.visible = frogShadow.visible = frog !== null;
        if (!frog) return;
        const at = worldPoint(frog.u, frog.v);
        const ground = heightAt(frog.u, frog.v) * LEVEL_H;
        const hop = Math.max(0, Math.sin(clock / 330)) * 10;
        frogSprite.texture = frogTex[Math.floor(clock / 450) % 3 === 2 ? 2 : Math.floor(clock / 900) % 2];
        frogSprite.position.set(at.x, at.y - ground - hop);
        frogShadow.position.set(at.x, at.y - ground);
        frogGlow.position.set(at.x, at.y - ground);
        frogGlow.alpha = 0.55 + 0.2 * Math.sin(clock / 260);
        const z = sortZ(frog.u, frog.v);
        frogSprite.zIndex = z + 0.05;
        frogShadow.zIndex = z - 0.3;
        frogGlow.zIndex = z - 0.35;
        // Blink away in the last few seconds.
        frogSprite.alpha = frog.age > FROG_STAYS - 5000 && Math.floor(frog.age / 200) % 2 === 0 ? 0.35 : 1;
    };
    const offStrike = commands.subscribe((c) => {
        if ((c.type === 'attack' || c.type === 'use') && !wasLocked && character.locked && !character.dead && character.tool === 'sword') slashAt();
        if (c.type === 'spell') castSpell(c.index);
        if ((c.type === 'attack' || c.type === 'use') && !wasLocked && character.locked && !character.dead) strikes.push(170);
    });

    pz = heightAt(pu, pv) * LEVEL_H;
    placeCamera();
    syncChunks();
    publish();

    const offResize = stage.onResize(() => {
        placeCamera();
        syncChunks();
    });

    // Tile springs: stepping on a tile dips it, then it bounces back.
    const springs = new Map<number, Spring>();
    const kick = (i: number, j: number, vy: number) => {
        if (i < 0 || j < 0 || i >= MAP_TILES || j >= MAP_TILES) return;
        const k = j * MAP_TILES + i;
        if (map.terrain[k] === WATER) return;
        const sp = springs.get(k) ?? { y: 0, vy: 0 };
        sp.vy += vy;
        springs.set(k, sp);
    };
    let standI = Math.floor(pu);
    let standJ = Math.floor(pv);
    const stepSprings = (dt: number): number => {
        let under = 0;
        for (const [k, sp] of springs) {
            sp.vy += (-SPRING_K * sp.y - SPRING_C * sp.vy) * dt;
            sp.y += sp.vy * dt;
            const i = k % MAP_TILES;
            const j = Math.floor(k / MAP_TILES);
            const cell = chunks.get(key(Math.floor(i / CHUNK_TILES), Math.floor(j / CHUNK_TILES)))?.cells.get(k);
            const done = Math.abs(sp.y) < 0.05 && Math.abs(sp.vy) < 1;
            if (cell) for (let n = 0; n < cell.sprites.length; n++) cell.sprites[n].y = cell.base[n] + (done ? 0 : sp.y);
            if (i === standI && j === standJ) under = done ? 0 : sp.y;
            if (done || !cell) springs.delete(k);
        }
        return under;
    };

    let clock = 0;
    let saveClock = 0;
    const tick = (ticker: Ticker) => {
        clock += ticker.deltaMS;
        const dt = Math.min(ticker.deltaMS / 1000, 0.05);

        // Joystick vector is in screen space; the view is 2:1, so halve vertical px.
        const dir = input.read();
        // Actions, sitting and death hold the character in place.
        const walk = character.locked ? { x: 0, y: 0 } : dir;
        const speed = SPEED_PX * (1 + 0.05 * store.get().skills.speed) * (buffMs.yellow > 0 ? 1.4 : 1);
        const X = walk.x * speed * dt;
        const Y = walk.y * speed * 0.5 * dt;
        const du = (X / TILE_DX + Y / TILE_DY) / 2;
        const dv = (Y / TILE_DY - X / TILE_DX) / 2;
        const fromU = pu;
        const fromV = pv;
        // If the player ever ends up somewhere invalid (a debug spawn), let them walk out.
        const trapped = !boxOk(pu, pv);
        if (du !== 0 && (trapped || boxOk(pu + du, pv))) pu += du;
        if (dv !== 0 && (trapped || boxOk(pu, pv + dv))) pv += dv;
        pu = Math.min(MAP_TILES - 0.01, Math.max(0, pu));
        pv = Math.min(MAP_TILES - 0.01, Math.max(0, pv));

        // Entering a new tile kicks it (and, lightly, its neighbours).
        const ci = Math.floor(pu);
        const cj = Math.floor(pv);
        if (ci !== standI || cj !== standJ) {
            standI = ci;
            standJ = cj;
            kick(ci, cj, KICK);
            kick(ci + 1, cj, KICK_NEIGHBOUR);
            kick(ci - 1, cj, KICK_NEIGHBOUR);
            kick(ci, cj + 1, KICK_NEIGHBOUR);
            kick(ci, cj - 1, KICK_NEIGHBOUR);
        }
        const under = stepSprings(dt);

        // Ease up and down terraces; the player rides the tile's spring.
        pz += (heightAt(pu, pv) * LEVEL_H - pz) * Math.min(1, 14 * dt);
        player.position.set(sx(pu, pv), sy(pu, pv) - pz + under);
        player.zIndex = sy(ci + 0.5, cj + 0.5) + Z_PLAYER;
        xray.position.copyFrom(player.position);

        // Character animation: face the way the stick points; idle when blocked or still.
        character.update(ticker.deltaMS, dir, pu !== fromU || pv !== fromV);
        controls.tick();
        progress.addTime(Math.min(ticker.deltaMS / 1000, 0.25));
        if (!character.dead && !runOver) runSeconds += Math.min(ticker.deltaMS / 1000, 0.25);
        if (character.dead && !runOver) {
            deadFor += ticker.deltaMS;
            if (deadFor > 1500) endRun();
        }
        saveClock += ticker.deltaMS;
        if (saveClock > 1000 && !runOver) {
            saveClock = 0;
            progress.record({ scene: 'world', u: pu, v: pv, tool: character.tool, hp: store.get().hp });
        }
        if (!runOver) net.sendPose({ scene: 'world', u: pu, v: pv, z: pz, face: character.facing, anim: pu !== fromU || pv !== fromV ? character.anim : 'idle', tool: character.tool, dead: character.dead, sword: character.sword });
        remotes.update(ticker.deltaMS);
        invuln = Math.max(0, invuln - ticker.deltaMS);
        updateFrog(ticker.deltaMS);
        for (let i = slashes.length - 1; i >= 0; i--) {
            const sl = slashes[i];
            sl.t += ticker.deltaMS;
            const f = Math.min(8, Math.floor((sl.t / SLASH_MS) * 9));
            sl.s.texture = slashFrame(sl.row, f);
            if (sl.t >= SLASH_MS) {
                sl.s.destroy();
                slashes.splice(i, 1);
            }
        }
        {
            const sv = store.get().spells;
            for (let i = 0; i < SPELLS.length; i++) {
                const max = sv.unlocked[i] ? maxCharges(sv.carry[i]) : 0;
                if (max > lastMax[i]) charges[i] += max - lastMax[i];
                lastMax[i] = max;
                charges[i] = Math.min(charges[i], max);
                if (charges[i] < max) {
                    recharge[i] -= ticker.deltaMS;
                    if (recharge[i] <= 0) {
                        charges[i] += 1;
                        recharge[i] = charges[i] < max ? cooldownFor(SPELLS[i], sv.cooldown[i]) : 0;
                    }
                } else {
                    recharge[i] = 0;
                }
            }
            const now = SPELLS.map((_, i) => `${charges[i]}/${lastMax[i]}/${Math.ceil(recharge[i] / 1000)}`).join();
            if (now !== spellShown) {
                spellShown = now;
                store.patch({ spellState: SPELLS.map((_, i) => ({ charges: charges[i], max: lastMax[i], cd: Math.ceil(recharge[i] / 1000) })) });
            }
        }
        for (let i = flying.length - 1; i >= 0; i--) {
            const f = flying[i];
            f.t += ticker.deltaMS;
            const k = Math.min(1, f.t / f.flight);
            const u = f.fu + (f.tu - f.fu) * k;
            const v = f.fv + (f.tv - f.fv) * k;
            const at = worldPoint(u, v);
            f.s.position.set(at.x, at.y - heightAt(u, v) * LEVEL_H - 46 - Math.sin(k * Math.PI) * 34);
            f.s.texture = fxFrame('fireball', Math.floor(f.t / 70) % FX.fireball.n);
            if (k >= 1) {
                f.s.destroy();
                flying.splice(i, 1);
                sim.strike(f.tu, f.tv, f.facing, f.dmg, f.radius);
                playFx('explosion', f.tu, f.tv, { scale: 2.6, life: 900, anchorY: 0.8 });
            }
        }
        for (let i = fx.length - 1; i >= 0; i--) {
            const f = fx[i];
            f.t += ticker.deltaMS;
            f.s.texture = fxFrame(f.name, Math.min(FX[f.name].n - 1, Math.floor((f.t / f.life) * FX[f.name].n)));
            if (f.t >= f.life) {
                f.s.destroy();
                fx.splice(i, 1);
            }
        }
        for (const c in buffMs) buffMs[c] = Math.max(0, buffMs[c] - ticker.deltaMS);
        const buffNow = Object.keys(buffMs).filter((c) => buffMs[c] > 0).map((c) => `${c}:${Math.ceil(buffMs[c] / 1000)}`).join(',');
        if (buffNow !== buffShown) {
            buffShown = buffNow;
            store.patch({ buffs: Object.keys(buffMs).filter((c) => buffMs[c] > 0).map((c) => ({ key: c, left: Math.ceil(buffMs[c] / 1000) })) });
        }
        for (let i = strikes.length - 1; i >= 0; i--) {
            strikes[i] -= ticker.deltaMS;
            if (strikes[i] <= 0) {
                strikes.splice(i, 1);
                sim.strike(pu, pv, character.facing, Math.max(1, Math.round((TOOL_DAMAGE[character.tool] ?? 1) * (1 + 0.15 * store.get().skills.attack) * (buffMs.blue > 0 ? 1.5 : 1) * (buffMs.black > 0 ? 2 : 1))));
            }
        }
        sim.update(ticker.deltaMS);
        const view = sim.view();
        // Online positions arrive ten times a second, so ease between them; offline updates every frame.
        monsterView.sync(view.monsters, ticker.deltaMS, view.online ? 110 : 0);
        dropView.sync(view.drops, ticker.deltaMS);
        hudClock -= ticker.deltaMS;
        if (hudClock <= 0) {
            hudClock = 150;
            // Monsters left in the wave: those alive and fighting plus those still to arrive.
            let alive = 0;
            for (const m of view.monsters) if (m.state !== 'dying') alive++;
            const waveLeft = view.run || alive > 0 ? alive + (view.run?.toSpawn ?? 0) : null;
            const frogAim = frog
                ? {
                    angle: Math.atan2((frog.u - pu + (frog.v - pv)) * TILE_DY, (frog.u - pu - (frog.v - pv)) * TILE_DX),
                    dist: Math.hypot(frog.u - pu, frog.v - pv),
                    left: Math.max(0, Math.ceil((FROG_STAYS - frog.age) / 1000)),
                }
                : null;
            store.patch({ wave: view.wave, nextWaveIn: view.nextIn, waveLeft, frogAim, sharedMonsters: view.online });
        }
        wasLocked = character.locked;

        placeCamera();
        syncChunks();
        publish();

        // Water: a swell travelling across the surface, pulsing foam, expanding ripples.
        for (const c of chunks.values()) {
            for (const w of c.waves) {
                const swell = Math.sin(clock / WAVE_MS + w.phase) * 2.4;
                w.sprite.y = w.baseY + swell;
                if (w.foam) {
                    w.foam.y = (w.foamBase ?? 0) + swell;
                    const pulse = 0.5 + 0.5 * Math.sin(clock / 520 + w.phase * 1.7);
                    w.foam.alpha = 0.18 + 0.5 * pulse;
                    w.foam.scale.set(0.9 + 0.1 * pulse);
                }
            }
            for (const r of c.ripples) {
                const t = ((clock + r.phase) % RIPPLE_MS) / RIPPLE_MS;
                r.sprite.scale.set(0.2 + 0.7 * t);
                r.sprite.alpha = 0.5 * (1 - t) * (1 - t);
                r.sprite.y = r.baseY + Math.sin(clock / WAVE_MS + r.phase) * 2.4;
            }
        }

        joyGfx.clear();
        const j = input.joystick();
        if (j) {
            joyGfx.circle(j.ox, j.oy, JOY_RADIUS).stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
            joyGfx.circle(j.kx, j.ky, 20).fill({ color: 0xffffff, alpha: 0.4 });
        }
    };
    app.ticker.add(tick);

    return {
        destroy() {
            app.ticker.remove(tick);
            offResize();
            input.destroy();
            controls.destroy();
            offStrike();
            sim.destroy();
            monsterView.destroy();
            dropView.destroy();
            store.patch({ waveLeft: null, frogAim: null, shop: false, banner: null });
            remotes.destroy();
            net.sendAway();
            if (!runOver) progress.record({ scene: 'world', u: pu, v: pv, tool: character.tool, hp: store.get().hp });
            progress.flush();
            character.destroy();
            for (const c of chunks.values()) unloadChunk(c);
            chunks.clear();
            joyGfx.destroy();
            world.destroy({ children: true });
        },
    };
}
