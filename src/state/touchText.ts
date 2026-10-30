/**
 * The story and its hints are written with the keyboard's keys ("Press E at the Spire", "dodge (K)"). On a
 * touch screen those keys mean nothing, so the same words are turned into what the thumb does: the action
 * prompt that appears beside the hero, and the buttons by their names. The store runs every text a player
 * reads through here (store.patch), so no story line has to be written twice.
 */
export const TOUCH = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

const RULES: [RegExp, string][] = [
    [/\bPress E\b/g, 'Tap the action prompt'],
    [/\bpress E\b/g, 'tap the action prompt'],
    [/\(E with ([^)]*)\)/g, '(the action prompt, with $1)'],
    [/\(E\)/g, '(the action prompt)'],
    [/\(J\)/g, '(the Attack button)'],
    [/\(K\)/g, '(the Dodge button)'],
    [/\(X\)/g, '(the Fire button)'],
    [/\(Q\)/g, '(the skill button)'],
    [/\(R\)/g, '(the Hymn button)'],
    [/\bpress R\b/g, 'tap the Hymn button'],
    [/\bpress Q\b/g, 'tap the skill button'],
    [/\bBag ›/g, 'Bag (top right) ›'],
];

export function touchWords(s: string): string {
    if (!/[EJKXQR›]/.test(s)) return s;
    for (const [re, to] of RULES) s = s.replace(re, to);
    return s;
}
