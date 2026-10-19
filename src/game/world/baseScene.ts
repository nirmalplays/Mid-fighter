/**
 * The base: a small room the world's portal leads to. Its floor is the store
 * building's floor slab (Isometric RPG Buildings, 2x2Tile_Store/Layer4_Floor),
 * scaled to a 5 × 5 tile floor, with two back walls drawn in the same outlined
 * style. The player walks on the same iso grid as the world; an exit portal
 * returns to the world, beside the world's portal.
 */
import {
    Assets, Container, Graphics, Rectangle, Sprite, Text, Texture,
    type Application, type Ticker,
} from 'pixi.js';
import { store } from '../../state/store.ts';
import type { Scene } from '../scene.ts';
import type { Stage } from '../stage.ts';
import { createCharacter, TOOL_LABELS } from './character.ts';
import { bindControls } from './controls.ts';
import { TILE_DX, TILE_DY } from './constants.ts';
import { createInput, JOY_RADIUS } from './input.ts';

/** Room size in tiles, and the floor art's scale to match it (the slab's top face is ~650 px wide). */
const ROOM = 5;
const FLOOR_SCALE = (ROOM * 2 * TILE_DX) / 650;
/** Where the floor's top-face centre sits inside the cropped slab image (fractions of its size). */
const FLOOR_ANCHOR = { x: 0.5, y: 0.55 };
/** The slab's top face is a little taller than 2:1; squash it so it lines up with the iso grid. */
const FLOOR_SQUASH = 0.9;
const WALL_H = 175;
const OUTLINE = 0x2b0f1c;

const SPEED_PX = 340;
const RADIUS = 0.28;

/** The exit portal's tile, near the back of the room. */
const EXIT = { i: 3, j: 0 };
const PORTAL_FRAMES = 6;
const PORTAL_W = 112;
const PORTAL_H = 128;
const PORTAL_SCALE = 1.45;
const PORTAL_BASE_Y = 108 / PORTAL_H;
const PORTAL_MS = 130;
const PORTAL_REACH = 1.35;
const ENTER_MS = 850;
const FLASH_MS = 350;
const FADE_IN_MS = 650;

const sx = (u: number, v: number) => (u - v) * TILE_DX;
const sy = (u: number, v: number) => (u + v) * TILE_DY;

