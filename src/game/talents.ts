/**
 * The hero's skill tree: three branches of talents, earned the long way. Every rank takes a skill point
 * (one every two levels), a high enough level (deeper talents open later, and each rank asks a few levels
 * more), and materials from the world: iron, leather and horn from monsters and rocks, herbs and glands,
 * crystal dust from wizards, the lands' elemental essences, and gold. Talents are learnt at camp (at the
 * fire, with time to think), and a reset costs gold and gives back the points, not the materials.
 *
 * What each talent does is read where it acts: progress.ts power() (damage, health, healing, speed) and the
 * world scene (the combo, the Whirlwind, the Fire Bolt and what it learns).
 *
 *   Blade: Keen Edge (damage), Combo Master (a longer string, the Runic Fracture on every third blow),
 *          Whirlwind (the Fracture becomes a spin round you that throws everything back).
 *   Flame: Fire Bolt (cast fire at the nearest foe ahead, the wizard's way), Searing (hotter bolts),
 *          Twin Flames (two at once, quicker), Pyroblast (they burst where they land).
 *   Guard: Toughness (health), Second Wind (healing over time), Fleet Foot (speed, cheaper dodges).
 */
import type { Bag } from './survival.ts';

export type Branch = 'blade' | 'flame' | 'guard';
export type TalentId = 'edge' | 'combo' | 'whirl' | 'firebolt' | 'searing' | 'twin' | 'pyro' | 'tough' | 'second' | 'fleet';

export interface Talent {
    id: TalentId;
    branch: Branch;
    name: string;
    /** Ranks it can take. */
    max: number;
    /** How deep in its branch (1-4): sets the level it opens at (TIER_LEVEL). */
    tier: 1 | 2 | 3 | 4;
    /** Learnt first (at least one rank). */
    needs?: TalentId;
    /** What the next rank (or the talent) does. */
    blurb: (rank: number) => string;
    /** Icon (ui/icons.tsx). */
    icon: string;
    /** The materials each rank takes (index = the rank being learnt, from 0). */
    cost: Partial<Bag>[];
}

/** The level a talent's first rank opens at, by tier; each further rank asks RANK_LEVELS more. */
export const TIER_LEVEL = [0, 2, 5, 9, 13] as const;
export const RANK_LEVELS = 3;

export const TALENTS: Talent[] = [
    {
        id: 'edge', branch: 'blade', tier: 1, name: 'Keen Edge', max: 3, icon: 'swords', blurb: (r) => `Blade and tool blows +${12 * (r + 1)}% damage`,
        cost: [{ iron: 4, leather: 3 }, { iron: 8, horn: 4, stone: 10 }, { iron: 14, horn: 8, gold: 3 }],
    },
    {
        id: 'combo', branch: 'blade', tier: 2, name: 'Combo Master', max: 2, needs: 'edge', icon: 'bolt',
        blurb: (r) => (r === 0 ? 'Your string of blows lasts longer between hits' : 'The Runic Fracture bursts on every third blow, not fourth'),
        cost: [{ horn: 6, leather: 6, iron: 4 }, { horn: 12, gold: 3, ess_fire: 3 }],
    },
    {
        id: 'whirl', branch: 'blade', tier: 3, name: 'Whirlwind', max: 1, needs: 'combo', icon: 'vortex', blurb: () => 'The Fracture becomes a spin all round you: double damage, and it throws foes back',
        cost: [{ horn: 14, crystal: 4, gold: 5, ess_air: 4 }],
    },
    {
        id: 'firebolt', branch: 'flame', tier: 1, name: 'Fire Bolt', max: 1, icon: 'flame', blurb: () => 'Cast fire at the nearest foe ahead (the Fire button, or X). Ready again in about a second',
        cost: [{ herb: 5, gland: 3, wood: 10 }],
    },
    {
        id: 'searing', branch: 'flame', tier: 2, name: 'Searing', max: 3, needs: 'firebolt', icon: 'flame', blurb: (r) => `Fire Bolts +${30 * (r + 1)}% damage, and they set foes burning`,
        cost: [{ gland: 5, crystal_dust: 3 }, { crystal_dust: 6, ess_fire: 3, resin: 4 }, { crystal_dust: 10, ess_fire: 6, gold: 3 }],
    },
    {
        id: 'twin', branch: 'flame', tier: 3, name: 'Twin Flames', max: 1, needs: 'searing', icon: 'star', blurb: () => 'Two bolts at a time (at the two nearest foes), and a quicker cast',
        cost: [{ crystal: 4, ess_fire: 8, gold: 4, crystal_dust: 6 }],
    },
    {
        id: 'pyro', branch: 'flame', tier: 4, name: 'Pyroblast', max: 1, needs: 'twin', icon: 'sun', blurb: () => 'Fire Bolts burst where they land, burning everything close',
        cost: [{ crystal: 8, ess_fire: 12, gold: 8, stalker_eye: 3 }],
    },
    {
        id: 'tough', branch: 'guard', tier: 1, name: 'Toughness', max: 3, icon: 'shield', blurb: (r) => `+${4 * (r + 1)} max health`,
        cost: [{ leather: 5, meat: 3 }, { leather: 10, iron: 4, horn: 3 }, { leather: 16, iron: 8, gold: 3 }],
    },
    {
        id: 'second', branch: 'guard', tier: 2, name: 'Second Wind', max: 2, needs: 'tough', icon: 'cross', blurb: (r) => `Heal 1 health every ${r === 0 ? 6 : 4} seconds`,
        cost: [{ herb: 8, gland: 4, honey: 2 }, { herb: 14, crystal: 3, ess_water: 4 }],
    },
    {
        id: 'fleet', branch: 'guard', tier: 3, name: 'Fleet Foot', max: 2, needs: 'second', icon: 'wind', blurb: (r) => `+${8 * (r + 1)}% speed; dodges cost ${15 * (r + 1)}% less stamina`,
        cost: [{ leather: 8, ess_air: 3, horn: 4 }, { ess_air: 7, gold: 4, horn: 8 }],
    },
];
export const TALENT: Record<TalentId, Talent> = Object.fromEntries(TALENTS.map((t) => [t.id, t])) as Record<TalentId, Talent>;
export const BRANCHES: { id: Branch; name: string; color: string }[] = [
    { id: 'blade', name: 'Blade', color: '#fca5a5' },
    { id: 'flame', name: 'Flame', color: '#fdba74' },
    { id: 'guard', name: 'Guard', color: '#86efac' },
];

