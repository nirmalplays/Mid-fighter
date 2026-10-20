/**
 * The four spells in the chest menu. A spell is a blast that damages every monster within
 * `radius` tiles of its centre (the player, or for the Bolt the nearest monster), or a heal.
 * Damage scales a little with the Attack skill. Cooldowns are per player.
 */
export interface Spell {
    name: string;
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
    { name: 'Fire nova', icon: 'hud/gem-attack.png', color: 0xff7a3d, cooldownMs: 6000, radius: 3.2, damage: 4, seek: 0, heal: 0, blurb: 'Burns everything around you' },
    { name: 'Frost burst', icon: 'hud/gem-defence.png', color: 0x7ad8ff, cooldownMs: 9000, radius: 4.8, damage: 2, seek: 0, heal: 0, blurb: 'A wide ring that throws monsters back' },
    { name: 'Bolt', icon: 'hud/gem-speed.png', color: 0xfff27a, cooldownMs: 4000, radius: 1.5, damage: 9, seek: 9, heal: 0, blurb: 'Strikes the nearest monster hard' },
    { name: 'Heal', icon: 'potions/red.png', color: 0xff5a5a, cooldownMs: 20000, radius: 0, damage: 0, seek: 0, heal: 3, blurb: 'Restores 3 health' },
];
