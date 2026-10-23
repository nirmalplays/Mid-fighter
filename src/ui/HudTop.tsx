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

const CINZEL = 'var(--font-pixel)';

/** A short screen (a phone held sideways): the HUD tightens up so nothing crowds. */
export function useCompact(): boolean {
    const [c, setC] = useState(() => window.innerHeight < 500);
    useEffect(() => {
        const on = () => setC(window.innerHeight < 500);
        window.addEventListener('resize', on);
        return () => window.removeEventListener('resize', on);
    }, []);
    return c;
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
    const z = compact ? 36 : 44;
    const muted = !s.sound && !s.music;
    return (
        <div className="absolute right-3 top-3 flex items-center gap-2 pt-safe-top" data-quiet>
            <StoneButton size={z} label={muted ? 'Sound off (tap for on)' : 'Sound on (tap for off)'} onPress={() => settings.set({ sound: muted, music: muted })}>
                <PixelIcon name={muted ? 'mute' : 'sound'} />
            </StoneButton>
            <StoneButton size={z} label="Map (M)" onPress={() => store.patch({ bigMap: true })}><PixelIcon name="map" /></StoneButton>
            <StoneButton size={z} label="Bag (B)" onPress={() => store.patch({ bagTab: 'items' })}><PixelIcon name="bag" /></StoneButton>
            <StoneButton size={z} label="Pause" onPress={() => store.patch({ phase: 'menu' })}><PackIcon index={2} size={24} /></StoneButton>
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
    const mm = Math.floor(sky.left / 60);
    const ss = String(sky.left % 60).padStart(2, '0');
    const night = sky.phase === 'night';
    const compact = useCompact();
    return (
        <div className="pointer-events-none absolute left-3 flex items-center gap-2 whitespace-nowrap text-[11px] font-bold text-white/90" style={{ top: compact ? 112 : 154, textShadow: SHADOW }}>
            {region && region !== 'citadel' ? <Sigil el={region} size={16} /> : <Ico name="vortex" size={14} color="#c084fc" />}
            <span>{region === 'citadel' ? 'Void Citadel' : region ? KINGDOMS[region].name : ''}</span>
            <span className="text-white/40">·</span>
            <Ico name={WEATHER[weather][0]} size={13} color="#e2e8f0" />
            <span>{WEATHER[weather][1]}</span>
            <span className="text-white/40">·</span>
            <Ico name={SKY[sky.phase]} size={13} color={night ? '#a5b4fc' : '#fde68a'} />
            <span style={{ color: night ? '#c7d2fe' : undefined }}>{sky.phase[0].toUpperCase() + sky.phase.slice(1)} {mm}:{ss}</span>
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
    const s = useStore((x) => x);
    const compact = useCompact();
    if (!obj || !kingdom) return null;
    const f = obj.need > 0 ? Math.min(1, obj.have / obj.need) : 0;
    return (
        <button
            type="button"
            onClick={() => store.patch({ bagTab: 'story' })}
            className="pointer-events-auto absolute left-3 flex w-[min(300px,34vw)] flex-col items-start gap-0.5 rounded-lg py-1.5 pl-2 pr-3 text-left"
            style={{ top: compact ? 130 : 176, maxWidth: compact ? 250 : undefined, background: 'linear-gradient(90deg, rgba(8,6,14,.62), rgba(8,6,14,.25) 80%, rgba(8,6,14,0))', textShadow: SHADOW }}
            aria-label={`Objective: ${obj.task}`}
        >
            <span className="flex items-center gap-1.5 text-[20px] leading-none" style={{ fontFamily: 'var(--font-relic)', color: '#ffd98a' }}>
                <Ico name="scroll" size={16} color="#ffd98a" />
                {obj.title}
            </span>
            <span className="text-[14px] font-black leading-snug text-white">{obj.task}</span>
            {!compact && <span className="text-[11px] font-semibold leading-snug text-[#d8e4f0]">{howTo(s)}</span>}
            {obj.need > 1 && (
                <span className="mt-0.5 flex w-full items-center gap-2">
                    <span className="relative h-[5px] flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.18)' }}>
                        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${f * 100}%`, background: 'linear-gradient(90deg, #ffd98a, #f59e0b)' }} />
                    </span>
                    <span className="text-[11px] font-black tabular-nums text-[#ffd98a]">{Math.min(obj.have, obj.need)}/{obj.need}</span>
                </span>
            )}
            {target && (
                <span className="mt-0.5 flex items-center gap-1.5 text-[12px] font-black text-[#ffe9b0]">
                    <span style={{ display: 'inline-flex', transform: `rotate(${target.angle}rad)` }}><Ico name="pointer" size={13} color="#ffd98a" style={{ transform: 'rotate(45deg)' }} /></span>
                    {target.label} · {Math.round(target.dist)} m
                </span>
            )}
        </button>
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
        <div className="pointer-events-none absolute flex flex-col items-center gap-[3px] pb-safe-bottom" style={{ left: 150, right: 300, bottom: 84 }}>
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
    const compact = useCompact();
    const time = `${Math.floor(next / 60)}:${String(next % 60).padStart(2, '0')}`;
    let title: string, line: string, ink: string, pulse = false;
    if (camp && !(left && left > 0)) {
        title = 'Sanctuary';
        line = 'The waves wait outside camp';
        ink = '#1e4a8a';
    } else if (left !== null && left > 0) {
        title = `Wave ${roman(wave)}`;
        line = `${left} ${left === 1 ? 'foe' : 'foes'} remain · ${more > 0 ? `${more} more ${more === 1 ? 'wave' : 'waves'}` : 'last wave'}`;
        ink = '#8a1c1c';
    } else if (fighting && (next > 0 || wave === 0)) {
        title = `Wave ${roman(wave + 1)}`;
        line = next > 0 ? `approaches in ${next}s` : 'approaches';
        ink = '#8a4a0c';
        pulse = next > 0 && next <= 5;
    } else if (fighting) {
        title = `Wave ${roman(wave)}`;
        line = 'finish the last of them';
        ink = '#8a1c1c';
    } else {
        title = 'Respite';
        line = `next onslaught in ${time}`;
        ink = '#1d5a2e';
        pulse = next <= 10;
    }
    return (
        <div className="pointer-events-none absolute left-1/2 top-2 flex items-center gap-1.5 pt-safe-top" style={{ transform: `translateX(-50%) scale(${compact ? 0.78 : 1})`, transformOrigin: '50% 0', animation: pulse ? 'eid-breathe 1s ease-in-out infinite' : undefined }}>
            <Ico name="swords" size={22} color="#e5e7eb" />
            <div className="flex min-w-[170px] flex-col items-center px-4 pb-1 pt-0.5" style={{ ...slice('frame5', 2), color: ink }}>
                <span className="text-[24px] leading-[0.95]" style={{ fontFamily: 'var(--font-relic)' }}>{title}</span>
                <span className="whitespace-nowrap text-[11px] leading-tight text-[#3a3440]">{line}{shared ? ' · shared' : ''}</span>
            </div>
            <Ico name="swords" size={22} color="#e5e7eb" style={{ transform: 'scaleX(-1)' }} />
        </div>
    );
}
