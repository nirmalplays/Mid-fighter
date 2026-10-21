/**
 * The leaderboard table and the Game Over screen (shown when the player dies).
 */
import { useEffect, useState } from 'react';
import { myRank, topScores, type ScoreRow } from '../game/leaderboard.ts';
import { store, useStore } from '../state/store.ts';
import { ICON, PxButton, PxPanel } from './px.tsx';

const INK = '#3b2a22';

export function ScoreTable({ rows, loading }: { rows: ScoreRow[]; loading: boolean }) {
    if (loading) return <p className="py-3 text-center text-sm font-black" style={{ color: INK }}>Loading…</p>;
    if (rows.length === 0) return <p className="py-3 text-center text-sm font-black" style={{ color: INK }}>No scores yet. Be the first!</p>;
    return (
        <div className="flex flex-col gap-0.5">
            {rows.map((r) => (
                <div
                    key={`${r.rank}-${r.name}`}
                    className="flex items-center gap-2 rounded-md px-2 text-[13px] font-black tabular-nums"
                    style={{ color: INK, height: 22, background: r.me ? 'rgba(255,203,77,.75)' : 'rgba(255,255,255,.35)' }}
                >
                    <span className="w-6 text-right">{r.rank}</span>
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="w-14 text-right text-[11px] opacity-70">Wave {r.wave}</span>
                    <span className="w-14 text-right">{r.score}</span>
                </div>
            ))}
        </div>
    );
}

/** The top 10, fetched when shown. */
export function TopScores() {
    const [rows, setRows] = useState<ScoreRow[] | null>(null);
    useEffect(() => {
        let live = true;
        void topScores(10).then((r) => live && setRows(r));
        return () => { live = false; };
    }, []);
    return <ScoreTable rows={rows ?? []} loading={rows === null} />;
}

/** Shown over the world when the player has died: how the run went, rank, top 10, Play again. */
export function GameOver() {
    const info = useStore((s) => s.gameOver);
    if (!info) return null;
    const mins = Math.floor(info.seconds / 60);
    const secs = String(Math.floor(info.seconds % 60)).padStart(2, '0');
    return (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center" style={{ background: 'rgba(10,6,16,.7)' }}>
            <PxPanel frame={6} className="flex max-h-[96%] w-[min(520px,92vw)] flex-col gap-1.5 px-4 py-3">
                <h2 className="text-center text-3xl font-black leading-none" style={{ color: '#fff3d6', textShadow: '0 3px 0 #3b2412' }}>Game Over</h2>
                <div className="flex items-end justify-center gap-5 font-black tabular-nums" style={{ color: INK }}>
                    <div className="text-center leading-none"><div className="text-3xl">{info.score}</div><div className="text-[11px] opacity-70">SCORE</div></div>
                    <div className="text-center leading-none"><div className="text-xl">{info.wave}</div><div className="text-[11px] opacity-70">WAVE</div></div>
                    <div className="text-center leading-none"><div className="text-xl">{info.kills}</div><div className="text-[11px] opacity-70">DEFEATED</div></div>
                    <div className="text-center leading-none"><div className="text-xl">{mins}:{secs}</div><div className="text-[11px] opacity-70">TIME</div></div>
                </div>
                <p className="text-center text-[12px] font-black" style={{ color: INK }}>
                    {info.status === 'sending' ? 'Posting your score…' : info.rank ? `You are rank #${info.rank}` : info.note ?? 'Score not posted'}
                </p>
                <div className="min-h-0 overflow-y-auto">
                    <ScoreTable rows={info.top} loading={info.status === 'sending'} />
                </div>
                <div className="flex gap-2">
                    <PxButton className="flex-1" style={{ minHeight: 46 }} icon={ICON.play} onClick={() => store.patch({ gameOver: null, runId: store.get().runId + 1 })}>
                        Play again
                    </PxButton>
                    <PxButton className="flex-1" style={{ minHeight: 46 }} variant="white" icon={ICON.back} onClick={() => store.patch({ gameOver: null, phase: 'menu' })}>
                        Menu
                    </PxButton>
                </div>
            </PxPanel>
        </div>
    );
}
