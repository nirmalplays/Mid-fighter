/**
 * The hero's skill tree: three branches, a point to spend every level (and one to start with). What
 * each talent does is read where it acts: progress.ts power() (damage, health, healing, speed) and the
 * world scene (the combo, the Whirlwind, the Fire Bolt and what it learns).
 *
 *   Blade: Keen Edge (damage), Combo Master (a longer string, the Runic Fracture on every third blow),
 *          Whirlwind (the Fracture becomes a spin round you that throws everything back).
 *   Flame: Fire Bolt (cast fire at the nearest foe ahead, the wizard's way), Searing (hotter bolts),
 *          Twin Flames (two at once, quicker), Pyroblast (they burst where they land).
 *   Guard: Toughness (health), Second Wind (healing over time), Fleet Foot (speed, cheaper dodges).
 */
export type Branch = 'blade' | 'flame' | 'guard';
export type TalentId = 'edge' | 'combo' | 'whirl' | 'firebolt' | 'searing' | 'twin' | 'pyro' | 'tough' | 'second' | 'fleet';

export interface Talent {
    id: TalentId;
    branch: Branch;
    name: string;
    /** Ranks it can take. */
    max: number;
    /** Learnt first (at least one rank). */
    needs?: TalentId;
    /** What the next rank (or the talent) does. */
    blurb: (rank: number) => string;
    /** Icon (ui/icons.tsx). */
    icon: string;
}

export const TALENTS: Talent[] = [
    { id: 'edge', branch: 'blade', name: 'Keen Edge', max: 3, icon: 'swords', blurb: (r) => `Blade and tool blows +${12 * (r + 1)}% damage` },
    { id: 'combo', branch: 'blade', name: 'Combo Master', max: 2, needs: 'edge', icon: 'bolt', blurb: (r) => (r === 0 ? 'Your string of blows lasts longer between hits' : 'The Runic Fracture bursts on every third blow, not fourth') },
    { id: 'whirl', branch: 'blade', name: 'Whirlwind', max: 1, needs: 'combo', icon: 'vortex', blurb: () => 'The Fracture becomes a spin all round you: double damage, and it throws foes back' },
    { id: 'firebolt', branch: 'flame', name: 'Fire Bolt', max: 1, icon: 'flame', blurb: () => 'Cast fire at the nearest foe ahead (the Fire button, or X). Ready again in about a second' },
    { id: 'searing', branch: 'flame', name: 'Searing', max: 3, needs: 'firebolt', icon: 'flame', blurb: (r) => `Fire Bolts +${30 * (r + 1)}% damage, and they set foes burning` },
    { id: 'twin', branch: 'flame', name: 'Twin Flames', max: 1, needs: 'searing', icon: 'star', blurb: () => 'Two bolts at a time (at the two nearest foes), and a quicker cast' },
    { id: 'pyro', branch: 'flame', name: 'Pyroblast', max: 1, needs: 'twin', icon: 'sun', blurb: () => 'Fire Bolts burst where they land, burning everything close' },
    { id: 'tough', branch: 'guard', name: 'Toughness', max: 3, icon: 'shield', blurb: (r) => `+${4 * (r + 1)} max health` },
    { id: 'second', branch: 'guard', name: 'Second Wind', max: 2, needs: 'tough', icon: 'cross', blurb: (r) => `Heal 1 health every ${r === 0 ? 6 : 4} seconds` },
    { id: 'fleet', branch: 'guard', name: 'Fleet Foot', max: 2, needs: 'second', icon: 'wind', blurb: (r) => `+${8 * (r + 1)}% speed; dodges cost ${15 * (r + 1)}% less stamina` },
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
/** Points a level grants: one per level (so one to spend from the very start). */
export const talentPoints = (level: number): number => Math.max(0, Math.floor(level));
export const spentOf = (t: Talents | null | undefined): number => TALENTS.reduce((n, x) => n + rankOf(t, x.id), 0);
/** Whether the next rank can be learnt now. */
export function canLearn(t: Talents, level: number, id: TalentId): boolean {
    const def = TALENT[id];
    if (rankOf(t, id) >= def.max) return false;
    if (def.needs && rankOf(t, def.needs) < 1) return false;
    return spentOf(t) < talentPoints(level);
}

/** Fire Bolt: base damage (times the hero's damage), its reach (tiles), and the time between casts (ms). */
export const FIREBOLT = { damage: 3, range: 9, cooldownMs: 1100, twinCooldownMs: 850, burst: 1.7 };
