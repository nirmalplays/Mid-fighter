/**
 * Where the world's monsters, portal and drops come from. Online, the server's shared
 * simulation (src/rooms/WorldRoom.ts) is the only source: every player sees the same
 * enemies, and swings and pickups are sent to it. Offline (no room connection) the same
 * simulation code (shared/sim.ts) runs locally so single-player still works. The scene
 * just asks for the current view each frame and reacts to events.
 */
import { GameSim, KIND_NAMES, SKILLS, STATES, type Skill, type SimEvent } from '../../shared/sim.ts';
import { net, type SimSnapshot } from '../net/multiplayer.ts';
import type { WorldMap } from './mapGen.ts';
import type { ViewDrop } from './drops.ts';
import type { ViewMonster } from './monsters.ts';
import type { ViewPortal } from './waves.ts';

const MAP_TILES = 256;

/** The workshop portal / safe zone while it is open. */
export interface ViewSafe {
    u: number;
    v: number;
    /** Ms since it opened, and how long it stays open. */
    age: number;
    lasts: number;
}

export interface WorldView {
    monsters: ViewMonster[];
    drops: ViewDrop[];
    portal: ViewPortal | null;
    safe: ViewSafe | null;
    wave: number;
    /** Seconds until the next portal (0 while one is open). */
    nextIn: number;
    online: boolean;
}

export interface WorldSim {
    update(dtMs: number): void;
    view(): WorldView;
    /** The local player swung from (u, v) facing a 0-7 sector. */
    strike(u: number, v: number, facing: number, damage: number): void;
    /** The local player reached a drop. */
    take(dropId: number): void;
    destroy(): void;
}

/** The offline wave counter and timer survive the scene being rebuilt (world → workshop → world). */
const persist = { wave: 0, clock: -1, safeClock: -1 };

export function createWorldSim(opts: {
    map: WorldMap;
    player: () => { id: string; u: number; v: number; alive: boolean };
    everySec: number;
    firstSec: number;
    on: {
        bite: (damage: number) => void;
        kill: (kind: string) => void;
        gain: (skill: Skill) => void;
        wave: (n: number, u: number, v: number) => void;
        safe: () => void;
    };
    safeEverySec: number;
    safeForSec: number;
    safeFirstSec: number;
}): WorldSim {
    const { map } = opts;
    const heightAt = (i: number, j: number) => map.height[j * MAP_TILES + i];

    const local = new GameSim(
        {
            players: () => {
                const p = opts.player();
                return p.alive ? [{ id: p.id, u: p.u, v: p.v }] : [];
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
        },
        {
            everyMs: opts.everySec * 1000,
            firstMs: opts.firstSec * 1000,
            safeEveryMs: opts.safeEverySec * 1000,
            safeForMs: opts.safeForSec * 1000,
            safeFirstMs: opts.safeFirstSec * 1000,
        },
    );
    if (persist.clock >= 0) {
        local.wave = persist.wave;
        local.clock = persist.clock;
        local.safeClock = persist.safeClock;
    }

    let wasOnline = false;
    let cachedSnap: SimSnapshot | null = null;
    let cachedMonsters: ViewMonster[] = [];
    let cachedDrops: ViewDrop[] = [];

    const handle = (events: SimEvent[]) => {
        const me = opts.player().id;
        for (const e of events) {
            if (e.type === 'bite' && e.playerId === me) opts.on.bite(e.damage);
            else if (e.type === 'kill' && e.playerId === me) opts.on.kill(e.kind);
            else if (e.type === 'wave') opts.on.wave(e.wave, e.u, e.v);
            else if (e.type === 'safe') opts.on.safe();
        }
    };

    // Server events (only ever sent while online).
    const offNet = net.onEvent((e) => {
        if (e.type === 'bite') opts.on.bite(e.damage);
        else if (e.type === 'kill') opts.on.kill(e.kind);
        else if (e.type === 'gain') opts.on.gain((SKILLS as readonly string[]).includes(e.skill) ? (e.skill as Skill) : 'attack');
        else if (e.type === 'wave') opts.on.wave(e.wave, e.u, e.v);
        else opts.on.safe();
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
                persist.wave = local.wave;
                persist.clock = local.clock;
                persist.safeClock = local.safeClock;
            }
        },

        view() {
            if (net.online()) {
                const s = net.snap();
                if (!s) return { monsters: [], drops: [], portal: null, safe: null, wave: 0, nextIn: 0, online: true };
                if (s !== cachedSnap) {
                    cachedSnap = s;
                    cachedMonsters = s.m.map((m) => ({
                        id: m[0], kind: KIND_NAMES[m[1]] ?? 'goblin', u: m[2], v: m[3], hp: m[4], max: m[5],
                        state: STATES[m[6]] ?? 'chase', t: m[7],
                    }));
                    cachedDrops = s.d.map((d) => ({ id: d[0], skill: SKILLS[d[1]] ?? 'attack', u: d[2], v: d[3], age: d[4] }));
                }
                const p = s.p;
                const sf = s.s;
                const since = performance.now() - s.at;
                return {
                    safe: sf ? { u: sf[0], v: sf[1], age: sf[2] + since, lasts: sf[3] } : null,
                    monsters: cachedMonsters,
                    drops: cachedDrops,
                    portal: p ? { u: p[0], v: p[1], wave: p[2], age: p[3] + since, doneAt: p[4] } : null,
                    wave: s.w,
                    nextIn: s.nx,
                    online: true,
                };
            }
            const p = local.portal;
            return {
                monsters: [...local.monsters.values()].map((m) => ({ id: m.id, kind: m.kind, u: m.u, v: m.v, hp: m.hp, max: m.max, state: m.state, t: m.t })),
                drops: [...local.drops.values()].map((d) => ({ id: d.id, skill: d.skill, u: d.u, v: d.v, age: d.age })),
                portal: p ? { u: p.u, v: p.v, wave: p.wave, age: p.age, doneAt: p.doneAt === null ? -1 : p.doneAt } : null,
                safe: local.safe ? { u: local.safe.u, v: local.safe.v, age: local.safe.age, lasts: local.safe.lasts } : null,
                wave: local.wave,
                nextIn: p ? 0 : Math.max(0, Math.ceil(local.clock / 1000)),
                online: false,
            };
        },

        strike(u, v, facing, damage) {
            if (net.online()) net.sendHit(u, v, facing, damage);
            else handle(local.strike(opts.player().id, u, v, facing, damage));
        },

        take(dropId) {
            if (net.online()) {
                net.sendPickup(dropId);
                return;
            }
            const p = opts.player();
            const skill = local.pickup(dropId, p.u, p.v);
            if (skill) opts.on.gain(skill);
        },

        destroy() {
            offNet();
        },
    };
}
