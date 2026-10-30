/**
 * The clean HUD (after Genshin's): little on screen, every piece where the eye expects it.
 *   Top left: the minimap (SurvivalHud.tsx Radar), one quiet line under it (where you are, the
 *   weather, the time of day), then the quest tracker: what to do now, how, how far.
 *   Top right: a short row of the UI Asset Pack's stone buttons (sound, map, bag, pause) with
 *   pixel icons in the pack's own style.
 *   Bottom centre: health on the pack's pixel bar, level and experience, stamina, and the three
 *   needs (hunger, thirst, rest) as small gauges.
 *   Screen edge: an arrow toward the objective when it is off screen.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { progress } from '../game/progress.ts';
import { BUILDINGS, buildCost, gearCost, ITEMS, RECIPES, xpToNext, type Bag, type ItemId } from '../game/survival.ts';
import { KINGDOMS, NPCS } from '../game/eidolon.ts';
import { settings, useSettings } from '../game/settings.ts';
import { store, useStore, type AppState } from '../state/store.ts';
import { PackIcon, slice } from './px.tsx';
import { Ico, Sigil, type IconName } from './icons.tsx';
import { uiHeight } from './uiScale.ts';
import { Badge, SurgeBar, useTalentPoints } from './Progression.tsx';

const CINZEL = 'var(--font-pixel)';

/**
 * A short screen (a phone held sideways): the HUD gives the game the screen. One threshold for every piece
 * (the same as useHudLayout's), so the whole HUD is either in its phone layout or not.
 */
export const PHONE_H = 560;
export function useCompact(): boolean {
    const [c, setC] = useState(() => uiHeight() < PHONE_H);
    useEffect(() => {
        const on = () => setC(uiHeight() < PHONE_H);
        window.addEventListener('resize', on);
        return () => window.removeEventListener('resize', on);
    }, []);
    return c;
}
/**
 * How the bottom row is shared out: the Run button and the movement side on the left, the action
 * buttons on the right, the vitals and hotbar in the room between (they are centred in it, never
 * under a thumb). A phone held sideways (under 560 px tall) gets a tighter set, laid out for thumbs:
 * every button at least 46 px, nothing shrunk below that.
 */
export interface HudLayout { compact: boolean; left: number; right: number }
export function useHudLayout(): HudLayout {
    const calc = (): HudLayout => (uiHeight() < PHONE_H ? { compact: true, left: 92, right: 284 } : { compact: false, left: 150, right: 300 });
    const [l, setL] = useState(calc);
    useEffect(() => {
        const on = () => setL((p) => { const n = calc(); return n.compact === p.compact ? p : n; });
        window.addEventListener('resize', on);
        return () => window.removeEventListener('resize', on);
    }, []);
    return l;
}
const SHADOW = '0 1px 2px #000, 0 0 6px rgba(0,0,0,.8)';

