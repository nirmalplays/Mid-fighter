/**
 * Ground styles: how a cell is drawn when it is not the plain ground of its kingdom. The overworld
 * paints its lands' biomes with them (ash flats and badlands in Pyraxis, wind-meadows and white cliffs
 * in Zephyria, beaches and coral sand in Aquatica, salt flats and crystal ground in the Void Wastes),
 * and every cave, dungeon and ruin (world/interiors.ts) its floor and walls. A style picks the cube art,
 * its tint, an overlay drawn on top now and then, and the colour on the map. The vistas (world/vistas.ts)
 * have a few of their own: mossy cliffs, basalt, the dragon's hide, paving and tilled fields.
 */

export interface GroundStyle {
    /** The cube art (by variant 1-3 where the art has variants). */
    cube: (variant: number) => string;
    tint: number;
    /** A flat drawn on some of its cells, and how often (0..1). */
    overlay?: { name: string; chance: number };
    /** Grass drawn on top (meadows), tinted with the style. */
    grass?: boolean;
    /** Colour on the map panel. */
    map: [number, number, number];
}

const dirt = (v: number) => `dirt${v}`;
const stone = (v: number) => `stone${v}`;

export const STYLE = {
    NONE: 0,
    // The overworld's biomes.
    ASH: 1, BADLANDS: 2, OBSIDIAN: 3, MEADOW: 4, CLIFF: 5, BEACH: 6, CORAL: 7, SALT: 8, CRYSTAL: 9, SCORCH: 10,
    // The vistas'.
    MOSS_CLIFF: 11, BASALT: 12, SCALES: 13, PLAZA: 14, FIELD: 15,
    // Caves, dungeons and ruins: a floor and a wall for each look.
    ASH_FLOOR: 20, ASH_WALL: 21,
    CRYPT_FLOOR: 22, CRYPT_WALL: 23,
    WOOD_FLOOR: 24, CELLAR_WALL: 25,
    ARCHIVE_FLOOR: 26, ARCHIVE_WALL: 27,
    ICE_FLOOR: 28, ICE_WALL: 29,
    SKY_FLOOR: 30, SKY_WALL: 31,
    VOID_FLOOR: 32, VOID_WALL: 33,
    DROWNED_FLOOR: 34, DROWNED_WALL: 35,
    GROTTO_FLOOR: 36, GROTTO_WALL: 37,
} as const;

