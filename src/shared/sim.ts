/**
 * The shared combat simulation: monsters, waves and drops. Plain TypeScript
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
/** What a drop can be: a skill gem, or a rare sword. */
export type DropKind = Skill | 'sword';
/** Order of drop kinds on the wire (a sword is index 4). */
export const DROP_KINDS: readonly DropKind[] = [...SKILLS, 'sword'];
/** How many swords exist (src/assets/File.png is 6 x 5). */
export const SWORD_COUNT = 30;
/** Chance a kill also drops a random sword, by monster kind (before the wave bonus). */
export const SWORD_CHANCE: Record<string, number> = { goblin: 0.025, slime: 0.025, wolf: 0.035, skeleton: 0.05 };
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
/** A wave sends in its monsters over this long. */
const WAVE_SPAWN_WINDOW_MS = 26000;
/** Monsters appear this far from a player (tiles), just outside the screen. */
const DIST_MIN = 10;
const DIST_MAX = 16;
/** A player must be this close (tiles) to a drop to take it (a little slack for lag). */
const PICKUP_SLACK = 2.6;
/** The safe zone around the workshop portal, in tiles. Monsters never enter it. */
export const SAFE_RADIUS = 3.4;
/** How far from a player the safe portal appears. */
const SAFE_DIST_MIN = 7;
const SAFE_DIST_MAX = 13;

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
    /** Is this open enough ground for the safe portal (clear of bushes and trees, so it can be reached)? */
    isOpen(u: number, v: number): boolean;
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
    skill: DropKind;
    /** Which sword (0-29) when `skill` is 'sword', else -1. */
    sword: number;
    u: number;
    v: number;
    age: number;
}

/** The workshop portal: a temporary safe zone. */
export interface SimSafe {
    u: number;
    v: number;
    age: number;
    /** How long it stays open, ms. */
    lasts: number;
}

/** A wave while it is still sending in monsters (there is no portal: they just appear off-screen). */
export interface SimWave {
    wave: number;
    age: number;
    /** Monsters still to come, ms until the next one, and the average gap. */
    toSpawn: number;
    nextIn: number;
    every: number;
}

/** Things the host must act on. */
export type SimEvent =
    | { type: 'bite'; playerId: string; damage: number }
    | { type: 'kill'; playerId: string; kind: string }
    | { type: 'wave'; wave: number }
    | { type: 'safe'; u: number; v: number };

export interface SimOptions {
    everyMs: number;
    firstMs: number;
    /** Multiplies every sword drop chance (1 normally; raised only for testing). */
    swordMul?: number;
    /** The safe portal opens about every `safeEveryMs` for `safeForMs`; the first one after about `safeFirstMs`. */
    safeEveryMs: number;
    safeForMs: number;
    safeFirstMs: number;
}

export class GameSim {
    monsters = new Map<number, SimMonster>();
    drops = new Map<number, SimDrop>();
    /** The wave that is currently spawning, or null between waves. */
    run: SimWave | null = null;
    safe: SimSafe | null = null;
    /** Ms until the safe portal next opens. */
    safeClock: number;
    wave = 0;
    /** Ms until the next wave starts. */
    clock: number;
    private nextId = 1;
    private readonly env: SimEnv;
    private readonly opts: SimOptions;

    constructor(env: SimEnv, opts: SimOptions) {
        this.env = env;
        this.opts = opts;
        this.clock = opts.firstMs;
        this.safeClock = opts.safeFirstMs * (0.7 + 0.6 * env.rand());
    }

    /** Remove every monster, drop and any running wave (the wave counter and timer stay). */
    clear(): void {
        this.monsters.clear();
        this.drops.clear();
        this.run = null;
        this.safe = null;
    }

    /** Is (u, v) inside the safe zone (only while the safe portal is open)? */
    inSafe(u: number, v: number): boolean {
        return this.safe !== null && Math.hypot(u - this.safe.u, v - this.safe.v) < SAFE_RADIUS;
    }