// ------------------------------------------------------------------ pixel icons (16 × 16, the pack's white-with-outline style)
// '#' white, 'o' the dark outline, '.' empty.
const PIXEL: Record<string, string[]> = {
    bag: [
        '................', '.....oooooo.....', '....o######o....', '...o##oooo##o...', '..oo##o..o##oo..', '.o############o.', '.o#oooooooooo#o.', '.o#o########o#o.',
        '.o#o###oo###o#o.', '.o#oooooooooo#o.', '.o############o.', '.o############o.', '.o############o.', '..oooooooooooo..', '................', '................',
    ],
    map: [
        '................', '.oooooooooooooo.', '.o####o###o###o.', '.o####o###o###o.', '.o#oo#o###o#o#o.', '.o####o#o#o###o.', '.o####o###o###o.', '.o##o#o###o##oo.',
        '.o####o#o#o###o.', '.o####o###o#o#o.', '.o#oo#o###o###o.', '.o####o###o###o.', '.o####o###o###o.', '.oooooooooooooo.', '................', '................',
    ],
    sound: [
        '................', '.......oo.......', '......o#o...o...', '.....o##o..o#o..', '.oooo###o...o#o.', '.o######o.o..o#o', '.o######o.o#.o#o', '.o######o.o#.o#o',
        '.o######o.o..o#o', '.oooo###o...o#o.', '.....o##o..o#o..', '......o#o...o...', '.......oo.......', '................', '................', '................',
    ],
    mute: [
        '................', '.......oo.......', '......o#o.......', '.....o##o.......', '.oooo###o.o...o.', '.o######oo#o.o#o', '.o######o.o#o#o.', '.o######o..o#o..',
        '.o######o.o#o#o.', '.oooo###oo#o.o#o', '.....o##o.o...o.', '......o#o.......', '.......oo.......', '................', '................', '................',
    ],
    pause: [
        '................', '................', '...oooo..oooo...', '...o##o..o##o...', '...o##o..o##o...', '...o##o..o##o...', '...o##o..o##o...', '...o##o..o##o...',
        '...o##o..o##o...', '...o##o..o##o...', '...o##o..o##o...', '...o##o..o##o...', '...oooo..oooo...', '................', '................', '................',
    ],
};
export function PixelIcon({ name, size = 24 }: { name: keyof typeof PIXEL; size?: number }) {
    const rows = PIXEL[name];
    return (
        <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true">
            {rows.flatMap((row, y) => [...row].map((ch, x) => (ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={ch === '#' ? '#fbf7f0' : '#2f2a35'} />)))}
        </svg>
    );
}

/** A square stone button from the UI Asset Pack (it sinks when pressed). */
export function StoneButton({ label, onPress, children, size = 44, active = false }: { label: string; onPress: () => void; children: ReactNode; size?: number; active?: boolean }) {
    const [down, setDown] = useState(false);
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className="pointer-events-auto flex touch-none items-center justify-center"
            style={{ ...slice(down ? 'btn2-pressed' : active ? 'btn2-hover' : 'btn2-normal', 2), width: size, height: size - (down ? 2 : 0), marginTop: down ? 2 : 0, paddingBottom: down ? 0 : 2 }}
            onPointerDown={(e) => {
                e.preventDefault();
                setDown(true);
                onPress();
            }}
            onPointerUp={() => setDown(false)}
            onPointerLeave={() => setDown(false)}
        >
            {children}
        </button>
    );
}

/** Top right: sound, the big map, the bag, pause. */
export function TopButtons() {
    const s = useSettings();
    const compact = useCompact();
    const z = compact ? 52 : 44; // (a thumb's width once the phone's HUD is zoomed down)
    const muted = !s.sound && !s.music;
    const points = useTalentPoints();
    return (
        <div className="absolute top-3 flex items-center gap-2 pt-safe-top" style={{ right: 'max(12px, env(safe-area-inset-right))' }} data-quiet>
            <div className="relative">
                <StoneButton size={z} label={points > 0 ? `Skill tree (${points} to spend)` : 'Skill tree (T)'} active={points > 0} onPress={() => store.patch({ talentsOpen: true })}>
                    <Ico name="star" size={22} color={points > 0 ? '#fde68a' : '#fbf7f0'} />
                </StoneButton>
                <Badge n={points} />
            </div>
            {!compact && (
                <StoneButton size={z} label={muted ? 'Sound off (tap for on)' : 'Sound on (tap for off)'} onPress={() => settings.set({ sound: muted, music: muted })}>
                    <PixelIcon name={muted ? 'mute' : 'sound'} />
                </StoneButton>
            )}
            {!compact && <StoneButton size={z} label="Map (M)" onPress={() => store.patch({ bigMap: true })}><PixelIcon name="map" /></StoneButton>}
            <StoneButton size={z} label="Bag (B)" onPress={() => store.patch({ bagTab: 'items' })}><PixelIcon name="bag" /></StoneButton>
            <StoneButton size={z} label="Pause (Esc)" onPress={() => store.patch({ pauseMenu: true })}><PackIcon index={2} size={24} /></StoneButton>
        </div>
    );
}

