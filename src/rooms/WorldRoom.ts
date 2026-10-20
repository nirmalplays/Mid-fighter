/**
 * The shared world: one room everybody who opens the game joins (singleton).
 *
 * Players: each client owns its own movement; the server relays poses and actions to
 * everyone else after validating them (coordinates clamped, no teleporting, names,
 * tools and actions checked against fixed lists).
 *
 * Combat: the server owns the monsters, the waves and the drops (src/shared/sim.ts),
 * so every player sees the same enemies. It simulates 10 times a second and broadcasts a
 * compact snapshot. Clients propose swings ('hit') and pickups; the server decides who
 * is hit, who gets which gem, and tells each player when a monster bit them.
 */
import { GameRoom, type GameMessage, type LeaveReason, type Player } from '@series-inc/rundot-game-sdk/mp-server';
import { generateWorld, WATER, type WorldMap } from '../game/world/mapGen.ts';
import { DROP_KINDS, GameSim, type SimEvent } from '../shared/sim.ts';

type Scene = 'world' | 'base';

/** Where a player is and what they are doing, as clients report it. */
interface Pose {
    scene: Scene;
    /** Grid position in the scene's tile space. */
    u: number;
    v: number;
    /** Screen px the player is lifted by terrain. */
    z: number;
    /** Facing sector 0-7 (see world/character.ts). */
    face: number;
    anim: string;
    tool: string;
    dead: boolean;
    /** Sword held, 0-29, or -1 for the original iron sword. */
    sword: number;
}

// Client → server.
interface PoseMsg extends Pose { type: 'pose' }
interface ActMsg { type: 'act'; kind: string }
interface AwayMsg { type: 'away' }
interface HelloMsg { type: 'hello' }
interface HitMsg { type: 'hit'; u: number; v: number; facing: number; damage: number; r?: number }
interface PickupMsg { type: 'pickup'; id: number }
// Server → client.
interface SnapshotMsg { type: 'snapshot'; players: Record<string, { name: string; pose: Pose | null }> }
interface PoseOut extends Pose { type: 'pose'; id: string }
interface ActOut { type: 'act'; id: string; kind: string }
interface AwayOut { type: 'away'; id: string }
interface SimOut { type: 'sim'; m: number[][]; d: number[][]; p: number[] | null; s: number[] | null; w: number; nx: number }
interface BiteOut { type: 'bite'; damage: number }
interface KillOut { type: 'kill'; kind: string }
interface GainOut { type: 'gain'; skill: string; id: number; sword: number }
interface WaveOut { type: 'wave'; wave: number }
interface SafeOut { type: 'safe'; u: number; v: number }
type Protocol = PoseMsg | ActMsg | AwayMsg | HelloMsg | HitMsg | PickupMsg | SnapshotMsg | PoseOut | ActOut | AwayOut | SimOut | BiteOut | KillOut | GainOut | WaveOut | SafeOut;

const MAP_TILES = 256;
const ROOM_TILES = 8;
const BOUNDS: Record<Scene, number> = { world: MAP_TILES, base: ROOM_TILES };
/** Tiles per second a client may move (they walk ~4; allow slack for lag bursts). */
const MAX_SPEED = 9;
const MIN_POSE_GAP_MS = 40;
const ANIMS = new Set(['idle', 'walk', 'run']);
const TOOLS = new Set(['none', 'sword', 'axe', 'pickaxe', 'hammer', 'shovel', 'fishingpole', 'watercan', 'shield', 'hold']);
const ACTS = new Set(['attack', 'use', 'interact', 'dig', 'fish', 'sit', 'hurt', 'die']);
const SIM_MS = 100;
/** The most one swing may do (an Attack-10 hammer does 3 × 2.5 ≈ 8), and the least time between swings. */
const MAX_HIT_DAMAGE = 14;
const MIN_HIT_GAP_MS = 140;

interface Tracked extends Pose {
    at: number;
}

export default class WorldRoom extends GameRoom<Protocol> {
    private poses = new Map<string, Tracked>();
    private lastHit = new Map<string, number>();
    private map: WorldMap | null = null;
    private sim: GameSim | null = null;
    private lastTick = 0;
    private quietFor = 0;

