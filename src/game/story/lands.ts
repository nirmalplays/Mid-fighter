/**
 * The four lands of the story, in order, and lookups across them (a prop, a boss, a relic, a
 * puzzle, a site's place on the map).
 */
import { INTERIOR_SITES } from '../world/interiors.ts';
import { landmark, spot, STORY_SITES_BY, type Element } from '../eidolon.ts';
import { LAND1 } from './land1.ts';
import { LAND2 } from './land2.ts';
import { LAND3 } from './land3.ts';
import { LAND4 } from './land4.ts';
import type { BossDef, Land, PropDef, PuzzleDef, RelicDef } from './types.ts';

export const LANDS: Land[] = [LAND1, LAND2, LAND3, LAND4];
export const landOf = (n: number): Land => LANDS[Math.min(LANDS.length, Math.max(1, n)) - 1];
export const landByEl = (e: Element): Land => LANDS.find((l) => l.el === e)!;

/** Every prop, with the land it stands in. */
export const ALL_PROPS: { def: PropDef; land: Land }[] = LANDS.flatMap((land) => land.props.map((def) => ({ def, land })));
export const ALL_BOSSES: Record<string, BossDef & { land: Land }> = Object.fromEntries(LANDS.flatMap((land) => Object.entries(land.bosses).map(([k, b]) => [k, { ...b, land }])));
export const ALL_RELICS: (RelicDef & { land: Land })[] = LANDS.flatMap((land) => land.relics.map((r) => ({ ...r, land })));
export const ALL_PUZZLES: Record<string, PuzzleDef> = Object.assign({}, ...LANDS.map((l) => l.puzzles));
export const bossKeyOf = (code: number): string | null => Object.entries(ALL_BOSSES).find(([, b]) => b.code === code)?.[0] ?? null;

/** A site's centre (tiles) in a land: its camp, a boss spot by alias, or one of its story sites. */
export function siteAt(land: Land, id: string): { u: number; v: number } {
    // A place that lies inside a cave or a ruin (world/interiors.ts).
    const inside = INTERIOR_SITES[land.el]?.[id];
    if (inside) return { u: inside.u, v: inside.v };
    const a = land.alias[id] ?? (id === 'camp' ? 'camp' : undefined);
    if (a === 'camp') {
        const L = landmark('camp', land.el);
        return { u: L.i + 0.5, v: L.j + 0.5 };
    }
    if (a === 'citadel') {
        const L = landmark('citadel', null);
        return { u: L.i + 0.5, v: L.j + 0.5 };
    }
    if (a === 'arena') {
        const L = landmark('arena', land.el);
        return { u: L.i + 0.5, v: L.j + 0.5 };
    }
    if (a) {
        const L = landmark('guard', land.el, Number(a.slice(6)));
        return { u: L.i + 0.5, v: L.j + 0.5 };
    }
    const s = STORY_SITES_BY[land.el][id];
    if (!s) {
        const L = landmark('camp', land.el);
        return { u: L.i + 0.5, v: L.j + 0.5 };
    }
    const p = spot(land.el, s[0], s[1]);
    return { u: p.i + 0.5, v: p.j + 0.5 };
}