    update(dtMs: number): SimEvent[] {
        const events: SimEvent[] = [];
        const dt = Math.min(dtMs, 250) / 1000;
        const players = this.env.players();

        // The wave timer runs only while someone is in the world to fight.
        if (!this.run && players.length > 0) {
            this.clock -= dtMs;
            if (this.clock <= 0) {
                this.wave += 1;
                const spec = waveSpec(this.wave, players.length);
                this.run = { wave: this.wave, age: 0, toSpawn: spec.count, nextIn: 800, every: WAVE_SPAWN_WINDOW_MS / spec.count };
                this.clock = this.opts.everyMs;
                events.push({ type: 'wave', wave: this.wave });
            }
        }
        if (this.run) this.updateWave(this.run, dtMs, players);

        // The safe portal: opens at a random spot near a random player, stays a short while, then closes.
        if (this.safe) {
            this.safe.age += dtMs;
            if (this.safe.age >= this.safe.lasts) {
                this.safe = null;
                // The next one comes about `safeEveryMs` after this one opened, give or take.
                const gap = this.opts.safeEveryMs - this.opts.safeForMs;
                this.safeClock = Math.max(15000, gap * (0.8 + 0.4 * this.env.rand()));
            }
        } else if (players.length > 0) {
            this.safeClock -= dtMs;
            if (this.safeClock <= 0) {
                const spot = this.findSafeSpot(players);
                if (spot) {
                    this.safe = { u: spot.u, v: spot.v, age: 0, lasts: this.opts.safeForMs };
                    events.push({ type: 'safe', u: spot.u, v: spot.v });
                } else {
                    this.safeClock = 5000;
                }
            }
        }

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
                // A rare chance of a random sword on top, a little likelier in later waves.
                const rare = (SWORD_CHANCE[m.kind] ?? 0.02) * (1 + 0.04 * this.wave) * (this.opts.swordMul ?? 1);
                if (this.env.rand() < rare) this.addDrop('sword', m.u, m.v, Math.floor(this.env.rand() * SWORD_COUNT));
            } else if (m.state === 'attack') {
                m.state = 'recover'; // a hit interrupts the attack
                m.t = 0;
            }
        }
        return events;
    }

    /** A player asks to take a drop. Returns the skill if allowed. */
    pickup(dropId: number, pu: number, pv: number): { skill: DropKind; sword: number } | null {
        const d = this.drops.get(dropId);
        if (!d || Math.hypot(d.u - pu, d.v - pv) > PICKUP_SLACK) return null;
        this.drops.delete(dropId);
        return { skill: d.skill, sword: d.sword };
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

    addDrop(skill: DropKind, u: number, v: number, sword = -1): void {
        this.drops.set(this.nextId, { id: this.nextId, skill, sword, u, v, age: 0 });
        this.nextId++;
    }

    aliveCount(): number {
        let n = 0;
        for (const m of this.monsters.values()) if (m.state !== 'dying') n++;
        return n;
    }

    /** Compact snapshot for the wire (arrays keep it small at 10 per second). */
    snapshot() {
        const p = this.run;
        return {
            m: [...this.monsters.values()].map((m) => [
                m.id, KIND_NAMES.indexOf(m.kind as (typeof KIND_NAMES)[number]), round(m.u), round(m.v), m.hp, m.max, STATES.indexOf(m.state), Math.round(m.t),
            ]),
            d: [...this.drops.values()].map((d) => [d.id, DROP_KINDS.indexOf(d.skill), round(d.u), round(d.v), Math.round(d.age), d.sword]),
            p: p ? [p.wave, Math.round(p.age), p.toSpawn] : null,
            s: this.safe ? [round(this.safe.u), round(this.safe.v), Math.round(this.safe.age), this.safe.lasts] : null,
            w: this.wave,
            nx: p ? 0 : Math.max(0, Math.ceil(this.clock / 1000)),
        };
    }

    // ---- internals ----

    /** Send in the wave's monsters one by one, each appearing off-screen around a random player. */
    private updateWave(w: SimWave, dtMs: number, players: SimPlayer[]): void {
        w.age += dtMs;
        if (w.toSpawn > 0 && players.length > 0) {
            w.nextIn -= dtMs;
            if (w.nextIn <= 0) {
                const spec = waveSpec(w.wave, players.length);
                const spot = this.findSpawnSpot(players);
                if (spot) {
                    const kind = spec.kinds[Math.floor(this.env.rand() * spec.kinds.length)];
                    this.spawn(kind, spot.u, spot.v, { hpMul: spec.hpMul, speedMul: spec.speedMul, damage: spec.damage });
                    w.toSpawn -= 1;
                    w.nextIn = w.every * (0.7 + this.env.rand() * 0.6);
                } else {
                    w.nextIn = 500; // no free ground just now; try again shortly
                }
            }
        }
        if (w.toSpawn <= 0) this.run = null; // everyone is out; the next wave starts after the usual gap
    }

    /** A spot 10-16 tiles from a random player (and 9+ from all): free ground, outside any safe zone. */
    private findSpawnSpot(players: SimPlayer[]): { u: number; v: number } | null {
        const anchor = players[Math.floor(this.env.rand() * players.length)];
        for (let n = 0; n < 30; n++) {
            const ang = this.env.rand() * Math.PI * 2;
            const d = DIST_MIN + this.env.rand() * (DIST_MAX - DIST_MIN);
            const u = anchor.u + Math.cos(ang) * d;
            const v = anchor.v + Math.sin(ang) * d;
            if (u < 4 || v < 4 || u > 252 || v > 252 || !this.env.canStand(u, v) || this.inSafe(u, v)) continue;
            // Never right next to anyone: at least 9 tiles from every player.
            if (players.some((p) => Math.hypot(p.u - u, p.v - v) < DIST_MIN - 1)) continue;
            return { u, v };
        }
        return null;
    }

    private findSafeSpot(players: SimPlayer[]): { u: number; v: number } | null {
        const anchor = players[Math.floor(this.env.rand() * players.length)];
        for (let n = 0; n < 160; n++) {
            const ang = this.env.rand() * Math.PI * 2;
            const d = SAFE_DIST_MIN + this.env.rand() * (SAFE_DIST_MAX - SAFE_DIST_MIN);
            const u = anchor.u + Math.cos(ang) * d;
            const v = anchor.v + Math.sin(ang) * d;
            if (u < 6 || v < 6 || u > 250 || v > 250 || !this.env.canStand(u, v) || !this.env.isOpen(u, v)) continue;
            return { u, v };
        }
        return null;
    }

    /** A step that would carry a monster into the safe zone is refused (leaving it is fine). */
    private allowed(m: SimMonster, tu: number, tv: number): boolean {
        const s = this.safe;
        if (!s) return true;
        const into = Math.hypot(tu - s.u, tv - s.v);
        return into >= SAFE_RADIUS || into >= Math.hypot(m.u - s.u, m.v - s.v);
    }

    private step(m: SimMonster, du: number, dv: number): boolean {
        let moved = false;
        if (du !== 0 && this.allowed(m, m.u + du, m.v) && this.env.canMove(m.u, m.v, m.u + du, m.v)) { m.u += du; moved = true; }
        if (dv !== 0 && this.allowed(m, m.u, m.v + dv) && this.env.canMove(m.u, m.v, m.u, m.v + dv)) { m.v += dv; moved = true; }
        return moved;
    }

    private updateMonster(m: SimMonster, dt: number, dtMs: number, players: SimPlayer[], events: SimEvent[]): void {
        const def = KINDS[m.kind];
        m.t += dtMs;
        if (m.state === 'dying') {
            if (m.t > DYING_MS) this.monsters.delete(m.id);
            return;
        }

        // A monster caught inside a new safe zone is driven out of it.
        if (this.safe) {
            const du0 = m.u - this.safe.u;
            const dv0 = m.v - this.safe.v;
            const d0 = Math.hypot(du0, dv0);
            if (d0 < SAFE_RADIUS) {
                const ux = d0 > 0.001 ? du0 / d0 : 1;
                const uy = d0 > 0.001 ? dv0 / d0 : 0;
                m.u += ux * 5 * dt;
                m.v += uy * 5 * dt;
            }
        }

        // Hunt the nearest player in the world (anyone inside the safe zone is out of reach).
        let target: SimPlayer | null = null;
        let best = Infinity;
        for (const p of players) {
            if (this.inSafe(p.u, p.v)) continue;
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
                    if (this.inSafe(p.u, p.v)) continue; // safe inside the zone
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
