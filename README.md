# Starter — new-game app shell (Pixi + React + Tailwind + RUN SDK)

A complete, runnable scaffold for a new RUN game: Vite + **TypeScript** + **Pixi.js v8** (game rendering) + **React 19** (menus/HUD) + **Tailwind CSS v4** (styling) + the **RUN SDK** with automatic import initialization and a host-readiness check, an asset-warming loading screen, host lifecycle handling, and the viewport/deploy setup a shipped RUN game uses. The scaffold is TypeScript end-to-end (`strict` mode): every module ships typed, and the build script type-checks before bundling.

Unlike the `systems/` templates (copied *into* an existing game), this folder **is** the new game: copy its contents to an empty repo, `npm install`, `npm run dev`, and you have a booting RUN game with a bouncing-sprite demo scene to replace.

Pedigree: the boot sequence, boot-cover/loading pattern, device-frame CSS, and deploy config are extracted from a shipped RUN game. The Pixi v8 + React + Tailwind layer is designed for this template and build-verified (`npm run build` — i.e. `tsc --noEmit && vite build`, so type errors fail the build — passes as shipped).

Keep the versions of Pixi, React, and React DOM pinned in `package.json`.
The library plugin uses exact version matches to load host libraries.
A different version can add the library to the game bundle.

## Files

| File | Role |
|---|---|
| `index.html` | Locked mobile viewport, boot cover, React root |
| `public/boot-cover.js` | Removes the boot cover after 4s if boot fails. The external script works with the host CSP. |
| `vite.config.js` | `base: './'` (required), React + Tailwind + RUN SDK libraries/playground plugins, esnext target |
| `tsconfig.json` | Strict TypeScript config (bundler resolution, `react-jsx`, `noEmit`) |
| `package.json` | Pinned SDK, Pixi 8, React 19, Tailwind 4, TypeScript, and the Playground-only Firebase and RevenueCat development dependencies |
| `game.config.prod.json` | RUN deploy config: `gameId` placeholder, `usesPreloader: false`, orientation |
| `src/main.tsx` | **The boot sequence** — numbered steps, in the order that matters |
| `src/sdk/runSdk.ts` | SDK readiness check (never throws) + lifecycle registration for all six hooks |
| `src/state/store.ts` | Tiny external store bridging game code ↔ React (`useSyncExternalStore`); exports the `AppState` type |
| `src/assets/manifest.ts` | Asset list, two tiers: `critical` (awaited) / `deferred` (background) |
| `src/assets/preload.ts` | `warmAssets(onProgress)` via Pixi `Assets` bundles |
| `src/game/pixiApp.ts` | Pixi v8 `Application` factory (DPR cap, autoDensity, transparent canvas) |
| `src/game/stage.ts` | **Design-resolution stage** — scenes work in design units, proportional on every device; exports the `Stage` interface |
| `src/game/GameCanvas.tsx` | React ↔ Pixi boundary; StrictMode-safe mount/destroy; pause wiring |
| `src/game/demoScene.ts` | Throwaway demo scene proving asset → sprite → ticker → store → HUD; exports the `Scene` contract |
| `src/ui/App.tsx` | Phase router: loading → menu → playing |
| `src/ui/LoadingScreen.tsx` / `MainMenu.tsx` / `Hud.tsx` | Reference screens (Tailwind) |
| `src/styles/app.css` | Tailwind import, `@theme` palette, device-frame CSS, safe-area utilities |
| `public/images/placeholder.png` | Demo sprite; delete when real art lands |
| `public/thumbnail.jpg` | Placeholder game tile — **must be replaced before deploying** (see gotchas) |
| `start-game.bat` | Windows dev launcher (installs deps, opens browser, runs Vite) |

## Scaffold protocol (for AI agents)

When the user says "make me a new RUN game" (or similar):

