/**
 * In-game HUD: a React overlay above the Pixi canvas, styled as chunky tan
 * pixel-art buttons with dark icons, a portrait + health bar + level bar cluster at the
 * top left, and a digital clock with the bag and pause buttons at the top right.
 * The survival parts (bars, objective, bag, story) live in SurvivalHud.tsx.
 *
 * Pattern to keep: the overlay itself is pointer-events-none so touches fall
 * through to the canvas (the movement joystick); each control opts back in with
 * pointer-events-auto. `pt-safe-top` (see app.css) pads below the RUN host
 * header. Action buttons fire on pointer-down and emit commands the world scene hears.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { commands, type GameCommand } from '../game/commands.ts';
import { ActionCluster, GlassButton } from './Actions.tsx';
import { store, useStore } from '../state/store.ts';
import { progress } from '../game/progress.ts';
import { SKILL_BLURB, SKILL_CAP, upgradeCost } from '../game/skills.ts';
import type { Skill } from '../shared/sim.ts';
import { GameOver } from './Scores.tsx';
import { SoundButton } from './SoundButton.tsx';
import {
    BagPanel, BigMap, BossBar, BuildPanel, DownedOverlay, Hotbar4, HousePanel, KingdomChooser, maybeShowIntro, NpcPanel, Objective, Radar,
    StoryDialog, TravelPanel, VitalsBars, WorldPills,
} from './SurvivalHud.tsx';
import { CARRY_MAX, COOLDOWN_MAX, cooldownFor, levelCost, maxCharges, SPELLS, UNLOCK_COST } from '../game/world/spells.ts';

const TAN = '#e9bf9a';
const TAN_LIGHT = '#f6d9ba';
const BROWN = '#b4725b';
const BROWN_DARK = '#7d4636';
const INK = '#3a2025';

/** The outline colour used by the game's sprites (dark plum). Buttons and icons share it. */
const PLUM = '#2b0f1c';

type Face = 'tan' | 'red' | 'dark';
const FACES: Record<Face, { light: string; mid: string; dark: string }> = {
    tan: { light: '#fff1d6', mid: '#f1c996', dark: '#d79c68' },
    red: { light: '#ff9a82', mid: '#ee5a48', dark: '#c0342f' },
    dark: { light: '#6d4d86', mid: '#4a2f63', dark: '#341f48' },
};

/**
 * A round action button in the same style as the sprites: a thick plum outline, a soft
 * two-tone face with one highlight, and a hard drop shadow that it sinks into when pressed.
 * Keep the diameter at 44 px or more so it is easy to hit with a thumb.
 */
function RoundBtn({ size, onPress, face = 'tan', label, className = '', children }: {
    size: number; onPress: () => void; face?: Face; label?: string; className?: string; children: ReactNode;
}) {
    const f = FACES[face];
    const lip = Math.max(3, Math.round(size * 0.055));
    return (
        <button
            type="button"
            aria-label={label}
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: `radial-gradient(circle at 36% 28%, ${f.light} 0%, ${f.mid} 52%, ${f.dark} 100%)`,
                border: `${Math.max(3, Math.round(size * 0.055))}px solid ${PLUM}`,
                boxShadow: `inset 0 ${-lip}px 0 rgba(60,20,20,.22), inset 0 ${Math.round(lip * 0.7)}px 0 rgba(255,255,255,.55), 0 ${lip}px 0 ${PLUM}, 0 ${lip + 5}px 10px rgba(0,0,0,.35)`,
                color: PLUM,
            }}
            className={`pointer-events-auto flex touch-none items-center justify-center font-black leading-none transition-transform active:translate-y-[3px] active:brightness-95 ${className}`}
            onPointerDown={(e) => {
                e.preventDefault();
                onPress();
            }}
        >
            {children}
        </button>
    );
}

const emit = (cmd: GameCommand) => () => commands.emit(cmd);

/** An item picture from public/images/hud (the same outlined art as the world), sized to its button. */
function Pic({ name, size, rotate = 0 }: { name: string; size: number; rotate?: number }) {
    return (
        <img
            src={`images/hud/${name}.png`}
            width={size}
            height={size}
            draggable={false}
            alt=""
            style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined, filter: 'drop-shadow(0 2px 0 rgba(43,15,28,.25))' }}
        />
    );
}

