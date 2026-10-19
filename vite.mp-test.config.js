// Test-only dev config: the multiplayer plugin's local room server (with short wave timers from
// rundot/realtime.test.json), no Playground sign-in.
// Run with: npx vite --config vite.mp-test.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { rundotGameLibrariesPlugin, rundotMultiplayerPlugin } from '@series-inc/rundot-game-sdk/vite';

export default defineConfig({
    base: './',
    plugins: [react(), tailwindcss(), rundotGameLibrariesPlugin(), rundotMultiplayerPlugin({ configPath: 'rundot/realtime.test.json' })],
    server: { port: 5184, host: '127.0.0.1', allowedHosts: true },
    build: { target: 'esnext' },
    optimizeDeps: { esbuildOptions: { target: 'esnext' }, exclude: ['@series-inc/rundot-game-sdk'] },
});
