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
import {
    ARMORS, BUILDING_IDS, BUILDINGS, buildCost, CARD_IDS, cardLevelCost, cardSlots, CARDS, chapterAt, CHAPTER_COUNT,
    essenceOf, FOOD, FUSE_N, GEAR_FORGE, GEAR_TOP, gearCost, GEM_SKILL_LIST, gem2Of, gem3Of, infuseCost, INFUSION,
    ITEM_IDS, ITEMS, RARITY_COLOR, RECIPES, STATION_NAME, relicMul, RELICS, socketsFor, WEAPONS, xpToNext, type Bag, type ItemId,
    BACKPACK_TOP, backpackCost, backpackSlots, HOTBAR_SLOTS, maxDurability, repairCost, slotsUsed, stackOf, TOOL_ITEMS,
} from '../game/survival.ts';
import {
    ELEMENTS, homeOf, KINGDOMS, LANDMARKS, MALAKOR, NPCS, PROLOGUE, type Element,
} from '../game/eidolon.ts';
import { mapRef, radar } from '../game/world/mapRef.ts';
import { useSettings } from '../game/settings.ts';
import { KingdomMap } from './Celestial.tsx';
import { Bar, BROWN, BROWN_DARK, Btn, Cost, Icon, INK, OUTLINE, PANEL, Panel, press, ROW, TAN, TAN_LIGHT, Wear } from './hudKit.tsx';
import { InventoryGrid, RepairList, useInventoryKey } from './InventoryModal.tsx';
import { MAP_TILES } from '../game/world/constants.ts';
import { store, useStore, type AppState } from '../state/store.ts';

/** Health with numbers, level and XP, stamina, and the hunger / thirst / rest meters (top left). */
export function VitalsBars() {
    const hp = useStore((s) => s.hp);
    const maxHp = useStore((s) => s.maxHp);
    const level = useStore((s) => s.level);
    const xp = useStore((s) => s.xp);
    const stamina = useStore((s) => s.stamina);
    const meters = useStore((s) => s.meters);
    const kingdom = useStore((s) => s.kingdom);
    const f = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    const need = xpToNext(level);
    const col = f > 0.5 ? '#4ade80' : f > 0.25 ? '#facc15' : '#ef4444';
    const meter = (label: string, v: number, c: string) => (
        <div className="flex flex-1 items-center gap-0.5" title={`${label} ${v}`}>
            <span className="text-[11px] leading-none" style={{ filter: v < 25 ? 'none' : 'grayscale(.2)' }}>{label}</span>
            <Bar f={v / 100} color={v < 25 ? '#ef4444' : c} h={8} />
        </div>
    );
    return (
        <div className="flex flex-col gap-1" style={{ width: 'min(230px, 34vw)' }}>
            <div
                className="relative overflow-hidden"
                aria-label={`Health ${hp} of ${maxHp}`}
                style={{ height: 26, borderRadius: 10, background: '#3a1820', border: `4px solid ${BROWN}`, boxShadow: `0 3px 0 ${BROWN_DARK}` }}
            >
                <div className="absolute inset-y-0 left-0 transition-[width] duration-200" style={{ width: `${f * 100}%`, background: `linear-gradient(${col}, ${col}cc)` }} />
                <div className="absolute inset-x-0 top-0 h-[5px]" style={{ background: 'rgba(255,255,255,.25)' }} />
                <div className="absolute inset-0 flex items-center justify-between px-2 text-[13px] font-black tabular-nums text-white" style={{ textShadow: OUTLINE }}>
                    <span>❤ HP{kingdom ? ` · ${KINGDOMS[kingdom].glyph}` : ''}</span>
                    <span>{hp} / {maxHp}</span>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="rounded-md px-1.5 text-[12px] font-black leading-[18px]" style={{ background: `linear-gradient(${TAN_LIGHT}, ${TAN})`, border: `3px solid ${BROWN}`, color: INK }}>
                    Lv {level}
                </span>
                <Bar f={xp / need} color="linear-gradient(#93c5fd, #3b82f6)" h={12} />
                <span className="text-[10px] font-black tabular-nums text-white" style={{ textShadow: OUTLINE }}>{xp}/{need}</span>
            </div>
            <div className="flex items-center gap-1" aria-label={`Stamina ${stamina.now} of ${stamina.max}`}>
                <span className="text-[10px] font-black text-white" style={{ textShadow: OUTLINE, width: 26 }}>{stamina.tired ? 'TIRED' : 'STA'}</span>
                <Bar f={stamina.now / 100} color={stamina.tired ? '#a16207' : 'linear-gradient(#fde68a, #f59e0b)'} h={9} />
            </div>
            <div className="flex items-center gap-1.5">
                {meter('🍖', meters.hunger, '#f59e0b')}
                {meter('💧', meters.thirst, '#38bdf8')}
                {meter('💤', meters.rest, '#a78bfa')}
            </div>
        </div>
    );
}

