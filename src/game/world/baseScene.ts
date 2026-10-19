/**
 * The workshop (the base): a room reached from the world's portal or the HUD's
 * Workshop button. Its floor is the store building's floor slab (Isometric RPG
 * Buildings, 2x2Tile_Store/Layer4_Floor), scaled up to an 8 × 8 tile floor, with
 * two back walls drawn in the same outlined style. The player walks on the same
 * iso grid as the world, and the camera follows them around the room. It is
 * furnished with the Ultimate Isometric Pack's placeable items (see
 * workshopLayout.ts). There is no exit portal: the HUD's World button leads back.
 */
import { Assets, Container, Graphics, Rectangle, Sprite, Texture, type Application, type Ticker } from 'pixi.js';
import { store } from '../../state/store.ts';
import type { Scene } from '../scene.ts';
import type { Stage } from '../stage.ts';
import { createCharacter, TOOL_LABELS } from './character.ts';
import { bindControls } from './controls.ts';
import { TILE_DX, TILE_DY } from './constants.ts';
import { createInput, JOY_RADIUS } from './input.ts';
import { ITEM_FRAMES } from './workshopAtlas.ts';
import { WORKSHOP_ITEMS } from './workshopLayout.ts';

/** Room size in tiles, and the floor art's scale to match it (the slab's top face is ~650 px wide). */
const ROOM = 8;
const FLOOR_SCALE = (ROOM * 2 * TILE_DX) / 650;
/** Where the floor's top-face centre sits inside the cropped slab image (fractions of its size). */
const FLOOR_ANCHOR = { x: 0.5, y: 0.55 };
/** The slab's top face is a little taller than 2:1; squash it so it lines up with the iso grid. */
const FLOOR_SQUASH = 0.9;
const WALL_H = 190;
const OUTLINE = 0x2b0f1c;
/** The camera's zoom while following the player. */
const ZOOM = 1.4;

const SPEED_PX = 340;
const RADIUS = 0.28;
const FADE_IN_MS = 650;

const sx = (u: number, v: number) => (u - v) * TILE_DX;
const sy = (u: number, v: number) => (u + v) * TILE_DY;

