/**
 * The survival side of the world: the four kingdoms' camps (ruined until liberated), the
 * people of your home camp, guardian spots that call their boss when you come close, the
 * wardens' arenas and the Void Citadel's gate, watchtowers, abandoned houses, chests, the
 * dark barriers on sealed borders, traps you set down, and gathering from the map's trees,
 * rocks, bushes and water (with each kingdom's raw essence and the night's glowing moss).
 * Houses can be walked into: their roof and walls fade away to show a loot crate and a
 * workbench. Lit camp fires and houses are sanctuaries that drive monsters back at night.
 * Some chests are Mimics (they twitch now and then).
 *
 * The scene hands this module its layers and helpers, tells it about prop sprites as chunks
 * load and unload, calls use() when the player presses Use, and update() every frame.
 * What the player owns lives in progress.ts (the save); this shows the world and turns a
 * Use press into gathering, drinking, a chest, a tower, a boss fight or a panel.
 */
import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture, type Renderer, type RenderLayer } from 'pixi.js';
import { store, type AppState } from '../../state/store.ts';
import { commands } from '../commands.ts';
import { progress } from '../progress.ts';
import { sfx, synth } from '../audio.ts';
import { BUILDINGS, CAMP_RADIUS, CARDS, essenceOf, ITEMS, toolItemOf, type BuildingId, type ItemId } from '../survival.ts';
import {
    bossInfo, CITADEL, ELEMENTS, guardCode, KINGDOMS, LANDMARKS, MALAKOR, MALAKOR_CODE, MIMIC_CODE, NPCS, wardenCode,
    type Element, type NpcId, type Region,
} from '../eidolon.ts';
import { CHAR_CELL } from './characterAtlas.ts';
import { framesOf } from './npcArt.ts';

/** Which dressed figure each camp person wears. */
const NPC_ART: Record<string, string> = { theron: 'orin', varis: 'bram', lyra: 'lyra', kael: 'kael', lin: 'lin', thorne: 'thorne', nerissa: 'nerissa' };
import { MAP_TILES, TILE_DX, TILE_DY } from './constants.ts';
import { STONE, WATER, type WorldMap } from './mapGen.ts';
import { FX } from './fxAtlas.ts';
import { createCampView } from './campView.ts';
import { WALL_R } from './campLayout.ts';
import type { ViewMonster } from './monsters.ts';

/** Every kind of tree in the world (they all give wood and resin to the axe). */
export const isTree = (name: string): boolean => name.startsWith('tree_') || name === 'pine_scorched' || name === 'deadtree' || name === 'palm' || name === 'cactus';
/** What a prop gives when gathered, the tool it takes, and how long it takes to grow back (ms). */
interface Yield { item: ItemId; tool: string[]; regrow: number; verb: string }
const yieldOf = (name: string): Yield | null => {
    if (isTree(name) || name === 'stump' || name.startsWith('driftwood')) return { item: 'wood', tool: ['axe'], regrow: 45000, verb: 'Chop' };
    if (name.startsWith('rock')) return { item: 'stone', tool: ['pickaxe'], regrow: 60000, verb: 'Mine' };
    if (name.startsWith('gbush') || name.startsWith('bbush')) return { item: 'berries', tool: ['none', 'shovel'], regrow: 30000, verb: 'Pick berries' };
    if (name.startsWith('dbush')) return { item: 'herb', tool: ['none', 'shovel'], regrow: 30000, verb: 'Pick herbs' };
    return null;
};
const TOOL_NAME: Record<string, string> = { axe: 'axe', pickaxe: 'pickaxe', none: 'bare hands', fishingpole: 'fishing pole' };
const REGION_OF = (n: number): Region => (n === 0 ? 'citadel' : ELEMENTS[n - 1]);

/** How close (tiles) the player must be to use something. */
const REACH = 1.9;
/** A guardian comes out when the player is this close (tiles) to its spot. */
const GUARD_WAKE = 11;
/** Barriers are drawn this far around the player (tiles). */
const VEIL_R = 16;
const MAX_DEFENCES = 12;

type Point = { u: number; v: number; label: string };

export interface SurvivalLayer {
    /** A chunk drew a prop (by its index in map.props). */
    trackProp(index: number, sprite: Sprite): void;
    untrackProp(index: number): void;
    /** May the player stand on this cell (its region's barrier is down)? */
    canEnter(i: number, j: number): boolean;
    /** The player pressed Use. Returns true if it did something with the world. */
    use(u: number, v: number, facing: number, tool: string): boolean;
    /** Set a trap or barricade down in front of the player. */
    place(id: ItemId, u: number, v: number, facing: number): boolean;
    update(dtMs: number, u: number, v: number, facing: number, tool: string, monsters: ViewMonster[]): void;
    destroy(): void;
}