/** A cartoon open hand for "bare hands": white with the sprites' plum outline. */
function HandIcon({ size }: { size: number }) {
    const shapes = (
        <>
            <rect x="7" y="2" width="3.4" height="11" rx="1.7" />
            <rect x="10.8" y="0.6" width="3.4" height="12.4" rx="1.7" />
            <rect x="14.6" y="1.6" width="3.4" height="11.4" rx="1.7" />
            <rect x="18.2" y="4" width="3.2" height="9" rx="1.6" />
            <rect x="4.6" y="10" width="17.2" height="11" rx="5.2" />
            <rect x="1.4" y="9.6" width="3.6" height="9" rx="1.8" transform="rotate(-28 3.2 14)" />
        </>
    );
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
            <g fill={PLUM} stroke={PLUM} strokeWidth="2.6" strokeLinejoin="round">{shapes}</g>
            <g fill="#ffffff">{shapes}</g>
        </svg>
    );
}

/** Pause: two rounded bars. */
function PauseIcon({ size, color = PLUM }: { size: number; color?: string }) {
    return (
        <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
            <rect x="3" y="2.5" width="3.6" height="11" rx="1.4" fill={color} />
            <rect x="9.4" y="2.5" width="3.6" height="11" rx="1.4" fill={color} />
        </svg>
    );
}

/** Total play time (from the save), mm:ss, or h:mm:ss past an hour. */
function Clock() {
    const t = useStore((s) => s.playSeconds);
    const hh = Math.floor(t / 3600);
    const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    return (
        <div
            className="flex items-center justify-center rounded-xl px-3 font-black tabular-nums"
            style={{
                height: 46,
                background: '#1d1216',
                border: `4px solid ${BROWN}`,
                boxShadow: `inset 0 0 0 2px #3b2a2f, 0 3px 0 ${BROWN_DARK}`,
                color: '#ff4a3a',
                fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                fontSize: 26,
                letterSpacing: 2,
                textShadow: '0 0 8px rgba(255,74,58,.7)',
            }}
        >
            {hh > 0 ? `${hh}:` : ''}{mm}:{ss}
        </div>
    );
}

const SKILL_CHIPS: { key: Skill; color: string; label: string }[] = [
    { key: 'attack', color: '#ff6b6b', label: 'Attack' },
    { key: 'defence', color: '#6ba8ff', label: 'Defence' },
    { key: 'speed', color: '#5ee08a', label: 'Speed' },
    { key: 'vitality', color: '#ffc94d', label: 'Vitality' },
];

/** Gems collected from monster drops and not yet spent: just the gem and the number, under the health plaque. */
function SkillChips() {
    const skills = useStore((s) => s.gems);
    return (
        <div className="absolute left-3 flex gap-3" style={{ top: 118 }}>
            {SKILL_CHIPS.map((c) => (
                <div
                    key={c.key}
                    aria-label={`${c.label} gems ${skills[c.key]}`}
                    className="flex items-center gap-0.5 text-[17px] font-black tabular-nums text-white"
                    style={{ textShadow: '0 2px 0 #1a0c10, 0 0 4px #1a0c10, 2px 0 0 #1a0c10, -2px 0 0 #1a0c10' }}
                >
                    <img src={`images/hud/gem-${c.key}.png`} width={30} height={30} draggable={false} alt="" style={{ filter: 'drop-shadow(0 2px 0 rgba(26,12,16,.6))' }} />
                    {skills[c.key]}
                </div>
            ))}
        </div>
    );
}

/** A visiting frog while it is around: an arrow to it, distance and seconds left. */
function FrogPill() {
    const aim = useStore((s) => s.frogAim);
    if (!aim) return null;
    return (
        <div
            className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-xl px-3 text-[13px] font-black tabular-nums text-white"
            style={{ top: 76, height: 28, background: 'rgba(40,90,20,.88)', border: '3px solid #a3e635' }}
        >
            <span style={{ display: 'inline-block', transform: `rotate(${aim.angle}rad)`, fontSize: 15, lineHeight: 1 }}>➤</span>
            <span>Frog · {Math.round(aim.dist)} tiles · {aim.left}s</span>
        </div>
    );
}

/** A small buy button: the cost with the gem it is paid in. */
function BuyBtn({ gem, cost, can, label, onBuy }: { gem: Skill; cost: number; can: boolean; label: string; onBuy: () => void }) {
    return (
        <button
            type="button"
            disabled={!can}
            className="flex items-center justify-center gap-1 rounded-lg px-2 font-black active:translate-y-[2px]"
            style={{ height: 34, minWidth: 74, background: can ? '#7ee081' : '#cfc3b8', border: `3px solid ${BROWN}`, fontSize: 13, opacity: can ? 1 : 0.7 }}
            onPointerDown={(e) => { e.preventDefault(); onBuy(); }}
        >
            {label}
            <img src={`images/hud/gem-${gem}.png`} width={18} height={18} draggable={false} alt="" />
            {cost}
        </button>
    );
}

