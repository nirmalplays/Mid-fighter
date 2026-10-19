/**
 * The shared world: one room everybody who opens the game joins (singleton).
 * Each player's client owns its own movement; the server only relays poses and
 * actions to everyone else, after validating them: coordinates are clamped to the
 * scene's bounds, a pose can't move farther than a player could walk since their
 * last one (so nobody teleports), and names, tools and actions are checked
 * against fixed lists. Joining players get a snapshot of who is where.
 */
import { GameRoom, type GameMessage, type LeaveReason, type Player } from '@series-inc/rundot-game-sdk/mp-server';

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
}

// Client → server.
interface PoseMsg extends Pose { type: 'pose' }
interface ActMsg { type: 'act'; kind: string }
interface AwayMsg { type: 'away' }
interface HelloMsg { type: 'hello' }
// Server → client.
interface SnapshotMsg { type: 'snapshot'; players: Record<string, { name: string; pose: Pose | null }> }
interface PoseOut extends Pose { type: 'pose'; id: string }
interface ActOut { type: 'act'; id: string; kind: string }
interface AwayOut { type: 'away'; id: string }
type Protocol = PoseMsg | ActMsg | AwayMsg | HelloMsg | SnapshotMsg | PoseOut | ActOut | AwayOut;

const MAP_TILES = 256;
const ROOM_TILES = 8;
const BOUNDS: Record<Scene, number> = { world: MAP_TILES, base: ROOM_TILES };
/** Tiles per second a client may move (they walk ~4; allow slack for lag bursts). */
const MAX_SPEED = 9;
const MIN_POSE_GAP_MS = 40;
const ANIMS = new Set(['idle', 'walk', 'run']);
const TOOLS = new Set(['none', 'sword', 'axe', 'pickaxe', 'hammer', 'shovel', 'fishingpole', 'watercan', 'shield', 'hold']);
const ACTS = new Set(['attack', 'use', 'interact', 'dig', 'fish', 'sit', 'hurt', 'die']);

interface Tracked extends Pose {
    at: number;
}

export default class WorldRoom extends GameRoom<Protocol> {
    private poses = new Map<string, Tracked>();

    onPlayerJoin(player: Player): void {
        this.sendSnapshot(player.id);
    }

    /** Who is here and where, for one player (on join, and again when their client asks). */
    private sendSnapshot(playerId: string): void {
        const player = { id: playerId };
        const players: SnapshotMsg['players'] = {};
        // Everyone already here, even those who have not moved yet (so counts are right).
        for (const [id, other] of this.players) {
            if (id === player.id) continue;
            const pose = this.poses.get(id);
            players[id] = {
                name: other.username,
                pose: pose ? { scene: pose.scene, u: pose.u, v: pose.v, z: pose.z, face: pose.face, anim: pose.anim, tool: pose.tool } : null,
            };
        }
        this.sendTo(player.id, { type: 'snapshot', players });
    }

    onGameMessage(message: GameMessage<Protocol>): void {
        const { sender, payload } = message;
        switch (payload.type) {
            case 'pose': {
                const pose = this.validate(sender.id, payload);
                if (!pose) return;
                this.broadcast({ type: 'pose', id: sender.id, scene: pose.scene, u: pose.u, v: pose.v, z: pose.z, face: pose.face, anim: pose.anim, tool: pose.tool });
                break;
            }
            case 'act':
                if (ACTS.has(payload.kind)) this.broadcast({ type: 'act', id: sender.id, kind: payload.kind });
                break;
            case 'hello':
                // The client registers its handlers after joining, so it asks again for the snapshot.
                this.sendSnapshot(sender.id);
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
        this.broadcast({ type: 'away', id: player.id });
    }

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
            face: Math.min(7, Math.max(0, Math.round(face))), anim: m.anim, tool: m.tool, at: now,
        };
        this.poses.set(id, clean);
        return clean;
    }
}
