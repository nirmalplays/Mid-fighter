/**
 * Menu pieces: rune-carved stone slab buttons, the celestial map for choosing a kingdom,
 * and the settings panel. (The home screen's painting is ui/Landscape.tsx.)
 */
import { useRef, useState, type ReactNode } from 'react';
import { progress } from '../game/progress.ts';
import { settings, useSettings } from '../game/settings.ts';
import { ELEMENTS, KINGDOMS, MALAKOR, nextKingdom, type Element } from '../game/eidolon.ts';
import { useStore } from '../state/store.ts';

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
/** A rune-carved stone slab button. */
export function StoneSlab({ children, sub, onClick, accent = '#a78bfa', size = 'lg', disabled }: { children: ReactNode; sub?: string; onClick: () => void; accent?: string; size?: 'lg' | 'sm'; disabled?: boolean }) {
    const runes = useRef(Array.from({ length: 4 }, () => RUNES[Math.floor(Math.random() * RUNES.length)]).join(' ')).current;
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="eid-slab group relative w-full overflow-hidden rounded-md text-left transition-transform active:translate-y-[2px] disabled:opacity-50"
            style={{
                padding: size === 'lg' ? '10px 16px' : '6px 12px',
                background: 'linear-gradient(180deg, #6d6577 0%, #4a4352 45%, #35303d 100%)',
                border: '2px solid #1b1622',
                boxShadow: `inset 0 2px 0 rgba(255,255,255,.18), inset 0 -3px 0 rgba(0,0,0,.35), 0 4px 0 #1b1622, 0 0 0 1px ${accent}55`,
                ['--accent' as string]: accent,
            }}
        >
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[22px] font-black tracking-[0.2em] opacity-25 transition-opacity group-hover:opacity-70" style={{ color: accent, textShadow: `0 0 8px ${accent}` }}>{runes}</span>
            <span className="relative block font-black tracking-wide text-[#f3eefb]" style={{ fontSize: size === 'lg' ? 19 : 14, textShadow: '0 2px 0 #120d18' }}>{children}</span>
            {sub && <span className="relative block text-[11px] font-bold text-[#cfc6dc]">{sub}</span>}
        </button>
    );
}

/** Where each kingdom sits on the celestial map (the screen direction of its quarter of the world). */
const MAP_POS: Record<Element, { x: number; y: number }> = { air: { x: 50, y: 15 }, fire: { x: 85, y: 50 }, water: { x: 50, y: 85 }, earth: { x: 15, y: 50 } };

/** The celestial map: click a kingdom for its lore, passive and active skill; pledge to it if you have none yet. */
export function KingdomMap({ onPledge, onBack }: { onPledge?: (e: Element) => void; onBack?: () => void }) {
    const mine = useStore((s) => s.kingdom);
    const [pick, setPick] = useState<Element>(mine ?? 'fire');
    const k = KINGDOMS[pick];
    return (
        <div className="flex w-full max-w-[860px] flex-col gap-3 sm:flex-row">
            <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-2xl sm:w-[min(400px,46vw)]" style={{ background: 'radial-gradient(circle at 50% 50%, #241634 0%, #0b0614 75%)', border: '2px solid #4b3b66', boxShadow: 'inset 0 0 40px #000' }}>
                <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
                    {ELEMENTS.map((e) => <line key={e} x1="50" y1="50" x2={MAP_POS[e].x} y2={MAP_POS[e].y} stroke={KINGDOMS[e].css} strokeWidth="0.5" strokeDasharray="1.5 1.5" opacity="0.7" />)}
                    <circle cx="50" cy="50" r="7" fill="#1a0f26" stroke="#8b5cf6" strokeWidth="0.8" style={{ animation: 'eid-breathe 5s ease-in-out infinite' }} />
                    <text x="50" y="62" textAnchor="middle" fontSize="3.2" fill="#c4b5fd" fontWeight="900">VOID CITADEL</text>
                </svg>
                {ELEMENTS.map((e) => {
                    const at = MAP_POS[e];
                    const on = pick === e;
                    return (
                        <button key={e} type="button" onClick={() => setPick(e)} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${at.x}%`, top: `${at.y}%` }}>
                            <span className="flex items-center justify-center rounded-full text-[26px]" style={{ width: on ? 64 : 52, height: on ? 64 : 52, background: `radial-gradient(circle at 35% 30%, #fff, ${KINGDOMS[e].css} 45%, #0b0614)`, boxShadow: `0 0 ${on ? 26 : 12}px ${KINGDOMS[e].css}`, border: on ? '3px solid #fff' : '2px solid #0b0614', transition: 'all .2s' }}>{KINGDOMS[e].glyph}</span>
                            <span className="mt-1 text-[12px] font-black text-white" style={{ textShadow: '0 1px 2px #000' }}>{KINGDOMS[e].name}{mine === e ? ' ★' : ''}</span>
                        </button>
                    );
                })}
            </div>
            <div className="flex flex-1 flex-col gap-2 rounded-2xl p-3 text-[#efe8fa]" style={{ background: 'rgba(20,12,30,.85)', border: `2px solid ${k.css}` }}>
                <div className="text-[22px] font-black" style={{ color: k.css }}>{k.glyph} {k.name}</div>
                <div className="text-[11px] font-black uppercase tracking-wide text-[#b9aed0]">{k.land}</div>
                <div className="text-[13px] font-bold leading-snug">{k.theme}. Ruled now by {k.warden.name}, {k.warden.title}, who holds the seal to {KINGDOMS[nextKingdom(pick)].name}.</div>
                <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,.06)' }}>
                    <div className="text-[11px] font-black uppercase text-[#b9aed0]">Passive</div>
                    <div className="text-[13px] font-bold">{k.power}</div>
                </div>
                <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,.06)' }}>
                    <div className="text-[11px] font-black uppercase text-[#b9aed0]">Active skill · {k.skill.name}</div>
                    <div className="text-[13px] font-bold">{k.skill.blurb}. Charged by fighting (the meter around the skill button).</div>
                </div>
                <div className="mt-auto flex gap-2">
                    {onPledge && !mine && <StoneSlab size="sm" accent={k.css} onClick={() => onPledge(pick)}>Pledge to {k.name}</StoneSlab>}
                    {mine && <div className="flex-1 text-[12px] font-bold text-[#cfc6dc]">You are pledged to {KINGDOMS[mine].name}. A new game lets you choose again.</div>}
                    {onBack && <StoneSlab size="sm" accent="#9ca3af" onClick={onBack}>Back</StoneSlab>}
                </div>
            </div>
        </div>
    );
}

