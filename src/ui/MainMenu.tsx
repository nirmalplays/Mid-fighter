/**
 * The home screen: a painted dusk landscape (ui/Landscape.tsx) with a top bar (Co-op, Kingdoms,
 * Leaderboard, Settings, your kingdom), a big serif title and a Start button. Other screens:
 *   title    - New Game (the intro cutscene, then choosing a kingdom), Continue (only with a save), Play with friends
 *   online   - Quick Play (the public room), Create Private Room (share its code), Join with Code
 *   join     - type a friend's room code
 *   kingdoms - the celestial map: each kingdom's lore, passive and active skill (pledge here if you have none)
 *   settings - effects, night darkness, hints, radar, and starting a new game
 * Saves are per RUN account, so a friend has their own progress in any room.
 */
import { useState } from 'react';
import { net } from '../game/net/multiplayer.ts';
import { progress } from '../game/progress.ts';
import { KINGDOMS } from '../game/eidolon.ts';
import { store, useStore } from '../state/store.ts';
import { TopScores } from './Scores.tsx';
import { sfx, useMusicBlocked } from '../game/audio.ts';
import { KingdomMap, SettingsPanel, StoneSlab } from './Celestial.tsx';
import { LandscapeBackdrop } from './Landscape.tsx';
import { SoundButton } from './SoundButton.tsx';

/** The title face: a heavy serif, like a painted travel poster. */
const SERIF = "Georgia, 'Times New Roman', serif";
/** The links in the top bar. */
const NAV: [string, Screen][] = [['Co-op', 'online'], ['Kingdoms', 'kingdoms'], ['Leaderboard', 'scores'], ['Settings', 'settings']];

