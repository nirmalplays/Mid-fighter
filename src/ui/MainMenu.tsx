/**
 * The home screen, laid out like a console classic: a pixel-art forest (menu/PixelForest.tsx) with
 * the ruin of an arch and a wanderer by a stream, the MEH FIGHTER title at the left, and the
 * choices in a right-aligned list: the chosen one gets a gold band and the pack's sword cursor;
 * a rule beneath, then what it does and the keys. Up / Down / Enter / Escape, or the pointer.
 * The first time in a session the title is forged at the centre first (PixelLogo's intro), then
 * settles to the left and the list comes in. Screens:
 *   title    - Continue (only with a save), New Game (the intro cutscene, then a kingdom), Co-op,
 *              Kingdoms (the orrery, to read about the four lands), Legends, Settings
 *   online   - Quick Play (the public room), Create a Room (share its code), Join a Room
 *   join     - type a friend's room code
 * Saves are per RUN account, so a friend has their own progress in any room.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { settings, useSettings } from '../game/settings.ts';
import { slice } from './px.tsx';
import { PixelIcon, StoneButton } from './HudTop.tsx';
import { PixelLogo } from './PixelLogo.tsx';
import { PixelForest } from './menu/PixelForest.tsx';
import { net } from '../game/net/multiplayer.ts';
import { progress } from '../game/progress.ts';
import { KINGDOMS } from '../game/eidolon.ts';
import { store, useStore } from '../state/store.ts';
import { TopScores } from './Scores.tsx';
import { sfx, useMusicBlocked } from '../game/audio.ts';
import { SettingsPanel } from './Celestial.tsx';
import { KingdomOrbit } from './KingdomSelect.tsx';


type Screen = 'title' | 'online' | 'join' | 'scores' | 'kingdoms' | 'settings';
/** A choice in the list: its words, a line on what it does, and whether it is shown greyed or as a warning. */
type Item = { label: string; hint?: string; act: () => void; off?: boolean; warn?: boolean };
/** The title is forged once a session; after that the menu opens straight away. */
let introPlayed = false;

function playedLabel(seconds: number, kills: number): string {
    const m = Math.floor(seconds / 60);
    const t = m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
    return `${t} played${kills ? ` · ${kills} defeated` : ''}`;
}

