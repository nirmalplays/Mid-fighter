/**
 * Surge boons: the power-ups a fight hands you. Every kill fills the Surge meter; when it is full the
 * waves hold their breath and you choose one of three boons. They stack, and they last until you fall
 * (the run ends): each fight builds its own hero. The world scene does what each one says.
 */
export type BoonId = 'fury' | 'haste' | 'vamp' | 'ring' | 'chain' | 'orbit' | 'crit' | 'barrage' | 'mend';

export interface Boon {
    id: BoonId;
    name: string;
    /** Most stacks (a boon at its most is not offered again). */
    max: number;
    color: string;
    icon: string;
    /** What taking the next stack gives (stack = how many you already have). */
    blurb: (stack: number) => string;
}

export const BOONS: Boon[] = [
    { id: 'fury', name: 'Fury', max: 5, color: '#f87171', icon: 'swords', blurb: (n) => `All damage +15%${n ? ` (now +${15 * n}%)` : ''}` },
    { id: 'haste', name: 'Quickstep', max: 4, color: '#86efac', icon: 'wind', blurb: (n) => `Move 8% faster${n ? ` (now +${8 * n}%)` : ''}` },
    { id: 'vamp', name: 'Bloodthirst', max: 3, color: '#fb7185', icon: 'cross', blurb: (n) => `A kill heals 1 health ${[30, 45, 60][n]}% of the time` },
    { id: 'ring', name: 'Ember Ring', max: 3, color: '#fb923c', icon: 'sun', blurb: (n) => `A ring of fire pulses round you every ${[3, 2.4, 1.8][n]}s` },
    { id: 'chain', name: 'Chain Spark', max: 3, color: '#fde047', icon: 'bolt', blurb: (n) => `Your blows arc to another foe for ${40 * (n + 1)}% damage` },
    { id: 'orbit', name: 'Blade Orbit', max: 3, color: '#c4b5fd', icon: 'vortex', blurb: (n) => `Spinning blades cut everything close, ${[1, 2, 3][n]}x a second` },
    { id: 'crit', name: 'Hawk Eye', max: 4, color: '#fcd34d', icon: 'star', blurb: (n) => `Critical hits 8% more often${n ? ` (now +${8 * n}%)` : ''}` },
    { id: 'barrage', name: 'Spitfire', max: 3, color: '#fdba74', icon: 'flame', blurb: (n) => `A fire bolt flies at the nearest foe every ${[2.4, 1.9, 1.4][n]}s` },
    { id: 'mend', name: 'Second Breath', max: 99, color: '#a7f3d0', icon: 'flask', blurb: () => 'Heal to full health now' },
];
export const BOON: Record<BoonId, Boon> = Object.fromEntries(BOONS.map((b) => [b.id, b])) as Record<BoonId, Boon>;
export type Boons = Partial<Record<BoonId, number>>;

/** Kills to fill the Surge meter for the next boon (more each time). */
export const surgeNeed = (taken: number): number => 8 + 4 * taken;

/** Three different boons to choose from (none at its most; Second Breath only when hurt). */
export function offerBoons(have: Boons, hurt: boolean, rand: () => number = Math.random): BoonId[] {
    const pool = BOONS.filter((b) => (have[b.id] ?? 0) < b.max && (b.id !== 'mend' || hurt)).map((b) => b.id);
    const out: BoonId[] = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return out;
}
