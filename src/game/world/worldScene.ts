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
 * A stone plaza holds the portal that leads to the workshop (the base).
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
import { progress } from '../progress.ts';
import { createRemotePlayers } from '../net/remotePlayers.ts';
import { createCharacter } from './character.ts';
import { bindControls } from './controls.ts';
import {
    CHUNK_TILES, LOAD_RADIUS, MAP_CHUNKS, MAP_TILES, TILE_DX, TILE_DY, ZOOM,
} from './constants.ts';
import { createInput, JOY_RADIUS } from './input.ts';
import { createDrops, DROP_TABLE, SKILL_CAP, SKILL_COLOR, SKILL_NAMES, type Skill } from './drops.ts';
import { createMonsters } from './monsters.ts';
import { createWaves } from './waves.ts';
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
/** Portal: 6 animation frames of 112 × 128, scaled up; the base's centre sits on its tile. */
const PORTAL_FRAMES = 6;
const PORTAL_W = 112;
const PORTAL_H = 128;
const PORTAL_SCALE = 1.45;
const PORTAL_BASE_Y = 108 / PORTAL_H;
const PORTAL_MS = 130;
/** Multiplies the stone tiles (purple-grey) to the portal's grey-teal stonework. */
const PLAZA_TINT = 0x9fffd6;
/** Walking within this many tiles of the portal's centre pulls the player in. */
const PORTAL_REACH = 1.35;
const ENTER_MS = 850;
const FLASH_MS = 350;
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
    void net.connect();

    let pz = 0; // smoothed terrace lift under the player, screen px
    let pu = MAP_TILES / 2 + 0.5;
    let pv = MAP_TILES / 2 + 0.5;
    // Debug: ?spawn=i,j starts the player on that tile (clamped to the map).
    const spawn = new URLSearchParams(window.location.search).get('spawn')?.split(',').map(Number);
    if (spawn && spawn.length === 2 && spawn.every(Number.isFinite)) {
        pu = Math.min(MAP_TILES - 1, Math.max(0, spawn[0])) + 0.5;
        pv = Math.min(MAP_TILES - 1, Math.max(0, spawn[1])) + 0.5;
    }
    // Resume where this player left off (unless they are coming back through the portal).
    if (store.get().spawnAt === 'center' && progress.saved?.world.set) {
        const { u, v } = progress.saved.world;
        if (u >= 0 && v >= 0 && u < MAP_TILES && v < MAP_TILES && map.blocked[Math.floor(v) * MAP_TILES + Math.floor(u)] === 0) {
            pu = u;
            pv = v;
        }
    }
    // Coming back from the base: step out beside the portal.
    if (store.get().spawnAt === 'portal') {
        pu = map.portal.i + 0.5;
        pv = map.portal.j + 2.5;
        store.patch({ spawnAt: 'center' });
    }
    // Debug: with ?spawn= the player is exposed for automated checks.
    if (spawn) (window as unknown as { __player?: Container }).__player = player;

    // Joystick overlay, drawn in screen space above the stage.
    const joyGfx = new Graphics();
    app.stage.addChild(joyGfx);
    const input = createInput(app.canvas);

    // Per-chunk lookups.
    const chunkOf = (i: number, j: number) => Math.floor(j / CHUNK_TILES) * MAP_CHUNKS + Math.floor(i / CHUNK_TILES);
    const plazaCells = new Set(map.plaza);
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
                // The plaza keeps one even tint so it matches the portal; the rest is mottled by tone.
                topCube.tint = t === WATER ? waterTint(depth) : plazaCells.has(k) ? PLAZA_TINT : shade(h, tone);
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

    // Portal: walking into it leaves the world for the base.
    const portalSheet = Assets.get<Texture>('portal');
    portalSheet.source.scaleMode = 'nearest';
    const portalTex = Array.from({ length: PORTAL_FRAMES }, (_, n) =>
        new Texture({ source: portalSheet.source, frame: new Rectangle(n * PORTAL_W, 0, PORTAL_W, PORTAL_H) }));
    const portalX = sx(map.portal.i + 0.5, map.portal.j + 0.5);
    const portalY = sy(map.portal.i + 0.5, map.portal.j + 0.5);
    const portalGlow = new Sprite(glowTex);
    portalGlow.anchor.set(0.5);
    portalGlow.tint = 0x5dff8a;
    portalGlow.position.set(portalX, portalY);
    portalGlow.zIndex = portalY + Z_DECAL;
    const portalSprite = new Sprite(portalTex[0]);
    portalSprite.anchor.set(0.5, PORTAL_BASE_Y);
    portalSprite.scale.set(PORTAL_SCALE);
    portalSprite.position.set(portalX, portalY);
    portalSprite.zIndex = portalY + Z_PROP;
    const portalLabel = new Text({
        text: 'WORKSHOP',
        style: { fontFamily: 'sans-serif', fontSize: 26, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x14442a, width: 6 } },
    });
    portalLabel.anchor.set(0.5);
    portalLabel.position.set(portalX, portalY - 185);
    portalLabel.zIndex = portalY + Z_PROP + 5;
    objects.addChild(portalGlow, portalSprite, portalLabel);
    const flash = new Graphics();
    app.stage.addChild(flash);
    let entering = false;
    let enterT = 0;
    let enterFrom = { x: 0, y: 0 };
    let exited = false;

    // Monsters: goblins, slimes, wolves and skeletons that hunt the local player (world/monsters.ts).
    let invuln = 0; // ms of grace after being bitten
    let bannerId = 0;
    const banner = (text: string) => store.patch({ banner: { text, id: ++bannerId } });
    const hurtPlayer = (n: number) => {
        if (invuln > 0 || character.dead || entering) return;
        invuln = 1500;
        // Defence gives a chance to block a bite outright.
        if (Math.random() < Math.min(0.6, 0.07 * store.get().skills.defence)) {
            drops.text(player.x, player.y - 70, 'Blocked!', SKILL_COLOR.defence);
            return;
        }
        store.patch({ hp: Math.max(0, store.get().hp - n) });
        character.command({ type: 'hurt' });
        net.sendAct('hurt');
    };
    const stand = (u: number, v: number) => boxOk(u, v);
    const worldPoint = (u: number, v: number) => ({ x: sx(u, v), y: sy(u, v) });
    const sortZ = (u: number, v: number) => sy(Math.floor(u) + 0.5, Math.floor(v) + 0.5) + Z_PLAYER;
    const drops = createDrops({
        layer: objects,
        glowTex,
        canStand: stand,
        heightAt,
        toScreen: worldPoint,
        zFor: sortZ,
        levelH: LEVEL_H,
        player: () => ({ u: pu, v: pv, alive: !character.dead && !entering }),
        onPickup: (skill: Skill) => {
            const level = store.get().skills[skill];
            if (level >= SKILL_CAP[skill]) return false; // already maxed: leave it
            progress.raise(skill);
            if (skill === 'vitality') store.patch({ hp: Math.min(store.get().maxHp, store.get().hp + 2) });
            const gain = skill === 'vitality' ? '+1 Heart' : `${SKILL_NAMES[skill]} ${level + 1}`;
            drops.text(player.x, player.y - 78, gain, SKILL_COLOR[skill]);
            banner(skill === 'vitality' ? 'Vitality up! +1 heart' : `${SKILL_NAMES[skill]} up! Level ${level + 1}`);
            return true;
        },
    });
    // Enemies ignore bushes, trees and rocks (they push through); water, the map edge and cliffs stop them.
    const monsterCanMove = (fu: number, fv: number, tu: number, tv: number): boolean => {
        const ti = Math.floor(tu);
        const tj = Math.floor(tv);
        if (ti < 1 || tj < 1 || ti >= MAP_TILES - 1 || tj >= MAP_TILES - 1) return false;
        if (map.terrain[tj * MAP_TILES + ti] === WATER) return false;
        return Math.abs(map.height[tj * MAP_TILES + ti] - map.height[Math.floor(fv) * MAP_TILES + Math.floor(fu)]) <= 1;
    };
    const monsters = createMonsters({
        layer: objects,
        shadowTex,
        canMove: monsterCanMove,
        heightAt,
        toScreen: (u, v) => ({ x: sx(u, v), y: sy(u, v) }),
        zFor: (u, v) => sy(Math.floor(u) + 0.5, Math.floor(v) + 0.5) + Z_PLAYER,
        levelH: LEVEL_H,
        player: () => ({ u: pu, v: pv, alive: !character.dead && !entering }),
        onBite: hurtPlayer,
        onKill: (kind, u, v) => {
            progress.addKill();
            const drop = DROP_TABLE[kind];
            if (drop && Math.random() < drop.chance && store.get().skills[drop.skill] < SKILL_CAP[drop.skill]) drops.spawn(drop.skill, u, v);
        },
    });
    // Debug: with ?spawn= the game exposes a way to drop a gem at the player's feet.
    if (new URLSearchParams(window.location.search).has('spawn')) {
        (window as unknown as { __game?: unknown }).__game = { dropAt: (skill: Skill) => drops.spawn(skill, pu + 1.4, pv + 1.4) };
    }
    // Debug: ?firstWave=<s>&waveEvery=<s> shorten the portal timers for testing.
    const q = new URLSearchParams(window.location.search);
    const waves = createWaves({
        layer: objects,
        glowTex,
        canStand: stand,
        heightAt,
        toScreen: worldPoint,
        zFor: sortZ,
        levelH: LEVEL_H,
        player: () => ({ u: pu, v: pv, alive: !character.dead }),
        monsters,
        everySec: Number(q.get('waveEvery')) || 120,
        firstSec: Number(q.get('firstWave')) || 20,
        onWave: (n) => {
            progress.reachWave(n);
            banner(`Wave ${n}! A portal has opened`);
        },
    });
    // A swing that actually started (the character was free) lands a moment later.
    const strikes: number[] = [];
    let wasLocked = false;
    const offStrike = commands.subscribe((c) => {
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
        // Actions, sitting, death and the portal pull hold the character in place.
        const walk = character.locked || entering ? { x: 0, y: 0 } : dir;
        const speed = SPEED_PX * (1 + 0.05 * store.get().skills.speed);
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

        // Portal: animate, glow, and pull the player in when they walk up to it.
        portalSprite.texture = portalTex[Math.floor(clock / PORTAL_MS) % PORTAL_FRAMES];
        portalGlow.alpha = 0.3 + 0.18 * Math.sin(clock / 380);
        portalGlow.scale.set(1.05 + 0.08 * Math.sin(clock / 380));
        portalLabel.y = portalY - 185 + Math.sin(clock / 450) * 4;
        if (!entering && !character.dead && Math.hypot(pu - (map.portal.i + 0.5), pv - (map.portal.j + 0.5)) < PORTAL_REACH) {
            entering = true;
            enterT = 0;
            enterFrom = { x: player.x, y: player.y };
        }
        if (entering) {
            enterT += ticker.deltaMS;
            const t = Math.min(1, enterT / ENTER_MS);
            const e = t * t;
            player.position.set(enterFrom.x + (portalX - enterFrom.x) * e, enterFrom.y + (portalY - 24 - enterFrom.y) * e);
            player.scale.set(1 - 0.85 * e);
            player.alpha = 1 - e;
            xray.visible = false;
            const f = Math.max(0, (enterT - ENTER_MS * 0.55) / (ENTER_MS * 0.45 + FLASH_MS));
            flash.clear().rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0xd9ffd2, alpha: Math.min(1, f) });
            if (enterT > ENTER_MS + FLASH_MS && !exited) {
                exited = true;
                store.patch({ phase: 'base' });
            }
        }

        // Character animation: face the way the stick points; idle when blocked or still.
        character.update(ticker.deltaMS, dir, pu !== fromU || pv !== fromV);
        controls.tick();
        progress.addTime(Math.min(ticker.deltaMS / 1000, 0.25));
        saveClock += ticker.deltaMS;
        if (saveClock > 1000) {
            saveClock = 0;
            progress.record({ scene: 'world', u: pu, v: pv, tool: character.tool, hp: store.get().hp });
        }
        net.sendPose({ scene: 'world', u: pu, v: pv, z: pz, face: character.facing, anim: pu !== fromU || pv !== fromV ? character.anim : 'idle', tool: character.tool });
        remotes.update(ticker.deltaMS);
        invuln = Math.max(0, invuln - ticker.deltaMS);
        for (let i = strikes.length - 1; i >= 0; i--) {
            strikes[i] -= ticker.deltaMS;
            if (strikes[i] <= 0) {
                strikes.splice(i, 1);
                monsters.strike(pu, pv, character.facing, Math.max(1, Math.round((TOOL_DAMAGE[character.tool] ?? 1) * (1 + 0.15 * store.get().skills.attack))));
            }
        }
        monsters.update(ticker.deltaMS);
        waves.update(ticker.deltaMS);
        drops.update(ticker.deltaMS);
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
            monsters.destroy();
            waves.destroy();
            drops.destroy();
            store.patch({ portalAim: null, banner: null });
            remotes.destroy();
            net.sendAway();
            progress.record({ scene: 'world', u: pu, v: pv, tool: character.tool, hp: store.get().hp });
            progress.flush();
            character.destroy();
            for (const c of chunks.values()) unloadChunk(c);
            chunks.clear();
            joyGfx.destroy();
            flash.destroy();
            world.destroy({ children: true });
        },
    };
}
