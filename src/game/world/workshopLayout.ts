/**
 * What furnishes the workshop: an 8 × 8 tile room whose back corner is cell 0,0 (the left wall
 * runs along u = 0, the right wall along v = 0). Laid out in zones with a clear walkway down
 * the middle:
 *   - back corner: stacked crates with a lantern, then three chests along the right wall
 *   - forge: the furnace in the right corner with water and a bucket beside it
 *   - left wall: a tool rack (tools hang on the wall), a plank stack and a log pile below it
 *   - centre: a workbench on a rug, with two log stools
 *   - front corners: a plant and a crate with a bottle
 * Positions are grid coordinates of an item's base; `s` scales the 1x item art, `lift` raises
 * it in screen px (stacking), `cells` are the floor cells it blocks (default: its own), `wall`
 * items hang on the left wall at height `lift`, and `flat` items cast no shadow.
 */
export interface WorkshopItem {
    name: string;
    u: number;
    v: number;
    s?: number;
    lift?: number;
    /** Floor cells [i, j] this item blocks; omit for a decoration you can walk over. */
    cells?: [number, number][];
    wall?: boolean;
    flat?: boolean;
}

export const WORKSHOP_ITEMS: WorkshopItem[] = [
    // Back corner: crates with a lantern on top.
    { name: 'crate_wood', u: 0.85, v: 0.85, s: 0.44, cells: [[0, 0]] },
    { name: 'crate_dark', u: 0.85, v: 0.85, s: 0.44, lift: 44 },
    { name: 'lantern', u: 0.85, v: 0.85, s: 0.4, lift: 88 },
    { name: 'crate_light', u: 2.05, v: 0.85, s: 0.44, cells: [[1, 0]] },

    // Chests along the right wall.
    { name: 'chest_wood', u: 3.3, v: 0.8, s: 0.4, cells: [[3, 0]] },
    { name: 'chest_dark', u: 4.4, v: 0.8, s: 0.4, cells: [[4, 0]] },
    { name: 'chest_fantasy', u: 5.4, v: 0.8, s: 0.4, cells: [[5, 0]] },

    // The forge in the right corner.
    { name: 'furnace', u: 7.25, v: 1.1, s: 0.42, cells: [[7, 0], [7, 1]] },
    { name: 'bucket_water', u: 6.3, v: 1.9, s: 0.32, cells: [[6, 1]] },
    { name: 'bucket', u: 7.4, v: 2.5, s: 0.3, cells: [[7, 2]] },

    // The tool rack hangs on the left wall (the rack bar itself is drawn by the scene).
    { name: 'axe', u: 0.15, v: 2.85, s: 0.4, lift: 64, wall: true },
    { name: 'pickaxe', u: 0.15, v: 3.75, s: 0.4, lift: 64, wall: true },
    { name: 'shovel', u: 0.15, v: 4.6, s: 0.44, lift: 62, wall: true },
    { name: 'hammer', u: 0.15, v: 5.3, s: 0.34, lift: 64, wall: true },
    // Materials below it: planks and logs, neatly stacked.
    { name: 'board', u: 0.9, v: 6.1, s: 0.42, cells: [[0, 6]] },
    { name: 'board', u: 0.9, v: 6.1, s: 0.42, lift: 8 },
    { name: 'board', u: 0.9, v: 6.1, s: 0.42, lift: 16 },
    { name: 'log', u: 0.9, v: 7.1, s: 0.42, cells: [[0, 7]] },
    { name: 'log', u: 1.0, v: 7.1, s: 0.42, lift: 20 },

    // The workbench in the middle, on the rug, with its tools and two stools.
    { name: 'round', u: 4.0, v: 4.0, s: 0.9, cells: [[3, 3], [4, 3], [3, 4], [4, 4]] },
    { name: 'hammer', u: 3.65, v: 3.75, s: 0.24, lift: 30, flat: true },
    { name: 'mortar', u: 4.35, v: 3.7, s: 0.28, lift: 30 },
    { name: 'teapot', u: 4.0, v: 4.3, s: 0.2, lift: 32 },
    { name: 'nails', u: 3.65, v: 4.3, s: 0.26, lift: 28, flat: true },
    { name: 'log', u: 2.2, v: 4.6, s: 0.3 },
    { name: 'log', u: 5.85, v: 3.4, s: 0.3 },

    // Front corners.
    { name: 'plant', u: 7.3, v: 7.2, s: 0.46, cells: [[7, 7]] },
    { name: 'crate_dark', u: 6.5, v: 7.1, s: 0.42, cells: [[6, 7]] },
    { name: 'bottle', u: 6.5, v: 7.1, s: 0.34, lift: 46 },
];
