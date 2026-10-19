import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {
    rundotGameLibrariesPlugin,
    rundotGamePlaygroundPlugin,
} from '@series-inc/rundot-game-sdk/vite';

export default defineConfig(({ mode }) => {
    const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
    const sandboxGameId = env.RUNDOT_SANDBOX_GAME_ID?.trim();
    const sandboxTarget = env.RUNDOT_SANDBOX_TARGET?.trim() || 'playground';

    return {
        // REQUIRED for RUN: deployed builds are served from a subdirectory, so
        // all asset URLs must be relative. Do not change this.
        base: './',
        plugins: [
            react(), // Must come first — handles JSX transform
            tailwindcss(),
            // CRITICAL PERFORMANCE NOTE:
            // rundotGameLibrariesPlugin externalizes libraries embedded by the RUN host:
            // - pixi.js @ 8.19.0 (~800 KB saved)
            // - react & react-dom @ 19.2.4 (~300 KB saved)
            // Externalization ONLY activates when package.json matches the host version EXACTLY.
            // DO NOT unpin or add carets (^) to pixi.js or react in package.json, or these
            // dependencies will be bundled into the game build and inflate its download size by >1.1 MB.
            rundotGameLibrariesPlugin({
                // storageCheck is enabled by default to catch blocked browser storage
                // (localStorage/indexedDB). Pass { storageCheck: false } to disable.
            }),
            rundotGamePlaygroundPlugin({
                target: sandboxTarget,
                // No gameId by default: an explicit one asserts the cached game
                // exists, blocking the SDK's auto-register-fresh-game fallback
                // when that id is stale or server-side deleted. Never wire the
                // playground key here — the plugin reads RUNDOT_PLAYGROUND_KEY
                // from .env.local dev-server-side.
                ...(sandboxGameId ? { gameId: sandboxGameId } : {}),
            }),
        ],
        server: {
            port: 5183,
            allowedHosts: true,
        },
        build: {
            // Top-level await in the boot path needs a modern target.
            target: 'esnext',
        },
        optimizeDeps: {
            esbuildOptions: {
                target: 'esnext',
            },
            exclude: ['@series-inc/rundot-game-sdk'],
        },
    };
});
