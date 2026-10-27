/**
 * The pause screen: Resume, the quest log, every story page read this session (Story so far),
 * the settings, and Save & quit to the menu. Solo, the world stands still behind it (GameCanvas stops
 * the ticker); in co-op the world goes on, and the screen says so. Escape or the Pause button opens
 * and closes it.
 */
import { useEffect, useState } from 'react';
import { store, useStore } from '../state/store.ts';
import { saveSystem } from '../saveConfig.ts';
import { slots } from '../game/slots.ts';
import { SettingsPanel } from './Celestial.tsx';
import { slice } from './px.tsx';

type View = 'main' | 'log' | 'settings';

export function PauseMenu() {
    const open = useStore((s) => s.pauseMenu);
    const log = useStore((s) => s.storyLog);
    const objective = useStore((s) => s.objective);
    const online = useStore((s) => s.netStatus === 'online');
    const [view, setView] = useState<View>('main');
    const [openAt, setOpenAt] = useState<number | null>(null);
    useEffect(() => { if (!open) { setView('main'); setOpenAt(null); } }, [open]);
    // Escape: open (when nothing else is up), step back, or resume.
    useEffect(() => {
        const on = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            const s = store.get();
            if (s.phase !== 'playing' || s.cine) return;
            if (!s.pauseMenu) {
                if (s.storyPopup || s.bagTab || s.bigMap || s.puzzle || s.npc || s.house || s.travel || s.loom || s.debate || s.gameOver) return;
                store.patch({ pauseMenu: true });
            } else if (view !== 'main') setView('main');
            else store.patch({ pauseMenu: false });
            e.preventDefault();
        };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    }, [view]);
    if (!open) return null;
    const resume = () => store.patch({ pauseMenu: false });
    const quit = async () => {
        await saveSystem.flush();
        slots.touch(true);
        store.patch({ pauseMenu: false, phase: 'menu' });
    };
    const row = 'w-full min-h-[46px] px-4 text-[17px] text-left';
    const btn = (label: string, act: () => void, tone: 'stone' | 'wood' = 'stone') => (
        <button key={label} type="button" onClick={act} className={row} style={{ ...slice(tone === 'wood' ? 'btn3-normal' : 'btn2-normal', 2), color: tone === 'wood' ? '#fff3d6' : '#fbf7f0' }}>{label}</button>
    );
    return (
        <div className="pointer-events-auto absolute inset-0 z-[60] flex items-center justify-center p-2" style={{ background: 'rgba(4,3,10,.72)', backdropFilter: 'blur(3px)' }} data-quiet>
            {view === 'settings' ? (
                <SettingsPanel onBack={() => setView('main')} />
            ) : view === 'log' ? (
                <div className="flex max-h-full w-[min(640px,96vw)] flex-col gap-2 rounded-md p-3" style={{ background: 'linear-gradient(180deg, rgba(40,32,46,.97), rgba(20,16,24,.97))', border: '2px solid #1b1622', boxShadow: '0 0 0 1px rgba(243,227,192,.25)' }}>
                    <div className="shrink-0 text-center text-[28px] leading-none text-[#f3e3c0]" style={{ fontFamily: 'var(--font-relic)' }}>The Story So Far</div>
                    <div className="pan-y flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
                        {log.length === 0 && <p className="py-6 text-center text-white/60">Nothing yet. Every page you read is kept here.</p>}
                        {[...log].reverse().map((p, n) => {
                            const k = log.length - 1 - n;
                            const shown = openAt === k;
                            return (
                                <button key={k} type="button" onClick={() => setOpenAt(shown ? null : k)} className="w-full rounded-sm px-3 py-2 text-left" style={{ background: shown ? 'rgba(196,148,52,.2)' : 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)' }}>
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#e0a948]">{p.speaker}</div>
                                    <div className="text-[16px] text-[#fff3d6]">{p.title}</div>
                                    {shown ? p.lines.map((l, i) => <p key={i} className="mt-1.5 text-[14px] leading-snug text-white/85">{l}</p>) : <p className="truncate text-[12px] text-white/50">{p.lines[0]}</p>}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex shrink-0 justify-end">{btn('Back', () => setView('main'))}</div>
                </div>
            ) : (
                <div className="flex w-[min(380px,92vw)] flex-col gap-2 rounded-md p-4" style={{ background: 'linear-gradient(180deg, rgba(40,32,46,.97), rgba(20,16,24,.97))', border: '2px solid #1b1622', boxShadow: '0 0 0 1px rgba(243,227,192,.25), 0 10px 30px rgba(0,0,0,.6)' }}>
                    <div className="text-center text-[32px] leading-none text-[#f3e3c0]" style={{ fontFamily: 'var(--font-relic)' }}>Paused</div>
                    {online && <p className="text-center text-[12px] text-[#fca5a5]">Co-op: the world keeps going while you are here.</p>}
                    {objective && <p className="text-center text-[13px] leading-snug text-white/70">{objective.title} · {objective.task}</p>}
                    {btn('Resume', resume, 'wood')}
                    {btn('Quest log', () => store.patch({ pauseMenu: false, bagTab: 'story' }))}
                    {btn('The story so far', () => setView('log'))}
                    {btn('Settings', () => setView('settings'))}
                    {btn('Save & quit to menu', () => void quit())}
                </div>
            )}
        </div>
    );
}
