/**
 * Menu pieces: rune-carved stone slab buttons, the celestial map for choosing a kingdom,
 * and the settings panel. (The home screen's painting is ui/Landscape.tsx.)
 */
import { PxButton, slice } from './px.tsx';
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


/** Settings: weather effects, how dark nights are, hints, the radar, and erasing your progress. */
export function SettingsPanel({ onBack }: { onBack: () => void }) {
    const s = useSettings();
    const [confirm, setConfirm] = useState(false);
    const row = 'flex items-center justify-between gap-3 px-2 py-1.5 text-[15px] text-[#2f2a35]';
    const Toggle = ({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) => (
        <button type="button" onClick={() => set(!on)} className={row} style={{ borderBottom: '2px solid rgba(47,42,53,.15)' }}>
            {label}
            {/* the pack's wooden switch: off, then on */}
            <span aria-label={on ? 'On' : 'Off'} style={{ width: 64, height: 32, backgroundImage: 'url(images/ui/toggle.png)', backgroundSize: '128px 32px', backgroundPosition: on ? '-64px 0' : '0 0', imageRendering: 'pixelated' }} />
        </button>
    );
    return (
        <div className="flex max-h-[calc(100dvh-60px)] w-[min(480px,92vw)] flex-col gap-0.5 overflow-y-auto px-4 pb-3 pt-2" style={{ ...slice('frame5', 3), color: '#2f2a35' }}>
            <div className="text-center text-[34px] leading-none" style={{ fontFamily: 'var(--font-relic)', color: '#2f2a35' }}>Settings</div>
            <Toggle label="Rain, storm and fog effects" on={s.weatherFx} set={(v) => settings.set({ weatherFx: v })} />
            <Toggle label="Hints" on={s.hints} set={(v) => settings.set({ hints: v })} />
            <Toggle label="Minimap" on={s.radar} set={(v) => settings.set({ radar: v })} />
            <Toggle label="Music" on={s.music} set={(v) => settings.set({ music: v })} />
            <label className={row}>Music volume<input type="range" min={0} max={1} step={0.05} value={s.musicVolume} onChange={(e) => settings.set({ musicVolume: Number(e.target.value) })} className="w-40 accent-[#8a5a2a]" /></label>
            <Toggle label="Sound effects" on={s.sound} set={(v) => settings.set({ sound: v })} />
            <label className={row}>Effects volume<input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => settings.set({ volume: Number(e.target.value) })} className="w-40 accent-[#8a5a2a]" /></label>
            <div className={row}>
                Night darkness
                <span className="flex gap-1">
                    {(['soft', 'normal', 'deep'] as const).map((n) => (
                        <button key={n} type="button" onClick={() => settings.set({ night: n })} className="px-2 text-[13px] capitalize" style={{ ...slice(s.night === n ? 'btn3-normal' : 'btn2-normal', 2), color: s.night === n ? '#fff3d6' : '#fbf7f0' }}>{n}</button>
                    ))}
                </span>
            </div>
            <div className="mt-1 text-[10px] leading-snug text-[#4a4450]">Art: Super Pixel Effects Gigapack (Will Tice / unTied Games) · UI Asset Pack (Beowulf) · slash and frog art (Frostwindz) · buildings, items and portal (CraftPix). Fonts: Cinzel Decorative, Jacquard 12, Pixelify Sans, Silkscreen (OFL). Sounds: Mixkit, Pixabay creators, and the game's BGM and effect packs.</div>
            <div className="mt-2 flex justify-center gap-2">
                <PxButton variant="stone" onClick={() => { if (!confirm) { setConfirm(true); window.setTimeout(() => setConfirm(false), 4000); return; } progress.reset(); setConfirm(false); }}>{confirm ? 'Tap again to erase' : 'Erase progress'}</PxButton>
                <PxButton variant="wood" onClick={onBack}>Back</PxButton>
            </div>
        </div>
    );
}