export default function MainMenu() {
    const [screen, setScreen] = useState<Screen>('title');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const netStatus = useStore((s) => s.netStatus);
    const roomCode = useStore((s) => s.roomCode);
    const online = useStore((s) => s.online);
    const kingdom = useStore((s) => s.kingdom);
    const played = (progress.saved?.playSeconds ?? 0) > 5;
    /** A save worth continuing: some play, or a kingdom already chosen. */
    const hasSave = played || !!kingdom;
    const [confirmNew, setConfirmNew] = useState(false);
    /** New Game: wipe any save (after a second tap), then the intro and the choice of kingdom. */
    const newGame = () => {
        if (hasSave && !confirmNew) {
            setConfirmNew(true);
            window.setTimeout(() => setConfirmNew(false), 4000);
            return;
        }
        setConfirmNew(false);
        net.leave();
        progress.reset();
        store.patch({ phase: 'intro' });
    };
    const inRoom = netStatus === 'online';

    /** Start playing from this player's save. */
    const start = () => {
        sfx('start');
        store.patch({ phase: 'playing' });
    };

    const enter = async (req: Parameters<typeof net.connect>[0]) => {
        setBusy(true);
        setError(null);
        const r = await net.connect(req);
        setBusy(false);
        if (!r.ok) {
            setError(r.error ?? 'Could not connect.');
            return;
        }
        if (req.kind === 'create' && r.code) store.patch({ banner: { text: `Room code ${r.code} · friends join with this`, id: Date.now() } });
        start();
    };

    // The scene parts as the pointer moves.
    const [look, setLook] = useState({ x: 0, y: 0 });
    useEffect(() => {
        const on = (e: PointerEvent) => setLook({ x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 });
        window.addEventListener('pointermove', on);
        return () => window.removeEventListener('pointermove', on);
    }, []);

    // The title's entrance: once a session. If the browser keeps the page silent until touched,
    // it waits on "Press any key" first, so the strike is heard.
    const blocked = useMusicBlocked();
    const [intro, setIntro] = useState<'wait' | 'play' | 'done'>(() => (introPlayed ? 'done' : 'wait'));
    useEffect(() => {
        if (intro !== 'wait') return;
        const id = window.setTimeout(() => !blocked && setIntro('play'), 450);
        return () => window.clearTimeout(id);
    }, [intro, blocked]);
    useEffect(() => {
        if (intro !== 'wait' || !blocked) return;
        const go = () => setIntro('play');
        window.addEventListener('pointerdown', go, { once: true });
        window.addEventListener('keydown', go, { once: true });
        return () => {
            window.removeEventListener('pointerdown', go);
            window.removeEventListener('keydown', go);
        };
    }, [intro, blocked]);
    const settle = () => {
        introPlayed = true;
        setIntro('done');
    };
    useEffect(() => {
        if (intro !== 'play') return;
        const skip = () => settle();
        const id = window.setTimeout(() => {
            window.addEventListener('pointerdown', skip, { once: true });
            window.addEventListener('keydown', skip, { once: true });
        }, 300);
        return () => {
            window.clearTimeout(id);
            window.removeEventListener('pointerdown', skip);
            window.removeEventListener('keydown', skip);
        };
    }, [intro]);
    const ready = intro === 'done';

    const back = () => {
        setError(null);
        setScreen('title');
    };
    // What the list offers on each screen.
    const items: Item[] =
        screen === 'online'
            ? [
                { label: 'Quick Play', hint: 'Join the public room', act: () => enter({ kind: 'public' }), off: busy },
                { label: 'Create a Room', hint: 'Get a code to share with friends', act: () => enter({ kind: 'create' }), off: busy },
                { label: 'Join a Room', hint: "Type a friend's room code", act: () => { setError(null); setScreen('join'); }, off: busy },
                { label: 'Back', act: back },
            ]
            : screen === 'join'
                ? [
                    { label: 'Join', act: () => enter({ kind: 'join', code }), off: busy || code.length < 6 },
                    { label: 'Back', act: () => { setError(null); setScreen('online'); } },
                ]
                : screen === 'scores'
                    ? [{ label: 'Back', act: back }]
                    : [
                        ...(hasSave ? [{ label: 'Continue', hint: kingdom ? `${KINGDOMS[kingdom].name} · ${playedLabel(progress.saved?.playSeconds ?? 0, progress.saved?.kills ?? 0)}` : undefined, act: () => { net.leave(); start(); } }] : []),
                        { label: hasSave ? (confirmNew ? 'Erase and begin anew?' : 'New Game') : 'Begin', hint: confirmNew ? 'Select again to erase your progress' : 'The story from the start', act: newGame, warn: confirmNew },
                        { label: 'Co-op', hint: 'Fight the waves beside friends', act: () => { setError(null); setScreen('online'); } },
                        { label: 'Kingdoms', hint: 'The four lands of Eidolon', act: () => setScreen('kingdoms') },
                        { label: 'Legends', hint: 'The best runs', act: () => setScreen('scores') },
                        { label: 'Settings', act: () => setScreen('settings') },
                    ];
    const [sel, setSel] = useState(0);
    useEffect(() => setSel(0), [screen]);
    const cur = Math.min(sel, items.length - 1);
    // Keys: up and down choose, Enter selects, Escape steps back.
    useEffect(() => {
        if (!ready || screen === 'kingdoms' || screen === 'settings') return;
        const on = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement && e.key !== 'Enter' && e.key !== 'Escape') return;
            if (e.key === 'ArrowDown' || e.key === 's') setSel((n) => (Math.min(n, items.length - 1) + 1) % items.length);
            else if (e.key === 'ArrowUp' || e.key === 'w') setSel((n) => (Math.min(n, items.length - 1) + items.length - 1) % items.length);
            else if (e.key === 'Enter') {
                const it = items[cur];
                if (it && !it.off) it.act();
            } else if (e.key === 'Escape' && screen !== 'title') back();
            else return;
            e.preventDefault();
        };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    });

    const heading = screen === 'online' ? (busy ? 'Connecting...' : error ?? 'Co-op') : screen === 'join' ? (busy ? 'Connecting...' : error ?? 'Room code') : screen === 'scores' ? 'Legends of Eidolon' : null;
    return (
        <div className="relative h-full w-full overflow-hidden" style={{ background: '#030806' }}>
            <PixelForest look={look} />
            {/* shade where the words sit, so they read over the forest */}
            <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(2,6,4,.55) 0%, rgba(2,6,4,0) 38%, rgba(2,6,4,0) 58%, rgba(2,6,4,.6) 100%)', opacity: ready ? 1 : 0, transition: 'opacity 1.2s' }} />
            {/* darkness before the title is forged */}
            <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: intro === 'done' ? 0 : intro === 'wait' ? 1 : 0.55, transition: 'opacity 1.6s' }} />

            {/* the title: forged at the centre, then settles to the left */}
            {intro !== 'wait' && (
                <div className="pointer-events-none absolute" style={{ ...(ready ? { left: '5vw', top: '56%', width: 'min(46vw, 760px, 120vh)', transform: 'translate(0, -50%)' } : { left: '50%', top: '46%', width: 'min(78vw, 1100px, 170vh)', transform: 'translate(-50%, -50%)' }), transition: 'all 1.1s cubic-bezier(.65,0,.25,1)' }}>
                    <PixelLogo intro={intro === 'play'} onImpact={() => sfx('thunderclap', 0.55)} onDone={settle} />
                    <p className="-mt-[2.5vh] text-center text-[min(15px,2.6vh)] tracking-[0.42em] text-[#f3e3c0]" style={{ textShadow: '0 2px 0 #000', opacity: ready ? 0.9 : 0, transition: 'opacity .8s .6s' }}>
                        THE FRACTURE OF EIDOLON
                    </p>
                </div>
            )}
            {intro === 'wait' && blocked && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[min(22px,4vh)] tracking-[0.3em] text-[#f3e3c0]" style={{ animation: 'blink 1.1s steps(2) infinite' }}>PRESS ANY KEY</span>
                </div>
            )}
            {intro === 'play' && <span className="absolute bottom-[4vh] left-1/2 -translate-x-1/2 text-[12px] tracking-[0.3em] text-white/40">PRESS ANY KEY TO SKIP</span>}

            {ready && (
                <>
                    {/* sound, top right */}
                    <div className="absolute right-[2.5vw] top-[3vh] z-10" style={{ animation: 'menu-in .6s ease-out .3s both' }}>
                        <SoundToggle />
                    </div>
                    {inRoom && (
                        <p className="absolute left-[5vw] top-[4vh] flex items-center gap-2 text-[13px] text-emerald-200" style={{ textShadow: '0 2px 0 #000' }}>
                            Online · {online} {online === 1 ? 'player' : 'players'}{roomCode ? ` · room ${roomCode}` : ''}
                            <button type="button" onClick={() => net.leave()} className="underline decoration-dotted">leave</button>
                        </p>
                    )}

                    {/* the list, right */}
                    <nav className="absolute right-[6vw] top-1/2 flex w-[min(460px,40vw)] -translate-y-[38%] flex-col items-end" aria-label="Main menu">
                        {heading && <p className="mb-2 text-[min(14px,2.6vh)] tracking-[0.25em]" style={{ color: error ? '#ff9a8a' : '#d8c89a', textShadow: '0 2px 0 #000' }}>{heading.toUpperCase()}</p>}
                        {screen === 'join' && (
                            <input
                                autoFocus
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                                placeholder="ABC123"
                                maxLength={6}
                                autoComplete="off"
                                spellCheck={false}
                                aria-label="Room code"
                                className="mb-2 w-[min(280px,36vw)] px-3 py-2 text-right text-[min(26px,4.6vh)] tracking-[0.3em] text-[#fff3d6] outline-none placeholder:text-white/25"
                                style={{ ...slice('btn2-pressed', 3), color: '#2f2a35' }}
                            />
                        )}
                        {screen === 'scores' && (
                            <div className="mb-2 max-h-[46vh] w-full overflow-y-auto p-2" style={{ ...slice('frame5', 3), color: '#2f2a35' }}>
                                <TopScores />
                            </div>
                        )}
                        {items.map((it, n) => (
                            <MenuRow key={`${screen}-${it.label}`} item={it} on={n === cur} delay={n * 0.07} onHover={() => setSel(n)} />
                        ))}
                        <div className="mt-3 h-[2px] w-full" style={{ background: 'linear-gradient(270deg, rgba(243,227,192,.85), rgba(243,227,192,0))', animation: 'menu-in .6s ease-out .4s both' }} />
                        <div className="mt-2 flex min-h-[18px] items-center gap-3 text-[min(13px,2.4vh)] text-white/80" style={{ textShadow: '0 2px 0 #000', animation: 'menu-in .6s ease-out .5s both' }}>
                            <span className="mr-auto text-white/60">{items[cur]?.hint ?? ''}</span>
                            {screen !== 'title' && <span className="flex items-center gap-1.5"><Key>Esc</Key> Back</span>}
                            <span className="flex items-center gap-1.5"><Key>Enter</Key> Select</span>
                        </div>
                    </nav>
                    <p className="absolute bottom-[3vh] right-[6vw] text-[11px] tracking-[0.2em] text-white/35">MEH FIGHTER · EARLY ACCESS</p>
                </>
            )}

            {screen === 'kingdoms' && <KingdomOrbit mode="view" onClose={back} />}
            {screen === 'settings' && (
                <div className="absolute inset-0 z-20 flex items-center justify-center p-4" style={{ background: 'rgba(2,6,4,.72)' }} onPointerDown={(e) => e.target === e.currentTarget && back()}>
                    <SettingsPanel onBack={back} />
                </div>
            )}
        </div>
    );
}

