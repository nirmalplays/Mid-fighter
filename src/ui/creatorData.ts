/**
 * The character creator's curated data: how each class shows itself (its emblem colours, the tool and
 * poses its preview takes), the named presets, hero names, and the harmonious randomiser.
 */
import type { ClassId } from '../game/classes.ts';
import {
    ACCS, accFits, DEFAULT_LOOK, FACES, faceFits, GEARS, HAIRS, normalizeLook, type HeroLook,
} from '../game/world/heroLook.ts';

export interface ClassShow {
    /** Accent colour (card glow, emblem) and its dark partner. */
    color: string;
    dark: string;
    /** The hero sheets the preview plays for this class: standing, walking and its attack. */
    idle: string;
    walk: string;
    attack: string;
    /** What the hero carries, in words. */
    carries: string;
    /** The preview adds a ley spark on the attack (the arcanist casts bare-handed). */
    spark?: boolean;
}

export const CLASS_SHOW: Record<ClassId, ClassShow> = {
    warrior: { color: '#e0794a', dark: '#5a1e10', idle: 'idle-sword', walk: 'walk-sword', attack: 'attack-sword', carries: 'Sword' },
    ranger: { color: '#8cc45a', dark: '#24401a', idle: 'idle-axe', walk: 'walk-axe', attack: 'swing-axe', carries: 'Hatchet' },
    arcanist: { color: '#a98af0', dark: '#2c1a5a', idle: 'idle', walk: 'walk', attack: 'interact', carries: 'Bare hands and ley bolts', spark: true },
};

/** Milliseconds per frame for the preview, matching the game's (world/character.ts). */
export const FRAME_MS: Record<string, number> = { idle: 170, walk: 120, attack: 80, swing: 85, interact: 140 };
export const frameMs = (file: string) => FRAME_MS[file.split('-')[0]] ?? 140;

export interface Preset {
    name: string;
    cls: ClassId;
    look: HeroLook;
}

const L = (p: Partial<HeroLook>): HeroLook => normalizeLook({ ...DEFAULT_LOOK, acc: 'none', ...p });

/** Named looks, each one checked by eye in every facing. The first per class is its signature. */
export const PRESETS: Preset[] = [
    { name: 'Ashborn Knight', cls: 'warrior', look: L({ skin: 8, outfit: 8, trim: 6, hair: 'short', hairColor: 0, gear: 'mantle', eyes: 3 }) },
    { name: 'Wayfarer', cls: 'ranger', look: L({ skin: 7, outfit: 2, trim: 2, hair: 'hood', hairColor: 1, gear: 'cape', eyes: 2 }) },
    { name: 'Ley Scholar', cls: 'arcanist', look: L({ skin: 6, outfit: 3, trim: 5, hair: 'long', hairColor: 4, acc: 'circlet', accColor: 0, face: 'earrings', eyes: 5 }) },
    { name: 'The Archaeologist', cls: 'ranger', look: { ...DEFAULT_LOOK } },
    { name: 'Ember Warden', cls: 'warrior', look: L({ skin: 10, outfit: 6, trim: 5, hair: 'mohawk', hairColor: 10, gear: 'pauldron', eyes: 7 }) },
    { name: 'Dune Raider', cls: 'ranger', look: L({ skin: 9, outfit: 4, trim: 1, hair: 'ponytail', hairColor: 0, acc: 'bandana', accColor: 2, face: 'eyepatch' }) },
    { name: 'Tidecaller', cls: 'arcanist', look: L({ skin: 12, outfit: 10, trim: 1, hair: 'braids', hairColor: 5, face: 'earrings', gear: 'cape', eyes: 1 }) },
    { name: 'Crowned Exile', cls: 'warrior', look: L({ skin: 0, outfit: 5, trim: 5, hair: 'curls', hairColor: 3, acc: 'crown', accColor: 0, gear: 'cape', eyes: 1 }) },
    { name: 'Hedge Witch', cls: 'arcanist', look: L({ skin: 13, outfit: 11, trim: 1, hair: 'curls', hairColor: 9, acc: 'headband', accColor: 7, gear: 'cape', eyes: 6 }) },
    { name: 'Quarry Hand', cls: 'warrior', look: L({ skin: 3, outfit: 9, trim: 3, hair: 'helmet', acc: 'goggles', accColor: 1, eyes: 4 }) },
    { name: 'Skyway Scout', cls: 'ranger', look: L({ skin: 2, outfit: 7, trim: 7, hair: 'aviator', acc: 'scarf', accColor: 2, eyes: 1 }) },
    { name: 'Ash Monk', cls: 'arcanist', look: L({ skin: 11, outfit: 8, trim: 4, hair: 'bun', hairColor: 4, acc: 'circlet', accColor: 5, eyes: 6 }) },
];