/** A boss's name and health across the bottom while one is near. */
export function BossBar() {
    const boss = useStore((s) => s.boss);
    if (!boss) return null;
    return (
        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-0.5" style={{ bottom: 70, width: 'min(420px, 60vw)' }}>
            <span className="text-[13px] font-black text-white" style={{ textShadow: OUTLINE }}>☠ {boss.name}</span>
            <div className="relative h-[16px] w-full overflow-hidden rounded-md" style={{ background: '#1d1216', border: `3px solid ${boss.css}` }}>
                <div className="absolute inset-y-0 left-0 transition-[width] duration-150" style={{ width: `${(boss.hp / Math.max(1, boss.max)) * 100}%`, background: `linear-gradient(${boss.css}, #7f1d1d)` }} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black tabular-nums text-white" style={{ textShadow: OUTLINE }}>{boss.hp} / {boss.max}</span>
            </div>
        </div>
    );
}

const WEATHER_INFO: Record<AppState['weather'], [string, string, string]> = { clear: ['☀️', 'Clear', ''], rain: ['🌧️', 'Rain', ' · fires out'], storm: ['⛈️', 'Storm', ''], fog: ['🌫️', 'Fog', ''] };
/** Region and weather, next to the wave pill. */
export function WorldPills() {
    const weather = useStore((s) => s.weather);
    const region = useStore((s) => s.region);
    const name = region === 'citadel' ? 'Void Citadel' : region ? KINGDOMS[region].name : '';
    return (
        // One row of small chips under the wave pill (it stays clear of the corners on any screen).
        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap" style={{ top: 48 }}>
            {name && <span className="rounded-lg px-2 text-[11px] font-black text-white" style={{ background: 'rgba(22,12,16,.72)', border: `2px solid ${region && region !== 'citadel' ? KINGDOMS[region].css : '#8b5cf6'}`, lineHeight: '20px' }}>{region && region !== 'citadel' ? KINGDOMS[region].glyph : '🌀'}<span className="hidden min-[1000px]:inline"> {name}</span></span>}
            <span className="rounded-lg px-2 text-[11px] font-black text-white" style={{ background: 'rgba(22,12,16,.72)', border: '2px solid #6b4a52', lineHeight: '20px' }}>{WEATHER_INFO[weather][0]} {WEATHER_INFO[weather][1]}<span className="hidden min-[1000px]:inline">{WEATHER_INFO[weather][2]}</span></span>
            <SkyPill />
        </div>
    );
}

// ------------------------------------------------------------------ objective and buttons

