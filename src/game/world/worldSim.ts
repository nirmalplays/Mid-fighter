/**
 * Where the world's monsters and drops come from. Online, the server's shared
 * simulation (src/rooms/WorldRoom.ts) is the only source: every player sees the same
 * enemies, and swings and pickups are sent to it. Offline (no room connection) the same
 * simulation code (shared/sim.ts) runs locally so single-player still works. The scene
 * just asks for the current view each frame and reacts to events.
 */
import { DROP_KINDS, GameSim, KIND_NAMES, SHOT_KINDS, STATES, type DropKind, type ShotKind, type SimEvent } from '../../shared/sim.ts';
import { nowSky } from '../../shared/daynight.ts';
import { net, type SimSnapshot } from '../net/multiplayer.ts';
import type { WorldMap } from './mapGen.ts';
import type { ViewDrop } from './drops.ts';
import type { ViewMonster } from './monsters.ts';
import { MAP_TILES } from './constants.ts';


export interface WorldView {
    monsters: ViewMonster[];
    drops: ViewDrop[];
    /** The wave that is still sending in monsters (how many are still to come), or null. */
    run: { wave: number; toSpawn: number } | null;
    wave: number;
    /** Seconds until the next wave (0 while one is on). */
    nextIn: number;
    /** Is a wave on (still arriving, or some of it alive)? */
    fighting: boolean;
    /** The side (tile-space angle, radians) the next or current wave comes from. */
    waveDir: number;
    /** Waves hold while the player reads or talks. */
    calm: boolean;
    /** Waves still to come in this onslaught (0 in the breather). */
    onslaughtLeft: number;
    /** Shots in flight (positions brought up to now). */
    shots: ViewShot[];
    online: boolean;
}

export interface ViewShot {
    id: number;
    kind: ShotKind;
    u: number;
    v: number;
    du: number;
    dv: number;
}

export interface WorldSim {
    update(dtMs: number): void;
    view(): WorldView;
    /** The local player swung from (u, v) facing a 0-7 sector. */
    strike(u: number, v: number, facing: number, damage: number, radius?: number, stunMs?: number): void;
    /** Set items on the ground for anyone to take. */
    loot(u: number, v: number, items: [string, number][]): void;
    /** The local player reached a drop. */
    take(dropId: number): void;
    /** Bring in a boss beside the player (refused if one with that code is alive). */
    summon(code: number, tier: number, u: number, v: number): void;
    /** Debug (offline, ?spawn= only): put one monster of a kind at (u, v). */
    debugSpawn(kind: string, u: number, v: number): void;
    destroy(): void;
}

