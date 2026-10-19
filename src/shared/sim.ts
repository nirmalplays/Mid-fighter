/**
 * The shared combat simulation: monsters, the wave portal and drops. Plain TypeScript
 * with no graphics, so the same code runs on the server (src/rooms/WorldRoom.ts, one
 * simulation for everyone in the room) and in the browser (offline play). Clients only
 * draw what it produces. Positions are grid tiles (u, v).
 */

export interface KindDef {
    hp: number;
    /** Tiles per second. */
    speed: number;
    /** Distance at which it starts an attack, and the farthest a landing attack still hits (+0.45). */
    reach: number;
    /** Time the attack animation plays, ms, and the fraction of it at which the hit lands. */
    attackMs: number;
    hitAt: number;
    recoverMs: number;
    weight: number;
}

export const KINDS: Record<string, KindDef> = {
    goblin: { hp: 5, speed: 2.3, reach: 1.05, attackMs: 560, hitAt: 0.55, recoverMs: 1300, weight: 3 },
    slime: { hp: 4, speed: 1.5, reach: 0.95, attackMs: 640, hitAt: 0.6, recoverMs: 1500, weight: 3 },
    wolf: { hp: 6, speed: 3.5, reach: 1.15, attackMs: 440, hitAt: 0.5, recoverMs: 1300, weight: 2 },
    skeleton: { hp: 8, speed: 1.9, reach: 1.1, attackMs: 720, hitAt: 0.6, recoverMs: 1600, weight: 2 },
};
/** Index order used on the wire. */
export const KIND_NAMES = ['goblin', 'slime', 'wolf', 'skeleton'] as const;
export const SKILLS = ['attack', 'defence', 'speed', 'vitality'] as const;
export type Skill = (typeof SKILLS)[number];
/** What each monster kind drops, and the chance. */
export const DROP_TABLE: Record<string, { skill: Skill; chance: number }> = {
    goblin: { skill: 'attack', chance: 0.8 },
    skeleton: { skill: 'defence', chance: 0.9 },
    wolf: { skill: 'speed', chance: 0.8 },
    slime: { skill: 'vitality', chance: 0.6 },
};
export const STATES = ['chase', 'attack', 'recover', 'dying'] as const;
export type State = (typeof STATES)[number];

export const DROP_LIFE_MS = 45000;
/** Dying monsters stay this long (animation + fade) before they are removed. */
export const DYING_MS = 1400;
const LEASH = 60;
/** A player swing reaches this far, within this many radians of where they face. */
const REACH = 1.9;
const ARC = 1.3;
const PORTAL_SPAWN_WINDOW_MS = 26000;
const PORTAL_LINGER_MS = 2500;
const PORTAL_CLOSE_MS = 700;
const DIST_MIN = 12;
const DIST_MAX = 19;
/** A player must be this close (tiles) to a drop to take it (a little slack for lag). */
const PICKUP_SLACK = 2.6;

/** Monster count, toughness and kinds for wave n and a number of players. */
export function waveSpec(n: number, players = 1) {
    const kinds = ['goblin', 'slime'];
    if (n >= 2) kinds.push('wolf');
    if (n >= 3) kinds.push('skeleton');
    const extra = Math.max(0, players - 1);
    return {
        count: Math.min(28, Math.round((3 + 2 * (n - 1)) * (1 + 0.6 * extra))),
        kinds,
        hpMul: (1 + 0.3 * (n - 1)) * (1 + 0.25 * extra),
        speedMul: Math.min(1.5, 1 + 0.05 * (n - 1)),
        damage: n >= 5 ? 2 : 1,
    };
}

export interface SimPlayer {
    id: string;
    u: number;
    v: number;
}

export interface SimEnv {
    /** Alive players currently in the open world (the only ones monsters hunt). */
    players(): SimPlayer[];
    /** May an enemy step from one spot to another (plants do not stop them; water and cliffs do). */
    canMove(fromU: number, fromV: number, toU: number, toV: number): boolean;
    /** Is this a good place to stand (portal placement, spawn spots)? */
    canStand(u: number, v: number): boolean;
    rand(): number;
}

export interface SimMonster {
    id: number;
    kind: string;
    u: number;
    v: number;
    hp: number;
    max: number;
    state: State;
    /** Ms spent in the current state. */
    t: number;
    speedMul: number;
    damage: number;
    ku: number;
    kv: number;
    hit: boolean;
    side: 1 | -1;
}

export interface SimDrop {
    id: number;
    skill: Skill;
    u: number;
    v: number;
    age: number;
}

export interface SimPortal {
    u: number;
    v: number;
    wave: number;
    age: number;
    toSpawn: number;
    nextIn: number;
    every: number;
    /** Age at which it starts closing, or null while it is still spawning. */
    doneAt: number | null;
}

/** Things the host must act on. */
export type SimEvent =
    | { type: 'bite'; playerId: string; damage: number }
    | { type: 'kill'; playerId: string; kind: string }
    | { type: 'wave'; wave: number; u: number; v: number };

export interface SimOptions {
    everyMs: number;
    firstMs: number;
}