/** The current story objective, with an arrow when it points somewhere. Tap for the story. */
export function Objective() {
    const obj = useStore((s) => s.objective);
    const target = useStore((s) => s.target);
    const kingdom = useStore((s) => s.kingdom);
    if (!obj || !kingdom) return null;
    return (
        <button
            type="button"
            className="pointer-events-auto absolute right-3 flex flex-col items-stretch rounded-xl px-2.5 py-1.5 text-left"
            style={{ top: 64, width: 'min(230px, 36vw)', background: 'rgba(22,12,16,.78)', border: '3px solid #e0b04a', boxShadow: '0 3px 0 #6b4a1a' }}
            onPointerDown={press(() => store.patch({ bagTab: 'story' }))}
        >
            <span className="text-[10px] font-black uppercase tracking-wide" style={{ color: '#ffcb4d' }}>📜 {obj.title}</span>
            <span className="text-[12px] font-bold leading-tight text-white">{obj.task}</span>
            <div className="mt-1 flex items-center gap-1.5">
                <Bar f={obj.have / Math.max(1, obj.need)} color="#ffcb4d" h={8} />
                <span className="text-[11px] font-black tabular-nums text-white">{obj.have}/{obj.need}</span>
            </div>
            {target && (
                <div className="mt-1 flex items-center gap-1.5 text-[12px] font-black tabular-nums" style={{ color: '#a3e635' }}>
                    <span style={{ display: 'inline-block', transform: `rotate(${target.angle}rad)`, fontSize: 15, lineHeight: 1 }}>➤</span>
                    {target.label} · {Math.round(target.dist)} tiles
                </div>
            )}
        </button>
    );
}

// ------------------------------------------------------------------ bag tabs

