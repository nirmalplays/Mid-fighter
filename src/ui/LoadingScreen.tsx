/**
 * Loading screen shown while warmAssets() runs: the logo and title on a wooden panel from the
 * UI Asset Pack with its brown track / green fill progress bar. Rendered by React, revealed
 * when the boot cover lifts, driven by store.loadProgress.
 */
import { useStore } from '../state/store.ts';
import { PxPanel } from './px.tsx';
import { UI_SLICES } from './uiSlices.ts';

/** The bar pieces are drawn at 2x like the rest of the UI. */
const SCALE = 2;
const barStyle = (name: 'bar1' | 'bar2') => {
    const [l, t, r, b] = UI_SLICES[name];
    return {
        borderStyle: 'solid',
        borderWidth: `${t * SCALE}px ${r * SCALE}px ${b * SCALE}px ${l * SCALE}px`,
        borderImage: `url(images/ui/${name}.png) ${t} ${r} ${b} ${l} fill / ${t * SCALE}px ${r * SCALE}px ${b * SCALE}px ${l * SCALE}px stretch`,
        imageRendering: 'pixelated' as const,
    };
};

export default function LoadingScreen() {
    const progress = useStore((s) => s.loadProgress);
    const pct = Math.round(progress * 100);
    return (
        <div className="flex h-full items-center justify-center px-6">
            <PxPanel frame={6} className="flex flex-col items-center gap-2 px-6 py-4" style={{ width: 'min(380px, 86vw)' }}>
                <img src="images/logo.png" alt="" style={{ height: 'min(84px, 18vh)' }} draggable={false} />
                <h1 className="text-center text-2xl font-black leading-none tracking-wide" style={{ color: '#fff3d6', textShadow: '0 3px 0 #3b2412' }}>
                    MEH FIGHTER
                </h1>
                <div
                    className="w-full"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    style={{ ...barStyle('bar1'), height: 32, boxSizing: 'border-box' }}
                >
                    <div className="h-full overflow-hidden" style={{ margin: '-8px -8px -10px -8px', height: 'calc(100% + 18px)' }}>
                        <div
                            className="h-full transition-[width] duration-200 ease-out"
                            style={{ ...barStyle('bar2'), width: `${Math.max(pct, 8)}%`, boxSizing: 'border-box', height: '100%' }}
                        />
                    </div>
                </div>
                <p className="text-sm font-black" style={{ color: '#fff3d6', textShadow: '0 2px 0 #3b2412' }}>Loading… {pct}%</p>
            </PxPanel>
        </div>
    );
}