// ------------------------------------------------------------------ where you are

const WEATHER: Record<AppState['weather'], [IconName, string]> = { clear: ['sun', 'Clear'], rain: ['rain', 'Rain'], storm: ['storm', 'Storm'], fog: ['fog', 'Fog'] };
const SKY: Record<AppState['sky']['phase'], IconName> = { day: 'sun', dusk: 'dawn', night: 'moon', dawn: 'dawn' };

/** One quiet line under the minimap: the land, the weather, the time of day. */
export function StatusLine() {
    const region = useStore((s) => s.region);
    const weather = useStore((s) => s.weather);
    const sky = useStore((s) => s.sky);
    const indoors = useStore((s) => s.indoors);
    const mm = Math.floor(sky.left / 60);
    const ss = String(sky.left % 60).padStart(2, '0');
    const night = sky.phase === 'night';
    const compact = useCompact();
    if (compact) return null; // a phone keeps the screen for the game
    return (
        <div className="pointer-events-none absolute left-3 flex items-center gap-2 whitespace-nowrap text-[11px] font-bold text-white/90" style={{ top: compact ? 112 : 154, textShadow: SHADOW }}>
            {region && region !== 'citadel' ? <Sigil el={region} size={16} /> : <Ico name="vortex" size={14} color="#c084fc" />}
            <span>{region === 'citadel' ? 'Void Citadel' : region ? KINGDOMS[region].name : ''}</span>
            <span className="text-white/40">·</span>
            {indoors ? (
                // Underground: where you are instead of the sky.
                <span style={{ color: '#fde68a' }}>{indoors}</span>
            ) : (
                <>
                    <Ico name={WEATHER[weather][0]} size={13} color="#e2e8f0" />
                    <span>{WEATHER[weather][1]}</span>
                    <span className="text-white/40">·</span>
                    <Ico name={SKY[sky.phase]} size={13} color={night ? '#a5b4fc' : '#fde68a'} />
                    <span style={{ color: night ? '#c7d2fe' : undefined }}>{sky.phase[0].toUpperCase() + sky.phase.slice(1)} {mm}:{ss}</span>
                </>
            )}
        </div>
    );
}

// ------------------------------------------------------------------ the quest tracker

/** What is still missing for a cost, in words ("2 Red herb, 1 Water flask"), or null. */
function missing(cost: Partial<Bag>, bag: Bag): string | null {
    const lack = (Object.keys(cost) as ItemId[]).filter((k) => bag[k] < (cost[k] ?? 0)).map((k) => `${(cost[k] ?? 0) - bag[k]} ${ITEMS[k].name}`);
    return lack.length ? lack.join(', ') : null;
}