/** The visiting frog's shop: skills and spells, paid with the gems you carry (they are lost if you die). */
function UpgradePanel() {
    const open = useStore((s) => s.shop);
    const gems = useStore((s) => s.gems);
    const skills = useStore((s) => s.skills);
    const spells = useStore((s) => s.spells);
    const [tab, setTab] = useState<'skills' | 'spells'>('skills');
    if (!open) return null;
    const tabBtn = (id: 'skills' | 'spells', label: string) => (
        <button
            type="button"
            className="rounded-lg px-3 font-black"
            style={{ height: 30, background: tab === id ? '#fff' : 'rgba(255,255,255,.4)', border: `3px solid ${BROWN}`, fontSize: 14 }}
            onPointerDown={(e) => { e.preventDefault(); setTab(id); }}
        >
            {label}
        </button>
    );
    return (
        <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center" style={{ background: 'rgba(10,6,16,.45)' }}>
            <div
                className="flex max-h-[96%] flex-col gap-2 overflow-y-auto rounded-2xl p-3"
                style={{ width: 400, background: `linear-gradient(${TAN_LIGHT}, ${TAN})`, border: `4px solid ${BROWN}`, boxShadow: `inset 0 0 0 2px ${TAN_LIGHT}, 0 4px 0 ${BROWN_DARK}`, color: INK }}
            >
                <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-1.5">{tabBtn('skills', 'Skills')}{tabBtn('spells', 'Spells')}</div>
                    <button
                        type="button"
                        className="rounded-lg px-3 font-black active:translate-y-[2px]"
                        style={{ height: 32, background: '#fff', border: `3px solid ${BROWN}`, fontSize: 14 }}
                        onPointerDown={(e) => { e.preventDefault(); store.patch({ shop: false }); }}
                    >
                        Close
                    </button>
                </div>
                <div className="text-[11px] font-bold" style={{ color: BROWN_DARK }}>Gems you carry are lost if you die. Spend them here.</div>
                {tab === 'skills' && SKILL_CHIPS.map((c) => {
                    const level = skills[c.key];
                    const maxed = level >= SKILL_CAP[c.key];
                    const cost = upgradeCost(level);
                    return (
                        <div key={c.key} className="flex items-center gap-2 rounded-xl px-2 py-1" style={{ background: 'rgba(255,255,255,.55)', border: `2px solid ${BROWN}` }}>
                            <img src={`images/hud/gem-${c.key}.png`} width={34} height={34} draggable={false} alt="" />
                            <div className="flex-1 leading-tight">
                                <div className="text-[15px] font-black">{c.label} · Lv {level}/{SKILL_CAP[c.key]}</div>
                                <div className="text-[12px] font-bold" style={{ color: BROWN_DARK }}>{SKILL_BLURB[c.key]} · you have {gems[c.key]}</div>
                            </div>
                            {maxed ? <span className="px-3 text-sm font-black">Max</span> : <BuyBtn gem={c.key} cost={cost} can={gems[c.key] >= cost} label="Buy" onBuy={() => progress.buy(c.key)} />}
                        </div>
                    );
                })}
                {tab === 'spells' && SPELLS.map((sp, i) => {
                    const have = spells.unlocked[i];
                    const carry = spells.carry[i];
                    const cool = spells.cooldown[i];
                    return (
                        <div key={sp.name} className="flex flex-col gap-1 rounded-xl px-2 py-1" style={{ background: 'rgba(255,255,255,.55)', border: `2px solid ${BROWN}` }}>
                            <div className="flex items-center gap-2">
                                <img src={`images/${sp.icon}`} width={34} height={34} draggable={false} alt="" style={{ objectFit: 'contain', opacity: have ? 1 : 0.55 }} />
                                <div className="flex-1 leading-tight">
                                    <div className="text-[15px] font-black">{sp.name}</div>
                                    <div className="text-[12px] font-bold" style={{ color: BROWN_DARK }}>{sp.blurb} · you have {gems[sp.gem]}</div>
                                </div>
                                {!have && <BuyBtn gem={sp.gem} cost={UNLOCK_COST} can={gems[sp.gem] >= UNLOCK_COST} label="Unlock" onBuy={() => progress.unlockSpell(i)} />}
                            </div>
                            {have && (
                                <div className="flex items-center justify-between gap-2 text-[12px] font-black">
                                    <span>Carry {maxCharges(carry)}/{maxCharges(CARRY_MAX)}</span>
                                    {carry >= CARRY_MAX ? <span className="px-3">Max</span> : <BuyBtn gem={sp.gem} cost={levelCost(carry)} can={gems[sp.gem] >= levelCost(carry)} label="+1" onBuy={() => progress.upgradeSpell(i, 'carry')} />}
                                    <span>Cooldown {Math.round(cooldownFor(sp, cool) / 100) / 10}s</span>
                                    {cool >= COOLDOWN_MAX ? <span className="px-3">Max</span> : <BuyBtn gem={sp.gem} cost={levelCost(cool)} can={gems[sp.gem] >= levelCost(cool)} label="-10%" onBuy={() => progress.upgradeSpell(i, 'cooldown')} />}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * The fight at a glance: safe in camp; a wave on (monsters left, waves still to come in the
 * onslaught); the few seconds before the next wave; or the breather after an onslaught.
 */
function WavePill() {
    const wave = useStore((s) => s.wave);
    const next = useStore((s) => s.nextWaveIn);
    const left = useStore((s) => s.waveLeft);
    const more = useStore((s) => s.onslaughtLeft);
    const fighting = useStore((s) => s.fighting);
    const shared = useStore((s) => s.sharedMonsters);
    const camp = useStore((s) => s.wavesCalm);
    const time = `${Math.floor(next / 60)}:${String(next % 60).padStart(2, '0')}`;
    const pill = (bg: string, edge: string, top: ReactNode, sub?: ReactNode, pulse = false) => (
        <div
            className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center rounded-xl px-3 py-0.5 text-[13px] font-black tabular-nums leading-tight text-white"
            style={{ top: 8, minHeight: 34, justifyContent: 'center', background: bg, border: `3px solid ${edge}`, animation: pulse ? 'eid-breathe 1s ease-in-out infinite' : undefined }}
        >
            <span>{top}{shared ? ' · shared' : ''}</span>
            {sub && <span className="text-[10px] font-bold opacity-85">{sub}</span>}
        </div>
    );
    if (camp && !(left && left > 0)) return pill('rgba(30,58,110,.85)', '#93c5fd', '🏕️ Safe in camp', 'The waves wait outside');
    if (left !== null && left > 0) return pill('rgba(120,20,20,.85)', '#ff6b6b', `⚔️ Wave ${wave} · ${left} left`, more > 0 ? `${more} more wave${more > 1 ? 's' : ''} in this onslaught` : 'Last wave of the onslaught!');
    if (fighting && next > 0) return pill('rgba(130,70,10,.88)', '#fbbf24', `Wave ${wave + 1} in ${next}s`, 'Get ready!', true);
    if (fighting) return pill('rgba(120,20,20,.85)', '#ff6b6b', `⚔️ Wave ${wave}`, 'Finish them off');
    if (wave === 0) return pill('rgba(22,12,16,.72)', '#6b4a52', `Wave 1 in ${time}`);
    return pill(next <= 10 ? 'rgba(130,70,10,.88)' : 'rgba(18,70,40,.85)', next <= 10 ? '#fbbf24' : '#4ade80', `🛡️ Breather · next onslaught in ${time}`, 'Rest, build and brew in camp', next <= 10);
}

/** A message that fades after a couple of seconds (wave starts, pickups). */
function Banner() {
    const banner = useStore((s) => s.banner);
    const [shown, setShown] = useState<string | null>(null);
    useEffect(() => {
        if (!banner) return;
        setShown(banner.text);
        const id = window.setTimeout(() => setShown(null), 2400);
        return () => window.clearTimeout(id);
    }, [banner]);
    return (
        <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center text-xl font-black text-white transition-opacity duration-500"
            style={{ top: 110, opacity: shown ? 1 : 0, textShadow: '0 2px 0 #1a0c10, 0 0 8px #1a0c10, 2px 0 0 #1a0c10, -2px 0 0 #1a0c10' }}
        >
            {shown ?? ''}
        </div>
    );
}

const BUFF_INFO: Record<string, { label: string; color: string }> = {
    blue: { label: 'Attack x1.5', color: '#5aa8ff' },
    yellow: { label: 'Stamina Tonic', color: '#ffd84d' },
    night: { label: 'Night vision', color: '#a5b4fc' },
    oilfire: { label: 'Fire oil', color: '#ff6a3d' },
    oilice: { label: 'Frost oil', color: '#7dd3fc' },
    bulwark: { label: 'Stone skin', color: '#c69c5d' },
    purple: { label: 'Shield', color: '#b070ff' },
    black: { label: 'Rage', color: '#c9b8e0' },
};

/** Potion boosts that are running, with seconds left. */
function Buffs() {
    const buffs = useStore((s) => s.buffs);
    if (buffs.length === 0) return null;
    return (
        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 gap-2" style={{ top: 142 }}>
            {buffs.map((b) => (
                <div
                    key={b.key}
                    className="whitespace-nowrap rounded-full px-3 text-sm font-black text-white"
                    style={{ background: 'rgba(20,16,30,.85)', border: `3px solid ${BUFF_INFO[b.key]?.color ?? '#fff'}`, lineHeight: '24px' }}
                >
                    {BUFF_INFO[b.key]?.label} · {b.left}s
                </div>
            ))}
        </div>
    );
}

export default function Hud() {
    const paused = useStore((s) => s.paused);
    const netStatus = useStore((s) => s.netStatus);
    const online = useStore((s) => s.online);
    const roomCode = useStore((s) => s.roomCode);
    const kills = useStore((s) => s.kills);
    // The story starts with Elder Theron's prologue the first time.
    useEffect(() => {
        const id = window.setTimeout(maybeShowIntro, 600);
        return () => window.clearTimeout(id);
    }, []);

    return (
        <div className="pointer-events-none absolute inset-0 pt-safe-top">
            {/* Top left: portrait, health bar, level bar */}
            <div className="absolute left-3 top-2 flex items-start gap-2 pt-safe-top">
                <div
                    className="shrink-0 overflow-hidden"
                    style={{
                        width: 66,
                        height: 66,
                        borderRadius: 16,
                        border: `4px solid ${BROWN}`,
                        boxShadow: `inset 0 0 0 2px #e0b04a, 0 3px 0 ${BROWN_DARK}`,
                        background: 'radial-gradient(circle at 50% 35%, #7a4fa3, #3b2253)',
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            backgroundImage: 'url(images/world/char/idle.png)',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: '1224px 765px',
                            backgroundPosition: '-47px -27px',
                        }}
                    />
                </div>
                <VitalsBars />
            </div>

            {/* Top right: clock, bag and pause */}
            <div className="absolute right-3 top-2 flex items-center gap-2 pt-safe-top">
                <SoundButton dark />
                <Clock />
                <GlassButton size={48} label="Bag" onPress={() => store.patch({ bagTab: 'items' })}>
                    <Pic name="log" size={30} />
                </GlassButton>
                <GlassButton size={48} label="Pause" onPress={() => store.patch({ phase: 'menu' })}>
                    <PauseIcon size={22} color="#fff" />
                </GlassButton>
            </div>

            <FrogPill />
            <Objective />
            <WorldPills />
            <BossBar />
            <UpgradePanel />
            <HousePanel />
            <TravelPanel />
            <NpcPanel />
            <BuildPanel />
            <BigMap />
            <BagPanel />
            <KingdomChooser />
            <StoryDialog />
            <GameOver />
            <Hotbar4 />
            <Radar />
            <DownedOverlay />
            <SkillChips />
            <WavePill />
            <Banner />
            <Buffs />

            <ActionCluster />

            {/* World readout, small */}
            {/* Enemies defeated */}
            {kills > 0 && (
                <div className="absolute bottom-[82px] left-3 rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-bold text-white">
                    ⚔️ Defeated · {kills}
                </div>
            )}

            {/* Multiplayer: the room's code (tap to copy) and how many are in it */}
            {netStatus !== 'off' && (
                <button
                    type="button"
                    className="pointer-events-auto absolute bottom-[22px] left-[72px] flex touch-manipulation items-center gap-1.5 rounded-md bg-black/50 px-2 py-0.5 text-[11px] font-bold text-white"
                    onClick={() => {
                        if (roomCode) {
                            try { void navigator.clipboard?.writeText(roomCode); } catch { /* clipboard unavailable */ }
                            store.patch({ banner: { text: `Room code ${roomCode} copied`, id: Date.now() } });
                        }
                    }}
                >
                    <span className={`inline-block h-2 w-2 rounded-full ${netStatus === 'online' ? 'bg-emerald-400' : 'animate-pulse bg-amber-300'}`} />
                    {netStatus !== 'online'
                        ? 'Connecting…'
                        : roomCode
                            ? `Room ${roomCode} · ${online}`
                            : `Online · ${online} ${online === 1 ? 'player' : 'players'}`}
                </button>
            )}

            {paused && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <p className="text-2xl font-bold">Paused</p>
                </div>
            )}
        </div>
    );
}
