/**
 * Link to the shared world room (src/rooms/WorldRoom.ts). One connection lives for
 * the whole session and is shared by the world and the workshop scenes. It keeps a
 * map of the other players' latest poses for remotePlayers.ts to draw, and sends
 * ours at a modest rate. Nothing here may break single-player: a failed connection
 * just leaves the game offline.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { store } from '../../state/store.ts';

export interface RemotePose {
    scene: 'world' | 'base';
    u: number;
    v: number;
    z: number;
    face: number;
    anim: string;
    tool: string;
}

export interface Remote {
    id: string;
    name: string;
    /** Latest pose, or null while they are in the menu / have left the scene. */
    pose: RemotePose | null;
    /** Action commands received since the avatar last looked (attack, sit, ...). */
    acts: string[];
}

type Msg = { type: string } & Record<string, unknown>;
type Room = Awaited<ReturnType<typeof RundotGameAPI.realtime.joinOrCreateRoom<Msg>>>;

const remotes = new Map<string, Remote>();
let room: Room | null = null;
let connecting: Promise<void> | null = null;
let lastSent = 0;
let lastKey = '';

const ensure = (id: string): Remote => {
    let r = remotes.get(id);
    if (!r) remotes.set(id, (r = { id, name: 'Player', pose: null, acts: [] }));
    return r;
};
const publish = (status: 'off' | 'connecting' | 'online') =>
    store.patch({ netStatus: status, online: status === 'online' ? remotes.size + 1 : 0 });

function handle(msg: Msg): void {
    switch (msg.type) {
        case 'snapshot': {
            const players = msg.players as Record<string, RemotePose & { name: string }>;
            for (const [id, p] of Object.entries(players)) {
                const r = ensure(id);
                r.name = p.name;
                r.pose = { scene: p.scene, u: p.u, v: p.v, z: p.z, face: p.face, anim: p.anim, tool: p.tool };
            }
            publish('online');
            break;
        }
        case 'pose': {
            const id = msg.id as string;
            if (id === room?.playerId) return;
            ensure(id).pose = { scene: msg.scene as 'world' | 'base', u: msg.u as number, v: msg.v as number, z: msg.z as number, face: msg.face as number, anim: msg.anim as string, tool: msg.tool as string };
            break;
        }
        case 'act': {
            const id = msg.id as string;
            if (id === room?.playerId) return;
            const r = ensure(id);
            r.acts.push(msg.kind as string);
            if (r.acts.length > 8) r.acts.shift();
            break;
        }
        case 'away': {
            const r = remotes.get(msg.id as string);
            if (r) r.pose = null;
            break;
        }
    }
}

/** Join the shared room (once). Safe to call from every scene. */
function connect(): Promise<void> {
    if (room || connecting) return connecting ?? Promise.resolve();
    publish('connecting');
    connecting = (async () => {
        try {
            const r = await RundotGameAPI.realtime.joinOrCreateRoom<Msg>('world');
            r.on({
                onMessage: handle,
                onPlayerJoined: (p) => {
                    if (p.id === r.playerId) return;
                    ensure(p.id).name = p.username;
                    publish('online');
                },
                onPlayerLeft: (id) => {
                    remotes.delete(id);
                    publish('online');
                },
                onReconnecting: () => publish('connecting'),
                onReconnected: () => publish('online'),
                onDisconnect: () => {
                    room = null;
                    remotes.clear();
                    publish('off');
                },
                onError: (err) => console.warn('[multiplayer]', err),
            });
            room = r;
            publish('online');
        } catch (err) {
            console.warn('[multiplayer] unavailable', err);
            publish('off');
        } finally {
            connecting = null;
        }
    })();
    return connecting;
}

/** Send our pose, at most ~10 times a second, and only when it changed (plus a once-a-second heartbeat). */
function sendPose(p: RemotePose): void {
    if (!room) return;
    const now = performance.now();
    if (now - lastSent < 100) return;
    const key = `${p.scene}|${p.u.toFixed(2)}|${p.v.toFixed(2)}|${Math.round(p.z)}|${p.face}|${p.anim}|${p.tool}`;
    if (key === lastKey && now - lastSent < 1000) return;
    lastSent = now;
    lastKey = key;
    try {
        room.send({ type: 'pose', ...p });
    } catch (err) {
        console.warn('[multiplayer] send failed', err);
    }
}

function sendAct(kind: string): void {
    try {
        room?.send({ type: 'act', kind });
    } catch (err) {
        console.warn('[multiplayer] send failed', err);
    }
}

/** Tell the others we left the scene (so they stop drawing us). */
function sendAway(): void {
    lastKey = '';
    try {
        room?.send({ type: 'away' });
    } catch {
        /* the room may already be closing */
    }
}

export const net = { remotes, connect, sendPose, sendAct, sendAway };