export function createSurvivalLayer(o: {
    map: WorldMap;
    layer: Container;
    glowTex: Texture;
    shadowTex: Texture;
    renderer: Renderer;
    /** Drawn above the night's dark: the camps' fires show through it from afar. */
    nightLayer?: RenderLayer | null;
    /** An iso-art frame as a sprite whose tile centre is at (x, y). */
    isoSprite: (name: string, x: number, y: number) => Sprite;
    heightAt: (u: number, v: number) => number;
    toScreen: (u: number, v: number) => { x: number; y: number };
    zFor: (u: number, v: number) => number;
    levelH: number;
    /** Floating text over the player. */
    say: (message: string, color?: number) => void;
    banner: (text: string) => void;
    /** Sparkle on the ground at a spot. */
    sparkle: (u: number, v: number) => void;
    /** Gold bursting from an opened chest. */
    coins?: (u: number, v: number) => void;
    /** Bring a boss in (the simulation refuses a second copy of one already alive). */
    summon: (code: number, tier: number, u: number, v: number) => void;
    /** Hurt monsters within r of (u, v). */
    blast: (u: number, v: number, damage: number, r: number) => void;
    /** Damage multiplier for traps (the player's power). */
    damageMul: () => number;
    /** Put items on the ground for everyone (chest loot; gathering when playing with others). */
    loot: (u: number, v: number, items: [ItemId, number][]) => void;
    /** Playing with others nearby: gathering drops on the ground to share. */
    shared: () => boolean;
    /** How dark it is (0 day .. 1 night): glowing moss shows at night. */
    dark: () => number;
    /** The story's say: where the marker points (undefined = the chapters decide), what Use offers, who is in camp. */
    story?: {
        target: (u: number, v: number) => Point | null | undefined;
        prompt: (u: number, v: number, facing: number) => { hint: string; act: AppState['act'] } | null;
        /** Which land's camp a person stands in (null: not in the world yet), and where in it (null: their usual spot). */
        npcCamp: (id: string) => Element | null;
        npcAt: (id: string) => [number, number] | null;
        /** A gathering step: what to point at (the nearest rock or tree). */
        gather: () => 'stone' | 'wood' | null;
        /** Pyraxis's bosses come from the story, not their old spots. */
        active: () => boolean;
    };
}): SurvivalLayer {
    const { map } = o;
    const all: (Sprite | Graphics | Text)[] = [];
    const ground = (u: number, v: number) => {
        const p = o.toScreen(u, v);
        return { x: p.x, y: p.y - o.heightAt(u, v) * o.levelH };
    };
    const label = (text: string, size = 13, fill = 0xffffff) => {
        const t = new Text({ text, style: { fontFamily: 'sans-serif', fontSize: size, fontWeight: '900', fill, stroke: { color: 0x1a0c10, width: 4 }, align: 'center' } });
        t.anchor.set(0.5, 1);
        t.zIndex = 1e5;
        all.push(t);
        return t;
    };
    const glow = (u: number, v: number, tint: number, scale: number) => {
        const g = new Sprite(o.glowTex);
        g.anchor.set(0.5);
        g.tint = tint;
        g.scale.set(scale);
        const at = ground(u, v);
        g.position.set(at.x, at.y);
        g.zIndex = o.zFor(u, v) - 0.45;
        o.layer.addChild(g);
        all.push(g);
        return g;
    };
    const stand = (s: Sprite, u: number, v: number) => {
        const at = ground(u, v);
        s.position.set(at.x, at.y);
        s.zIndex = o.zFor(u, v) + 0.05;
        o.layer.addChild(s);
        all.push(s);
        return s;
    };
    const shadow = (u: number, v: number, scale: number) => {
        const sh = new Sprite(o.shadowTex);
        sh.anchor.set(0.5);
        sh.scale.set(scale);
        const at = ground(u, v);
        sh.position.set(at.x, at.y + 4);
        sh.zIndex = o.zFor(u, v) - 0.4;
        o.layer.addChild(sh);
        all.push(sh);
    };
    const open = (r: Region) => progress.open(r);
    const regionAt = (u: number, v: number): Region => REGION_OF(map.region[Math.floor(v) * MAP_TILES + Math.floor(u)]);

    // The camp fires' flames (Super Pixel Effects: fire_looping_004A).
    const campFire = (() => {
        const sheet = Assets.get<Texture>('fx_campfire');
        sheet.source.scaleMode = 'nearest';
        return Array.from({ length: FX.campfire.n }, (_, f) => new Texture({ source: sheet.source, frame: new Rectangle((f % FX.campfire.c) * FX.campfire.w, Math.floor(f / FX.campfire.c) * FX.campfire.h, FX.campfire.w, FX.campfire.h) }));
    })();

    // ---- Camps: the same five tents in every kingdom's camp, ruined until that kingdom is liberated.
    const tents = map.camps.map((c) => {
        const tex = Assets.get<Texture>(BUILDINGS[c.id].art);
        tex.source.scaleMode = 'linear';
        const s = new Sprite(tex);
        s.anchor.set(0.5, 0.78);
        s.scale.set(0.21);
        stand(s, c.i + 0.5, c.j + 0.5);
        shadow(c.i + 0.5, c.j + 0.5, 1.1);
        const at = ground(c.i + 0.5, c.j + 0.5);
        // Not built yet: a pegged-out plot, a stack of logs and a sign (its name shows as you come near).
        const site = o.isoSprite('camp_site', at.x, at.y);
        site.zIndex = o.zFor(c.i + 0.5, c.j + 0.5) + 0.04;
        o.layer.addChild(site);
        all.push(site);
        const t = label('', 10);
        t.position.set(at.x, at.y - 66);
        o.layer.addChild(t);
        return { ...c, s, t, site };
    });
    // The walled war camps themselves (world/campLayout.ts, drawn by world/campView.ts).
    const campView = createCampView({
        layer: o.layer, nightLayer: o.nightLayer, glowTex: o.glowTex, shadowTex: o.shadowTex, flames: campFire,
        isoSprite: o.isoSprite, ground, zFor: o.zFor,
    });
    const campMarks = LANDMARKS.filter((l) => l.kind === 'camp').map((L) => {
        const u = L.i + 0.5, v = L.j + 0.5;
        const fire = glow(u, v, 0xffa040, 1.6);
        fire.texture = campView.glowTex;
        fire.blendMode = 'add';
        const at = ground(u, v);
        // the pack's looping fire in the fire pit, a frame every 80 ms
        const flame = new Sprite(campFire[0]);
        flame.anchor.set(0.5, 0.9);
        flame.position.set(at.x, at.y - 2);
        flame.zIndex = o.zFor(u, v) + 0.08;
        o.layer.addChild(flame);
        all.push(flame);
        campView.light(fire, u, v);
        campView.light(flame, u, v);
        // The camp's name hangs over its gate (seen as you come up the road, not over the fire).
        const names: Record<string, string> = { fire: 'Watchtower Sanctuary', air: 'Cloud-Watch Aerie', water: 'Rime-Shelf Outpost', earth: 'Coalition Sanctuary' };
        const name = label(names[L.el!] ?? `${KINGDOMS[L.el!].name} camp`, 13, 0xffe2b0);
        const g = campView.gate(L.el!);
        const gp = ground(g.u, g.v);
        name.position.set(gp.x, gp.y - 160);
        o.layer.addChild(name);
        // The palisade is the sanctuary's edge now (monsters stop at CAMP_RADIUS, just outside it).
        const ring = new Graphics();
        return { L, u, v, fire, flame, ring, name, gate: g };
    });

    // ---- The people of your home camp (the character art, tinted).
    const idle = Assets.get<Texture>('char:idle');
    const npcTex = new Texture({ source: idle.source, frame: new Rectangle(0, 0, CHAR_CELL, CHAR_CELL) });
    let npcs: { id: NpcId; u: number; v: number; s: Sprite; t: Text }[] = [];
    /** Where everyone stands (it changes as the story moves people between camps). */
    let npcKey = '';
    const npcPlaces = () => (Object.keys(NPCS) as NpcId[]).map((id) => {
        const camp = o.story ? o.story.npcCamp(id) : progress.kingdom();
        return { id, camp, at: (o.story?.npcAt(id) ?? NPCS[id].at) as [number, number] };
    });
    const placeNpcs = () => {
        for (const n of npcs) {
            n.s.destroy();
            n.t.destroy();
        }
        npcs = [];
        const places = npcPlaces();
        npcKey = JSON.stringify(places);
        for (const { id, camp, at: off } of places) {
            if (!camp) continue;
            const L = LANDMARKS.find((l) => l.kind === 'camp' && l.el === camp)!;
            const def = NPCS[id];
            const u = L.i + 0.5 + off[0], v = L.j + 0.5 + off[1];
            const s = new Sprite(npcTex);
            s.anchor.set(90 / CHAR_CELL, 172 / CHAR_CELL);
            s.scale.set(0.5);
            // Dressed in their own art (tools/build-npcs.py); the plain tinted figure until it loads.
            if (!framesOf(NPC_ART[id], 'idle')) s.tint = def.tint;
            const at = ground(u, v);
            s.position.set(at.x, at.y);
            s.zIndex = o.zFor(u, v) + 0.1;
            const t = new Text({ text: def.name, style: { fontFamily: 'sans-serif', fontSize: 13, fontWeight: '900', fill: 0xfff3c4, stroke: { color: 0x1a0c10, width: 4 } } });
            t.anchor.set(0.5, 1);
            t.zIndex = 1e5;
            t.position.set(at.x, at.y - 92);
            o.layer.addChild(s, t);
            npcs.push({ id, u, v, s, t });
        }
    };
    placeNpcs();

    // ---- Guardians, arenas and the citadel.
    const sheet = Assets.get<Texture>('shrine');
    sheet.source.scaleMode = 'nearest';
    const portalFrames = Array.from({ length: 6 }, (_, n) => new Texture({ source: sheet.source, frame: new Rectangle(n * 112, 0, 112, 128) }));
    const guards = LANDMARKS.filter((l) => l.kind === 'guard').map((L) => {
        const u = L.i + 0.5, v = L.j + 0.5;
        const ring = glow(u, v, 0x7c3aed, 1.3);
        const t = label('', 12, 0xe9d5ff);
        const at = ground(u, v);
        t.position.set(at.x, at.y - 18);
        o.layer.addChild(t);
        return { L, u, v, ring, t, called: -1e9 };
    });
    const gates = LANDMARKS.filter((l) => l.kind === 'arena' || l.kind === 'citadel').map((L) => {
        const u = L.i + 0.5, v = L.j + 0.5;
        const isCitadel = L.kind === 'citadel';
        const color = isCitadel ? CITADEL.color : KINGDOMS[L.el!].color;
        const g = glow(u, v, color, isCitadel ? 3 : 1.6);
        const s = stand(new Sprite(portalFrames[0]), u, v);
        s.anchor.set(0.5, 0.86);
        s.scale.set(isCitadel ? 3 : 1.6);
        const t = label(isCitadel ? CITADEL.name : `Arena of ${KINGDOMS[L.el!].name}`, isCitadel ? 16 : 13, 0xffe2b0);
        const at = ground(u, v);
        t.position.set(at.x, at.y - (isCitadel ? 380 : 210));
        o.layer.addChild(t);
        return { L, u, v, s, g, color, called: -1e9 };
    });

    // ---- Watchtowers: stacked stone with a beacon on top once climbed.
    const towers = LANDMARKS.filter((l) => l.kind === 'tower').map((L) => {
        const u = L.i + 0.5, v = L.j + 0.5;
        const at = ground(u, v);
        for (let n = 0; n < 5; n++) {
            const c = o.isoSprite(n === 4 ? 'snow' : 'stone1', at.x, at.y - n * o.levelH * 2);
            c.tint = n === 4 ? 0xffffff : 0xb8b0c0 - n * 0x080808;
            c.zIndex = o.zFor(u, v) + 0.01 * n + (n === 4 ? 0.05 : 0);
            o.layer.addChild(c);
            all.push(c);
        }
        const beacon = new Sprite(o.glowTex);
        beacon.anchor.set(0.5);
        beacon.scale.set(0.8);
        beacon.tint = 0xffd84d;
        beacon.position.set(at.x, at.y - 5 * o.levelH * 2 - 10);
        beacon.zIndex = 1e5 - 2;
        o.layer.addChild(beacon);
        all.push(beacon);
        const t = label('Watchtower', 12, 0xffe2b0);
        t.position.set(at.x, at.y - 5 * o.levelH * 2 - 30);
        o.layer.addChild(t);
        return { L, u, v, beacon };
    });

    // ---- Abandoned houses (built from the Isometric RPG Buildings layers, one look per kingdom).
    const houses = LANDMARKS.filter((l) => l.kind === 'house').map((L) => {
        // The house covers tiles (i-1..i, j-1..j); it stands on their shared corner.
        const u = L.i, v = L.j;
        const piece = (name: string, z: number) => {
            const tex = Assets.get<Texture>(name);
            tex.source.scaleMode = 'linear';
            // The art's front corner stands on the footprint's front corner, sized to its two-by-two floor.
            const sp = stand(new Sprite(tex), u + 1, v + 1);
            sp.anchor.set(0.5, 0.93);
            sp.scale.set(0.55);
            sp.zIndex = z;
            return sp;
        };
        // The floor and back walls sort behind anyone inside; the front walls and roof in front of them.
        const base = piece(`house_${L.el}_base`, o.zFor(L.i - 0.5, L.j - 0.5) - 0.2);
        const shell = piece(`house_${L.el}_shell`, o.zFor(L.i + 0.5, L.j + 0.5) + 0.1);
        shadow(u, v, 2.2);
        // Inside: a loot crate at the back, a workbench by the side wall.
        const crate = { u: L.i - 0.55, v: L.j - 0.75 };
        const bench = { u: L.i - 0.75, v: L.j - 0.2 };
        const crateG = new Graphics()
            .rect(-16, -22, 32, 22).fill({ color: 0x9a6a3c }).stroke({ width: 3, color: 0x2b0f1c })
            .rect(-16, -14, 32, 4).fill({ color: 0x6b3f22 });
        const benchG = new Graphics()
            .rect(-22, -18, 44, 8).fill({ color: 0xb07a46 }).stroke({ width: 3, color: 0x2b0f1c })
            .rect(-18, -10, 5, 12).fill({ color: 0x6b3f22 }).rect(13, -10, 5, 12).fill({ color: 0x6b3f22 })
            .rect(-8, -26, 14, 8).fill({ color: 0x8a8a96 }).stroke({ width: 2, color: 0x2b0f1c });
        for (const [g, at] of [[crateG, crate], [benchG, bench]] as const) {
            const gp = ground(at.u, at.v);
            g.position.set(gp.x, gp.y);
            g.zIndex = o.zFor(at.u, at.v) - 0.15;
            o.layer.addChild(g);
            all.push(g);
        }
        return { L, u, v, base, shell, crate, bench };
    });

    // ---- Chests
    const chestTex = Assets.get<Texture>('chest');
    chestTex.source.scaleMode = 'nearest';
    const chests = map.chests.map((c, id) => {
        const g = glow(c.i + 0.5, c.j + 0.5, 0xffd84d, 0.55);
        const s = stand(new Sprite(chestTex), c.i + 0.5, c.j + 0.5);
        s.anchor.set(0.5, 0.85);
        s.scale.set(0.75);
        return { ...c, u: c.i + 0.5, v: c.j + 0.5, id, s, glow: g, baseY: s.y };
    });
    /** Is this chest (in its current fill) a Mimic? One in five, decided by the chest and when it was last opened. */
    const mimic = (id: number): boolean => {
        const seed = (id * 7919 + Math.floor(progress.chestOpenedAt(id)) * 31) >>> 0;
        return ((seed * 2654435761) >>> 0) % 5 === 0;
    };

    // ---- Barriers: a purple curtain standing on the tile edges between a sealed region and open ground near the
    // player. Each edge is a diagonal on screen ("/" between i-neighbours, "\\" between j-neighbours), so the
    // curtain follows the diamond grid instead of stacking up as squares.
    const VEIL_H = 84;
    const curtain = (rising: boolean) => {
        const g = new Graphics();
        const STRIPS = 12;
        const h = VEIL_H / STRIPS;
        for (let n = 0; n < STRIPS; n++) {
            const y0 = n * h, y1 = Math.min(VEIL_H, (n + 1) * h + 0.5);
            // Bottom line: "/" runs from (0, H + DY) up to (DX, H); "\\" from (0, H) down to (DX, H + DY).
            const [l, r] = rising ? [VEIL_H + TILE_DY, VEIL_H] : [VEIL_H, VEIL_H + TILE_DY];
            g.poly([0, l - y0, TILE_DX, r - y0, TILE_DX, r - y1, 0, l - y1]).fill({ color: 0xc084fc, alpha: 0.55 * (1 - n / STRIPS) ** 1.6 });
        }
        const tex = o.renderer.generateTexture({ target: g, resolution: 1 });
        g.destroy();
        return tex;
    };
    const veilRise = curtain(true);
    const veilFall = curtain(false);
    const veils = new Map<number, Sprite>();
    let veilKey = '';
    /** The four edges of a cell: neighbour step, which curtain, and the edge's left end relative to the cell centre. */
    const EDGES: [number, number, boolean, number, number][] = [
        [1, 0, true, 0, TILE_DY],
        [-1, 0, true, -TILE_DX, 0],
        [0, 1, false, -TILE_DX, 0],
        [0, -1, false, 0, -TILE_DY],
    ];
    const syncVeils = (u: number, v: number) => {
        const key = `${Math.floor(u)},${Math.floor(v)},${store.get().wardens.join()},${store.get().kingdom}`;
        if (key === veilKey) return;
        veilKey = key;
        const want = new Set<number>();
        const ci = Math.floor(u), cj = Math.floor(v);
        for (let j = cj - VEIL_R; j <= cj + VEIL_R; j++) {
            for (let i = ci - VEIL_R; i <= ci + VEIL_R; i++) {
                if (i < 1 || j < 1 || i >= MAP_TILES - 1 || j >= MAP_TILES - 1) continue;
                const k = j * MAP_TILES + i;
                if (open(REGION_OF(map.region[k])) || map.terrain[k] === WATER) continue;
                for (let e = 0; e < EDGES.length; e++) {
                    const [di, dj, rising, ox, oy] = EDGES[e];
                    const n = k + di + dj * MAP_TILES;
                    if (!open(REGION_OF(map.region[n])) || map.terrain[n] === WATER) continue;
                    const id = k * 4 + e;
                    want.add(id);
                    if (veils.has(id)) continue;
                    const s = new Sprite(rising ? veilRise : veilFall);
                    // Anchor on the left end of the bottom line.
                    s.anchor.set(0, rising ? 1 : VEIL_H / (VEIL_H + TILE_DY));
                    const at = ground(i + 0.5, j + 0.5);
                    s.position.set(at.x + ox, at.y + oy);
                    // Sorted with whichever of the two cells is nearer the viewer.
                    s.zIndex = o.zFor(i + 0.5 + Math.max(0, di), j + 0.5 + Math.max(0, dj)) - 0.3;
                    s.blendMode = 'add';
                    o.layer.addChild(s);
                    veils.set(id, s);
                }
            }
        }
        for (const [id, s] of veils) {
            if (!want.has(id)) {
                s.destroy();
                veils.delete(id);
            }
        }
    };

    // ---- Gathering from props
    const propCell = new Map<number, number>(); // cell -> prop index (gatherable ones)
    map.props.forEach((p, n) => {
        if (yieldOf(p.name)) propCell.set(p.j * MAP_TILES + p.i, n);
    });
    const propSprites = new Map<number, Sprite>();
    const regrow = new Map<number, number>(); // prop index -> ms until it can be gathered again
    const shake = new Map<number, number>(); // prop index -> ms of shake left
    const looks = (n: number, sp: Sprite) => {
        sp.alpha = regrow.has(n) ? 0.45 : 1;
    };

    // ---- Traps and barricades the player set down (this run only).
    const defences: { kind: 'trap_spike' | 'barricade'; u: number; v: number; g: Graphics; hits: number; cd: number }[] = [];

    // ---- Finding what is in front of the player
    type Target =
        | { kind: 'prop'; n: number; y: Yield; d: number }
        | { kind: 'chest'; c: (typeof chests)[number]; d: number }
        | { kind: 'tent'; id: BuildingId; el: Element; d: number }
        | { kind: 'fire'; el: Element; d: number }
        | { kind: 'npc'; id: NpcId; d: number }
        | { kind: 'gate'; g: (typeof gates)[number]; d: number }
        | { kind: 'tower'; t: (typeof towers)[number]; d: number }
        | { kind: 'crate'; h: (typeof houses)[number]; d: number }
        | { kind: 'bench'; h: (typeof houses)[number]; d: number }
        | { kind: 'water'; d: number };
    const aim = (facing: number) => {
        const a = (facing * Math.PI) / 4;
        return { du: (Math.cos(a) + Math.sin(a)) / Math.SQRT2, dv: (Math.sin(a) - Math.cos(a)) / Math.SQRT2 };
    };
    /** Distance, nudged so things in front of the player win over things behind. */
    const score = (u: number, v: number, cu: number, cv: number, f: { du: number; dv: number }) => {
        const d = Math.hypot(cu - u, cv - v);
        const dot = d > 0 ? ((cu - u) * f.du + (cv - v) * f.dv) / d : 1;
        return { d, s: d - 0.45 * dot };
    };
    /** What the action button shows for a target: an icon kind and a few words. */
    const actionFor = (t: Target, hint: string, tool: string): AppState['act'] => {
        switch (t.kind) {
            case 'npc': return { kind: 'talk', label: NPCS[t.id].name };
            case 'tent': {
                if (!open(t.el)) return { kind: 'wait', label: 'Ruined tent' };
                const lv = store.get().buildings[t.id];
                return { kind: 'build', label: `${lv > 0 ? 'Upgrade' : 'Build'} ${BUILDINGS[t.id].name}`, building: t.id };
            }
            case 'prop': {
                if (regrow.has(t.n)) return { kind: 'wait', label: 'Growing back' };
                const k = t.y.item === 'wood' ? 'chop' : t.y.item === 'stone' ? 'mine' : 'pick';
                return { kind: k, label: hint };
            }
            case 'chest': return { kind: progress.chestReady(t.c.id) ? 'open' : 'wait', label: hint };
            case 'crate': return { kind: progress.houseReady(t.h.L.id) ? 'search' : 'wait', label: hint };
            case 'bench': return { kind: 'bench', label: 'Workbench' };
            case 'fire': return { kind: open(t.el) ? 'travel' : 'wait', label: open(t.el) ? 'Travel' : 'Cold campfire' };
            case 'tower': return { kind: 'climb', label: 'Climb tower' };
            case 'gate': return { kind: 'challenge', label: hint };
            default: return { kind: tool === 'fishingpole' ? 'fish' : 'drink', label: hint };
        }
    };
    const close = (u: number, v: number, x: { u: number; v: number }, pad: number) => Math.abs(x.u - u) < pad && Math.abs(x.v - v) < pad;
    const find = (u: number, v: number, facing: number, tool: string): Target | null => {
        const f = aim(facing);
        let best: Target | null = null;
        let bestS = Infinity;
        const offer = (t: Target, s: number, reach = REACH) => {
            if (t.d <= reach && s < bestS) {
                best = t;
                bestS = s;
            }
        };
        for (const n of npcs) {
            if (!n.s.visible) continue;
            const { d, s } = score(u, v, n.u, n.v, f);
            offer({ kind: 'npc', id: n.id, d }, s - 1.2);
        }
        for (const g of gates) {
            if (!close(u, v, g, 6)) continue;
            const { d, s } = score(u, v, g.u, g.v, f);
            offer({ kind: 'gate', g, d: d - (g.L.kind === 'citadel' ? 1.4 : 0.6) }, s - 1);
        }
        for (const t of towers) {
            if (!close(u, v, t, 4)) continue;
            const { d, s } = score(u, v, t.u, t.v, f);
            offer({ kind: 'tower', t, d: d - 0.3 }, s - 1);
        }
        for (const h of houses) {
            if (!close(u, v, h, 4)) continue;
            const c = score(u, v, h.crate.u, h.crate.v, f);
            offer({ kind: 'crate', h, d: c.d }, c.s - 0.8, 1.3);
            const b = score(u, v, h.bench.u, h.bench.v, f);
            offer({ kind: 'bench', h, d: b.d }, b.s - 0.8, 1.3);
        }
        for (const c of chests) {
            if (!close(u, v, c, 3)) continue;
            const { d, s } = score(u, v, c.u, c.v, f);
            offer({ kind: 'chest', c, d }, s - 0.5);
        }
        for (const c of campMarks) {
            if (!close(u, v, c, 8)) continue;
            const { d, s } = score(u, v, c.u, c.v, f);
            offer({ kind: 'fire', el: c.L.el!, d }, s - 0.3, 1.6);
        }
        for (const t of tents) {
            if (!close(u, v, { u: t.i, v: t.j }, 3)) continue;
            const { d, s } = score(u, v, t.i + 0.5, t.j + 0.5, f);
            offer({ kind: 'tent', id: t.id, el: t.el, d }, s);
        }
        const ci = Math.floor(u), cj = Math.floor(v);
        for (let j = cj - 2; j <= cj + 2; j++) {
            for (let i = ci - 2; i <= ci + 2; i++) {
                const n = propCell.get(j * MAP_TILES + i);
                if (n === undefined) continue;
                const y = yieldOf(map.props[n].name)!;
                const { d, s } = score(u, v, i + 0.5, j + 0.5, f);
                // Prefer what the held tool can gather.
                offer({ kind: 'prop', n, y, d }, s + (y.tool.includes(tool) ? 0 : 0.6) + (regrow.has(n) ? 1.5 : 0));
            }
        }
        if (!best) {
            for (let j = cj - 2; j <= cj + 2 && !best; j++) {
                for (let i = ci - 2; i <= ci + 2; i++) {
                    if (i < 0 || j < 0 || i >= MAP_TILES || j >= MAP_TILES || map.terrain[j * MAP_TILES + i] !== WATER) continue;
                    if (map.region[j * MAP_TILES + i] === 1) continue; // Pyraxis "water" is lava
                    best = { kind: 'water', d: 1 };
                    break;
                }
            }
        }
        return best;
    };

    /** Where the last gather happened (shared drops land there). */
    let lastSpot = { u: 0, v: 0 };
    const give = (item: ItemId, n: number, color = 0xffffff) => {
        const extra = Math.random() < progress.power().extra ? 1 : 0;
        if (o.shared()) {
            o.loot(lastSpot.u, lastSpot.v, [[item, n + extra]]);
            return n + extra;
        }
        const got = progress.addItem(item, n + extra);
        if (got > 0) o.say(`+${got} ${ITEMS[item].name}${extra ? ' (bonus)' : ''}`, color);
        return got;
    };
    const essenceChance = (u: number, v: number, chance: number) => {
        const r = regionAt(u, v);
        if (r !== 'citadel' && Math.random() < chance) give(essenceOf(r), 1, KINGDOMS[r].color);
    };

    const openChest = (c: (typeof chests)[number]) => {
        if (!progress.chestReady(c.id)) {
            o.say('Empty. It refills later', 0xcccccc);
            return;
        }
        if (mimic(c.id)) {
            progress.openChest(c.id);
            o.summon(MIMIC_CODE, progress.tierOf(regionAt(c.u, c.v) === 'citadel' ? null : (regionAt(c.u, c.v) as Element)), c.u, c.v + 0.8);
            o.banner('It was a Mimic! Watch for chests that twitch');
            sfx('fall');
            return;
        }
        progress.openChest(c.id);
        o.sparkle(c.u, c.v);
        o.coins?.(c.u, c.v);
        sfx('chest');
        if (Math.random() < 0.75) {
            const card = progress.rollCard(0.1 + Math.min(0.4, store.get().wave * 0.02));
            const lv = progress.addCard(card);
            o.banner(lv === 1 ? `New card: ${CARDS[card].name}!` : `${CARDS[card].name} reached level ${lv}!`);
        }
        // The loot spills out on the ground (anyone nearby can take it).
        o.loot(c.u, c.v + 0.8, chestLoot(regionAt(c.u, c.v)));
        progress.gainXp(15);
    };

    /** What a chest (or a Mimic's hoard) holds. */
    const chestLoot = (r: Region): [ItemId, number][] => {
        const pool: ItemId[] = ['wood', 'iron', 'gold', 'crystal', 'herb', 'honey', 'gland', 'resin', 'potion_red', 'meat'];
        const out: [ItemId, number][] = [];
        for (let n = 0; n < 3; n++) {
            const it = pool[Math.floor(Math.random() * pool.length)];
            out.push([it, it === 'gold' || it === 'crystal' || it === 'potion_red' ? 1 : 2 + Math.floor(Math.random() * 3)]);
        }
        if (r !== 'citadel' && Math.random() < 0.5) out.push([essenceOf(r), 1]);
        return out;
    };

    const useGate = (g: (typeof gates)[number]) => {
        const now = performance.now();
        if (g.L.kind === 'citadel') {
            if (store.get().wardens.length < 4) {
                o.banner(`The Citadel is sealed by four wardens. ${4 - store.get().wardens.length} still stand`);
                return;
            }
            if (now - g.called < 8000) return;
            g.called = now;
            o.summon(MALAKOR_CODE, progress.tierOf(null), g.u + 1.5, g.v + 2.5);
            sfx('fanfare');
            o.banner(`${MALAKOR.name}: "Look at you, wearing their powers like stolen clothes. Let me show you what they really are."`);
            return;
        }
        const e = g.L.el!;
        if (e === 'fire' && o.story?.active()) {
            o.banner(progress.guardsLeft('fire') > 0 ? 'The caldera is sealed. Follow the story' : 'Ignis waits in the caldera');
            return;
        }
        const k = KINGDOMS[e];
        if (progress.wardenDone(e)) {
            o.say(`The seal of ${k.name} is broken`, k.color);
            return;
        }
        const left = progress.guardsLeft(e);
        if (left > 0) {
            o.banner(`The seal holds while ${left} guardian${left > 1 ? 's' : ''} of ${k.name} remain${left > 1 ? '' : 's'}`);
            return;
        }
        if (now - g.called < 8000) return;
        g.called = now;
        o.summon(wardenCode(e), progress.tierOf(e), g.u + 1.5, g.v + 2);
        sfx('fanfare');
        o.banner(`${k.warden.name}: "${k.warden.lines[Math.floor(Math.random() * k.warden.lines.length)]}"`);
    };

    const climb = (t: (typeof towers)[number]) => {
        const first = progress.climbTower(t.L.id);
        progress.reveal(t.u, t.v, 72);
        o.sparkle(t.u, t.v);
        o.banner(first ? 'You climb the watchtower: the land around it shows on your map (Bag › Map)' : 'You look out over the land again');
    };

    const gather = (t: Extract<Target, { kind: 'prop' }>, tool: string) => {
        if (regrow.has(t.n)) {
            o.say('Growing back…', 0xcccccc);
            return;
        }
        // Pick up the right tool for the job (if you own it).
        const need = t.y.tool.includes(tool) ? tool : t.y.tool[0];
        if (need !== 'none' && !progress.hasTool(need)) {
            o.say(`You need a ${TOOL_NAME[need] ?? need}`, 0xffffff);
            return;
        }
        if (need !== tool) {
            const slot = progress.hotbar().indexOf(toolItemOf(need));
            if (slot >= 0) commands.emit({ type: 'slot', index: slot });
            else commands.emit({ type: 'equip', tool: need });
        }
        if (t.y.item === 'wood') synth('chop');
        else if (t.y.item === 'stone') synth('mine');
        else sfx('pickup', 0.5);
        const p = map.props[t.n];
        lastSpot = { u: p.i + 0.5, v: p.j + 1 };
        const k = p.j * MAP_TILES + p.i;
        shake.set(t.n, 260);
        regrow.set(t.n, t.y.regrow);
        const sp = propSprites.get(t.n);
        if (sp) looks(t.n, sp);
        if (t.y.item === 'stone') {
            const high = map.height[k] >= 4 || map.terrain[k] === STONE;
            give('stone', 2, 0xd6d3d1);
            if (Math.random() < (high ? 0.35 : 0.22)) give('iron', 1, 0xc9b6a8);
            if (Math.random() < (high ? 0.16 : 0.06)) give('gold', 1, 0xffd84d);
            if (Math.random() < (high ? 0.18 : 0.05)) give('crystal', 1, 0xc084fc);
            // Each land's own stone: lichen in Pyraxis, copper and storm-quartz in Zephyria, shark-teeth in Aquatica.
            const land = regionAt(p.i, p.j);
            if (land === 'fire' && Math.random() < 0.6) give('lichen', 1 + (Math.random() < 0.5 ? 1 : 0), 0xa3e635);
            if (land === 'air' && Math.random() < 0.6) give('copper_ore', 1, 0xe08a4a);
            if (land === 'air' && Math.random() < 0.35) give('storm_quartz', 1, 0xa78bfa);
            if (land === 'water' && Math.random() < 0.45) give('shark_tooth', 1, 0xe7e5e4);
            // Glowing moss shows itself in the dark (and grows thick in the Void Wastes).
            if (Math.random() < 0.08 + 0.25 * o.dark() + (regionAt(p.i, p.j) === 'earth' ? 0.1 : 0)) give('glowing_moss', 1, 0x86efac);
        } else if (t.y.item === 'wood') {
            give('wood', 2, 0xd6a36a);
            if (Math.random() < 0.3) give('resin', 1, 0xf59e0b);
            if (Math.random() < 0.4) give('bark', 1, 0x92400e);
        } else {
            const dig = tool === 'shovel' || need === 'shovel' ? 1 : 0;
            give(t.y.item, 1 + dig + (Math.random() < 0.4 ? 1 : 0), t.y.item === 'herb' ? 0x9be36b : 0xd17bf0);
            if (t.y.item === 'berries' && Math.random() < 0.12) give('honey', 1, 0xfbbf24);
            if (t.y.item === 'herb' && Math.random() < (regionAt(p.i, p.j) === 'air' ? 0.35 : 0.12)) give('gale_blossom', 1, 0x7dd3fc);
            if (t.y.item === 'herb' && regionAt(p.i, p.j) === 'air' && Math.random() < 0.4) give('thunder_thistle', 1, 0x7dd3fc);
        }
        essenceChance(p.i + 0.5, p.j + 0.5, 0.12);
        progress.gainXp(1);
    };

    const water = (u: number, v: number, tool: string) => {
        lastSpot = { u, v };
        if (tool === 'fishingpole') {
            if (Math.random() < 0.55) {
                give('fish', 1, 0x7dd3fc);
                sfx('pickup');
            }
            else o.say('Nothing bit…', 0xcccccc);
            essenceChance(u, v, regionAt(u, v) === 'water' ? 0.25 : 0);
            if (regionAt(u, v) === 'water' && Math.random() < 0.6) give('kelp_fiber', 1, 0x2dd4bf);
            progress.gainXp(1);
            return;
        }
        const filled = progress.drink();
        if (regionAt(u, v) === 'water' && Math.random() < 0.5) give('kelp_fiber', 1, 0x2dd4bf);
        sfx('click', 0.6);
        o.say(filled ? 'Drank deep · +1 Water flask' : 'Drank deep', 0x7dd3fc);
    };

    /** Where the objective points: a person, a guardian, an arena, a tower, a chest or home. */
    const objectiveTarget = (u: number, v: number): Point | null => {
        const s = store.get();
        const home = s.kingdom;
        if (!home) return null;
        const want = o.story?.gather() ?? null;
        const st = want ? undefined : o.story?.target(u, v);
        if (st !== undefined) return st;
        const goal = want ? { kind: 'stat' as const, stat: want, n: 1 } : progress.chapter().goal;
        const nearestOf = <T extends { u: number; v: number }>(list: T[], ok: (x: T) => boolean): T | null => {
            let b: T | null = null;
            let bd = Infinity;
            for (const x of list) {
                if (!ok(x)) continue;
                const d = Math.hypot(x.u - u, x.v - v);
                if (d < bd) { bd = d; b = x; }
            }
            return b;
        };
        const homeCamp = campMarks.find((c) => c.L.el === home)!;
        const atHome = Math.hypot(u - homeCamp.u, v - homeCamp.v) <= CAMP_RADIUS;
        if (goal.kind === 'talk') {
            const n = npcs.find((x) => x.id === goal.npc);
            return n ? { u: n.u, v: n.v, label: NPCS[goal.npc].name } : null;
        }
        if (goal.kind === 'towers') {
            const t = nearestOf(towers, (x) => open(x.L.el!) && !s.towers.includes(x.L.id));
            return t ? { u: t.u, v: t.v, label: 'Watchtower' } : null;
        }
        if (goal.kind === 'guards' || goal.kind === 'wardens') {
            const g = nearestOf(guards, (x) => open(x.L.el!) && !progress.guardDone(x.L.el!, x.L.n));
            if (g) return { u: g.u, v: g.v, label: KINGDOMS[g.L.el!].guard.name };
            const a = nearestOf(gates, (x) => x.L.kind === 'arena' && open(x.L.el!) && !s.wardens.includes(x.L.el!));
            return a ? { u: a.u, v: a.v, label: `Arena of ${KINGDOMS[a.L.el!].name}` } : null;
        }
        if (goal.kind === 'malakor') {
            const c = gates.find((x) => x.L.kind === 'citadel')!;
            return { u: c.u, v: c.v, label: 'Void Citadel' };
        }
        if (goal.kind === 'stat' && goal.stat === 'chests') {
            const c = nearestOf(chests, (x) => progress.chestReady(x.id) && open(regionAt(x.u, x.v)));
            return c ? { u: c.u, v: c.v, label: 'Chest' } : null;
        }
        // Fighting tasks: the waves never come into camp, so first, out of it (away from the Citadel).
        if (atHome && ((goal.kind === 'stat' && goal.stat === 'kills') || goal.kind === 'wave' || goal.kind === 'level')) {
            // Out through the gate (the palisade has no other way out).
            if (Math.abs(u - homeCamp.u) < WALL_R + 0.5 && Math.abs(v - homeCamp.v) < WALL_R + 0.5) return { u: homeCamp.gate.u, v: homeCamp.gate.v + 3, label: 'Leave camp' };
            const [dx, dy] = KINGDOMS[home].dir;
            const len = Math.hypot(dx, dy) || 1;
            return { u: homeCamp.u + (dx / len) * (CAMP_RADIUS + 5), v: homeCamp.v + (dy / len) * (CAMP_RADIUS + 5), label: 'Leave camp' };
        }
        const campWork = goal.kind === 'build' || goal.kind === 'gear' || (goal.kind === 'stat' && (goal.stat === 'cooked' || goal.stat === 'potions'));
        if (campWork && !atHome) return { u: homeCamp.u, v: homeCamp.v, label: 'Home camp' };
        if (campWork) {
            // In camp: the very tent (or the fire) the task needs.
            const tentAt = (id: BuildingId) => {
                const t = tents.find((x) => x.el === home && x.id === id);
                return t ? { u: t.i + 0.5, v: t.j + 0.5, label: BUILDINGS[id].name } : null;
            };
            if (goal.kind === 'build') return tentAt(goal.building === 'any' ? 'forge' : goal.building);
            if (goal.kind === 'gear') return tentAt('forge');
            if (goal.kind === 'stat' && goal.stat === 'potions') return tentAt('alchemy');
            return { u: homeCamp.u, v: homeCamp.v, label: 'Camp fire' };
        }
        // Gathering: the nearest tree, rock or bush that is ready.
        if (goal.kind === 'stat' && (goal.stat === 'wood' || goal.stat === 'stone' || goal.stat === 'herb' || goal.stat === 'berries')) {
            const ci = Math.floor(u), cj = Math.floor(v);
            let best: { u: number; v: number; label: string } | null = null;
            let bd = Infinity;
            for (let j = cj - 24; j <= cj + 24; j++) {
                for (let i = ci - 24; i <= ci + 24; i++) {
                    const n = propCell.get(j * MAP_TILES + i);
                    if (n === undefined || regrow.has(n)) continue;
                    const y = yieldOf(map.props[n].name);
                    if (!y || y.item !== goal.stat || !open(regionAt(i, j))) continue;
                    const d = Math.hypot(i + 0.5 - u, j + 0.5 - v);
                    if (d < bd) {
                        bd = d;
                        best = { u: i + 0.5, v: j + 0.5, label: goal.stat === 'wood' ? 'Tree' : goal.stat === 'stone' ? 'Rock' : 'Bush' };
                    }
                }
            }
            return best;
        }
        return null;
    };

    // ---- The objective's marker: a beam of light, a ring on the ground and a gold diamond over the place the story points at.
    const marker = new Graphics();
    marker.zIndex = 1e6;
    o.layer.addChild(marker);
    all.push(marker);
    let markAt: { u: number; v: number } | null = null;
    let markT = 0;
    const drawMarker = (dtMs: number, u: number, v: number) => {
        markT += dtMs;
        marker.clear();
        if (!markAt) return;
        const near = Math.hypot(markAt.u - u, markAt.v - v);
        if (near < 1.4) return; // you are there
        const at = ground(markAt.u, markAt.v);
        const bob = Math.sin(markT / 320) * 6;
        const pulse = (markT % 1400) / 1400;
        marker.rect(at.x - 9, at.y - 170, 18, 170).fill({ color: 0xffd98a, alpha: 0.07 });
        marker.rect(at.x - 2.5, at.y - 170, 5, 170).fill({ color: 0xffe9b0, alpha: 0.28 });
        marker.ellipse(at.x, at.y, 16 + pulse * 26, 8 + pulse * 13).stroke({ color: 0xffd98a, width: 2.5, alpha: 1 - pulse });
        const y = at.y - 140 + bob;
        marker.circle(at.x, y, 22).fill({ color: 0xffd98a, alpha: 0.18 });
        marker.poly([at.x, y - 17, at.x + 12, y, at.x, y + 17, at.x - 12, y]).fill(0xfff1c4).stroke({ color: 0x7a4a14, width: 3 });
        marker.poly([at.x, y - 9, at.x + 6, y, at.x, y + 9, at.x - 6, y]).fill(0xe0a948);
    };

    const progressRefill = (id: string) => (progress.houseReady(id) ? 'The crate is empty' : 'Already searched. It fills again later');
    let sanctuary = 0;
    let hudClock = 0;
    let clock = 0;
    let lastTents = '';
    let lastRegion: Region | null = null;
    let revealClock = 0;

    const layer: SurvivalLayer = {
        trackProp(index, sprite) {
            if (!propCell.has(map.props[index].j * MAP_TILES + map.props[index].i)) return;
            propSprites.set(index, sprite);
            looks(index, sprite);
        },
        untrackProp(index) {
            propSprites.delete(index);
            shake.delete(index);
        },

        canEnter(i, j) {
            if (i < 0 || j < 0 || i >= MAP_TILES || j >= MAP_TILES) return false;
            return open(REGION_OF(map.region[j * MAP_TILES + i]));
        },

        use(u, v, facing, tool) {
            const t = find(u, v, facing, tool) as Target | null;
            if (!t) return false;
            switch (t.kind) {
                case 'npc': store.patch({ npc: t.id }); break;
                case 'gate': useGate(t.g); break;
                case 'tower': climb(t.t); break;
                case 'crate': {
                    const found = progress.searchHouse(t.h.L.id, t.h.L.el);
                    o.banner(found.length ? `Found: ${found.join(', ')}` : progressRefill(t.h.L.id));
                    break;
                }
                case 'bench': store.patch({ house: { id: t.h.L.id, el: t.h.L.el } }); break;
                case 'chest': openChest(t.c); break;
                case 'fire':
                    if (open(t.el)) store.patch({ travel: true });
                    else o.say('This camp is cold. Free its kingdom first', 0xcccccc);
                    break;
                case 'tent':
                    if (open(t.el)) store.patch({ buildPanel: t.id });
                    else o.say('Ruined. Free this kingdom to use its camp', 0xcccccc);
                    break;
                case 'water': water(u, v, tool); break;
                case 'prop': gather(t, tool); break;
            }
            return true;
        },

        place(id, u, v, facing) {
            if (id !== 'trap_spike' && id !== 'barricade') return false;
            const f = aim(facing);
            const pu = u + f.du * 1.1, pv = v + f.dv * 1.1;
            if (!layer.canEnter(Math.floor(pu), Math.floor(pv)) || map.blocked[Math.floor(pv) * MAP_TILES + Math.floor(pu)] === 1) return false;
            if (!progress.useItem(id)) return false;
            if (defences.length >= MAX_DEFENCES) defences.shift()!.g.destroy();
            const g = new Graphics();
            if (id === 'trap_spike') {
                g.ellipse(0, 0, 26, 13).fill({ color: 0x3a2a24, alpha: 0.85 }).stroke({ width: 3, color: 0x2b0f1c });
                for (let n = 0; n < 7; n++) {
                    const a = (n / 7) * Math.PI * 2;
                    const x = Math.cos(a) * 14, y = Math.sin(a) * 6;
                    g.poly([x - 4, y, x + 4, y, x, y - 16]).fill({ color: 0xcfd4dc }).stroke({ width: 2, color: 0x2b0f1c });
                }
            } else {
                g.roundRect(-34, -18, 68, 12, 4).fill({ color: 0x8a5a33 }).stroke({ width: 3, color: 0x2b0f1c });
                g.roundRect(-30, -34, 60, 12, 4).fill({ color: 0x9a6a3c }).stroke({ width: 3, color: 0x2b0f1c });
                for (let n = -2; n <= 2; n++) g.poly([n * 13 - 4, -30, n * 13 + 4, -30, n * 13 + 10, -48]).fill({ color: 0xd8c8a8 }).stroke({ width: 2, color: 0x2b0f1c });
            }
            const at = ground(pu, pv);
            g.position.set(at.x, at.y);
            g.zIndex = o.zFor(pu, pv) + 0.15;
            o.layer.addChild(g);
            defences.push({ kind: id, u: pu, v: pv, g, hits: id === 'trap_spike' ? 6 : 24, cd: 0 });
            o.say(id === 'trap_spike' ? 'Trap set' : 'Barricade up', 0xd8c8a8);
            synth('chop');
            return true;
        },

        update(dtMs, u, v, facing, tool, monsters) {
            clock += dtMs;
            drawMarker(dtMs, u, v);
            // Regrowth and shakes.
            for (const [n, left] of regrow) {
                const l = left - dtMs;
                if (l <= 0) {
                    regrow.delete(n);
                    const sp = propSprites.get(n);
                    if (sp) looks(n, sp);
                } else regrow.set(n, l);
            }
            for (const [n, left] of shake) {
                const sp = propSprites.get(n);
                const l = left - dtMs;
                if (sp) sp.skew.x = l > 0 ? Math.sin(l / 22) * 0.06 : 0;
                if (l <= 0) shake.delete(n);
                else shake.set(n, l);
            }
            const s = store.get();
            const raining = s.weather === 'rain' || s.weather === 'storm';
            campView.update(dtMs, clock, u, v, o.dark(), (el) => open(el));
            for (const c of campMarks) {
                const lit = open(c.L.el!) && !raining;
                c.fire.visible = lit;
                // The camp's name: read from the road, gone once you are through the gate.
                const dg = Math.hypot(u - c.gate.u, v - c.gate.v - 2);
                const within = Math.abs(u - c.u) < WALL_R + 0.5 && Math.abs(v - c.v) < WALL_R + 0.5;
                c.name.alpha = within ? 0 : Math.max(0, Math.min(1, (dg - 3) / 2, (22 - dg) / 4));
                c.flame.visible = lit;
                c.fire.alpha = 0.45 + 0.15 * Math.sin(clock / 120) + 0.08 * Math.sin(clock / 47);
                c.fire.scale.set(1.5 + 0.1 * Math.sin(clock / 90));
                c.flame.texture = campFire[Math.floor(clock / 80) % campFire.length];
                c.flame.scale.set(1.5 + 0.06 * Math.sin(clock / 70), 1.5 + 0.1 * Math.sin(clock / 53));
            }
            for (const g of gates) {
                const lit = g.L.kind === 'citadel' ? s.wardens.length >= 4 : !!g.L.el && !s.wardens.includes(g.L.el) && progress.guardsLeft(g.L.el) === 0;
                g.s.texture = portalFrames[lit ? Math.floor(clock / 120) % 6 : 0];
                g.s.tint = lit ? 0xffffff : g.L.kind === 'citadel' ? 0x6a5a88 : 0x8a93a3;
                g.g.alpha = lit ? 0.7 + 0.2 * Math.sin(clock / 300) : 0.25;
            }
            for (const g of guards) {
                const done = progress.guardDone(g.L.el!, g.L.n);
                // In the story, Pyraxis's champions come from the story itself (no old guardian spot).
                const storyOwned = g.L.el === 'fire' && !!o.story?.active();
                g.ring.visible = !done && !storyOwned;
                g.t.visible = !storyOwned;
                g.ring.alpha = 0.35 + 0.2 * Math.sin(clock / 400 + g.L.n);
                // Wake the guardian when the player comes close (and its kingdom is open).
                if (!done && open(g.L.el!) && !(g.L.el === 'fire' && o.story?.active()) && Math.hypot(u - g.u, v - g.v) < GUARD_WAKE && clock - g.called > 20000) {
                    g.called = clock;
                    o.summon(guardCode(g.L.el!, g.L.n), progress.tierOf(g.L.el), g.u, g.v);
                    o.banner(`${KINGDOMS[g.L.el!].guard.name} rises to guard ${KINGDOMS[g.L.el!].name}!`);
                    sfx('wave');
                }
            }
            for (const t of towers) {
                t.beacon.visible = s.towers.includes(t.L.id);
                t.beacon.alpha = 0.6 + 0.3 * Math.sin(clock / 260);
            }
            for (const n of npcs) {
                // Everyone breathes in their idle (Lyra too: she is herself, only her memories are gone).
                const frames = framesOf(NPC_ART[n.id], 'idle');
                if (frames) {
                    const row = frames[0];
                    n.s.texture = row[Math.floor((clock + n.u * 97) / 160) % row.length];
                    n.s.tint = 0xffffff;
                }
                n.s.y = ground(n.u, n.v).y;
            }
            // Walking into a house fades its walls and roof away.
            let inside: (typeof houses)[number] | null = null;
            for (const h of houses) {
                const within = u > h.L.i - 1.15 && u < h.L.i + 0.25 && v > h.L.j - 1.15 && v < h.L.j + 0.25;
                if (within) inside = h;
                const want = within ? 0.12 : 1;
                h.shell.alpha += (want - h.shell.alpha) * Math.min(1, dtMs / 120);
            }
            // Sanctuaries: lit camp fires and houses drive monsters back (about once a second).
            sanctuary -= dtMs;
            if (sanctuary <= 0) {
                sanctuary = 900;
                const rain = s.weather === 'rain' || s.weather === 'storm';
                for (const c of campMarks) {
                    if (rain || !open(c.L.el!) || Math.hypot(u - c.u, v - c.v) > 30) continue;
                    if (monsters.some((m) => m.state !== 'dying' && !m.boss && Math.hypot(m.u - c.u, m.v - c.v) < 4.5)) o.blast(c.u, c.v, Math.max(2, Math.round(2 * o.damageMul())), 4.5);
                }
                for (const h of houses) {
                    const cu = h.L.i - 0.5, cv = h.L.j - 0.5;
                    if (Math.hypot(u - cu, v - cv) > 20) continue;
                    if (monsters.some((m) => m.state !== 'dying' && !m.boss && Math.hypot(m.u - cu, m.v - cv) < 1.6)) o.blast(cu, cv, Math.max(2, Math.round(2 * o.damageMul())), 1.8);
                }
            }
            if ((inside !== null) !== s.sheltered) store.patch({ sheltered: inside !== null });
            for (const c of chests) {
                const ready = progress.chestReady(c.id);
                c.s.alpha = ready ? 1 : 0.4;
                c.glow.visible = ready;
                c.glow.alpha = 0.45 + 0.25 * Math.sin(clock / 350 + c.id);
                c.s.y = c.baseY - (ready ? Math.abs(Math.sin(clock / 600 + c.id)) * 3 : 0);
                // A Mimic's tell: now and then its chain twitches.
                c.s.skew.x = ready && mimic(c.id) && Math.floor(clock / 140) % 23 === 0 ? 0.12 * Math.sin(clock / 20) : 0;
            }
            for (const vs of veils.values()) vs.alpha = 0.55 + 0.25 * Math.sin(clock / 500 + vs.x * 0.01);

            // Traps and barricades bite whatever is on them.
            for (let n = defences.length - 1; n >= 0; n--) {
                const d = defences[n];
                d.cd -= dtMs;
                d.g.scale.set(1 + (d.g.scale.x - 1) * 0.85);
                if (d.cd > 0) continue;
                const r = d.kind === 'trap_spike' ? 0.8 : 1.1;
                if (!monsters.some((m) => m.state !== 'dying' && Math.hypot(m.u - d.u, m.v - d.v) < r)) continue;
                o.blast(d.u, d.v, Math.max(1, Math.round((d.kind === 'trap_spike' ? 4 : 2) * o.damageMul())), r + 0.2);
                synth('chop', 0.5);
                d.cd = d.kind === 'trap_spike' ? 1000 : 700;
                d.g.scale.set(1.15);
                d.hits -= 1;
                if (d.hits <= 0) {
                    d.g.destroy();
                    defences.splice(n, 1);
                }
            }

            hudClock -= dtMs;
            if (hudClock > 0) return;
            hudClock = 150;
            if (JSON.stringify(npcPlaces()) !== npcKey) placeNpcs();
            syncVeils(u, v);
            // Tent labels follow building levels and whether the camp is free.
            const tk = `${JSON.stringify(s.buildings)}|${s.wardens.join()}|${s.kingdom}`;
            if (tk !== lastTents) {
                lastTents = tk;
                for (const t of tents) {
                    const free = open(t.el);
                    const lv = s.buildings[t.id];
                    t.t.text = free ? (lv > 0 ? `${BUILDINGS[t.id].name} · Lv ${lv}` : `${BUILDINGS[t.id].name} · build here`) : '';
                    t.t.style.fill = lv > 0 ? 0xfff3c4 : 0xffd89a;
                    // Unbuilt: a building site; in a fallen camp, a burnt-out tent.
                    t.site.visible = free && lv <= 0;
                    t.s.visible = !t.site.visible;
                    t.s.alpha = free ? 1 : 0.85;
                    t.s.tint = free ? 0xffffff : 0x3a3036;
                }
                for (const g of guards) {
                    const done = progress.guardDone(g.L.el!, g.L.n);
                    g.t.text = done || !open(g.L.el!) ? '' : `${KINGDOMS[g.L.el!].guard.name}`;
                }
            }

            // Where am I?
            const region = regionAt(u, v);
            if (region !== lastRegion) {
                if (lastRegion !== null) o.banner(region === 'citadel' ? `Entering ${CITADEL.name}` : `Entering ${KINGDOMS[region].name} · ${KINGDOMS[region].land}`);
                lastRegion = region;
            }
            revealClock -= 150;
            if (revealClock <= 0) {
                revealClock = 600;
                progress.reveal(u, v, 13);
            }
            const inCamp = campMarks.some((c) => open(c.L.el!) && Math.hypot(u - c.u, v - c.v) <= CAMP_RADIUS);
            const fire = (inCamp && !raining) || s.house !== null || s.sheltered;

            // What Use would do right now.
            const t = find(u, v, facing, tool) as Target | null;
            let hint: string | null = null;
            let act: AppState['act'] = null;
            if (t) {
                if (t.kind === 'prop') hint = regrow.has(t.n) ? 'Growing back' : `${t.y.verb}${t.y.tool.includes(tool) ? '' : ` (${TOOL_NAME[t.y.tool[0]]})`}`;
                else if (t.kind === 'chest') hint = progress.chestReady(t.c.id) ? 'Open chest' : 'Chest (empty)';
                else if (t.kind === 'npc') hint = `Talk to ${NPCS[t.id].name}`;
                else if (t.kind === 'gate') hint = t.g.L.kind === 'citadel' ? 'Challenge Malakor' : `Arena of ${KINGDOMS[t.g.L.el!].name}`;
                else if (t.kind === 'tower') hint = 'Climb the watchtower';
                else if (t.kind === 'crate') hint = progress.houseReady(t.h.L.id) ? 'Search the crate' : 'Crate (searched)';
                else if (t.kind === 'bench') hint = 'Workbench: rest, cook';
                else if (t.kind === 'fire') hint = open(t.el) ? 'Travel between camps' : 'Cold campfire';
                else if (t.kind === 'tent') hint = open(t.el) ? `${BUILDINGS[t.id].name}: build` : 'Ruined tent';
                else hint = tool === 'fishingpole' ? 'Fish' : 'Drink';
                act = actionFor(t, hint, tool);
            }
            const sp = o.story?.prompt(u, v, facing);
            if (sp) {
                hint = sp.hint;
                act = sp.act;
            }
            const target = objectiveTarget(u, v);
            markAt = target ? { u: target.u, v: target.v } : null;
            const aimTo = target
                ? {
                    angle: Math.atan2((target.u - u + (target.v - v)) * 31, (target.u - u - (target.v - v)) * 62),
                    dist: Math.hypot(target.u - u, target.v - v),
                    label: target.label,
                }
                : null;
            const prev = s.target;
            const changed = !prev !== !aimTo || (prev && aimTo && (Math.abs(prev.angle - aimTo.angle) > 0.05 || Math.round(prev.dist) !== Math.round(aimTo.dist) || prev.label !== aimTo.label));
            // Tent names show only up close (a camp is not a wall of words).
            for (const tt of tents) tt.t.alpha = Math.max(0, Math.min(1, (3.6 - Math.hypot(u - tt.i - 0.5, v - tt.j - 0.5)) / 1.2));
            if (JSON.stringify(act) !== JSON.stringify(s.act)) store.patch({ act });
            if (hint !== s.hint || inCamp !== s.inCamp || fire !== s.fire || region !== s.region || changed) store.patch({ hint, inCamp, fire, region, target: aimTo });
        },

        destroy() {
            campView.destroy();
            for (const n of npcs) {
                n.s.destroy();
                n.t.destroy();
            }
            for (const v of veils.values()) v.destroy();
            veils.clear();
            veilRise.destroy(true);
            veilFall.destroy(true);
            for (const d of defences) d.g.destroy();
            for (const x of all) x.destroy();
            propSprites.clear();
            store.patch({ hint: null, target: null, inCamp: false, fire: false, region: null, npc: null, house: null, travel: false });
        },
    };
    return layer;
}

/** The boss nearest the player (alive, within 26 tiles), for the HUD's big bar. */
export function nearestBoss(monsters: ViewMonster[], u: number, v: number): { name: string; hp: number; max: number; css: string } | null {
    let best: ViewMonster | null = null;
    let bd = 26;
    for (const m of monsters) {
        if (!m.boss || m.state === 'dying') continue;
        const d = Math.hypot(m.u - u, m.v - v);
        if (d < bd) { bd = d; best = m; }
    }
    if (!best) return null;
    const info = bossInfo(best.boss!);
    if (!info) return null;
    return { name: info.name, hp: Math.max(0, best.hp), max: best.max, css: info.el ? KINGDOMS[info.el].css : '#b06bff' };
}
