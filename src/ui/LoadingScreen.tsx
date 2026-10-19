/**
 * Loading screen shown while warmAssets() runs. Rendered by React, revealed
 * when the boot cover lifts, driven by store.loadProgress.
 */
import { useStore } from '../state/store.ts';

export default function LoadingScreen() {
    const progress = useStore((s) => s.loadProgress);
    const pct = Math.round(progress * 100);
    return (
        <div className="flex h-full flex-col items-center justify-center gap-6 px-10">
            {/* ADAPT: game title / logo image */}
            <h1 className="text-3xl font-bold tracking-wide text-primary">Bounce Lab</h1>
            <div
                className="h-3 w-full max-w-xs overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <p className="text-sm text-white/50">Loading… {pct}%</p>
        </div>
    );
}
