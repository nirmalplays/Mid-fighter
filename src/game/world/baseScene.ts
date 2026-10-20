/**
 * The workshop (the base): a room reached from the safe portal or the HUD's Workshop button.
 * Its floor is drawn in the colours of the store building's floor slab (Isometric RPG Buildings,
 * 2x2Tile_Store/Layer4_Floor) on a clean 8 × 8 tile diamond (the slab itself has notched corners
 * made for a small shop), with two back walls drawn in the same outlined style. The player walks on the same
 * iso grid as the world, and the camera follows them around the room. It is
 * furnished with the Ultimate Isometric Pack's placeable items (see
 * workshopLayout.ts). There is no exit portal: the HUD's World button leads back.
 */
import { Assets, Container, Graphics, Rectangle, Sprite, Texture, type Application, type Ticker } from 'pixi.js';
import { store } from '../../state/store.ts';
import type { Scene } from '../scene.ts';
import type { Stage } from '../stage.ts';
import { net } from '../net/multiplayer.ts';
import { progress } from '../progress.ts';
import { createRemotePlayers } from '../net/remotePlayers.ts';
import { createCharacter } from './character.ts';
import { bindControls } from './controls.ts';
import { TILE_DX, TILE_DY } from './constants.ts';
import { createInput, JOY_RADIUS } from './input.ts';
import { ITEM_FRAMES } from './workshopAtlas.ts';
import { WORKSHOP_ITEMS } from './workshopLayout.ts';

