import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App.tsx';
import { store } from './state/store.ts';
import { initSdk, registerLifecycles } from './sdk/runSdk.ts';
import { warmAssets } from './assets/preload.ts';
import { progress } from './game/progress.ts';
import { hostPause } from './game/audio.ts';
import { saveSystem } from './saveConfig.ts';
import { onSlotLoaded, slots } from './game/slots.ts';
import { preloadPieces, setLook } from './game/world/heroLook.ts';
import './styles/app.css';

/**
 * Boot sequence. The ORDER here matters — it's the pattern from a shipped RUN
 * game. Keep the numbered steps in this order; add your own work at the
 * marked points.
 */
async function boot() {
    // 1. The static SDK /api import has completed its initialization attempt.
    //    Check public context and the profile getter because the SDK may catch init errors.
    //    Keep boot alive when the host is unavailable.
    await initSdk();

    // 2. Load this player's save before first render (never throws), and flush it
    //    whenever the app is backgrounded.
    //    Every journey is its own save slot (game/slots.ts): open the last one played.
    await slots.init();
    await saveSystem.load();
    saveSystem.attachLifecycleFlush();
    const apply = () => {
        const save = saveSystem.data!;
        store.patch({
            playSeconds: Math.floor(save.playSeconds),
            kills: save.kills,
            swordsOwned: save.swords,
            swordIdx: save.sword,
            skills: { ...save.skills },
            gems: { ...save.gems },
            spells: { unlocked: [...save.spells.unlocked], carry: [...save.spells.carry], cooldown: [...save.spells.cooldown] },
            storyQueue: [], storyPopup: null, tracked: null,
        });
        setLook(save.hero.look);
        progress.syncSurvival();
    };
    onSlotLoaded(apply);
    apply();
    // The hero's hair and accessory pieces (the dressing needs them before the world draws the hero).
    await preloadPieces();

    // 3. Mount React. `phase` starts at 'loading', so this paints the
    //    loading screen (progress bar at 0%).
    createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );

    // 4. Lift the boot cover once the loading screen has actually painted
    //    (double-rAF = after the next rendered frame). Asset warming continues
    //    behind it — the player watches the progress bar, not a black screen.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const cover = document.getElementById('boot-cover');
            if (!cover) return;
            cover.classList.add('hidden');
            setTimeout(() => cover.remove(), 400); // matches the CSS transition
        });
    });

    // 5. Warm all critical assets (see src/assets/manifest.ts). Deferred
    //    assets keep loading in the background after this resolves.
    await warmAssets((p) => store.patch({ loadProgress: p }));

    // 6. Loading done — hand over to the menu.
    store.patch({ phase: 'menu' });
    // Keep the journey list current: where the story stands and the play time (throttled), and at
    // once whenever play stops for the menu.
    window.setInterval(() => store.get().phase === 'playing' && slots.touch(), 20000);
    let lastPhase = store.get().phase;
    store.subscribe(() => {
        const ph = store.get().phase;
        if (ph === lastPhase) return;
        const was = lastPhase;
        lastPhase = ph;
        if (was === 'playing') {
            void saveSystem.flush();
            slots.touch(true);
        }
    });

    // 7. Host lifecycle hooks. Register AFTER boot so handlers never race
    //    half-initialized state.
    //    Rules (see docs/run-sdk-notes.md): persist on onSleep, never rely on
    //    onQuit firing, and never fire fresh SDK RPCs (e.g. scheduling
    //    notifications) from onSleep/onQuit — a hard close kills the runtime
    //    before they land.
    registerLifecycles({
        onPause: () => {
            store.patch({ paused: true });
            hostPause(true);
        },
        onResume: () => {
            store.patch({ paused: false });
            hostPause(false);
        },
        // The save system's own lifecycle flush (attachLifecycleFlush above) covers sleep and quit.
        onSleep: async () => {},
        onQuit: async () => {},
    });

    // 8. ADAPT: post-boot, fire-and-forget work goes here — server time
    //    refresh (shared/serverTime.ts), notification re-arming, analytics
    //    boot event, subscription status refresh. None of it should block or
    //    throw into this function.
}

if (document.readyState === 'complete') boot();
else window.addEventListener('load', boot);