    onCreate(): void {
        const map = generateWorld();
        this.map = map;
        const blocked = map.blocked;
        const heightAt = (i: number, j: number) => map.height[j * MAP_TILES + i];
        const meta = (this.config.metadata ?? {}) as { waveEverySec?: number; firstWaveSec?: number; safeEverySec?: number; swordMul?: number; potionMul?: number; safeForSec?: number; safeFirstSec?: number };
        this.sim = new GameSim(
            {
                players: () => {
                    const out: { id: string; u: number; v: number }[] = [];
                    for (const [id, p] of this.poses) {
                        if (p.scene === 'world' && !p.dead && this.players.get(id)?.connected) out.push({ id, u: p.u, v: p.v });
                    }
                    return out;
                },
                // Enemies push through plants; water, the map edge and cliffs stop them.
                canMove: (fu, fv, tu, tv) => {
                    const ti = Math.floor(tu);
                    const tj = Math.floor(tv);
                    if (ti < 1 || tj < 1 || ti >= MAP_TILES - 1 || tj >= MAP_TILES - 1) return false;
                    if (map.terrain[tj * MAP_TILES + ti] === WATER) return false;
                    return Math.abs(heightAt(ti, tj) - heightAt(Math.floor(fu), Math.floor(fv))) <= 1;
                },
                canStand: (u, v) => {
                    const i = Math.floor(u);
                    const j = Math.floor(v);
                    if (i < 4 || j < 4 || i >= MAP_TILES - 4 || j >= MAP_TILES - 4) return false;
                    const k = j * MAP_TILES + i;
                    if (map.terrain[k] === WATER || blocked[k] === 1) return false;
                    return Math.abs(heightAt(i, j) - heightAt(i + 1, j)) <= 1 && Math.abs(heightAt(i, j) - heightAt(i, j + 1)) <= 1;
                },
                // Open ground: nothing solid within one tile, and at most two solid cells within two.
                isOpen: (u, v) => {
                    const i = Math.floor(u);
                    const j = Math.floor(v);
                    let solid = 0;
                    for (let dj = -2; dj <= 2; dj++) {
                        for (let di = -2; di <= 2; di++) {
                            const k = (j + dj) * MAP_TILES + (i + di);
                            if (map.terrain[k] === WATER) return false;
                            if (blocked[k] === 1) {
                                if (Math.abs(di) <= 1 && Math.abs(dj) <= 1) return false;
                                solid++;
                            }
                        }
                    }
                    return solid <= 2;
                },
                rand: Math.random,
            },
            {
                everyMs: (meta.waveEverySec ?? 120) * 1000,
                firstMs: (meta.firstWaveSec ?? 20) * 1000,
                swordMul: meta.swordMul ?? 1,
                potionMul: meta.potionMul ?? 1,
                safeEveryMs: (meta.safeEverySec ?? 120) * 1000,
                safeForMs: (meta.safeForSec ?? 20) * 1000,
                safeFirstMs: (meta.safeFirstSec ?? 45) * 1000,
            },
        );
        this.lastTick = Date.now();
        this.clock.setInterval('sim', () => this.tick(), SIM_MS);
    }

    onPlayerJoin(player: Player): void {
        this.sendSnapshot(player.id);
    }

    /** Who is here and where, for one player (on join, and again when their client asks). */
    private sendSnapshot(playerId: string): void {
        const players: SnapshotMsg['players'] = {};
        // Everyone already here, even those who have not moved yet (so counts are right).
        for (const [id, other] of this.players) {
            if (id === playerId) continue;
            const pose = this.poses.get(id);
            players[id] = {
                name: other.username,
                pose: pose ? { scene: pose.scene, u: pose.u, v: pose.v, z: pose.z, face: pose.face, anim: pose.anim, tool: pose.tool, dead: pose.dead, sword: pose.sword } : null,
            };
        }
        this.sendTo(playerId, { type: 'snapshot', players });
    }

    onGameMessage(message: GameMessage<Protocol>): void {
        const { sender, payload } = message;
        switch (payload.type) {
            case 'pose': {
                const pose = this.validate(sender.id, payload);
                if (!pose) return;
                this.broadcast({ type: 'pose', id: sender.id, scene: pose.scene, u: pose.u, v: pose.v, z: pose.z, face: pose.face, anim: pose.anim, tool: pose.tool, dead: pose.dead, sword: pose.sword });
                break;
            }
            case 'act':
                if (ACTS.has(payload.kind)) this.broadcast({ type: 'act', id: sender.id, kind: payload.kind });
                break;
            case 'hello':
                // The client registers its handlers after joining, so it asks again for the snapshot.
                this.sendSnapshot(sender.id);
                break;
            case 'hit':
                this.onHit(sender.id, payload);
                break;
            case 'pickup':
                this.onPickup(sender.id, payload.id);
                break;
            case 'away':
                this.poses.delete(sender.id);
                this.broadcast({ type: 'away', id: sender.id });
                break;
            default:
                break; // server → client types are never accepted from a client
        }
    }

