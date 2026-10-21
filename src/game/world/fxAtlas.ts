/**
 * Spell effects from "Super Pixel Effects Gigapack" (public/images/fx/<name>.png, one row of
 * equal frames; built by tools/build-fx.py).
 */
export const FX = {
    fireball: { n: 5, w: 80, h: 128 },
    explosion: { n: 13, w: 128, h: 128 },
    frost: { n: 10, w: 96, h: 96 },
    sparkle: { n: 14, w: 64, h: 64 },
    bolt: { n: 7, w: 128, h: 128 },
    boltburst: { n: 8, w: 64, h: 64 },
    heal: { n: 16, w: 128, h: 128 },
} as const;
export type FxName = keyof typeof FX;