export const STYLES: Record<number, GroundStyle> = {
    [STYLE.ASH]: { cube: () => 'sand', tint: 0x8a8486, overlay: { name: 'ash', chance: 0.35 }, map: [118, 112, 114] },
    [STYLE.BADLANDS]: { cube: () => 'ochre', tint: 0xd8a070, map: [196, 128, 80] },
    [STYLE.OBSIDIAN]: { cube: stone, tint: 0x5a4a66, map: [70, 58, 82] },
    [STYLE.SCORCH]: { cube: dirt, tint: 0x8a5a48, overlay: { name: 'lavacrack', chance: 0.035 }, map: [120, 70, 52] },
    [STYLE.MEADOW]: { cube: dirt, tint: 0xffffff, grass: true, map: [110, 176, 90] },
    [STYLE.CLIFF]: { cube: stone, tint: 0xe8ecf4, map: [210, 214, 226] },
    [STYLE.BEACH]: { cube: () => 'sand', tint: 0xfff4dc, map: [236, 218, 170] },
    [STYLE.CORAL]: { cube: () => 'sand', tint: 0xffd8d0, overlay: { name: 'pebbles', chance: 0.12 }, map: [236, 196, 186] },
    [STYLE.SALT]: { cube: () => 'sand', tint: 0xf4f2fa, overlay: { name: 'salt', chance: 0.4 }, map: [236, 234, 242] },
    [STYLE.CRYSTAL]: { cube: (v) => (v === 3 ? 'gem_amat' : stone(v)), tint: 0x9a88b8, map: [140, 120, 170] },
    [STYLE.MOSS_CLIFF]: { cube: stone, tint: 0xb8c4ac, overlay: { name: 'moss', chance: 0.4 }, map: [128, 140, 116] },
    [STYLE.BASALT]: { cube: stone, tint: 0x6e5e5a, overlay: { name: 'lavacrack', chance: 0.08 }, map: [84, 68, 64] },
    [STYLE.SCALES]: { cube: () => 'scales', tint: 0xffffff, map: [190, 84, 64] },
    [STYLE.PLAZA]: { cube: () => 'brick', tint: 0xeee6da, overlay: { name: 'moss', chance: 0.05 }, map: [204, 196, 184] },
    [STYLE.FIELD]: { cube: dirt, tint: 0xd8aa78, map: [176, 132, 84] },

    [STYLE.ASH_FLOOR]: { cube: dirt, tint: 0xa88068, overlay: { name: 'rubble', chance: 0.05 }, map: [150, 112, 90] },
    [STYLE.ASH_WALL]: { cube: (v) => (v === 3 ? 'ore_copper' : stone(v)), tint: 0x7a5a54, map: [60, 42, 40] },
    [STYLE.CRYPT_FLOOR]: { cube: () => 'brick', tint: 0xb4aab8, overlay: { name: 'rubble', chance: 0.04 }, map: [140, 132, 146] },
    [STYLE.CRYPT_WALL]: { cube: () => 'brick', tint: 0x6a6074, map: [52, 46, 60] },
    [STYLE.WOOD_FLOOR]: { cube: () => 'plank', tint: 0xe0c0a0, map: [170, 128, 90] },
    [STYLE.CELLAR_WALL]: { cube: () => 'brick', tint: 0x8a6a5a, map: [70, 50, 42] },
    [STYLE.ARCHIVE_FLOOR]: { cube: () => 'brick', tint: 0xd8b088, overlay: { name: 'lavacrack', chance: 0.05 }, map: [180, 140, 100] },
    [STYLE.ARCHIVE_WALL]: { cube: () => 'brick', tint: 0x8a5a4a, map: [76, 46, 38] },
    [STYLE.ICE_FLOOR]: { cube: stone, tint: 0xd4ecff, overlay: { name: 'ice', chance: 0.18 }, map: [190, 220, 240] },
    [STYLE.ICE_WALL]: { cube: (v) => (v === 3 ? 'gem_lapi' : stone(v)), tint: 0x7a9ac0, map: [70, 96, 130] },
    [STYLE.SKY_FLOOR]: { cube: () => 'brick', tint: 0xf0f0f8, map: [220, 220, 230] },
    [STYLE.SKY_WALL]: { cube: () => 'brick', tint: 0xa0a8c0, map: [110, 116, 140] },
    [STYLE.VOID_FLOOR]: { cube: stone, tint: 0x8a78a8, overlay: { name: 'rubble', chance: 0.04 }, map: [110, 96, 136] },
    [STYLE.VOID_WALL]: { cube: (v) => (v === 3 ? 'gem_amat' : stone(v)), tint: 0x4a3a62, map: [44, 34, 60] },
    [STYLE.DROWNED_FLOOR]: { cube: () => 'brick', tint: 0xa8c8c8, overlay: { name: 'puddle1', chance: 0.08 }, map: [130, 160, 160] },
    [STYLE.DROWNED_WALL]: { cube: () => 'brick', tint: 0x4a6a74, map: [40, 60, 68] },
    [STYLE.GROTTO_FLOOR]: { cube: dirt, tint: 0xc09070, overlay: { name: 'moss', chance: 0.12 }, map: [150, 120, 90] },
    [STYLE.GROTTO_WALL]: { cube: (v) => (v === 3 ? 'gem_ruby' : stone(v)), tint: 0x846058, map: [66, 46, 42] },
};
