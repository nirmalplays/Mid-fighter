/**
 * React ↔ Pixi boundary. React owns WHEN the game exists (mount/unmount with
 * the 'playing' phase); Pixi owns everything inside the canvas. No React
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
import { createWorldScene } from './world/worldScene.ts';
import { store, useStore } from '../state/store.ts';

/** The open world (a fresh one each run: App remounts this with a new key). */
export default function GameCanvas() {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const appRef = useRef<Application | null>(null);
    // The host's pause, or the pause screen in solo play (co-op's shared world never stops).
    const paused = useStore((s) => s.paused || (s.pauseMenu && s.netStatus !== 'online'));

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
            scene = createWorldScene(app, stage);
            // Respect a pause that landed while the canvas was initializing.
            if (store.get().paused || store.get().pauseMenu) app.ticker.stop();
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
    }, []);

    // Host lifecycle pause/resume → freeze/unfreeze the whole ticker.
    useEffect(() => {
        const app = appRef.current;
        if (!app) return;
        if (paused) app.ticker.stop();
        else app.ticker.start();
    }, [paused]);

    return <div ref={hostRef} className="absolute inset-0 bg-[#2b4aa0]" />;
}