type Screen = 'title' | 'online' | 'join' | 'scores' | 'kingdoms' | 'settings';

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

    const heading = (text: string, bad = false) => (
        <p className="text-center text-[15px] font-black tracking-wide" style={{ color: bad ? '#fca5a5' : '#e9ddff', textShadow: '0 2px 0 #120d18' }}>{text}</p>
    );

    return (
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
            <LandscapeBackdrop />

            {/* The navigation bar along the top (on every menu screen). */}
            <nav className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-[min(40px,5vw)] pt-safe-top" style={{ height: 56 }}>
                <button type="button" onClick={() => setScreen('title')} className="text-[17px] font-black tracking-wide text-white" style={{ fontFamily: SERIF, textShadow: '0 2px 8px rgba(0,0,0,.4)' }}>
                    Meh Fighter
                </button>
                <div className="flex items-center gap-[min(34px,3.5vw)] text-[13px] font-semibold text-white/90">
                    <SoundButton />
                    {NAV.map(([label, to]) => (
                        <button key={to} type="button" onClick={() => { setError(null); setScreen(to); }} className="hidden transition-colors hover:text-[#ffd98a] sm:inline" style={{ color: screen === to ? '#ffd98a' : undefined }}>{label}</button>
                    ))}
                    <button type="button" onClick={() => setScreen('kingdoms')} className="rounded-sm px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-white hover:text-[#2a1f5c]" style={{ border: '1.5px solid rgba(255,255,255,.85)' }}>
                        {kingdom ? `${KINGDOMS[kingdom].glyph} ${KINGDOMS[kingdom].name}` : 'Choose kingdom'}
                    </button>
                </div>
            </nav>

            {screen === 'title' && (
                <div className="relative flex h-full w-full flex-col justify-center px-[min(64px,7vw)] pt-10" style={{ animation: 'eid-rise-in .7s ease-out both' }}>
                    <p className="flex items-center gap-2 text-[13px] font-medium text-white/85" style={{ textShadow: '0 1px 6px rgba(0,0,0,.35)' }}>
                        <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true"><rect x="0" y="6" width="4" height="10" rx="1" fill="#c9c3ff" /><rect x="6" y="2" width="4" height="14" rx="1" fill="#c9c3ff" /><rect x="12" y="0" width="4" height="16" rx="1" fill="#c9c3ff" /><rect x="18" y="5" width="4" height="11" rx="1" fill="#c9c3ff" /></svg>
                        Journey to the shattered kingdoms. Journey to the Void Citadel.
                    </p>
                    <h1 className="mt-[min(14px,2vh)] font-bold leading-[0.9] text-white" style={{ fontFamily: SERIF, fontSize: 'min(124px, 18vh, 10vw)', letterSpacing: '0.02em', whiteSpace: 'nowrap', textShadow: '0 6px 30px rgba(30,10,60,.45)' }}>
                        MEH FIGHTER
                    </h1>
                    <p className="mt-[min(16px,2.2vh)] max-w-[min(420px,48vw)] text-[min(13px,2.2vh)] font-medium leading-relaxed text-white/90" style={{ textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>
                        Far beyond the old roads of the sundered realm, four kingdoms smoulder behind Malakor&apos;s barriers. Pyraxis burns, Zephyria storms,
                        Aquatica sinks and Terragrim waits in stone. Pledge to one, survive the night, and bring them home.
                    </p>
                    <div className="mt-[min(22px,3vh)] flex flex-wrap items-center gap-3">
                        {hasSave && (
                            <button type="button" onClick={() => { net.leave(); start(); }} className="rounded-sm bg-white px-5 py-2.5 text-[14px] font-semibold text-[#2a1f5c] shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0">
                                Continue the journey
                            </button>
                        )}
                        <button type="button" onClick={newGame} className={`rounded-sm px-5 py-2.5 text-[14px] font-semibold shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 ${hasSave ? (confirmNew ? 'bg-[#e2563a] text-white' : 'text-white') : 'bg-white text-[#2a1f5c]'}`} style={hasSave && !confirmNew ? { border: '1.5px solid rgba(255,255,255,.8)' } : undefined}>
                            {hasSave ? (confirmNew ? 'Tap again: erase and start over' : 'New Game') : 'Start the journey'}
                        </button>
                        <button type="button" onClick={() => { setError(null); setScreen('online'); }} className="rounded-sm px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-white/15" style={{ border: '1.5px solid rgba(255,255,255,.8)' }}>
                            Play with friends
                        </button>
                        {(progress.saved?.playSeconds ?? 0) >= 60 && <span className="text-[12px] font-medium text-white/75">{playedLabel(progress.saved?.playSeconds ?? 0, progress.saved?.kills ?? 0)}</span>}
                    </div>
                    {inRoom && (
                        <p className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-emerald-200">
                            Online · {online} {online === 1 ? 'player' : 'players'}{roomCode ? ` · ${roomCode}` : ''}
                            <button type="button" onClick={() => net.leave()} className="underline decoration-dotted">leave</button>
                        </p>
                    )}
                </div>
            )}

            {screen === 'online' && (
                <div className="relative flex w-[min(340px,90vw)] flex-col gap-2 rounded-2xl p-4" style={{ background: 'rgba(20,12,30,.85)', border: '2px solid #7dd3fc' }}>
                    {heading(busy ? 'Connecting…' : error ?? 'Multiplayer Co-op', !!error)}
                    <StoneSlab accent="#86efac" disabled={busy} sub="Join the public room" onClick={() => enter({ kind: 'public' })}>Quick Play</StoneSlab>
                    <StoneSlab accent="#7dd3fc" disabled={busy} sub="Get a code to share" onClick={() => enter({ kind: 'create' })}>Create Private Room</StoneSlab>
                    <StoneSlab accent="#c4b5fd" disabled={busy} sub="Enter a friend's code" onClick={() => { setError(null); setScreen('join'); }}>Join with Code</StoneSlab>
                    <p className="text-[11px] font-bold text-[#b9aed0]">Fallen teammates can be helped up with Use before they bleed out. Chest loot lands on the ground for everyone.</p>
                    <StoneSlab size="sm" accent="#9ca3af" disabled={busy} onClick={() => { setError(null); setScreen('title'); }}>Back</StoneSlab>
                </div>
            )}

            {screen === 'join' && (
                <div className="relative flex w-[min(340px,90vw)] flex-col gap-2 rounded-2xl p-4" style={{ background: 'rgba(20,12,30,.85)', border: '2px solid #c4b5fd' }}>
                    {heading(busy ? 'Connecting…' : error ?? 'Room code', !!error)}
                    <input
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                        placeholder="ABC123"
                        inputMode="text"
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={6}
                        className="w-full rounded-md bg-[#0b0614] px-2 py-2 text-center text-2xl font-black tracking-[0.35em] text-[#efe8fa] outline-none placeholder:text-[#efe8fa]/30"
                        style={{ touchAction: 'manipulation', border: '2px solid #4b3b66' }}
                        aria-label="Room code"
                    />
                    <StoneSlab accent="#86efac" disabled={busy || code.length < 6} onClick={() => enter({ kind: 'join', code })}>Join Room</StoneSlab>
                    <StoneSlab size="sm" accent="#9ca3af" disabled={busy} onClick={() => { setError(null); setScreen('online'); }}>Back</StoneSlab>
                </div>
            )}

            {screen === 'scores' && (
                <div className="relative flex w-[min(340px,90vw)] flex-col gap-2 rounded-2xl p-4" style={{ background: 'rgba(20,12,30,.85)', border: '2px solid #fbbf24' }}>
                    {heading('Leaderboard')}
                    <TopScores />
                    <StoneSlab size="sm" accent="#9ca3af" onClick={() => setScreen('title')}>Back</StoneSlab>
                </div>
            )}

            {screen === 'kingdoms' && (
                <div className="relative flex max-h-full w-full justify-center overflow-y-auto px-4 py-3">
                    <KingdomMap onPledge={(e) => progress.chooseKingdom(e)} onBack={() => setScreen('title')} />
                </div>
            )}

            {screen === 'settings' && (
                <div className="relative">
                    <SettingsPanel onBack={() => setScreen('title')} />
                </div>
            )}

            <TapToBegin />
        </div>
    );
}

/**
 * Browsers that keep a page silent until it is touched: the home page asks for that first touch
 * (and takes it, so it does not also press a button), and the intro theme starts with it.
 * Where sound may start on its own (as on RUN), this never shows.
 */
function TapToBegin() {
    const blocked = useMusicBlocked();
    const [gone, setGone] = useState(false);
    if (!blocked || gone) return null;
    return (
        <div
            data-quiet
            className="absolute inset-0 z-50 flex cursor-pointer flex-col items-center justify-end pb-[12vh]"
            style={{ background: 'linear-gradient(180deg, rgba(10,6,24,0) 40%, rgba(10,6,24,.6) 100%)' }}
            onPointerDown={(e) => {
                e.stopPropagation();
                setGone(true);
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="text-[min(22px,4.6vh)] font-bold tracking-[0.2em] text-white" style={{ fontFamily: SERIF, textShadow: '0 2px 12px rgba(0,0,0,.6)', animation: 'eid-breathe 2.2s ease-in-out infinite' }}>
                TAP ANYWHERE TO BEGIN
            </div>
            <div className="mt-1 text-[12px] font-semibold tracking-wider text-white/70">🔊 Sound on for the full story</div>
        </div>
    );
}
