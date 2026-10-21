/**
 * The four spells in the chest menu. A spell is a blast that damages every monster within
 * `radius` tiles of its centre (the player, or for the Bolt the nearest monster), or a heal.
 * Damage scales a little with the Attack skill. Cooldowns are per player.
 */
import type { Skill } from '../../shared/sim.ts';

export interface Spell {
    name: string;
    /** 'throw': a projectile flies toward the nearest monster ahead (or straight ahead) and blasts where it lands; 'nova': blasts around you; 'bolt': strikes the nearest monster; 'heal'. */
    kind: 'throw' | 'nova' | 'bolt' | 'heal';
    /** Picture in public/images (hud/ or potions/). */
    icon: string;
    color: number;
    cooldownMs: number;
    /** Blast radius in tiles (0 for a heal) and base damage. */
    radius: number;
    damage: number;
    /** The blast centres on the nearest monster within this many tiles (0: on the player). */
    seek: number;
    heal: number;
    blurb: string;
    /** The gem colour that pays for this spell and its upgrades. */
    gem: Skill;
}

export const SPELLS: Spell[] = [
    { name: 'Fireball', kind: 'throw', icon: 'potions/red.png', color: 0xff7a3d, cooldownMs: 5000, radius: 2.4, damage: 5, seek: 8, heal: 0, blurb: 'Throws a fireball that explodes where it lands', gem: 'attack' },
    { name: 'Frost burst', kind: 'nova', icon: 'potions/blue.png', color: 0x7ad8ff, cooldownMs: 9000, radius: 4.8, damage: 2, seek: 0, heal: 0, blurb: 'A wide ring that throws monsters back', gem: 'defence' },
    { name: 'Bolt', kind: 'bolt', icon: 'potions/yellow.png', color: 0xfff27a, cooldownMs: 4000, radius: 1.5, damage: 9, seek: 9, heal: 0, blurb: 'Strikes the nearest monster hard', gem: 'speed' },
    { name: 'Heal', kind: 'heal', icon: 'potions/purple.png', color: 0xb070ff, cooldownMs: 20000, radius: 0, damage: 0, seek: 0, heal: 3, blurb: 'Restores 3 health', gem: 'vitality' },
];

/** What a player has done with their spells (kept in the save). Locked until bought from the frog. */
export interface SpellSave {
    unlocked: boolean[];
    /** Carry level (0-4): charges held = 1 + level. */
    carry: number[];
    /** Cooldown level (0-5): each is 10 percent faster. */
    cooldown: number[];
}
export const defaultSpellSave = (): SpellSave => ({ unlocked: SPELLS.map(() => false), carry: SPELLS.map(() => 0), cooldown: SPELLS.map(() => 0) });
export const CARRY_MAX = 4;
export const COOLDOWN_MAX = 5;
/** Gems to unlock a spell, and to raise its carry / cooldown from level `level`. */
export const UNLOCK_COST = 3;
export const levelCost = (level: number): number => 2 + level;
export const maxCharges = (carry: number): number => 1 + carry;
export const cooldownFor = (spell: Spell, level: number): number => Math.round(spell.cooldownMs * (1 - 0.1 * level));
