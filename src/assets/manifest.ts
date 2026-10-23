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
import { ITEM_IDS, ITEMS } from '../game/survival.ts';

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
                { alias: 'fx_hit', src: 'images/fx/hit.png' },
                { alias: 'fx_crit', src: 'images/fx/crit.png' },
                { alias: 'fx_death', src: 'images/fx/death.png' },
                { alias: 'fx_spawn', src: 'images/fx/spawn.png' },
                { alias: 'fx_splat', src: 'images/fx/splat.png' },
                { alias: 'fx_aura', src: 'images/fx/aura.png' },
                { alias: 'fx_levelup', src: 'images/fx/levelup.png' },
                { alias: 'fx_complete', src: 'images/fx/complete.png' },
                { alias: 'fx_alert', src: 'images/fx/alert.png' },
                { alias: 'fx_coins', src: 'images/fx/coins.png' },
                { alias: 'fx_pickup', src: 'images/fx/pickup.png' },
                { alias: 'fx_atkup', src: 'images/fx/atkup.png' },
                { alias: 'fx_defup', src: 'images/fx/defup.png' },
                { alias: 'fx_haste', src: 'images/fx/haste.png' },
                { alias: 'fx_poison', src: 'images/fx/poison.png' },
                { alias: 'fx_warp', src: 'images/fx/warp.png' },
                { alias: 'fx_campfire', src: 'images/fx/campfire.png' },
                { alias: 'potion_red', src: 'images/potions/red.png' },
                { alias: 'potion_blue', src: 'images/potions/blue.png' },
                { alias: 'potion_yellow', src: 'images/potions/yellow.png' },
                { alias: 'potion_purple', src: 'images/potions/purple.png' },
                { alias: 'potion_black', src: 'images/potions/black.png' },
                { alias: 'drops', src: 'images/world/drops.png' },
                // Survival: camp tents, Heartstone shrines (a 6-frame portal sheet) and chests.
                { alias: 'tent_cream', src: 'images/world/camp/tent_cream.png' },
                { alias: 'tent_red', src: 'images/world/camp/tent_red.png' },
                { alias: 'tent_blue', src: 'images/world/camp/tent_blue.png' },
                { alias: 'tent_green', src: 'images/world/camp/tent_green.png' },
                { alias: 'tent_yellow', src: 'images/world/camp/tent_yellow.png' },
                { alias: 'shrine', src: 'images/world/shrine.png' },
                { alias: 'chest', src: 'images/hud/chest.png' },
                // Walk-in houses, one look per kingdom (composited from the Isometric RPG Buildings layers):
                // the floor and back walls, and the front walls and roof that fade when you go in.
                ...['fire', 'air', 'water', 'earth'].flatMap((el) => [
                    { alias: `house_${el}_base`, src: `images/world/house_${el}_base.png` },
                    { alias: `house_${el}_shell`, src: `images/world/house_${el}_shell.png` },
                ]),
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
                // Item pictures, for loot lying on the ground.
                ...ITEM_IDS.map((id) => ({ alias: `item:${id}`, src: `images/${ITEMS[id].icon}` })),
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
