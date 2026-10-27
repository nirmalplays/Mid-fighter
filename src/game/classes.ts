/**
 * The hero's calling, chosen in the character creator and kept in the save (hero.cls). Each class
 * changes how combat plays (game/world combat code reads it): what the attack button does, the dodge,
 * the stat leanings. The kingdom you swear to still grants its own power and skill on top.
 */
export const CLASS_IDS = ['warrior', 'ranger', 'arcanist'] as const;
export type ClassId = (typeof CLASS_IDS)[number];

export interface HeroClass {
    name: string;
    /** One line for the creator's card. */
    blurb: string;
    /** How it fights, for the creator's detail panel. */
    style: string;
}

export const CLASSES: Record<ClassId, HeroClass> = {
    warrior: { name: 'Warrior', blurb: 'Steel and nerve. Heavy combos, a shoulder-charge dash.', style: 'Close range. Three-hit combos that end in a heavy blow; the dash barges through foes.' },
    ranger: { name: 'Ranger', blurb: 'Quick feet, quicker blades. Strikes from the flank.', style: 'Fast light hits and a long dash that leaves a feint behind; bonus damage from behind.' },
    arcanist: { name: 'Arcanist', blurb: 'Ley-touched scholar. Bolts at range, a blink for a dash.', style: 'A charged arcane bolt on attack; the dash is a short blink; spells recharge faster.' },
};

export const isClassId = (x: unknown): x is ClassId => typeof x === 'string' && (CLASS_IDS as readonly string[]).includes(x);
