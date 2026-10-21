/**
 * Asset manifest — the single place that lists what gets loaded and when.
 * Files live in public/ (URLs are relative to the page, so 'images/x.png'
 * means public/images/x.png; works in dev and in the deployed subdirectory).
 *
 * Two tiers (pattern from a shipped RUN game):
 *   - 'critical'  — awaited during the loading screen. Everything the first
 *                   interactive screen needs: menu art, UI chrome, the sprites
 *                   visible in the first seconds of play.
 *   - 'deferred'  — fire-and-forget background load after boot. Sub-screen
 *                   art, late-game content, anything the player can't see yet.
 *
 * Keep 'critical' small: every asset here delays first interaction.
 */
import type { AssetsManifest, UnresolvedAsset } from 'pixi.js';

/**
 * A narrowing of Pixi's AssetsManifest: Pixi also allows `assets` to be a
 * record, but this template keeps it an array so the tier filters below can
 * check `assets.length`. Still assignable to AssetsManifest (Assets.init).
 */
export interface Manifest extends AssetsManifest {
    bundles: { name: string; assets: UnresolvedAsset[] }[];
}

export const MANIFEST: Manifest = {
    bundles: [
        {
            name: 'critical',
            assets: [
                { alias: 'iso', src: 'images/world/iso.png' },
                { alias: 'swords', src: 'images/swords.png' },
                { alias: 'slashes', src: 'images/slashes.png' },
                { alias: 'frog', src: 'images/world/frog.png' },
                { alias: 'fx_fireball', src: 'images/fx/fireball.png' },
                { alias: 'fx_explosion', src: 'images/fx/explosion.png' },
                { alias: 'fx_frost', src: 'images/fx/frost.png' },
                { alias: 'fx_sparkle', src: 'images/fx/sparkle.png' },
                { alias: 'fx_bolt', src: 'images/fx/bolt.png' },
                { alias: 'fx_boltburst', src: 'images/fx/boltburst.png' },
                { alias: 'fx_heal', src: 'images/fx/heal.png' },
                { alias: 'potion_red', src: 'images/potions/red.png' },
                { alias: 'potion_blue', src: 'images/potions/blue.png' },
                { alias: 'potion_yellow', src: 'images/potions/yellow.png' },
                { alias: 'potion_purple', src: 'images/potions/purple.png' },
                { alias: 'potion_black', src: 'images/potions/black.png' },
                { alias: 'portal', src: 'images/world/portal.png' },
                { alias: 'drops', src: 'images/world/drops.png' },
                { alias: 'base-floor', src: 'images/base/floor.png' },
                { alias: 'workshop-items', src: 'images/base/items.png' },
                // Bare-handed movement sheets, so the character is there from the first frame
                // (everything else loads on demand in world/character.ts).
                { alias: 'char:idle', src: 'images/world/char/idle.png' },
                { alias: 'char:walk', src: 'images/world/char/walk.png' },
                { alias: 'char:run', src: 'images/world/char/run.png' },
            ],
        },
        {
            name: 'deferred',
            assets: [
                // ADAPT: sub-screen backgrounds, per-level art, shop icons...
            ],
        },
    ],
};

// Empty bundles are skipped so an unused tier never errors.
export const CRITICAL_BUNDLES: string[] = MANIFEST.bundles
    .filter((b) => b.name !== 'deferred' && b.assets.length > 0)
    .map((b) => b.name);

export const DEFERRED_BUNDLES: string[] = MANIFEST.bundles
    .filter((b) => b.name === 'deferred' && b.assets.length > 0)
    .map((b) => b.name);
