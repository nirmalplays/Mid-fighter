/**
 * The story in the world, across its four lands (game/story/land1-4.ts). It draws what the quest
 * line puts on the map, turns swings and Use presses on those props into quest events, and runs
 * what the steps need: the foes that wait at a place, the bosses and the turns of their fights
 * (armour, floods, polarity, darkness, inverted senses, shields, cycling heads, the finishing beat),
 * their four breakable structural zones and the grapple-mount, the Sanctuary sieges (and the
 * Core-Bleed siege every 45 minutes of exploring), timed defences, clears, stations and lock
 * sequences, each land's curse (the Mist, the fog, sky-lightning and gale, frostbite, tipping
 * gravity and void rifts), the sealed zones, carrying Lyra, way-torches, chisel-wedges, the
 * Sanctuary's turrets and the ley-conduits that power them, Lyra fighting beside you in the last
 * land, the Flashback Surge, and the Resonant Hymn.
 *
 * The scene calls use() / swing() / place() first (the story wins over survival), update() every
 * frame, and asks canEnter(), speedMul(), push(), hurtMul() and target() as it goes.
 */
import { Container, Graphics, Text, type Texture } from 'pixi.js';
import { store, type AppState } from '../../state/store.ts';
import { sfx, synth } from '../audio.ts';
import { progress } from '../progress.ts';
import { heroName, quest } from '../story/quest.ts';
import { ALL_BOSSES, ALL_PROPS, LANDS, siteAt } from '../story/lands.ts';
import type { BossDef, Land, Mech, PropDef, Step } from '../story/types.ts';
import { axisDistance, guardCode, KINGDOMS, STORY_ZONES, type Element, type NpcId } from '../eidolon.ts';
import { essenceOf as essOf, ITEMS, type ItemId } from '../survival.ts';
import { MAP_TILES } from './constants.ts';
import type { WorldMap } from './mapGen.ts';
import type { ViewMonster } from './monsters.ts';
import type { FxName } from './fxAtlas.ts';
import { createActor } from './npcArt.ts';
import { FACINGS } from './character.ts';

type Point = { u: number; v: number; label: string };
/** Story props that stand in the way (and stop you) until they are broken. */
const BLOCKING = new Set(['boulder', 'fakewall', 'beam']);

export interface StoryLayer {
    /** Use pressed: true if the story took it (a prop, Pyra's pulse, the wedges going off). */
    use(u: number, v: number, facing: number): boolean;
    /** A swing landed: story props in reach take it. `tool` is what was swung. */
    swing(u: number, v: number, facing: number, tool: string): void;
    /** A Runic Fracture (the fourth blow in a row) burst here: a boss in reach loses a structural zone. */
    fracture(u: number, v: number, monsters: ViewMonster[]): void;
    /** F: climb onto a staggered boss for the three-beat strike. */
    mount(u: number, v: number, monsters: ViewMonster[]): boolean;
    /** Set down a way-torch, a wedge, a conduit or a turret (true if it was one of those). */
    place(id: ItemId, u: number, v: number, facing: number): boolean;
    /** The sealed zones of the land the story is in. */
    canEnter(i: number, j: number): boolean;
    /** Camp is not safe ground while a siege is on. */
    sieging(): boolean;
    /** Hide (or show again) story props while a cinematic stages its scene. */
    hideProps(ids: string[], hidden: boolean): void;
    /** The player went through a door: whoever walks with them comes too. */
    teleported(u: number, v: number): void;
    /** The waves wait until the story's first Sanctuary stands (the Spire lit in Pyraxis). */
    holdWaves(): boolean;
    /** Movement and stamina-regen multipliers (carrying Lyra, the Mist, frostbite). */
    speedMul(): number;
    regenMul(): number;
    /** A push this frame (gusts, tipping gravity, a boss's polarity, the Maelstrom's knockback), in tiles. */
    push(dtMs: number): { du: number; dv: number };
    /** The Maelstrom Wall threw you back from a sealed land. */
    knockback(du: number, dv: number): void;
    /** Share of a bite that lands (the Surge's hyper-armour, Lyra's Aegis, the Martyr's Ring). */
    hurtMul(): number;
    /** You were hurt: low health can wake a Flashback Surge. */
    onHurt(hp: number, max: number): void;
    /** Controls are inverted (the Siren's Lament). */
    inverted(): boolean;
    /** Where the story points (undefined: let the old chapters decide). */
    target(u: number, v: number): Point | null | undefined;
    /** What Use would do with a story thing in front of the player, if anything. */
    prompt(u: number, v: number, facing: number): { hint: string; act: AppState['act'] } | null;
    /** A gathering step: the first thing still missing (stone from rocks, wood/resin from trees). */
    gather(): 'stone' | 'wood' | null;
    /** Where a camp person stands (which land's camp, or null while they are not in the world), and a nudge. */
    npcCamp(id: string): Element | null;
    npcAt(id: string): [number, number] | null;
    /** R: the Resonant Hymn (once learnt). */
    hymn(u: number, v: number): void;
    /** A dodge roll: the Echo Dash, and the moment you went past a shield. */
    rolled(u: number, v: number): void;
    /** Q in the last land: Lyra's synergy (true if she took it). */
    synergy(u: number, v: number): boolean;
    /** A draught drunk that the story cares about. */
    drink(id: ItemId): boolean;
    /** Extra damage for a swing (the forged blades, Vein-Striker on bosses, a Surge, an imbued blade). */
    swingMul(u: number, v: number, monsters: ViewMonster[]): number;
    update(dtMs: number, u: number, v: number, facing: number, monsters: ViewMonster[]): void;
    destroy(): void;
}

const REACH = 1.9;
const SPIRE_HP = 30;
const OUTLINE = 0x1a0c10;
/** The Core-Bleed Siege comes after this much exploring (ms). */
const NIGHT_EVERY = 45 * 60 * 1000;
const PROP_NAME: Partial<Record<PropDef['type'], string>> = {
    boulder: 'Resonance boulder', slab: 'Lyra', spire: 'Memory Spire', altar: "Lyra's alcove", alembic: "Orin's alembic", basin: 'Dry basin', geyser: 'Geyser',
    beam: 'Roof beam', lockbox: 'Acoustic lock box', fakewall: 'False wall', sarcophagus: 'Sarcophagus', tether: 'Tether node', vent: 'Steam vent',
    chain: 'Obsidian chain', gearbox: 'Gearbox', harmonic: 'Harmonic pillar', winch: 'Winch', scale: "Architect's Scale", quartz: 'Blue quartz', satchel: "Lyra's satchel",
    valve: 'Cooling valve', smelter: 'Smelter', lectern: 'Word-Lock lectern', statue: 'Statue', chest: "Valen's chest", shelter: 'Shelter dome', solstice: 'Solstice Gate', grounding: 'Grounding spire',
    loom: "Archaeologist's Workbench", rift: 'Void Rift', node: 'Elemental lock', pad: 'Stepping-pad', fault: 'Load-bearing fault', stalactite: 'Giant icicle', brazier: 'Brazier',
};
/** Where people stand in the Coalition camp (Land 4), all together. */
const COALITION_AT: Partial<Record<NpcId, [number, number]>> = { theron: [1.6, 1.4], varis: [2.6, -1.6], kael: [-2.6, 1.8], lin: [3.2, 0.6], thorne: [-3.2, 0.4], nerissa: [0.2, 3] };

