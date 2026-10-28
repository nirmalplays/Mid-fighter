/**
 * World dimensions: the continent of Eidolon is 576 × 576 tiles (grown from 512, before that 384, and
 * before that the 256-tile Durango region; one tile is ~2 m, so ~1.15 × 1.15 km). The grid is 704 × 704:
 * beyond the continent's edge lies nothing but the caves, dungeons and ruins you walk into
 * (world/interiors.ts). Streamed in 16 × 16-tile chunks.
 *
 * The world is isometric: grid cell (i, j) is drawn at screen position
 * ((i - j) * TILE_DX, (i + j) * TILE_DY), a 2:1 diamond.
 */
/** The whole grid (the continent and the interiors beyond it). */
export const MAP_TILES = 704;
/** The continent: everything outside it is interiors and the void between them. */
export const WORLD_TILES = 576;
/**
 * The story's places were laid out on the 384-tile continent and spread out by this when it grew to 512.
 * The last growth (to 576) added wild land around the edge instead, so the places keep their distances
 * from the centre and the new ring is open country (and the vistas: world/vistas.ts).
 */
export const WORLD_SCALE = 512 / 384;
export const CHUNK_TILES = 16;
export const MAP_CHUNKS = MAP_TILES / CHUNK_TILES;
/** Half the width / half the height of one tile's top face, in world px. */
export const TILE_DX = 62;
export const TILE_DY = 31;
/** Chunks kept loaded around the player: radius 1 → 3 × 3 chunks (96 × 96 m). */
export const LOAD_RADIUS = 1;
/** World px → design units. ~17 tiles fit across the screen height. */
export const ZOOM = 1.5;