/** How to do the current task: in plain words, with the key and the button. */
function howTo(s: AppState): string {
    const ch = progress.chapter();
    const g = ch.goal;
    const bag = s.bag;
    switch (g.kind) {
        case 'talk': return `Walk up to ${NPCS[g.npc].name} (follow the gold marker) and press E, or tap TALK.`;
        case 'stat':
            if (g.stat === 'kills') return s.inCamp ? 'Monsters never enter camp. Step outside (follow the marker), then strike with the red sword button or J.' : 'Strike with the red sword button (J). Roll away from big hits with Dodge (K).';
            if (g.stat === 'wood') return 'Walk to a tree (the marker shows the nearest) and press E, or tap CHOP. The axe comes to hand by itself.';
            if (g.stat === 'stone') return 'Walk to a rock (the marker shows the nearest) and press E, or tap MINE.';
            if (g.stat === 'herb' || g.stat === 'berries') return 'Walk to a bush and press E, or tap GATHER.';
            if (g.stat === 'cooked') return bag.meat > 0 ? 'At the camp fire open the Bag (B) › Craft and Cook your raw meat, then eat it from the Bag.' : 'Raw meat comes from wolves and goblins outside camp. Bring some back to the camp fire.';
            if (g.stat === 'potions') {
                if (s.buildings.alchemy < 1) return 'First build the Alchemy tent: stand by its plot in camp and press E.';
                const red = RECIPES.find((r) => r.out === 'potion_red')!;
                const need = missing(red.cost, bag);
                return need ? `You still need ${need}. Red herbs grow on bushes; fill a flask at any water.` : 'At the Alchemy tent press E › Brew potions, then Brew the Extract of Vitality.';
            }
            if (g.stat === 'essence') return 'Elemental essences hide in flowers, stones and water across the open lands.';
            if (g.stat === 'iron') return 'Mine rocks with the pickaxe: some give iron ore.';
            return 'Follow the marker.';
        case 'build': {
            const id = g.building === 'any' ? 'forge' : g.building;
            const need = missing(buildCost(s.buildings[id]), bag);
            return need ? `You still need ${need} (chop trees, mine rocks). Then press E at the ${BUILDINGS[id].name} plot.` : `Stand by the ${BUILDINGS[id].name} plot in camp, press E, then Build.`;
        }
        case 'gear': {
            const need = missing(gearCost('weapon', Math.min(3, s.gear.weapon + 1)), bag);
            return need ? `You still need ${need}. Then press E at the Forge in camp › Forge gear.` : 'Press E at the Forge in camp › Forge gear › Forge.';
        }
        case 'towers': return 'Follow the marker to a watchtower and press E to climb it: the land around it appears on your map.';
        case 'guards': return 'Follow the skull on your map. A guardian wakes when you come close: beat it to win its relic.';
        case 'wardens': return progress.guardsLeft(s.region && s.region !== 'citadel' ? s.region : (s.kingdom ?? 'fire')) > 0 ? 'Beat the guardians first (the skulls on your map): they hold the arena shut.' : 'The arena is open: go to it and press E at the seal to face the warden.';
        case 'malakor': return 'Go to the Void Citadel at the centre of the world and press E at its gate.';
        case 'wave': return 'Hold out against the waves outside camp.';
        case 'level': return 'Fight, gather and craft to gain experience.';
        case 'equip': return 'Open the Bag (B) › Cards and equip a card.';
    }
}

