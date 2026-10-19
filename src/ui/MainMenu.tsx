/**
 * Main menu: Play resumes this player's save (their scene, position, tool, health and
 * play time — saves are per RUN account, so a friend has their own), Workshop jumps
 * to the workshop, and New game wipes the save after a second tap.
 */
import { useState } from 'react';
import { progress } from '../game/progress.ts';
import { store } from '../state/store.ts';

export default function MainMenu() {
    const [confirmReset, setConfirmReset] = useState(false);
    const played = (progress.saved?.playSeconds ?? 0) > 5;

    return (
        <div className="flex h-full flex-col items-center justify-center gap-5 px-10">
            <h1 className="text-4xl font-bold tracking-wide text-primary">Bounce Lab</h1>
            <button
                type="button"
                className="rounded-2xl bg-primary px-12 py-4 text-xl font-bold text-black shadow-lg transition-transform active:scale-95"
                onClick={() => store.patch({ phase: progress.saved?.scene === 'base' ? 'base' : 'playing' })}
            >
                {played ? 'Continue' : 'Play'}
            </button>
            <button
                type="button"
                className="rounded-2xl border-2 border-primary px-10 py-3 text-lg font-bold text-primary transition-transform active:scale-95"
                onClick={() => store.patch({ phase: 'base' })}
            >
                Workshop
            </button>
            {played && (
                <button
                    type="button"
                    className={`rounded-xl px-6 py-1.5 text-sm font-bold transition-transform active:scale-95 ${confirmReset ? 'bg-red-600 text-white' : 'text-white/55'}`}
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
                    {confirmReset ? 'Tap again to erase your progress' : 'New game'}
                </button>
            )}
        </div>
    );
}