type Tab = NonNullable<AppState['bagTab']>;
const TABS: { id: Tab; label: string }[] = [
    { id: 'items', label: 'Bag' },
    { id: 'craft', label: 'Craft' },
    { id: 'gear', label: 'Gear' },
    { id: 'cards', label: 'Cards' },
    { id: 'camp', label: 'Camp' },
    { id: 'map', label: 'Map' },
    { id: 'story', label: 'Story' },
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
                {camp ? '🏕️ In camp: brew at the Alchemy tent, cook at the fire, make tools at the bench.' : sheltered ? '🏠 In a house: cook at the hearth, make tools at the bench. Potions are brewed in camp.' : 'Out in the wild you can only look. Go back to camp to brew, cook and craft.'}
            </div>
            {RECIPES.map((r, i) => {
                const locked = alchemy < r.alchemy;
                const away = !here(r.at);
                const can = !locked && !away && progress.has(r.cost);
                return (
                    <div key={r.out} className="flex items-center gap-2 rounded-xl px-2 py-1" style={{ ...ROW, opacity: locked ? 0.7 : 1 }}>
                        <Icon id={r.out} size={34} dim={locked} />
                        <div className="flex flex-1 flex-col gap-0.5 leading-tight">
                            <div className="text-[14px] font-black">{ITEMS[r.out].name} <span className="text-[11px]" style={{ color: BROWN_DARK }}>· have {bag[r.out]}{r.fire ? ' · 🔥' : ''}</span></div>
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
                                <span className="text-[9px] font-bold" style={{ color: BROWN_DARK }}>{have ? (held ? 'In hand' : `x${relicMul(progress.tierOf(r.el), r.n)} ${k.glyph}`) : k.glyph}</span>
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
        const blocker = top ? null : gear.bp < next ? `Needs the ${list[next].name} blueprint${next === 1 ? ' (talk to Varis)' : next === 2 ? ' (from your first warden)' : ' (from the third warden)'}` : forge < GEAR_FORGE[next] ? `Needs Forge level ${GEAR_FORGE[next]}` : !inCamp ? 'Forge it in camp' : null;
        const cost = top ? {} : gearCost(kind, next);
        return (
            <div className="flex items-center gap-2 rounded-xl px-2 py-1" style={ROW}>
                <span className="text-[26px]">{kind === 'weapon' ? '🗡️' : '🛡️'}</span>
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

            <div className="text-[12px] font-black" style={{ color: BROWN_DARK }}>Element infusion {gear.infusion ? `· now ${KINGDOMS[gear.infusion].glyph} ${INFUSION[gear.infusion]}` : '· none'}</div>
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
                            <span style={{ fontSize: 28, lineHeight: '34px', filter: owned ? 'none' : 'grayscale(1) brightness(.4)' }}>{c.glyph}</span>
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
                <span className="text-[24px]">🔥</span>
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
        let [r, g, b] = TERRAIN_RGB[t] ?? [0, 0, 0];
        if (t === 4 && m.region[k] === 1) [r, g, b] = [230, 100, 40];
        const tint = m.region[k] === 0 ? 0xc0b0d0 : KINGDOMS[ELEMENTS[m.region[k] - 1]].ground;
        const lift = 0.8 + 0.04 * m.height[k];
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
    const pin = (i: number, j: number, text: string, key: string, title: string) => (
        <span key={key} title={title} className="absolute -translate-x-1/2 -translate-y-1/2 text-[13px] leading-none" style={{ left: `${(i / N) * 100}%`, top: `${(j / N) * 100}%`, transform: 'translate(-50%,-50%) rotate(-45deg)', filter: 'drop-shadow(0 1px 1px #000)' }}>{text}</span>
    );
    const pins: ReactNode[] = [];
    for (const L of LANDMARKS) {
        if (!seen(L.i, L.j) && L.kind !== 'citadel') continue;
        if (L.kind === 'camp') pins.push(pin(L.i, L.j, '⛺', L.id, `${KINGDOMS[L.el!].name} camp`));
        else if (L.kind === 'tower') pins.push(pin(L.i, L.j, towers.includes(L.id) ? '🗼' : '🏯', L.id, 'Watchtower'));
        else if (L.kind === 'house') pins.push(pin(L.i, L.j, '🏠', L.id, 'House'));
        else if (L.kind === 'guard' && !guards.includes(`${L.el}:${L.n}`)) pins.push(pin(L.i, L.j, '☠', L.id, KINGDOMS[L.el!].guard.name));
        else if (L.kind === 'arena') pins.push(pin(L.i, L.j, wardens.includes(L.el!) ? '✔' : '⚔', L.id, `Arena of ${KINGDOMS[L.el!].name}`));
        else if (L.kind === 'citadel') pins.push(pin(L.i, L.j, '🌀', L.id, 'Void Citadel'));
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
            <div className="text-[11px] font-bold" style={{ color: BROWN_DARK }}>Explore or climb watchtowers to clear the fog. ⛺ camp · ☠ guardian · ⚔ arena · 🗼 tower · 🏠 house · 🌀 citadel</div>
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
                            <span className="text-[13px] font-black">{k.glyph} {k.name}{e === kingdom ? ' · home' : ''}</span>
                            <span className="text-[10px] font-bold" style={{ color: BROWN_DARK }}>{k.land}</span>
                            <span className="text-[11px] font-bold">{freed ? `✔ ${k.warden.name} defeated` : open ? `Guardians ${g}/3 · ${k.warden.name} waits` : '🔒 Sealed'}</span>
                            <span className="text-[10px] font-bold" style={{ color: freed || e === kingdom ? '#15803d' : BROWN_DARK }}>Power: {k.power}</span>
                        </div>
                    );
                })}
            </div>
            <div className="rounded-lg p-1.5 text-[12px] font-bold" style={{ background: 'rgba(139,92,246,.15)', border: '2px solid #8b5cf6' }}>
                🌀 {MALAKOR.name}, {MALAKOR.title}: {malakor > 0 ? `defeated ${malakor} time${malakor > 1 ? 's' : ''}` : wardens.length >= 4 ? 'waits in the Void Citadel' : `hidden behind ${4 - wardens.length} seal${4 - wardens.length > 1 ? 's' : ''}`}
            </div>
            <div className="text-[12px] font-black" style={{ color: BROWN_DARK }}>The tale so far</div>
            <div className="flex flex-col gap-0.5">
                {Array.from({ length: Math.min(step, CHAPTER_COUNT) }, (_, i) => (
                    <div key={i} className="text-[12px] font-bold">✔ {i + 1}. {chapterAt(i, order).title}</div>
                ))}
                {step === 0 && <div className="text-[12px] font-bold" style={{ color: BROWN_DARK }}>Nothing yet. Your story starts now.</div>}
            </div>
            <Btn color="#fff" onPress={() => store.patch({ bagTab: null, storyPopup: { speaker: 'Elder Theron', title: 'The Fracture of Eidolon', lines: PROLOGUE.map((p) => p.text) } })}>Hear the prologue again</Btn>
        </div>
    );
}

/** The bag: items, crafting, gear, cards, the camp, the map and the story. */
export function BagPanel() {
    const tab = useStore((s) => s.bagTab);
    useInventoryKey();
    if (!tab) return null;
    return (
        <Panel z={30} width={490} onClose={() => store.patch({ bagTab: null })}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                    {TABS.map((t) => (
                        <button key={t.id} type="button" className="rounded-lg px-2 font-black" style={{ height: 30, background: tab === t.id ? '#fff' : 'rgba(255,255,255,.4)', border: `3px solid ${BROWN}`, fontSize: 12 }} onPointerDown={press(() => store.patch({ bagTab: t.id }))}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <Btn color="#fff" onPress={() => store.patch({ bagTab: null })}>Close</Btn>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                {tab === 'items' && <InventoryGrid />}
                {tab === 'craft' && <CraftTab />}
                {tab === 'gear' && <GearTab />}
                {tab === 'cards' && <CardsTab />}
                {tab === 'camp' && <CampTab />}
                {tab === 'map' && <MapTab />}
                {tab === 'story' && <StoryTab />}
            </div>
        </Panel>
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
    const action = id === 'varis' ? { label: 'Open the forge', tab: 'gear' as const } : id === 'lyra' ? { label: 'Show me remedies', tab: 'craft' as const } : { label: 'The story so far', tab: 'story' as const };
    return (
        <Panel z={25} width={520} onClose={close}>
            <div className="flex items-start gap-3">
                <Portrait tint={hex(npc.tint)} />
                <div className="flex flex-1 flex-col gap-1">
                    <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: BROWN_DARK }}>{npc.name} · {npc.role}</div>
                    <p className="text-[14px] font-bold leading-snug">{answer === null ? `"${npc.greet}"` : `"${npc.talk[answer].a}"`}</p>
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
                <Btn color="#fde68a" onPress={() => store.patch({ npc: null, bagTab: action.tab })}>{action.label}</Btn>
                <Btn color="#fff" onPress={close}>Goodbye</Btn>
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
                    {KINGDOMS[e].glyph} {KINGDOMS[e].name} camp {wardens.includes(e) ? '· freed' : ''}
                </Btn>
            ))}
            <Btn color="#fff" onPress={close}>Stay here</Btn>
        </Panel>
    );
}

