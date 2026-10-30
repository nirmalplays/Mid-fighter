/**
 * Pixi v8 Application factory. One place owns renderer options so the rest of
 * the game never touches them.
 */
import { Application } from 'pixi.js';

/**
 * Create and mount a Pixi app inside a host element. The canvas auto-resizes
 * to the host (the device-frame div), so the game is sized by CSS — the same
 * `--game-w` column that sizes the DOM UI.
 *
 * @param host element the canvas fills (position: relative/absolute)
 */
export async function createPixiApp(host: HTMLElement): Promise<Application> {
    const app = new Application();
    // Phones and tablets: no multisampling (costly on a phone's GPU, and this is all sprites).
    const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    await app.init({
        resizeTo: host,
        // Cap DPR at 2: on 3x phones full DPR triples fill cost for
        // imperceptible sharpness gain. ADAPT: raise/lower per art style.
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        // Transparent canvas: DOM background layers (CSS) show through, and
        // React UI stacks above. ADAPT: set a backgroundColor instead if the
        // scene paints every pixel — cheaper than compositing transparency.
        backgroundAlpha: 0,
        antialias: !touch,
        // ADAPT: pixel-art games want roundPixels: true here, plus
        //     import { TextureStyle } from 'pixi.js';
        //     TextureStyle.defaultOptions.scaleMode = 'nearest';
        // at module scope, and integer design resolutions.
    });
    host.appendChild(app.canvas);
    keepSmooth(app);
    return app;
}

/**
 * A phone that cannot hold the frame rate renders fewer pixels: after 3 s under ~48 fps the resolution
 * steps down by half (2 -> 1.5 -> 1), never back up (no flicker between sharp and soft).
 */
function keepSmooth(app: Application): void {
    let acc = 0, frames = 0;
    app.ticker.add((t) => {
        // (a long frame is a pause or a hidden tab coming back, not the phone struggling: start over)
        if (t.deltaMS > 250) {
            acc = 0;
            frames = 0;
            return;
        }
        acc += t.deltaMS;
        frames++;
        if (acc < 3000) return;
        const fps = (frames * 1000) / acc;
        acc = 0;
        frames = 0;
        const res = app.renderer.resolution;
        if (fps < 48 && res > 1 && !document.hidden) {
            app.renderer.resolution = Math.max(1, res - 0.5);
            app.resize();
        }
    });
}
