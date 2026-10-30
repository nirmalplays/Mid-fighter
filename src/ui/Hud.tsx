/**
 * In-game HUD: a React overlay above the Pixi canvas, kept clean: the minimap, a status line and
 * the quest tracker top left, the UI Asset Pack's stone buttons top right (HudTop.tsx), the
 * vitals and hotbar bottom centre, the action buttons bottom right (Actions.tsx). The survival
 * panels (bag, story, map, build) live in SurvivalHud.tsx.
 *
 * Pattern to keep: the overlay itself is pointer-events-none so touches fall
 * through to the canvas (the movement joystick); each control opts back in with
 * pointer-events-auto. `pt-safe-top` (see app.css) pads below the RUN host
 * header. Action buttons fire on pointer-down and emit commands the world scene hears.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { commands, type GameCommand } from '../game/commands.ts';
import { ActionCluster } from './Actions.tsx';
import { Ico, type IconName } from './icons.tsx';
import { BottomVitals, EdgeArrow, QuestTracker, StatusLine, TopButtons, useCompact, WavePlaque } from './HudTop.tsx';
import { store, useStore } from '../state/store.ts';
import { progress } from '../game/progress.ts';
import { SKILL_BLURB, SKILL_CAP, upgradeCost } from '../game/skills.ts';
import type { Skill } from '../shared/sim.ts';
import { GameOver } from './Scores.tsx';
import { buyPack, loadPrices, PACKS, REVIVE_MAX, type TokenPack } from '../game/revive.ts';
import { SoundButton } from './SoundButton.tsx';
import {
    BagPanel, BigMap, BossBar, BuildPanel, DownedOverlay, Hotbar4, HousePanel, KingdomChooser, maybeShowIntro, NpcPanel, Radar,
    StoryDialog, TravelPanel,
} from './SurvivalHud.tsx';
import { PuzzlePanel, StoryHud } from './StoryPanels.tsx';
import { CinematicOverlay } from './CinematicOverlay.tsx';
import { useUiZoom } from './uiScale.ts';
import { BoonPicker, TalentPanel } from './Progression.tsx';
import { PauseMenu } from './PauseMenu.tsx';
import { Coach, ObjectiveCard } from './Guide.tsx';
import { DebatePanel, LoomPanel } from './StoryPuzzles.tsx';
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

/** The four gem skills the frog sells. */
const SKILL_CHIPS: { key: Skill; color: string; label: string }[] = [
    { key: 'attack', color: '#ff6b6b', label: 'Attack' },
    { key: 'defence', color: '#6ba8ff', label: 'Defence' },
    { key: 'speed', color: '#5ee08a', label: 'Speed' },
    { key: 'vitality', color: '#ffc94d', label: 'Vitality' },
];


/** A visiting frog while it is around: an arrow to it, distance and seconds left. */
function FrogPill() {
    const aim = useStore((s) => s.frogAim);
    if (!aim) return null;
    return (
        <div
            className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-xl px-3 text-[13px] font-black tabular-nums text-white"
            style={{ top: 76, height: 28, background: 'rgba(40,90,20,.88)', border: '3px solid #a3e635' }}
        >
            <span style={{ display: 'inline-flex', transform: `rotate(${aim.angle}rad)` }}><Ico name="pointer" size={14} color="#fff" style={{ transform: 'rotate(45deg)' }} /></span>
            <span>Frog · {Math.round(aim.dist)} tiles · {aim.left}s</span>
        </div>
    );
}

/** Tap the token count to open the revive shop (not during the Game Over screen, which has its own button). */
function ReviveTokens() {
    const n = useStore((s) => s.reviveTokens);
    const over = useStore((s) => s.gameOver);
    // Beside the minimap's lower right (SurvivalHud Radar: 88 px on a phone, 138 otherwise), clear of the quest line.
    const mini = useCompact() ? 88 : 138;
    if (over) return null;
    return (
        <button
            type="button"
            className="pointer-events-auto absolute flex items-center gap-1 rounded-xl px-2 text-[13px] font-black tabular-nums"
            style={{ left: `calc(max(12px, env(safe-area-inset-left)) + ${mini + 6}px)`, top: 10 + mini - 28, height: 28, background: '#fff', border: `3px solid ${BROWN}`, color: INK }}
            onPointerDown={(e) => { e.preventDefault(); store.patch({ reviveShop: true }); }}
        >
            <Ico name="heart" size={14} color="#e5484d" />
            <span>{n}</span>
            <span>+</span>
        </button>
    );
}