/** Pledge to one of the four kingdoms (after the prologue). */
export function KingdomChooser() {
    const kingdom = useStore((s) => s.kingdom);
    const popup = useStore((s) => s.storyPopup);
    const phase = useStore((s) => s.phase);
    if (kingdom || popup || phase !== 'playing') return null;
    const choose = (e: Element) => {
        progress.chooseKingdom(e);
        progress.markIntroSeen();
        const first = progress.chapter();
        store.patch({ storyPopup: { speaker: 'Elder Theron', title: `Welcome to ${KINGDOMS[e].name}`, lines: [`The essence of ${KINGDOMS[e].name} flows into you: ${KINGDOMS[e].power}. This camp is your home now.`, ...first.say, `Your first task: ${first.task}.`] } });
    };
    return (
        <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 overflow-y-auto p-3" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(36,22,52,.95), rgba(7,4,13,.97))' }}>
            <div className="text-center text-[20px] font-black text-[#efe8fa]" style={{ textShadow: '0 2px 0 #000' }}>Choose your kingdom</div>
            <div className="text-center text-[12px] font-bold text-[#b9aed0]">Its essence becomes yours, and its camp your home. The other kingdoms lie behind Malakor's barriers.</div>
            <KingdomMap onPledge={choose} />
        </div>
    );
}

