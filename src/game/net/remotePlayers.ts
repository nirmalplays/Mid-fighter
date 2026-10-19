/**
 * Draws the other players in the current scene. Each remote player gets its own
 * Character (the same sprites and animation state machine as the local one), fed
 * from the poses and actions the room relays: positions are eased toward the
 * latest pose, facing and tool are set directly, and actions replay as commands.
 */
import { Container, Text } from 'pixi.js';
import { createCharacter, type Character, type Tool, TOOLS } from '../world/character.ts';
import { net } from './multiplayer.ts';

interface Avatar {
    character: Character;
    label: Text;
    u: number;
    v: number;
    z: number;
    name: string;
}

export interface RemotePlayers {
    update(dtMs: number): void;
    destroy(): void;
}

/** Cool tint so remote players read as different from you. */
const REMOTE_TINT = 0xbfe2ff;

export function createRemotePlayers(opts: {
    scene: 'world' | 'base';
    layer: Container;
    toScreen: (u: number, v: number) => { x: number; y: number };
    /** Depth-sort value for something standing at (u, v), matching the local player's. */
    zFor: (u: number, v: number) => number;
}): RemotePlayers {
    const avatars = new Map<string, Avatar>();

    const remove = (id: string) => {
        const a = avatars.get(id);
        if (!a) return;
        a.character.destroy();
        a.label.destroy();
        avatars.delete(id);
    };

    return {
        update(dtMs) {
            const live = new Set<string>();
            for (const [id, r] of net.remotes) {
                const pose = r.pose;
                if (!pose || pose.scene !== opts.scene) continue;
                live.add(id);
                let a = avatars.get(id);
                if (!a) {
                    const character = createCharacter(() => { /* remote tool changes are applied directly */ });
                    character.player.tint = REMOTE_TINT;
                    const label = new Text({
                        text: r.name,
                        style: { fontFamily: 'sans-serif', fontSize: 18, fontWeight: '800', fill: 0xffffff, stroke: { color: 0x1d2b4a, width: 5 } },
                    });
                    label.anchor.set(0.5, 1);
                    opts.layer.addChild(character.player, label);
                    a = { character, label, u: pose.u, v: pose.v, z: pose.z, name: r.name };
                    avatars.set(id, a);
                }
                if (a.name !== r.name) {
                    a.name = r.name;
                    a.label.text = r.name;
                }

                // Ease toward the latest pose; snap if they teleported (scene change, long gap).
                const dist = Math.hypot(pose.u - a.u, pose.v - a.v);
                if (dist > 6) {
                    a.u = pose.u;
                    a.v = pose.v;
                } else {
                    const k = 1 - Math.exp(-dtMs / 90);
                    a.u += (pose.u - a.u) * k;
                    a.v += (pose.v - a.v) * k;
                }
                a.z += (pose.z - a.z) * (1 - Math.exp(-dtMs / 90));

                const c = a.character;
                if ((TOOLS as readonly string[]).includes(pose.tool)) c.setTool(pose.tool as Tool);
                c.setFacing(pose.face);
                while (r.acts.length) c.command({ type: r.acts.shift() as 'attack' });
                // Walking while the remote player is still sitting means they stood up.
                const moving = pose.anim !== 'idle' && dist > 0.02;
                if (moving && c.seated) c.command({ type: 'sit' });
                const angle = (pose.face * Math.PI) / 4;
                const push = pose.anim === 'run' ? 1 : 0.4;
                c.update(dtMs, moving ? { x: Math.cos(angle) * push, y: Math.sin(angle) * push } : { x: 0, y: 0 }, moving);

                const p = opts.toScreen(a.u, a.v);
                c.player.position.set(p.x, p.y - a.z);
                c.player.zIndex = opts.zFor(a.u, a.v);
                a.label.position.set(p.x, p.y - a.z - 82);
                a.label.zIndex = 1e6;
            }
            for (const id of [...avatars.keys()]) if (!live.has(id)) remove(id);
        },
        destroy() {
            for (const id of [...avatars.keys()]) remove(id);
        },
    };
}
