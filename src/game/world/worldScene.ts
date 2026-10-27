/**
 * The explorable region: a 384 × 384 tile isometric map streamed in 16 × 16
 * chunks. The 3 × 3 chunks around the player stay loaded, plus any chunk the
 * camera can see. Ground, decals, trees and props come from the Ultimate
 * Isometric Pack atlas. Terrain has elevation (up to mountain peaks, drawn as
 * columns of cubes) and tiles spring when the player steps on them. Every
 * cell, prop and the player live in one layer sorted back to front, so tall
 * terrain hides what is behind it; an x-ray copy of the player shows through.
 * Ground is shaded by height and a noise tone, props cast soft shadows, and
 * water deepens away from the shore with foam along the edge and ripples.
 * A wave of monsters starts every 20 seconds, harder each time; dying ends the run.
 * The survival layer (world/survivalLayer.ts) adds the kingdoms' camps, bosses, towers, houses,
 * chests, barriers and gathering; weather.ts the sky. Card, gear, gem, building and kingdom powers
 * (progress.power()) feed the combat numbers here, and the player has stamina (dodge rolls),
 * hunger, thirst and rest.
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
import { createCharacter, type Tool } from './character.ts';
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
import { generateWorld, GRASS, MAX_HEIGHT, SAND, STONE, VOID, WATER, type Flat } from './mapGen.ts';
import { STYLES } from './biomes.ts';
import { createSurvivalLayer, isTree, nearestBoss } from './survivalLayer.ts';
import { createStoryLayer, type StoryLayer } from './storyLayer.ts';
import { createIntroCinematic, type Cinematic, type CinematicView } from './cinematic.ts';
import { quest } from '../story/quest.ts';
import { createShotView } from './shots.ts';
import { createWeather } from './weather.ts';
import { createDarkness } from './darkness.ts';
import { createLightMap, type Light } from './lightmap.ts';
import { placedOf, THEMES } from './interiors.ts';
import type { Door } from './mapGen.ts';
import { settingsDark } from '../settings.ts';
import { ambience, music, rainLevel, sfx, synth } from '../audio.ts';
import { CYCLE_MS, NIGHT_START, nowSky, setSkyOffset } from '../../shared/daynight.ts';
import { mapRef, radar } from './mapRef.ts';
import { CAMP_RADIUS, CARDS, CRIT, DODGE_MS, FOOD, ITEMS, METER_DRAIN, METER_GAIN, METER_MAX, SPRINT_MUL, STAMINA_COST, STAMINA_MAX, TORCH_R, type ItemId } from '../survival.ts';
import { ELEMENTS, KINGDOMS, LANDMARKS, MIMIC_CODE } from '../eidolon.ts';

/** Walking speed in screen px / s (vertical movement is halved by the 2:1 view). */
/** Every camp's centre and its kingdom (its sanctuary ring keeps monsters out while the land is free). */
const CAMP_CENTRES = LANDMARKS.filter((l) => l.kind === 'camp').map((l) => ({ u: l.i + 0.5, v: l.j + 0.5, el: l.el! }));
const SPEED_PX = 340;
/** Player collision half-size, in tiles. */
const RADIUS = 0.28;
/** How close (tiles, centre to centre) the player may come to a tree, a rock or a chest. */
const SOLID_R = 0.62;
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
/** Overlays that take the colour of the ground under them (the rest keep their own: lava, ice, water). */
const TINTED_OVERLAY = new Set(['rubble', 'pebbles', 'moss', 'ash', 'path1', 'path2', 'path3']);
/** Elevation from which a stone tile is capped with snow. */
const SNOW_LEVEL = 7;
/** Damage a swing does to a monster (they have 6 health), by equipped tool. */
const TOOL_DAMAGE: Record<string, number> = {
    none: 1, sword: 3, axe: 2, pickaxe: 2, hammer: 3, shovel: 2, fishingpole: 1, watercan: 1, shield: 1,
};
/** Source px of the iso art → atlas px. Top-face centre of a 500 px tile is (250, 139); every frame is centred on x. */
const ANCHOR_CUBE_Y = 139 * ISO_SCALE;
const ANCHOR_TALL_Y = (500 + 139) * ISO_SCALE;

/** Screen position of grid point (u, v). */
const sx = (u: number, v: number) => (u - v) * TILE_DX;
const sy = (u: number, v: number) => (u + v) * TILE_DY;
/** A tile-space direction as a compass side of the screen (up is north). */
export function sideName(dir: number): string {
    const ang = Math.atan2((Math.cos(dir) + Math.sin(dir)) * TILE_DY, (Math.cos(dir) - Math.sin(dir)) * TILE_DX);
    const names = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
    return names[(Math.round(ang / (Math.PI / 4)) + 8) % 8];
}

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
    /** Indices into map.props drawn by this chunk. */
    props: number[];
    waves: Wave[];
    ripples: Ripple[];
    cells: Map<number, CellSprites>;
}

