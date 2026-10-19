/**
 * Design-resolution stage (landscape, height-fit): scene code works in fixed
 * DESIGN UNITS and this module maps them to real pixels.
 *   - The stage root container is scaled by screenHeight / DESIGN_HEIGHT.
 *   - Vertical space is therefore always exactly DESIGN_HEIGHT units tall.
 *   - Horizontal space varies with the device: designWidth() reports how many
 *     units wide the screen currently is. Anchor layout to left / right /
 *     center via designWidth() — never hardcode a right edge.
 */
import { Container, type Application } from 'pixi.js';

/**
 * The game's design height, in units. This is a LANDSCAPE game, so height is
 * fixed and width varies with the device's aspect ratio.
 */
export const DESIGN_HEIGHT = 720;

/** What createStage returns — the surface scenes build against. */
export interface Stage {
    /** Add all scene content here (NOT app.stage), positioned in design units. */
    root: Container;
    /** Constant: the design-space height (= DESIGN_HEIGHT). */
    height: number;
    /** Current screen width in design units — re-read after resizes. */
    designWidth(): number;
    /** Current design-unit → pixel factor (rarely needed directly). */
    scale(): number;
    /** Subscribe to resizes (re-anchor bottom/center content). Returns unsubscribe. */
    onResize(cb: () => void): () => void;
    destroy(): void;
}

/**
 * Create the stage on a Pixi app. Add all scene content to `stage.root`
 * (NOT app.stage) and position/size it in design units.
 */
export function createStage(app: Application): Stage {
    const root = new Container();
    app.stage.addChild(root);

    const resizeCbs = new Set<() => void>();
    let _designWidth = 0;

    const layout = () => {
        const s = app.screen.height / DESIGN_HEIGHT;
        root.scale.set(s);
        _designWidth = app.screen.width / s;
        for (const cb of resizeCbs) cb();
    };

    // app.screen is in CSS pixels regardless of resolution/autoDensity, so
    // the design mapping is unaffected by devicePixelRatio.
    app.renderer.on('resize', layout);
    layout();

    return {
        root,
        height: DESIGN_HEIGHT,
        designWidth: () => _designWidth,
        scale: () => root.scale.x,
        onResize(cb) {
            resizeCbs.add(cb);
            return () => resizeCbs.delete(cb);
        },
        destroy() {
            app.renderer.off('resize', layout);
            resizeCbs.clear();
            root.destroy({ children: true });
        },
    };
}
