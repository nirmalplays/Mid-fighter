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
    dead?: boolean;
}

/** The server's combat snapshot (see shared/sim.ts GameSim.snapshot) and when it arrived. */
export interface SimSnapshot {
    m: number[][];
    d: number[][];
    /** The running wave: [wave, age ms, monsters still to come], or null between waves. */
    p: number[] | null;
    /** The safe (workshop) portal: [u, v, age ms, lasts ms], or null. */
    s: number[] | null;
    w: number;
    nx: number;
    /** performance.now() at arrival. */
    at: number;
}

/** Combat events the server sends to this player. */
export type NetEvent =
    | { type: 'bite'; damage: number }
    | { type: 'kill'; kind: string }
    | { type: 'gain'; skill: string; id: number }
    | { type: 'wave'; wave: number }
    | { type: 'safe'; u: number; v: number };

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
const listeners = new Set<(e: NetEvent) => void>();
let snap: SimSnapshot | null = null;
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
            const players = msg.players as Record<string, { name: string; pose: RemotePose | null }>;
            for (const [id, p] of Object.entries(players)) {
                const r = ensure(id);
                r.name = p.name;
                r.pose = p.pose;
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
        case 'sim':
            snap = { m: msg.m as number[][], d: msg.d as number[][], p: msg.p as number[] | null, s: msg.s as number[] | null, w: msg.w as number, nx: msg.nx as number, at: performance.now() };
            break;
        case 'bite':
        case 'kill':
        case 'gain':
        case 'wave':
        case 'safe':
            for (const l of listeners) l(msg as unknown as NetEvent);
            break;
    }
}

/** How to enter an online room. */
export type JoinRequest =
    | { kind: 'public' }
    | { kind: 'create' }
    | { kind: 'join'; code: string };

export interface JoinResult {
    ok: boolean;
    /** The room's shareable 6-character code, when joined. */
    code?: string;
    error?: string;
}

/** Why a join failed, in words for the player. */
function describe(err: unknown, req: JoinRequest): string {
    const text = err instanceof Error ? err.message : String(err);
    if (req.kind === 'join' && /not found|no such|invalid|unknown|does not exist/i.test(text)) return 'No room with that code.';
    if (/full/i.test(text)) return 'That room is full.';
    if (/denied|anonymous|sign/i.test(text)) return 'Sign in to RUN to play online.';
    return 'Could not connect. Check your connection and try again.';
}

/**
 * Join an online room: the public Quick Play room, a new private room (share its code), or a
 * room by code. Leaves the current room first. Resolves with the room code on success.
 */
async function connect(req: JoinRequest): Promise<JoinResult> {
    if (connecting) await connecting;
    leave();
    publish('connecting');
    let result: JoinResult = { ok: false };
    connecting = (async () => {
        try {
            const api = RundotGameAPI.realtime;
            const r =
                req.kind === 'join'
                    ? await api.joinRoomByCode<Msg>(req.code.trim().toUpperCase())
                    : req.kind === 'create'
                        ? await api.createRoom<Msg>('world', { createOptions: { isPrivate: true, maxPlayers: 8 } })
                        : await api.joinOrCreateRoom<Msg>('world', { criteria: { kind: 'public' }, createOptions: { maxPlayers: 16 } });
            r.on({
                onMessage: handle,
                // sendTo() replies (the snapshot) arrive here, not in onMessage.
                onPrivateMessage: handle,
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
                    if (room !== r) return; // we left on purpose
                    room = null;
                    snap = null;
                    remotes.clear();
                    store.patch({ roomCode: null });
                    publish('off');
                },
                onError: (err) => console.warn('[multiplayer]', err),
            });
            room = r;
            store.patch({ roomCode: r.roomCode || null });
            publish('online');
            // The join-time snapshot can arrive before the handlers above exist; ask again.
            r.send({ type: 'hello' });
            result = { ok: true, code: r.roomCode };
        } catch (err) {
            console.warn('[multiplayer] could not join', err);
            publish('off');
            result = { ok: false, error: describe(err, req) };
        } finally {
            connecting = null;
        }
    })();
    await connecting;
    return result;
}

/** Leave the current room (back to single player). */
function leave(): void {
    const r = room;
    room = null;
    snap = null;
    remotes.clear();
    lastKey = '';
    store.patch({ roomCode: null });
    publish('off');
    try {
        r?.leave();
    } catch {
        /* already closed */
    }
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

/** Propose a swing from (u, v); the server decides who it hits. */
function sendHit(u: number, v: number, facing: number, damage: number): void {
    try {
        room?.send({ type: 'hit', u, v, facing, damage });
    } catch (err) {
        console.warn('[multiplayer] send failed', err);
    }
}

/** Ask to take a drop; the server answers with a 'gain' event if it is ours. */
function sendPickup(id: number): void {
    try {
        room?.send({ type: 'pickup', id });
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

export const net = {
    remotes, connect, leave, sendPose, sendAct, sendAway, sendHit, sendPickup,
    /**
     * True while the server is running the monsters: the room is connected and its combat
     * snapshots are arriving (it sends at least one a second). A room that connects but never
     * sends one (a mock, or a server without the simulation) leaves the game on its local copy.
     */
    online: (): boolean => room !== null && snap !== null && performance.now() - snap.at < 4000,
    /** The latest combat snapshot from the server, or null. */
    snap: (): SimSnapshot | null => snap,
    /** Subscribe to combat events from the server. Returns unsubscribe. */
    onEvent(l: (e: NetEvent) => void): () => void {
        listeners.add(l);
        return () => listeners.delete(l);
    },
};

// Debug: with ?spawn= the link is exposed for automated checks.
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('spawn')) {
    (window as unknown as { __net?: typeof net }).__net = net;
}