/** The revive shop: token packs paid with RUN Bits through the RUN shop. */
function ReviveShop() {
    const open = useStore((s) => s.reviveShop);
    const tokens = useStore((s) => s.reviveTokens);
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<string | null>(null);
    useEffect(() => {
        if (open) void loadPrices().then(setPrices);
    }, [open]);
    if (!open) return null;
    const buy = async (pack: TokenPack) => {
        if (busy) return;
        setBusy(true);
        setNote(null);
        const r = await buyPack(pack);
        setBusy(false);
        setNote(r === 'bought' ? `+${pack.tokens} revive${pack.tokens > 1 ? 's' : ''}` : r === 'failed' ? 'Purchase failed. You were not charged.' : null);
    };
    return (
        <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(10,6,16,.55)' }}>
            <div
                className="flex flex-col gap-2 rounded-2xl p-3"
                style={{ width: 360, background: `linear-gradient(${TAN_LIGHT}, ${TAN})`, border: `4px solid ${BROWN}`, boxShadow: `inset 0 0 0 2px ${TAN_LIGHT}, 0 4px 0 ${BROWN_DARK}`, color: INK }}
            >
                <div className="flex items-center justify-between gap-2">
                    <div className="text-[16px] font-black">Revive Tokens · you have {tokens}</div>
                    <button
                        type="button"
                        className="rounded-lg px-3 font-black active:translate-y-[2px]"
                        style={{ height: 32, background: '#fff', border: `3px solid ${BROWN}`, fontSize: 14 }}
                        onPointerDown={(e) => { e.preventDefault(); store.patch({ reviveShop: false }); }}
                    >
                        Close
                    </button>
                </div>
                <div className="text-[11px] font-bold" style={{ color: BROWN_DARK }}>
                    A token is used automatically when you fall: you get back up at full health where you fell. Up to {REVIVE_MAX} per run.
                </div>
                {PACKS.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-xl px-2 py-1" style={{ background: 'rgba(255,255,255,.55)', border: `2px solid ${BROWN}` }}>
                        <Ico name="heart" size={26} color="#e5484d" />
                        <div className="flex-1 text-[14px] font-black leading-tight">{p.tokens} {p.tokens > 1 ? 'tokens' : 'token'}</div>
                        <button
                            type="button"
                            disabled={busy}
                            className="rounded-lg px-3 font-black active:translate-y-[2px]"
                            style={{ height: 34, minWidth: 92, background: busy ? '#cfc3b8' : '#7ee081', border: `3px solid ${BROWN}`, fontSize: 13 }}
                            onPointerDown={(e) => { e.preventDefault(); void buy(p); }}
                        >
                            {prices[p.id] ?? p.bits} Bits
                        </button>
                    </div>
                ))}
                <div className="min-h-[16px] text-center text-[12px] font-black">{note}</div>
            </div>
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
    // A cinematic owns the screen: only its letterbox and lines show.
    const cinematic = useStore((s) => s.cine !== null);
    // A short screen lays the HUD out taller and zooms it down to fit (ui/uiScale.ts).
    const zoom = useUiZoom();
    // The story starts with Master Orin's prologue the first time.
    useEffect(() => {
        const id = window.setTimeout(maybeShowIntro, 600);
        return () => window.clearTimeout(id);
    }, []);

    if (cinematic) return <CinematicOverlay />;
    return (
        // (a percentage size is not zoomed, so the root still fills the screen; inside it, every px is zoomed)
        <div className="pointer-events-none absolute inset-0 pt-safe-top" style={{ zoom }}>
            {/* Top: the minimap and what is around (left), the stone buttons (right); bottom: the vitals */}
            <TopButtons />
            <StatusLine />
            <QuestTracker />
            <EdgeArrow />
            <BottomVitals />

            <FrogPill />
            <BossBar />
            <UpgradePanel />
            <ReviveTokens />
            <ReviveShop />
            <HousePanel />
            <TravelPanel />
            <NpcPanel />
            <BuildPanel />
            <BigMap />
            <BagPanel />
            <KingdomChooser />
            <StoryHud />
            <ObjectiveCard />
            <Coach />
            <PuzzlePanel />
            <LoomPanel />
            <DebatePanel />
            <StoryDialog />
            <GameOver />
            <Hotbar4 />
            <Radar />
            <DownedOverlay />
            <WavePlaque />
            <Banner />
            <Buffs />

            <ActionCluster />
            <TalentPanel />
            <BoonPicker />
            <PauseMenu />

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