/** The quest tracker: the chapter, what to do, how, how far along, and which way. */
export function QuestTracker() {
    const obj = useStore((s) => s.objective);
    const target = useStore((s) => s.target);
    const kingdom = useStore((s) => s.kingdom);
    // Only the few numbers it shows (a whole-state subscription re-rendered it on every change).
    const lyra = useStore((x) => x.saga.lyra);
    const pressure = useStore((x) => x.saga.pressure);
    const nightIn = useStore((x) => x.saga.nightIn);
    const tracked = useStore((x) => x.tracked);
    const s = { saga: { lyra, pressure, nightIn }, tracked };
    const compact = useCompact();
    const foldedSetting = useSettings().questCollapsed;
    // On a phone it stays one line out of the way; a tap opens it for a few seconds.
    const [peek, setPeek] = useState(false);
    useEffect(() => {
        if (!peek) return;
        const id = window.setTimeout(() => setPeek(false), 8000);
        return () => window.clearTimeout(id);
    }, [peek]);
    if (!obj || !kingdom) return null;
    const folded = compact ? !peek : foldedSetting;
    const f = obj.need > 0 ? Math.min(1, obj.have / obj.need) : 0;
    const top = compact ? 110 : 176;
    // Folded: one line (the chapter, and how far along), tap to open it again. A new objective still announces itself (ObjectiveCard).
    if (folded) {
        return (
            <button
                key={obj.step}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => (compact ? setPeek(true) : settings.set({ questCollapsed: false }))}
                aria-label={`Show the quest: ${obj.title}`}
                aria-expanded={false}
                className="pointer-events-auto absolute left-3 flex min-h-[40px] max-w-[min(260px,34vw)] items-center gap-1.5 rounded-lg py-1 pl-2 pr-3 text-left"
                style={{ top, background: 'rgba(8,6,14,.62)', border: '1px solid rgba(224,169,72,.45)', textShadow: SHADOW, animation: 'cs-fade-up .3s ease-out both' }}
            >
                <Ico name="scroll" size={14} color="#ffd98a" />
                <span className="truncate text-[12px] font-black text-[#ffd98a]">{obj.task}</span>
                {obj.need > 1 && <span className="shrink-0 text-[11px] font-black tabular-nums text-[#ffd98a]">{Math.min(obj.have, obj.need)}/{obj.need}</span>}
                <span className="shrink-0 text-[14px] leading-none text-white/70" aria-hidden="true">▾</span>
            </button>
        );
    }
    return (
        <div className="pointer-events-none absolute left-3" style={{ top, width: compact ? 'min(250px, 30vw)' : 'min(300px, 34vw)' }}>
        <button
            type="button"
            onClick={() => store.patch({ bagTab: 'story' })}
            className="pointer-events-auto flex w-full flex-col items-start gap-0.5 rounded-lg py-1.5 pl-2 pr-9 text-left"
            style={{ background: 'linear-gradient(90deg, rgba(8,6,14,.62), rgba(8,6,14,.25) 80%, rgba(8,6,14,0))', textShadow: SHADOW }}
            aria-label={`Objective: ${obj.task}`}
        >
            {obj.act && !compact && <span className="max-w-full truncate text-[10px] font-black uppercase tracking-[0.18em] text-[#e0a948]">Act {roman(obj.act)} · {obj.land ?? 'Pyraxis'}</span>}
            <span className="flex max-w-full items-center gap-1.5 leading-none" style={{ fontFamily: 'var(--font-relic)', color: '#ffd98a', fontSize: compact ? 15 : 20 }}>
                <Ico name="scroll" size={compact ? 13 : 16} color="#ffd98a" />
                <span className={compact ? 'truncate' : ''}>{obj.title}</span>
            </span>
            <span className={`font-black leading-snug text-white ${compact ? 'line-clamp-2 text-[12px]' : 'text-[14px]'}`}>{obj.task}</span>
            {!compact && <span className="text-[11px] font-semibold leading-snug text-[#d8e4f0]">{obj.how ?? howTo(store.get())}</span>}
            {obj.need > 1 && (
                <span className="mt-0.5 flex w-full items-center gap-2">
                    <span className="relative h-[5px] flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.18)' }}>
                        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${f * 100}%`, background: 'linear-gradient(90deg, #ffd98a, #f59e0b)' }} />
                    </span>
                    <span className="text-[11px] font-black tabular-nums text-[#ffd98a]">{Math.min(obj.have, obj.need)}/{obj.need}</span>
                </span>
            )}
            {s.saga.lyra !== null && (
                <span className="mt-1 flex w-full items-center gap-1.5" title={`What Lyra still remembers: ${s.saga.lyra}%`}>
                    <Ico name="crystal" size={13} color={s.saga.lyra < 25 ? '#f87171' : '#7dd3fc'} />
                    <span className="text-[11px] font-black text-[#bae6fd]">Lyra</span>
                    <span className="relative h-[6px] flex-1 overflow-hidden" style={{ background: 'rgba(0,0,0,.55)', outline: '1px solid #1e3a5f' }}>
                        <span className="absolute inset-y-0 left-0" style={{ width: `${s.saga.lyra}%`, background: s.saga.lyra < 25 ? '#f87171' : 'linear-gradient(90deg, #38bdf8, #bae6fd)' }} />
                    </span>
                    <span className="text-[11px] font-black tabular-nums text-[#bae6fd]">{s.saga.lyra}%</span>
                </span>
            )}
            {s.saga.pressure !== null && (
                <span className="flex w-full items-center gap-1.5" title={`The Mist pressing into her mind: ${s.saga.pressure}%`}>
                    <Ico name="thorn" size={13} color={s.saga.pressure > 70 ? '#f87171' : '#c4b5fd'} />
                    <span className="text-[11px] font-black text-[#ddd6fe]">Mist</span>
                    <span className="relative h-[6px] flex-1 overflow-hidden" style={{ background: 'rgba(0,0,0,.55)', outline: '1px solid #3b2a5f' }}>
                        <span className="absolute inset-y-0 left-0" style={{ width: `${s.saga.pressure}%`, background: s.saga.pressure > 70 ? '#f87171' : 'linear-gradient(90deg, #a78bfa, #ddd6fe)' }} />
                    </span>
                    <span className="text-[11px] font-black tabular-nums text-[#ddd6fe]">{s.saga.pressure}%</span>
                </span>
            )}
            {!compact && s.saga.nightIn !== null && s.saga.nightIn <= 10 && (
                <span className="text-[11px] font-semibold text-[#fca5a5]">{s.saga.nightIn === 0 ? 'Core-Bleed Siege at the Sanctuary!' : `Core-Bleed Siege in ${s.saga.nightIn} min`}</span>
            )}
            {!compact && obj.sides && obj.sides.length > 0 && (
                <span className="mt-1 flex flex-col gap-0.5">
                    {obj.sides.slice(0, compact ? 1 : 3).map((x) => {
                        // Tap a side quest to follow it (the marker and the arrow point at it); tap again for the main story.
                        const on = s.tracked === x.id;
                        return (
                            <span
                                key={x.id}
                                role="button"
                                tabIndex={0}
                                aria-pressed={on}
                                title={on ? 'Following: tap to go back to the main story' : 'Tap to follow this side quest'}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); store.patch({ tracked: on ? null : x.id }); }}
                                className="cursor-pointer rounded-sm px-1 text-[11px] font-semibold leading-snug [@media(pointer:coarse)]:flex [@media(pointer:coarse)]:min-h-[32px] [@media(pointer:coarse)]:items-center"
                                style={{ color: on ? '#fff3c4' : '#c8d4e0', background: on ? 'rgba(224,169,72,.22)' : undefined, outline: on ? '1px solid rgba(224,169,72,.6)' : undefined }}
                            >
                                <span className="text-[#e0a948]">{on ? 'Following · ' : 'Side · '}</span>{x.task}
                            </span>
                        );
                    })}
                    {!s.tracked && !compact && <span className="text-[10px] italic text-white/45">Tap a side quest to follow it</span>}
                </span>
            )}
            {target && (
                <span className="mt-0.5 flex items-center gap-1.5 text-[12px] font-black text-[#ffe9b0]">
                    <span style={{ display: 'inline-flex', transform: `rotate(${target.angle}rad)` }}><Ico name="pointer" size={13} color="#ffd98a" style={{ transform: 'rotate(45deg)' }} /></span>
                    {target.label} · {Math.round(target.dist)} m
                </span>
            )}
        </button>
        <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => (compact ? setPeek(false) : settings.set({ questCollapsed: true }))}
            aria-label="Fold the quest away"
            aria-expanded
            title="Fold the quest away"
            className="pointer-events-auto absolute right-0 top-0 flex h-11 w-11 items-start justify-end pr-1 pt-1"
        >
            <span className="flex h-6 w-6 items-center justify-center rounded-md text-[16px] leading-none text-white/80" style={{ background: 'rgba(8,6,14,.7)', border: '1px solid rgba(224,169,72,.5)' }}>▴</span>
        </button>
        </div>
    );
}

/** An arrow at the screen's edge toward the objective, when it is far enough to be off screen. */
export function EdgeArrow() {
    const target = useStore((s) => s.target);
    if (!target || target.dist < 9) return null;
    const a = target.angle;
    // On an ellipse just inside the screen's edge.
    const x = 50 + Math.cos(a) * 44, y = 50 + Math.sin(a) * 40;
    return (
        <div className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${x}%`, top: `${y}%`, animation: 'logo-breathe 1.6s ease-in-out infinite' }}>
            <span style={{ transform: `rotate(${a}rad)`, display: 'inline-flex' }}>
                <svg width="34" height="34" viewBox="0 0 24 24"><path d="M21 12 6 4.5 9 12 6 19.5z" fill="#ffe9b0" stroke="#7a4a14" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            </span>
            <span className="whitespace-nowrap rounded-md px-1.5 text-[11px] font-black text-[#ffe9b0]" style={{ background: 'rgba(8,6,14,.6)', textShadow: SHADOW }}>{target.label} · {Math.round(target.dist)} m</span>
        </div>
    );
}

