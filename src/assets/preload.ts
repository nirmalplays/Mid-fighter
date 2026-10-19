/**
 * Asset warming via Pixi Assets. Awaited during the loading screen (critical
 * bundle, with progress), then background-loads the deferred bundle.
 *
 * Failure posture: a missing asset must never brick boot. Errors are logged
 * and boot continues — Pixi falls back at use time (and the demo scene
 * generates a texture if the placeholder is absent).
 */
import { Assets } from 'pixi.js';
import { MANIFEST, CRITICAL_BUNDLES, DEFERRED_BUNDLES } from './manifest.ts';

/**
 * @param onProgress 0..1, called as the critical bundle loads; always ends
 *   with a final call at 1.
 */
export async function warmAssets(onProgress: (progress: number) => void = () => {}): Promise<void> {
    try {
        await Assets.init({ manifest: MANIFEST });
        if (CRITICAL_BUNDLES.length > 0) {
            await Assets.loadBundle(CRITICAL_BUNDLES, onProgress);
        }
        if (DEFERRED_BUNDLES.length > 0) {
            // Fire-and-forget: trickles in on idle, interrupts cleanly if a
            // later Assets.load() needs one of these sooner.
            Assets.backgroundLoadBundle(DEFERRED_BUNDLES);
        }
    } catch (err) {
        console.warn('[preload] asset warm failed — continuing without', err);
    }

    // Wait for @font-face fonts so the first painted screen doesn't swap
    // fonts mid-frame. (No custom fonts by default; harmless either way.)
    try { await document.fonts.ready; } catch { /* older engines */ }

    onProgress(1);
}
