/**
 * World dimensions: the continent of Eidolon is 384 × 384 tiles (grown from the 256-tile Durango
 * region; one tile is ~2 m, so ~768 × 768 m). The grid is 512 × 512: beyond the continent's edge lies
 * nothing but the caves, dungeons and ruins you walk into (world/interiors.ts). Streamed in
 * 16 × 16-tile chunks.
 *
 * The world is isometric: grid cell (i, j) is drawn at screen position
 * ((i - j) * TILE_DX, (i + j) * TILE_DY), a 2:1 diamond.
 */
/** The whole grid (the continent and the interiors beyond it). */
export const MAP_TILES = 512;
/** The continent: everything outside it is interiors and the void between them. */
export const WORLD_TILES = 384;
export const CHUNK_TILES = 16;
export const MAP_CHUNKS = MAP_TILES / CHUNK_TILES;
/** Half the width / half the height of one tile's top face, in world px. */
export const TILE_DX = 62;
export const TILE_DY = 31;
/** Chunks kept loaded around the player: radius 1 → 3 × 3 chunks (96 × 96 m). */
export const LOAD_RADIUS = 1;
/** World px → design units. ~17 tiles fit across the screen height. */
export const ZOOM = 1.5;