1. **Copy everything in this folder** (including `.gitignore` and `public/`) into the new game's repo root. Keep the structure.
2. **Rename**: `name` in `package.json`, `<title>` in `index.html`, the visible title strings in `LoadingScreen.tsx` / `MainMenu.tsx`. Derive the name from the user's request.
3. **Theme**: set the game's palette in the `@theme` block of `src/styles/app.css` — derive colors from the game's fiction/genre (don't ask).
4. **Orientation**: portrait is the default. Only if the game concept is clearly landscape (racing, side-scroller with wide view): set `"orientation": "landscape"` in `game.config.prod.json` and remove/invert the 9:16 media query in `app.css` (see the `ADAPT:` comment there).
5. `npm install`, then `npm run dev` — confirm the demo boots (loading bar → menu → bouncing sprite, HUD counter climbing).
6. **Build the actual game**: replace `demoScene.ts` with real scenes (keep its `createXxxScene(app, stage) → Scene` contract — `{ destroy() }` — and position everything in design units — see "Coordinate system" below), list real assets in `manifest.ts`, replace the placeholder menu/HUD. Game logic lives in Pixi-side modules; UI-facing state flows through `store.patch()`.
7. **Integrate systems** from this repo as requested (save, shop, stats, ...) — see "Wiring the systems library" below and the root `README.md` routing table.
8. **Deploy setup** happens when the user is ready to publish: `rundot init` (or fill the real `gameId` into `game.config.prod.json`), **replace `public/thumbnail.jpg` with real game art** (exactly 512×512 — the shipped file is an obvious placeholder and deploying with a placeholder is not acceptable), `npm run build`, `rundot deploy`.

## The boot sequence (why this order)

`src/main.tsx` is the spec; summary:

1. The static SDK `/api` import starts host initialization and waits for its attempt. `initSdk()` checks public `context`, then calls `getProfile()` to confirm a valid cached profile. It catches failure and lets the game boot. With the playground plugin wired, `npm run dev` uses the RUN.world playground backend (sign in via the dev toolbar).
2. Load the save (once `systems/save` is integrated) — before first render so the first screen shows real progress. (The `systems/` templates are TypeScript like this scaffold; they drop into `src/helpers/` and type-check with the rest of the app.)
3. Mount React → paints the loading screen at 0%.
4. Lift the `#boot-cover` after a double-`requestAnimationFrame` (the loading screen has actually painted). The 4s timeout in `public/boot-cover.js` removes the cover if boot fails.
5. `warmAssets()` — awaits the `critical` bundle with progress, fire-and-forgets the `deferred` bundle.
6. Phase → `'menu'`.
7. Register lifecycles (pause/resume freeze the Pixi ticker; sleep/quit flush the save).
8. Post-boot fire-and-forget: server time, notifications re-arm, analytics boot event.

## Architecture

Three layers inside one centered device frame (`#app-frame`, width `--game-w`):

```
┌─ #app-frame (CSS-positioned column, portrait) ─┐
│  React UI: screens + HUD (Tailwind, z above)   │   pointer-events-none overlay;
│  Pixi canvas: the game (transparent bg)        │   controls opt back in
│  CSS background layers (optional, z below)     │
└────────────────────────────────────────────────┘
```

- **React owns navigation** (which screen exists), **Pixi owns the game**. `GameCanvas` mounts/destroys the Pixi app with the `'playing'` phase.
- **Game → UI** communication is `store.patch()` on discrete events (score, wave, popup triggers) — never per-frame. **UI → game** is either a store field the scene reads, or a direct function call into the scene module.
- The Pixi canvas uses `resizeTo` the frame div, so CSS is the single source of truth for game size; DOM UI and canvas can never disagree.

### Coordinate system: design units, not pixels

Scene code never positions in raw pixels. `stage.ts` scales a root container by `screenWidth / DESIGN_WIDTH` (720 by default), and scenes add content to `stage.root` in **design units**:

- Horizontal space is always exactly `stage.width` (720) units — something 180 units wide is 25% of the screen width on *every* device and aspect ratio.
- Vertical space varies by device: `stage.designHeight()` reports the current height in units (1280 at exactly 9:16, up to ~1560 on tall phones, thanks to the CSS frame clamp). Anchor vertical layout to top/bottom/center off `designHeight()`; re-anchor in a `stage.onResize(cb)` callback. Keep must-see content within the top 1280 units or bottom-anchor it.
- Use width-fit background art with all gameplay geometry derived as fractions of screen width; taller screens simply reveal more art at the top. Keep that proportionality strategy in one module instead of ad-hoc per-element math.
- The DOM/React side gets the same behavior for free: Tailwind percentages/fractions are relative to the device frame.
- Landscape games invert the pattern (fix design *height*, let width vary) — see the `ADAPT:` note in `stage.ts`.

## Config / adapt points

Every intended edit is marked `ADAPT:` in the source. The full list: game title (3 places), palette (`@theme`), orientation (config + media query), asset manifest, demo scene replacement, `DESIGN_WIDTH` (`stage.ts` — keep 720 unless art dictates otherwise), DPR cap / pixel-art texture settings (`pixiApp.ts`), store fields, save/flush hooks in `main.tsx` steps 2/7/8, `gameId`.

## Derive from the user's request (do not ask)

| Decision | How to derive |
|---|---|
| Game name / title strings | From the request; invent a working title if absent (user renames later) |
| Palette | From genre/fiction (horror → dark + red accent, casual → bright). Any reasonable choice; it's one `@theme` block to change later |
| Orientation | Portrait unless the concept is inherently wide. RUN games are mobile-first — when in doubt, portrait |
| Pixel-art vs smooth rendering | From the art direction implied by the request; the `ADAPT:` comment in `pixiApp.ts` covers the pixel-art switches |
| Which systems to pre-integrate | Only what's asked. Suggest `systems/save/` early — everything else persists through it |

## SDK notes & gotchas

- Read `../docs/run-sdk-notes.md` before touching SDK code. Core posture: every SDK call try/catch'd; boot and run fine without the host.
- **Playground dependencies must stay in `package.json`**: `firebase` provides Playground authentication and Firestore. `@revenuecat/purchases-js` provides Playground IAP and subscription checkout. Both are development dependencies. The production RUN host uses its own bridge, so the default production game bundle does not include them.
- **`usesPreloader: false`**: this template renders its own loading screen. The alternative is the host's native loader (`RundotGameAPI.preloader.showLoadScreen/setLoaderProgress/hideLoadScreen`) with `usesPreloader: true` — fine too, but don't do both.
- Lifecycle rules: persist on `onSleep`, never rely on `onQuit`, never fire fresh SDK RPCs from sleep/quit handlers.
- Safe area: top inset is deliberately `0px` (`--safe-top`) because the RUN host pads below its native header — `env(safe-area-inset-top)` double-pads. Bottom uses the real `env()` inset (`pb-safe-bottom`).
- `base: './'` and `dist/` output are required by RUN deploy; don't change them.
- **Thumbnail**: RUN requires `public/thumbnail.jpg`, **exactly 512×512 pixels**, JPG — it's the game's tile on the Explore page, search, and shared links. `rundot deploy` fails on wrong dimensions and refuses known default/template thumbnails. This starter ships a labeled placeholder so the project structure is complete from day one; **the developer must replace it with real game art before deploying** — remind them at deploy time, and offer to generate/resize one if they have art. Bold, minimal-text images read best at small sizes.

## Wiring the systems library

The `systems/` templates copy into `src/helpers/` here exactly as their READMEs describe. Where each plugs into this shell:

| System | Plug-in point |
|---|---|
| `save` | `main.tsx` step 2 (`await load()`), step 7 `onSleep`/`onQuit` (`flush()`), and `save.tick(dt)` from a ticker callback (or `markDirty()` at mutation sites) |
| `localization` | step 2, before first render — then route the UI strings in `ui/` through it |
| `serverTime` (shared, TypeScript) | step 8 (`refreshServerTime()` fire-and-forget) |
| `stats`, `daily-rewards`, `daily-quests`, `iap-shop`, `ads` | per their READMEs; their state nests in the save blob; their screens become React components (each README has a UI-adaptation section — this shell is the "React host" case) |
| `analytics` | step 8 boot event; hooks per its "Wiring the other systems" section |
| `notifications` | step 8 / on resume — while the app is alive, never from `onSleep` |
| `tutorial` | after first render; it's DOM-based and works as-is above the React UI (spotlight targets are DOM elements — give HUD/menu elements stable ids) |

## Verification checklist

After scaffolding (agent: actually do these, don't just build):

- [ ] `npm install` clean; `npm run dev` boots with no console errors.
- [ ] Black cover → loading bar animates 0→100 → menu. No white flash, no stuck black screen.
- [ ] Play → bouncing sprite; HUD counter increments on bounces (store bridge works); Menu button returns (Pixi app destroyed cleanly — no WebGL context warnings after a few round trips).
- [ ] Resize the window / toggle device toolbar: canvas and UI stay aligned inside the frame; landscape letterboxes.
- [ ] Across different device sizes in the toolbar, the demo sprite is always the same *fraction* of the screen width (~25%) — the design-resolution stage is working.
- [ ] `npm run build` succeeds (it type-checks first: `tsc --noEmit && vite build`); `npm run preview` serves a working game; `dist/index.html` asset URLs start with `./`.
- [ ] With the RUN host (or mock): pause overlay freezes the sprite, resume unfreezes.

Before the first `rundot deploy` (not at scaffold time):

- [ ] `public/thumbnail.jpg` replaced with real 512×512 game art (the placeholder must not ship).
- [ ] Real `gameId` in `game.config.prod.json`.
