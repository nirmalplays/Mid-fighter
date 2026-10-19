/**
 * Thin app-shell wrapper around the RUN SDK: readiness check + lifecycle
 * registration. System templates (save, shop, ads, ...) import the SDK
 * directly; this module owns boot-time checks and lifecycle hooks.
 *
 * The SDK starts initialization when its /api module loads. That module uses
 * top-level await, but it catches initialization failures. Check context, then
 * getProfile(), to confirm a valid cached profile. Keep boot alive when the host
 * is unavailable.
 *
 * Every RundotGameAPI call can reject, and an unhandled rejection crashes the
 * game. Catch errors at every SDK boundary.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
// Type-only import from the package root (the /api entry does not re-export it);
// erased at build time, so no extra runtime code is pulled in.
import type { Subscription } from '@series-inc/rundot-game-sdk';

let _ready = false;

/** True when context and the profile getter confirm a valid cached profile. */
export function sdkReady(): boolean {
    return _ready;
}

/**
 * Check whether automatic SDK initialization produced a valid cached profile.
 * Never throws: a failed check logs a warning and the game still boots.
 */
export async function initSdk(): Promise<boolean> {
    try {
        if (!RundotGameAPI.context) {
            throw new Error('RUN host initialization did not complete');
        }
        RundotGameAPI.getProfile();
        _ready = true;
    } catch (err) {
        console.warn('[runSdk] RUN host is unavailable; continuing without it', err);
    }
    return _ready;
}

/**
 * Lifecycle callbacks are `() => void` per the SDK types. Async handlers are
 * fine to pass: a Promise-returning function is assignable where a void
 * return is expected (the SDK does not await it).
 */
export type LifecycleCallback = () => void;

/** All six hooks are optional. See registerLifecycles for what each means. */
export interface LifecycleConfig {
    onPause?: LifecycleCallback;
    onResume?: LifecycleCallback;
    onSleep?: LifecycleCallback;
    onAwake?: LifecycleCallback;
    onQuit?: LifecycleCallback;
    onBackButton?: LifecycleCallback;
}

/**
 * Register host lifecycle callbacks. All six hooks are optional; each SDK
 * hook returns an { unsubscribe() } handle, collected so hot-reload / scene
 * swaps can detach cleanly.
 *
 * Hook meanings (SDK docs):
 *   onPause/onResume — host overlay or brief focus loss: pause/resume loops + audio
 *   onSleep/onAwake  — long background suspend: persist progress / refresh stale data
 *   onQuit           — host teardown: last-chance flush (may NOT fire on hard close)
 *   onBackButton     — Android back button (no-op elsewhere); without a handler the
 *                      host quits by default — call RundotGameAPI.requestPopOrQuit()
 *                      yourself when your in-game back navigation is exhausted
 */
export function registerLifecycles(
    { onPause, onResume, onSleep, onAwake, onQuit, onBackButton }: LifecycleConfig = {}
): { unsubscribeAll(): void } {
    const subs: Subscription[] = [];
    const hook = (name: keyof LifecycleConfig, cb: LifecycleCallback | undefined) => {
        if (!cb) return;
        try {
            subs.push(RundotGameAPI.lifecycles[name](cb));
        } catch (err) {
            console.warn(`[runSdk] lifecycles.${name} registration failed`, err);
        }
    };
    hook('onPause', onPause);
    hook('onResume', onResume);
    hook('onSleep', onSleep);
    hook('onAwake', onAwake);
    hook('onQuit', onQuit);
    hook('onBackButton', onBackButton);
    return {
        unsubscribeAll() {
            for (const s of subs) {
                try { s?.unsubscribe?.(); } catch { /* already gone */ }
            }
            subs.length = 0;
        },
    };
}
