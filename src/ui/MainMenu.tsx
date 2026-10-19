/**
 * ADAPT: placeholder main menu — replace with the game's real menu (and wire
 * daily rewards / shop / stats entry points here if those systems are added).
 */
import { store } from '../state/store.ts';

export default function MainMenu() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-10 px-10">
            <h1 className="text-4xl font-bold tracking-wide text-primary">Bounce Lab</h1>
            <button
                type="button"
                className="rounded-2xl bg-primary px-12 py-4 text-xl font-bold text-black shadow-lg transition-transform active:scale-95"
                onClick={() => store.patch({ phase: 'playing' })}
            >
                Play
            </button>
        </div>
    );
}