    onPlayerLeave(player: Player, _reason: LeaveReason): void {
        this.poses.delete(player.id);
        this.lastHit.delete(player.id);
        this.broadcast({ type: 'away', id: player.id });
    }

    // ---- combat ----

    private tick(): void {
        const sim = this.sim;
        if (!sim) return;
        const now = Date.now();
        const dt = now - this.lastTick;
        this.lastTick = now;
        this.dispatch(sim.update(dt));
        // Send every tick while there is something moving; once a second otherwise (the wave countdown).
        const busy = sim.monsters.size > 0 || sim.drops.size > 0 || sim.run !== null || sim.safe !== null;
        this.quietFor += dt;
        if (busy || this.quietFor >= 1000) {
            this.quietFor = 0;
            this.broadcast({ type: 'sim', ...sim.snapshot() });
        }
    }

    private dispatch(events: SimEvent[]): void {
        for (const e of events) {
            if (e.type === 'bite') this.sendTo(e.playerId, { type: 'bite', damage: e.damage });
            else if (e.type === 'kill') this.sendTo(e.playerId, { type: 'kill', kind: e.kind });
            else if (e.type === 'wave') this.broadcast({ type: 'wave', wave: e.wave });
            else this.broadcast({ type: 'safe', u: e.u, v: e.v });
        }
    }

    private onHit(id: string, m: HitMsg): void {
        const sim = this.sim;
        const pose = this.poses.get(id);
        if (!sim || !pose || pose.scene !== 'world' || pose.dead) return;
        const now = Date.now();
        if (now - (this.lastHit.get(id) ?? 0) < MIN_HIT_GAP_MS) return;
        this.lastHit.set(id, now);
        const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
        const damage = num(m.damage);
        const facing = num(m.facing);
        if (damage === null || facing === null) return;
        // Swing from where the client says it stood, if that is near its last reported pose.
        let u = num(m.u) ?? pose.u;
        let v = num(m.v) ?? pose.v;
        // A spell blast (`r`, tiles) may be centred on a monster up to 10 tiles off (the Bolt); a swing only near the player.
        const radius = Math.min(5, Math.max(0, num(m.r) ?? 0));
        if (Math.hypot(u - pose.u, v - pose.v) > (radius ? 10 : 4)) { u = pose.u; v = pose.v; }
        this.dispatch(sim.strike(id, u, v, Math.round(facing), Math.min(MAX_HIT_DAMAGE, Math.max(1, damage)), radius));
    }

    private onPickup(id: string, dropId: number): void {
        const sim = this.sim;
        const pose = this.poses.get(id);
        if (!sim || !pose || pose.scene !== 'world' || pose.dead || typeof dropId !== 'number') return;
        const got = sim.pickup(dropId, pose.u, pose.v);
        if (got) this.sendTo(id, { type: 'gain', skill: DROP_KINDS.includes(got.skill) ? got.skill : 'attack', id: dropId, sword: got.sword });
    }

    // ---- poses ----

    /** A cleaned pose to relay, or null to drop the message. */
    private validate(id: string, m: PoseMsg): Tracked | null {
        const scene: Scene | null = m.scene === 'world' || m.scene === 'base' ? m.scene : null;
        if (!scene) return null;
        const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
        const u = num(m.u), v = num(m.v), z = num(m.z), face = num(m.face);
        if (u === null || v === null || z === null || face === null) return null;
        if (!ANIMS.has(m.anim) || !TOOLS.has(m.tool)) return null;

        const now = Date.now();
        const prev = this.poses.get(id);
        if (prev && now - prev.at < MIN_POSE_GAP_MS) return null;

        const max = BOUNDS[scene] - 0.01;
        let nu = Math.min(max, Math.max(0, u));
        let nv = Math.min(max, Math.max(0, v));
        // No teleporting: cap the step to what walking could cover since the last pose.
        if (prev && prev.scene === scene) {
            const allowed = MAX_SPEED * Math.max(0.1, (now - prev.at) / 1000);
            const dist = Math.hypot(nu - prev.u, nv - prev.v);
            if (dist > allowed) {
                nu = prev.u + ((nu - prev.u) * allowed) / dist;
                nv = prev.v + ((nv - prev.v) * allowed) / dist;
            }
        }
        const clean: Tracked = {
            scene, u: nu, v: nv, z: Math.min(400, Math.max(0, z)),
            face: Math.min(7, Math.max(0, Math.round(face))), anim: m.anim, tool: m.tool, dead: m.dead === true,
            sword: typeof m.sword === 'number' && Number.isInteger(m.sword) && m.sword >= -1 && m.sword < 30 ? m.sword : -1, at: now,
        };
        this.poses.set(id, clean);
        return clean;
    }
}