export function createBaseScene(app: Application, stage: Stage): Scene {
    const world = new Container();
    const objects = new Container();
    objects.sortableChildren = true;
    world.addChild(objects);
    stage.root.addChild(world);

    // Corners of the floor's diamond: top, right, bottom, left.
    const top = { x: sx(0, 0), y: sy(0, 0) };
    const right = { x: sx(ROOM, 0), y: sy(ROOM, 0) };
    const left = { x: sx(0, ROOM), y: sy(0, ROOM) };

    // Back walls, one along each rear edge, behind the floor.
    const walls = new Graphics();
    const wallQuad = (a: { x: number; y: number }, b: { x: number; y: number }, color: number, trim: number) => {
        walls.poly([a.x, a.y, b.x, b.y, b.x, b.y - WALL_H, a.x, a.y - WALL_H]).fill({ color }).stroke({ width: 5, color: OUTLINE, join: 'round' });
        // Baseboard and top trim.
        const at = (p: { x: number; y: number }, h: number) => [p.x, p.y - h];
        walls.poly([...at(a, 0), ...at(b, 0), ...at(b, 22), ...at(a, 22)]).fill({ color: trim }).stroke({ width: 3, color: OUTLINE, join: 'round' });
        walls.poly([...at(a, WALL_H - 16), ...at(b, WALL_H - 16), ...at(b, WALL_H), ...at(a, WALL_H)]).fill({ color: trim }).stroke({ width: 3, color: OUTLINE, join: 'round' });
    };
    const windowOn = (a: { x: number; y: number }, b: { x: number; y: number }, f1: number, f2: number) => {
        const p = (f: number, h: number) => [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f - h];
        const quad = [...p(f1, 62), ...p(f2, 62), ...p(f2, 138), ...p(f1, 138)];
        walls.poly(quad).fill({ color: 0x9fd8f4 }).stroke({ width: 5, color: OUTLINE, join: 'round' });
        const mid = (f1 + f2) / 2;
        walls.moveTo(p(mid, 62)[0], p(mid, 62)[1]).lineTo(p(mid, 138)[0], p(mid, 138)[1]).stroke({ width: 4, color: OUTLINE });
        walls.moveTo(p(f1, 100)[0], p(f1, 100)[1]).lineTo(p(f2, 100)[0], p(f2, 100)[1]).stroke({ width: 4, color: OUTLINE });
    };
    wallQuad(left, top, 0xd7b48f, 0xa87d5c);
    wallQuad(top, right, 0xe9cfae, 0xb88a66);
    windowOn(left, top, 0.2, 0.42);
    windowOn(top, right, 0.58, 0.8);
    walls.zIndex = -2000;
    objects.addChild(walls);

    // The floor: the store's floor slab.
    const floorTex = Assets.get<Texture>('base-floor');
    const floor = new Sprite(floorTex);
    floor.anchor.set(FLOOR_ANCHOR.x, FLOOR_ANCHOR.y);
    floor.scale.set(FLOOR_SCALE, FLOOR_SCALE * FLOOR_SQUASH);
    floor.position.set(sx(ROOM / 2, ROOM / 2), sy(ROOM / 2, ROOM / 2));
    floor.zIndex = -1000;
    objects.addChild(floor);

    // Player.
    const character = createCharacter((tool) => store.patch({ tool: TOOL_LABELS[tool] }));
    const controls = bindControls(character);
    objects.addChild(character.player);
    world.addChild(character.xray);
    const player = character.player;
    const xray = character.xray;
    // Debug: with ?spawn= the player is exposed for automated checks.
    if (new URLSearchParams(window.location.search).has('spawn')) (window as unknown as { __player?: Container }).__player = player;
    let pu = ROOM / 2;
    let pv = ROOM / 2 + 0.6;

    // Exit portal back to the world.
    const portalSheet = Assets.get<Texture>('portal');
    portalSheet.source.scaleMode = 'nearest';
    const portalTex = Array.from({ length: PORTAL_FRAMES }, (_, n) =>
        new Texture({ source: portalSheet.source, frame: new Rectangle(n * PORTAL_W, 0, PORTAL_W, PORTAL_H) }));
    const px0 = sx(EXIT.i + 0.5, EXIT.j + 0.5);
    const py0 = sy(EXIT.i + 0.5, EXIT.j + 0.5);
    const glowGfx = new Graphics().poly([TILE_DX, 0, 2 * TILE_DX, TILE_DY, TILE_DX, 2 * TILE_DY, 0, TILE_DY]).fill({ color: 0x5eead4 });
    const glowTex = app.renderer.generateTexture({ target: glowGfx, resolution: 1 });
    glowGfx.destroy();
    const portalGlow = new Sprite(glowTex);
    portalGlow.anchor.set(0.5);
    portalGlow.tint = 0x5dff8a;
    portalGlow.position.set(px0, py0);
    portalGlow.zIndex = py0 + 0.02;
    const portalSprite = new Sprite(portalTex[0]);
    portalSprite.anchor.set(0.5, PORTAL_BASE_Y);
    portalSprite.scale.set(PORTAL_SCALE);
    portalSprite.position.set(px0, py0);
    portalSprite.zIndex = py0 + 0.3;
    const portalLabel = new Text({
        text: 'WORLD',
        style: { fontFamily: 'sans-serif', fontSize: 26, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x14442a, width: 6 } },
    });
    portalLabel.anchor.set(0.5);
    portalLabel.position.set(px0, py0 - 185);
    portalLabel.zIndex = py0 + 5;
    objects.addChild(portalGlow, portalSprite, portalLabel);

    const joyGfx = new Graphics();
    app.stage.addChild(joyGfx);
    const flash = new Graphics();
    app.stage.addChild(flash);
    const input = createInput(app.canvas);

    // Whether the player's box may stand at (u, v): inside the room and off the portal's tile.
    const boxOk = (u: number, v: number): boolean => {
        for (const [cu, cv] of [[u - RADIUS, v - RADIUS], [u + RADIUS, v - RADIUS], [u - RADIUS, v + RADIUS], [u + RADIUS, v + RADIUS]]) {
            if (cu < 0 || cv < 0 || cu >= ROOM || cv >= ROOM) return false;
            if (Math.floor(cu) === EXIT.i && Math.floor(cv) === EXIT.j) return false;
        }
        return true;
    };

    // A fixed camera that fits the whole room on screen.
    let zoom = 1;
    const placeCamera = () => {
        const roomH = WALL_H + 2 * ROOM * TILE_DY + 40;
        zoom = Math.min(2, (0.88 * stage.height) / roomH, (0.92 * stage.designWidth()) / (2 * ROOM * TILE_DX));
        world.scale.set(zoom);
        const cx = 0;
        const cy = sy(ROOM / 2, ROOM / 2) - WALL_H / 2 + 10;
        world.position.set(stage.designWidth() / 2 - cx * zoom, stage.height / 2 - cy * zoom);
    };
    placeCamera();
    const offResize = stage.onResize(placeCamera);

    let lastTile = -1;
    const publish = () => {
        const t = Math.floor(pv) * ROOM + Math.floor(pu);
        if (t === lastTile) return;
        lastTile = t;
        store.patch({ tileX: Math.floor(pu), tileY: Math.floor(pv), height: 0, chunkX: 0, chunkY: 0, loadedChunks: 0 });
    };
    publish();

    let clock = 0;
    let entering = false;
    let enterT = 0;
    let enterFrom = { x: 0, y: 0 };
    let exited = false;
    const tick = (ticker: Ticker) => {
        clock += ticker.deltaMS;
        const dt = Math.min(ticker.deltaMS / 1000, 0.05);

        const dir = input.read();
        const walk = character.locked || entering ? { x: 0, y: 0 } : dir;
        const X = walk.x * SPEED_PX * dt;
        const Y = walk.y * SPEED_PX * 0.5 * dt;
        const du = (X / TILE_DX + Y / TILE_DY) / 2;
        const dv = (Y / TILE_DY - X / TILE_DX) / 2;
        const fromU = pu;
        const fromV = pv;
        const trapped = !boxOk(pu, pv);
        if (du !== 0 && (trapped || boxOk(pu + du, pv))) pu += du;
        if (dv !== 0 && (trapped || boxOk(pu, pv + dv))) pv += dv;
        pu = Math.min(ROOM - 0.01, Math.max(0, pu));
        pv = Math.min(ROOM - 0.01, Math.max(0, pv));

        player.position.set(sx(pu, pv), sy(pu, pv));
        player.zIndex = sy(pu, pv);
        xray.position.copyFrom(player.position);

        // Portal: animate, glow, and pull the player in when they walk up to it.
        portalSprite.texture = portalTex[Math.floor(clock / PORTAL_MS) % PORTAL_FRAMES];
        portalGlow.alpha = 0.3 + 0.18 * Math.sin(clock / 380);
        portalGlow.scale.set(1.05 + 0.08 * Math.sin(clock / 380));
        portalLabel.y = py0 - 185 + Math.sin(clock / 450) * 4;
        if (!entering && !character.dead && Math.hypot(pu - (EXIT.i + 0.5), pv - (EXIT.j + 0.5)) < PORTAL_REACH) {
            entering = true;
            enterT = 0;
            enterFrom = { x: player.x, y: player.y };
        }
        if (entering) {
            enterT += ticker.deltaMS;
            const t = Math.min(1, enterT / ENTER_MS);
            const e = t * t;
            player.position.set(enterFrom.x + (px0 - enterFrom.x) * e, enterFrom.y + (py0 - 24 - enterFrom.y) * e);
            player.scale.set(1 - 0.85 * e);
            player.alpha = 1 - e;
            xray.visible = false;
            const f = Math.max(0, (enterT - ENTER_MS * 0.55) / (ENTER_MS * 0.45 + FLASH_MS));
            flash.clear().rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0xd9ffd2, alpha: Math.min(1, f) });
            if (enterT > ENTER_MS + FLASH_MS && !exited) {
                exited = true;
                store.patch({ spawnAt: 'portal', phase: 'playing' });
            }
        } else if (clock < FADE_IN_MS) {
            // Arriving: fade in from the portal's flash.
            flash.clear().rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0xd9ffd2, alpha: 1 - clock / FADE_IN_MS });
        } else if (flash.visible) {
            flash.clear();
            flash.visible = false;
        }

        character.update(ticker.deltaMS, dir, pu !== fromU || pv !== fromV);
        controls.tick();
        publish();

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
            character.destroy();
            joyGfx.destroy();
            flash.destroy();
            world.destroy({ children: true });
        },
    };
}