export function createWorldScene(app: Application, stage: Stage): Scene {
    const map = generateWorld();
    mapRef.set(map);
    const iso = Assets.get<Texture>('iso');

    const frameTex = new Map<string, Texture>();
    const frame = (name: string): Texture => {
        let t = frameTex.get(name);
        if (!t) {
            // Frames are packed trimmed; orig/trim give back the full canvas, so anchors read as before.
            const [x, y, w, h, ox, oy, fw, fh] = ISO_FRAMES[name];
            t = new Texture({ source: iso.source, frame: new Rectangle(x, y, w, h), orig: new Rectangle(0, 0, fw, fh), trim: new Rectangle(ox, oy, w, h) });
            frameTex.set(name, t);
        }
        return t;
    };

    /** Sprite for an iso-art frame whose tile centre sits at screen (x, y). */
    const isoSprite = (name: string, x: number, y: number): Sprite => {
        const tex = frame(name);
        const s = new Sprite(tex);
        const tall = tex.height > 200;
        s.anchor.set(0.5, (tall ? ANCHOR_TALL_Y : ANCHOR_CUBE_Y) / tex.height);
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
    /** Multiply two colours channel by channel. */
    const mul = (a: number, b: number): number =>
        (Math.round(((a >> 16) & 255) * ((b >> 16) & 255) / 255) << 16) | (Math.round(((a >> 8) & 255) * ((b >> 8) & 255) / 255) << 8) | Math.round((a & 255) * (b & 255) / 255);
    /** Each kingdom tints its ground; the citadel is dusky violet. */
    const regionTint = (k: number): number => (map.region[k] === 0 ? 0xc0b0d0 : KINGDOMS[ELEMENTS[map.region[k] - 1]].ground);
    const lava = (k: number) => map.region[k] === 1;
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
    // A soft white glow (rings fading outward) that takes any tint: shrines, chests, the campfire.
    const softGfx = new Graphics();
    for (let n = 8; n >= 1; n--) softGfx.ellipse(90, 45, 10 * n + 10, 5 * n + 5).fill({ color: 0xffffff, alpha: 0.13 });
    const softTex = app.renderer.generateTexture({ target: softGfx, resolution: 1 });
    softGfx.destroy();

    // Display tree: world (scaled by ZOOM) → one layer of cells, props and the
    // player, sorted back to front by zIndex, plus the player's x-ray copy.
    const world = new Container();
    world.scale.set(ZOOM);
    const objects = new Container();
    objects.sortableChildren = true;
    world.addChild(objects);
    stage.root.addChild(world);

    // The story (Land 1) is made once the combat simulation exists; survival asks it through these.
    let story: StoryLayer | null = null;
    const survival = createSurvivalLayer({
        story: {
            target: (u, v) => story?.target(u, v),
            prompt: (u, v, f) => story?.prompt(u, v, f) ?? null,
            npcCamp: (id) => (story ? story.npcCamp(id) : progress.kingdom()),
            npcAt: (id) => story?.npcAt(id) ?? null,
            gather: () => story?.gather() ?? null,
            active: () => quest.active(),
        },
        map,
        layer: objects,
        glowTex: softTex,
        shadowTex,
        heightAt: (u, v) => map.height[Math.floor(v) * MAP_TILES + Math.floor(u)],
        toScreen: (u, v) => ({ x: sx(u, v), y: sy(u, v) }),
        zFor: (u, v) => sy(Math.floor(u) + 0.5, Math.floor(v) + 0.5) + 0.3,
        levelH: LEVEL_H,
        say: (m, c) => dropView.text(player.x, player.y - 78, m, c),
        banner: (t) => banner(t),
        sparkle: (u, v) => {
            playFx('sparkle', u, v, { scale: 2.2, squash: 0.55, life: 750 });
            playFx('heal', u, v, { scale: 1.6, life: 1000, lift: 40 });
        },
        coins: (u, v) => playFx('coins', u, v, { scale: 1.4, life: 2000, lift: 40 }),
        renderer: app.renderer,
        isoSprite,
        summon: (code, tier, u, v) => sim.summon(code, tier, u, v),
        blast: (u, v, damage, r) => sim.strike(u, v, 0, damage, r),
        damageMul: () => power.damage,
        loot: (u, v, items) => sim.loot(u, v, items),
        shared: () => teammatesNear(30),
        dark: () => sky.dark,
    });

    // Player: the Character0 art with tools and actions (world/character.ts).
    const character = createCharacter((tool) => store.patch({ toolId: tool }));
    const player = character.player;
    objects.addChild(player);
    // Faint copy above everything, so the player stays visible behind mountains.
    const xray = character.xray;
    world.addChild(xray);
    // A health bar over the player's head (the HUD has the big one).
    const hpBar = new Graphics();
    world.addChild(hpBar);
    let hpBarKey = '';
    // Equip what this player last carried; controls.ts then shows it in the HUD.
    {
        const held = progress.hotbar()[progress.saved?.held ?? 0];
        const holds = held && ITEMS[held].tool ? ITEMS[held].tool!.holds : 'none';
        character.setTool((progress.hasTool(holds) ? holds : 'none') as Tool);
    }
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
    let pu = progress.home().u;
    let pv = progress.home().v;
    // Debug: ?spawn=i,j starts the player on that tile (clamped to the map).
    const spawn = new URLSearchParams(window.location.search).get('spawn')?.split(',').map(Number);
    if (spawn && spawn.length === 2 && spawn.every(Number.isFinite)) {
        pu = Math.min(MAP_TILES - 1, Math.max(0, spawn[0])) + 0.5;
        pv = Math.min(MAP_TILES - 1, Math.max(0, spawn[1])) + 0.5;
    }
    // Resume where this player left off (a debug ?spawn= wins).
    if (!spawn && progress.saved?.world.set) {
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
    const propsByChunk = new Map<number, number[]>();
    map.props.forEach((p, n) => {
        const k = chunkOf(p.i, p.j);
        let list = propsByChunk.get(k);
        if (!list) propsByChunk.set(k, (list = []));
        list.push(n);
    });
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
                // The void between the interiors is never drawn.
                if (t === VOID) continue;
                const h = map.height[k];
                const v = map.variant[k] + 1;
                const x = sx(i + 0.5, j + 0.5);
                const y = sy(i + 0.5, j + 0.5);
                // A land's biome or a cave's floor and walls draw with their own art and tint (world/biomes.ts).
                const st = t === WATER ? undefined : STYLES[map.style[k]];
                const base = t === WATER ? 'water' : st ? st.cube(v) : t === SAND ? 'sand' : t === STONE ? `stone${v}` : `dirt${v}`;
                const groundTint = (kk: number) => (st ? st.tint : regionTint(kk));
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
                    sp.tint = mul(shade(h, tone), groundTint(k));
                    add(sp, 0);
                }
                const topCube = isoSprite(base, x, y - h * LEVEL_H + lift);
                topCube.tint = t === WATER ? (lava(k) ? mul(0xff8a4a, waterTint(depth)) : waterTint(depth)) : mul(shade(h, tone), groundTint(k));
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
                        if (lava(k)) glow.tint = 0xff6a20;
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
                    g.tint = mul(shade(h, tone), st?.grass ? 0xd8f0a0 : regionTint(k));
                    add(g, Z_OVERLAY);
                } else if (t === STONE && h >= SNOW_LEVEL && !map.place[k]) add(isoSprite('snow', x, top), Z_OVERLAY);
                // The style's own overlay now and then (ash, salt crust, lava cracks, ice, moss).
                if (st?.overlay && (((i * 73856093) ^ (j * 19349663)) >>> 0) % 1000 < st.overlay.chance * 1000 && map.blocked[k] === 0) {
                    const o = isoSprite(st.overlay.name, x, top);
                    if (TINTED_OVERLAY.has(st.overlay.name)) o.tint = mul(shade(h, tone), st.tint);
                    add(o, Z_OVERLAY);
                }
                for (const f of flatsByCell.get(k) ?? []) {
                    const o = isoSprite(f.name, x, top);
                    // Stones and pebbles take the colour of the ground they lie on.
                    if (st && TINTED_OVERLAY.has(f.name)) o.tint = mul(shade(h, tone), st.tint);
                    add(o, Z_DECAL);
                }
                cells.set(k, cell);
            }
        }

        const propIds = propsByChunk.get(key(cx, cy)) ?? [];
        for (const n of propIds) {
            const p = map.props[n];
            const k = p.j * MAP_TILES + p.i;
            const x = sx(p.i + 0.5, p.j + 0.5);
            const y = sy(p.i + 0.5, p.j + 0.5);
            const inWater = map.terrain[k] === WATER;
            const py = y - map.height[k] * LEVEL_H + (inWater ? Math.min(MAX_DEPTH, map.shoreDist[k] - 1) * DEPTH_STEP : 0);
            const s = isoSprite(p.name, x, py);
            s.zIndex = y + Z_PROP + p.i * 0.0001;
            objects.addChild(s);
            sprites.push(s);
            survival.trackProp(n, s);
            // A soft shadow grounds everything that stands (tall grass and flowers excepted).
            if (!/^(tallgrass|dbush|big_|hole|ladder|skull|bones|candle|mush)/.test(p.name)) {
                const big = isTree(p.name) ? (p.name.endsWith('_s2') || p.name.startsWith('tree_bamboo') ? 0.8 : p.name.endsWith('_s3') ? 1.1 : 1.45) : p.name.startsWith('rock') ? 0.95 : 1.1;
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
        return { sprites, props: propIds, waves, ripples, cells };
    };

    const unloadChunk = (c: Chunk) => {
        for (const n of c.props) survival.untrackProp(n);
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
        // A tree, a rock or a chest stands in the middle of its tile: it stops you there, not at the
        // tile's edge (a whole blocked tile around a small rock reads as an invisible wall).
        for (let j = Math.floor(v) - 1; j <= Math.floor(v) + 1; j++) {
            for (let i = Math.floor(u) - 1; i <= Math.floor(u) + 1; i++) {
                if (i < 0 || j < 0 || i >= MAP_TILES || j >= MAP_TILES) continue;
                if (map.solid[j * MAP_TILES + i] === 1 && Math.hypot(u - i - 0.5, v - j - 0.5) < SOLID_R) return false;
            }
        }
        for (let j = Math.floor(v - RADIUS); j <= Math.floor(v + RADIUS); j++) {
            for (let i = Math.floor(u - RADIUS); i <= Math.floor(u + RADIUS); i++) {
                if (i < 0 || j < 0 || i >= MAP_TILES || j >= MAP_TILES) return false;
                const k = j * MAP_TILES + i;
                if ((map.blocked[k] === 1 && map.solid[k] === 0) || !survival.canEnter(i, j) || (story && !story.canEnter(i, j))) return false;
                lo = Math.min(lo, map.height[k]);
                hi = Math.max(hi, map.height[k]);
            }
        }
        return hi - lo <= 1;
    };
    const heightAt = (u: number, v: number): number => map.height[Math.floor(v) * MAP_TILES + Math.floor(u)];

    /** A cinematic's camera (where it looks, its zoom and shake), or null to follow the player. */
    let cineCam: CinematicView | null = null;
    const placeCamera = () => {
        // Aim a little above the feet so the player sits near the screen centre (shaken by critical hits).
        if (cineCam) {
            const { u, v, zoom } = cineCam.cam;
            const z = ZOOM * zoom;
            const k = cineCam.shake * 10;
            world.scale.set(z);
            world.position.set(
                stage.designWidth() / 2 - sx(u, v) * z + (Math.random() - 0.5) * k,
                stage.height / 2 - (sy(u, v) - heightAt(u, v) * LEVEL_H - 30) * z + (Math.random() - 0.5) * k,
            );
            return;
        }
        if (world.scale.x !== ZOOM) world.scale.set(ZOOM);
        const shake = shakeMs > 0 ? (shakeMs / 220) * 7 : 0;
        world.position.set(
            stage.designWidth() / 2 - sx(pu, pv) * ZOOM + (Math.random() - 0.5) * shake,
            stage.height / 2 - (sy(pu, pv) - pz - 20) * ZOOM + (Math.random() - 0.5) * shake,
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
    const buffMs: Record<string, number> = { blue: 0, yellow: 0, purple: 0, black: 0, night: 0, oilfire: 0, oilice: 0, bulwark: 0 };
    const BUFF_MS: Record<string, number> = { blue: 20000, yellow: 30000, purple: 12000, black: 15000, night: 90000, oilfire: 60000, oilice: 60000 };
    /** Which timed effect each drink or oil gives. */
    const BUFF_OF: Partial<Record<ItemId, string>> = { potion_blue: 'blue', potion_yellow: 'yellow', potion_purple: 'purple', potion_night: 'night', oil_fire: 'oilfire', oil_ice: 'oilice' };
    // Day and night (?night starts in the dark, ?day in the morning, for testing).
    if (new URLSearchParams(window.location.search).has('night')) setSkyOffset(NIGHT_START - (Date.now() % CYCLE_MS));
    else if (new URLSearchParams(window.location.search).has('day')) setSkyOffset(-(Date.now() % CYCLE_MS));
    let sky = nowSky();
    let skyShown = '';
    // The combat meter charges the home kingdom's active skill.
    let meter = 0;
    let meterShown = -1;
    const charge = (n: number) => {
        meter = Math.min(METER_MAX, meter + n);
    };
    /** Teammates in the world within `range` tiles (and standing). */
    const teammatesNear = (range: number) => {
        if (!net.online()) return false;
        for (const r of net.remotes.values()) if (r.pose && !r.pose.dead && Math.hypot(r.pose.u - pu, r.pose.v - pv) < range) return true;
        return false;
    };
    // Co-op: falling with a teammate standing means waiting to be helped up (or bleeding out).
    let downed = 0; // ms left
    const DOWNED_MS = 30000;
    let nearWater = false;
    /** A decoy left by Lightning Dash, and Glacial Spike's ice wall: both keep hurting what comes near. */
    const zones: { u: number; v: number; t: number; every: number; next: number; r: number; dmg: number; stun: number; fx: 'bolt' | 'frost'; g: Graphics }[] = [];
    let buffShown = '';
    // Card, gear, gem, building, level and kingdom powers (progress.power()), refreshed a few times a second.
    let power = progress.power();
    let phoenixUsed = false;
    let regenAcc = 0;
    let swings = 0;
    const busy = () => {
        const st = store.get();
        return st.shop || st.bagTab !== null || st.storyPopup !== null || st.puzzle !== null || st.loom || st.debate || st.npc !== null || st.house !== null || st.travel || st.kingdom === null;
    };
    // Stamina: swings, gathering and dodge rolls spend it; it comes back after a short pause.
    let stamina = STAMINA_MAX;
    let staminaIdle = 0;
    let tired = 0; // ms left of being worn out
    let staminaShown = '';
    const staminaMax = () => {
        const rest = progress.meters().rest;
        return STAMINA_MAX * (rest <= 0 ? 0.35 : rest < 30 ? 0.6 : 1);
    };
    const spend = (n: number): boolean => {
        staminaIdle = 0;
        if (tired > 0) return false;
        if (buffMs.yellow > 0) n *= 0.6;
        stamina = Math.max(0, stamina - n);
        if (stamina <= 0) {
            tired = 1300;
            dropView.text(player.x, player.y - 92, 'Exhausted!', 0xfacc15);
        }
        return true;
    };
    // Dodge roll: a quick dash with a moment of no damage.
    /** A dodge roll (or Lightning Dash): its clock, direction, length, and which way it spins. */
    let roll: { t: number; du: number; dv: number; tiles?: number; dash?: boolean; spin: number; iframes: boolean; trail: number } | null = null;
    /** Distance a roll has covered after `t` ms: still during the wind-up, eased through the tumble, a short skid after. */
    const rollDist = (r: NonNullable<typeof roll>, t: number): number => {
        const W = r.dash ? 0 : DODGE_MS.windup, T = r.dash ? 220 : DODGE_MS.tumble, R = r.dash ? 80 : DODGE_MS.recover;
        const tiles = r.tiles ?? ROLL_TILES;
        const k = Math.min(1, Math.max(0, (t - W) / T));
        const tumble = tiles * (1 - Math.pow(1 - k, 3));
        const kr = Math.min(1, Math.max(0, (t - W - T) / R));
        return tumble + 0.3 * (1 - Math.pow(1 - kr, 2));
    };
    const rollLength = (r: NonNullable<typeof roll>) => (r.dash ? 300 : DODGE_MS.windup + DODGE_MS.tumble + DODGE_MS.recover);
    // Screen shake (critical hits).
    let shakeMs = 0;
    // Pyraxis: burn stacks build up while you keep hitting.
    let burnStacks = 0;
    let lastBurnHit = -1e9;
    const ROLL_MS = 260;
    const ROLL_TILES = 3;
    // Survival meters: the clock for starving / thirst damage.
    let starve = 0;
    let parched = 0;
    // Elemental infusion and core effects.
    let hits = 0;
    const burns: { t: number; u: number; v: number; dmg: number; r?: number }[] = [];
    let barrierNote = 0;
    /** The wave a warning was last given for. */
    let warnedWave = 0;
    /** The level and story step last seen (their rise shows an effect). */
    let shownLevel = 0;
    let shownStep = -1;
    let rainShown = 0;
    /** Ms since the last fight ended (exploration music comes back after a short breath). */
    let calmFor = 0;
    const hurtPlayer = (n: number) => {
        if (invuln > 0 || character.dead || busy()) return; // no bites while a menu or story is open
        invuln = 1500;
        if (buffMs.purple > 0) {
            dropView.text(player.x, player.y - 70, 'Shielded!', POTION_COLOR.purple);
            return;
        }
        // A Flashback Surge's hyper-armour, Lyra's Aegis, the Martyr's Ring.
        const storyMul = story?.hurtMul() ?? 1;
        if (storyMul <= 0) {
            dropView.text(player.x, player.y - 70, 'Unbroken!', 0xfde68a);
            return;
        }
        if (storyMul < 1) n = Math.max(1, Math.round(n * storyMul));
        if (buffMs.black > 0) n *= 2;
        // Worn out: the blows land harder.
        if (tired > 0) n += 1;
        // Defence gives a chance to block a bite outright.
        // Thorns: the biter (and anything next to you) gets hurt back.
        if (power.thorns > 0) sim.strike(pu, pv, character.facing, power.thorns, 1.6);
        charge(METER_GAIN.hurt);
        if (Math.random() < Math.min(0.9, power.block + (buffMs.bulwark > 0 ? 0.5 : 0))) {
            dropView.text(player.x, player.y - 70, 'Blocked!', SKILL_COLOR.defence);
            return;
        }
        // Armour soaks a share of every bite (a fraction becomes a chance of one point).
        const soaked = n * (1 - power.armor);
        n = Math.floor(soaked) + (Math.random() < soaked - Math.floor(soaked) ? 1 : 0);
        if (n <= 0) {
            dropView.text(player.x, player.y - 70, 'Armour held!', 0xcbd5e1);
            return;
        }
        let hp = Math.max(0, store.get().hp - n);
        // Phoenix Feather: once a run, rise again instead of falling.
        if (hp === 0 && power.phoenix > 0 && !phoenixUsed) {
            phoenixUsed = true;
            hp = Math.max(1, Math.ceil(store.get().maxHp * power.phoenix));
            invuln = 3000;
            playFx('heal', pu, pv, { scale: 1.8, life: 1100, lift: 56 });
            banner('Phoenix Feather! You rise again');
            sfx('revive');
        }
        store.patch({ hp });
        story?.onHurt(hp, store.get().maxHp);
        playFx('splat', pu, pv, { scale: 2.2, life: 600, lift: 44 });
        sfx(hp === 0 ? 'fall' : 'hurt');
        character.command({ type: 'hurt' });
        net.sendAct('hurt');
    };
    // The run: it ends when the player dies (Game Over screen + leaderboard).
    let runKills = 0;
    let runSeconds = 0;
    let deadFor = 0;
    let runOver = false;
    const q = new URLSearchParams(window.location.search);
    /** Reading a story page or talking (the waves hold), and standing safe in a camp (monsters lose you). */
    let calmNow = false;
    let calmSent = '';
    let calmSentAt = 0;
    const sim = createWorldSim({
        map,
        player: () => ({ id: 'me', u: pu, v: pv, alive: !character.dead }),
        calm: () => calmNow,
        safe: () => store.get().inCamp && !story?.sieging(),
        // The camps' sanctuary rings: monsters stop at the edge (except in a siege).
        noGo: (u, v) => !story?.sieging() && CAMP_CENTRES.some((c) => Math.hypot(u - c.u, v - c.v) < CAMP_RADIUS && progress.open(c.el)),
        // Debug: ?firstWave=<s>&waveEvery=<s> shorten the wave timers when playing offline.
        everySec: Number(q.get('waveEvery')) || 90,
        firstSec: Number(q.get('firstWave')) || 20,
        // Debug: ?swordMul=40 makes sword drops common when playing offline, for testing.
        swordMul: Number(q.get('swordMul')) || 1,
        potionMul: Number(q.get('potionMul')) || 1,
        on: {
            bite: hurtPlayer,
            kill: (kind: string, boss: number) => {
                runKills++;
                // The Hollowed are your own guildmates: a blunt tool knocks them out (they are carried to the Spire), a blade kills them.
                if (kind === 'hollowed') {
                    if (character.tool === 'pickaxe' || character.tool === 'hammer') {
                        quest.bump('rescued');
                        progress.gainXp(8);
                        dropView.text(player.x, player.y - 100, 'Knocked out: carried to the Spire', 0x86efac);
                    } else dropView.text(player.x, player.y - 100, 'You knew his face...', 0xfca5a5);
                }
                sfx('kill');
                charge(METER_GAIN.kill);
                // A Mimic's hoard spills out where it died (only the one who killed it drops it, so it is not doubled).
                if (boss === MIMIC_CODE) {
                    const m = sim.view().monsters.find((x) => x.boss === MIMIC_CODE);
                    sim.loot(m?.u ?? pu, m?.v ?? pv, [['gold', 2], ['crystal', 2], ['potion_red', 1], ['gland', 2]]);
                    if (Math.random() < 0.8) {
                        const card = progress.rollCard(0.4);
                        const lv = progress.addCard(card);
                        banner(lv === 1 ? `New card: ${CARDS[card].name}!` : `${CARDS[card].name} reached level ${lv}!`);
                    }
                }
                // Night-stalker eyes come from the dark; glands from anything.
                if (sky.dark > 0.5 && Math.random() < 0.2) progress.addItem('stalker_eye', 1);
                if (Math.random() < 0.15) progress.addItem('gland', 1);
                // Meat to cook.
                if ((kind === 'wolf' || kind === 'goblin' || kind === 'scorpion' || kind === 'brute') && Math.random() < 0.35 && progress.addItem('meat', 1) > 0) dropView.text(player.x, player.y - 118, '+1 Raw meat', 0xf0a090);
                progress.addKill();
                progress.stat('kills');
                progress.gainXp(3 + Math.floor(store.get().wave / 2));
                // Monster parts for crafting.
                const PART: Record<string, ItemId> = {
                    wolf: 'leather', goblin: 'leather', archer: 'leather', brute: 'leather', skeleton: 'horn', scorpion: 'horn', wraith: 'horn',
                    kobolt: 'iron', slime: 'herb', wizard: 'crystal_dust', bomber: 'gland',
                };
                const part: ItemId | null = PART[kind] ?? null;
                if (part && Math.random() < (kind === 'brute' || kind === 'wizard' ? 0.6 : 0.3) && progress.addItem(part, 1) > 0) dropView.text(player.x, player.y - 100, `+1 ${ITEMS[part].name}`, 0xe7c9a9);
                if (power.vampire > 0 && Math.random() < power.vampire && store.get().hp < store.get().maxHp) {
                    store.patch({ hp: Math.min(store.get().maxHp, store.get().hp + 1) });
                    dropView.text(player.x, player.y - 60, '+1', 0xff5a7a);
                }
                // A rare card straight from the fight.
                if (Math.random() < 0.012 + 0.001 * store.get().wave) {
                    const card = progress.rollCard(0.05 * store.get().wave);
                    const lv = progress.addCard(card);
                    banner(lv === 1 ? `New card: ${CARDS[card].name}!` : `${CARDS[card].name} reached level ${lv}!`);
                }
            },
            gain: (kind: DropKind, sword: number) => {
                sfx(kind === 'sword' ? 'card' : 'pickup');
                playFx('pickup', pu, pv, { scale: 2, life: 1150, lift: 50 });
                if (kind.startsWith('item_')) {
                    const id = kind.slice(5) as ItemId;
                    const got = ITEMS[id] ? progress.addItem(id, Math.max(1, sword)) : 0;
                    if (got > 0) dropView.text(player.x, player.y - 78, `+${got} ${ITEMS[id].name}`, 0xfff3c4);
                    return;
                }
                if (kind.startsWith('potion_')) {
                    const c = kind.slice(7);
                    const colour = POTION_COLOR[c];
                    if (c !== 'black') {
                        // Kept in the bag: drink it when you need it.
                        const id = kind as ItemId;
                        if (progress.addItem(id, 1) > 0) dropView.text(player.x, player.y - 78, `+1 ${ITEMS[id].name}`, colour);
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
            slam: (u, v, r) => {
                sfx('explosion', Math.max(0.3, 1 - Math.hypot(u - pu, v - pv) / 20));
                playFx('explosion', u, v, { scale: 1.6 + r * 0.5, life: 700, anchorY: 0.7 });
                playFx('frost', u, v, { scale: (r * 176) / FX.frost.w, squash: 0.55, life: 500 });
            },
            boss: (code, u, v) => {
                if (code === MIMIC_CODE) return;
                // Anyone who fought it nearby counts it.
                if (Math.hypot(u - pu, v - pv) > 30) return;
                const msg = progress.defeatBoss(code);
                quest.on({ type: 'boss', code });
                if (msg) {
                    banner(msg);
                    playFx('heal', pu, pv, { scale: 1.8, life: 1200, lift: 56 });
                }
            },
            wave: (n) => {
                sfx('wave');
                playFx('alert', pu, pv, { scale: 2, life: 930, lift: 120 });
                progress.reachWave(n);
                banner(`Wave ${n}! They come from the ${sideName(sim.view().waveDir)}`);
                store.patch({ wave: n });
                progress.checkStory();
            },
            cleared: () => {
                sfx('levelup', 0.7);
                const s = sim.view().nextIn;
                banner(`Onslaught beaten! ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} to rest, build and brew`);
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
        // Hits spark, the fallen go up in skull smoke, new arrivals rise from a puff of dust.
        onFx: (what, u, v, big) => {
            if (what === 'hurt') playFx('hit', u, v, { scale: big ? 2.6 : 1.7, life: 420, lift: big ? 60 : 32 });
            else if (what === 'die') playFx('death', u, v, { scale: big ? 4.5 : 3, life: 800, lift: 30 });
            else playFx('spawn', u, v, { scale: 2.6, life: 650, lift: 12 });
        },
    });
    const shotView = createShotView({ layer: objects, toScreen: worldPoint, heightAt, zFor: sortZ, levelH: LEVEL_H });
    const dropView = createDropView({
        layer: objects,
        glowTex,
        heightAt,
        toScreen: worldPoint,
        zFor: sortZ,
        levelH: LEVEL_H,
        player: () => ({ u: pu, v: pv, alive: !character.dead }),
        wantsSkill: (kind: DropKind) => {
            return kind === 'sword' || kind.startsWith('potion_') || store.get().gems[kind as Skill] < GEM_CAP;
        },
        onTouch: (id) => sim.take(id),
    });
    story = createStoryLayer({
        map,
        layer: objects,
        glowTex: softTex,
        heightAt: (u, v) => map.height[Math.floor(v) * MAP_TILES + Math.floor(u)],
        toScreen: (u, v) => ({ x: sx(u, v), y: sy(u, v) }),
        zFor: (u, v) => sy(Math.floor(u) + 0.5, Math.floor(v) + 0.5) + 0.3,
        levelH: LEVEL_H,
        say: (m, c) => dropView.text(player.x, player.y - 78, m, c),
        banner: (t) => banner(t),
        fx: (name, u, v, opts) => playFx(name, u, v, opts),
        encounter: (kinds, u, v, level) => sim.encounter(kinds, u, v, level),
        summon: (code, tier, u, v) => sim.summon(code, tier, u, v),
        ward: (code, share) => sim.ward(code, share),
        cripple: (code, what) => sim.cripple(code, what),
        blast: (u, v, damage, r, stunMs) => sim.strike(u, v, 0, damage, r, stunMs ?? 0),
        hurt: (n) => {
            invuln = 0;
            hurtPlayer(n);
        },
        heal: (n) => store.patch({ hp: Math.min(store.get().maxHp, store.get().hp + n) }),
        damageMul: () => power.damage,
    });
    const endRun = () => {
        runOver = true;
        sfx('gameover');
        music.set('none');
        const wave = Math.max(1, sim.view().wave);
        const score = runScore(wave, runKills);
        net.sendAway();
        const lost = progress.endRun();
        if (lost.lostItems > 0 || lost.lostGems > 0) banner(`Lost ${lost.lostItems} materials and ${lost.lostGems} gems. A bigger Storehouse keeps more`);
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
        (window as unknown as { __game?: unknown }).__game = { map, view: () => sim.view(), pos: () => ({ u: pu, v: pv }), store, progress, quest, spawn: (kind: string, du: number, dv: number) => sim.debugSpawn(kind, pu + du, pv + dv), summon: (code: number, du: number, dv: number) => sim.summon(code, 0, pu + du, pv + dv) };
    }
    let hudClock = 0;
    // A swing that actually started (the character was free) lands a moment later.
    const strikes: number[] = [];
    let wasLocked = false;
    /** Blows landed in a row (the fourth bursts as a Runic Fracture). */
    let combo = 0;
    let comboAt = -1e9;
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
            const { w, h, c } = FX[name];
            t = new Texture({ source: sheet.source, frame: new Rectangle((f % c) * w, Math.floor(f / c) * h, w, h) });
            fxTex.set(k, t);
        }
        return t;
    };
    const fx: { s: Sprite; name: FxName; t: number; life: number; keep?: boolean }[] = [];
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
        Math.max(1, Math.round(base * power.spellDamage * (buffMs.blue > 0 ? 1.5 : 1) * (buffMs.black > 0 ? 2 : 1)));
    const spellCooldown = (i: number) => Math.round(cooldownFor(SPELLS[i], store.get().spells.cooldown[i]) * power.spellCooldown);
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
        sfx('spell');
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
        if (recharge[index] <= 0) recharge[index] = spellCooldown(index);
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
    /** Eat, drink or drink a potion from the bag; set down a trap or barricade. */
    const useItem = (id: ItemId) => {
        if (character.dead || !ITEMS[id] || store.get().bag[id] < 1) return;
        if (ITEMS[id].placeable) {
            if (story?.place(id, pu, pv, character.facing)) quest.on({ type: 'place', item: id });
            else if (survival.place(id, pu, pv, character.facing)) quest.on({ type: 'place', item: id });
            else dropView.text(player.x, player.y - 78, 'No room there', 0xffffff);
            return;
        }
        if (id === 'filter_draught') {
            if (progress.useItem(id)) {
                story?.drink(id);
                playFx('poison', pu, pv, { scale: 2, life: 1200, lift: 56 });
            }
            return;
        }
        if (!ITEMS[id].usable) return;
        if (FOOD[id]) {
            const got = progress.consume(id);
            if (!got) return;
            const st = store.get();
            if (got.sick) {
                store.patch({ hp: Math.max(1, st.hp - 1) });
                playFx('poison', pu, pv, { scale: 2.4, life: 1600, lift: 64 });
                dropView.text(player.x, player.y - 78, 'Your stomach turns…', 0x9be36b);
            } else if (got.heal > 0 && st.hp < st.maxHp) {
                const amount = Math.max(1, Math.round(got.heal * power.potion));
                store.patch({ hp: Math.min(st.maxHp, st.hp + amount) });
                dropView.text(player.x, player.y - 78, `+${amount} Health`, 0xff7a7a);
                playFx('heal', pu, pv, { scale: 1.2, life: 900, lift: 56 });
                sfx('revive', 0.5);
            } else {
                dropView.text(player.x, player.y - 78, ITEMS[id].name, 0xffe2b0);
            }
            return;
        }
        const heal = (n: number) => {
            const st = store.get();
            if (st.hp >= st.maxHp) {
                dropView.text(player.x, player.y - 78, 'Already at full health', 0xffffff);
                return false;
            }
            const amount = Math.max(1, Math.round(n * power.potion));
            store.patch({ hp: Math.min(st.maxHp, st.hp + amount) });
            dropView.text(player.x, player.y - 78, `+${amount} Health`, 0xff7a7a);
            playFx('heal', pu, pv, { scale: 1.2, life: 900, lift: 56 });
            return true;
        };
        let used = false;
        if (id === 'potion_red') used = heal(4);
        else if (id === 'meal') used = heal(6);
        else if (id === 'berries') used = heal(1);
        else {
            const c = BUFF_OF[id];
            if (c) {
                buffMs[c] = BUFF_MS[c] * power.potion;
                const look: FxName = id === 'potion_blue' || id === 'oil_fire' ? 'atkup' : id === 'potion_purple' || id === 'oil_ice' ? 'defup' : id === 'potion_yellow' ? 'haste' : 'pickup';
                playFx(look, pu, pv, { scale: 2.4, life: 1300, lift: 56 });
                if (id === 'potion_yellow') stamina = staminaMax();
                sfx('levelup', 0.7);
                banner(`${ITEMS[id].name}: ${ITEMS[id].blurb.toLowerCase()}`);
                used = true;
            }
        }
        if (used) progress.useItem(id);
    };
    /** A spot `d` tiles in front of the player. */
    const ahead = (d: number) => {
        const a = (character.facing * Math.PI) / 4;
        return { u: pu + ((Math.cos(a) + Math.sin(a)) / Math.SQRT2) * d, v: pv + ((Math.sin(a) - Math.cos(a)) / Math.SQRT2) * d };
    };
    const zone = (u: number, v: number, o: { t: number; every: number; r: number; dmg: number; stun: number; fx: 'bolt' | 'frost'; color: number }) => {
        const g = new Graphics();
        if (o.fx === 'frost') {
            for (let n = 0; n < 4; n++) {
                const x = (n - 1.5) * 12;
                g.poly([x - 7, 0, x + 7, 0, x, -30 - (n % 2) * 12]).fill({ color: 0xbfeaff, alpha: 0.9 }).stroke({ width: 2, color: 0x2b6a8f });
            }
        } else {
            g.circle(0, -30, 16).fill({ color: o.color, alpha: 0.5 }).stroke({ width: 3, color: 0xffffff, alpha: 0.8 });
            g.rect(-6, -22, 12, 22).fill({ color: o.color, alpha: 0.45 });
        }
        const at = worldPoint(u, v);
        g.position.set(at.x, at.y - heightAt(u, v) * LEVEL_H);
        g.zIndex = sortZ(u, v);
        objects.addChild(g);
        zones.push({ u, v, t: o.t, every: o.every, next: 0, r: o.r, dmg: o.dmg, stun: o.stun, fx: o.fx, g });
    };
    const offRevive = net.onEvent((e) => {
        if (e.type !== 'revived' || !character.dead || runOver) return;
        downed = 0;
        deadFor = 0;
        store.patch({ downed: null, hp: Math.max(1, Math.ceil(store.get().maxHp / 2)) });
        character.command({ type: 'die' }); // getting up
        invuln = 2500;
        banner(`${e.by} helped you up!`);
        sfx('revive');
    });
    /** Everyone in the team fell (or no one came in time): back to camp, full health. */
    const teamWipe = () => {
        const h = progress.home();
        deadFor = 0;
        invuln = 3000;
        store.patch({ downed: null, hp: store.get().maxHp, travelTo: h });
        character.command({ type: 'die' }); // getting up
        banner('Your team fell. You wake at camp (your tools took some wear)');
        sfx('revive');
    };
    const useSkill = () => {
        const home = store.get().kingdom;
        if (!home || character.dead || busy()) return;
        if (meter < METER_MAX) {
            dropView.text(player.x, player.y - 92, `${KINGDOMS[home].skill.name} is charging (${Math.round(meter)}%)`, 0xfacc15);
            return;
        }
        meter = 0;
        const dmg = Math.max(3, Math.round(5 * power.damage));
        banner(`${KINGDOMS[home].skill.name}!`);
        sfx(home === 'fire' ? 'skill_fire' : home === 'air' ? 'skill_air' : home === 'water' ? 'skill_water' : 'skill_earth');
        if (home === 'fire') {
            // Flame Burst: a ring of fire all around, and the ground keeps burning a moment.
            sim.strike(pu, pv, character.facing, dmg + 2, 3.4);
            for (let n = 0; n < 8; n++) {
                const a = (n / 8) * Math.PI * 2;
                playFx('explosion', pu + Math.cos(a) * 2.2, pv + Math.sin(a) * 2.2, { scale: 1.3, life: 700, anchorY: 0.75 });
            }
            burns.push({ t: 700, u: pu, v: pv, dmg: Math.max(1, Math.round(dmg * 0.4)), r: 3 }, { t: 1400, u: pu, v: pv, dmg: Math.max(1, Math.round(dmg * 0.4)), r: 3 });
        } else if (home === 'air') {
            // Lightning Dash: phase forward, leaving a crackling decoy behind.
            playFx('aura', pu, pv, { scale: 3.2, life: 1000, lift: 40 });
            zone(pu, pv, { t: 4500, every: 600, r: 2.4, dmg: Math.max(1, Math.round(dmg * 0.5)), stun: 400, fx: 'bolt', color: 0x7dd3fc });
            const a = (character.facing * Math.PI) / 4;
            const ru = (Math.cos(a) + Math.sin(a)) / Math.SQRT2, rv = (Math.sin(a) - Math.cos(a)) / Math.SQRT2;
            roll = { t: 0, du: ru, dv: rv, tiles: 5, dash: true, spin: 0, iframes: false, trail: 0 };
            invuln = Math.max(invuln, 600);
            playFx('bolt', pu, pv, { scale: 2.4, life: 500, anchorY: 0.92 });
        } else if (home === 'water') {
            // Glacial Spike: a line of ice spikes ahead that freeze what they touch, and stay a while.
            for (let n = 1; n <= 4; n++) {
                const at = ahead(0.4 + n * 0.85);
                sim.strike(at.u, at.v, character.facing, dmg, 1.1, 2500);
                playFx('frost', at.u, at.v, { scale: 0.9, squash: 0.55, life: 500 });
                zone(at.u, at.v, { t: 3500, every: 800, r: 0.9, dmg: 1, stun: 1500, fx: 'frost', color: 0xbfeaff });
            }
        } else {
            // Stone Bulwark: a wall of rock ahead stuns what is there, and your skin turns to stone for a while.
            const at = ahead(1.6);
            sim.strike(at.u, at.v, character.facing, dmg, 2.2, 2000);
            for (let n = -2; n <= 2; n++) {
                const a = (character.facing * Math.PI) / 4 + Math.PI / 2;
                const ru = (Math.cos(a) + Math.sin(a)) / Math.SQRT2, rv = (Math.sin(a) - Math.cos(a)) / Math.SQRT2;
                const ru2 = at.u + ru * n * 0.7, rv2 = at.v + rv * n * 0.7;
                const rock = isoSprite(`rock${1 + ((n + 2) % 5)}`, worldPoint(ru2, rv2).x, worldPoint(ru2, rv2).y - heightAt(ru2, rv2) * LEVEL_H);
                rock.zIndex = sortZ(ru2, rv2);
                objects.addChild(rock);
                fx.push({ s: rock, name: 'sparkle', t: 0, life: 2500, keep: true });
            }
            playFx('sparkle', at.u, at.v, { scale: 2.6, squash: 0.55, life: 600 });
            buffMs.bulwark = 6000;
        }
    };
    // The blade in hand follows the save (a relic taken up from the Gear tab, or won from a guardian).
    const offSword = store.subscribe(() => {
        const i = store.get().swordIdx;
        if (i !== character.sword) character.setSword(i);
    });
    let cinematic: Cinematic | null = null;

    // ---- caves, dungeons and ruins (world/interiors.ts)
    /** The interior the player is in (its index + 1 in PLACED; 0 = the overworld). */
    let here = 0;
    /** Going through a door: the fade out, the move, the fade in. */
    let door: { d: Door; t: number; moved: boolean } | null = null;
    /** When each interior's foes last came out (they wait a while before coming again). */
    const roused = new Map<number, number>();
    const lights = createLightMap(app, stage.root);
    const fadeGfx = new Graphics();
    app.stage.addChild(fadeGfx);
    const DOOR_OUT = 260, DOOR_HOLD = 160, DOOR_IN = 380;
    const stepDoor = (dtMs: number) => {
        fadeGfx.clear();
        if (!door) return;
        door.t += dtMs;
        const t = door.t;
        if (t >= DOOR_OUT && !door.moved) {
            door.moved = true;
            pu = door.d.u;
            pv = door.d.v;
            pz = heightAt(pu, pv) * LEVEL_H;
            standI = Math.floor(pu);
            standJ = Math.floor(pv);
            character.setFacing(door.d.face);
            story?.teleported(pu, pv);
            placeCamera();
            syncChunks();
            if (door.d.place) banner(door.d.name);
        }
        const a = t < DOOR_OUT ? t / DOOR_OUT : t < DOOR_OUT + DOOR_HOLD ? 1 : Math.max(0, 1 - (t - DOOR_OUT - DOOR_HOLD) / DOOR_IN);
        fadeGfx.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0x000000, alpha: a });
        if (t >= DOOR_OUT + DOOR_HOLD + DOOR_IN) door = null;
    };
    /** Where the player is: the overworld or an interior (its music, its dark, its foes coming out). */
    const noteWhere = () => {
        const n = map.place[Math.floor(pv) * MAP_TILES + Math.floor(pu)] ?? 0;
        if (n === here) return;
        here = n;
        const p = placedOf(n);
        store.patch({ indoors: p ? p.def.name : null });
        if (!p) return;
        // Found for the first time: a little fanfare and some experience.
        if (progress.discover(p.def.id)) {
            sfx('chapter', 0.7);
            dropView.text(player.x, player.y - 92, 'Discovered! +25 XP', 0xfde68a);
        }
        // Its foes come out (not again for six minutes).
        const last = roused.get(n);
        if (last === undefined || clock - last > 360000) {
            roused.set(n, clock);
            const th = THEMES[p.def.theme];
            for (const s of map.spawns) {
                if (s.n !== n) continue;
                // One foe to a lair, and none waiting right inside the door you came in by (no ambush on the threshold).
                if (Math.hypot(s.i + 0.5 - pu, s.j + 0.5 - pv) < 7) continue;
                sim.encounter([th.foes[Math.floor(Math.random() * th.foes.length)]], s.i + 0.5, s.j + 0.5, p.def.level);
            }
        }
    };
    /** The interior's dark, with every light near the player cut out of it (and the hero's own). */
    const lightInterior = (dtMs: number) => {
        const p = placedOf(here);
        if (!p) {
            lights.update(0, [], dtMs);
            return;
        }
        const th = THEMES[p.def.theme];
        const scale = world.worldTransform.a;
        const out: Light[] = [];
        const at = (u: number, v: number, lift: number) => world.toGlobal({ x: sx(u, v), y: sy(u, v) - heightAt(u, v) * LEVEL_H - lift });
        const me = at(pu, pv, 40);
        const torch = buffMs.night > 0 ? 6.5 : 4.2;
        out.push({ x: me.x, y: me.y, r: torch * TILE_DX * scale, color: 0xffd9a0, flicker: 0.6 });
        for (const l of map.lights) {
            if (Math.abs(l.i - pu) > 16 || Math.abs(l.j - pv) > 16) continue;
            const q = at(l.i + 0.5, l.j + 0.5, 50);
            out.push({ x: q.x, y: q.y, r: l.r * TILE_DX * scale, color: l.color, flicker: l.a === undefined ? 1 : 0.2, a: l.a });
        }
        lights.update(th.gloom * Math.max(0.6, settingsDark()), out, dtMs);
    };
    let cineChecked = false;
    const onCineKey = (e: KeyboardEvent) => {
        if (cinematic && e.key === 'Escape') cinematic.skip();
    };
    window.addEventListener('keydown', onCineKey);
    const offStrike = commands.subscribe((c) => {
        if (cinematic) return;
        if ((c.type === 'attack' || c.type === 'use') && !wasLocked && character.locked && !character.dead && character.tool === 'sword') slashAt();
        if (c.type === 'spell') castSpell(c.index);
        if (c.type === 'item') useItem(c.id as ItemId);
        // Use: gather, talk, climb, open, challenge or visit, if something is in reach.
        // Use beside a fallen teammate helps them up.
        const helping = c.type === 'use' && !character.dead ? store.get().reviveTarget : null;
        if (helping) {
            net.sendRevive(helping);
            dropView.text(player.x, player.y - 92, 'Helping them up!', 0x86efac);
        } else if (c.type === 'use' && !character.dead && (story?.use(pu, pv, character.facing) || survival.use(pu, pv, character.facing, character.tool))) spend(STAMINA_COST.gather);
        if (c.type === 'hymn' && !character.dead && !busy()) story?.hymn(pu, pv);
        if (c.type === 'skill' && !(story?.synergy(pu, pv))) useSkill();
        if (c.type === 'interact' && !character.dead && story?.mount(pu, pv, sim.view().monsters)) spend(STAMINA_COST.dodge);
        if ((c.type === 'attack' || c.type === 'use') && !wasLocked && character.locked && !character.dead) {
            strikes.push(170);
            if (c.type === 'attack' || character.tool === 'sword' || character.tool === 'hammer') synth('swing');
            spend(STAMINA_COST.swing);
        }
        if (c.type === 'dodge' && !character.dead && !roll && !busy()) {
            if (tired > 0 || stamina < power.dodgeCost) {
                dropView.text(player.x, player.y - 92, 'Too tired to roll', 0xfacc15);
            } else {
                spend(power.dodgeCost);
                // Roll the way the stick points, or the way you face (the i-frames start with the tumble, after the wind-up).
                const d = input.read();
                let X = d.x, Y = d.y;
                if (Math.hypot(X, Y) < 0.2) {
                    const a = (character.facing * Math.PI) / 4;
                    X = Math.cos(a);
                    Y = Math.sin(a);
                }
                const ru = (X / TILE_DX + (Y * 0.5) / TILE_DY) / 2, rv = ((Y * 0.5) / TILE_DY - X / TILE_DX) / 2;
                const len = Math.hypot(ru, rv) || 1;
                roll = { t: 0, du: ru / len, dv: rv / len, spin: X >= 0 ? 1 : -1, iframes: false, trail: 0 };
                sfx('dodge');
                story?.rolled(pu, pv);
            }
        }
    });

    // Storms throw lightning near the player.
    const darkness = createDarkness(app, stage.root);
    const weather = createWeather(app, {
        above: stage.root,
        region: () => store.get().region,
        indoors: () => here > 0,
        strike: () => {
            const a = Math.random() * Math.PI * 2;
            const d = 2 + Math.random() * 5;
            const u = pu + Math.cos(a) * d, v = pv + Math.sin(a) * d;
            playFx('bolt', u, v, { scale: 2.8, life: 600, anchorY: 0.92 });
            playFx('boltburst', u, v, { scale: 2.6, squash: 0.55, life: 500 });
            sim.strike(u, v, 0, 6 + store.get().wave, 1.6);
            if (Math.hypot(u - pu, v - pv) < 1.4) hurtPlayer(1);
            sfx('thunderclap');
        },
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
        const raw = input.read();
        // The Siren's Lament turns your senses backwards.
        const dir = story?.inverted() ? { x: -raw.x, y: -raw.y } : raw;
        // Actions, sitting and death hold the character in place.
        const walk = character.locked || roll || cinematic || door ? { x: 0, y: 0 } : dir;
        const moving = Math.hypot(dir.x, dir.y) > 0.2 && !character.locked && !roll;
        const sprinting = store.get().sprint && moving && tired <= 0 && stamina > 1;
        if (sprinting) {
            stamina = Math.max(0, stamina - (dt * STAMINA_COST.sprint * (power.dodgeCost < STAMINA_COST.dodge ? 0.7 : 1) * (buffMs.yellow > 0 ? 0.6 : 1)));
            staminaIdle = 0;
            if (stamina <= 0) tired = 1300;
        }
        const speed = SPEED_PX * power.speed * (sprinting ? SPRINT_MUL : 1) * (story?.speedMul() ?? 1);
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
        // Gusts, tipping gravity, a boss's polarity, the Maelstrom's knockback.
        if (story) {
            const sh = story.push(ticker.deltaMS);
            if (sh.du !== 0 && boxOk(pu + sh.du, pv)) pu += sh.du;
            if (sh.dv !== 0 && boxOk(pu, pv + sh.dv)) pv += sh.dv;
        }
        if (roll) {
            // The distance follows the roll's clock, in small steps so it never slips through a wall.
            const before = roll.t;
            roll.t += ticker.deltaMS;
            // Invincible exactly through the tumble.
            if (!roll.iframes && !roll.dash && roll.t >= DODGE_MS.windup) {
                roll.iframes = true;
                invuln = Math.max(invuln, DODGE_MS.tumble);
                playFx('sparkle', pu, pv, { scale: 1, squash: 0.55, life: 350 });
            }
            let left = rollDist(roll, Math.min(roll.t, rollLength(roll))) - rollDist(roll, before);
            while (left > 1e-4) {
                const step = Math.min(0.2, left);
                left -= step;
                if (boxOk(pu + roll.du * step, pv)) pu += roll.du * step;
                if (boxOk(pu, pv + roll.dv * step)) pv += roll.dv * step;
            }
            if (roll.t >= rollLength(roll)) roll = null;
        }
        // Walking into a sealed kingdom: say why.
        if ((du !== 0 || dv !== 0) && pu === fromU && pv === fromV && clock - barrierNote > 5000) {
            const ahead = { i: Math.floor(pu + du * 40), j: Math.floor(pv + dv * 40) };
            if (!survival.canEnter(ahead.i, ahead.j)) {
                barrierNote = clock;
                if (story && quest.active()) story.knockback(du, dv);
                else banner('A dark barrier. Break the seal of this kingdom to pass');
            } else if (story && !story.canEnter(ahead.i, ahead.j)) {
                barrierNote = clock;
                banner('A wall of slag blocks the way. It opens as the story goes on');
            }
        }
        // Fast travel between liberated camps (and the move home after choosing a kingdom).
        const go = store.get().travelTo;
        if (go) {
            pu = go.u;
            pv = go.v;
            pz = heightAt(pu, pv) * LEVEL_H;
            store.patch({ travelTo: null, travel: false });
            playFx('warp', pu, pv, { scale: 1.8, life: 700, lift: 40 });
        }
        pu = Math.min(MAP_TILES - 0.01, Math.max(0, pu));
        pv = Math.min(MAP_TILES - 0.01, Math.max(0, pv));

        // Entering a new tile kicks it (and, lightly, its neighbours).
        const ci = Math.floor(pu);
        const cj = Math.floor(pv);
        if (ci !== standI || cj !== standJ) {
            standI = ci;
            standJ = cj;
            // A door (a cave mouth, a gate, a ladder): through it, with a fade.
            const dk = map.doorAt.get(cj * MAP_TILES + ci);
            if (dk !== undefined && !door && !cinematic && !character.dead) {
                door = { d: map.doors[dk], t: 0, moved: false };
                sfx('dodge', 0.5);
            }
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
        {
            const CENTER = 48; // body centre above the feet, world px
            if (roll) {
                const W = roll.dash ? 0 : DODGE_MS.windup, T = roll.dash ? 220 : DODGE_MS.tumble;
                const t = roll.t;
                let rot = 0, sx2 = 1, sy2 = 1;
                if (t < W) {
                    // Wind-up: crouch and lean into the roll.
                    const k = t / W;
                    sx2 = 1 + 0.14 * k;
                    sy2 = 1 - 0.2 * k;
                    rot = -0.18 * k * roll.spin;
                } else if (t < W + T) {
                    // Tumble: one full turn, tucked in, leaving afterimages.
                    const k = (t - W) / T;
                    rot = roll.spin * (1 - Math.pow(1 - k, 2)) * Math.PI * 2;
                    sx2 = sy2 = roll.dash ? 1 : 0.9;
                    roll.trail -= ticker.deltaMS;
                    if (roll.trail <= 0) {
                        roll.trail = 55;
                        const ghost = new Sprite(softTex);
                        ghost.anchor.set(0.5);
                        ghost.scale.set(0.42, 0.55);
                        ghost.tint = roll.dash ? 0x7dd3fc : 0xe0e7ff;
                        ghost.position.set(player.x, player.y - CENTER);
                        ghost.zIndex = player.zIndex - 0.01;
                        objects.addChild(ghost);
                        fx.push({ s: ghost, name: 'sparkle', t: 0, life: 300, keep: true });
                    }
                } else {
                    // Recovery: skid and straighten up.
                    const k = Math.min(1, (t - W - T) / (roll.dash ? 80 : DODGE_MS.recover));
                    sx2 = 1 + 0.12 * (1 - k);
                    sy2 = 1 - 0.1 * (1 - k);
                }
                player.pivot.set(0, -CENTER);
                player.position.y -= CENTER;
                player.rotation = rot;
                player.scale.set(sx2, sy2);
            } else if (player.rotation !== 0 || player.pivot.y !== 0 || player.scale.x !== 1) {
                player.pivot.set(0, 0);
                player.rotation = 0;
                player.scale.set(1, 1);
            }
        }

        // Character animation: face the way the stick points; idle when blocked or still.
        character.update(ticker.deltaMS, dir, pu !== fromU || pv !== fromV);
        controls.tick();
        progress.addTime(Math.min(ticker.deltaMS / 1000, 0.25));
        if (!character.dead && !runOver) runSeconds += Math.min(ticker.deltaMS / 1000, 0.25);
        if (character.dead && !runOver) {
            deadFor += ticker.deltaMS;
            // With a teammate still standing, you are only down: they can help you up before you bleed out.
            if (deadFor > 1500 && downed <= 0 && teammatesNear(80)) {
                downed = DOWNED_MS;
                banner('You are down! A teammate can help you up');
                sfx('fall');
            }
            if (downed > 0) {
                downed -= ticker.deltaMS;
                const left = Math.max(0, Math.ceil(downed / 1000));
                if (store.get().downed !== left) store.patch({ downed: left });
                // Everyone down, or out of time: the run ends.
                if (downed <= 0 || !teammatesNear(80)) {
                    downed = 0;
                    teamWipe();
                }
            } else if (deadFor > 1500) endRun();
        }
        saveClock += ticker.deltaMS;
        if (saveClock > 1000 && !runOver) {
            saveClock = 0;
            progress.record({ scene: 'world', u: pu, v: pv, tool: character.tool, hp: store.get().hp });
        }
        if (!runOver) net.sendPose({ scene: 'world', u: pu, v: pv, z: pz, face: character.facing, anim: pu !== fromU || pv !== fromV ? character.anim : 'idle', tool: character.tool, dead: character.dead, sword: character.sword });
        remotes.update(ticker.deltaMS);
        invuln = Math.max(0, invuln - ticker.deltaMS);
        shakeMs = Math.max(0, shakeMs - ticker.deltaMS);
        updateFrog(ticker.deltaMS);
        survival.update(ticker.deltaMS, pu, pv, character.facing, character.tool, sim.view().monsters);
        story?.update(ticker.deltaMS, pu, pv, character.facing, sim.view().monsters);
        {
            const w = store.get().weather;
            const want = w === 'storm' ? 1 : w === 'rain' ? 0.7 : 0;
            if (want !== rainShown) {
                rainShown = want;
                rainLevel(want);
            }
            // Breeze and birds outside (fewer at night and in the rain); a fire's crackle by a lit camp fire or a hearth.
            const st = store.get();
            const outside = here ? 0 : st.sheltered ? 0.25 : 1;
            const day = sky.phase === 'day' ? 0.8 : sky.phase === 'night' ? 0.25 : 0.5;
            ambience.set({ breeze: day * outside * (want > 0 ? 0.4 : 1), fire: st.sheltered ? 0.5 : st.fire && st.inCamp ? 0.8 : 0 });
        }
        weather.update(ticker.deltaMS);
        stepDoor(ticker.deltaMS);
        noteWhere();
        {
            const st = store.get();
            const torch = buffMs.night > 0 ? TORCH_R.elixir : st.fire || st.sheltered ? TORCH_R.fire : TORCH_R.base;
            // Underground there is no sky: the interior's own gloom and its lights stand in for night.
            darkness.update(here ? 0 : sky.dark * settingsDark(), torch * stage.scale(), here ? 0 : sky.phase === 'dusk' || sky.phase === 'dawn' ? Math.sin(sky.dark * Math.PI) : 0);
            lightInterior(ticker.deltaMS);
        }
        if (!character.dead && !runOver && store.get().kingdom) {
            const st = store.get();
            const sec = Math.min(ticker.deltaMS / 1000, 0.25);
            // Hunger, thirst and tiredness creep up (Pyraxis's heat makes you thirsty; a house is a rest).
            const hot = st.region === 'fire' ? 1.4 : 1;
            progress.addMeters(-sec / METER_DRAIN.hunger, (-sec / METER_DRAIN.thirst) * hot, st.house || st.sheltered ? 0 : -sec / METER_DRAIN.rest);
            const m = progress.meters();
            starve = m.hunger <= 0 ? starve + ticker.deltaMS : 0;
            parched = m.thirst <= 0 ? parched + ticker.deltaMS : 0;
            if (starve > 10000 || parched > 7000) {
                if (starve > 10000) starve = 0;
                if (parched > 7000) parched = 0;
                store.patch({ hp: Math.max(0, st.hp - 1) });
                dropView.text(player.x, player.y - 78, m.hunger <= 0 ? 'Starving!' : 'Parched!', 0xfacc15);
            }
            // Stamina comes back after half a second without spending (slower when hungry or thirsty).
            tired = Math.max(0, tired - ticker.deltaMS);
            staminaIdle += ticker.deltaMS;
            const max = staminaMax();
            const quick = progress.powers().includes('air') ? 1.3 : 1;
            if (staminaIdle > 500) stamina = Math.min(max, stamina + sec * 25 * quick * (m.hunger < 25 || m.thirst < 25 ? 0.5 : 1) * (story?.regenMul() ?? 1));
            stamina = Math.min(stamina, max);
            const key = `${Math.round(stamina)}/${Math.round(max)}/${tired > 0}`;
            if (key !== staminaShown) {
                staminaShown = key;
                store.patch({ stamina: { now: Math.round(stamina), max: Math.round(max), tired: tired > 0 } });
            }
        }
        // Healing over time: the healer's tent, Troll Blood, the Amber stone; three times as fast in camp.
        {
            const st = store.get();
            if (!character.dead && st.hp > 0 && st.hp < st.maxHp) {
                const campRate = st.inCamp ? 1 / 6 : 0;
                const tide = progress.powers().includes('water') && (nearWater || st.sheltered || st.inCamp) ? 2 : 1;
                const rate = (Number.isFinite(power.regenEvery) ? 1 / power.regenEvery : 0) * (st.inCamp ? 3 : 1) * tide + campRate;
                regenAcc += rate * dt;
                if (regenAcc >= 1) {
                    regenAcc -= 1;
                    store.patch({ hp: Math.min(st.maxHp, st.hp + 1) });
                }
            } else regenAcc = 0;
        }
        {
            // The health bar over the player.
            const st = store.get();
            const k = `${st.hp}/${st.maxHp}/${character.dead}`;
            hpBar.position.set(player.x, player.y - 104);
            if (k !== hpBarKey) {
                hpBarKey = k;
                const f = st.maxHp > 0 ? Math.min(1, st.hp / st.maxHp) : 0;
                const W = 74;
                hpBar.clear();
                if (!character.dead) {
                    hpBar.roundRect(-W / 2 - 3, -3, W + 6, 14, 5).fill({ color: 0x1a0c10, alpha: 0.85 });
                    hpBar.roundRect(-W / 2, 0, W, 8, 3).fill({ color: 0x4a1c24 });
                    if (f > 0) hpBar.roundRect(-W / 2, 0, Math.max(4, W * f), 8, 3).fill({ color: f > 0.5 ? 0x4ade80 : f > 0.25 ? 0xfacc15 : 0xef4444 });
                    hpBar.rect(-W / 2 + 2, 1, Math.max(0, W * f - 4), 2).fill({ color: 0xffffff, alpha: 0.35 });
                }
            }
        }
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
                        recharge[i] = charges[i] < max ? spellCooldown(i) : 0;
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
            if (f.keep) f.s.alpha = Math.min(1, (f.life - f.t) / 400);
            else f.s.texture = fxFrame(f.name, Math.min(FX[f.name].n - 1, Math.floor((f.t / f.life) * FX[f.name].n)));
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
                const mul = power.damage * (buffMs.blue > 0 ? 1.5 : 1) * (buffMs.black > 0 ? 2 : 1) * (tired > 0 ? 0.5 : 1);
                const base = (TOOL_DAMAGE[character.tool] ?? 1) * (character.tool === 'sword' ? power.weapon : 1);
                // A monster in reach can take a critical hit.
                const faced = (() => {
                    const a = (character.facing * Math.PI) / 4;
                    const u = pu + (Math.cos(a) + Math.sin(a)) / Math.SQRT2, v = pv + (Math.sin(a) - Math.cos(a)) / Math.SQRT2;
                    return sim.view().monsters.some((m) => m.state !== 'dying' && Math.hypot(m.u - u, m.v - v) < 1.4);
                })();
                const crit = faced && Math.random() < CRIT.chance;
                const dmg = Math.max(1, Math.round(base * mul * (crit ? CRIT.mul : 1) * (story?.swingMul(pu, pv, sim.view().monsters) ?? 1)));
                sim.strike(pu, pv, character.facing, dmg);
                story?.swing(pu, pv, character.facing, character.tool);
                // Runic Fracture: the fourth blow of an unbroken string bursts around the blade.
                if (faced) {
                    combo = clock - comboAt < 1300 ? combo + 1 : 1;
                    comboAt = clock;
                    if (combo % 4 === 0) {
                        const ra = (character.facing * Math.PI) / 4;
                        const ru = pu + (Math.cos(ra) + Math.sin(ra)) / Math.SQRT2, rv = pv + (Math.sin(ra) - Math.cos(ra)) / Math.SQRT2;
                        sim.strike(ru, rv, character.facing, Math.max(2, Math.round(dmg * 1.5)), 2.2);
                        playFx('frost', ru, rv, { scale: 2.6, squash: 0.55, life: 500 });
                        playFx('boltburst', ru, rv, { scale: 2.2, life: 450, lift: 20 });
                        dropView.text(player.x, player.y - 120, 'Runic Fracture!', 0x7dd3fc);
                        story?.fracture(ru, rv, sim.view().monsters);
                        synth('mine');
                    }
                }
                if (crit) {
                    shakeMs = 220;
                    const ca = (character.facing * Math.PI) / 4;
                    playFx('crit', pu + (Math.cos(ca) + Math.sin(ca)) / Math.SQRT2, pv + (Math.sin(ca) - Math.cos(ca)) / Math.SQRT2, { scale: 1.6, life: 460, lift: 34 });
                    dropView.text(player.x + 30, player.y - 110, 'CRIT!', 0xffd84d);
                    sfx('explosion', 0.25);
                }
                // In front of the player, where the blow lands.
                const fa = (character.facing * Math.PI) / 4;
                const fu = pu + (Math.cos(fa) + Math.sin(fa)) / Math.SQRT2, fv = pv + (Math.sin(fa) - Math.cos(fa)) / Math.SQRT2;
                hits++;
                // Something in reach charges the meter.
                if (sim.view().monsters.some((m) => m.state !== 'dying' && Math.hypot(m.u - fu, m.v - fv) < 1.4)) charge(METER_GAIN.hit);
                // Pyraxis's own fire, and coating oils.
                // Pyraxis: each hit on something adds a burn stack (up to 5); the burn ticks four times, harder the more stacks.
                if (progress.powers().includes('fire') && faced) {
                    if (clock - lastBurnHit > 2500) burnStacks = 0;
                    lastBurnHit = clock;
                    burnStacks = Math.min(5, burnStacks + 1);
                    const tick = Math.max(1, Math.round(dmg * 0.08 * burnStacks));
                    for (let n = 1; n <= 4; n++) burns.push({ t: 500 * n, u: fu, v: fv, dmg: tick });
                    if (burnStacks > 1) dropView.text(player.x - 30, player.y - 100, `Burn x${burnStacks}`, 0xff6a3d);
                }
                if (buffMs.oilfire > 0) burns.push({ t: 500, u: fu, v: fv, dmg: Math.max(1, Math.round(dmg * 0.3)) }, { t: 1100, u: fu, v: fv, dmg: Math.max(1, Math.round(dmg * 0.3)) });
                if (buffMs.oilice > 0 && Math.random() < 0.25) {
                    sim.strike(fu, fv, character.facing, 1, 1, 1500);
                    playFx('frost', fu, fv, { scale: 0.7, squash: 0.55, life: 400 });
                }
                if (power.infernal && hits % 5 === 0) {
                    sim.strike(fu, fv, character.facing, Math.max(1, Math.round(dmg * 0.8)), 1.6);
                    playFx('explosion', fu, fv, { scale: 1.6, life: 700, anchorY: 0.75 });
                    sfx('explosion', 0.6);
                }
                if (power.infusion === 'fire') {
                    burns.push({ t: 600, u: fu, v: fv, dmg: Math.max(1, Math.round(dmg * 0.25)) }, { t: 1200, u: fu, v: fv, dmg: Math.max(1, Math.round(dmg * 0.25)) });
                } else if (power.infusion === 'air' && Math.random() < 0.2) {
                    const target = nearestMonster(5, false);
                    if (target) {
                        sim.strike(target.u, target.v, character.facing, Math.max(1, Math.round(dmg * 0.6)), 1);
                        playFx('bolt', target.u, target.v, { scale: 1.8, life: 450, anchorY: 0.92 });
                    }
                } else if (power.infusion === 'water' && Math.random() < 0.12 && store.get().hp < store.get().maxHp) {
                    store.patch({ hp: store.get().hp + 1 });
                    dropView.text(player.x, player.y - 60, '+1', 0x38bdf8);
                } else if (power.infusion === 'earth' && hits % 4 === 0) {
                    sim.strike(pu, pv, character.facing, Math.max(1, Math.round(dmg * 0.5)), 2);
                    playFx('sparkle', pu, pv, { scale: 2.4, squash: 0.55, life: 500 });
                }
                // Storm Caller: every n-th swing calls lightning on the nearest monster.
                swings++;
                if (power.storm > 0 && swings % power.storm === 0) {
                    const target = nearestMonster(6, false);
                    if (target) {
                        sim.strike(target.u, target.v, character.facing, Math.max(2, Math.round(5 * mul)), 1.4);
                        playFx('bolt', target.u, target.v, { scale: 2.2, life: 500, anchorY: 0.92 });
                    }
                }
            }
        }
        for (let i = zones.length - 1; i >= 0; i--) {
            const z = zones[i];
            z.t -= ticker.deltaMS;
            z.next -= ticker.deltaMS;
            z.g.alpha = Math.min(1, z.t / 500);
            if (z.next <= 0) {
                z.next = z.every;
                if (sim.view().monsters.some((m) => m.state !== 'dying' && Math.hypot(m.u - z.u, m.v - z.v) < z.r)) {
                    sim.strike(z.u, z.v, character.facing, z.dmg, z.r, z.stun);
                    if (z.fx === 'bolt') playFx('boltburst', z.u, z.v, { scale: 1.6, squash: 0.55, life: 350 });
                }
            }
            if (z.t <= 0) {
                z.g.destroy();
                zones.splice(i, 1);
            }
        }
        for (let i = burns.length - 1; i >= 0; i--) {
            burns[i].t -= ticker.deltaMS;
            if (burns[i].t <= 0) {
                const b = burns.splice(i, 1)[0];
                sim.strike(b.u, b.v, character.facing, b.dmg, b.r ?? 1);
                playFx('fireball', b.u, b.v, { scale: 0.7, life: 350, anchorY: 0.8 });
            }
        }
        sim.update(ticker.deltaMS);
        const view = sim.view();
        // Online positions arrive ten times a second, so ease between them; offline updates every frame.
        monsterView.sync(view.monsters, ticker.deltaMS, view.online ? 110 : 0);
        dropView.sync(view.drops, ticker.deltaMS);
        shotView.sync(view.shots, ticker.deltaMS);
        hudClock -= ticker.deltaMS;
        if (hudClock <= 0) {
            hudClock = 150;
            power = progress.power();
            sky = nowSky();
            const sk = `${sky.phase}/${Math.round(sky.dark * 20)}/${sky.left}`;
            if (sk !== skyShown) {
                // Nightfall: the hordes are coming.
                if (sky.phase === 'night' && store.get().sky.phase === 'dusk') {
                    sfx('wave');
                    banner('Night falls. The hordes grow bolder: find a fire or a house');
                }
                skyShown = sk;
                store.patch({ sky: { phase: sky.phase, dark: Math.round(sky.dark * 100) / 100, left: sky.left } });
            }
            if (Math.round(meter) !== meterShown) {
                meterShown = Math.round(meter);
                store.patch({ meter: meterShown });
            }
            // Near water? (Aquatica heals faster there.)
            nearWater = false;
            for (let dj = -3; dj <= 3 && !nearWater; dj++) for (let di = -3; di <= 3; di++) if (map.terrain[(Math.floor(pv) + dj) * MAP_TILES + Math.floor(pu) + di] === WATER) { nearWater = true; break; }
            // A fallen teammate within reach: Use helps them up.
            let target: string | null = null;
            if (!character.dead && net.online()) for (const r of net.remotes.values()) if (r.pose?.dead && Math.hypot(r.pose.u - pu, r.pose.v - pv) < 1.8) target = r.id;
            if (target !== store.get().reviveTarget) store.patch({ reviveTarget: target });
            progress.publishObjective();
            // A level gained, an objective done: the pack's lettering rises over the player.
            {
                const st = store.get();
                if (shownLevel > 0 && st.level > shownLevel) playFx('levelup', pu, pv, { scale: 0.9, life: 2900, lift: 118 });
                if (shownStep >= 0 && st.objective && st.objective.step > shownStep) playFx('complete', pu, pv, { scale: 0.9, life: 3700, lift: 118 });
                shownLevel = st.level;
                shownStep = st.objective?.step ?? shownStep;
            }
            // The waves never stop out in the world. They hold only while a story page or a talk is
            // open, and a camp is safe ground: monsters lose you there (alone, no wave comes at all).
            {
                const s = store.get();
                // Waves also hold until the story's first Sanctuary stands, and through a cinematic.
                const held = !!story?.holdWaves();
                calmNow = !!s.storyPopup || !!s.npc || !!s.puzzle || s.loom || s.debate || !!s.cine || held || here > 0;
                if (s.wavesHeld !== held) store.patch({ wavesHeld: held });
                const sieging = !!story?.sieging();
                const safeNow = s.inCamp && !sieging;
                const key = `${calmNow}|${safeNow}|${sieging}`;
                if (net.online() && (key !== calmSent || clock - calmSentAt > 5000)) {
                    net.sendCalm(calmNow, safeNow, sieging);
                    calmSent = key;
                    calmSentAt = clock;
                }
                const holding = s.inCamp && !view.online;
                if (s.wavesCalm !== holding) store.patch({ wavesCalm: holding });
            }
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
            store.patch({ wave: view.wave, nextWaveIn: view.nextIn, waveLeft, onslaughtLeft: view.onslaughtLeft, fighting: view.fighting, frogAim, sharedMonsters: view.online });
            // Ten seconds of cooldown left: warn which side the next wave comes from.
            if (!view.fighting && view.nextIn > 0 && view.nextIn <= 10 && warnedWave !== view.wave + 1) {
                warnedWave = view.wave + 1;
                sfx('wave', 0.45);
                banner(`Wave ${view.wave + 1} in ${view.nextIn}s, from the ${sideName(view.waveDir)}. Get ready!`);
            }
            radar.u = pu;
            radar.v = pv;
            radar.facing = (character.facing * Math.PI) / 4;
            radar.monsters = view.monsters.filter((m) => m.state !== 'dying').map((m) => ({ u: m.u, v: m.v, boss: m.boss ?? 0 }));
            radar.threat = view.fighting || view.nextIn <= 20 ? view.waveDir : null;
            // The nearest boss's health for the big bar, and whether monsters are close (no resting then).
            const boss = nearestBoss(view.monsters, pu, pv);
            // Music: a boss fight has its theme; a wave has battle music from its first monster to its
            // last; between waves (and on peaceful errands) the exploration music plays.
            {
                // Battle music once the first wave is in, while you are out in the world (camp is calm ground).
                const battle = view.fighting && view.wave > 0 && !store.get().inCamp;
                const fight = !!boss || battle || !!story?.sieging();
                calmFor = fight ? 0 : calmFor + 150;
                const mood = music.mood();
                if (runOver || cinematic) { /* the game-over screen keeps its silence; a cinematic keeps its own */ }
                else if (boss) music.set('boss');
                else if (here) music.set('underground');
                else if (battle) music.set('combat');
                else if (calmFor > 2500 || (mood !== 'combat' && mood !== 'boss')) music.set('explore');
            }
            const cur = store.get().boss;
            if (!boss !== !cur || (boss && cur && (boss.hp !== cur.hp || boss.name !== cur.name))) store.patch({ boss });
            const danger = view.monsters.some((m) => m.state !== 'dying' && Math.hypot(m.u - pu, m.v - pv) < 8);
            if (danger !== store.get().danger) store.patch({ danger });
        }
        wasLocked = character.locked;

        // The opening cinematic, the first time the story starts in the quarry.
        if (!cineChecked && story && !store.get().travelTo) {
            cineChecked = true;
            if (quest.active() && quest.land().n === 1 && quest.main()?.id === 'free' && !quest.has('cine:intro')) {
                cinematic = createIntroCinematic({
                    layer: objects,
                    ground: (u, v) => ({ x: sx(u, v), y: sy(u, v) - heightAt(u, v) * LEVEL_H }),
                    zFor: sortZ,
                    fx: (name, u, v, o) => playFx(name, u, v, o),
                    props: (ids, hidden) => story?.hideProps(ids, hidden),
                    onEnd: () => undefined,
                }, { u: pu, v: pv - 3 });
            } else if (store.get().cine) store.patch({ cine: null });
        }
        if (cinematic) {
            const view = cinematic.update(ticker.deltaMS);
            player.visible = xray.visible = hpBar.visible = !view;
            if (view) cineCam = view;
            else {
                pu = cinematic.end.u;
                pv = cinematic.end.v;
                pz = heightAt(pu, pv) * LEVEL_H;
                cinematic.destroy();
                cinematic = null;
                cineCam = null;
                quest.flag('cine:intro');
                music.set('explore');
            }
        }

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
            offSword();
            sim.destroy();
            monsterView.destroy();
            shotView.destroy();
            dropView.destroy();
            survival.destroy();
            story?.destroy();
            weather.destroy();
            darkness.destroy();
            lights.destroy();
            fadeGfx.destroy();
            store.patch({ indoors: null });
            ambience.clear();
            offRevive();
            window.removeEventListener('keydown', onCineKey);
            cinematic?.destroy();
            for (const z of zones) z.g.destroy();
            store.patch({ downed: null, reviveTarget: null, meter: 0 });
            hpBar.destroy();
            store.patch({ waveLeft: null, frogAim: null, shop: false, banner: null, bagTab: null, boss: null, danger: false });
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
