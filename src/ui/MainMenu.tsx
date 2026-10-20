/**
 * Main menu, built from the UI Asset Pack. Three screens:
 *   title  - Single Player (resumes this player's save: scene, position, tool, health, skills),
 *            Online, Workshop and New game; shows the current room with a Leave button
 *   online - pick a multiplayer room: Quick Play (the public room), Create Private Room (share
 *            its code with friends) or Join with Code
 *   join   - type a friend's room code
 * Saves are per RUN account, so a friend has their own progress in any room.
 */
import { useState } from 'react';
import { net } from '../game/net/multiplayer.ts';
import { progress } from '../game/progress.ts';
import { store, useStore } from '../state/store.ts';
import { ICON, PxButton, PxPanel } from './px.tsx';

type Screen = 'title' | 'online' | 'join';

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
    const [confirmReset, setConfirmReset] = useState(false);
    const netStatus = useStore((s) => s.netStatus);
    const roomCode = useStore((s) => s.roomCode);
    const online = useStore((s) => s.online);
    const played = (progress.saved?.playSeconds ?? 0) > 5;
    const inRoom = netStatus === 'online';

    /** Start playing from this player's save. */
    const start = () => store.patch({ phase: progress.saved?.scene === 'base' ? 'base' : 'playing' });

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

    const btnW = 'w-[min(300px,52vw)]';

    return (
        <div className="flex h-full items-center justify-center gap-[min(28px,4vw)] px-6">
            {/* Left: the logo */}
            <div className="flex w-[min(210px,30vw)] flex-col items-center gap-1">
                <img src="images/logo.png" alt="" style={{ height: 'min(120px, 26vh)' }} draggable={false} />
                <h1 className="text-center text-3xl font-black leading-none tracking-wide" style={{ color: '#ffcb4d', textShadow: '0 3px 0 #2a1840' }}>
                    MEH
                    <br />
                    FIGHTER
                </h1>
                {inRoom && (
                    <p className="mt-1 rounded-md bg-black/35 px-2 py-0.5 text-center text-[12px] font-bold text-emerald-300">
                        Online · {online} {online === 1 ? 'player' : 'players'}
                        {roomCode ? ` · ${roomCode}` : ''}
                    </p>
                )}
            </div>

            {/* Right: the menu panel */}
            <PxPanel frame={6} className="flex flex-col items-stretch gap-1.5 px-3 py-2" style={{ minWidth: 'min(330px, 56vw)' }}>
                {screen === 'title' && (
                    <>
                        <PxButton className={btnW} style={{ minHeight: 52 }} icon={ICON.play} sub={played ? `Continue · ${playedLabel(progress.saved?.playSeconds ?? 0, progress.saved?.kills ?? 0)}` : 'Play on your own'} onClick={() => { net.leave(); start(); }}>
                            Single Player
                        </PxButton>
                        <PxButton className={btnW} style={{ minHeight: 52 }} variant="stone" icon={ICON.share} sub={inRoom ? 'Pick another room' : 'Play with friends'} onClick={() => { setError(null); setScreen('online'); }}>
                            Online
                        </PxButton>
                        <div className="flex gap-2">
                            <PxButton className="flex-1" style={{ minHeight: 44 }} variant="white" icon={ICON.home} onClick={() => store.patch({ phase: 'base' })}>
                                Workshop
                            </PxButton>
                            {inRoom && (
                                <PxButton className="flex-1" style={{ minHeight: 44 }} variant="white" icon={ICON.back} onClick={() => net.leave()}>
                                    Leave room
                                </PxButton>
                            )}
                            {played && !inRoom && (
                                <PxButton
                                    className="flex-1"
                                    style={{ minHeight: 44 }}
                                    variant={confirmReset ? 'wood' : 'white'}
                                    icon={ICON.refresh}
                                    onClick={() => {
                                        if (!confirmReset) {
                                            setConfirmReset(true);
                                            window.setTimeout(() => setConfirmReset(false), 4000);
                                            return;
                                        }
                                        progress.reset();
                                        setConfirmReset(false);
                                    }}
                                >
                                    {confirmReset ? 'Erase?' : 'New game'}
                                </PxButton>
                            )}
                        </div>
                    </>
                )}

                {screen === 'online' && (
                    <>
                        <p className="px-1 text-center text-[14px] font-black leading-none" style={{ color: error ? '#ffb4a8' : '#fff3d6', textShadow: '0 2px 0 #3b2412' }}>
                            {busy ? 'Connecting…' : error ?? 'Play Online'}
                        </p>
                        <PxButton className={btnW} style={{ minHeight: 46 }} disabled={busy} icon={ICON.play} sub="Join the public room" onClick={() => enter({ kind: 'public' })}>
                            Quick Play
                        </PxButton>
                        <PxButton className={btnW} style={{ minHeight: 46 }} variant="stone" disabled={busy} icon={ICON.plus} sub="Get a code to share" onClick={() => enter({ kind: 'create' })}>
                            Create Private Room
                        </PxButton>
                        <PxButton className={btnW} style={{ minHeight: 46 }} variant="stone" disabled={busy} icon={ICON.help} sub="Enter a friend's code" onClick={() => { setError(null); setScreen('join'); }}>
                            Join with Code
                        </PxButton>
                        <PxButton className={btnW} style={{ minHeight: 36 }} variant="white" disabled={busy} icon={ICON.back} onClick={() => { setError(null); setScreen('title'); }}>
                            Back
                        </PxButton>
                    </>
                )}

                {screen === 'join' && (
                    <>
                        <p className="px-1 text-center text-[14px] font-black leading-none" style={{ color: error ? '#ffb4a8' : '#fff3d6', textShadow: '0 2px 0 #3b2412' }}>
                            {busy ? 'Connecting…' : error ?? 'Room code'}
                        </p>
                        <PxPanel frame={5} className="px-2 py-1">
                            <input
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                                placeholder="ABC123"
                                inputMode="text"
                                autoCapitalize="characters"
                                autoComplete="off"
                                spellCheck={false}
                                maxLength={6}
                                className="w-full bg-transparent text-center text-2xl font-black tracking-[0.35em] text-[#3b2a22] outline-none placeholder:text-[#3b2a22]/35"
                                style={{ touchAction: 'manipulation' }}
                                aria-label="Room code"
                            />
                        </PxPanel>
                        <PxButton className={btnW} style={{ minHeight: 46 }} disabled={busy || code.length < 6} icon={ICON.play} onClick={() => enter({ kind: 'join', code })}>
                            Join Room
                        </PxButton>
                        <PxButton className={btnW} style={{ minHeight: 36 }} variant="white" disabled={busy} icon={ICON.back} onClick={() => { setError(null); setScreen('online'); }}>
                            Back
                        </PxButton>
                    </>
                )}
            </PxPanel>
        </div>
    );
}

