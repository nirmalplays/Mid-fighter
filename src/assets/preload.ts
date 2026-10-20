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
 * The menu and HUD draw these with CSS (border-image, icons, item pictures), which fetches them
 * separately from Pixi's loader, so on a slow connection the menu could appear with blank buttons.
 * Load them in the page itself and wait until they are decoded, so CSS finds them ready.
 */
const PAGE_IMAGES = [
    ...['btn1-normal', 'btn1-pressed', 'btn2-normal', 'btn2-pressed', 'btn3-normal', 'btn3-pressed', 'frame5', 'frame6', 'bar1', 'bar2', 'icons'].map((n) => `images/ui/${n}.png`),
    'images/logo.png',
    ...['sword', 'axe', 'pickaxe', 'hammer', 'shovel', 'fishingpole', 'watercan', 'shield', 'chest', 'log', 'gem-attack', 'gem-defence', 'gem-speed', 'gem-vitality'].map((n) => `images/hud/${n}.png`),
];
const keep: HTMLImageElement[] = []; // held so the browser keeps them in its image cache

async function warmPageImages(): Promise<void> {
    await Promise.all(PAGE_IMAGES.map(async (src) => {
        const img = new Image();
        img.src = src;
        keep.push(img);
        try { await img.decode(); } catch { /* a missing picture must not block boot */ }
    }));
}

/**
 * @param onProgress 0..1, called as the critical bundle loads; always ends
 *   with a final call at 1.
 */
export async function warmAssets(onProgress: (progress: number) => void = () => {}): Promise<void> {
    try {
        await Assets.init({ manifest: MANIFEST });
        const pictures = warmPageImages();
        if (CRITICAL_BUNDLES.length > 0) {
            await Assets.loadBundle(CRITICAL_BUNDLES, onProgress);
        }
        await pictures;
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