/** One choice: right-aligned words; chosen, a gold band behind them and the sword pointing at them. */
function MenuRow({ item, on, delay, onHover }: { item: Item; on: boolean; delay: number; onHover: () => void }) {
    return (
        <button
            type="button"
            disabled={item.off}
            onPointerEnter={onHover}
            onFocus={onHover}
            onClick={item.act}
            className="relative flex w-full items-center justify-end py-[0.4vh] pr-3 disabled:opacity-40"
            style={{ animation: `menu-in .5s ease-out ${0.15 + delay}s both` }}
        >
            <span className="pointer-events-none absolute inset-y-0 right-0 transition-[width,opacity] duration-200" style={{ width: on ? '100%' : '0%', opacity: on ? 1 : 0, background: 'linear-gradient(270deg, rgba(196,148,52,.75) 0%, rgba(196,148,52,.35) 45%, rgba(196,148,52,0) 100%)' }} />
            {on && <img src="images/ui/cursor-sword.png" alt="" draggable={false} className="pointer-events-none absolute" style={{ right: 'calc(100% - 26px)', width: 32, height: 32, imageRendering: 'pixelated', transform: 'scaleX(-1) rotate(-45deg)', animation: 'sword-nudge 1s ease-in-out infinite' }} />}
            <span className="relative text-[min(26px,4.6vh)] leading-none" style={{ color: item.warn ? '#ffb4a0' : on ? '#ffffff' : '#e6dcc2', textShadow: '0 2px 0 #000, 0 0 2px #000' }}>
                {item.label}
            </span>
        </button>
    );
}

/** A keyboard key, as a little white pack button. */
function Key({ children }: { children: ReactNode }) {
    return <span className="inline-flex items-center px-1 text-[11px] leading-none" style={{ ...slice('btn1-normal', 1.5), color: '#33284f', textShadow: 'none', minWidth: 22, justifyContent: 'center' }}>{children}</span>;
}

/** Sound on and off, as a stone pack button. */
function SoundToggle() {
    const s = useSettings();
    const muted = !s.sound && !s.music;
    return (
        <StoneButton label={muted ? 'Sound off' : 'Sound on'} onPress={() => settings.set({ sound: muted, music: muted })}>
            <PixelIcon name={muted ? 'mute' : 'sound'} />
        </StoneButton>
    );
}
