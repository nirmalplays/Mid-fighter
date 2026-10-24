/**
 * The survival HUD: health, XP, stamina and the hunger / thirst / rest meters; the story
 * objective (with an arrow to where it points); the boss bar, weather and region; the Use
 * hint, quick-heal and dodge buttons; the Bag (items, crafting, gear and gems, cards, camp,
 * map, story); and the panels for choosing a kingdom, talking to people, houses, travel
 * and the story itself. Same tan-and-plum look as the rest of the HUD (Hud.tsx).
 * Everything here reads the store and calls progress.ts; the world hears commands.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { commands } from '../game/commands.ts';
import { FOG_CELL, FOG_N, levelFromCopies, progress } from '../game/progress.ts';
import { quest } from '../game/story/quest.ts';
import {
    ARMORS, BUILDING_IDS, BUILDINGS, buildCost, CARD_IDS, cardLevelCost, cardSlots, CARDS, chapterAt, CHAPTER_COUNT,
    essenceOf, FOOD, FUSE_N, GEAR_FORGE, GEAR_TOP, gearCost, GEM_SKILL_LIST, gem2Of, gem3Of, infuseCost, INFUSION,
    ITEM_IDS, ITEMS, RARITY_COLOR, RECIPES, STATION_NAME, relicMul, RELICS, socketsFor, WEAPONS, xpToNext, type Bag, type ItemId,
    BACKPACK_TOP, backpackCost, backpackSlots, HOTBAR_SLOTS, slotsUsed, stackOf, } from '../game/survival.ts';
import {
    ELEMENTS, homeOf, KINGDOMS, LANDMARKS, MALAKOR, NPCS, PROLOGUE, type Element,
} from '../game/eidolon.ts';
import { mapRef, radar } from '../game/world/mapRef.ts';
import { useSettings } from '../game/settings.ts';
import { beginStory } from '../game/story/begin.ts';
import { Bar, BROWN, BROWN_DARK, Btn, Cost, Icon, INK, OUTLINE, PANEL, Panel, press, ROW, TAN, TAN_LIGHT } from './hudKit.tsx';
import { InventoryGrid, RepairList, useInventoryKey } from './InventoryModal.tsx';
import { MAP_TILES } from '../game/world/constants.ts';
import { STYLES } from '../game/world/biomes.ts';
import { MAX_HEIGHT, VOID } from '../game/world/mapGen.ts';
import { store, useStore, type AppState } from '../state/store.ts';
import { drawIcon, ELEMENT_ICON, Ico, Sigil, type IconName } from './icons.tsx';
import { useCompact } from './HudTop.tsx';

/** A boss's name and health across the bottom while one is near. */
export function BossBar() {
    const boss = useStore((s) => s.boss);
    if (!boss) return null;
    return (
        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-0.5" style={{ top: 50, width: 'min(420px, 50vw)' }}>
            <span className="flex items-center gap-1 text-[13px] font-bold text-white" style={{ fontFamily: 'var(--font-pixel)', textShadow: OUTLINE }}><Ico name="skull" size={14} color="#fca5a5" /> {boss.name}</span>
            <div className="relative h-[16px] w-full overflow-hidden rounded-md" style={{ background: '#1d1216', border: `3px solid ${boss.css}` }}>
                <div className="absolute inset-y-0 left-0 transition-[width] duration-150" style={{ width: `${(boss.hp / Math.max(1, boss.max)) * 100}%`, background: `linear-gradient(${boss.css}, #7f1d1d)` }} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black tabular-nums text-white" style={{ textShadow: OUTLINE }}>{boss.hp} / {boss.max}</span>
            </div>
        </div>
    );
}

// ------------------------------------------------------------------ objective and buttons


// ------------------------------------------------------------------ bag tabs

type Tab = NonNullable<AppState['bagTab']>;
const TABS: { id: Tab; label: string; title: string; icon: IconName }[] = [
    { id: 'items', label: 'Bag', title: 'Inventory', icon: 'bag' },
    { id: 'craft', label: 'Craft', title: 'Crafting', icon: 'flask' },
    { id: 'gear', label: 'Gear', title: 'Gear & Relics', icon: 'sword' },
    { id: 'cards', label: 'Cards', title: 'Power Cards', icon: 'star' },
    { id: 'camp', label: 'Camp', title: 'The Camp', icon: 'tent' },
    { id: 'map', label: 'Map', title: 'The Map', icon: 'pointer' },
    { id: 'story', label: 'Story', title: 'The Tale', icon: 'scroll' },
];

function CraftTab() {
    const bag = useStore((s) => s.bag);
    const alchemy = useStore((s) => s.buildings.alchemy);
    const fire = useStore((s) => s.fire);
    const camp = useStore((s) => s.inCamp);
    const sheltered = useStore((s) => s.sheltered);
    const at = { fire, camp, bench: camp || sheltered };
    const here = (st: 'alchemy' | 'fire' | 'bench') => (st === 'fire' ? at.fire : st === 'alchemy' ? at.camp : at.bench);
    return (
        <div className="flex flex-col gap-1.5">
            <div className="text-[12px] font-bold leading-snug" style={{ color: camp ? '#15803d' : BROWN_DARK }}>
                {camp ? 'In camp: brew at the Alchemy tent, cook at the fire, make tools at the bench.' : sheltered ? 'In a house: cook at the hearth, make tools at the bench. Potions are brewed in camp.' : 'Out in the wild you can only look. Go back to camp to brew, cook and craft.'}
            </div>
            {RECIPES.map((r, i) => {
                const locked = alchemy < r.alchemy;
                const away = !here(r.at);
                const can = !locked && !away && progress.has(r.cost);
                return (
                    <div key={r.out} className="flex items-center gap-2 rounded-xl px-2 py-1" style={{ ...ROW, opacity: locked ? 0.7 : 1 }}>
                        <Icon id={r.out} size={34} dim={locked} />
                        <div className="flex flex-1 flex-col gap-0.5 leading-tight">
                            <div className="text-[14px] font-black">{ITEMS[r.out].name} <span className="text-[11px]" style={{ color: BROWN_DARK }}>· have {bag[r.out]}</span></div>
                            {locked ? <div className="text-[12px] font-bold" style={{ color: BROWN_DARK }}>Needs Alchemy tent level {r.alchemy}</div> : <Cost cost={r.cost} bag={bag} />}
                            {!locked && away && <div className="text-[11px] font-black" style={{ color: '#9a3412' }}>Made at {STATION_NAME[r.at]}</div>}
                        </div>
                        <Btn disabled={!can} onPress={() => progress.craft(i, at)}>{r.at === 'fire' ? 'Cook' : r.at === 'alchemy' ? 'Brew' : 'Craft'}</Btn>
                    </div>
                );
            })}
        </div>
    );
}

/** A sword picture cut from the sword sheet (6 × 5 swords of 32 px). */
function SwordPic({ i, size = 34, dim = false }: { i: number; size?: number; dim?: boolean }) {
    const k = size / 32;
    return (
        <span
            className="inline-block shrink-0"
            style={{
                width: size, height: size, backgroundImage: 'url(images/swords.png)', backgroundSize: `${192 * k}px ${160 * k}px`,
                backgroundPosition: `${-(i % 6) * 32 * k}px ${-Math.floor(i / 6) * 32 * k}px`, imageRendering: 'pixelated',
                filter: dim ? 'brightness(0) opacity(.35)' : undefined,
            }}
        />
    );
}