export class GameSim {
    monsters = new Map<number, SimMonster>();
    drops = new Map<number, SimDrop>();
    portal: SimPortal | null = null;
    wave = 0;
    /** Ms until the next portal opens. */
    clock: number;
    private nextId = 1;
    private readonly env: SimEnv;
    private readonly opts: SimOptions;

    constructor(env: SimEnv, opts: SimOptions) {
        this.env = env;
        this.opts = opts;
        this.clock = opts.firstMs;
    }

    /** Remove every monster, drop and portal (the wave counter and timer stay). */
    clear(): void {
        this.monsters.clear();
        this.drops.clear();
        this.portal = null;
    }

    update(dtMs: number): SimEvent[] {
        const events: SimEvent[] = [];
        const dt = Math.min(dtMs, 250) / 1000;
        const players = this.env.players();

        // The wave timer runs only while someone is in the world to fight.
        if (!this.portal && players.length > 0) {
            this.clock -= dtMs;
            if (this.clock <= 0) {
                const next = this.wave + 1;
                const portal = this.openPortal(next, players);
                if (portal) {
                    this.wave = next;
                    this.portal = portal;
                    this.clock = this.opts.everyMs;
                    events.push({ type: 'wave', wave: next, u: portal.u, v: portal.v });
                } else {
                    this.clock = 8000; // no room near anyone; try again shortly
                }
            }
        }
        if (this.portal) this.updatePortal(this.portal, dtMs, players);

        for (const m of [...this.monsters.values()]) this.updateMonster(m, dt, dtMs, players, events);

        for (const d of [...this.drops.values()]) {
            d.age += dtMs;
            if (d.age > DROP_LIFE_MS) this.drops.delete(d.id);
        }
        return events;
    }

    /** A player swing from (u, v) facing a 0-7 sector. Returns events (kills). */
    strike(playerId: string, pu: number, pv: number, facing: number, damage: number): SimEvent[] {
        const events: SimEvent[] = [];
        const aim = (facing * Math.PI) / 4;
        for (const m of this.monsters.values()) {
            if (m.state === 'dying') continue;
            const du = m.u - pu;
            const dv = m.v - pv;
            const dist = Math.hypot(du, dv);
            if (dist > REACH) continue;
            // Screen-space direction to the monster, in the same units as the joystick's facing.
            const sx = (du - dv) * 62;
            const sy = (du + dv) * 31 * 2;
            let diff = Math.abs(Math.atan2(sy, sx) - aim);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (dist > 0.9 && diff > ARC) continue;
            m.hp -= damage;
            const kd = dist || 1;
            m.ku = (du / kd) * 7;
            m.kv = (dv / kd) * 7;
            if (m.hp <= 0) {
                m.state = 'dying';
                m.t = 0;
                events.push({ type: 'kill', playerId, kind: m.kind });
                const drop = DROP_TABLE[m.kind];
                if (drop && this.env.rand() < drop.chance) this.addDrop(drop.skill, m.u, m.v);
            } else if (m.state === 'attack') {
                m.state = 'recover'; // a hit interrupts the attack
                m.t = 0;
            }
        }
        return events;
    }

    /** A player asks to take a drop. Returns the skill if allowed. */
    pickup(dropId: number, pu: number, pv: number): Skill | null {
        const d = this.drops.get(dropId);
        if (!d || Math.hypot(d.u - pu, d.v - pv) > PICKUP_SLACK) return null;
        this.drops.delete(dropId);
        return d.skill;
    }

    spawn(kind: string, u: number, v: number, mods: { hpMul: number; speedMul: number; damage: number }): SimMonster {
        const def = KINDS[kind];
        const hp = Math.max(1, Math.round(def.hp * mods.hpMul));
        const m: SimMonster = {
            id: this.nextId++, kind, u, v, hp, max: hp, state: 'chase', t: 0,
            speedMul: mods.speedMul, damage: mods.damage, ku: 0, kv: 0, hit: false,
            side: this.env.rand() < 0.5 ? 1 : -1,
        };
        this.monsters.set(m.id, m);
        return m;
    }

    addDrop(skill: Skill, u: number, v: number): void {
        this.drops.set(this.nextId, { id: this.nextId, skill, u, v, age: 0 });
        this.nextId++;
    }

    aliveCount(): number {
        let n = 0;
        for (const m of this.monsters.values()) if (m.state !== 'dying') n++;
        return n;
    }

    /** Compact snapshot for the wire (arrays keep it small at 10 per second). */
    snapshot() {
        const p = this.portal;
        return {
            m: [...this.monsters.values()].map((m) => [
                m.id, KIND_NAMES.indexOf(m.kind as (typeof KIND_NAMES)[number]), round(m.u), round(m.v), m.hp, m.max, STATES.indexOf(m.state), Math.round(m.t),
            ]),
            d: [...this.drops.values()].map((d) => [d.id, SKILLS.indexOf(d.skill), round(d.u), round(d.v), Math.round(d.age)]),
            p: p ? [round(p.u), round(p.v), p.wave, Math.round(p.age), p.doneAt === null ? -1 : Math.round(p.doneAt)] : null,
            w: this.wave,
            nx: p ? 0 : Math.max(0, Math.ceil(this.clock / 1000)),
        };
    }