// ------------------------------------------------------------------ the bottom vitals

/** Health on the pack's pixel bar, level and experience, stamina, and the three needs. */
export function BottomVitals() {
    const lay = useHudLayout();
    const hp = useStore((s) => s.hp);
    const maxHp = useStore((s) => s.maxHp);
    const level = useStore((s) => s.level);
    const xp = useStore((s) => s.xp);
    const stamina = useStore((s) => s.stamina);
    const meters = useStore((s) => s.meters);
    const f = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    const need = xpToNext(level);
    // The green bar turns yellow, then red, as health runs low.
    const hue = f > 0.5 ? 0 : f > 0.25 ? -55 : -100;
    const gauge = (icon: IconName, v: number, c: string, label: string) => (
        <span className="flex items-center gap-0.5" title={`${label} ${v}%`}>
            <Ico name={icon} size={12} color={v < 25 ? '#f87171' : c} />
            <span className="relative h-[5px] w-7 overflow-hidden rounded-full" style={{ background: 'rgba(0,0,0,.5)' }}>
                <span className="absolute inset-y-0 left-0" style={{ width: `${v}%`, background: v < 25 ? '#f87171' : c }} />
            </span>
        </span>
    );
    return (
        <div className="pointer-events-none absolute flex flex-col items-center gap-[3px] pb-safe-bottom" style={{ left: lay.left, right: lay.right, bottom: lay.compact ? 70 : 84 }}>
            <div className="flex w-[min(340px,100%)] items-center gap-1.5">
                <span className="shrink-0 text-[11px] font-black text-[#fff3d6]" style={{ fontFamily: CINZEL, textShadow: SHADOW }}>Lv {level}</span>
                {/* the pixel health bar: the brown trough, the green fill */}
                <div className="relative h-[18px] flex-1" style={slice('bar1', 2)} aria-label={`Health ${hp} of ${maxHp}`}>
                    <div className="absolute -inset-y-[8px] -left-[4px]" style={{ ...slice('bar2', 2), width: `calc(${f * 100}% + 8px)`, minWidth: f > 0 ? 12 : 0, opacity: f > 0 ? 1 : 0, filter: `hue-rotate(${hue}deg) saturate(${hue ? 1.6 : 1})`, transition: 'width .2s' }} />
                    <span className="absolute -inset-y-[8px] inset-x-0 flex items-center justify-center text-[11px] font-black tabular-nums text-white" style={{ textShadow: SHADOW }}>{hp} / {maxHp}</span>
                </div>
            </div>
            <div className="flex w-[min(340px,100%)] items-center gap-2 pl-[34px]">
                <span className="relative h-[4px] flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(0,0,0,.5)' }} title={`Stamina ${stamina.now}`}>
                    <span className="absolute inset-y-0 left-0" style={{ width: `${stamina.now}%`, background: stamina.tired ? '#a16207' : '#fde047' }} />
                </span>
                {gauge('meat', meters.hunger, '#fbbf24', 'Hunger')}
                {gauge('drop', meters.thirst, '#38bdf8', 'Thirst')}
                {gauge('sleep', meters.rest, '#a78bfa', 'Rest')}
            </div>
            <div className="w-[min(340px,100%)] pl-[34px]">
                <span className="relative block h-[2px] overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.12)' }} title={`Experience ${xp}/${need}`}>
                    <span className="absolute inset-y-0 left-0" style={{ width: `${(xp / need) * 100}%`, background: '#93c5fd' }} />
                </span>
            </div>
            <SurgeBar />
        </div>
    );
}