export function createBaseScene(app: Application, stage: Stage): Scene {
    const world = new Container();
    world.scale.set(ZOOM);
    const objects = new Container();
    objects.sortableChildren = true;
    world.addChild(objects);
    stage.root.addChild(world);

    // Corners of the floor's diamond: top, right, left.
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
        const quad = [...p(f1, 70), ...p(f2, 70), ...p(f2, 148), ...p(f1, 148)];
        walls.poly(quad).fill({ color: 0x9fd8f4 }).stroke({ width: 5, color: OUTLINE, join: 'round' });
        const mid = (f1 + f2) / 2;
        walls.moveTo(p(mid, 70)[0], p(mid, 70)[1]).lineTo(p(mid, 148)[0], p(mid, 148)[1]).stroke({ width: 4, color: OUTLINE });
        walls.moveTo(p(f1, 109)[0], p(f1, 109)[1]).lineTo(p(f2, 109)[0], p(f2, 109)[1]).stroke({ width: 4, color: OUTLINE });
    };
    wallQuad(left, top, 0xd7b48f, 0xa87d5c);
    wallQuad(top, right, 0xe9cfae, 0xb88a66);
    // Windows of about one tile's width, spaced along each wall.
    const winW = 1 / ROOM;
    for (const f of [0.14, 0.4, 0.66]) windowOn(left, top, f, f + winW);
    for (const f of [0.2, 0.46, 0.72]) windowOn(top, right, f, f + winW);
    walls.zIndex = -2000;
    objects.addChild(walls);

    // The floor: the store's floor slab.
    const floor = new Sprite(Assets.get<Texture>('base-floor'));
    floor.anchor.set(FLOOR_ANCHOR.x, FLOOR_ANCHOR.y);
    floor.scale.set(FLOOR_SCALE, FLOOR_SCALE * FLOOR_SQUASH);
    floor.position.set(sx(ROOM / 2, ROOM / 2), sy(ROOM / 2, ROOM / 2));
    floor.zIndex = -1000;
    objects.addChild(floor);

    // Furnishings: chests, crates, a forge, a workbench with tools, and material piles.
    const itemSheet = Assets.get<Texture>('workshop-items');
    const itemTex = new Map<string, Texture>();
    const itemTexture = (name: string): Texture => {
        let t = itemTex.get(name);
        if (!t) {
            const [x, y, w, h] = ITEM_FRAMES[name];
            t = new Texture({ source: itemSheet.source, frame: new Rectangle(x, y, w, h) });
            itemTex.set(name, t);
        }
        return t;
    };
    const shadowGfx = new Graphics().ellipse(40, 14, 40, 14).fill({ color: 0x1a0c10, alpha: 0.3 });
    const shadowTex = app.renderer.generateTexture({ target: shadowGfx, resolution: 2 });
    shadowGfx.destroy();
    const solid = new Set<number>();
    for (const it of WORKSHOP_ITEMS) {
        const s = it.s ?? 0.5;
        const lift = it.lift ?? 0;
        const sp = new Sprite(itemTexture(it.name));
        sp.anchor.set(0.5, 0.82);
        sp.scale.set(s);
        sp.position.set(sx(it.u, it.v), sy(it.u, it.v) - lift);
        // Lifted items (stacked, or resting on the table) sort above what they sit on.
        sp.zIndex = sy(it.u, it.v) + 0.3 + Math.min(lift, 30) + lift * 0.001;
        objects.addChild(sp);
        if (!it.flat && lift === 0) {
            const sh = new Sprite(shadowTex);
            sh.anchor.set(0.5);
            sh.scale.set((sp.width * 0.85) / 80);
            sh.position.set(sx(it.u, it.v), sy(it.u, it.v) + 4);
            sh.zIndex = sy(it.u, it.v) + 0.2;
            objects.addChild(sh);
        }
        if (it.block) solid.add(Math.floor(it.v) * ROOM + Math.floor(it.u));
    }

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
    let pv = ROOM - 2;

    const joyGfx = new Graphics();
    app.stage.addChild(joyGfx);
    const flash = new Graphics();
    app.stage.addChild(flash);
    const input = createInput(app.canvas);

    // Whether the player's box may stand at (u, v): inside the room and clear of furniture.
    const boxOk = (u: number, v: number): boolean => {
        if (u - RADIUS < 0 || v - RADIUS < 0 || u + RADIUS >= ROOM || v + RADIUS >= ROOM) return false;
        for (const [cu, cv] of [[u - RADIUS, v - RADIUS], [u + RADIUS, v - RADIUS], [u - RADIUS, v + RADIUS], [u + RADIUS, v + RADIUS]]) {
            if (solid.has(Math.floor(cv) * ROOM + Math.floor(cu))) return false;
        }
        return true;
    };

    // The camera follows the player, but never shows past the room's edges.
    const bounds = { minX: left.x - 40, maxX: right.x + 40, minY: top.y - WALL_H - 24, maxY: sy(ROOM, ROOM) + 60 };
    const clampAxis = (c: number, lo: number, hi: number, view: number) =>
        view >= hi - lo ? (lo + hi) / 2 : Math.min(hi - view / 2, Math.max(lo + view / 2, c));
    const placeCamera = () => {
        const cx = clampAxis(sx(pu, pv), bounds.minX, bounds.maxX, stage.designWidth() / ZOOM);
        const cy = clampAxis(sy(pu, pv) - 40, bounds.minY, bounds.maxY, stage.height / ZOOM);
        world.position.set(stage.designWidth() / 2 - cx * ZOOM, stage.height / 2 - cy * ZOOM);
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
    const tick = (ticker: Ticker) => {
        clock += ticker.deltaMS;
        const dt = Math.min(ticker.deltaMS / 1000, 0.05);

        const dir = input.read();
        const walk = character.locked ? { x: 0, y: 0 } : dir;
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

        // Arriving: fade in from the flash of the world's portal.
        if (clock < FADE_IN_MS) {
            flash.clear().rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0xd9ffd2, alpha: 1 - clock / FADE_IN_MS });
        } else if (flash.visible) {
            flash.clear();
            flash.visible = false;
        }

        character.update(ticker.deltaMS, dir, pu !== fromU || pv !== fromV);
        controls.tick();
        placeCamera();
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
