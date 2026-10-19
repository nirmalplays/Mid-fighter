// Versioned, cloud-synced save system for RUN games.
//
// Model: one JSON blob in RundotGameAPI.appStorage (per-title, cloud-synced).
// The live in-memory object IS the save — gameplay code mutates it directly,
// then calls save() (discrete events) or markDirty() (continuous counters,
// flushed by tick() at most once per debounceSeconds of gameplay).
//
// Durability comes from three layers, in order of importance:
//   1. save() at every meaningful state change (cheap: fire-and-forget)
//   2. attachLifecycleFlush(): awaited write on onSleep/onQuit
//   3. tick(): debounced flush of high-frequency dirty state during play
//
// Schema evolution:
//   - Purely additive fields need NO migration: add them to defaultSave() and
//     the generic back-fill fills them into old saves on load.
//   - Shape changes get a numbered migration function (see README playbook).
//   - Corrupt/unparseable saves fall back to defaultSave() — the game always
//     boots with a valid save rather than crashing.
//
// Typing: createSaveSystem is generic over the game's save shape. Define the
// shape once and everything downstream is typed:
//
//   interface MySave { version: number; coins: number; ... }
//   const saveSystem = createSaveSystem<MySave>({ ... });
//   const save = await saveSystem.load();   // save: MySave

import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

/**
 * A save blob as loaded from storage BEFORE migrations have run — an unknown
 * historical shape. Migrations receive this and are responsible for reshaping
 * it toward the current schema.
 */
export type LegacySave = Record<string, any> & { version?: number };

/**
 * Migration to one target version. Mutate `s` in place, or return a
 * replacement object (e.g. `return def` for a hard reset). May be async.
 * Runs exactly once per save: the version is stamped after it.
 */
export type Migration<S extends object> =
    (s: LegacySave, def: S) => LegacySave | void | Promise<LegacySave | void>;

export interface SaveSystemConfig<S extends { version: number }> {
    /** Storage key, e.g. 'my-game-save'. Rules: ≤256 bytes, no '.', no leading '__'. */
    key: string;
    /** Current schema version. Bump whenever the shape changes (not for additive fields). */
    version: number;
    /**
     * Returns a fresh save object with EVERY field defaulted. Single source of
     * truth for the schema; the back-fill loop fills old saves from it.
     */
    defaultSave: () => S;
    /**
     * Map of targetVersion -> migration fn, run in ascending order for saves
     * with version < targetVersion.
     */
    migrations?: Record<number, Migration<S>>;
    /**
     * Runs after migrations + top-level back-fill on every load. Use it for
     * nested-shape guards: coerce wrong types, clamp numbers, pad/truncate
     * fixed-length arrays, fillMissing() nested maps. Protects against partial
     * writes and hand-edited saves. (The object is only S-shaped after this
     * completes, hence the LegacySave parameter type.)
     */
    validate?: (s: LegacySave, def: S) => void;
    /** Max flush rate for tick()-driven dirty state. Default 5. */
    debounceSeconds?: number;
}

export interface SaveSystem<S extends { version: number }> {
    /** The live save object. Assigned by load(); mutate it directly. Null before load(). */
    data: S | null;
    /** Read + migrate + back-fill. Call once at boot. Never throws. */
    load(): Promise<S>;
    /** Immediate fire-and-forget persist + clears the dirty flag. */
    save(): void;
    /** Awaited persist — use in lifecycle handlers. Never throws. */
    flush(): Promise<void>;
    /** Mark high-frequency state as needing a debounced flush. */
    markDirty(): void;
    /** Call from the game loop with elapsed seconds; flushes dirty state on the debounce interval. */
    tick(dt: number): void;
    /** Register onSleep/onQuit flush handlers. Call once at boot. */
    attachLifecycleFlush(): void;
    /** Pretty JSON of the LIVE state (reflects un-flushed changes). */
    exportJson(): string;
    /** Write a backup verbatim to storage (deliberately unmigrated). Resolves true if accepted. */
    importJson(jsonStr: string): Promise<boolean>;
    /** Expose window.<name>.export()/.import(json) console helpers for QA. */
    exposeConsoleHelpers(name: string): void;
}

