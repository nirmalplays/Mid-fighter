/**
 * The four spells in the chest menu. A spell is a blast that damages every monster within
 * `radius` tiles of its centre (the player, or for the Bolt the nearest monster), or a heal.
 * Damage scales a little with the Attack skill. Cooldowns are per player.
 */
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
}

export const SPELLS: Spell[] = [
    { name: 'Fireball', kind: 'throw', icon: 'potions/red.png', color: 0xff7a3d, cooldownMs: 5000, radius: 2.4, damage: 5, seek: 8, heal: 0, blurb: 'Throws a fireball that explodes where it lands' },
    { name: 'Frost burst', kind: 'nova', icon: 'potions/blue.png', color: 0x7ad8ff, cooldownMs: 9000, radius: 4.8, damage: 2, seek: 0, heal: 0, blurb: 'A wide ring that throws monsters back' },
    { name: 'Bolt', kind: 'bolt', icon: 'potions/yellow.png', color: 0xfff27a, cooldownMs: 4000, radius: 1.5, damage: 9, seek: 9, heal: 0, blurb: 'Strikes the nearest monster hard' },
    { name: 'Heal', kind: 'heal', icon: 'potions/purple.png', color: 0xb070ff, cooldownMs: 20000, radius: 0, damage: 0, seek: 0, heal: 3, blurb: 'Restores 3 health' },
];