export function createWorldSim(opts: {
    map: WorldMap;
    player: () => { id: string; u: number; v: number; alive: boolean };
    /** Is this player reading a story page or talking (the waves hold)? */
    calm: () => boolean;
    /** Is this player safe in a camp (monsters lose them; alone there, no wave comes)? */
    safe: () => boolean;
    everySec: number;
    firstSec: number;
    on: {
        bite: (damage: number) => void;
        kill: (kind: string, boss: number) => void;
        /** A drop was taken: a skill gem, or a sword (`sword` is its index). */
        gain: (kind: DropKind, sword: number) => void;
        wave: (n: number) => void;
        /** A wave was cleared: the cooldown begins. */
        cleared: (n: number) => void;
        /** A boss slammed the ground (for the effect; the damage arrives as bites). */
        slam: (u: number, v: number, r: number) => void;
        /** A boss fell somewhere (anyone who fought it nearby may count it). */
        boss: (code: number, u: number, v: number) => void;
    };
    /** Multiplies sword drop chances (1 normally; the ?swordMul= debug option raises it offline). */
    swordMul?: number;
    /** Multiplies the potion drop chance (the ?potionMul= debug option raises it offline). */
    potionMul?: number;
}): WorldSim {
    const { map } = opts;
    const heightAt = (i: number, j: number) => map.height[j * MAP_TILES + i];

    const local = new GameSim(
        {
            players: () => {
                const p = opts.player();
                return p.alive && !opts.safe() ? [{ id: p.id, u: p.u, v: p.v }] : [];
            },
            canMove: (fu, fv, tu, tv) => {
                const ti = Math.floor(tu);
                const tj = Math.floor(tv);
                if (ti < 1 || tj < 1 || ti >= MAP_TILES - 1 || tj >= MAP_TILES - 1) return false;
                if (map.terrain[tj * MAP_TILES + ti] === 4) return false; // WATER
                return Math.abs(heightAt(ti, tj) - heightAt(Math.floor(fu), Math.floor(fv))) <= 1;
            },
            canStand: (u, v) => {
                const i = Math.floor(u);
                const j = Math.floor(v);
                if (i < 4 || j < 4 || i >= MAP_TILES - 4 || j >= MAP_TILES - 4) return false;
                const k = j * MAP_TILES + i;
                if (map.terrain[k] === 4 || map.blocked[k] === 1) return false;
                return Math.abs(heightAt(i, j) - heightAt(i + 1, j)) <= 1 && Math.abs(heightAt(i, j) - heightAt(i, j + 1)) <= 1;
            },
            rand: Math.random,
            night: () => nowSky().dark,
            calm: () => opts.calm(),
        },
        {
            everyMs: opts.everySec * 1000,
            firstMs: opts.firstSec * 1000,
            swordMul: opts.swordMul,
            potionMul: opts.potionMul,
        },
    );
    // Debug (?spawn=): the local simulation, for automated checks.
    if (new URLSearchParams(window.location.search).has('spawn')) (window as unknown as { __sim?: GameSim }).__sim = local;
    let wasOnline = false;
    let cachedSnap: SimSnapshot | null = null;
    let cachedMonsters: ViewMonster[] = [];
    let cachedDrops: ViewDrop[] = [];

    const handle = (events: SimEvent[]) => {
        const me = opts.player().id;
        for (const e of events) {
            if (e.type === 'bite' && e.playerId === me) opts.on.bite(e.damage);
            else if (e.type === 'kill' && e.playerId === me) opts.on.kill(e.kind, e.boss);
            else if (e.type === 'wave') opts.on.wave(e.wave);
            else if (e.type === 'cleared') opts.on.cleared(e.wave);
            else if (e.type === 'slam') opts.on.slam(e.u, e.v, e.r);
            else if (e.type === 'boss') opts.on.boss(e.code, e.u, e.v);
        }
    };

    // Server events (only ever sent while online).
    const offNet = net.onEvent((e) => {
        if (e.type === 'bite') opts.on.bite(e.damage);
        else if (e.type === 'kill') opts.on.kill(e.kind, e.boss ?? 0);
        else if (e.type === 'slam') opts.on.slam(e.u, e.v, e.r);
        else if (e.type === 'boss') opts.on.boss(e.code, e.u, e.v);
        else if (e.type === 'gain') opts.on.gain((DROP_KINDS as readonly string[]).includes(e.skill) ? (e.skill as DropKind) : 'attack', e.sword ?? -1);
        else if (e.type === 'wave') opts.on.wave(e.wave);
        else if (e.type === 'cleared') opts.on.cleared(e.wave);
    });

    return {
        update(dtMs) {
            const online = net.online();
            if (online !== wasOnline) {
                // Switching between the server's world and the local one: start the local one fresh.
                local.clear();
                if (!online) {
                    const s = net.snap();
                    if (s) local.wave = s.w;
                }
                wasOnline = online;
            }
            if (!online) {
                handle(local.update(dtMs));
            }
        },

        view() {
            if (net.online()) {
                const s = net.snap();
                if (!s) return { monsters: [], drops: [], run: null, wave: 0, nextIn: 0, fighting: false, waveDir: 0, calm: false, onslaughtLeft: 0, shots: [], online: true };
                if (s !== cachedSnap) {
                    cachedSnap = s;
                    cachedMonsters = s.m.map((m) => ({
                        id: m[0], kind: KIND_NAMES[m[1]] ?? 'goblin', u: m[2], v: m[3], hp: m[4], max: m[5],
                        state: STATES[m[6]] ?? 'chase', t: m[7], tier: m[8] ?? 0, boss: m[9] ?? 0,
                    }));
                    cachedDrops = s.d.map((d) => ({ id: d[0], skill: DROP_KINDS[d[1]] ?? 'attack', sword: d[5] ?? -1, u: d[2], v: d[3], age: d[4] }));
                }
                const p = s.p;
                return {
                    monsters: cachedMonsters,
                    drops: cachedDrops,
                    run: p ? { wave: p[0], toSpawn: p[2] } : null,
                    wave: s.w,
                    nextIn: s.nx,
                    fighting: s.f === 1,
                    waveDir: (s.wd ?? 0) / 100,
                    calm: s.c === 1,
                    onslaughtLeft: s.ol ?? 0,
                    // Shots fly straight: carry them forward from when the snapshot came.
                    shots: (s.s ?? []).map((x) => {
                        const age = Math.min(0.3, (performance.now() - s.at) / 1000);
                        return { id: x[0], kind: SHOT_KINDS[x[1]] ?? 'bolt', u: x[2] + x[4] * age, v: x[3] + x[5] * age, du: x[4], dv: x[5] };
                    }),
                    online: true,
                };
            }
            const p = local.runs.length > 0 ? { wave: local.runs[local.runs.length - 1].wave, toSpawn: local.runs.reduce((n, r) => n + r.toSpawn, 0) } : null;
            return {
                monsters: [...local.monsters.values()].map((m) => ({ id: m.id, kind: m.kind, u: m.u, v: m.v, hp: m.hp, max: m.max, state: m.state, t: m.t, tier: m.tier, boss: m.boss })),
                drops: [...local.drops.values()].map((d) => ({ id: d.id, skill: d.skill, sword: d.sword, u: d.u, v: d.v, age: d.age })),
                run: p ? { wave: p.wave, toSpawn: p.toSpawn } : null,
                wave: local.wave,
                nextIn: local.phase === 'clearing' || local.runs.length > 0 ? 0 : Math.max(0, Math.ceil(local.clock / 1000)),
                fighting: local.fighting,
                waveDir: local.dir,
                calm: local.calm,
                onslaughtLeft: local.phase === 'onslaught' ? local.left : 0,
                shots: [...local.shots.values()].map((sh) => ({ id: sh.id, kind: sh.kind, u: sh.u, v: sh.v, du: sh.du, dv: sh.dv })),
                online: false,
            };
        },

        strike(u, v, facing, damage, radius = 0, stunMs = 0) {
            if (net.online()) net.sendHit(u, v, facing, damage, radius, stunMs);
            else handle(local.strike(opts.player().id, u, v, facing, damage, radius, stunMs));
        },

        loot(u, v, items) {
            if (net.online()) net.sendLoot(u, v, items);
            else for (const [id, n] of items) local.addLoot(id, n, u, v);
        },

        take(dropId) {
            if (net.online()) {
                net.sendPickup(dropId);
                return;
            }
            const p = opts.player();
            const got = local.pickup(dropId, p.u, p.v);
            if (got) opts.on.gain(got.skill, got.sword);
        },

        summon(code, tier, u, v) {
            if (net.online()) net.sendSummon(code, tier, u, v);
            else local.summon(code, tier, u, v);
        },

        debugSpawn(kind, u, v) {
            if (!net.online()) local.spawn(kind, u, v, { hpMul: 1, speedMul: 1, damage: 1 });
        },

        destroy() {
            offNet();
        },
    };
}
