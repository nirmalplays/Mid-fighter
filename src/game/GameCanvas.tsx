/**
 * React ↔ Pixi boundary. React owns WHEN the game exists (mount/unmount with
 * the 'playing' and 'base' phases); Pixi owns everything inside the canvas. No React
 * state flows in per-frame — game → UI communication goes through the store.
 *
 * StrictMode-safe: dev double-mount is handled by the `disposed` flag (the
 * first mount's async init resolves, sees it was cancelled, and destroys its
 * app before the second mount's app appears).
 */
import { useEffect, useRef } from 'react';
import type { Application } from 'pixi.js';
import { createPixiApp } from './pixiApp.ts';
import { createStage, type Stage } from './stage.ts';
import type { Scene } from './scene.ts';
import { createBaseScene } from './world/baseScene.ts';
import { createWorldScene } from './world/worldScene.ts';
import { store, useStore } from '../state/store.ts';

/** Which scene to run: the open world, or the base the home portal leads to. */
export default function GameCanvas({ mode }: { mode: 'world' | 'base' }) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const appRef = useRef<Application | null>(null);
    const paused = useStore((s) => s.paused);

    useEffect(() => {
        let disposed = false;
        let scene: Scene | null = null;
        let stage: Stage | null = null;
        (async () => {
            // hostRef is always attached by the time the effect runs.
            const app = await createPixiApp(hostRef.current!);
            if (disposed) {
                app.destroy({ removeView: true }, { children: true });
                return;
            }
            appRef.current = app;
            // Design-resolution stage: scenes position in design units, not
            // pixels, so layout is proportional on every device (stage.ts).
            stage = createStage(app);
            scene = mode === 'base' ? createBaseScene(app, stage) : createWorldScene(app, stage);
            // Respect a pause that landed while the canvas was initializing.
            if (store.get().paused) app.ticker.stop();
        })();
        return () => {
            disposed = true;
            try { scene?.destroy(); } catch { /* scene already torn down */ }
            try { stage?.destroy(); } catch { /* stage already torn down */ }
            if (appRef.current) {
                appRef.current.destroy({ removeView: true }, { children: true });
                appRef.current = null;
            }
        };
    }, [mode]);

    // Host lifecycle pause/resume → freeze/unfreeze the whole ticker.
    useEffect(() => {
        const app = appRef.current;
        if (!app) return;
        if (paused) app.ticker.stop();
        else app.ticker.start();
    }, [paused]);

    return <div ref={hostRef} className={`absolute inset-0 ${mode === 'base' ? 'bg-[#1b1220]' : 'bg-[#2b4aa0]'}`} />;
}
