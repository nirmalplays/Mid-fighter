/**
 * What furnishes the workshop (an 8 × 8 tile room whose back corner is cell 0,0;
 * the left wall runs along u = 0 and the right wall along v = 0). Positions are
 * grid coordinates of the item's base; `s` scales the 1x item art, `lift` raises
 * it in screen px (to stack things), `block` makes its cell solid, and `flat`
 * items (tools lying on the floor) cast no shadow.
 */
export interface WorkshopItem {
    name: string;
    u: number;
    v: number;
    s?: number;
    lift?: number;
    block?: boolean;
    flat?: boolean;
}

export const WORKSHOP_ITEMS: WorkshopItem[] = [
    // Storage: four chests along the back-right wall, crates stacked in the corner.
    { name: 'chest_wood', u: 1.5, v: 0.5, s: 0.5, block: true },
    { name: 'chest_dark', u: 2.5, v: 0.5, s: 0.5, block: true },
    { name: 'chest_light', u: 3.5, v: 0.5, s: 0.5, block: true },
    { name: 'chest_fantasy', u: 4.5, v: 0.5, s: 0.5, block: true },
    { name: 'crate_wood', u: 0.5, v: 0.5, s: 0.5, block: true },
    { name: 'crate_dark', u: 0.5, v: 0.5, s: 0.5, lift: 50 },
    { name: 'lantern', u: 0.5, v: 0.5, s: 0.5, lift: 100 },
    { name: 'crate_empty', u: 0.5, v: 1.5, s: 0.5, block: true },

    // The forge: a furnace with a water bucket and a lantern beside it.
    { name: 'furnace', u: 6.5, v: 0.5, s: 0.52, block: true },
    { name: 'lantern', u: 5.5, v: 0.5, s: 0.5 },
    { name: 'bucket_water', u: 7.5, v: 0.5, s: 0.42, block: true },
    { name: 'bucket', u: 6.5, v: 1.6, s: 0.38, block: true },

    // Tools laid out along the left wall.
    { name: 'axe', u: 0.5, v: 2.5, s: 0.5, flat: true },
    { name: 'pickaxe', u: 0.5, v: 3.5, s: 0.5, flat: true },
    { name: 'shovel', u: 0.5, v: 4.5, s: 0.55, flat: true },
    { name: 'hammer', u: 0.5, v: 5.5, s: 0.5, flat: true },
    { name: 'crate_light', u: 0.5, v: 6.5, s: 0.5, block: true },
    { name: 'plant', u: 0.5, v: 7.5, s: 0.5, block: true },

    // The workbench: a round table with a few tools and a tea pot on it, and log stools.
    { name: 'round', u: 3.5, v: 3.5, s: 0.9, block: true },
    { name: 'hammer', u: 3.2, v: 3.45, s: 0.26, lift: 26, flat: true },
    { name: 'mortar', u: 3.85, v: 3.35, s: 0.3, lift: 26 },
    { name: 'teapot', u: 3.5, v: 3.85, s: 0.22, lift: 28 },
    { name: 'brush', u: 3.15, v: 3.8, s: 0.26, lift: 24, flat: true },
    { name: 'nails', u: 3.9, v: 3.75, s: 0.3, lift: 22, flat: true },
    { name: 'oldlog', u: 5.3, v: 4.4, s: 0.42, block: true },
    { name: 'log', u: 2.0, v: 4.9, s: 0.4, block: true },

    // Materials stacked against the right side.
    { name: 'board', u: 7.5, v: 2.5, s: 0.5 },
    { name: 'board', u: 7.5, v: 2.5, s: 0.5, lift: 9 },
    { name: 'board', u: 7.5, v: 2.5, s: 0.5, lift: 18, block: true },
    { name: 'log', u: 7.4, v: 3.5, s: 0.5 },
    { name: 'log', u: 7.55, v: 3.5, s: 0.5, lift: 22, block: true },
    { name: 'pole', u: 7.5, v: 4.6, s: 0.5, block: true },
    { name: 'stone_brick', u: 6.35, v: 6.5, s: 0.42 },
    { name: 'stone_brick', u: 6.65, v: 6.5, s: 0.42 },
    { name: 'stone_brick', u: 6.5, v: 6.5, s: 0.42, lift: 14, block: true },
    { name: 'crate_dark', u: 7.5, v: 7.5, s: 0.5, block: true },
    { name: 'bottle', u: 7.5, v: 7.5, s: 0.4, lift: 52 },
    { name: 'jar', u: 5.6, v: 7.5, s: 0.5, block: true },
    { name: 'candle', u: 4.8, v: 7.5, s: 0.45 },
];