export function createStoryLayer(o: {
    map: WorldMap;
    layer: Container;
    glowTex: Texture;
    heightAt: (u: number, v: number) => number;
    toScreen: (u: number, v: number) => { x: number; y: number };
    zFor: (u: number, v: number) => number;
    levelH: number;
    say: (message: string, color?: number) => void;
    banner: (text: string) => void;
    fx: (name: FxName, u: number, v: number, opts: { scale: number; life: number; squash?: number; lift?: number }) => void;
    encounter: (kinds: string[], u: number, v: number, level: number) => void;
    summon: (code: number, tier: number, u: number, v: number) => void;
    ward: (code: number, share: number) => void;
    cripple: (code: number, what: 'slow' | 'weak' | 'calm' | 'stagger') => void;
    blast: (u: number, v: number, damage: number, r: number, stunMs?: number) => void;
    hurt: (n: number) => void;
    heal: (n: number) => void;
    damageMul: () => number;
}): StoryLayer {
    const all: (Graphics | Text | Container)[] = [];
    const ground = (u: number, v: number) => {
        const p = o.toScreen(u, v);
        return { x: p.x, y: p.y - o.heightAt(u, v) * o.levelH };
    };
    const add = <T extends Graphics | Text>(g: T, u: number, v: number, dz = 0.05): T => {
        const at = ground(u, v);
        g.position.set(at.x, at.y);
        g.zIndex = o.zFor(u, v) + dz;
        o.layer.addChild(g);
        all.push(g);
        return g;
    };
    const near = (a: { u: number; v: number }, u: number, v: number) => Math.hypot(a.u - u, a.v - v);
    const land = () => quest.land();
    const regionN = (e: Element) => ['fire', 'air', 'water', 'earth'].indexOf(e) + 1;

    // ------------------------------------------------------------ the props
    interface Prop { def: PropDef; land: Land; u: number; v: number; g: Graphics; hp: number; shake: number; lit: number }
    const draw = (g: Graphics, p: Prop) => {
        g.clear();
        const t = p.def.type;
        const broken = quest.has(`broke:${p.def.id}`);
        const ln = { width: 3, color: OUTLINE };
        const c = p.def.color ?? 0x8a8494;
        if (t === 'boulder') {
            if (broken) { g.poly([-22, 0, -8, -10, 10, -6, 22, 2, 4, 8]).fill(0x5b4a44).stroke(ln); return; }
            g.poly([-30, 2, -26, -30, -6, -46, 18, -40, 30, -14, 26, 6, -4, 10]).fill(0x6e5d55).stroke(ln);
            g.poly([-18, -28, -4, -40, 12, -34]).fill(0x8b7a70);
            for (let n = 0; n < 3; n++) g.rect(-14 + n * 10, -22 + (n % 2) * 6, 4, 4).fill(0x67e8f9);
        } else if (t === 'slab') {
            g.poly([-40, 0, 0, -20, 40, 0, 0, 20]).fill(p.land.n === 3 ? 0x8ab0c8 : p.land.n === 2 ? 0x9a7a50 : 0x8a8178).stroke(ln);
        } else if (t === 'spire') {
            const lit = p.land.n > 1 || quest.has('done:seal');
            const glow = [0x7dd3fc, 0x7dd3fc, 0xbae6fd, 0xc4a5ff][p.land.n - 1];
            g.poly([-16, 0, -10, -110, 0, -128, 10, -110, 16, 0]).fill(lit ? 0x9aa9c0 : 0x5a5560).stroke(ln);
            g.poly([-6, -40, 0, -48, 6, -40, 0, -32]).fill(lit ? glow : 0x3a3440);
            g.poly([-5, -88, 0, -96, 5, -88, 0, -80]).fill(lit ? 0xffffff : 0x3a3440);
            if (!lit) g.moveTo(-6, -70).lineTo(4, -60).lineTo(-2, -50).stroke({ width: 2, color: 0x1a1018 });
        } else if (t === 'altar') {
            g.poly([-30, 0, 0, -14, 30, 0, 0, 14]).fill(0x6b6470).stroke(ln);
            g.rect(-28, -10, 56, 10).fill(0x564e5c).stroke({ width: 2, color: OUTLINE });
        } else if (t === 'alembic') {
            g.rect(-14, -6, 28, 6).fill(0x5a3a22).stroke(ln);
            g.circle(0, -22, 14).fill(0xc2a46a).stroke(ln);
            g.moveTo(10, -30).lineTo(26, -44).stroke({ width: 4, color: 0xc2a46a });
        } else if (t === 'basin') {
            const bloom = quest.has('done:lotus');
            g.ellipse(0, 0, 38, 18).fill(bloom ? 0x5b8db0 : 0x6e5d55).stroke(ln);
            g.ellipse(0, -2, 28, 12).fill(bloom ? 0x7dd3fc : 0x3a2a24);
            if (bloom) for (let n = 0; n < 4; n++) g.circle(-14 + n * 9, -4 + (n % 2) * 4, 4).fill(0xff7a5a);
        } else if (t === 'geyser') {
            g.ellipse(0, 0, 14, 7).fill(0x3a2a24).stroke(ln);
            g.ellipse(0, -2, 8, 4).fill(p.lit > 0 ? 0xe0f2fe : 0x8b6f5a);
            if (p.lit > 0) g.rect(-4, -40, 8, 36).fill({ color: 0xe0f2fe, alpha: 0.5 });
        } else if (t === 'beam') {
            g.poly([-34, -8, 30, -30, 36, -20, -28, 2]).fill(0x7a5230).stroke(ln);
        } else if (t === 'lockbox' || t === 'chest') {
            const open = t === 'chest' ? quest.has('done:i_chest') : quest.has('done:h_box');
            g.rect(-18, -22, 36, 22).fill(t === 'chest' ? 0x5a6470 : 0x7a5a30).stroke(ln);
            g.rect(-18, open ? -34 : -28, 36, 8).fill(t === 'chest' ? 0x7a8490 : 0x9a7a40).stroke({ width: 2, color: OUTLINE });
            g.rect(-3, -18, 6, 6).fill(0xfbbf24);
        } else if (t === 'fakewall') {
            if (broken) { g.rect(-34, -8, 68, 8).fill(0x4a4048).stroke(ln); return; }
            // Newer, paler brick than the old walls, cracked, with a draught of light seeping through: it wants hitting.
            g.rect(-36, -66, 72, 66).fill(0x9a8e86).stroke(ln);
            for (let y = -54; y < 0; y += 12) g.moveTo(-36, y).lineTo(36, y).stroke({ width: 2, color: 0x6a5e5a });
            for (let y = -66, row = 0; y < 0; y += 12, row++) for (let x = -36 + (row % 2) * 12; x < 36; x += 24) g.moveTo(x, y).lineTo(x, y + 12).stroke({ width: 2, color: 0x6a5e5a });
            g.moveTo(-6, -64).lineTo(4, -44).lineTo(-8, -28).lineTo(6, -10).lineTo(0, 0).stroke({ width: 3, color: 0x2a2028 });
            g.moveTo(-6, -64).lineTo(4, -44).lineTo(-8, -28).lineTo(6, -10).lineTo(0, 0).stroke({ width: 1.5, color: 0xd8b4fe, alpha: 0.85 });
        } else if (t === 'sarcophagus') {
            g.poly([-34, 0, 0, -16, 34, 0, 0, 16]).fill(0x4a4450).stroke(ln);
            g.rect(-30, -18, 60, 14).fill(quest.has('done:t_mirror') ? 0xfde68a : 0x5a5462).stroke({ width: 2, color: OUTLINE });
        } else if (t === 'tether') {
            if (broken) { g.poly([-10, 0, 0, -8, 10, 0]).fill(0x3a2a24).stroke(ln); return; }
            g.poly([-10, 0, -6, -46, 6, -46, 10, 0]).fill(0x2a1f26).stroke(ln);
            g.circle(0, -52, 9).fill(0xff6a3d).stroke(ln);
        } else if (t === 'vent' || t === 'valve') {
            g.ellipse(0, 0, 16, 8).fill(0x3a2a24).stroke(ln);
            if (t === 'valve') {
                g.rect(-6, -26, 12, 24).fill(broken ? 0x4a4048 : 0x9a8a70).stroke(ln);
                g.circle(0, -30, 10).stroke({ width: 4, color: broken ? 0x4a4048 : 0xc0392b });
            } else g.ellipse(0, -2, 8, 4).fill(p.lit > 0 ? 0xe0f2fe : 0xff8a3d);
        } else if (t === 'chain') {
            if (broken) { g.rect(-4, -10, 8, 10).fill(0x2a1f26).stroke(ln); return; }
            for (let n = 0; n < 6; n++) g.ellipse(0, -10 - n * 14, 6, 8).stroke({ width: 4, color: 0x2a1f26 });
            g.rect(-12, -6, 24, 6).fill(0x3a2a24).stroke(ln);
        } else if (t === 'gearbox' || t === 'winch' || t === 'scale') {
            g.rect(-24, -20, 48, 20).fill(0x5a4a3a).stroke(ln);
            g.circle(t === 'scale' ? -14 : 0, -30, t === 'gearbox' ? 14 : 10).stroke({ width: 5, color: 0xb08a4a });
            if (t === 'scale') g.moveTo(-26, -40).lineTo(26, -40).stroke({ width: 4, color: 0xd4b06a });
        } else if (t === 'harmonic') {
            g.poly([-10, 0, -8, -70, 8, -70, 10, 0]).fill(p.lit > 0 ? 0xbae6fd : 0x2a2433).stroke(ln);
            g.rect(-12, -76, 24, 8).fill(0x7c6a90).stroke({ width: 2, color: OUTLINE });
        } else if (t === 'quartz') {
            g.poly([-8, 0, -12, -26, 0, -40, 12, -24, 8, 0]).fill(quest.has('quartz') ? 0x7dd3fc : 0x3b82f6).stroke(ln);
        } else if (t === 'satchel') {
            if (quest.has('done:n_grotto')) return;
            g.roundRect(-12, -14, 24, 14, 4).fill(0x8a5a33).stroke(ln);
        } else if (t === 'smelter') {
            g.rect(-22, -40, 44, 40).fill(0x3a2a24).stroke(ln);
            g.rect(-12, -22, 24, 14).fill(0xff6a3d);
        } else if (t === 'lectern') {
            g.poly([-14, 0, -6, -32, 22, -38, 14, -6]).fill(0x5a3a22).stroke(ln);
            if (quest.has('done:wordlock')) g.circle(4, -44, 8).fill(0xfde68a);
        } else if (t === 'statue') {
            if (broken) { g.poly([-14, 0, -6, -10, 8, -8, 14, 0]).fill(0x6a6070).stroke(ln); return; }
            g.rect(-12, -10, 24, 10).fill(0x5a5462).stroke(ln);
            g.poly([-8, -10, -10, -56, 0, -66, 10, -56, 8, -10]).fill(0x8a8494).stroke(ln);
        } else if (t === 'shelter') {
            const lit = quest.has(`lit:${p.def.id}`);
            g.ellipse(0, 0, 44, 22).fill({ color: lit ? 0x7dd3fc : 0x6a6070, alpha: 0.35 }).stroke({ width: 3, color: lit ? 0x7dd3fc : 0x4a4048 });
            g.arc(0, 0, 44, Math.PI, 0).stroke({ width: 3, color: lit ? 0xbae6fd : 0x8a8494, alpha: 0.8 });
        } else if (t === 'solstice') {
            const open = quest.has('done:solstice');
            g.rect(-44, -96, 14, 96).fill(0x4a3a30).stroke(ln);
            g.rect(30, -96, 14, 96).fill(0x4a3a30).stroke(ln);
            g.rect(-44, -110, 88, 16).fill(0x6a4a30).stroke(ln);
            if (!open) g.rect(-30, -94, 60, 94).fill({ color: 0xff6a3d, alpha: 0.35 });
            for (let n = 0; n < 4; n++) g.circle(-24 + n * 16, -102, 4).fill([0xff6a3d, 0x7dd3fc, 0x60a5fa, 0xa3e635][n]);
        } else if (t === 'grounding') {
            const up = p.lit > 0;
            g.poly([-10, 0, -6, up ? -64 : -18, 6, up ? -64 : -18, 10, 0]).fill(up ? 0x9aa9c0 : 0x4a4048).stroke(ln);
            if (up) g.circle(0, -70, 7).fill(0x7dd3fc);
        } else if (t === 'pillar' || t === 'fault' || t === 'stalactite') {
            if (broken) { g.poly([-16, 0, -8, -12, 6, -8, 16, 0]).fill(0x4a4048).stroke(ln); return; }
            const h = t === 'stalactite' ? 70 : 84;
            g.poly([-14, 0, -11, -h, 11, -h, 14, 0]).fill(t === 'stalactite' ? 0xbae6fd : c).stroke(ln);
            // The load-bearing seam, amber (a wedge breaks it).
            g.moveTo(-6, -h + 10).lineTo(4, -h * 0.6).lineTo(-3, -h * 0.35).lineTo(5, -10).stroke({ width: 3, color: 0xf59e0b });
            for (let n = 0; n < quest.count(`wedge:${p.def.id}`); n++) g.rect(-12 + n * 9, -h * 0.5, 5, 10).fill(0xfde68a).stroke({ width: 2, color: OUTLINE });
        } else if (t === 'rock') {
            g.poly([-26, 0, -20, -34, -4, -26, 4, -44, 20, -30, 26, 0]).fill(c).stroke(ln);
        } else if (t === 'box') {
            g.rect(-26, -30, 52, 30).fill(c).stroke(ln);
            g.rect(-20, -24, 16, 12).fill(0xfde68a);
        } else if (t === 'machine') {
            g.rect(-26, -24, 52, 24).fill(0x4a4048).stroke(ln);
            g.circle(-8, -34, 13).stroke({ width: 5, color: c });
            g.circle(12, -30, 8).stroke({ width: 4, color: c });
        } else if (t === 'ring') {
            g.ellipse(0, 0, 34, 17).stroke({ width: 6, color: c, alpha: p.lit > 0 ? 1 : 0.7 });
            g.ellipse(0, 0, 20, 10).fill({ color: c, alpha: 0.25 });
        } else if (t === 'crystal') {
            g.poly([-14, 0, -18, -40, 0, -64, 18, -40, 14, 0]).fill(c).stroke(ln);
            g.poly([-4, -16, 0, -52, 6, -20]).fill({ color: 0xffffff, alpha: 0.5 });
        } else if (t === 'vane') {
            g.rect(-3, -60, 6, 60).fill(0x7a5a30).stroke(ln);
            g.poly([0, -62, 26, -54, 0, -46]).fill(0xb08a4a).stroke(ln);
        } else if (t === 'harp') {
            g.moveTo(-24, 0).lineTo(-24, -70).quadraticCurveTo(0, -90, 24, -70).lineTo(24, 0).stroke({ width: 6, color: c });
            for (let n = -16; n <= 16; n += 8) g.moveTo(n, -4).lineTo(n, -72).stroke({ width: 1.5, color: 0xf5f5f4 });
        } else if (t === 'bell') {
            g.rect(-3, -76, 6, 18).fill(0x5a3a22);
            g.poly([-20, -10, -14, -58, 14, -58, 20, -10]).fill(c).stroke(ln);
            g.ellipse(0, -10, 22, 6).fill(c).stroke(ln);
        } else if (t === 'rod') {
            g.rect(-3, -70, 6, 70).fill(0xe08a4a).stroke(ln);
            g.circle(0, -74, 6).fill(p.lit > 0 ? 0xfde68a : 0xe08a4a).stroke({ width: 2, color: OUTLINE });
        } else if (t === 'pylon') {
            g.poly([-12, 0, -6, -60, 6, -60, 12, 0]).fill(0x5a6470).stroke(ln);
            g.circle(0, -66, 9).fill(p.lit > 0 || quest.has(`struck:${p.def.id}`) ? 0xfde68a : 0x60a5fa).stroke(ln);
        } else if (t === 'lure') {
            g.moveTo(0, 0).quadraticCurveTo(14, -30, 0, -50).stroke({ width: 4, color: 0x0f766e });
            g.circle(0, -54, 9).fill(p.lit > 0 ? 0xffffff : 0x5eead4).stroke({ width: 2, color: OUTLINE });
        } else if (t === 'node') {
            const lit = p.lit > 0 || quest.has(`lock:${p.def.id}`);
            g.ellipse(0, 0, 12, 6).fill(0x2a1f3a);
            g.poly([0, -50, 12, -30, 0, -10, -12, -30]).fill(lit ? 0xffffff : c).stroke(ln);
        } else if (t === 'rift') {
            const sealed = quest.has(`sealed:${p.def.id}`);
            if (sealed) { g.ellipse(0, 0, 22, 10).stroke({ width: 2, color: 0x9d6bff, alpha: 0.4 }); return; }
            g.ellipse(0, -30, 26, 44).fill({ color: 0x1a0830, alpha: 0.9 }).stroke({ width: 4, color: 0xa855f7 });
            g.ellipse(0, -30, 14, 30).fill({ color: 0x9d6bff, alpha: 0.5 });
        } else if (t === 'brazier') {
            g.rect(-12, -24, 24, 24).fill(0x4a4048).stroke(ln);
            g.poly([-10, -24, 0, -50, 10, -24]).fill(p.lit > 0 ? 0xffffff : c);
        } else if (t === 'loom') {
            g.rect(-28, -24, 56, 24).fill(0x6a4a30).stroke(ln);
            g.rect(-22, -40, 44, 16).fill(0xd4b06a).stroke({ width: 2, color: OUTLINE });
            g.rect(-8, -36, 16, 8).fill(0x7dd3fc);
        } else if (t === 'web') {
            if (broken) { g.rect(-10, -8, 20, 8).fill(0x6a6070).stroke(ln); return; }
            g.rect(-10, -26, 20, 26).fill(0x6a6070).stroke(ln);
            for (let n = 0; n < 6; n++) g.moveTo(0, -20).lineTo(Math.cos(n) * 40, -20 + Math.sin(n) * 24).stroke({ width: 1.5, color: 0xe0f2fe, alpha: 0.7 });
        } else if (t === 'pad') {
            const lit = quest.has(`lit:${p.def.id}`);
            g.ellipse(0, 0, 30, 15).fill({ color: lit ? 0xfde68a : 0x5a6470, alpha: 0.6 }).stroke({ width: 3, color: lit ? 0xfde68a : 0x8a94a4 });
        } else if (t === 'pipe') {
            g.rect(-28, -18, 56, 10).fill(0x9a7a40).stroke(ln);
            g.rect(-28, -40, 10, 32).fill(0x9a7a40).stroke(ln);
            g.rect(18, -40, 10, 32).fill(0x9a7a40).stroke(ln);
        } else if (t === 'ship') {
            g.poly([-40, -10, 40, -10, 30, 6, -30, 6]).fill(c).stroke(ln);
            g.rect(-2, -64, 4, 54).fill(0x5a3a22);
            g.poly([2, -60, 30, -30, 2, -24]).fill(0xe7e5e4).stroke({ width: 2, color: OUTLINE });
        } else {
            g.poly([-26, 0, -20, -34, -4, -26, 4, -44, 20, -30, 26, 0]).fill(0x5a4a44).stroke(ln);
        }
    };
    const props: Prop[] = ALL_PROPS.map(({ def, land: l }) => {
        const s = siteAt(l, def.site);
        const u = s.u + def.at[0], v = s.v + def.at[1];
        const g = add(new Graphics(), u, v);
        const p: Prop = { def, land: l, u, v, g, hp: def.hp ?? 3, shake: 0, lit: 0 };
        draw(g, p);
        return p;
    });
    const byId = new Map(props.map((p) => [p.def.id, p]));
    const prop = (id: string) => byId.get(id)!;
    const redraw = (id: string) => {
        const p = byId.get(id);
        if (p) draw(p.g, p);
    };
    const hiddenIds = new Set<string>();
    const shown = (p: Prop) => !hiddenIds.has(p.def.id) && (!quest.active() ? p.def.site === 'camp' : p.land.n <= (quest.data()?.land ?? 1));
    const ofType = (type: string, l: Land = land()) => props.filter((p) => p.land === l && p.def.type === type);
    // Site names over the land's places.
    const labels: { t: Text; land: Land }[] = [];
    for (const l of LANDS) {
        for (const [id, name] of Object.entries(l.siteNames)) {
            if (id === 'camp' || l.alias[id]) continue;
            const s = siteAt(l, id);
            const t = new Text({ text: name, style: { fontFamily: 'Jacquard 12, serif', fontSize: 22, fill: 0xffe2b0, stroke: { color: OUTLINE, width: 5 } } });
            t.anchor.set(0.5, 1);
            add(t, s.u, s.v - 3.5, 0).zIndex = 1e5;
            labels.push({ t, land: l });
        }
    }

    // ------------------------------------------------------------ light, warmth, the Sanctuary's engines
    const campOf = (l: Land = land()) => siteAt(l, 'camp');
    const spireOf = (l: Land = land()) => ofType('spire', l)[0];
    interface Placed { id: ItemId; u: number; v: number; g: Graphics; cd: number; powered: boolean }
    const placed: Placed[] = [];
    const conduitG = new Graphics();
    conduitG.zIndex = -1;
    o.layer.addChild(conduitG);
    all.push(conduitG);
    const TURRETS: ItemId[] = ['ballista', 'flame_turret', 'catapult', 'harpoon_launcher', 'tesla_coil', 'steam_mortar'];
    const drawPlaced = (id: ItemId, u: number, v: number): Graphics => {
        const g = add(new Graphics(), u, v);
        const ln = { width: 3, color: OUTLINE };
        if (id === 'rune_torch' || id === 'brazier_beacon') {
            const glow = new Graphics().ellipse(0, 0, 90, 45).fill({ color: id === 'rune_torch' ? 0xffd98a : 0xfb923c, alpha: 0.1 }).ellipse(0, 0, 50, 25).fill({ color: 0xffd98a, alpha: 0.12 });
            g.addChild(glow);
            if (id === 'rune_torch') {
                g.rect(-3, -40, 6, 40).fill(0x5a3a22).stroke({ width: 2, color: OUTLINE });
                g.rect(-6, -48, 12, 10).fill(0x7dd3fc).stroke({ width: 2, color: OUTLINE });
            } else {
                g.rect(-12, -22, 24, 22).fill(0x5a5462).stroke(ln);
                g.poly([-10, -22, 0, -46, 10, -22]).fill(0xfb923c);
            }
            return g;
        }
        if (id === 'resonant_wedge') {
            g.poly([-5, 0, 0, -26, 5, 0]).fill(0xfde68a).stroke({ width: 2, color: OUTLINE });
            g.circle(0, -28, 4).fill(0x7dd3fc);
            return g;
        }
        if (id === 'ley_conduit') {
            g.ellipse(0, 0, 12, 6).fill(0x2a1f3a).stroke({ width: 2, color: OUTLINE });
            g.rect(-4, -24, 8, 24).fill(land().conduit).stroke({ width: 2, color: OUTLINE });
            return g;
        }
        if (id === 'copper_rod') {
            g.rect(-3, -70, 6, 70).fill(0xe08a4a).stroke(ln);
            g.circle(0, -74, 6).fill(0xfde68a).stroke({ width: 2, color: OUTLINE });
            return g;
        }
        g.poly([-22, 0, 0, -11, 22, 0, 0, 11]).fill(0x5a4a3a).stroke(ln);
        if (id === 'ballista' || id === 'harpoon_launcher') {
            g.rect(-4, -30, 8, 26).fill(0x7a5230).stroke(ln);
            g.moveTo(-26, -34).quadraticCurveTo(0, -48, 26, -34).stroke({ width: 5, color: id === 'ballista' ? 0x9a6a3c : 0x93c5fd });
            g.rect(-2, -52, 4, 26).fill(0xd8c8a8);
        } else if (id === 'flame_turret') {
            g.rect(-12, -36, 24, 32).fill(0x6a6070).stroke(ln);
            g.rect(-6, -46, 12, 12).fill(0xff6a3d).stroke(ln);
        } else if (id === 'tesla_coil') {
            g.rect(-8, -40, 16, 36).fill(0x6a6070).stroke(ln);
            g.circle(0, -48, 12).fill(0xa78bfa).stroke(ln);
        } else {
            g.rect(-18, -16, 36, 12).fill(0x7a5230).stroke(ln);
            g.moveTo(-10, -16).lineTo(20, -50).stroke({ width: 6, color: 0x9a6a3c });
            g.circle(22, -54, 8).fill(id === 'steam_mortar' ? 0xbae6fd : 0x6e5d55).stroke(ln);
        }
        return g;
    };
    const wedges: Placed[] = [];
    for (const p of quest.data()?.placed ?? []) placed.push({ id: p.id, u: p.u, v: p.v, g: drawPlaced(p.id, p.u, p.v), cd: 800, powered: false });
    /** Which turrets have power: within 7 of the Spire, or of a conduit chained (5 tiles a link) to it. */
    let gridKey = '';
    const powerGrid = () => {
        const key = `${placed.length}|${land().n}`;
        if (key === gridKey) return;
        gridKey = key;
        conduitG.clear();
        const nodes: { u: number; v: number }[] = [];
        for (const l of LANDS) {
            const sp = spireOf(l);
            if (!sp) continue;
            const reach = [{ u: sp.u, v: sp.v }];
            const conduits = placed.filter((x) => x.id === 'ley_conduit');
            const used = new Set<Placed>();
            for (let grow = true; grow;) {
                grow = false;
                for (const c of conduits) {
                    if (used.has(c)) continue;
                    const from = reach.find((r) => near(r, c.u, c.v) <= 5.5);
                    if (!from) continue;
                    used.add(c);
                    reach.push({ u: c.u, v: c.v });
                    const a = ground(from.u, from.v), b = ground(c.u, c.v);
                    conduitG.moveTo(a.x, a.y - 4).lineTo(b.x, b.y - 4).stroke({ width: 4, color: l.conduit, alpha: 0.75 });
                    grow = true;
                }
            }
            nodes.push(...reach);
        }
        for (const t of placed) {
            if (!TURRETS.includes(t.id)) continue;
            t.powered = nodes.some((n) => near(n, t.u, t.v) <= 7);
            t.g.alpha = t.powered ? 1 : 0.55;
        }
    };
    const lightNear = (u: number, v: number) => (quest.has('done:seal') && near(campOf(LANDS[0]), u, v) < 9) || placed.some((t) => (t.id === 'rune_torch' || t.id === 'brazier_beacon') && near(t, u, v) < 5);
    const warmNear = (u: number, v: number) => near(campOf(), u, v) < 9 || placed.some((t) => t.id === 'brazier_beacon' && near(t, u, v) < 5);
    const rodNear = (u: number, v: number) => near(campOf(), u, v) < 9 || placed.some((t) => t.id === 'copper_rod' && near(t, u, v) < 5);

    // ------------------------------------------------------------ carrying Lyra, and Lyra beside you
    const carried = new Graphics();
    carried.zIndex = 1e6 - 2;
    o.layer.addChild(carried);
    all.push(carried);
    const lyraA = createActor({ layer: o.layer, who: 'lyra', ground, zFor: o.zFor });
    lyraA.sprite.visible = false;
    all.push(lyraA.sprite);
    const lyra = { u: 0, v: 0, placed: false, cd: 1500, synergy: 0, aegis: 0, next: 'bind' as 'bind' | 'aegis', lu: 0, lv: 0, sy: NaN };
    const companion = () => quest.active() && (quest.data()?.land ?? 1) >= 4 && quest.has('lyra_staff');

    // ------------------------------------------------------------ steps as they begin and run
    interface Run { id: string; step: Step; land: Land; spawned: boolean; called: number; left: number; started: boolean; waveAt: number; kills: number; spire: number }
    const runs = new Map<string, Run>();
    let clock = 0;
    let hud = 0;
    const meteors: { u: number; v: number; t: number; g: Graphics; dmg: number }[] = [];
    let meteorClock = 20000;
    let hymnCd = 0;
    const echoes: { u: number; v: number; t: number }[] = [];
    let lastRoll = -1e9;
    /** A beat sequence: the finisher, or the grapple-mount. */
    let qte: { hit: number; need: number; t: number; code: number; kind: 'finish' | 'mount' } | null = null;
    const chord = new Map<string, number>();
    let filterMs = 0;
    let mist = 0;
    let frost = 0;
    let fogClock = 0;
    let lastPos = { u: 0, v: 0 };
    let cull = 0;
    let pushV = { du: 0, dv: 0, ms: 0 };
    let staticClock = 20000;
    let galeClock = 15000;
    let gravityClock = 20000;
    const riftClock = new Map<string, number>();
    let surge = { ms: 0, cd: 0 };
    let nightClock = 0;
    let nightPending = false;
    let night: Run | null = null;

    const bossAlive = (monsters: ViewMonster[], code: number) => monsters.find((m) => m.boss === code && m.state !== 'dying') ?? null;
    const startTimer = (label: string, secs: number) => store.saga({ timer: { label, left: Math.ceil(secs), total: secs } });
    const stopTimer = () => {
        if (store.get().saga.timer) store.saga({ timer: null });
    };
    const tierNow = () => progress.tierOf(land().el);

    const siteOfStep = (step: Step, l: Land): { u: number; v: number } | null => {
        const g = step.goal;
        if (g.kind === 'reach' || g.kind === 'clear') return siteAt(l, g.site);
        if (g.kind === 'boss') return siteAt(l, g.site);
        if (g.kind === 'defend' || g.kind === 'touch' || g.kind === 'puzzle') return byId.get(g.prop) ?? null;
        if (g.kind === 'siege') return campOf(l);
        if (step.at?.startsWith('prop:')) return byId.get(step.at.slice(5)) ?? null;
        if (step.at && !step.at.startsWith('npc:')) return siteAt(l, step.at);
        return null;
    };

    // ------------------------------------------------------------ the bosses: their mechanics, zones and the mount
    interface BossRun {
        def: BossDef & { land: Land };
        armorOpen: number[];
        armorOn: boolean[];
        added: Set<number>;
        flood: number;
        floodClock: number;
        polarity: number;
        polClock: number;
        invert: boolean;
        invertClock: number;
        dark: boolean;
        darkOpen: number;
        head: number;
        headClock: number;
        imbue: string | null;
        imbueMs: number;
        zones: number;
        zoneCd: number;
        mountMs: number;
        finisher: boolean;
        ward: number;
        unseen: boolean;
        called: number;
    }
    const bossRuns = new Map<string, BossRun>();
    const bossRun = (key: string): BossRun => {
        let b = bossRuns.get(key);
        if (!b) {
            const def = ALL_BOSSES[key];
            b = { def, armorOpen: def.mechs.map(() => 0), armorOn: def.mechs.map(() => false), added: new Set(), flood: 0, floodClock: 0, polarity: 0, polClock: 0, invert: false, invertClock: 0, dark: false, darkOpen: 0, head: 0, headClock: 0, imbue: null, imbueMs: 0, zones: 0, zoneCd: 0, mountMs: 0, finisher: false, ward: 1, unseen: false, called: -1e9 };
            bossRuns.set(key, b);
        }
        return b;
    };
    const HEADS = [{ name: 'Magma', counter: 'i' }, { name: 'Rime', counter: 'f' }, { name: 'Storm', counter: 'g' }];
    /** Open an armour mech (a prop struck near the boss, E, or the Hymn). */
    const openArmor = (b: BossRun, k: number, m: Extract<Mech, { kind: 'armor' }>) => {
        if (!b.armorOn[k]) return false;
        b.armorOn[k] = false;
        b.armorOpen[k] = m.open;
        o.banner(m.openMsg);
        sfx('levelup', 0.6);
        return true;
    };
    const tryOpen = (how: { prop?: Prop; byE?: boolean; byHymn?: boolean }, monsters: ViewMonster[]): boolean => {
        let any = false;
        for (const [key, b] of bossRuns) {
            const m0 = bossAlive(monsters, b.def.code);
            if (!m0) continue;
            b.def.mechs.forEach((m, k) => {
                if (m.kind !== 'armor') return;
                if (how.prop && m.props?.includes(how.prop.def.type) && near(how.prop, m0.u, m0.v) <= (m.near ?? 4)) any = openArmor(b, k, m) || any;
                if (how.byE && m.byE && near(m0, lastPos.u, lastPos.v) < 9) any = openArmor(b, k, m) || any;
                if (how.byHymn && m.byHymn && near(m0, lastPos.u, lastPos.v) < 12) any = openArmor(b, k, m) || any;
            });
            if (how.byHymn && b.invert) {
                b.invert = false;
                b.invertClock = (b.def.mechs.find((m) => m.kind === 'invert') as Extract<Mech, { kind: 'invert' }> | undefined)?.every ?? 25000;
                o.say('Your head clears', 0xbae6fd);
                any = true;
            }
            if (how.prop?.def.type === 'lure' && b.dark && near(how.prop, m0.u, m0.v) < 7) {
                b.dark = false;
                b.darkOpen = 9000;
                o.blast(m0.u, m0.v, 2, 1.5, 2500);
                o.banner('The lure blazes: the water lights up and she convulses! Strike!');
                any = true;
            }
            if (how.prop?.def.type === 'brazier' && b.def.mechs.some((m) => m.kind === 'heads')) {
                b.imbue = how.prop.def.id.slice(-1);
                b.imbueMs = 12000;
                o.say(`Your blade takes the ${how.prop.def.name ?? 'fire'}`, how.prop.def.color ?? 0xffffff);
                any = true;
            }
            void key;
        }
        return any;
    };

    const runBosses = (dtMs: number, u: number, v: number, monsters: ViewMonster[]) => {
        let invertNow = false;
        let darkNow = false;
        let zonesHud: AppState['saga']['zones'] = null;
        for (const [key, b] of bossRuns) {
            const m0 = bossAlive(monsters, b.def.code);
            if (!m0) {
                if (b.finisher && qte?.code === b.def.code) qte = null;
                bossRuns.delete(key);
                continue;
            }
            const share = m0.hp / m0.max;
            let ward = 1;
            b.def.mechs.forEach((m, k) => {
                if (m.kind === 'armor') {
                    if (b.armorOpen[k] > 0) {
                        b.armorOpen[k] -= dtMs;
                        ward *= 1.5;
                        if (b.armorOpen[k] <= 0) {
                            b.armorOn[k] = true;
                            o.say('The ward closes again!', 0xff8a5a);
                        }
                    } else if (!b.armorOn[k] && share < m.at) {
                        b.armorOn[k] = true;
                        o.banner(m.msg);
                    }
                    if (b.armorOn[k]) ward *= m.share;
                } else if (m.kind === 'adds') {
                    if (!b.added.has(k) && share < m.at) {
                        b.added.add(k);
                        o.encounter(m.foes, m0.u, m0.v, 4 + 2 * b.def.land.n);
                        if (m.msg) o.banner(m.msg);
                    }
                } else if (m.kind === 'flood') {
                    if (share < m.from && share > m.to) {
                        if (b.flood > 0) {
                            const before = b.flood;
                            b.flood -= dtMs;
                            ward *= 0.05;
                            const safe = ofType(m.safe, b.def.land).some((p) => p.lit > 0 && near(p, u, v) < 1.7);
                            if (Math.floor(before / 1000) !== Math.floor(b.flood / 1000) && !safe && near(m0, u, v) < 16) o.hurt(1);
                            if (b.flood <= 0) o.say('The flood drains', 0xffb38a);
                        } else {
                            b.floodClock += dtMs;
                            if (b.floodClock >= m.every) {
                                b.floodClock = 0;
                                b.flood = m.dur;
                                o.banner(m.msg);
                                sfx('wave');
                            }
                        }
                    }
                } else if (m.kind === 'finisher') {
                    if (share < m.at) {
                        ward *= 0.05;
                        if (!b.finisher) {
                            b.finisher = true;
                            qte = { hit: 0, need: m.beats, t: 0, code: b.def.code, kind: 'finish' };
                            o.banner(m.msg);
                        }
                    }
                } else if (m.kind === 'polarity') {
                    if (share < m.from && share > m.to) {
                        b.polClock += dtMs;
                        if (b.polClock >= m.every) {
                            b.polClock = 0;
                            b.polarity = b.polarity >= 0 ? -1 : 1;
                            o.banner(m.msg);
                            const anchored = ofType(m.anchor, b.def.land).some((p) => near(p, u, v) < 2.2);
                            if (!anchored) {
                                const d = Math.max(0.5, near(m0, u, v));
                                const k2 = b.polarity * 3.5;
                                pushV = { du: ((u - m0.u) / d) * k2, dv: ((v - m0.v) / d) * k2, ms: 700 };
                                if (b.polarity < 0) o.hurt(1);
                            }
                        }
                    }
                } else if (m.kind === 'invert') {
                    if (share < m.at && !b.invert) {
                        b.invertClock -= dtMs;
                        if (b.invertClock <= 0) {
                            b.invert = true;
                            o.banner(m.msg);
                        }
                    }
                    if (b.invert) invertNow = true;
                } else if (m.kind === 'dark') {
                    if (share < m.at) {
                        if (b.darkOpen > 0) {
                            b.darkOpen -= dtMs;
                            ward *= 1.4;
                            if (b.darkOpen <= 0) {
                                b.dark = true;
                                o.banner(m.msg);
                            }
                        } else if (!b.dark && b.darkOpen <= 0) {
                            b.dark = true;
                            o.banner(m.msg);
                        }
                        if (b.dark) {
                            ward *= 0.15;
                            darkNow = true;
                        }
                    }
                } else if (m.kind === 'shield') {
                    if (clock - lastRoll > 1500) ward *= m.share;
                } else if (m.kind === 'heal') {
                    if (ofType(m.props, b.def.land).some((p) => near(p, m0.u, m0.v) < 2.6)) {
                        ward *= 0.05;
                        if (clock % 3000 < dtMs) o.say(m.msg, 0xc4a5ff);
                    }
                } else if (m.kind === 'heads') {
                    b.headClock += dtMs;
                    if (b.headClock >= m.every) {
                        b.headClock = 0;
                        b.head = (b.head + 1) % HEADS.length;
                        o.banner(`${m.msg} The ${HEADS[b.head].name} head!`);
                    }
                    if (b.imbueMs > 0) b.imbueMs -= dtMs;
                    ward *= b.imbueMs > 0 && b.imbue === HEADS[b.head].counter ? 1.4 : 0.15;
                } else if (m.kind === 'unseen') {
                    if (share < m.at && !b.unseen) {
                        b.unseen = true;
                        o.banner(m.msg);
                    }
                }
            });
            if (b.mountMs > 0) b.mountMs -= dtMs;
            if (b.zoneCd > 0) b.zoneCd -= dtMs;
            if (Math.abs(ward - b.ward) > 0.001) {
                b.ward = ward;
                o.ward(b.def.code, ward);
            }
            if (near(m0, u, v) < 14) zonesHud = { broken: b.zones, mount: b.mountMs > 0 };
            // Lyra marks an unseen foe (and her own glow shows where).
            if (b.unseen && clock % 1200 < dtMs) o.fx('alert', m0.u, m0.v, { scale: 1.6, life: 900, lift: 90 });
        }
        if (qte) {
            qte.t += dtMs;
            if (hud <= 0) store.saga({ qte: { hit: qte.hit, need: qte.need, phase: (qte.t % 900) / 900, label: qte.kind === 'mount' ? 'Chisel the Ley-node' : undefined } });
            if (qte.kind === 'mount' && qte.t > 9000) {
                qte = null;
                store.saga({ qte: null });
                o.say('Thrown off!', 0xfca5a5);
            }
        } else if (store.get().saga.qte) store.saga({ qte: null });
        const s = store.get().saga;
        if (s.invert !== invertNow || s.dark !== darkNow || JSON.stringify(s.zones) !== JSON.stringify(zonesHud)) store.saga({ invert: invertNow, dark: darkNow, zones: zonesHud });
    };

    /** A step just came into play. */
    const begin = (r: Run) => {
        const g = r.step.goal;
        if (g.kind === 'siege') {
            r.left = g.secs * 1000;
            r.spire = SPIRE_HP;
        } else if (g.kind === 'defend' || g.kind === 'clear') r.left = g.secs * 1000;
        if (g.kind === 'carry') store.saga({ carrying: false });
        if (g.kind === 'strikes') quest.data() && (quest.data()!.n[`${r.id}:at`] = 0);
    };

    const runSiege = (r: Run, g: { waves: { foes: string[]; t: number }[]; secs: number }, dtMs: number, u: number, v: number, monsters: ViewMonster[], onDone: () => void) => {
        const camp = campOf(r.land);
        const spire = spireOf(r.land);
        const inCamp = near(camp, u, v) < 11;
        if (!r.started) {
            if (!inCamp) return;
            r.started = true;
            r.waveAt = 0;
            sfx('wave');
            o.banner(r.id === 'night' ? 'The core bleeds red: a Core-Bleed Siege! Hold the gate!' : 'The siege begins: they are coming for the gate!');
        }
        r.left -= dtMs;
        const elapsed = g.secs * 1000 - r.left;
        const due = g.waves.filter((w) => w.t * 1000 <= elapsed).length;
        while (r.waveAt < due) {
            const w = g.waves[r.waveAt++];
            const a = Math.random() * Math.PI * 2;
            // They gather outside the palisade (its corners are 11.3 tiles out) and can only come in by the gate.
            o.encounter(w.foes, camp.u + Math.cos(a) * 14, camp.v + Math.sin(a) * 14, 3 + r.land.n * 2 + (r.step.act ?? 1));
            o.banner(`Siege wave ${r.waveAt} of ${g.waves.length}`);
        }
        r.kills -= dtMs;
        if (r.kills <= 0 && spire) {
            r.kills = 1000;
            const gnaw = monsters.filter((m) => m.state !== 'dying' && near(spire, m.u, m.v) < 2.4).length;
            if (gnaw > 0) {
                r.spire = Math.max(0, r.spire - gnaw);
                o.blast(spire.u, spire.v, Math.max(1, Math.round(2 * o.damageMul())), 1.6);
            }
            if (r.spire <= 0) {
                o.banner('The Spire went dark! The Mist rolls in... Hold again!');
                sfx('fall');
                r.started = false;
                r.left = g.secs * 1000;
                r.spire = SPIRE_HP;
                r.waveAt = 0;
            }
        }
        const alive = monsters.some((m) => m.state !== 'dying' && near(camp, m.u, m.v) < 18);
        if (r.left <= 0 && !alive) {
            store.saga({ spire: null, timer: null });
            onDone();
            return;
        }
        if (hud <= 0) store.saga({ spire: { hp: r.spire, max: SPIRE_HP }, timer: r.left > 0 ? { label: 'Hold the Spire', left: Math.ceil(r.left / 1000), total: g.secs } : { label: 'Finish them', left: 0, total: g.secs } });
    };

    const runStep = (r: Run, dtMs: number, u: number, v: number, monsters: ViewMonster[]) => {
        const g = r.step.goal;
        const l = r.land;
        if (r.step.spawn && !r.spawned) {
            const at = r.step.spawn.at === 'player' ? { u, v } : siteAt(l, r.step.spawn.at);
            if (near(at, u, v) < 16) {
                r.spawned = true;
                o.encounter(r.step.spawn.foes, at.u, at.v, 2 + r.step.act + 2 * (l.n - 1));
            }
        }
        if (g.kind === 'boss') {
            const b = ALL_BOSSES[g.boss];
            const s = siteAt(l, g.site);
            const alive = bossAlive(monsters, b.code);
            if (alive) bossRun(g.boss);
            else if (near(s, u, v) < 13 && clock - r.called > 15000) {
                r.called = clock;
                bossRuns.delete(g.boss);
                o.summon(b.code, b.code === 99 ? 4 : progress.tierOf(l.el), s.u, s.v + 1);
                sfx('wave');
                o.banner(b.intro);
            }
        } else if (g.kind === 'reach') {
            if (near(siteAt(l, g.site), u, v) < (g.r ?? 6)) quest.on({ type: 'reach', site: g.site });
        } else if (g.kind === 'carry') {
            const altar = ofType('altar', l)[0];
            if (store.get().saga.carrying && altar && near(altar, u, v) < 3.5) {
                store.saga({ carrying: false });
                quest.on({ type: 'carried' });
                o.fx('heal', altar.u, altar.v, { scale: 1.6, life: 1000, lift: 30 });
            }
        } else if (g.kind === 'siege') {
            runSiege(r, g, dtMs, u, v, monsters, () => quest.on({ type: 'done', step: r.id }));
        } else if (g.kind === 'defend') {
            const at = prop(g.prop);
            const close = near(at, u, v) < 7;
            if (!r.started) {
                if (!close) return;
                r.started = true;
                r.waveAt = 0;
                o.banner(`${g.label ?? 'Hold the line'}! They are coming`);
            }
            if (!close && near(at, u, v) > 12) {
                r.started = false;
                r.left = g.secs * 1000;
                stopTimer();
                o.banner('You left your post! Go back and hold the line');
                return;
            }
            r.left -= dtMs;
            const elapsed = g.secs * 1000 - r.left;
            const due = Math.min(3, 1 + Math.floor(elapsed / ((g.secs * 1000) / 3)));
            while (r.waveAt < due) {
                r.waveAt++;
                const per = Math.ceil(g.foes.length / 3);
                o.encounter(g.foes.slice((r.waveAt - 1) * per, r.waveAt * per), at.u, at.v, 3 + r.step.act + 2 * (l.n - 1));
            }
            if (r.left <= 0) {
                quest.on({ type: 'done', step: r.id });
                stopTimer();
                return;
            }
            if (hud <= 0) startTimer(g.label ?? 'Hold', r.left / 1000);
        } else if (g.kind === 'clear') {
            const at = siteAt(l, g.site);
            if (!r.started) {
                if (near(at, u, v) > 11) return;
                r.started = true;
                r.called = clock;
                r.left = g.secs * 1000;
                o.encounter(g.foes, at.u, at.v, 3 + r.step.act * 2 + 2 * (l.n - 1));
            }
            if (clock - r.called < 2500) return;
            const alive = monsters.some((m) => m.state !== 'dying' && !m.boss && near(at, m.u, m.v) < 14);
            if (!alive) {
                for (const [k, n] of Object.entries(g.gives) as [ItemId, number][]) {
                    progress.addItem(k, n);
                    o.say(`+${n} ${ITEMS[k].name}`, 0xfde68a);
                }
                stopTimer();
                quest.on({ type: 'done', step: r.id });
                return;
            }
            if (g.secs > 0) {
                r.left -= dtMs;
                if (r.left <= 0) {
                    o.banner('Too slow! They rally again');
                    r.started = false;
                    stopTimer();
                    return;
                }
                if (hud <= 0) startTimer('Clear them', r.left / 1000);
            }
        } else if (g.kind === 'shelters' || g.kind === 'stations') {
            if (g.kind === 'shelters') {
                // Magma meteors fall on the caldera slopes; the domes are the only cover.
                meteorClock -= dtMs;
                const onSlope = zoneOf(l, u, v) === 3 && near(siteAt(l, 'ignis'), u, v) > 12;
                if (meteorClock <= 0 && onSlope) {
                    meteorClock = 20000;
                    for (let n = 0; n < 4; n++) {
                        const mu = u + (Math.random() - 0.5) * (n === 0 ? 1 : 8), mv = v + (Math.random() - 0.5) * (n === 0 ? 1 : 8);
                        meteors.push({ u: mu, v: mv, t: 1800, g: add(new Graphics(), mu, mv, -0.3), dmg: 2 });
                    }
                    o.banner('Meteors! Get under a dome or out of the circles');
                }
            }
            for (const id of g.props) {
                if (quest.has(`lit:${id}`)) continue;
                const d = prop(id);
                if (near(d, u, v) < 2.6) {
                    d.lit += dtMs;
                    if (d.lit > 400 && d.lit - dtMs <= 400) o.encounter(g.foes, d.u, d.v, 4 + r.step.act + 2 * (l.n - 1));
                    if (d.lit >= g.secs * 1000) {
                        quest.flag(`lit:${id}`);
                        redraw(id);
                        o.fx('heal', d.u, d.v, { scale: 1.8, life: 1000, lift: 30 });
                        o.banner(`${g.kind === 'stations' ? g.label : 'Shelter'} ${g.props.filter((x) => quest.has(`lit:${x}`)).length} of ${g.props.length}`);
                        quest.check();
                    }
                    if (hud <= 0 && d.lit < g.secs * 1000) startTimer(g.kind === 'stations' ? g.label : 'Shelter', (g.secs * 1000 - d.lit) / 1000);
                } else if (d.lit > 0) {
                    d.lit = Math.max(0, d.lit - dtMs / 2);
                    if (d.lit === 0) stopTimer();
                }
            }
        }
    };

    // ------------------------------------------------------------ finding story things in front of the player
    const aim = (facing: number) => {
        const a = (facing * Math.PI) / 4;
        return { du: (Math.cos(a) + Math.sin(a)) / Math.SQRT2, dv: (Math.sin(a) - Math.cos(a)) / Math.SQRT2 };
    };
    const liveGoalFor = (id: string) => quest.live().find((l) => (l.step.goal.kind === 'puzzle' || l.step.goal.kind === 'touch') && (l.step.goal as { prop: string }).prop === id);
    const usable = (p: Prop): string | null => {
        const t = p.def.type;
        const l = land();
        const main = quest.main();
        if (t === 'slab' && p.land === l && main?.goal.kind === 'carry' && !store.get().saga.carrying) return `Take ${main.goal.label ?? 'Lyra'}’s hand`;
        if (t === 'loom') return 'Strata-Loom';
        if (t === 'altar' && p.land === l) {
            const dr = l.draught;
            if (dr && store.get().bag[dr] > 0) return `Give the ${ITEMS[dr].name}`;
            const live = liveGoalFor(p.def.id);
            if (live) return (live.step.goal as { label?: string }).label ?? 'Lyra';
            if (quest.caring()) return 'Sit with Lyra';
            return null;
        }
        if (t === 'statue' && !quest.has(`broke:${p.def.id}`) && quest.isLive('i_statues')) return 'Ping the statue';
        if (t === 'quartz' && !quest.has('quartz')) return 'Strike the quartz';
        const live = liveGoalFor(p.def.id);
        if (live) {
            const g = live.step.goal;
            if (g.kind === 'touch') return g.label ?? `Search: ${p.def.name ?? PROP_NAME[t] ?? 'here'}`;
            if (g.kind === 'puzzle') {
                const need = g.requires;
                if (need) {
                    const ok = (!need.broke || need.broke.every((b) => quest.has(`broke:${b}`))) && (!need.flag || quest.has(need.flag)) && (!need.items || (Object.entries(need.items) as [ItemId, number][]).every(([k, n]) => store.get().bag[k] >= n));
                    if (!ok) return need.say;
                }
                if (p.def.id === 'a_gear' && !(quest.has('broke:a_c1') && quest.has('broke:a_c2'))) return 'Cut the chains first';
                if (p.def.id === 'l_lectern' && store.get().bag.solstice_tablet < 3) return 'Needs 3 Solstice Tablets';
                if (p.def.id === 'gate' && !quest.has('keystone')) return 'Needs the Keystone';
                return g.puzzle === 'debate' ? 'Face Malakor' : `Solve: ${p.def.name ?? PROP_NAME[t] ?? 'the puzzle'}`;
            }
        }
        return null;
    };
    const findProp = (u: number, v: number, facing: number): { p: Prop; hint: string } | null => {
        const f = aim(facing);
        let best: { p: Prop; hint: string } | null = null;
        let bs = Infinity;
        for (const p of props) {
            if (!shown(p)) continue;
            const d = near(p, u, v);
            if (d > (p.def.type === 'spire' || p.def.type === 'solstice' || p.def.type === 'crystal' ? 2.8 : REACH + 0.3)) continue;
            const hint = usable(p);
            if (!hint) continue;
            const dot = d > 0 ? ((p.u - u) * f.du + (p.v - v) * f.dv) / d : 1;
            const s = d - 0.45 * dot;
            if (s < bs) { bs = s; best = { p, hint }; }
        }
        return best;
    };
    let monstersNow: ViewMonster[] = [];

    /** Plant-and-blow: every wedge goes off; faults near them break. */
    const detonate = () => {
        if (wedges.length === 0) return false;
        const mul = o.damageMul();
        for (const w of wedges) {
            o.blast(w.u, w.v, Math.max(6, Math.round(10 * mul)), 2.2);
            o.fx('explosion', w.u, w.v, { scale: 2, life: 800 });
            for (const p of props) {
                if (!shown(p) || near(p, w.u, w.v) > 2.2 || quest.has(`broke:${p.def.id}`)) continue;
                if (!(p.def.wedge || p.def.hp)) continue;
                breakProp(p);
                // A stalactite or monolith dropped on a boss beside it.
                for (const m of monstersNow) if (m.boss && m.state !== 'dying' && near(p, m.u, m.v) < 3.2) {
                    o.blast(m.u, m.v, Math.round(m.max * 0.12), 1.2, 3000);
                    o.banner('It comes down on the boss!');
                }
            }
            w.g.destroy();
        }
        wedges.length = 0;
        store.saga({ wedges: 0 });
        synth('mine');
        sfx('explosion', 0.8);
        return true;
    };

    const breakProp = (p: Prop) => {
        const id = p.def.id;
        quest.flag(`broke:${id}`);
        quest.on({ type: 'break', prop: id });
        redraw(id);
        o.fx('explosion', p.u, p.v, { scale: 1.6, life: 700 });
        if (p.def.type === 'statue') {
            o.encounter(['slime'], p.u, p.v, 6);
            o.say('A Cinder-Mimic bursts out!', 0xff8a5a);
        }
    };

    /** Cell -> the story prop standing in it that blocks the way until broken. */
    const blockers = new Map<number, string>();
    const layer: StoryLayer = {
        use(u, v, facing) {
            if (!quest.active()) return false;
            // Pyra-style pulses: E opens a ward that answers to it.
            if (tryOpen({ byE: true }, monstersNow)) {
                o.blast(u, v, 2, 3);
                o.fx('frost', u, v, { scale: 3, squash: 0.55, life: 600 });
                synth('mine');
                return true;
            }
            const f = findProp(u, v, facing);
            if (!f) return detonate();
            const { p } = f;
            const t = p.def.type;
            const g = liveGoalFor(p.def.id)?.step.goal;
            if (t === 'slab') {
                store.saga({ carrying: true });
                redraw(p.def.id);
                o.banner('You take her hand. She lets you, like a stranger who has decided to trust you. Lead her to the Sanctuary');
                return true;
            }
            if (t === 'loom') {
                store.patch({ loom: true });
                return true;
            }
            if (t === 'altar') {
                const dr = land().draught;
                if (dr && store.get().bag[dr] > 0 && progress.useItem(dr)) {
                    if (quest.live().some((l) => l.step.goal.kind === 'give' && l.step.goal.item === dr)) quest.on({ type: 'give', item: dr });
                    else quest.steady(60);
                    o.fx('heal', p.u, p.v, { scale: 1.6, life: 1000, lift: 30 });
                    o.say('Her eyes clear a little', 0x7dd3fc);
                } else if (g?.kind === 'touch') quest.on({ type: 'touch', prop: p.def.id });
                else store.patch({ npc: 'lyra' });
                return true;
            }
            if (t === 'statue' && !g) {
                synth('mine');
                o.say(p.def.hollow ? 'It rings high and hollow!' : 'A dull, solid thud', p.def.hollow ? 0xfde68a : 0xcccccc);
                return true;
            }
            if (t === 'quartz') {
                layer.swing(p.u, p.v, 0, 'pickaxe');
                return true;
            }
            if (g?.kind === 'puzzle') {
                if (!f.hint.startsWith('Solve') && f.hint !== 'Face Malakor') {
                    o.say(f.hint, 0xcccccc);
                    return true;
                }
                if (g.puzzle === 'debate') store.patch({ debate: true });
                else store.patch({ puzzle: { id: g.puzzle, prop: p.def.id } });
                return true;
            }
            if (g?.kind === 'touch') {
                quest.on({ type: 'touch', prop: p.def.id });
                o.fx('pickup', p.u, p.v, { scale: 2, life: 1100, lift: 30 });
                redraw(p.def.id);
            }
            return true;
        },

        swing(u, v, facing, tool) {
            if (!quest.active()) return;
            const f = aim(facing);
            // A beat sequence: strike on the beat.
            if (qte) {
                const ph = (qte.t % 900) / 900;
                if (ph > 0.72 || ph < 0.12) {
                    qte.hit += 1;
                    o.say(['One', 'Two', 'Three', 'Four', 'Five'][qte.hit - 1] ?? 'Again', 0xfde68a);
                    synth('mine');
                    if (qte.hit >= qte.need) {
                        const m0 = monstersNow.find((m) => m.boss === qte!.code && m.state !== 'dying');
                        if (m0) {
                            const run = [...bossRuns.values()].find((b) => b.def.code === qte!.code);
                            if (qte.kind === 'finish') {
                                o.ward(qte.code, 1);
                                if (run) run.ward = 1;
                                o.blast(m0.u, m0.v, 99999, 3);
                                o.fx('explosion', m0.u, m0.v, { scale: 5, life: 900 });
                            } else {
                                const dmg = Math.round(m0.max * 0.2 / Math.max(0.05, run?.ward ?? 1));
                                o.blast(m0.u, m0.v, dmg, 1.4, 2000);
                                o.fx('crit', m0.u, m0.v, { scale: 3, life: 600, lift: 40 });
                                o.banner('You drive the chisel into its Ley-node!');
                            }
                        }
                        qte = null;
                        store.saga({ qte: null });
                    }
                } else {
                    qte.hit = Math.max(0, qte.hit - 1);
                    o.say('Off the beat!', 0xfca5a5);
                }
            }
            const hu = u + f.du * 0.9, hv = v + f.dv * 0.9;
            for (const p of props) {
                if (!shown(p)) continue;
                if (near(p, hu, hv) > 1.5 && near(p, u, v) > 1.3) continue;
                const t = p.def.type;
                const id = p.def.id;
                if (quest.has(`broke:${id}`)) continue;
                if (t === 'quartz' && !quest.has('quartz')) {
                    quest.flag('quartz');
                    quest.check();
                    redraw(id);
                    o.fx('sparkle', p.u, p.v, { scale: 2, squash: 0.6, life: 700 });
                    continue;
                }
                // Lock sequences (a rift's elemental locks, track levers): in order, or back to the start.
                const seq = quest.live().find((l) => l.step.goal.kind === 'strikes' && l.step.goal.props.includes(id));
                if (seq && seq.step.goal.kind === 'strikes') {
                    const key = `${seq.step.id}:at`;
                    const at = quest.count(key);
                    if (seq.step.goal.props[at] === id) {
                        quest.bump(key);
                        quest.flag(`lock:${id}`);
                        p.lit = 99999;
                        redraw(id);
                        synth('mine');
                        o.fx('boltburst', p.u, p.v, { scale: 2, life: 450, lift: 30 });
                        if (at + 1 >= seq.step.goal.props.length) {
                            o.banner(`${seq.step.goal.label}: done!`);
                            quest.on({ type: 'done', step: seq.step.id });
                        }
                    } else if (!quest.has(`lock:${id}`)) {
                        quest.bump(key, -at);
                        for (const x of seq.step.goal.props) {
                            const q = quest.data();
                            if (q) q.flags = q.flags.filter((ff) => ff !== `lock:${x}`);
                            const px = byId.get(x);
                            if (px) { px.lit = 0; redraw(x); }
                        }
                        o.say('Wrong order! The locks reset', 0xfca5a5);
                    }
                    continue;
                }
                // Mechanism props: vents, geysers, rods, pylons, lures, braziers, grounding spires, harmonic pillars.
                if (['vent', 'geyser', 'rod', 'pylon', 'lure', 'brazier', 'grounding', 'harmonic'].includes(t)) {
                    if (p.lit > 0 && t !== 'harmonic') continue;
                    p.lit = t === 'grounding' ? 12000 : t === 'harmonic' ? 4000 : 2500;
                    redraw(id);
                    synth('mine');
                    if (t === 'vent' || t === 'geyser') o.fx('frost', p.u, p.v, { scale: 3, squash: 0.55, life: 700 });
                    else if (t === 'rod' || t === 'pylon' || t === 'lure') o.fx('bolt', p.u, p.v, { scale: 1.8, life: 450 });
                    else if (t === 'grounding') o.say('It rises!', 0x7dd3fc);
                    tryOpen({ prop: p }, monstersNow);
                    if (t === 'harmonic' && quest.isLive('beta')) {
                        chord.set(id, clock);
                        const g = quest.main()?.goal;
                        if (g?.kind === 'chord' && g.props.every((x) => clock - (chord.get(x) ?? -1e9) < g.within)) {
                            o.fx('explosion', p.u, p.v, { scale: 3, life: 800 });
                            o.banner('The standing wave shatters the glass shell! The Pyre-Wardens wake');
                            quest.on({ type: 'done', step: 'beta' });
                        }
                    }
                    if (t === 'valve' as string) continue;
                    continue;
                }
                // Breakables.
                const breakable = !!p.def.hp || p.def.wedge || t === 'valve' || (t === 'statue' && p.def.hollow);
                if (!breakable) continue;
                if (p.def.wedge) {
                    if (clock - p.shake > 1500) o.say('A load-bearing fault. Plant Resonant Wedges in it and detonate them', 0xfde68a);
                    p.shake = clock;
                    continue;
                }
                if (t === 'tether' && !quest.has('slag_edge')) {
                    if (clock - p.shake > 1500) o.say("Your edge bounces off! Do Bram's side quest (The Blacksmith's Forgotten Hammer) for the Slag-Breaker", 0xffd0a0);
                    p.shake = clock;
                    continue;
                }
                if (p.def.needs && !quest.has(p.def.needs.flag)) {
                    if (clock - p.shake > 1500) o.say(p.def.needs.say, 0xffd0a0);
                    p.shake = clock;
                    continue;
                }
                if (t === 'valve' && !store.get().boss) continue;
                p.hp -= t === 'valve' && quest.has('schematic') ? 99 : tool === 'pickaxe' || tool === 'hammer' ? 2 : 1;
                synth(t === 'chain' || t === 'web' ? 'chop' : 'mine');
                o.fx('hit', p.u, p.v, { scale: 2, life: 400, lift: 24 });
                if (p.hp > 0) continue;
                breakProp(p);
                if (t === 'valve') tryOpen({ prop: p }, monstersNow);
            }
        },

        fracture(u, v, monsters) {
            if (!quest.active()) return;
            for (const [, b] of bossRuns) {
                const m0 = bossAlive(monsters, b.def.code);
                if (!m0 || near(m0, u, v) > 2.8 || b.zoneCd > 0 || b.zones >= 4) continue;
                b.zones += 1;
                b.zoneCd = 1500;
                const what = (['slow', 'weak', 'calm', 'stagger'] as const)[b.zones - 1];
                o.cripple(b.def.code, what);
                const zone = ['Left limb', 'Right limb', 'Torso cage', 'Core anchor'][b.zones - 1];
                o.banner(`Structural Fracture: ${zone}! ${what === 'slow' ? 'It slows' : what === 'weak' ? 'Its blows weaken' : what === 'calm' ? 'Its signature attack is broken' : 'It staggers: press F to mount it!'}`);
                o.fx('crit', m0.u, m0.v, { scale: 2.6, life: 600, lift: 40 });
                const mat = essOf(b.def.land.el);
                progress.addItem(mat, 1);
                o.say(`+1 ${ITEMS[mat].name}`, KINGDOMS[b.def.land.el].color);
                if (what === 'stagger') b.mountMs = 6000;
            }
            // Triad Resonance: every fracture also rings the three elements.
            if (quest.has('triad')) {
                o.blast(u, v, Math.max(2, Math.round(3 * o.damageMul())), 2.4, 600);
                o.fx('boltburst', u, v, { scale: 2.4, life: 450, lift: 20 });
            }
        },

        mount(u, v, monsters) {
            if (!quest.active() || qte) return false;
            for (const [, b] of bossRuns) {
                const m0 = bossAlive(monsters, b.def.code);
                if (!m0 || b.mountMs <= 0 || near(m0, u, v) > 3.2) continue;
                b.mountMs = 0;
                qte = { hit: 0, need: 3, t: 0, code: b.def.code, kind: 'mount' };
                o.banner('You grapple onto its back! Strike the Ley-node on the beat');
                sfx('dodge');
                return true;
            }
            return false;
        },

        place(id, u, v, facing) {
            const kinds: ItemId[] = ['rune_torch', 'resonant_wedge', 'ley_conduit', 'copper_rod', 'brazier_beacon', ...TURRETS];
            if (!kinds.includes(id)) return false;
            const f = aim(facing);
            const pu = u + f.du * 1.1, pv = v + f.dv * 1.1;
            const k = Math.floor(pv) * MAP_TILES + Math.floor(pu);
            if (o.map.blocked[k] === 1) return false;
            // In the camp or before its gate (the siege can only come in that way).
            const inCamp = LANDS.some((l) => near(campOf(l), pu, pv) <= 14);
            if ((TURRETS.includes(id) || id === 'ley_conduit') && !inCamp) {
                o.say('That goes at a Sanctuary: by its gate', 0xffffff);
                return true;
            }
            if (id === 'resonant_wedge') {
                if (wedges.length >= 3) {
                    o.say('Three wedges is the most. Press E (nothing in front of you) to detonate', 0xfde68a);
                    return true;
                }
                if (!progress.useItem(id)) return true;
                wedges.push({ id, u: pu, v: pv, g: drawPlaced(id, pu, pv), cd: 0, powered: false });
                for (const p of props) if (p.def.wedge && near(p, pu, pv) < 2) { quest.bump(`wedge:${p.def.id}`); redraw(p.def.id); }
                store.saga({ wedges: wedges.length });
                o.say(`Wedge planted (${wedges.length}/3)`, 0xfde68a);
                synth('mine');
                return true;
            }
            if (!progress.useItem(id)) return true;
            placed.push({ id, u: pu, v: pv, g: drawPlaced(id, pu, pv), cd: 800, powered: false });
            gridKey = '';
            const q = quest.data();
            if (q) {
                q.placed.push({ id, u: pu, v: pv });
                if (q.placed.length > 80) q.placed.shift();
            }
            o.say(`${ITEMS[id].name} set`, 0xfde68a);
            synth('chop');
            return true;
        },

        canEnter(i, j) {
            if (!quest.active()) return true;
            // What the story set in your way (boulders, a false wall, a fallen beam) stops you until it breaks.
            const blocker = blockers.get(j * MAP_TILES + i);
            if (blocker && !quest.has(`broke:${blocker}`)) return false;
            // Inside a cave or a ruin the land's zones do not apply (its door is in the zone).
            if (o.map.place[j * MAP_TILES + i] > 0) return true;
            const l = land();
            if (o.map.region[j * MAP_TILES + i] !== regionN(l.el)) return true;
            const z = zoneOf(l, i + 0.5, j + 0.5);
            return z === 0 || quest.has(`boss:${guardCode(l.el, z)}`);
        },
        teleported(u, v) {
            if (lyra.placed) {
                lyra.u = u - 0.7;
                lyra.v = v + 0.7;
                lyra.lu = u;
                lyra.lv = v;
                lyra.sy = NaN;
            }
        },
        hideProps(ids, hidden) {
            for (const id of ids) {
                if (hidden) hiddenIds.add(id);
                else hiddenIds.delete(id);
            }
        },
        holdWaves() {
            return quest.active() && (quest.data()?.land ?? 1) === 1 && !quest.has('done:seal');
        },
        sieging() {
            return [...runs.values()].some((r) => r.step.goal.kind === 'siege' && r.started) || !!night?.started;
        },
        speedMul() {
            return (store.get().saga.carrying ? 0.9 : 1) * (frost >= 1 ? 0.6 : 1);
        },
        regenMul() {
            return mist > 0.3 ? 0.5 : 1;
        },
        push(dtMs) {
            if (pushV.ms <= 0) return { du: 0, dv: 0 };
            const k = Math.min(dtMs, pushV.ms) / 1000;
            pushV.ms -= dtMs;
            return { du: pushV.du * k, dv: pushV.dv * k };
        },
        knockback(du, dv) {
            const d = Math.hypot(du, dv) || 1;
            pushV = { du: (-du / d) * 6, dv: (-dv / d) * 6, ms: 500 };
            const st = store.get();
            o.hurt(Math.max(1, Math.round(st.maxHp * 0.25)));
            o.banner('The Abyssal Maelstrom Wall hurls you back! (unshielded Ley-burn)');
            o.fx('boltburst', lastPos.u, lastPos.v, { scale: 2.6, life: 500, lift: 40 });
        },
        hurtMul() {
            if (surge.ms > 0 || lyra.aegis > 0) return 0;
            if (quest.has('martyr_ring') && store.get().boss) return 0.85;
            return 1;
        },
        onHurt(hp, max) {
            if (!quest.active() || surge.cd > 0 || hp <= 0 || hp / max >= 0.3) return;
            const line = quest.memory();
            if (!line) return;
            surge = { ms: 5000, cd: quest.has('done:n_give') ? 70000 : 90000 };
            store.saga({ surge: { line, id: Date.now() } });
            sfx('spell');
            o.banner('Flashback Surge! Hyper-armour, and your blows strike harder');
            if (quest.has('discharge_cape')) o.blast(lastPos.u, lastPos.v, 3, 2, 1500);
        },
        inverted() {
            return store.get().saga.invert;
        },
        target(u, v) {
            if (!quest.active()) return undefined;
            const step = quest.main();
            if (!step) return null;
            const l = land();
            const g = step.goal;
            if (nightPending && !night) return { ...campOf(), label: 'Core-Bleed Siege' };
            if (g.kind === 'carry') {
                const slab = ofType('slab', l)[0];
                const altar = ofType('altar', l)[0];
                if (!store.get().saga.carrying && slab) return { u: slab.u, v: slab.v, label: g.label ?? 'Lyra' };
                return altar ? { u: altar.u, v: altar.v, label: `${l.camp}` } : { ...campOf(l), label: l.camp };
            }
            if (g.kind === 'break' || g.kind === 'strikes') {
                const list = g.props.map(prop).filter((p) => !quest.has(`broke:${p.def.id}`) && !quest.has(`lock:${p.def.id}`)).sort((a, b) => (g.kind === 'strikes' ? 0 : near(a, u, v) - near(b, u, v)))[0];
                return list ? { u: list.u, v: list.v, label: list.def.name ?? PROP_NAME[list.def.type] ?? 'Here' } : null;
            }
            if (g.kind === 'shelters' || g.kind === 'stations') {
                const left = g.props.map(prop).find((p) => !quest.has(`lit:${p.def.id}`));
                return left ? { u: left.u, v: left.v, label: left.def.name ?? 'Shelter dome' } : null;
            }
            if (g.kind === 'relics') {
                const loom = ofType('loom', l)[0];
                return loom ? { u: loom.u, v: loom.v, label: 'Strata-Loom' } : null;
            }
            if (g.kind === 'chord') return { ...siteAt(l, 'siphonB'), label: 'Harmonic pillars' };
            if (g.kind === 'items') return undefined;
            if (g.kind === 'build' || g.kind === 'drink') return near(campOf(l), u, v) > 10 ? { ...campOf(l), label: l.camp } : null;
            if (g.kind === 'give') {
                const altar = ofType('altar', l)[0];
                return store.get().bag[g.item] > 0 && altar ? { u: altar.u, v: altar.v, label: "Lyra's alcove" } : { ...campOf(l), label: 'Alchemy tent' };
            }
            if (g.kind === 'place') {
                if (step.id === 'torches') return { ...siteAt(l, 'oakhaven'), label: 'Oakhaven' };
                return { ...campOf(l), label: l.camp };
            }
            if (g.kind === 'talk' || g.kind === 'forge') {
                const camp = layer.npcCamp(g.kind === 'talk' ? npcOf(g.npc) : npcOf(g.npc));
                const at = camp ? campOf(LANDS.find((x) => x.el === camp)) : campOf(l);
                return { ...at, label: g.kind === 'forge' ? 'The forge' : 'Talk' };
            }
            const at = siteOfStep(step, l);
            if (!at) return null;
            const label = step.at?.startsWith('prop:') ? byId.get(step.at.slice(5))?.def.name ?? PROP_NAME[byId.get(step.at.slice(5))?.def.type ?? 'ruin'] ?? 'Here' : l.siteNames[step.at ?? 'camp'] ?? 'Here';
            return { u: at.u, v: at.v, label };
        },
        prompt(u, v, facing) {
            if (!quest.active()) return null;
            for (const [, b] of bossRuns) if (b.def.mechs.some((m, k) => m.kind === 'armor' && m.byE && b.armorOn[k])) return { hint: 'Chisel pulse', act: { kind: 'challenge', label: 'Chisel pulse' } };
            const f = findProp(u, v, facing);
            if (!f) return wedges.length > 0 ? { hint: 'Detonate the wedges', act: { kind: 'challenge', label: `Detonate ${wedges.length} wedge${wedges.length > 1 ? 's' : ''}` } } : null;
            const t = f.p.def.type;
            const kind: NonNullable<AppState['act']>['kind'] = t === 'altar' ? 'talk' : t === 'statue' || t === 'quartz' ? 'mine' : t === 'slab' ? 'pick' : t === 'loom' ? 'bench' : 'search';
            return { hint: f.hint, act: { kind, label: f.hint } };
        },
        gather() {
            const g = quest.main()?.goal;
            if (!quest.active() || g?.kind !== 'items') return null;
            const bag = store.get().bag;
            const want = g.items as Partial<Record<ItemId, number>>;
            for (const k of ['stone', 'copper_ore', 'storm_quartz', 'shark_tooth', 'lichen'] as ItemId[]) if ((want[k] ?? 0) > bag[k]) return 'stone';
            if ((want.resin ?? 0) > bag.resin || (want.wood ?? 0) > bag.wood) return 'wood';
            return null;
        },
        npcCamp(id) {
            if (!quest.active()) return progress.kingdom();
            const q = quest.data()!;
            const n = q.land;
            if (n >= 4) {
                if (id === 'lyra') return null;
                const met = id === 'theron' ? quest.has('orin') : id === 'varis' ? quest.has('bram') : quest.has(id);
                return met ? 'earth' : null;
            }
            if (id === 'theron') return quest.has('orin') ? 'fire' : null;
            if (id === 'varis') return quest.has('bram') ? 'fire' : null;
            if (id === 'kael') return quest.has('kael') ? 'fire' : null;
            if (id === 'lin') return quest.has('lin') ? 'air' : null;
            if (id === 'thorne') return quest.has('thorne') ? 'air' : null;
            if (id === 'nerissa') return quest.has('nerissa') ? 'water' : null;
            if (id === 'lyra') return quest.caring() && (n > 1 ? quest.has(`done:${land().main[0].id}`) : true) ? land().el : null;
            return null;
        },
        npcAt(id) {
            return (quest.data()?.land ?? 1) >= 4 ? COALITION_AT[id as NpcId] ?? null : null;
        },
        hymn(u, v) {
            if (!quest.has('hymn') || hymnCd > 0) return;
            hymnCd = quest.has('pitch_pipe') ? 12000 : 20000;
            o.blast(u, v, Math.max(2, Math.round(2 * o.damageMul())), 6, 3000);
            o.heal(2);
            o.fx('aura', u, v, { scale: 6, squash: 0.55, life: 1100 });
            o.fx('heal', u, v, { scale: 2, life: 1100, lift: 50 });
            sfx('spell');
            o.say('The Resonant Hymn', 0xbae6fd);
            tryOpen({ byHymn: true }, monstersNow);
        },
        rolled(u, v) {
            lastRoll = clock;
            if (quest.has('echo_dash')) echoes.push({ u, v, t: 600 });
        },
        synergy(u, v) {
            if (!companion()) return false;
            if (lyra.synergy > 0) {
                o.say(`Lyra needs ${Math.ceil(lyra.synergy / 1000)}s`, 0xbae6fd);
                return true;
            }
            lyra.synergy = 14000;
            if (lyra.next === 'bind') {
                o.blast(u, v, Math.max(2, Math.round(2 * o.damageMul())), 6.5, 3000);
                o.fx('frost', u, v, { scale: 7, squash: 0.55, life: 900 });
                o.banner('Lyra: "Runic Binding!" Every foe near you is held fast');
                lyra.next = 'aegis';
            } else {
                lyra.aegis = 5000;
                o.fx('defup', u, v, { scale: 3, life: 1300, lift: 56 });
                o.banner('Lyra: "Harmonic Aegis!" Nothing gets through for five seconds');
                lyra.next = 'bind';
            }
            sfx('spell');
            return true;
        },
        drink(id) {
            if (id !== 'filter_draught') return false;
            filterMs = 300000;
            quest.on({ type: 'drink', item: id });
            o.say('You can breathe the fog for five minutes', 0xa3e635);
            return true;
        },
        swingMul(u, v, monsters) {
            let mul = 1;
            if (quest.has('masterwork')) mul *= 1.35;
            if (quest.has('tempest_blade')) mul *= 1.15;
            if (quest.has('mythic')) mul *= 1.25;
            if (quest.has('crown') && (quest.data()?.land ?? 1) >= 4) mul *= 1.3;
            if (surge.ms > 0) mul *= 1.4;
            const boss = monsters.some((m) => m.boss && m.state !== 'dying' && near(m, u, v) < 2.6);
            if (boss && quest.has('vein_striker')) mul *= 1.4;
            if (boss && quest.has('slag_edge')) mul *= 1.1;
            if (boss && quest.has('spyglass') && Math.random() < 0.2) mul *= 1.5;
            return mul;
        },

        update(dtMs, u, v, facing, monsters) {
            clock += dtMs;
            hud -= dtMs;
            monstersNow = monsters;
            const active = quest.active();
            hymnCd = Math.max(0, hymnCd - dtMs);
            surge.ms = Math.max(0, surge.ms - dtMs);
            surge.cd = Math.max(0, surge.cd - dtMs);
            lyra.synergy = Math.max(0, lyra.synergy - dtMs);
            lyra.aegis = Math.max(0, lyra.aegis - dtMs);
            const moved = Math.hypot(u - lastPos.u, v - lastPos.v) > 0.01;
            lastPos = { u, v };
            // Only what is near is drawn (checked a few times a second, not every frame).
            cull -= dtMs;
            if (cull <= 0) {
                cull = 200;
                for (const p of props) p.g.visible = Math.abs(p.u - u) < 30 && Math.abs(p.v - v) < 30 && shown(p);
                const nLand = quest.data()?.land ?? 1;
                for (const x of labels) x.t.visible = active && !store.get().cine && x.land.n <= nLand && Math.abs(x.t.x - ground(u, v).x) < 2200;
            }
            powerGrid();
            // Lyra as herself: waiting where the land's story finds her, walking at your side when you lead
            // her to the Sanctuary, and fighting beside you in the last land.
            const mainNow = quest.main();
            const slabNow = ofType('slab', land())[0];
            const waitingAt = active && slabNow && mainNow && (mainNow.id === 'free' || (mainNow.goal.kind === 'carry' && !store.get().saga.carrying)) ? slabNow : null;
            const following = companion() || (active && store.get().saga.carrying);
            lyraA.sprite.visible = (!!waitingAt || following) && !store.get().cine;
            if (waitingAt && !following) {
                lyraA.at(waitingAt.u + 0.3, waitingAt.v - 0.2);
                lyraA.face(u - waitingAt.u, v - waitingAt.v);
                lyraA.play('idle', true, 170);
                lyraA.update(dtMs);
                lyra.u = waitingAt.u + 0.3;
                lyra.v = waitingAt.v - 0.2;
                lyra.placed = true;
            }
            if (following) {
                if (!lyra.placed || near(lyra, u, v) > 12) { lyra.u = u - 1; lyra.v = v + 1; lyra.placed = true; lyra.lu = u; lyra.lv = v; }
                const holding = active && store.get().saga.carrying && !companion();
                if (holding) {
                    // Hand in hand: she walks at your side, in step with you, facing where you face.
                    const pace = Math.hypot(u - lyra.lu, v - lyra.lv) / Math.max(0.001, dtMs / 1000);
                    lyra.lu = u;
                    lyra.lv = v;
                    // A step to the side (and a little behind, so you lead): far enough apart that the iso view never stacks you.
                    const spotAt = (turn: number) => {
                        const a = (facing * Math.PI) / 4 + turn, back = (facing * Math.PI) / 4 + Math.PI;
                        const du = ((Math.cos(a) + Math.sin(a)) / Math.SQRT2) * 0.9 + ((Math.cos(back) + Math.sin(back)) / Math.SQRT2) * 0.25;
                        const dv = ((Math.sin(a) - Math.cos(a)) / Math.SQRT2) * 0.9 + ((Math.sin(back) - Math.cos(back)) / Math.SQRT2) * 0.25;
                        return { u: u + du, v: v + dv };
                    };
                    const free = (p: { u: number; v: number }) => o.map.blocked[Math.floor(p.v) * MAP_TILES + Math.floor(p.u)] === 0;
                    // At your side; if the side is wall or rock, a half step behind you instead.
                    const side = spotAt(-Math.PI / 2);
                    const spot = free(side) ? side : spotAt(Math.PI);
                    const k = 1 - Math.exp(-dtMs / 70);
                    lyra.u += (spot.u - lyra.u) * k;
                    lyra.v += (spot.v - lyra.v) * k;
                    const f = FACINGS[((facing % 8) + 8) % 8];
                    lyraA.setFacing(f.row, f.flip);
                    if (pace > 0.6) lyraA.play('walk', true, pace > 4.2 ? 95 : 120);
                    else lyraA.play('idle', true, 160);
                } else {
                    const d = near(lyra, u, v);
                    if (d > 1.6) {
                        const step = Math.min(d - 1.4, (dtMs / 1000) * 5);
                        const du = ((u - lyra.u) / d) * step, dv = ((v - lyra.v) / d) * step;
                        lyra.u += du;
                        lyra.v += dv;
                        lyraA.face(du, dv);
                        lyraA.play('walk', true, 110);
                    } else lyraA.play('idle', true, 160);
                }
                lyraA.at(lyra.u, lyra.v);
                // Ease her up and down terraces as the hero eases (no popping from tile to tile).
                const targetY = lyraA.sprite.y;
                lyra.sy = Number.isNaN(lyra.sy) || Math.abs(targetY - lyra.sy) > 200 ? targetY : lyra.sy + (targetY - lyra.sy) * Math.min(1, (dtMs / 1000) * 14);
                lyraA.sprite.y = lyra.sy;
                lyraA.sprite.tint = lyra.aegis > 0 ? 0xfff3c4 : 0xffffff;
                lyraA.update(dtMs);
                lyra.cd -= dtMs;
                if (companion() && lyra.cd <= 0) {
                    const foe = monsters.filter((m) => m.state !== 'dying' && near(lyra, m.u, m.v) < 7).sort((a, b) => near(lyra, a.u, a.v) - near(lyra, b.u, b.v))[0];
                    lyra.cd = foe ? 2200 : 500;
                    if (foe) {
                        o.blast(foe.u, foe.v, Math.max(2, Math.round(3 * o.damageMul())), 0.9);
                        o.fx('bolt', foe.u, foe.v, { scale: 1.6, life: 450 });
                    }
                }
            }
            // Echoes burst.
            for (let n = echoes.length - 1; n >= 0; n--) {
                echoes[n].t -= dtMs;
                if (echoes[n].t > 0) continue;
                o.blast(echoes[n].u, echoes[n].v, Math.max(2, Math.round(3 * o.damageMul())), 1.8);
                o.fx('boltburst', echoes[n].u, echoes[n].v, { scale: 2.6, life: 500, lift: 30 });
                echoes.splice(n, 1);
            }
            // Meteors and lightning land.
            for (let n = meteors.length - 1; n >= 0; n--) {
                const m = meteors[n];
                m.t -= dtMs;
                m.g.clear();
                if (m.t > 0) {
                    const k = 1 - m.t / 1800;
                    m.g.ellipse(0, 0, 40, 20).stroke({ width: 3, color: 0xff6a3d, alpha: 0.5 + 0.5 * k }).ellipse(0, 0, 40 * k, 20 * k).fill({ color: 0xff6a3d, alpha: 0.3 });
                    continue;
                }
                o.fx(m.dmg === 1 ? 'bolt' : 'explosion', m.u, m.v, { scale: 2, life: 700 });
                const covered = props.some((p) => p.def.type === 'shelter' && near(p, u, v) < 2.6);
                if (near(m, u, v) < 1.7 && !covered) o.hurt(m.dmg);
                o.blast(m.u, m.v, 4, 1.7);
                m.g.destroy();
                meteors.splice(n, 1);
            }
            // Turrets (only with power).
            for (const t of placed) {
                if (!TURRETS.includes(t.id) && t.id !== 'copper_rod') continue;
                t.cd -= dtMs;
                if (t.cd > 0) continue;
                if (TURRETS.includes(t.id) && !t.powered) { t.cd = 1000; continue; }
                const reach = t.id === 'catapult' || t.id === 'steam_mortar' ? 10 : t.id === 'ballista' || t.id === 'harpoon_launcher' ? 8 : t.id === 'tesla_coil' ? 6 : t.id === 'copper_rod' ? 2.2 : 3;
                const foes = monsters.filter((m) => m.state !== 'dying' && near(t, m.u, m.v) < reach && ((t.id !== 'catapult' && t.id !== 'steam_mortar') || near(t, m.u, m.v) > 2.5)).sort((a, b) => near(t, a.u, a.v) - near(t, b.u, b.v));
                const foe = foes[0];
                if (!foe) { t.cd = 300; continue; }
                const mul = o.damageMul();
                if (t.id === 'ballista') { o.blast(foe.u, foe.v, Math.round(4 * mul), 0.7); o.fx('hit', foe.u, foe.v, { scale: 2, life: 400, lift: 30 }); t.cd = 1600; }
                else if (t.id === 'harpoon_launcher') { o.blast(foe.u, foe.v, Math.round(2 * mul), 0.7, 2000); o.fx('hit', foe.u, foe.v, { scale: 2, life: 400, lift: 30 }); t.cd = 1800; }
                else if (t.id === 'flame_turret') { o.blast(t.u, t.v, Math.round(3 * mul), 3); o.fx('fireball', t.u, t.v, { scale: 1.4, life: 500, lift: 30 }); t.cd = 1100; }
                else if (t.id === 'tesla_coil') { for (const f of foes.slice(0, 3)) { o.blast(f.u, f.v, Math.round(3 * mul), 0.6); o.fx('bolt', f.u, f.v, { scale: 1.4, life: 400 }); } t.cd = 1500; }
                else if (t.id === 'copper_rod') { o.blast(foe.u, foe.v, Math.round(2 * mul), 0.6, 800); o.fx('boltburst', foe.u, foe.v, { scale: 1.6, life: 400 }); t.cd = 3000; }
                else { o.blast(foe.u, foe.v, Math.round((t.id === 'steam_mortar' ? 5 : 6) * mul), t.id === 'steam_mortar' ? 2 : 1.8); o.fx('explosion', foe.u, foe.v, { scale: 1.4, life: 600 }); t.cd = 3000; }
            }
            if (!active) {
                if (hud <= 0) {
                    hud = 250;
                    const s = store.get().saga;
                    if (s.mist || s.sulfur || s.timer || s.spire || s.carrying || s.frost || s.invert || s.dark) store.saga({ mist: 0, sulfur: false, timer: null, spire: null, carrying: false, frost: 0, invert: false, dark: false });
                }
                return;
            }
            // Reading, talking or solving: the story's clocks hold still.
            const sNow = store.get();
            if (sNow.storyPopup || sNow.puzzle || sNow.npc || sNow.loom || sNow.debate) return;
            // Steps in play: begin the new ones, run them all.
            const live = quest.live();
            for (const id of [...runs.keys()]) if (!live.some((x) => x.step.id === id)) {
                const r = runs.get(id)!;
                if (r.step.goal.kind === 'siege') store.saga({ spire: null });
                if (['siege', 'defend', 'clear', 'stations', 'shelters'].includes(r.step.goal.kind)) stopTimer();
                runs.delete(id);
            }
            for (const x of live) {
                let r = runs.get(x.step.id);
                if (!r) {
                    r = { id: x.step.id, step: x.step, land: x.land, spawned: false, called: -1e9, left: 0, started: false, waveAt: 0, kills: 0, spire: SPIRE_HP };
                    runs.set(x.step.id, r);
                    begin(r);
                }
                runStep(r, dtMs, u, v, monsters);
            }
            // Bosses from side quests or earlier (any story boss alive near you) get their mechanics too.
            for (const m of monsters) {
                if (!m.boss || m.state === 'dying' || near(m, u, v) > 20) continue;
                const key = Object.keys(ALL_BOSSES).find((k) => ALL_BOSSES[k].code === m.boss);
                if (key) bossRun(key);
            }
            runBosses(dtMs, u, v, monsters);
            for (const p of props) if (['grounding', 'vent', 'geyser', 'harmonic', 'rod', 'pylon', 'lure', 'brazier'].includes(p.def.type) && p.lit > 0 && p.lit < 90000) {
                p.lit -= dtMs;
                if (p.lit <= 0) redraw(p.def.id);
            }
            quest.tickLyra(dtMs / 1000);
            // The Core-Bleed Siege: every 45 minutes of exploring, night falls and the core vents at the Sanctuary.
            const l = land();
            const inCamp = near(campOf(l), u, v) < 9;
            if (!night && !nightPending) {
                if (!inCamp) nightClock += dtMs;
                if (nightClock >= NIGHT_EVERY) {
                    nightClock = 0;
                    nightPending = true;
                    o.banner(`The core is venting! A Core-Bleed Siege will hit the ${l.camp}: go back and defend the Spire`);
                    sfx('wave');
                }
            }
            if (nightPending && !night && inCamp) {
                const w = (n: number) => ['wolf', 'kobolt', 'skeleton', 'archer', 'bomber', 'brute', 'wraith', 'wizard'].slice(0, 4 + l.n).sort(() => Math.random() - 0.5).slice(0, n);
                const step: Step = { id: 'night', quest: 'Core-Bleed Siege', act: 1, task: 'Survive the Core-Bleed Siege', how: '', goal: { kind: 'siege', secs: 80, waves: [{ t: 0, foes: w(6) }, { t: 30, foes: w(7) }, { t: 58, foes: w(7) }] } };
                night = { id: 'night', step, land: l, spawned: true, called: 0, left: 80000, started: false, waveAt: 0, kills: 0, spire: SPIRE_HP };
            }
            if (night && night.step.goal.kind === 'siege') {
                runSiege(night, night.step.goal, dtMs, u, v, monsters, () => {
                    night = null;
                    nightPending = false;
                    progress.gainXp(120 * l.n);
                    progress.addItem('potion_red', 1);
                    o.banner('The core settles. The Spire holds');
                });
            }
            // The land's curse.
            let inMist = false;
            let fog: { item: ItemId; say: string } | null = null;
            for (const h of l.hazards) {
                if (h.kind === 'mist') {
                    if (near(siteAt(l, h.site), u, v) < h.r && !lightNear(u, v)) inMist = true;
                } else if (h.kind === 'fog') {
                    if (near(siteAt(l, h.site), u, v) < h.r) fog = { item: h.item, say: h.say };
                } else if (h.kind === 'static' && !inCamp) {
                    staticClock -= dtMs;
                    if (staticClock <= 0) {
                        staticClock = h.every * (0.7 + Math.random() * 0.6);
                        if (!rodNear(u, v)) {
                            meteors.push({ u, v, t: 1400, g: add(new Graphics(), u, v, -0.3), dmg: 1 });
                            o.say('Static! Move!', 0xc4b5fd);
                        }
                    }
                } else if (h.kind === 'gale' && !inCamp) {
                    galeClock -= dtMs;
                    if (galeClock <= 0) {
                        galeClock = h.every * (0.7 + Math.random() * 0.6);
                        if (store.get().bag.iron_boots < 1) {
                            const a = Math.random() * Math.PI * 2;
                            pushV = { du: Math.cos(a) * 4, dv: Math.sin(a) * 4, ms: 700 };
                            o.say('A gust shoves you!', 0xe0f2fe);
                        }
                    }
                } else if (h.kind === 'frost') {
                    const shielded = quest.has('hadal') || warmNear(u, v);
                    frost = Math.max(0, Math.min(1, frost + (shielded || moved ? -dtMs / 4000 : dtMs / (store.get().bag.crampons > 0 ? 14000 : 8000))));
                    if (frost >= 1) {
                        fogClock += dtMs;
                        if (fogClock > 3000) { fogClock = 0; o.hurt(1); o.say('Frostbite! Keep moving, or find a brazier', 0xbae6fd); }
                    }
                } else if (h.kind === 'gravity' && !inCamp) {
                    gravityClock -= dtMs;
                    if (gravityClock <= 0) {
                        gravityClock = h.every * (0.7 + Math.random() * 0.6);
                        const a = Math.random() * Math.PI * 2;
                        pushV = { du: Math.cos(a) * 5, dv: Math.sin(a) * 5, ms: 900 };
                        o.banner('Gravity tips!');
                    }
                } else if (h.kind === 'rift') {
                    if (quest.has(`sealed:${h.id}`)) continue;
                    const at = siteAt(l, h.site);
                    if (near(at, u, v) > 18) continue;
                    const c = (riftClock.get(h.id) ?? 4000) - dtMs;
                    if (c <= 0) {
                        riftClock.set(h.id, 10000);
                        o.encounter(['wraith', 'wraith'], at.u, at.v, 6 + 2 * l.n);
                    } else riftClock.set(h.id, c);
                }
            }
            if (!l.hazards.some((h) => h.kind === 'frost')) frost = 0;
            mist = Math.max(0, Math.min(1, mist + (inMist ? dtMs / 9000 : -dtMs / 2500)));
            filterMs = Math.max(0, filterMs - dtMs);
            const choking = !!fog && filterMs <= 0;
            if (choking && fog) {
                fogClock += dtMs;
                if (fogClock > 3000) {
                    fogClock = 0;
                    o.hurt(1);
                    o.say(fog.say, 0xd9f99d);
                }
            } else if (!l.hazards.some((h) => h.kind === 'frost')) fogClock = 0;
            if (hud <= 0) {
                hud = 150;
                redraw(ofType('slab', l)[0]?.def.id ?? '');
                const s = store.get().saga;
                const m = Math.round(mist * 20) / 20;
                const fr = Math.round(frost * 20) / 20;
                const hy = quest.has('hymn') ? Math.ceil(hymnCd / 1000) : null;
                const comp = companion() ? Math.ceil(lyra.synergy / 1000) : null;
                const nightIn = nightPending ? 0 : Math.ceil((NIGHT_EVERY - nightClock) / 60000);
                if (s.mist !== m || s.sulfur !== choking || s.hymn !== hy || s.frost !== fr || s.companion !== comp || s.nightIn !== nightIn) store.saga({ mist: m, sulfur: choking, hymn: hy, frost: fr, companion: comp, nightIn });
                if (s.surge && surge.ms <= 0) store.saga({ surge: null });
                drawVeil(l, u, v);
            }
        },

        destroy() {
            for (const m of meteors) m.g.destroy();
            for (const t of placed) t.g.destroy();
            for (const w of wedges) w.g.destroy();
            for (const x of all) if (!x.destroyed) x.destroy();
            store.patch({ puzzle: null, loom: false, debate: false });
            store.saga({ mist: 0, sulfur: false, timer: null, spire: null, qte: null, carrying: false, frost: 0, invert: false, dark: false, zones: null, surge: null, wedges: 0 });
        },
    };

    // ------------------------------------------------------------ the sealed zones' walls of slag, near you
    const veil = new Graphics();
    veil.zIndex = 1e5 - 1;
    o.layer.addChild(veil);
    all.push(veil);
    const drawVeil = (l: Land, u: number, v: number) => {
        veil.clear();
        const ci = Math.floor(u), cj = Math.floor(v);
        const rn = regionN(l.el);
        const color = KINGDOMS[l.el].color;
        for (let j = cj - 12; j <= cj + 12; j++) {
            for (let i = ci - 12; i <= ci + 12; i++) {
                if (i < 0 || j < 0 || i >= MAP_TILES || j >= MAP_TILES || o.map.region[j * MAP_TILES + i] !== rn || o.map.place[j * MAP_TILES + i] > 0) continue;
                const z = zoneOf(l, i + 0.5, j + 0.5);
                if (z === 0 || quest.has(`boss:${guardCode(l.el, z)}`) || zoneOf(l, i - 0.5, j - 0.5) === z) continue;
                // A wall of cooling slag you can plainly see (never an invisible edge): dark crust, a glowing seam.
                const p = ground(i + 0.5, j + 0.5);
                const glow = 0.55 + 0.15 * Math.sin(clock / 300 + i);
                veil.rect(p.x - 31, p.y - 64, 62, 64).fill({ color: 0x2a1a1e, alpha: 0.82 });
                veil.rect(p.x - 31, p.y - 64, 62, 64).stroke({ width: 3, color: 0x120a0c, alpha: 0.9 });
                veil.rect(p.x - 26, p.y - 40, 52, 5).fill({ color, alpha: glow });
            }
        }
    };
    const zoneOf = (l: Land, u: number, v: number) => {
        const d = axisDistance(l.el, u, v);
        return d < STORY_ZONES[0] ? 0 : d < STORY_ZONES[1] ? 1 : d < STORY_ZONES[2] ? 2 : 3;
    };
    const npcOf = (k: string): string => ({ orin: 'theron', bram: 'varis' } as Record<string, string>)[k] ?? k;
    void heroName;
    // The way to a place in another part of the world: the door to go through first (a cave mouth,
    // the way out, a ladder), found breadth-first over the doors.
    const route = (t: Point, u: number, v: number): Point => {
        const at = (x: number, y: number) => o.map.place[Math.floor(y) * MAP_TILES + Math.floor(x)] ?? 0;
        const from = at(u, v), to = at(t.u, t.v);
        if (from === to) return t;
        const prev = new Map<number, number>([[from, -1]]);
        const via = new Map<number, number>();
        const q = [from];
        for (let k = 0; k < q.length && !prev.has(to); k++) {
            const cur = q[k];
            o.map.doors.forEach((d, n) => {
                if (o.map.place[d.at] !== cur || prev.has(d.place)) return;
                prev.set(d.place, cur);
                via.set(d.place, n);
                q.push(d.place);
            });
        }
        if (!prev.has(to)) return t;
        let next = to;
        while (prev.get(next) !== from) next = prev.get(next)!;
        const d = o.map.doors[via.get(next)!];
        return { u: (d.at % MAP_TILES) + 0.5, v: Math.floor(d.at / MAP_TILES) + 0.5, label: next === 0 ? `${t.label} · the way out` : `${t.label} · ${d.name}` };
    };
    // What the story set in your way blocks the cell it stands in until it is broken.
    for (const l of LANDS) {
        for (const p of l.props) {
            if (!BLOCKING.has(p.type)) continue;
            const c = siteAt(l, p.site);
            blockers.set(Math.floor(c.v + p.at[1]) * MAP_TILES + Math.floor(c.u + p.at[0]), p.id);
        }
    }
    /** The side quest the player follows, if one: where its step happens. */
    const sideAim = (): Point | null => {
        const id = store.get().tracked;
        const l = id ? quest.live().find((x) => x.side === id) : null;
        if (!l) return null;
        const g = l.step.goal;
        const label = l.step.quest;
        if (g.kind === 'break' || g.kind === 'strikes') {
            const left = g.props.map((pid) => byId.get(pid)).find((p) => p && !quest.has(`broke:${p.def.id}`));
            if (left) return { u: left.u, v: left.v, label: `${label} · ${left.def.name ?? PROP_NAME[left.def.type] ?? 'here'}` };
        }
        // Someone to talk to (or forge with): their camp.
        if (g.kind === 'talk' || g.kind === 'forge') {
            const camp = layer.npcCamp(npcOf(g.npc));
            return { ...(camp ? campOf(LANDS.find((x) => x.el === camp)) : campOf(l.land)), label: `${label} · ${g.kind === 'forge' ? 'the forge' : 'Talk'}` };
        }
        const at = (l.step as { at?: string }).at;
        if (at?.startsWith('prop:')) {
            const p = byId.get(at.slice(5));
            if (p) return { u: p.u, v: p.v, label };
        } else if (at && !at.startsWith('npc:')) return { ...siteAt(l.land, at), label };
        return null;
    };
    const aimRaw = layer.target.bind(layer);
    layer.target = (u, v) => {
        const t = sideAim() ?? aimRaw(u, v);
        return t ? route(t, u, v) : t;
    };
    return layer;
}