    // ---- internals ----

    private openPortal(wave: number, players: SimPlayer[]): SimPortal | null {
        const anchor = players[Math.floor(this.env.rand() * players.length)];
        const spec = waveSpec(wave, players.length);
        for (let n = 0; n < 40; n++) {
            const ang = this.env.rand() * Math.PI * 2;
            const d = DIST_MIN + this.env.rand() * (DIST_MAX - DIST_MIN);
            const u = anchor.u + Math.cos(ang) * d;
            const v = anchor.v + Math.sin(ang) * d;
            if (u < 4 || v < 4 || u > 252 || v > 252 || !this.env.canStand(u, v)) continue;
            return { u, v, wave, age: 0, toSpawn: spec.count, nextIn: 600, every: PORTAL_SPAWN_WINDOW_MS / spec.count, doneAt: null };
        }
        return null;
    }

    private updatePortal(p: SimPortal, dtMs: number, players: SimPlayer[]): void {
        p.age += dtMs;
        if (p.toSpawn > 0 && players.length > 0) {
            p.nextIn -= dtMs;
            if (p.nextIn <= 0) {
                const spec = waveSpec(p.wave, players.length);
                const kind = spec.kinds[Math.floor(this.env.rand() * spec.kinds.length)];
                let u = p.u;
                let v = p.v;
                for (let n = 0; n < 8; n++) {
                    const cu = p.u + (this.env.rand() - 0.5) * 2.4;
                    const cv = p.v + (this.env.rand() - 0.5) * 2.4;
                    if (this.env.canStand(cu, cv)) { u = cu; v = cv; break; }
                }
                this.spawn(kind, u, v, { hpMul: spec.hpMul, speedMul: spec.speedMul, damage: spec.damage });
                p.toSpawn -= 1;
                p.nextIn = p.every * (0.7 + this.env.rand() * 0.6);
            }
        }
        if (p.toSpawn <= 0 && p.doneAt === null) p.doneAt = p.age + PORTAL_LINGER_MS;
        if (p.doneAt !== null && p.age >= p.doneAt + PORTAL_CLOSE_MS) this.portal = null;
    }

    private step(m: SimMonster, du: number, dv: number): boolean {
        let moved = false;
        if (du !== 0 && this.env.canMove(m.u, m.v, m.u + du, m.v)) { m.u += du; moved = true; }
        if (dv !== 0 && this.env.canMove(m.u, m.v, m.u, m.v + dv)) { m.v += dv; moved = true; }
        return moved;
    }

    private updateMonster(m: SimMonster, dt: number, dtMs: number, players: SimPlayer[], events: SimEvent[]): void {
        const def = KINDS[m.kind];
        m.t += dtMs;
        if (m.state === 'dying') {
            if (m.t > DYING_MS) this.monsters.delete(m.id);
            return;
        }

        // Hunt the nearest player in the world.
        let target: SimPlayer | null = null;
        let best = Infinity;
        for (const p of players) {
            const d = Math.hypot(p.u - m.u, p.v - m.v);
            if (d < best) { best = d; target = p; }
        }
        if (!target || best > LEASH) {
            if (!target && m.state === 'chase') return; // nobody to hunt: stand
            if (best > LEASH) { this.monsters.delete(m.id); return; }
        }

        // Knockback glides and fades.
        if (Math.abs(m.ku) + Math.abs(m.kv) > 0.05) {
            this.step(m, m.ku * dt, m.kv * dt);
            const decay = Math.exp(-dt * 7);
            m.ku *= decay;
            m.kv *= decay;
        }

        if (!target) return;
        const du = target.u - m.u;
        const dv = target.v - m.v;
        const dist = best;
        if (m.state === 'chase') {
            if (dist < def.reach) {
                m.state = 'attack';
                m.t = 0;
                m.hit = false;
            } else {
                const k = (def.speed * m.speedMul * dt) / dist;
                let moved = this.step(m, du * k, dv * k);
                // Blocked: sidestep around whatever is in the way.
                if (!moved) moved = this.step(m, -dv * k * m.side, du * k * m.side);
                if (!moved) m.side = m.side === 1 ? -1 : 1;
            }
        } else if (m.state === 'attack') {
            if (!m.hit && m.t >= def.attackMs * def.hitAt) {
                m.hit = true;
                // Whoever is in reach when the blow lands takes it.
                for (const p of players) {
                    if (Math.hypot(p.u - m.u, p.v - m.v) < def.reach + 0.45) events.push({ type: 'bite', playerId: p.id, damage: m.damage });
                }
            }
            if (m.t >= def.attackMs) {
                m.state = 'recover';
                m.t = 0;
            }
        } else if (m.state === 'recover' && m.t >= def.recoverMs) {
            m.state = 'chase';
            m.t = 0;
        }
    }
}

function round(x: number): number {
    return Math.round(x * 100) / 100;
}