/** Room size in tiles. */
const ROOM = 8;
const WALL_H = 190;
const OUTLINE = 0x2b0f1c;
/** The floor art's outline colour. */
const FLOOR_OUTLINE = 0x2f0528;
/** The camera's zoom while following the player (debug: ?roomzoom=0.6 shows the whole room). */
const ZOOM = Number(new URLSearchParams(window.location.search).get('roomzoom')) || 1.4;

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
    // Windows of about one tile's width: the left wall keeps its middle free for the tool rack.
    const winW = 1 / ROOM;
    for (const f of [0.05, 0.84]) windowOn(left, top, f, f + winW);
    for (const f of [0.16, 0.42, 0.62]) windowOn(top, right, f, f + winW);
    // The tool rack: a wooden bar on the left wall, with the tools hung below it.
    const wallPt = (v: number, h: number) => [sx(0, v), sy(0, v) - h];
    walls.poly([...wallPt(2.35, 98), ...wallPt(5.75, 98), ...wallPt(5.75, 112), ...wallPt(2.35, 112)])
        .fill({ color: 0x8b5a3c }).stroke({ width: 3, color: OUTLINE, join: 'round' });
    for (const v of [2.45, 5.65]) {
        walls.poly([...wallPt(v - 0.07, 98), ...wallPt(v + 0.07, 98), ...wallPt(v + 0.07, 76), ...wallPt(v - 0.07, 76)])
            .fill({ color: 0x6f452e }).stroke({ width: 2, color: OUTLINE, join: 'round' });
    }
    walls.zIndex = -2000;
    objects.addChild(walls);

    // The floor: a clean wood diamond in the floor art's own colours (warm wood top, plum outline,
    // reddish front edge), checkered a little so it reads as boards, with a rug under the workbench.
    const gp = (u: number, v: number): [number, number] => [sx(u, v), sy(u, v)];
    const floor = new Graphics();
    const EDGE = 16;
    const L = gp(0, ROOM);
    const Bm = gp(ROOM, ROOM);
    const R = gp(ROOM, 0);
    floor.poly([L[0], L[1], Bm[0], Bm[1], Bm[0], Bm[1] + EDGE, L[0], L[1] + EDGE]).fill({ color: 0x7a3c3b }).stroke({ width: 5, color: FLOOR_OUTLINE, join: 'round' });
    floor.poly([Bm[0], Bm[1], R[0], R[1], R[0], R[1] + EDGE, Bm[0], Bm[1] + EDGE]).fill({ color: 0x663030 }).stroke({ width: 5, color: FLOOR_OUTLINE, join: 'round' });
    for (let j = 0; j < ROOM; j++) {
        for (let i = 0; i < ROOM; i++) {
            const c = (i + j) % 2 === 0 ? 0xba7c4d : 0xb27447;
            floor.poly([...gp(i, j), ...gp(i + 1, j), ...gp(i + 1, j + 1), ...gp(i, j + 1)]).fill({ color: c });
        }
    }
    // Board seams: a faint line along every tile edge.
    for (let k = 1; k < ROOM; k++) {
        floor.moveTo(...gp(k, 0)).lineTo(...gp(k, ROOM)).stroke({ width: 2, color: 0x8e5a35, alpha: 0.55 });
        floor.moveTo(...gp(0, k)).lineTo(...gp(ROOM, k)).stroke({ width: 2, color: 0x8e5a35, alpha: 0.55 });
    }
    floor.poly([...gp(0, 0), ...gp(ROOM, 0), ...gp(ROOM, ROOM), ...gp(0, ROOM)]).stroke({ width: 6, color: FLOOR_OUTLINE, join: 'round' });
    // The rug: red with a gold stripe, under the workbench.
    const rug = (u0: number, v0: number, u1: number, v1: number, fill: number, line: number, width: number) =>
        floor.poly([...gp(u0, v0), ...gp(u1, v0), ...gp(u1, v1), ...gp(u0, v1)]).fill({ color: fill }).stroke({ width, color: line, join: 'round' });
    rug(2.2, 2.4, 5.8, 5.6, 0x7a2f40, FLOOR_OUTLINE, 4);
    rug(2.5, 2.7, 5.5, 5.3, 0x9c4558, 0xe6b84a, 3);
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
        sp.anchor.set(0.5, it.wall ? 0.5 : 0.82);
        sp.scale.set(s);
        sp.position.set(sx(it.u, it.v), sy(it.u, it.v) - lift);
        // Lifted items (stacked, or resting on the table) sort above what they sit on; wall items sit above the wall.
        sp.zIndex = it.wall ? -900 : sy(it.u, it.v) + 0.3 + Math.min(lift, 30) + lift * 0.001;
        objects.addChild(sp);
        if (!it.flat && !it.wall && lift === 0) {
            const sh = new Sprite(shadowTex);
            sh.anchor.set(0.5);
            sh.scale.set((sp.width * 0.85) / 80);
            sh.position.set(sx(it.u, it.v), sy(it.u, it.v) + 4);
            sh.zIndex = sy(it.u, it.v) + 0.2;
            objects.addChild(sh);
        }
        for (const [ci, cj] of it.cells ?? []) solid.add(cj * ROOM + ci);
    }

    // Player.
    const character = createCharacter((tool) => store.patch({ toolId: tool }));
    character.setTool(progress.savedTool());
    const controls = bindControls(character);
    // The other players in the shared room.
    const remotes = createRemotePlayers({
        scene: 'base',
        layer: objects,
        toScreen: (u, v) => ({ x: sx(u, v), y: sy(u, v) }),
        zFor: (u, v) => sy(u, v),
    });
    objects.addChild(character.player);
    world.addChild(character.xray);
    const player = character.player;
    const xray = character.xray;
    // Debug: with ?spawn= the player is exposed for automated checks.
    if (new URLSearchParams(window.location.search).has('spawn')) (window as unknown as { __player?: Container }).__player = player;
    let pu = ROOM / 2;
    let pv = ROOM - 1.4;

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
    let saveClock = 0;
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
        progress.addTime(Math.min(ticker.deltaMS / 1000, 0.25));
        saveClock += ticker.deltaMS;
        if (saveClock > 1000) {
            saveClock = 0;
            progress.record({ scene: 'base', tool: character.tool, hp: store.get().hp });
        }
        net.sendPose({ scene: 'base', u: pu, v: pv, z: 0, face: character.facing, anim: pu !== fromU || pv !== fromV ? character.anim : 'idle', tool: character.tool, dead: character.dead });
        remotes.update(ticker.deltaMS);
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
            remotes.destroy();
            net.sendAway();
            progress.record({ scene: 'base', tool: character.tool, hp: store.get().hp });
            progress.flush();
            character.destroy();
            joyGfx.destroy();
            flash.destroy();
            world.destroy({ children: true });
        },
    };
}