// ------------------------------------------------------------------ the wave plaque

/** A number in Roman numerals (the plaque is carved in an old hand). */
export function roman(n: number): string {
    if (n <= 0) return 'I';
    const R: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, s] of R) while (n >= v) { out += s; n -= v; }
    return out;
}

/**
 * The fight at a glance, top centre: a stone plaque from the pack with the wave carved in Roman
 * numerals between crossed swords, and one line beneath. Battle (red), the next wave coming
 * (amber, pulsing), the respite after an onslaught (green), sanctuary in camp (blue).
 */
export function WavePlaque() {
    const wave = useStore((s) => s.wave);
    const next = useStore((s) => s.nextWaveIn);
    const left = useStore((s) => s.waveLeft);
    const more = useStore((s) => s.onslaughtLeft);
    const fighting = useStore((s) => s.fighting);
    const shared = useStore((s) => s.sharedMonsters);
    const camp = useStore((s) => s.wavesCalm);
    const held = useStore((s) => s.wavesHeld);
    const indoors = useStore((s) => s.indoors);
    const compact = useCompact();
    // Waves come in onslaughts of five: where in this one, and which onslaught.
    const ONS = 5;
    const inOns = ((Math.max(1, wave) - 1) % ONS) + 1;
    const onsN = Math.ceil(Math.max(1, wave) / ONS);
    const time = `${Math.floor(next / 60)}:${String(next % 60).padStart(2, '0')}`;
    let title: string, line: string, ink: string, pulse = false;
    if (indoors && !fighting) {
        title = 'Underground';
        line = 'The waves cannot reach you here';
        ink = '#c4b5fd';
    } else if (held) {
        title = 'Calm';
        line = 'The waves have not found you yet';
        ink = '#1e4a8a';
    } else if (camp && !(left && left > 0)) {
        title = 'Sanctuary';
        line = fighting ? 'Safe here · the onslaught waits outside' : `Safe here · respite ${time}`;
        ink = '#1e4a8a';
    } else if (left !== null && left > 0) {
        title = `Wave ${inOns} of ${ONS}`;
        line = `Onslaught ${roman(onsN)} · ${left} ${left === 1 ? 'foe' : 'foes'} remain`;
        ink = '#8a1c1c';
    } else if (fighting && (next > 0 || wave === 0)) {
        const nextIn = wave % ONS === 0 ? 1 : inOns + 1;
        title = `Wave ${wave === 0 ? 1 : nextIn} of ${ONS}`;
        line = next > 0 ? `approaches in ${next}s` : 'approaches';
        ink = '#8a4a0c';
        pulse = next > 0 && next <= 5;
    } else if (fighting) {
        title = more > 0 ? `Wave ${inOns} of ${ONS}` : 'Last stand';
        line = more > 0 ? 'finish the last of them' : 'clear the field for a respite';
        ink = '#8a1c1c';
    } else {
        title = 'Respite';
        line = `${time} · rest, build and brew`;
        ink = '#1d5a2e';
        pulse = next <= 10;
    }
    return (
        <div className="pointer-events-none absolute left-1/2 top-2 flex items-center gap-1.5 pt-safe-top" style={{ transform: `translateX(-50%) scale(${compact ? 0.62 : 1})`, transformOrigin: '50% 0', animation: pulse ? 'eid-breathe 1s ease-in-out infinite' : undefined }}>
            <Ico name="swords" size={22} color="#e5e7eb" />
            <div className="flex min-w-[170px] flex-col items-center px-4 pb-1 pt-0.5" style={{ ...slice('frame5', 2), color: ink }}>
                <span className="text-[24px] leading-[0.95]" style={{ fontFamily: 'var(--font-relic)' }}>{title}</span>
                <span className="whitespace-nowrap text-[11px] leading-tight text-[#3a3440]">{line}{shared ? ' · shared' : ''}</span>
            </div>
            <Ico name="swords" size={22} color="#e5e7eb" style={{ transform: 'scaleX(-1)' }} />
        </div>
    );
}