/** Settings: weather effects, how dark nights are, hints, the radar, and erasing your progress. */
export function SettingsPanel({ onBack }: { onBack: () => void }) {
    const s = useSettings();
    const [confirm, setConfirm] = useState(false);
    const Toggle = ({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) => (
        <button type="button" onClick={() => set(!on)} className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] font-bold text-[#efe8fa]" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid #4b3b66' }}>
            {label}
            <span className="rounded-full px-2 text-[12px] font-black" style={{ background: on ? '#86efac' : '#4b3b66', color: on ? '#14532d' : '#cfc6dc' }}>{on ? 'On' : 'Off'}</span>
        </button>
    );
    return (
        <div className="flex max-h-[calc(100dvh-80px)] w-[min(440px,92vw)] flex-col gap-2 overflow-y-auto rounded-2xl p-4" style={{ background: 'rgba(20,12,30,.9)', border: '2px solid #8b5cf6' }}>
            <div className="text-[20px] font-black text-[#efe8fa]">Settings</div>
            <Toggle label="Rain, storm and fog effects" on={s.weatherFx} set={(v) => settings.set({ weatherFx: v })} />
            <Toggle label="'Use' hints" on={s.hints} set={(v) => settings.set({ hints: v })} />
            <Toggle label="Radar" on={s.radar} set={(v) => settings.set({ radar: v })} />
            <Toggle label="Music" on={s.music} set={(v) => settings.set({ music: v })} />
            <label className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[14px] font-bold text-[#efe8fa]" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid #4b3b66' }}>
                Music volume
                <input type="range" min={0} max={1} step={0.05} value={s.musicVolume} onChange={(e) => settings.set({ musicVolume: Number(e.target.value) })} className="w-40 accent-violet-400" />
            </label>
            <Toggle label="Sound effects" on={s.sound} set={(v) => settings.set({ sound: v })} />
            <label className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[14px] font-bold text-[#efe8fa]" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid #4b3b66' }}>
                Effects volume
                <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => settings.set({ volume: Number(e.target.value) })} className="w-40 accent-violet-400" />
            </label>
            <div className="flex items-center justify-between rounded-lg px-3 py-2 text-[14px] font-bold text-[#efe8fa]" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid #4b3b66' }}>
                Night darkness
                <span className="flex gap-1">
                    {(['soft', 'normal', 'deep'] as const).map((n) => (
                        <button key={n} type="button" onClick={() => settings.set({ night: n })} className="rounded-full px-2 text-[12px] font-black capitalize" style={{ background: s.night === n ? '#c4b5fd' : '#2a1f3a', color: s.night === n ? '#1b1033' : '#cfc6dc' }}>{n}</button>
                    ))}
                </span>
            </div>
            <div className="text-[11px] font-bold text-[#9d92b5]">Settings are kept on this device. {MALAKOR.name} cannot read them.</div>
            <div className="text-[10px] font-semibold leading-snug text-[#8a7fa3]">Art: Super Pixel Effects Gigapack (Will Tice / unTied Games) · slash and frog art (Frostwindz) · buildings, items and portal (CraftPix). Sounds: Mixkit, Pixabay creators (alphix, floraphonic, Universfield, freesound_community), and the game's BGM and special-effect packs.</div>
            <div className="mt-1 flex gap-2">
                <StoneSlab size="sm" accent="#ef4444" onClick={() => { if (!confirm) { setConfirm(true); window.setTimeout(() => setConfirm(false), 4000); return; } progress.reset(); setConfirm(false); }}>{confirm ? 'Tap again to erase everything' : 'New game (erase progress)'}</StoneSlab>
                <StoneSlab size="sm" accent="#9ca3af" onClick={onBack}>Back</StoneSlab>
            </div>
        </div>
    );
}