/** A story dialog: the prologue, a new chapter, a warden's words. */
export function StoryDialog() {
    const popup = useStore((s) => s.storyPopup);
    const [page, setPage] = useState(0);
    const speaker = popup?.speaker ?? 'Elder Theron';
    const tint = useMemo(() => hex(NPCS.theron.tint), []);
    if (!popup) return null;
    const pages = popup.lines;
    const last = page >= pages.length - 1;
    const close = () => {
        setPage(0);
        store.patch({ storyPopup: null });
        progress.markIntroSeen();
        progress.publishObjective();
    };
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
                        <Btn onPress={() => (last ? close() : setPage((p) => p + 1))}>{last ? "Let's go" : 'Next ›'}</Btn>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** The prologue, the first time a player starts (then they choose a kingdom). */
export function maybeShowIntro(): void {
    if (store.get().storyPopup || progress.introSeen()) return;
    store.patch({ storyPopup: { speaker: 'Elder Theron', title: 'The Fracture of Eidolon', lines: PROLOGUE.map((p) => p.text) } });
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
        <div className="pointer-events-none absolute bottom-2 flex flex-col items-center gap-1 pb-safe-bottom" style={{ left: 150, right: 276 }} data-quiet>
            <div className="h-5 text-sm font-bold text-white transition-opacity duration-300" style={{ textShadow: '0 1px 3px #000', opacity: name ? 1 : 0 }}>{name ?? ''}</div>
            <div className="flex gap-[4px] rounded-md p-[4px]" style={{ background: 'rgba(22,22,22,.8)', border: '3px solid #3b3b3b', boxShadow: 'inset 0 0 0 2px #151515' }}>
                {hotbar.map((id, n) => {
                    const owned = id ? bag[id] > 0 : true;
                    const sel = n === held && (!id || !!ITEMS[id].tool);
                    return (
                        <button
                            key={n}
                            type="button"
                            aria-label={id ? ITEMS[id].name : 'Empty slot'}
                            className="pointer-events-auto relative flex touch-none items-center justify-center"
                            style={{ width: 48, height: 48, background: 'rgba(72,72,72,.72)', border: sel ? '3px solid #fff' : '3px solid #5a5a5a', boxShadow: sel ? '0 0 0 2px #000' : 'none', borderRadius: 4, opacity: owned ? 1 : 0.4 }}
                            onPointerDown={press(() => pick(n))}
                        >
                            {id ? <Icon id={id} size={34} /> : <span className="text-[11px] font-bold text-white/40">hands</span>}
                            {id && !ITEMS[id].tool && <span className="absolute right-[3px] top-[1px] text-[11px] font-black text-white" style={{ textShadow: '0 1px 0 #000' }}>{bag[id]}</span>}
                            {id && <Wear id={id} />}
                            <span className="absolute bottom-[6px] left-[3px] text-[10px] font-bold leading-none text-white/80" style={{ textShadow: '0 1px 0 #000' }}>{n + 1}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/** Day or night, and how long until it changes. */
export function SkyPill() {
    const sky = useStore((s) => s.sky);
    const icon = sky.phase === 'day' ? '☀️' : sky.phase === 'night' ? '🌙' : sky.phase === 'dusk' ? '🌇' : '🌅';
    const mm = Math.floor(sky.left / 60);
    const ss = String(sky.left % 60).padStart(2, '0');
    return (
        <span className="rounded-lg px-2 text-[11px] font-black text-white" style={{ background: sky.phase === 'night' ? 'rgba(30,27,75,.9)' : 'rgba(22,12,16,.72)', border: `2px solid ${sky.phase === 'night' ? '#818cf8' : '#6b4a52'}`, lineHeight: '20px' }}>
            {icon}<span className="hidden min-[1000px]:inline"> {sky.phase[0].toUpperCase() + sky.phase.slice(1)}</span> {mm}:{ss}{sky.phase === 'night' ? <span className="hidden min-[1000px]:inline"> · hordes!</span> : ''}
        </span>
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

/** Glyphs the map marks camp tents with. */
const TENT_GLYPH: Record<string, string> = { forge: '⚒️', alchemy: '⚗️', healer: '✚', totem: '🔮', store: '📦' };

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

    const glyph = (c: string, x: number, y: number, size: number, alpha = 1) => {
        ctx.globalAlpha = alpha;
        ctx.font = `${size}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(c, x, y);
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
            ctx.font = `bold ${G * 0.85}px Georgia, serif`;
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
        glyph(L.kind === 'house' ? '🏠' : L.kind === 'tower' ? '🗼' : '🔥', q.x, q.y, G * (L.kind === 'tower' ? 0.8 : 0.9));
    }
    // Camp tents: forge, apothecary, healer, totem, storehouse (only when zoomed in enough to tell apart).
    if (k > 3.5) {
        for (const t of map.camps) {
            const q = at(t.i + 0.5, t.j + 0.5);
            if (!inside(q.x, q.y) || !seen(t.i, t.j)) continue;
            glyph(TENT_GLYPH[t.id] ?? '⛺', q.x, q.y, G * 0.75);
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
    const marks: { u: number; v: number; g: string; color: string; live: boolean }[] = [];
    for (const L of LANDMARKS) {
        if (L.kind === 'guard' && L.el && progress.open(L.el) && !progress.guardDone(L.el, L.n)) marks.push({ u: L.i + 0.5, v: L.j + 0.5, g: '💀', color: '#f87171', live: true });
        if (L.kind === 'arena' && L.el && progress.open(L.el) && !progress.wardenDone(L.el)) {
            const locked = progress.guardsLeft(L.el) > 0;
            marks.push({ u: L.i + 0.5, v: L.j + 0.5, g: locked ? '🔒' : '👹', color: locked ? '#a78bfa' : '#e879f9', live: !locked });
        }
        if (L.kind === 'citadel' && progress.open('citadel')) marks.push({ u: L.i + 0.5, v: L.j + 0.5, g: '🌀', color: '#c084fc', live: true });
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
        glyph(m.g, q.x, q.y + 1, G * (pinned ? 0.7 : 0.85), pinned ? 0.85 : 1);
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
            style={{ top: 152, width: 138, height: 138, padding: 0, border: `3px solid ${BROWN}`, boxShadow: `0 3px 0 ${BROWN_DARK}`, background: '#120c16' }}
            onClick={() => store.patch({ bigMap: true })}
        >
            <canvas ref={ref} width={264} height={264} className="h-full w-full rounded-full" />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-black text-white" style={{ background: BROWN, border: '2px solid #2b0f1c' }}>⤢</span>
        </button>
    );
}

/** What the map's marks mean. */
const LEGEND: [string, string][] = [
    ['➤', 'You'], ['💀', 'Guardian'], ['🔒', 'Arena (sealed)'], ['👹', 'Warden'], ['🌀', 'Citadel'], ['🔥', 'Camp'], ['🏠', 'House'], ['🗼', 'Watchtower'],
    ['⚒️', 'Forge'], ['⚗️', 'Alchemy'], ['✚', 'Healer'], ['🔵', 'Camp folk'], ['🟢', 'Tree'], ['⬜', 'Rock / ore'], ['🔴', 'Monster'],
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
                        <span className="text-[18px] font-bold text-white" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>Map of Eidolon</span>
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
                            {LEGEND.map(([g, t]) => <span key={t} className="flex items-center gap-1 whitespace-nowrap"><span className="w-4 text-center">{g}</span>{t}</span>)}
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