export function createSaveSystem<S extends { version: number }>(
    config: SaveSystemConfig<S>,
): SaveSystem<S> {
    const {
        key,
        version,
        defaultSave,
        migrations = {},
        validate = null,
        debounceSeconds = 5,
    } = config;

    let _dirty = false;
    let _timer = 0;

    const sys: SaveSystem<S> = {
        data: null,

        /**
         * Read + migrate + back-fill. Never throws; any failure (missing key,
         * corrupt JSON, storage error) yields a fresh default.
         */
        async load(): Promise<S> {
            const def = defaultSave();
            try {
                const raw = await RundotGameAPI.appStorage.getItem(key);
                if (raw === null || raw === undefined) {
                    sys.data = def; // first launch
                    return sys.data;
                }
                let s: LegacySave = JSON.parse(raw);
                if (!s || typeof s !== 'object' || Array.isArray(s)) {
                    sys.data = def;
                    return sys.data;
                }

                // Versioned migrations, ascending. A missing version counts as 0.
                const targets = Object.keys(migrations).map(Number).sort((a, b) => a - b);
                for (const v of targets) {
                    if ((s.version || 0) < v) {
                        const replacement = await migrations[v](s, def);
                        if (replacement) s = replacement;
                        s.version = v;
                    }
                }

                // Generic back-fill: any top-level key added to defaultSave()
                // after this save was created gets its default. This is why
                // additive schema changes need no migration block.
                for (const k of Object.keys(def) as Array<keyof S & string>) {
                    if (!(k in s)) s[k] = def[k];
                }

                if (validate) validate(s, def);

                // Stamp so future loads know every migration above has run.
                // After migrations + back-fill + validate, s IS the current shape.
                s.version = version;
                sys.data = s as S;
                return sys.data;
            } catch {
                sys.data = def;
                return def;
            }
        },

        /**
         * Call after every meaningful discrete state change (purchase, unlock,
         * level end, settings change). Cheap: the whole object serializes each
         * time, so there is no partial-write state to corrupt.
         */
        save(): void {
            _dirty = false;
            void sys.flush();
        },

        async flush(): Promise<void> {
            if (!sys.data) return;
            try {
                await RundotGameAPI.appStorage.setItem(key, JSON.stringify(sys.data));
            } catch { /* storage errors must never crash the game */ }
        },

        /**
         * Mark high-frequency state (per-frame stats, timers) as needing a
         * flush. tick() will persist it at most once per debounceSeconds.
         */
        markDirty(): void {
            _dirty = true;
        },

        tick(dt: number): void {
            if (!_dirty) return;
            _timer += dt;
            if (_timer > debounceSeconds) {
                _timer = 0;
                sys.save();
            }
        },

        /**
         * onSleep is the real durability guarantee — onQuit may never fire on
         * a hard kill. Do NOT add other RPCs (notifications etc.) to these
         * handlers; schedule that work while the app is alive.
         */
        attachLifecycleFlush(): void {
            try {
                RundotGameAPI.lifecycles.onSleep(() => {
                    void sys.flush();
                });
                RundotGameAPI.lifecycles.onQuit(() => {
                    void sys.flush();
                });
            } catch { /* mock mode without lifecycles */ }
        },

        exportJson(): string {
            return JSON.stringify(sys.data, null, 2);
        },

        /**
         * Write a backup verbatim to storage — deliberately WITHOUT migrating,
         * so the next boot's load() exercises the real migration path (ideal
         * for testing migrations against old backups). Requires a reload to
         * take effect.
         */
        async importJson(jsonStr: string): Promise<boolean> {
            let parsed: unknown;
            try { parsed = JSON.parse(jsonStr); } catch { return false; }
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
            try {
                await RundotGameAPI.appStorage.setItem(key, JSON.stringify(parsed));
                return true;
            } catch { return false; }
        },

        /**
         * Safe to ship: it only touches this save key.
         */
        exposeConsoleHelpers(name: string): void {
            if (typeof window === 'undefined') return;
            (window as any)[name] = {
                export(): string {
                    const json = sys.exportJson();
                    // .catch: writeText rejects ASYNC (denied permission) — a
                    // sync try/catch alone leaves an unhandled rejection.
                    try { navigator.clipboard?.writeText(json).catch(() => {}); } catch { /* best-effort */ }
                    console.log(json);
                    return json;
                },
                async import(jsonStr: string): Promise<boolean> {
                    const ok = await sys.importJson(jsonStr);
                    console.log(ok ? 'Imported. Reload the game to apply.' : 'Import rejected: not a valid save object.');
                    return ok;
                },
            };
        },
    };

    return sys;
}

/**
 * Back-fill helper for nested maps inside validate():
 *   fillMissing(s.stats, def.stats)   // new stat keys default in old saves
 * Shallow by design — call it per subtree you care about.
 */
export function fillMissing<T extends Record<string, any>>(target: T, defaults: T): T {
    for (const k of Object.keys(defaults)) {
        if (!(k in target)) (target as Record<string, any>)[k] = defaults[k];
    }
    return target;
}
