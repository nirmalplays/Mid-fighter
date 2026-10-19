/**
 * World dimensions, matching the Durango mobile regions: 256 × 256 tiles,
 * streamed in 16 × 16-tile chunks (16 × 16 chunks per region). One tile is
 * ~2 m, so the region is ~512 × 512 m.
 *
 * The world is isometric: grid cell (i, j) is drawn at screen position
 * ((i - j) * TILE_DX, (i + j) * TILE_DY), a 2:1 diamond.
 */
export const MAP_TILES = 256;
export const CHUNK_TILES = 16;
export const MAP_CHUNKS = MAP_TILES / CHUNK_TILES;
/** Half the width / half the height of one tile's top face, in world px. */
export const TILE_DX = 62;
export const TILE_DY = 31;
/** Chunks kept loaded around the player: radius 1 → 3 × 3 chunks (96 × 96 m). */
export const LOAD_RADIUS = 1;
/** World px → design units. ~17 tiles fit across the screen height. */
export const ZOOM = 1.5;