/** Relic weapons won from the guardians: hold one instead of the forged weapon. */
function RelicRow() {
    const gear = useStore((s) => s.gear);
    useStore((s) => s.wardens); // the campaign order sets each relic's strength
    return (
        <div className="flex flex-col gap-1 rounded-xl px-2 py-1" style={ROW}>
            <div className="text-[12px] font-black" style={{ color: BROWN_DARK }}>
                Relic weapons · {gear.relics.length}/{RELICS.length} · {gear.relic ? 'a relic is in hand' : 'beat guardians to win them'}
            </div>
            <div className="grid grid-cols-4 gap-1">
                {RELICS.map((r) => {
                    const have = gear.relics.includes(r.id);
                    const held = gear.relic === r.id;
                    const k = KINGDOMS[r.el];
                    return (
                        <button
                            key={r.id}
                            type="button"
                            disabled={!have}
                            onClick={() => progress.equipRelic(held ? null : r.id)}
                            title={have ? `${r.name}: ${r.blurb}` : `Carried by ${k.guard.name} ${r.n} of ${k.name}`}
                            className="flex items-center gap-1 rounded-lg px-1 py-0.5 text-left disabled:cursor-default"
                            style={{ background: held ? k.css : have ? TAN_LIGHT : 'rgba(0,0,0,.08)', border: `2px solid ${held ? INK : have ? k.css : 'transparent'}` }}
                        >
                            <SwordPic i={r.sword} size={26} dim={!have} />
                            <span className="flex flex-col leading-none">
                                <span className="text-[10px] font-black">{have ? r.name : '???'}</span>
                                <span className="flex items-center gap-0.5 text-[9px] font-bold" style={{ color: BROWN_DARK }}>{have && (held ? 'In hand' : `x${relicMul(progress.tierOf(r.el), r.n)}`)}<Ico name={ELEMENT_ICON[r.el]} size={10} color={k.css} /></span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function GearTab() {
    const bag = useStore((s) => s.bag);
    const gear = useStore((s) => s.gear);
    const gems = useStore((s) => s.gems);
    const sockets = useStore((s) => s.sockets);
    const forge = useStore((s) => s.buildings.forge);
    const totem = useStore((s) => s.buildings.totem);
    const inCamp = useStore((s) => s.inCamp);
    const sheltered = useStore((s) => s.sheltered);
    const slots = socketsFor(gear.weapon);
    const tierRow = (kind: 'weapon' | 'armor') => {
        const list = kind === 'weapon' ? WEAPONS : ARMORS;
        const now = gear[kind];
        const next = now + 1;
        const top = next > GEAR_TOP;
        const blocker = top ? null : gear.bp < next ? `Needs the ${list[next].name} blueprint${next === 1 ? ' (talk to Bram)' : next === 2 ? ' (from your first warden)' : ' (from the third warden)'}` : forge < GEAR_FORGE[next] ? `Needs Forge level ${GEAR_FORGE[next]}` : !inCamp ? 'Forge it in camp' : null;
        const cost = top ? {} : gearCost(kind, next);
        return (
            <div className="flex items-center gap-2 rounded-xl px-2 py-1" style={ROW}>
                <Ico name={kind === 'weapon' ? 'sword' : 'shield'} size={26} color={BROWN_DARK} />
                <div className="flex flex-1 flex-col gap-0.5 leading-tight">
                    <div className="text-[14px] font-black">{list[now].name} <span className="text-[11px]" style={{ color: BROWN_DARK }}>{kind === 'weapon' ? `· sword damage x${WEAPONS[now].mul}${gear.relic ? ' · put away while a relic is in hand' : ''}` : `· soaks ${Math.round(ARMORS[now].guard * 100)}% of bites`}</span></div>
                    {top ? <div className="text-[12px] font-bold" style={{ color: BROWN_DARK }}>The finest there is. The forge's level still makes it hit harder.</div> : (
                        <>
                            <div className="text-[12px] font-bold" style={{ color: BROWN_DARK }}>Next: {list[next].name}{blocker ? ` · ${blocker}` : ''}</div>
                            <Cost cost={cost} bag={bag} />
                        </>
                    )}
                </div>
                {!top && <Btn disabled={!!blocker || !progress.has(cost)} onPress={() => progress.craftGear(kind)}>Forge</Btn>}
            </div>
        );
    };
    const gemItems = ITEM_IDS.filter((k) => /^gem[23]_/.test(k) && bag[k] > 0);
    return (
        <div className="flex flex-col gap-2">
            {tierRow('weapon')}
            <RelicRow />
            {tierRow('armor')}
            <RepairList bench={inCamp || sheltered} />

            <div className="text-[12px] font-black" style={{ color: BROWN_DARK }}>Element infusion {gear.infusion ? `· now ${INFUSION[gear.infusion]}` : '· none'}</div>
            <div className="grid grid-cols-2 gap-1.5">
                {ELEMENTS.map((e) => (
                    <div key={e} className="flex flex-col gap-1 rounded-xl px-2 py-1" style={{ ...ROW, borderColor: gear.infusion === e ? KINGDOMS[e].css : BROWN }}>
                        <div className="flex items-center gap-1 text-[12px] font-black"><Icon id={essenceOf(e)} size={20} />{KINGDOMS[e].name}</div>
                        <div className="text-[10px] font-bold leading-tight" style={{ color: BROWN_DARK }}>{INFUSION[e]}</div>
                        <div className="flex items-center justify-between gap-1">
                            <Cost cost={infuseCost(e)} bag={bag} />
                            <Btn disabled={gear.weapon < 1 || gear.infusion === e || !progress.has(infuseCost(e))} onPress={() => progress.infuse(e)}>Infuse</Btn>
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-[12px] font-black" style={{ color: BROWN_DARK }}>Gem fusing at the Arcane totem {totem < 1 ? '· build the totem first' : !inCamp ? '· go to camp' : ''}</div>
            <div className="grid grid-cols-2 gap-1.5">
                {GEM_SKILL_LIST.map((g) => (
                    <div key={g} className="flex flex-col gap-1 rounded-xl px-2 py-1" style={ROW}>
                        <div className="flex items-center gap-1 text-[12px] font-black tabular-nums">
                            <img src={`images/hud/gem-${g}.png`} width={18} height={18} alt="" draggable={false} />{gems[g]}
                            <span className="mx-1">→</span><Icon id={gem2Of(g)} size={18} />{bag[gem2Of(g)]}
                            <span className="mx-1">→</span><Icon id={gem3Of(g)} size={18} />{bag[gem3Of(g)]}
                        </div>
                        <div className="flex gap-1">
                            <Btn disabled={totem < 1 || !inCamp || gems[g] < FUSE_N} onPress={() => progress.fuse(g, 1)}>3 → 1</Btn>
                            <Btn disabled={totem < 1 || !inCamp || bag[gem2Of(g)] < FUSE_N} onPress={() => progress.fuse(g, 2)} color="#c4b5fd">3 → Core</Btn>
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-[12px] font-black" style={{ color: BROWN_DARK }}>Weapon sockets · {sockets.length}/{slots}</div>
            <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: slots }, (_, n) => {
                    const id = sockets[n];
                    return (
                        <button key={n} type="button" className="flex h-[48px] w-[48px] items-center justify-center rounded-lg" style={{ background: id ? '#fff' : 'rgba(0,0,0,.12)', border: `2px dashed ${BROWN}` }} title={id ? `${ITEMS[id].name}: tap to take out` : 'Empty socket'} onPointerDown={press(() => id && progress.unsocket(n))}>
                            {id ? <Icon id={id} size={36} /> : <span className="text-[18px]" style={{ color: BROWN }}>◇</span>}
                        </button>
                    );
                })}
            </div>
            {gemItems.length > 0 && (
                <div className="flex flex-col gap-1">
                    {gemItems.map((k) => (
                        <div key={k} className="flex items-center gap-2 rounded-xl px-2 py-0.5" style={ROW}>
                            <Icon id={k} size={26} />
                            <div className="flex-1 text-[12px] font-bold leading-tight"><b>{ITEMS[k].name}</b> × {bag[k]} · {ITEMS[k].blurb}</div>
                            <Btn disabled={sockets.length >= slots} onPress={() => progress.socket(k)}>Socket</Btn>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function CardsTab() {
    const cards = useStore((s) => s.cards);
    const equipped = useStore((s) => s.equipped);
    const totem = useStore((s) => s.buildings.totem);
    const slots = cardSlots(totem);
    return (
        <div className="flex flex-col gap-2">
            <div className="text-[12px] font-bold" style={{ color: BROWN_DARK }}>Tap a card to wear it. Slots {equipped.length}/{slots} (the Arcane totem adds more). Duplicates level a card up.</div>
            <div className="grid grid-cols-4 gap-1.5">
                {CARD_IDS.map((id) => {
                    const c = CARDS[id];
                    const copies = cards[id] ?? 0;
                    const lv = levelFromCopies(copies);
                    const owned = copies > 0;
                    const on = equipped.includes(id);
                    const toNext = cardLevelCost(lv) - (copies - (lv * (lv + 1)) / 2);
                    return (
                        <button
                            key={id}
                            type="button"
                            className="relative flex flex-col items-center rounded-lg px-1 pb-1 pt-0.5 text-center"
                            style={{
                                minHeight: 118,
                                background: owned ? `linear-gradient(160deg, #fff8ec, ${RARITY_COLOR[c.rarity]}55)` : 'rgba(80,60,60,.25)',
                                border: `3px solid ${on ? '#16a34a' : owned ? RARITY_COLOR[c.rarity] : '#a08a80'}`,
                                boxShadow: on ? '0 0 0 2px #16a34a, 0 0 12px #4ade80' : 'none',
                            }}
                            onPointerDown={press(() => owned && progress.toggleCard(id))}
                        >
                            <span className="text-[9px] font-black uppercase" style={{ color: owned ? RARITY_COLOR[c.rarity] : '#7a6a62' }}>{c.rarity}</span>
                            <Ico name={c.glyph as IconName} size={30} color={owned ? RARITY_COLOR[c.rarity] : '#5a4a44'} style={{ margin: '2px 0', filter: owned ? 'drop-shadow(0 1px 0 rgba(0,0,0,.35))' : 'none' }} />
                            <span className="text-[11px] font-black leading-tight" style={{ color: INK }}>{owned ? c.name : '???'}</span>
                            {owned && <span className="text-[10px] font-black" style={{ color: BROWN_DARK }}>Lv {lv}{on ? ' · on' : ''}</span>}
                            {owned && <span className="text-[9px] font-bold leading-tight" style={{ color: INK }}>{c.power(lv)}</span>}
                            {owned && <span className="mt-auto text-[9px] font-bold" style={{ color: BROWN_DARK }}>{toNext} more to Lv {lv + 1}</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/** Rest: a full night's rest and half your health back, if nothing is hunting you. */
function restNow() {
    progress.rest();
    const s = store.get();
    store.patch({ hp: Math.min(s.maxHp, s.hp + Math.ceil(s.maxHp / 2)), banner: { text: 'You rest. Rested and healed', id: Date.now() } });
}

function CampTab() {
    const bag = useStore((s) => s.bag);
    const buildings = useStore((s) => s.buildings);
    const inCamp = useStore((s) => s.inCamp);
    const fire = useStore((s) => s.fire);
    const danger = useStore((s) => s.danger);
    const canRest = inCamp && fire && !danger;
    return (
        <div className="flex flex-col gap-1.5">
            <div className="text-[12px] font-bold" style={{ color: inCamp ? '#15803d' : '#b91c1c' }}>
                {inCamp ? 'You are in a liberated camp: you can build here.' : 'Go back to a liberated camp to build.'} Buildings have no top level.
            </div>
            <div className="flex items-center gap-2 rounded-xl px-2 py-1" style={ROW}>
                <Ico name="campfire" size={24} color="#e8590c" />
                <div className="flex-1 text-[12px] font-bold leading-tight">Rest by the fire: rest refills and half your health comes back.{danger ? ' Not with monsters this close!' : !fire && inCamp ? ' The rain has put the fire out.' : ''}</div>
                <Btn disabled={!canRest} onPress={restNow}>Rest</Btn>
            </div>
            {BUILDING_IDS.map((id) => {
                const lv = buildings[id];
                const cost = buildCost(lv);
                const can = inCamp && progress.has(cost);
                return (
                    <div key={id} className="flex items-center gap-2 rounded-xl px-2 py-1" style={ROW}>
                        <img src={`images/world/camp/${BUILDINGS[id].art}.png`} width={44} height={44} draggable={false} alt="" style={{ objectFit: 'contain', opacity: lv > 0 ? 1 : 0.5 }} />
                        <div className="flex flex-1 flex-col gap-0.5 leading-tight">
                            <div className="text-[14px] font-black">{BUILDINGS[id].name} · {lv > 0 ? `Lv ${lv}` : 'not built'}</div>
                            <div className="text-[11px] font-bold" style={{ color: BROWN_DARK }}>Next: {BUILDINGS[id].blurb(lv + 1)}</div>
                            <Cost cost={cost} bag={bag} />
                        </div>
                        <Btn disabled={!can} onPress={() => progress.upgrade(id)}>{lv > 0 ? 'Upgrade' : 'Build'}</Btn>
                    </div>
                );
            })}
        </div>
    );
}

// ---- the map: terrain from the generated world, hidden where not yet explored
const TERRAIN_RGB = [[96, 160, 72], [150, 116, 76], [222, 204, 150], [138, 134, 140], [60, 120, 200]];
let baseImage: { map: unknown; data: ImageData } | null = null;
function mapBase(): ImageData | null {
    const m = mapRef.get();
    if (!m) return null;
    if (baseImage && baseImage.map === m) return baseImage.data;
    const N = MAP_TILES;
    const data = new ImageData(N, N);
    for (let k = 0; k < N * N; k++) {
        const t = m.terrain[k];
        // The void between the interiors stays clear (the panel's dark shows through).
        if (t === VOID) continue;
        const style = STYLES[m.style[k]];
        let [r, g, b] = style ? style.map : TERRAIN_RGB[t] ?? [0, 0, 0];
        if (t === 4) [r, g, b] = m.region[k] === 1 ? [230, 100, 40] : TERRAIN_RGB[4];
        const tint = style || m.region[k] > 4 ? 0xffffff : m.region[k] === 0 ? 0xc0b0d0 : KINGDOMS[ELEMENTS[m.region[k] - 1]].ground;
        const lift = 0.8 + 0.04 * Math.min(MAX_HEIGHT, m.height[k]);
        data.data[k * 4] = Math.min(255, r * lift * (((tint >> 16) & 255) / 255));
        data.data[k * 4 + 1] = Math.min(255, g * lift * (((tint >> 8) & 255) / 255));
        data.data[k * 4 + 2] = Math.min(255, b * lift * ((tint & 255) / 255));
        data.data[k * 4 + 3] = 255;
    }
    baseImage = { map: m, data };
    return data;
}

function MapTab() {
    const ref = useRef<HTMLCanvasElement>(null);
    const tileX = useStore((s) => s.tileX);
    const tileY = useStore((s) => s.tileY);
    const wardens = useStore((s) => s.wardens);
    const guards = useStore((s) => s.guards);
    const towers = useStore((s) => s.towers);
    const N = MAP_TILES;
    useEffect(() => {
        const c = ref.current;
        const base = mapBase();
        if (!c || !base) return;
        const ctx = c.getContext('2d')!;
        ctx.putImageData(base, 0, 0);
        // Fog over the cells not yet seen.
        const bits = progress.explored();
        ctx.fillStyle = 'rgba(24,16,30,.92)';
        for (let y = 0; y < FOG_N; y++) {
            for (let x = 0; x < FOG_N; x++) {
                const n = y * FOG_N + x;
                if (!(bits[n >> 3] & (1 << (n & 7)))) ctx.fillRect(x * FOG_CELL, y * FOG_CELL, FOG_CELL, FOG_CELL);
            }
        }
    }, [tileX, tileY, towers]);
    // The map is drawn in tile space; turn it 45° so it matches the isometric view (north-west up).
    const seen = (i: number, j: number) => {
        const bits = progress.explored();
        const n = Math.floor(j / FOG_CELL) * FOG_N + Math.floor(i / FOG_CELL);
        return !!(bits[n >> 3] & (1 << (n & 7)));
    };
    const pin = (i: number, j: number, icon: IconName, color: string, key: string, title: string) => (
        <span key={key} title={title} className="absolute -translate-x-1/2 -translate-y-1/2 leading-none" style={{ left: `${(i / N) * 100}%`, top: `${(j / N) * 100}%`, transform: 'translate(-50%,-50%) rotate(-45deg)', filter: 'drop-shadow(0 1px 1px #000)' }}><Ico name={icon} size={13} color={color} /></span>
    );
    const pins: ReactNode[] = [];
    for (const L of LANDMARKS) {
        if (!seen(L.i, L.j) && L.kind !== 'citadel') continue;
        if (L.kind === 'camp') pins.push(pin(L.i, L.j, 'campfire', '#fb923c', L.id, `${KINGDOMS[L.el!].name} camp`));
        else if (L.kind === 'tower') pins.push(pin(L.i, L.j, 'tower', towers.includes(L.id) ? '#e5e7eb' : '#9ca3af', L.id, 'Watchtower'));
        else if (L.kind === 'house') pins.push(pin(L.i, L.j, 'house', '#fde68a', L.id, 'House'));
        else if (L.kind === 'guard' && !guards.includes(`${L.el}:${L.n}`)) pins.push(pin(L.i, L.j, 'skull', '#f87171', L.id, KINGDOMS[L.el!].guard.name));
        else if (L.kind === 'arena') pins.push(pin(L.i, L.j, wardens.includes(L.el!) ? 'check' : 'swords', wardens.includes(L.el!) ? '#4ade80' : '#e879f9', L.id, `Arena of ${KINGDOMS[L.el!].name}`));
        else if (L.kind === 'citadel') pins.push(pin(L.i, L.j, 'vortex', '#c084fc', L.id, 'Void Citadel'));
    }
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative overflow-hidden rounded-xl" style={{ width: 'min(330px, 70vw)', aspectRatio: '1', border: `3px solid ${BROWN}`, background: '#181018' }}>
                <div className="absolute inset-[15%]" style={{ transform: 'rotate(45deg)' }}>
                    <canvas ref={ref} width={N} height={N} className="absolute inset-0 h-full w-full" style={{ imageRendering: 'pixelated' }} />
                    {pins}
                    <span className="absolute h-3 w-3 rounded-full" style={{ left: `${(tileX / N) * 100}%`, top: `${(tileY / N) * 100}%`, transform: 'translate(-50%,-50%)', background: '#fff', border: '2px solid #ef4444', boxShadow: '0 0 6px #fff' }} />
                </div>
            </div>
            <div className="text-[11px] font-bold" style={{ color: BROWN_DARK }}>Explore or climb watchtowers to clear the fog. Tap the minimap for the full map.</div>
        </div>
    );
}

function StoryTab() {
    const obj = useStore((s) => s.objective);
    const kingdom = useStore((s) => s.kingdom);
    const wardens = useStore((s) => s.wardens);
    const guards = useStore((s) => s.guards);
    const malakor = useStore((s) => s.malakor);
    const step = obj?.step ?? 0;
    const order = kingdom ? progress.order() : null;
    return (
        <div className="flex flex-col gap-2">
            <div className="rounded-xl px-2 py-1.5" style={ROW}>
                <div className="text-[11px] font-black uppercase" style={{ color: BROWN_DARK }}>{step < CHAPTER_COUNT ? `Chapter ${step + 1} of ${CHAPTER_COUNT}` : 'Endless echoes'}</div>
                <div className="text-[16px] font-black">{obj?.title}</div>
                <div className="text-[13px] font-bold">{obj?.task} · {obj?.have}/{obj?.need}</div>
            </div>
            <div className="text-[12px] font-black" style={{ color: BROWN_DARK }}>The kingdoms</div>
            <div className="grid grid-cols-2 gap-1.5">
                {(order ?? [...ELEMENTS]).map((e) => {
                    const k = KINGDOMS[e];
                    const freed = wardens.includes(e);
                    const open = progress.open(e);
                    const g = [1, 2, 3].filter((n) => guards.includes(`${e}:${n}`)).length;
                    return (
                        <div key={e} className="flex flex-col rounded-lg p-1.5 leading-tight" style={{ background: freed ? `${k.css}33` : 'rgba(0,0,0,.06)', border: `2px solid ${open ? k.css : '#b8a59a'}` }}>
                            <span className="flex items-center gap-1 text-[13px] font-black"><Sigil el={e} size={16} /> {k.name}{e === kingdom ? ' · home' : ''}</span>
                            <span className="text-[10px] font-bold" style={{ color: BROWN_DARK }}>{k.land}</span>
                            <span className="flex items-center gap-1 text-[11px] font-bold">{freed ? <><Ico name="check" size={12} color="#15803d" /> {k.warden.name} defeated</> : open ? `Guardians ${g}/3 · ${k.warden.name} waits` : <><Ico name="lock" size={12} color={BROWN_DARK} /> Sealed</>}</span>
                            <span className="text-[10px] font-bold" style={{ color: freed || e === kingdom ? '#15803d' : BROWN_DARK }}>Power: {k.power}</span>
                        </div>
                    );
                })}
            </div>
            <div className="rounded-lg p-1.5 text-[12px] font-bold" style={{ background: 'rgba(139,92,246,.15)', border: '2px solid #8b5cf6' }}>
                <Ico name="vortex" size={13} color="#7c3aed" /> {MALAKOR.name}, {MALAKOR.title}: {malakor > 0 ? `defeated ${malakor} time${malakor > 1 ? 's' : ''}` : wardens.length >= 4 ? 'waits in the Void Citadel' : `hidden behind ${4 - wardens.length} seal${4 - wardens.length > 1 ? 's' : ''}`}
            </div>
            <div className="text-[12px] font-black" style={{ color: BROWN_DARK }}>The tale so far</div>
            <div className="flex flex-col gap-0.5">
                {Array.from({ length: Math.min(step, CHAPTER_COUNT) }, (_, i) => (
                    <div key={i} className="flex items-center gap-1 text-[12px] font-bold"><Ico name="check" size={12} color="#15803d" /> {i + 1}. {chapterAt(i, order).title}</div>
                ))}
                {step === 0 && <div className="text-[12px] font-bold" style={{ color: BROWN_DARK }}>Nothing yet. Your story starts now.</div>}
            </div>
            <Btn color="#fff" onPress={() => store.patch({ bagTab: null, storyPopup: { speaker: 'Master Orin', title: 'The Shattering', lines: PROLOGUE.map((p) => p.text) } })}>Hear the prologue again</Btn>
        </div>
    );
}

/** The bag: items, crafting, gear, cards, the camp, the map and the story. */
export function BagPanel() {
    const tab = useStore((s) => s.bagTab);
    useInventoryKey();
    if (!tab) return null;
    const t = TABS.find((x) => x.id === tab)!;
    const close = () => store.patch({ bagTab: null });
    return (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center p-[min(16px,2vh)]" style={{ background: 'rgba(6,4,10,.62)', backdropFilter: 'blur(3px)' }} onPointerDown={(e) => e.target === e.currentTarget && close()} data-quiet>
            {/* the satchel: dark leather, a double gold edge, gold flourishes in the corners */}
            <div className="relative flex h-[min(640px,94vh)] w-[min(1060px,97vw)] gap-3 rounded-[14px] p-[min(14px,2vh)]"
                style={{ background: 'radial-gradient(ellipse at 40% 20%, #45301f 0%, #2a1c12 60%, #1e140c 100%)', border: '3px solid #d9a441', boxShadow: 'inset 0 0 0 4px #2a1c12, inset 0 0 0 5px #8a6424, 0 20px 60px rgba(0,0,0,.6)', animation: 'act-in .2s ease-out both' }}>
                <BagFlourish className="left-[-10px] top-[-12px]" />
                <BagFlourish className="right-[-10px] top-[-12px]" flip />
                {/* the sections, down the left */}
                <div className="flex shrink-0 flex-col items-center gap-2 rounded-xl px-1.5 py-2" style={{ background: 'linear-gradient(180deg, #24170e, #1a110a)', border: '2px solid #8a6424' }}>
                    {TABS.map((x) => {
                        const on = x.id === tab;
                        return (
                            <button key={x.id} type="button" title={x.label} aria-label={x.label} onPointerDown={press(() => store.patch({ bagTab: x.id }))}
                                className="flex h-[min(46px,7.5vh)] w-[min(46px,7.5vh)] items-center justify-center rounded-full transition-transform hover:scale-105"
                                style={{ background: on ? 'radial-gradient(circle at 50% 35%, #ffe08a, #d9a441 60%, #8a6424)' : 'transparent', border: `2px solid ${on ? '#ffe9b0' : 'transparent'}`, boxShadow: on ? '0 0 12px rgba(255,200,90,.5)' : 'none' }}>
                                <Ico name={x.icon} size={22} color={on ? '#2a1a10' : '#d9a441'} />
                            </button>
                        );
                    })}
                </div>
                {/* the page */}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                        <div className="leading-none">
                            <div className="text-[min(40px,7vh)] leading-none" style={{ fontFamily: 'var(--font-relic)', color: '#e9b95a', textShadow: '0 2px 0 #1a0f08' }}>{t.title}</div>
                            <div className="mt-1 text-[12px] font-semibold tracking-[0.18em] text-[#c9b08a]" style={{ fontFamily: 'var(--font-pixel)' }}>{t.label}</div>
                        </div>
                        <button type="button" aria-label="Close" onPointerDown={press(close)}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105"
                            style={{ background: 'radial-gradient(circle at 50% 35%, #4a3220, #24170e)', border: '2.5px solid #d9a441', boxShadow: '0 0 0 2px #1a110a' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24"><path d="M10 5 3 12l7 7v-4.5c5 0 8.5 1.5 11 5-1-6-4.5-10.5-11-11.5z" fill="#e9b95a" /></svg>
                        </button>
                    </div>
                    {tab === 'items' ? (
                        <div className="min-h-0 flex-1"><InventoryGrid /></div>
                    ) : (
                        // the other sections on a parchment page, like a journal inside the satchel
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg p-2.5" style={{ background: `linear-gradient(${TAN_LIGHT}, ${TAN})`, border: '2px solid #8a6424', boxShadow: 'inset 0 0 18px rgba(90,50,20,.35)', color: INK }}>
                            {tab === 'craft' && <CraftTab />}
                            {tab === 'gear' && <GearTab />}
                            {tab === 'cards' && <CardsTab />}
                            {tab === 'camp' && <CampTab />}
                            {tab === 'map' && <MapTab />}
                            {tab === 'story' && <StoryTab />}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/** A gold flourish for the satchel's top corners. */
function BagFlourish({ className, flip = false }: { className: string; flip?: boolean }) {
    return (
        <svg className={`pointer-events-none absolute ${className}`} width="120" height="70" viewBox="0 0 120 70" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
            <path d="M6 64 C6 30 20 12 46 8 C64 5 78 12 84 24 C90 36 80 46 70 42 C62 39 64 30 70 30" fill="none" stroke="#d9a441" strokeWidth="4" strokeLinecap="round" />
            <path d="M14 64 C16 40 28 24 46 20 C58 18 66 24 66 30" fill="none" stroke="#8a6424" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M46 8 C54 2 64 2 72 6" fill="none" stroke="#d9a441" strokeWidth="3" strokeLinecap="round" />
            <circle cx="6" cy="64" r="4" fill="#d9a441" />
        </svg>
    );
}

// ------------------------------------------------------------------ people, places, story

/** A portrait from the character art, tinted like the person in the world. */
function Portrait({ tint, size = 72 }: { tint: string; size?: number }) {
    return (
        <div className="shrink-0 overflow-hidden rounded-xl" style={{ width: size, height: size, border: `3px solid ${BROWN}`, background: `radial-gradient(circle at 50% 40%, ${tint}, #3b2253)` }}>
            <div style={{ width: '100%', height: '100%', backgroundImage: 'url(images/world/char/idle.png)', backgroundRepeat: 'no-repeat', backgroundSize: `${(1440 / 180) * size * 1.25}px ${(900 / 180) * size * 1.25}px`, backgroundPosition: `${-size * 0.3}px ${-size * 0.18}px` }} />
        </div>
    );
}
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Talking to someone in camp: a greeting, questions to ask, and what they can do for you. */
export function NpcPanel() {
    const id = useStore((s) => s.npc);
    const [answer, setAnswer] = useState<number | null>(null);
    const [gift, setGift] = useState<string | null>(null);
    useEffect(() => {
        setAnswer(null);
        setGift(id ? progress.talk(id) : null);
    }, [id]);
    if (!id) return null;
    const npc = NPCS[id];
    const close = () => store.patch({ npc: null });
    const story = quest.active();
    // In the story Lyra cannot talk: you sit with her, and how she is shows how far you have come.
    const greet = story && id === 'lyra' ? quest.bedside() : npc.greet;
    const action = id === 'varis' ? { label: 'Open the forge', tab: 'gear' as const } : id === 'lyra' ? (story ? null : { label: 'Show me remedies', tab: 'craft' as const }) : id === 'kael' ? { label: 'Craft turrets', tab: 'craft' as const } : { label: 'The story so far', tab: 'story' as const };
    return (
        <Panel z={25} width={520} onClose={close}>
            <div className="flex items-start gap-3">
                <Portrait tint={hex(npc.tint)} />
                <div className="flex flex-1 flex-col gap-1">
                    <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: BROWN_DARK }}>{npc.name} · {npc.role}</div>
                    <p className="text-[14px] font-bold leading-snug">{answer === null ? (story && id === 'lyra' ? greet : `"${greet}"`) : story && id === 'lyra' ? npc.talk[answer].a : `"${npc.talk[answer].a}"`}</p>
                    {gift && <p className="text-[12px] font-black" style={{ color: '#15803d' }}>{gift}</p>}
                </div>
            </div>
            <div className="flex flex-col gap-1">
                {npc.talk.map((t, i) => (
                    <button key={i} type="button" className="rounded-lg px-2 py-1 text-left text-[13px] font-bold" style={{ background: answer === i ? '#fff' : 'rgba(255,255,255,.45)', border: `2px solid ${BROWN}` }} onPointerDown={press(() => setAnswer(i))}>
                        › {t.q}
                    </button>
                ))}
            </div>
            <div className="flex justify-end gap-2">
                {action && <Btn color="#fde68a" onPress={() => store.patch({ npc: null, bagTab: action.tab })}>{action.label}</Btn>}
                <Btn color="#fff" onPress={close}>{story && id === 'lyra' ? 'Let her rest' : 'Goodbye'}</Btn>
            </div>
        </Panel>
    );
}

/** A house's workbench: repair, rest out of the weather, cook at the hearth. */
export function HousePanel() {
    const house = useStore((s) => s.house);
    const danger = useStore((s) => s.danger);
    if (!house) return null;
    const leave = () => store.patch({ house: null });
    return (
        <Panel z={24} width={480} onClose={leave}>
            <div className="relative h-[70px] overflow-hidden rounded-xl" style={{ border: `3px solid ${BROWN}`, background: '#6b4a3a url(images/ui/interior.png) repeat', backgroundSize: '208px 288px', imageRendering: 'pixelated' }}>
                <div className="absolute inset-0 flex items-end p-2" style={{ background: 'linear-gradient(transparent, rgba(30,15,20,.75))' }}>
                    <span className="text-[16px] font-black text-white" style={{ textShadow: OUTLINE }}>Workbench{house.el ? ` · a house in ${KINGDOMS[house.el].name}` : ''}</span>
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                <RepairList bench />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                <Btn disabled={danger} onPress={restNow}>Rest</Btn>
                <Btn color="#fde68a" onPress={() => store.patch({ bagTab: 'craft' })}>Cook &amp; craft</Btn>
                <Btn color="#fff" onPress={leave}>Done</Btn>
            </div>
        </Panel>
    );
}

/** Travel between liberated camps from a camp fire. */
export function TravelPanel() {
    const open = useStore((s) => s.travel);
    const wardens = useStore((s) => s.wardens);
    useStore((s) => s.kingdom);
    if (!open) return null;
    const close = () => store.patch({ travel: false });
    return (
        <Panel z={24} width={380} onClose={close}>
            <div className="text-[16px] font-black">Travel between camps</div>
            <div className="text-[12px] font-bold" style={{ color: BROWN_DARK }}>Every liberated kingdom's camp fire is linked to the others.</div>
            {ELEMENTS.filter((e) => progress.open(e)).map((e) => (
                <Btn key={e} color="#fde68a" onPress={() => { const h = homeOf(e); store.patch({ travelTo: h, travel: false }); }}>
                    <Sigil el={e} size={18} /> {KINGDOMS[e].name} camp {wardens.includes(e) ? '· freed' : ''}
                </Btn>
            ))}
            <Btn color="#fff" onPress={close}>Stay here</Btn>
        </Panel>
    );
}

/** Pledge to one of the four kingdoms (a save without one): the same orrery as after the intro. */
export function KingdomChooser() {
    const kingdom = useStore((s) => s.kingdom);
    const popup = useStore((s) => s.storyPopup);
    const phase = useStore((s) => s.phase);
    // A save without a land yet: the story begins in Pyraxis (there is nothing to choose).
    useEffect(() => {
        if (!kingdom && !popup && phase === 'playing') beginStory();
    }, [kingdom, popup, phase]);
    return null;
}

/** How each kind of story page is framed. */
const PAGE_LOOK = {
    cinematic: { back: 'rgba(3,4,8,.86)', card: { background: 'transparent', border: 'none', boxShadow: 'none', color: '#f5ead2' }, head: '#e0a948', font: 'var(--font-pixel)' },
    flashback: { back: 'radial-gradient(ellipse at center, rgba(120,72,20,.35), rgba(30,16,4,.9))', card: { background: 'linear-gradient(#f6e3b4, #e9c98a)', border: '3px solid #8a5a1a', color: '#3a2008', boxShadow: '0 0 40px rgba(255,190,90,.45)' }, head: '#8a4a0a', font: 'var(--font-pixel)' },
    vision: { back: 'radial-gradient(ellipse at center, rgba(60,20,90,.45), rgba(6,2,14,.92))', card: { background: 'rgba(18,8,32,.92)', border: '3px solid #9d6bff', color: '#e9ddff', boxShadow: '0 0 30px rgba(157,107,255,.55), inset 0 0 18px rgba(64,224,208,.25)' }, head: '#5eead4', font: 'var(--font-pixel)' },
    scroll: { back: 'rgba(10,6,16,.6)', card: { background: '#efe0bb', border: '4px double #6b4a1a', color: '#2e1d08', boxShadow: '0 6px 20px rgba(0,0,0,.5)' }, head: '#6b4a1a', font: 'var(--font-pixel)' },
} as const;

/** A story dialog: the prologue, a chapter, a cinematic beat, a flashback, a relic vision, a recovered scroll. Pages wait their turn. */
export function StoryDialog() {
    const popup = useStore((s) => s.storyPopup);
    const queued = useStore((s) => s.storyQueue.length);
    const [page, setPage] = useState(0);
    const speaker = popup?.speaker ?? 'Master Orin';
    const tint = useMemo(() => hex(NPCS.theron.tint), []);
    useEffect(() => setPage(0), [popup]);
    if (!popup) return null;
    const pages = popup.lines;
    const last = page >= pages.length - 1;
    const close = () => {
        setPage(0);
        store.nextPage();
        progress.markIntroSeen();
        progress.publishObjective();
    };
    const next = () => (last ? close() : setPage((p) => p + 1));
    const look = popup.style ? PAGE_LOOK[popup.style] : null;
    if (look) {
        const cine = popup.style === 'cinematic';
        return (
            <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center" style={{ background: look.back }} onPointerDown={press(next)}>
                {cine && <div className="absolute inset-x-0 top-0 h-[11vh] bg-black" />}
                {cine && <div className="absolute inset-x-0 bottom-0 h-[11vh] bg-black" />}
                <div className={`relative flex w-[min(640px,92vw)] flex-col gap-2 p-4 ${popup.style === 'vision' ? 'story-vision' : ''}`} style={{ ...look.card, borderRadius: 6, imageRendering: 'pixelated' }}>
                    <div className="text-[12px] uppercase tracking-[0.2em]" style={{ color: look.head }}>{speaker}</div>
                    <div className="text-[26px] leading-none" style={{ fontFamily: 'var(--font-relic)', color: look.head }}>{popup.title}</div>
                    <p key={page} className="story-line text-[17px] leading-snug" style={{ fontFamily: look.font, fontStyle: popup.style === 'flashback' ? 'italic' : 'normal', fontSize: cine ? 20 : 17 }}>{pages[page]}</p>
                    {last && popup.reward && <p className="text-[13px]" style={{ color: popup.style === 'flashback' || popup.style === 'scroll' ? '#166534' : '#86efac' }}>{popup.reward}</p>}
                    <div className="flex items-center justify-between text-[12px]" style={{ color: look.head }}>
                        <span>{page + 1}/{pages.length}{queued > 0 ? ` · ${queued} more` : ''}</span>
                        <span className="story-blink">{last ? 'Tap to continue' : 'Tap ›'}</span>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="pointer-events-auto absolute inset-0 z-50 flex items-end justify-center pb-6" style={{ background: 'rgba(10,6,16,.55)' }}>
            <div className="flex w-[min(580px,94vw)] items-start gap-3 rounded-2xl p-3" style={PANEL}>
                <Portrait tint={tint} />
                <div className="flex flex-1 flex-col gap-1.5">
                    <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: BROWN_DARK }}>{speaker} · {popup.title}</div>
                    <p className="text-[15px] font-bold leading-snug">{pages[page]}</p>
                    {last && popup.reward && <p className="text-[12px] font-black" style={{ color: '#15803d' }}>{popup.reward}</p>}
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black" style={{ color: BROWN_DARK }}>{page + 1}/{pages.length}</span>
                        <Btn onPress={next}>{last ? (queued > 0 ? 'Next ›' : "Let's go") : 'Next ›'}</Btn>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** The prologue, the first time a player starts (then they choose a kingdom). */
export function maybeShowIntro(): void {
    if (store.get().storyPopup || progress.introSeen()) return;
    store.patch({ storyPopup: { speaker: 'Master Orin', title: 'The Shattering', lines: PROLOGUE.map((p) => p.text) } });
}

// ------------------------------------------------------------------ hotbar, skill, sprint, sky, radar, downed

/** The four hotbar slots (keys 1-4): tools and weapons go in hand; food, drink and traps are used at once. */
export function Hotbar4() {
    const hotbar = useStore((s) => s.hotbar);
    const held = useStore((s) => s.held);
    const bag = useStore((s) => s.bag);
    const gear = useStore((s) => s.gear.weapon);
    const [name, setName] = useState<string | null>(null);
    const timer = useRef(0);
    const pick = (n: number) => {
        commands.emit({ type: 'slot', index: n });
        const id = hotbar[n];
        setName(id ? (id === 'tool_sword' ? WEAPONS[gear].name : ITEMS[id].name) : 'Bare hands');
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setName(null), 1500);
    };
    return (
        <div className="pointer-events-none absolute bottom-2 flex flex-col items-center gap-1 pb-safe-bottom" style={{ left: 150, right: 300 }} data-quiet>
            <div className="h-5 text-sm font-bold text-white transition-opacity duration-300" style={{ textShadow: '0 1px 3px #000', opacity: name ? 1 : 0 }}>{name ?? ''}</div>
            <div className="flex gap-[10px]">
                {hotbar.map((id, n) => {
                    const owned = id ? bag[id] > 0 : true;
                    const sel = n === held && (!id || !!ITEMS[id].tool);
                    return (
                        <button
                            key={n}
                            type="button"
                            aria-label={id ? ITEMS[id].name : 'Empty slot'}
                            className="pointer-events-auto relative flex touch-none items-center justify-center"
                            style={{
                                // the pack's small frames as 9-slices: stone for a slot, wood with studs for the one in hand
                                width: 50, height: 50, boxSizing: 'border-box', borderStyle: 'solid', borderWidth: 8,
                                borderImage: `url(images/ui/${sel ? 'slot8' : 'slot5'}.png) 4 fill / 8px stretch`, imageRendering: 'pixelated', opacity: owned ? 1 : 0.45,
                            }}
                            onPointerDown={press(() => pick(n))}
                        >
                            {id ? <Icon id={id} size={32} /> : <span className="text-[10px] text-[#2f2a35]/70">hands</span>}
                            {id && !ITEMS[id].tool && <span className="absolute -right-[4px] -top-[5px] text-[11px] text-white" style={{ textShadow: '0 2px 0 #000, 0 0 2px #000' }}>{bag[id]}</span>}
                            <span className="absolute -bottom-[7px] -left-[4px] text-[10px] leading-none text-white" style={{ textShadow: '0 2px 0 #000, 0 0 2px #000' }}>{n + 1}</span>
                            {sel && <span className="pointer-events-none absolute -inset-[15px]" style={{ backgroundImage: 'url(images/ui/corners-white.png)', backgroundSize: '240px 80px', imageRendering: 'pixelated', animation: 'corners 0.9s steps(1) infinite' }} />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/** Fallen in co-op: how long until you bleed out. */
export function DownedOverlay() {
    const downed = useStore((s) => s.downed);
    if (downed === null) return null;
    return (
        <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ top: '38%' }}>
            <div className="rounded-xl px-4 py-2 text-center" style={{ background: 'rgba(60,10,16,.85)', border: '3px solid #ef4444' }}>
                <div className="text-[18px] font-black text-white">You are down</div>
                <div className="text-[13px] font-bold text-white/90">A teammate can help you up · {downed}s</div>
            </div>
        </div>
    );
}

// ------------------------------------------------------------------ the radar and the big map
// Both are drawn by one painter, so they always agree: the land as explored (fog hides the rest,
// for good once seen), trees and rocks, houses, towers, camps and their tents, the people of your
// camp, the bosses still to beat (skulls, the arena's gate, the demon, the citadel), monsters, the
// side the next wave comes from, and you.

/** The icons and colours the map marks camp tents with. */
const TENT_ICON: Record<string, [IconName, string]> = { forge: ['anvil', '#fdba74'], alchemy: ['flask', '#7dd3fc'], healer: ['cross', '#fca5a5'], totem: ['crystal', '#c4b5fd'], store: ['crate', '#fde68a'] };

/** The painted land (one pixel per tile) and the trees and rocks, made once per map. */
const mapArt = { map: null as ReturnType<typeof mapRef.get>, off: null as HTMLCanvasElement | null, nodes: new Map<number, { i: number; j: number; rock: boolean }[]>() };
const BUCKET = 16;
function mapReady() {
    const map = mapRef.get();
    if (!map) return null;
    if (mapArt.map !== map) {
        const base = mapBase();
        if (!base) return null;
        const off = document.createElement('canvas');
        off.width = off.height = MAP_TILES;
        off.getContext('2d')!.putImageData(base, 0, 0);
        const nodes = new Map<number, { i: number; j: number; rock: boolean }[]>();
        for (const p of map.props) {
            const rock = p.name.startsWith('rock');
            if (!rock && !p.name.startsWith('tree_')) continue;
            const key = Math.floor(p.j / BUCKET) * 1000 + Math.floor(p.i / BUCKET);
            let list = nodes.get(key);
            if (!list) nodes.set(key, (list = []));
            list.push({ i: p.i, j: p.j, rock });
        }
        Object.assign(mapArt, { map, off, nodes });
    }
    return map;
}

interface MapView {
    /** Canvas size (in canvas pixels), the tile at its centre, and pixels per tile. */
    W: number;
    H: number;
    cu: number;
    cv: number;
    k: number;
    /** A round radar (edge markers on the rim) or the big rectangle. */
    round: boolean;
    /** Sizes of glyphs and dots, in canvas pixels. */
    g: number;
    dot: number;
    now: number;
    /** Kingdom names across the land (the big map). */
    names?: boolean;
    /** Room kept clear on the right edge (the big map's buttons), canvas pixels. */
    padR?: number;
}

function paintMap(ctx: CanvasRenderingContext2D, v: MapView): void {
    const map = mapReady();
    const { W, H, cu, cv, k, round, g: G, dot, now } = v;
    ctx.clearRect(0, 0, W, H);
    if (!map || !mapArt.off) return;
    const hx = W / 2, hy = H / 2;
    const at = (u: number, w: number) => {
        const du = u - cu, dv = w - cv;
        return { x: hx + (k * (du - dv)) / Math.SQRT2, y: hy + (k * (du + dv)) / Math.SQRT2 / 2 };
    };
    const inside = (x: number, y: number, pad = 0) => (round ? Math.hypot(x - hx, y - hy) < hx - 4 - pad : x > pad && y > pad && x < W - pad && y < H - pad);
    const bits = progress.explored();
    const seen = (u: number, w: number) => {
        const x = Math.floor(u / FOG_CELL), y = Math.floor(w / FOG_CELL);
        if (x < 0 || y < 0 || x >= FOG_N || y >= FOG_N) return false;
        const n = y * FOG_N + x;
        return !!(bits[n >> 3] & (1 << (n & 7)));
    };
    // Tiles around the centre that can show (the 2:1 squash shows twice as far up and down).
    const span = ((W + 2 * H) / k) * 0.75;
    const pulse = 0.5 + 0.5 * Math.sin(now / 250);

    ctx.save();
    ctx.beginPath();
    if (round) ctx.arc(hx, hy, hx - 2, 0, Math.PI * 2);
    else ctx.roundRect(0, 0, W, H, 14);
    ctx.clip();
    ctx.fillStyle = '#120c16';
    ctx.fillRect(0, 0, W, H);
    // The land, then fog over what has not been seen.
    ctx.save();
    ctx.translate(hx, hy);
    ctx.scale(k, k / 2);
    ctx.rotate(Math.PI / 4);
    ctx.translate(-cu, -cv);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mapArt.off, 0, 0);
    ctx.fillStyle = '#120c16';
    const x0 = Math.max(0, Math.floor((cu - span) / FOG_CELL)), x1 = Math.min(FOG_N - 1, Math.floor((cu + span) / FOG_CELL));
    const y0 = Math.max(0, Math.floor((cv - span) / FOG_CELL)), y1 = Math.min(FOG_N - 1, Math.floor((cv + span) / FOG_CELL));
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const n = y * FOG_N + x;
            if (!(bits[n >> 3] & (1 << (n & 7)))) ctx.fillRect(x * FOG_CELL - 0.05, y * FOG_CELL - 0.05, FOG_CELL + 0.1, FOG_CELL + 0.1);
        }
    }
    ctx.restore();

    // Trees (green) and rocks and ore (blue-grey), where explored.
    const b0 = Math.floor((cu - span) / BUCKET), b1 = Math.floor((cu + span) / BUCKET);
    const c0 = Math.floor((cv - span) / BUCKET), c1 = Math.floor((cv + span) / BUCKET);
    for (let bj = c0; bj <= c1; bj++) {
        for (let bi = b0; bi <= b1; bi++) {
            for (const p of mapArt.nodes.get(bj * 1000 + bi) ?? []) {
                const q = at(p.i + 0.5, p.j + 0.5);
                if (!inside(q.x, q.y) || !seen(p.i, p.j)) continue;
                ctx.fillStyle = p.rock ? '#a9b4d0' : '#3f8f45';
                const r = p.rock ? dot : dot * 1.2;
                ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2);
            }
        }
    }

    const glyph = (icon: IconName, x: number, y: number, size: number, color: string, alpha = 1) => {
        ctx.globalAlpha = alpha;
        drawIcon(ctx, icon, x, y, size, color);
        ctx.globalAlpha = 1;
    };
    const ring = (x: number, y: number, r: number, color: string, w = 2) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
    };

    // Kingdom names over their lands (the big map).
    if (v.names) {
        for (const L of LANDMARKS) {
            if (L.kind !== 'camp' || !L.el) continue;
            const q = at(L.i + 0.5, L.j + 0.5);
            if (!inside(q.x, q.y)) continue;
            ctx.font = `${Math.round(G * 1.1)}px 'Jacquard 12'`;
            ctx.textAlign = 'center';
            ctx.fillStyle = KINGDOMS[L.el].css;
            ctx.globalAlpha = progress.open(L.el) ? 0.9 : 0.45;
            ctx.fillText(KINGDOMS[L.el].name.toUpperCase(), q.x, q.y - G * 1.6);
            ctx.globalAlpha = 1;
        }
    }
    // Houses (safe houses to walk into), watchtowers and camps, where explored.
    for (const L of LANDMARKS) {
        if (L.kind !== 'house' && L.kind !== 'tower' && L.kind !== 'camp') continue;
        const q = at(L.i + 0.5, L.j + 0.5);
        if (!inside(q.x, q.y) || !seen(L.i, L.j)) continue;
        if (L.kind === 'house') glyph('house', q.x, q.y, G * 0.8, '#fde68a');
        else if (L.kind === 'tower') glyph('tower', q.x, q.y, G * 0.75, '#e5e7eb');
        else glyph('campfire', q.x, q.y, G * 0.85, '#fb923c');
    }
    // Camp tents: forge, apothecary, healer, totem, storehouse (only when zoomed in enough to tell apart).
    if (k > 3.5) {
        for (const t of map.camps) {
            const q = at(t.i + 0.5, t.j + 0.5);
            if (!inside(q.x, q.y) || !seen(t.i, t.j)) continue;
            const [icon, color] = TENT_ICON[t.id] ?? ['tent', '#e5e7eb'];
            glyph(icon, q.x, q.y, G * 0.7, color);
        }
    }
    // The people of your camp.
    const home = progress.kingdom();
    if (home && k > 3.5) {
        const camp = LANDMARKS.find((l) => l.kind === 'camp' && l.el === home)!;
        for (const id of Object.keys(NPCS) as (keyof typeof NPCS)[]) {
            const q = at(camp.i + 0.5 + NPCS[id].at[0], camp.j + 0.5 + NPCS[id].at[1]);
            if (!inside(q.x, q.y)) continue;
            ctx.fillStyle = '#7dd3fc';
            ctx.beginPath();
            ctx.arc(q.x, q.y, dot * 2.2, 0, Math.PI * 2);
            ctx.fill();
            ring(q.x, q.y, dot * 2.2, '#0c2a3a', dot);
        }
    }

    // Bosses still to beat in the lands you can enter. Off the edge, pinned to it pointing the way.
    const marks: { u: number; v: number; g: IconName; color: string; live: boolean }[] = [];
    for (const L of LANDMARKS) {
        if (L.kind === 'guard' && L.el && progress.open(L.el) && !progress.guardDone(L.el, L.n)) marks.push({ u: L.i + 0.5, v: L.j + 0.5, g: 'skull', color: '#f87171', live: true });
        if (L.kind === 'arena' && L.el && progress.open(L.el) && !progress.wardenDone(L.el)) {
            const locked = progress.guardsLeft(L.el) > 0;
            marks.push({ u: L.i + 0.5, v: L.j + 0.5, g: locked ? 'lock' : 'demon', color: locked ? '#a78bfa' : '#e879f9', live: !locked });
        }
        if (L.kind === 'citadel' && progress.open('citadel')) marks.push({ u: L.i + 0.5, v: L.j + 0.5, g: 'vortex', color: '#c084fc', live: true });
    }
    for (const m of marks) {
        let q = at(m.u, m.v);
        const pinned = !inside(q.x, q.y, G * 0.5);
        if (pinned) {
            const a = Math.atan2(q.y - hy, q.x - hx);
            if (round) q = { x: hx + Math.cos(a) * (hx - G * 0.75), y: hy + Math.sin(a) * (hy - G * 0.75) };
            else {
                const right = Math.cos(a) > 0 ? hx - G * 0.8 - (v.padR ?? 0) : hx - G * 0.8;
                const s = Math.min(right / Math.abs(Math.cos(a) || 1e-6), (hy - G * 0.8) / Math.abs(Math.sin(a) || 1e-6));
                q = { x: hx + Math.cos(a) * s, y: hy + Math.sin(a) * s };
            }
        }
        ctx.fillStyle = 'rgba(18,10,22,.78)';
        ctx.beginPath();
        ctx.arc(q.x, q.y, G * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ring(q.x, q.y, G * 0.62 + (m.live && !pinned ? pulse * 2 : 0), m.color, pinned ? 1.5 : 2);
        glyph(m.g, q.x, q.y, G * (pinned ? 0.62 : 0.72), m.color, pinned ? 0.85 : 1);
    }

    // Monsters, and bosses as they fight.
    for (const m of radar.monsters) {
        const q = at(m.u, m.v);
        if (!inside(q.x, q.y)) continue;
        ctx.fillStyle = m.boss ? '#e879f9' : '#ef4444';
        ctx.beginPath();
        ctx.arc(q.x, q.y, dot * (m.boss ? 3.2 : 1.7), 0, Math.PI * 2);
        ctx.fill();
        if (m.boss) ring(q.x, q.y, dot * 3.2 + pulse * 3, '#fdf4ff', 1.5);
    }
    ctx.restore();

    // The side the next wave comes from: a red wedge (radar rim) or arrow (big map edge).
    if (radar.threat !== null) {
        const t = radar.threat;
        const a = Math.atan2((Math.cos(t) + Math.sin(t)) / 2, Math.cos(t) - Math.sin(t));
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.45 * pulse;
        ctx.fillStyle = ctx.strokeStyle = '#ef4444';
        if (round) {
            ctx.lineWidth = W / 22;
            ctx.beginPath();
            ctx.arc(hx, hy, hx - W / 40, a - 0.45, a + 0.45);
            ctx.stroke();
        }
        const p = at(radar.u, radar.v);
        const reach = round ? hx - W / 7 : Math.min(hx, hy) * 0.35;
        const tx = (round ? hx : p.x) + Math.cos(a) * reach, ty = (round ? hy : p.y) + Math.sin(a) * reach;
        const L = round ? W / 18 : G * 0.9;
        ctx.beginPath();
        ctx.moveTo(tx + Math.cos(a) * L, ty + Math.sin(a) * L);
        ctx.lineTo(tx + Math.cos(a + 2.4) * L * 0.8, ty + Math.sin(a + 2.4) * L * 0.8);
        ctx.lineTo(tx + Math.cos(a - 2.4) * L * 0.8, ty + Math.sin(a - 2.4) * L * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // You: an arrow pointing where you face.
    const me = at(radar.u, radar.v);
    if (inside(me.x, me.y, -10)) {
        const L1 = G * 0.75;
        ctx.save();
        ctx.translate(me.x, me.y);
        ctx.rotate(radar.facing);
        ctx.beginPath();
        ctx.moveTo(L1, 0);
        ctx.lineTo(-L1 * 0.7, L1 * 0.65);
        ctx.lineTo(-L1 * 0.35, 0);
        ctx.lineTo(-L1 * 0.7, -L1 * 0.65);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#2b0f1c';
        ctx.lineWidth = Math.max(2, G / 8);
        ctx.stroke();
        ctx.restore();
    }
}

/** The corner radar (tap it for the big map). */
export function Radar() {
    const ref = useRef<HTMLCanvasElement>(null);
    const on = useSettings().radar;
    const z = useCompact() ? 96 : 138;
    useEffect(() => {
        if (!on) return;
        let raf = 0;
        let last = 0;
        const draw = (now: number) => {
            raf = requestAnimationFrame(draw);
            if (now - last < 90) return; // about 11 times a second is plenty
            last = now;
            const c = ref.current;
            if (!c) return;
            const S = c.width;
            paintMap(c.getContext('2d')!, { W: S, H: S, cu: radar.u, cv: radar.v, k: S / 2 / 30, round: true, g: S / 11, dot: S / 120, now });
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [on]);
    if (!on) return null;
    return (
        <button
            type="button"
            aria-label="Open the map"
            className="pointer-events-auto absolute left-3 rounded-full transition-transform hover:scale-[1.03] active:scale-95"
            style={{ top: 10, width: z, height: z, padding: 0, border: '4px solid #2f2a35', boxShadow: '0 0 0 3px #9a948e, 0 0 0 5px #2f2a35, 0 4px 0 5px rgba(0,0,0,.35)', background: '#120c16' }}
            onClick={() => store.patch({ bigMap: true })}
        >
            <canvas ref={ref} width={264} height={264} className="h-full w-full rounded-full" />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-black text-white" style={{ background: BROWN, border: '2px solid #2b0f1c' }}>⤢</span>
        </button>
    );
}

/** What the map's marks mean. */
const LEGEND: [IconName | 'dot', string, string][] = [
    ['pointer', '#ffffff', 'You'], ['skull', '#f87171', 'Guardian'], ['lock', '#a78bfa', 'Arena (sealed)'], ['demon', '#e879f9', 'Warden'], ['vortex', '#c084fc', 'Citadel'],
    ['campfire', '#fb923c', 'Camp'], ['house', '#fde68a', 'House'], ['tower', '#e5e7eb', 'Watchtower'], ['anvil', '#fdba74', 'Forge'], ['flask', '#7dd3fc', 'Alchemy'],
    ['cross', '#fca5a5', 'Healer'], ['dot', '#7dd3fc', 'Camp folk'], ['dot', '#3f8f45', 'Tree'], ['dot', '#a9b4d0', 'Rock / ore'], ['dot', '#ef4444', 'Monster'],
];

/** The radar opened out: drag to look around, zoom, find yourself again. */
export function BigMap() {
    const open = useStore((s) => s.bigMap);
    const region = useStore((s) => s.region);
    const ref = useRef<HTMLCanvasElement>(null);
    const box = useRef<HTMLDivElement>(null);
    const view = useRef({ cu: 0, cv: 0, k: 9, follow: true });
    const drag = useRef<{ x: number; y: number } | null>(null);
    const [, bump] = useState(0);
    const [legend, setLegend] = useState(() => window.innerHeight >= 560);
    const close = () => store.patch({ bigMap: false });

    useEffect(() => {
        if (!open) return;
        view.current = { cu: radar.u, cv: radar.v, k: 9, follow: true };
        let raf = 0;
        let last = 0;
        const draw = (now: number) => {
            raf = requestAnimationFrame(draw);
            if (now - last < 120) return;
            last = now;
            const c = ref.current, b = box.current;
            if (!c || !b) return;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = Math.round(b.clientWidth * dpr), h = Math.round(b.clientHeight * dpr);
            if (c.width !== w || c.height !== h) {
                c.width = w;
                c.height = h;
            }
            const vw = view.current;
            if (vw.follow) {
                vw.cu = radar.u;
                vw.cv = radar.v;
            }
            paintMap(c.getContext('2d')!, { W: w, H: h, cu: vw.cu, cv: vw.cv, k: vw.k * dpr, round: false, g: 22 * dpr, dot: Math.max(1, vw.k * 0.16) * dpr, now, names: true, padR: 56 * dpr });
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [open]);
    // M opens and closes it; Esc closes it.
    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const st = store.get();
            if (e.key === 'Escape' && st.bigMap) close();
            else if ((e.key === 'm' || e.key === 'M') && st.phase === 'playing') store.patch({ bigMap: !st.bigMap });
        };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, []);
    if (!open) return null;

    const zoom = (f: number) => {
        view.current.k = Math.max(2.5, Math.min(26, view.current.k * f));
        bump((n) => n + 1);
    };
    const btn = 'pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full text-[20px] font-black text-white active:scale-90';
    const btnStyle = { background: 'rgba(28,17,36,.9)', border: '2px solid #e9bf9a', boxShadow: '0 3px 8px rgba(0,0,0,.4)' };
    return (
        <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center p-3" style={{ background: 'rgba(8,4,14,.72)' }} data-quiet onPointerDown={(e) => e.target === e.currentTarget && close()}>
            <div className="relative flex h-full max-h-[760px] w-full max-w-[1200px] flex-col overflow-hidden rounded-2xl" style={{ background: '#120c16', border: `3px solid ${BROWN}`, boxShadow: '0 10px 40px rgba(0,0,0,.6)', animation: 'map-open .25s cubic-bezier(.2,.8,.2,1) both', transformOrigin: '6% 28%' }}>
                <div className="flex items-center justify-between px-4 py-2" style={{ background: 'linear-gradient(180deg, rgba(60,36,52,.95), rgba(28,17,36,.95))', borderBottom: `2px solid ${BROWN}` }}>
                    <div className="flex items-baseline gap-3">
                        <span className="text-[18px] font-bold text-white" style={{ fontFamily: 'var(--font-pixel)' }}>Map of Eidolon</span>
                        {region && <span className="text-[12px] font-bold uppercase tracking-widest" style={{ color: region === 'citadel' ? '#c084fc' : KINGDOMS[region].css }}>{region === 'citadel' ? 'The Void Citadel' : KINGDOMS[region].name}</span>}
                    </div>
                    <button type="button" aria-label="Close the map" className={btn} style={btnStyle} onClick={close}>×</button>
                </div>
                <div
                    ref={box}
                    className="relative flex-1 touch-none"
                    style={{ cursor: drag.current ? 'grabbing' : 'grab' }}
                    onPointerDown={(e) => {
                        drag.current = { x: e.clientX, y: e.clientY };
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                        const d = drag.current;
                        if (!d) return;
                        const vw = view.current;
                        const a = ((e.clientX - d.x) * Math.SQRT2) / vw.k, b = ((e.clientY - d.y) * 2 * Math.SQRT2) / vw.k;
                        vw.cu -= (a + b) / 2;
                        vw.cv -= (b - a) / 2;
                        vw.cu = Math.max(0, Math.min(MAP_TILES, vw.cu));
                        vw.cv = Math.max(0, Math.min(MAP_TILES, vw.cv));
                        vw.follow = false;
                        drag.current = { x: e.clientX, y: e.clientY };
                    }}
                    onPointerUp={() => { drag.current = null; }}
                    onWheel={(e) => zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)}
                >
                    <canvas ref={ref} className="absolute inset-0 h-full w-full" />
                    {/* zoom and find-me */}
                    <div className="absolute right-3 top-3 flex flex-col gap-2">
                        <button type="button" aria-label="Zoom in" className={btn} style={btnStyle} onPointerDown={(e) => { e.stopPropagation(); zoom(1.3); }}>+</button>
                        <button type="button" aria-label="Zoom out" className={btn} style={btnStyle} onPointerDown={(e) => { e.stopPropagation(); zoom(1 / 1.3); }}>−</button>
                        <button type="button" aria-label="Back to me" className={btn} style={btnStyle} onPointerDown={(e) => { e.stopPropagation(); view.current.follow = true; bump((n) => n + 1); }}>◎</button>
                    </div>
                    {/* the legend */}
                    {legend && (
                        <div className="pointer-events-none absolute bottom-14 left-3 grid max-w-[min(520px,70%)] grid-cols-3 gap-x-3 gap-y-0.5 rounded-xl px-3 py-2 text-[11px] font-bold text-white sm:grid-cols-5" style={{ background: 'rgba(18,10,22,.85)', border: '1px solid rgba(233,191,154,.4)' }}>
                            {LEGEND.map(([g, c, t]) => (
                                <span key={t} className="flex items-center gap-1 whitespace-nowrap">
                                    <span className="flex w-4 justify-center">{g === 'dot' ? <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} /> : <Ico name={g} size={13} color={c} />}</span>{t}
                                </span>
                            ))}
                        </div>
                    )}
                    <button type="button" className="pointer-events-auto absolute bottom-3 left-3 rounded-full px-3 py-1.5 text-[12px] font-black text-white" style={btnStyle} onPointerDown={(e) => { e.stopPropagation(); setLegend((l) => !l); }}>
                        {legend ? 'Hide key' : 'Map key'}
                    </button>
                    <div className="pointer-events-none absolute bottom-3 right-3 text-[11px] font-bold text-white/60">Drag to look around · M or Esc to close</div>
                </div>
            </div>
        </div>
    );
}

// ------------------------------------------------------------------ building a camp tent from beside it

/** What a built tent is for: the alchemy tent brews, the forge forges, the healer's tent rests you, the totem holds your cards. */
const USE_TENT: Partial<Record<keyof typeof BUILDINGS, { label: string; tab: Exclude<AppState['bagTab'], null> }>> = {
    alchemy: { label: 'Brew potions', tab: 'craft' },
    forge: { label: 'Forge gear', tab: 'gear' },
    healer: { label: 'Rest here', tab: 'camp' },
    totem: { label: 'Cards', tab: 'cards' },
};

/** The card for the camp tent in front of you: what it does now and next, the cost, and Build. */
export function BuildPanel() {
    const id = useStore((s) => s.buildPanel);
    const bag = useStore((s) => s.bag);
    const buildings = useStore((s) => s.buildings);
    const inCamp = useStore((s) => s.inCamp);
    // Walk out of camp and the card closes itself.
    useEffect(() => {
        if (id && !inCamp) store.patch({ buildPanel: null });
    }, [id, inCamp]);
    if (!id) return null;
    const b = BUILDINGS[id];
    const lv = buildings[id];
    const cost = buildCost(lv);
    const can = inCamp && progress.has(cost);
    const close = () => store.patch({ buildPanel: null });
    return (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-end justify-center pb-[12vh]" style={{ background: 'rgba(10,6,16,.25)' }} onPointerDown={(e) => e.target === e.currentTarget && close()}>
            <div className="flex w-[min(460px,92vw)] items-center gap-3 rounded-2xl p-3" style={{ ...PANEL, animation: 'act-in .2s ease-out both' }}>
                <img src={`images/world/camp/${b.art}.png`} width={78} height={78} draggable={false} alt="" style={{ objectFit: 'contain', opacity: lv > 0 ? 1 : 0.6 }} />
                <div className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
                    <div className="flex items-baseline gap-2">
                        <span className="text-[17px] font-black">{b.name}</span>
                        <span className="text-[12px] font-black" style={{ color: BROWN_DARK }}>{lv > 0 ? `Level ${lv} → ${lv + 1}` : 'Not built yet'}</span>
                    </div>
                    {lv > 0 && <div className="text-[12px] font-bold" style={{ color: BROWN_DARK }}>Now: {b.blurb(lv)}</div>}
                    <div className="text-[12px] font-bold">{lv > 0 ? 'Next' : 'Builds'}: {b.blurb(lv + 1)}</div>
                    <Cost cost={cost} bag={bag} />
                    {!inCamp && <div className="text-[11px] font-black text-red-700">Build in a liberated camp.</div>}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                    <Btn disabled={!can} onPress={() => progress.upgrade(id)}>{lv > 0 ? 'Upgrade' : 'Build'}</Btn>
                    {lv > 0 && USE_TENT[id] && <Btn onPress={() => store.patch({ buildPanel: null, bagTab: USE_TENT[id]!.tab })}>{USE_TENT[id]!.label}</Btn>}
                    <button type="button" className="text-[11px] font-black underline decoration-dotted" style={{ color: BROWN_DARK }} onClick={() => store.patch({ buildPanel: null, bagTab: 'camp' })}>All buildings</button>
                    <button type="button" className="text-[11px] font-black" style={{ color: BROWN_DARK }} onClick={close}>Close</button>
                </div>
            </div>
        </div>
    );
}
