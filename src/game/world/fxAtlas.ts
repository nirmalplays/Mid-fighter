/**
 * Effects from "Super Pixel Effects Gigapack" (spells, hits, deaths, rewards, potions, the world):
 * public/images/fx/<name>.png, equal frames in rows of `c` (built by tools/build-fx.py).
 */
export const FX = {
    fireball: { n: 5, w: 80, h: 128, c: 5 },
    explosion: { n: 13, w: 128, h: 128, c: 13 },
    frost: { n: 10, w: 96, h: 96, c: 10 },
    sparkle: { n: 14, w: 64, h: 64, c: 14 },
    bolt: { n: 7, w: 128, h: 128, c: 7 },
    boltburst: { n: 8, w: 64, h: 64, c: 8 },
    heal: { n: 16, w: 128, h: 128, c: 16 },
    hit: { n: 7, w: 48, h: 48, c: 7 },
    crit: { n: 7, w: 96, h: 96, c: 7 },
    death: { n: 12, w: 32, h: 32, c: 12 },
    spawn: { n: 10, w: 32, h: 32, c: 10 },
    splat: { n: 10, w: 32, h: 32, c: 10 },
    aura: { n: 16, w: 48, h: 48, c: 16 },
    levelup: { n: 44, w: 320, h: 128, c: 12 },
    complete: { n: 56, w: 320, h: 96, c: 12 },
    alert: { n: 14, w: 40, h: 40, c: 14 },
    coins: { n: 31, w: 128, h: 128, c: 31 },
    pickup: { n: 18, w: 32, h: 32, c: 18 },
    atkup: { n: 18, w: 64, h: 64, c: 18 },
    defup: { n: 18, w: 64, h: 64, c: 18 },
    haste: { n: 29, w: 64, h: 64, c: 29 },
    poison: { n: 24, w: 48, h: 48, c: 24 },
    warp: { n: 10, w: 128, h: 128, c: 10 },
    campfire: { n: 5, w: 40, h: 64, c: 5 },
} as const;
export type FxName = keyof typeof FX;