/** Ranks learnt (a talent missing is rank 0). */
export type Talents = Partial<Record<TalentId, number>>;
export const rankOf = (t: Talents | null | undefined, id: TalentId): number => Math.max(0, Math.min(TALENT[id].max, Math.floor(t?.[id] ?? 0)));
/** Skill points earned by a level: one every two levels (1 at level 1, 2 at level 3, ...). */
export const talentPoints = (level: number): number => Math.max(0, Math.floor((level + 1) / 2));
export const spentOf = (t: Talents | null | undefined): number => TALENTS.reduce((n, x) => n + rankOf(t, x.id), 0);
/** The level the next rank of a talent asks for. */
export const levelFor = (t: Talents, id: TalentId): number => TIER_LEVEL[TALENT[id].tier] + RANK_LEVELS * rankOf(t, id);
/** The materials the next rank takes (empty once it is at its most). */
export const costFor = (t: Talents, id: TalentId): Partial<Bag> => TALENT[id].cost[rankOf(t, id)] ?? {};
/** What a reset costs (the points come back; the materials do not). */
export const RESET_COST: Partial<Bag> = { gold: 3 };

/**
 * Why the next rank cannot be learnt now, or null if it can: its most, the talent before it, the level, a
 * point, being away from camp, or materials still missing (`have` says what the bag holds).
 */
export function whyNot(t: Talents, level: number, id: TalentId, inCamp: boolean, have: (cost: Partial<Bag>) => boolean): string | null {
    const def = TALENT[id];
    if (rankOf(t, id) >= def.max) return 'Mastered';
    if (def.needs && rankOf(t, def.needs) < 1) return `Needs ${TALENT[def.needs].name}`;
    if (level < levelFor(t, id)) return `Needs level ${levelFor(t, id)}`;
    if (spentOf(t) >= talentPoints(level)) return 'No skill point (one every two levels)';
    if (!have(costFor(t, id))) return 'Missing materials';
    if (!inCamp) return 'Learn it at camp';
    return null;
}

/** How many talents could take a rank now if you were at camp (level, a point and the materials all there). */
export function learnable(t: Talents, level: number, bag: Partial<Bag>): number {
    const have = (c: Partial<Bag>) => (Object.keys(c) as (keyof Bag)[]).every((k) => (bag[k] ?? 0) >= (c[k] ?? 0));
    return TALENTS.filter((x) => whyNot(t, level, x.id, true, have) === null).length;
}

/** Fire Bolt: base damage (times the hero's damage), its reach (tiles), and the time between casts (ms). */
export const FIREBOLT = { damage: 3, range: 9, cooldownMs: 1100, twinCooldownMs: 850, burst: 1.7 };