export const NAMES: Record<ClassId, string[]> = {
    warrior: ['Aren', 'Brannoc', 'Tamsin', 'Rook', 'Hild', 'Corvan', 'Isolde', 'Garrick', 'Maren', 'Thane'],
    ranger: ['Wren', 'Kael', 'Sable', 'Juno', 'Fen', 'Lark', 'Ash', 'Nyra', 'Tobin', 'Reed'],
    arcanist: ['Idris', 'Mira', 'Oren', 'Vesper', 'Elowen', 'Cassian', 'Lumi', 'Theron', 'Ysolde', 'Quill'],
};
export const JOURNEYS = ['The Ash Road', 'The Long Dig', 'Ember and Echo', 'The Stone That Remembers', 'A Quiet Vow', 'Under the Ley', 'The Ninth Tide'];

export const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const chance = (p: number) => Math.random() < p;

/** Natural tones; the uncanny ones (ashen, fae, ghost) turn up now and then. */
const SKIN_NATURAL = [6, 0, 1, 7, 2, 8, 3, 9, 4, 10, 11];
const SKIN_UNCANNY = [12, 13, 5];
const HAIR_NATURAL = [0, 1, 2, 3, 4, 6, 7, 8];
const HAIR_UNCANNY = [5, 9, 10];
/** Trims that sit with any outfit; and the outfits each strong trim flatters. */
const TRIM_NEUTRAL = [1, 2, 3, 4];
const TRIM_FOR: Record<number, number[]> = {
    5: [8, 5, 6, 3, 2, 10, 1], // gold on dark cloth
    6: [8, 7, 4, 0, 9], // oxblood
    7: [7, 4, 9, 8, 0], // steel blue
    8: [4, 7, 9, 1, 11], // moss
};
const METAL = [0, 5, 8]; // gold, silver, copper
const CLOTH_ACC = [2, 3, 6, 7, 1, 4]; // red, white, black, green, sky, violet (white only on darker outfits)
/** Outfits that clash with a cloth accessory colour (same family, too close to read). */
const ACC_CLASH: Record<number, number[]> = { 2: [1, 6], 7: [2, 11], 1: [0, 5], 4: [3], 3: [7, 4], 6: [8] };
/** What each class tends to wear on its back and shoulders. */
const GEAR_BY_CLASS: Record<ClassId, string[]> = {
    warrior: ['pauldron', 'mantle', 'cape', 'none'],
    ranger: ['cape', 'none', 'none', 'cape'],
    arcanist: ['none', 'cape', 'none', 'cape'],
};

/** A random look that holds together: colours from curated families, pieces that fit each other. */
export function randomLook(cls: ClassId): HeroLook {
    const outfit = Math.floor(Math.random() * 12);
    let trim = 0;
    if (chance(0.8)) {
        const strong = Object.entries(TRIM_FOR).filter(([, os]) => os.includes(outfit)).map(([t]) => Number(t));
        trim = strong.length && chance(0.45) ? pick(strong) : pick(TRIM_NEUTRAL);
    }
    const hair = chance(0.18) ? pick(['hood', 'helmet', 'aviator']) : pick(HAIRS.filter((h) => !['hood', 'helmet', 'aviator'].includes(h)));
    let acc = 'none';
    if (chance(0.5)) {
        const fits = ACCS.filter((a) => a !== 'none' && a !== 'crown' && accFits(hair, a));
        if (fits.length) acc = pick(fits);
    }
    if (acc === 'none' && cls === 'warrior' && chance(0.08) && accFits(hair, 'crown')) acc = 'crown';
    const metal = ['circlet', 'crown', 'goggles'].includes(acc);
    const clothOk = CLOTH_ACC.filter((c) => !(ACC_CLASH[c] ?? []).includes(outfit));
    const accColor = metal ? pick(METAL) : pick(clothOk.length ? clothOk : CLOTH_ACC);
    let face = chance(0.3) ? pick(FACES.filter((f) => f !== 'none')) : 'none';
    if (!faceFits(hair, face)) face = 'none';
    const gear = pick(GEAR_BY_CLASS[cls].filter((g) => GEARS.includes(g)));
    // Pale and uncanny skins get hair that stands out from them (no silver on ashen).
    const skin = chance(0.1) ? pick(SKIN_UNCANNY.slice(0, 2)) : pick(SKIN_NATURAL);
    const pale = SKIN_UNCANNY.includes(skin) || skin === 6;
    const hairPool = (chance(0.15) ? HAIR_UNCANNY : HAIR_NATURAL).filter((c) => !(pale && (c === 4 || c === 8)));
    return normalizeLook({
        skin,
        outfit,
        trim,
        hair,
        hairColor: pick(hairPool.length ? hairPool : HAIR_NATURAL),
        acc,
        accColor,
        face,
        gear,
        eyes: chance(0.5) ? 0 : 1 + Math.floor(Math.random() * 7),
    });
}

export const sameLook = (a: HeroLook, b: HeroLook) => JSON.stringify(normalizeLook(a)) === JSON.stringify(normalizeLook(b));
