/**
 * Sound: the game's effects (public/sounds, from the project's "Sound effects" and "Special
 * effect" packs) played through Web Audio, a few made on the fly (a sword whoosh, axe chop,
 * pickaxe clink and boss-slam rumble), looping climate sounds (breeze and birds, rain, fire)
 * from the "Climate sounds" pack, and the music (public/music, from "BGM"): the
 * intro theme on the menus, exploration tracks while roaming, battle tracks when a horde
 * closes in, and the battle theme for bosses, crossfading as the mood changes.
 *
 * Browsers only allow sound after the player touches the page, so every tap, click and key
 * press tries to start (or resume) it until it runs, and music that should be playing is
 * restarted if it is not. Files load in the background from boot. If Web Audio is not
 * running, effects fall back to plain audio elements. The HUD's speaker button shows the
 * state and can switch sound on (see useSoundState). Busy sounds (hits, pickups) are rate-limited so a fight
 * does not turn into noise, and each play is pitched a little differently.
 */
import { useSyncExternalStore } from 'react';
import { settings } from './settings.ts';

export type Sfx =
    | 'click' | 'start' | 'gameover' | 'levelup' | 'chapter' | 'victory' | 'kill' | 'spell' | 'fanfare'
    | 'dodge' | 'fall' | 'wave' | 'hurt' | 'chest' | 'pickup' | 'card' | 'revive' | 'craft'
    | 'skill_fire' | 'skill_air' | 'skill_water' | 'skill_earth' | 'explosion' | 'thunderclap';
type Synth = 'swing' | 'chop' | 'mine' | 'thunder';

const FILES: Record<Sfx, string> = {
    click: 'click.mp3', start: 'start.mp3', gameover: 'gameover.mp3', levelup: 'levelup.mp3', chapter: 'chapter.mp3',
    victory: 'victory.mp3', kill: 'kill.mp3', spell: 'spell.mp3', fanfare: 'fanfare.mp3', dodge: 'dodge.mp3',
    fall: 'fall.mp3', wave: 'wave.mp3', hurt: 'hurt.mp3', chest: 'chest.mp3', pickup: 'pickup.mp3', card: 'card.mp3',
    revive: 'revive.mp3', craft: 'craft.mp3',
    skill_fire: 'skill_fire.mp3', skill_air: 'skill_air.mp3', skill_water: 'skill_water.mp3', skill_earth: 'skill_earth.mp3', explosion: 'explosion.mp3',
    thunderclap: 'thunder.mp3',
};
/** Loudness of each sound (before the master volume), and the least time between two plays. */
const MIX: Partial<Record<Sfx | Synth, { gain: number; gap: number }>> = {
    click: { gain: 0.5, gap: 60 },
    kill: { gain: 0.45, gap: 90 },
    hurt: { gain: 0.6, gap: 150 },
    pickup: { gain: 0.45, gap: 120 },
    spell: { gain: 0.6, gap: 120 },
    dodge: { gain: 0.6, gap: 150 },
    fanfare: { gain: 0.55, gap: 3000 },
    wave: { gain: 0.5, gap: 2000 },
    swing: { gain: 0.35, gap: 90 },
    chop: { gain: 0.6, gap: 120 },
    mine: { gain: 0.5, gap: 120 },
    thunder: { gain: 0.8, gap: 1500 },
    explosion: { gain: 0.55, gap: 250 },
    thunderclap: { gain: 0.8, gap: 1200 },
    skill_fire: { gain: 0.9, gap: 500 },
    skill_air: { gain: 0.9, gap: 500 },
    skill_water: { gain: 0.9, gap: 500 },
    skill_earth: { gain: 0.9, gap: 500 },
};
/** Busy sounds get a small random pitch so repeats do not sound mechanical. */
const VARY = new Set<string>(['kill', 'hurt', 'pickup', 'swing', 'chop', 'mine', 'click']);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<Sfx, AudioBuffer>();
const last = new Map<string, number>();
let loading = false;

function ensure(): AudioContext | null {
    if (ctx) return ctx;
    try {
        const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!C) return null;
        ctx = new C();
        master = ctx.createGain();
        master.connect(ctx.destination);
        applyVolume();
    } catch {
        ctx = null;
    }
    return ctx;
}

function applyVolume(): void {
    const s = settings.get();
    if (master && ctx) master.gain.setTargetAtTime(s.sound ? s.volume : 0, ctx.currentTime, 0.02);
}

/** Load every file in the background (from boot; quietly skips any that fail). */
export function loadSounds(): void {
    if (loading) return;
    loading = true;
    const c = ensure();
    if (!c) return;
    c.addEventListener('statechange', publish);
    for (const [name, file] of Object.entries(FILES) as [Sfx, string][]) {
        fetch(`sounds/${file}`)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
            .then((data) => c.decodeAudioData(data))
            .then((buf) => buffers.set(name, buf))
            .catch(() => { /* this one just stays silent */ });
    }
}

// ---- music: one streamed track at a time, by mood
//   title     the home screen and menus (Intro music)
//   cutscene  the opening story (First cut scene BGM)
//   explore   roaming between waves (Exploration 1-3)
//   combat    every wave, from its first monster to its last (Mini battle 1-3)
//   boss      a guardian, warden or Malakor (Battle 1)
//   underground  caves, dungeons and ruins (a slow drone with far-off bells)
// A change of mood fades the old track out completely, lets a moment of silence pass, and only
// then brings the new one in, so two songs never play over each other.
export type Mood = 'title' | 'cutscene' | 'explore' | 'combat' | 'boss' | 'underground' | 'none';
const PLAYLIST: Record<Exclude<Mood, 'none'>, string[]> = {
    title: ['intro.mp3'],
    cutscene: ['cutscene.mp3'],
    explore: ['explore1.mp3', 'explore2.mp3', 'explore3.mp3'],
    combat: ['skirmish1.mp3', 'skirmish2.mp3', 'skirmish3.mp3'],
    boss: ['boss.mp3'],
    underground: ['underground.mp3'],
};
const fight = (m: Mood) => m === 'combat' || m === 'boss';
/** How a change of mood goes (ms): the old track fading out, the silence between, the new fading in. */
function transition(from: Mood, to: Mood): { out: number; gap: number; in: number } {
    if (from === 'none') return { out: 0, gap: 0, in: 700 }; // the first music of a session comes in at once
    if (fight(to) && !fight(from)) return { out: 1000, gap: 700, in: 900 }; // into a fight: quick, but clean
    if (fight(from) && !fight(to)) return { out: 2200, gap: 1800, in: 2200 }; // the fight is over: a breath, then calm
    return { out: 1500, gap: 1200, in: 1600 };
}
/** Moods whose track waits, paused where it was, to pick up again when the mood comes back. */
const RESUMES: Mood[] = ['title', 'explore', 'combat', 'underground'];

/** The browser refused to start the music until the player touches the page (the home page asks for a tap). */
let musicBlocked = false;
const blockedListeners = new Set<() => void>();
function setBlocked(b: boolean): void {
    if (b === musicBlocked) return;
    musicBlocked = b;
    for (const l of blockedListeners) l();
}
export function useMusicBlocked(): boolean {
    return useSyncExternalStore((l) => {
        blockedListeners.add(l);
        return () => blockedListeners.delete(l);
    }, () => musicBlocked);
}
const refused = (err: unknown) => {
    if ((err as { name?: string })?.name === 'NotAllowedError') setBlocked(true);
};

/**
 * Every music track ever made on this page, kept on the window so that a second copy of this
 * module (the dev server reloading it after an edit) can silence the first's, and nothing is left
 * playing underneath.
 */
const allTracks: Set<HTMLAudioElement> = (() => {
    const w = (typeof window !== 'undefined' ? window : {}) as { __mehTracks?: Set<HTMLAudioElement> };
    const old = w.__mehTracks;
    if (old) for (const el of old) {
        el.pause();
        el.src = '';
    }
    return (w.__mehTracks = new Set());
})();

export const music = (() => {
    let mood: Mood = 'none';
    let pausedByHost = false;
    let current: HTMLAudioElement | null = null;
    /** The next track waiting out the silence between songs. */
    let pending = 0;
    /** Tracks set aside (paused at their place) by mood. */
    const parked = new Map<Mood, HTMLAudioElement>();
    const turn: Record<string, number> = { explore: Math.floor(Math.random() * 3), combat: Math.floor(Math.random() * 3) };
    let duck = 1;
    const target = () => {
        const s = settings.get();
        return s.music ? s.musicVolume * duck : 0;
    };
    /** The fade running on each track (a newer fade takes over from an older one). */
    const fades = new WeakMap<HTMLAudioElement, number>();
    let fadeId = 0;
    /** Ease a track's volume to `to` over `ms` along a smooth curve, then pause it (keeping its place) or drop it. */
    const fade = (el: HTMLAudioElement, to: number, ms: number, end: 'none' | 'pause' | 'stop' = 'none') => {
        const id = ++fadeId;
        fades.set(el, id);
        const from = el.volume;
        const t0 = performance.now();
        const finish = () => {
            if (end === 'pause') el.pause();
            else if (end === 'stop') {
                el.pause();
                el.src = '';
                allTracks.delete(el);
            }
        };
        if (ms <= 0) {
            el.volume = Math.max(0, Math.min(1, to));
            finish();
            return;
        }
        const step = () => {
            if (fades.get(el) !== id) return; // another fade took over
            const k = Math.min(1, (performance.now() - t0) / ms);
            const eased = 0.5 - 0.5 * Math.cos(Math.PI * k); // slow in, slow out
            el.volume = Math.max(0, Math.min(1, from + (to - from) * eased));
            if (k < 1) requestAnimationFrame(step);
            else finish();
        };
        requestAnimationFrame(step);
    };
    /** Only the current track may sound: anything else still playing (a leftover) fades away now. */
    const hushOthers = (keep: HTMLAudioElement) => {
        for (const el of allTracks) if (el !== keep && !el.paused && fades.get(el) === undefined) fade(el, 0, 600, 'pause');
    };
    /** Start (or pick up again) the track for the current mood, fading in over `ms`. */
    const start = (ms: number) => {
        pending = 0;
        if (mood === 'none' || !settings.get().music) return;
        const playing = mood;
        let el = parked.get(mood) ?? null;
        parked.delete(mood);
        if (!el) {
            const list = PLAYLIST[mood];
            const n = list.length > 1 ? (turn[mood] = ((turn[mood] ?? 0) + 1) % list.length) : 0;
            el = new Audio(`music/${list[n]}`);
            el.volume = 0;
            // One track loops on its own; a playlist moves on to the next track (after a short breath).
            el.loop = list.length === 1;
            allTracks.add(el);
            const me = el;
            el.addEventListener('ended', () => {
                if (current !== me || mood !== playing) return;
                current = null;
                allTracks.delete(me);
                pending = window.setTimeout(() => start(1500), 1200);
            });
        }
        const me = el;
        current = el;
        fades.delete(el);
        // Paused by the host or hidden: it waits, ready, and plays when the game is back.
        if (pausedByHost || document.hidden) return;
        el.play().then(() => {
            setBlocked(false);
            if (current !== me) return;
            hushOthers(me);
            fade(me, target(), ms);
            publish();
        }).catch(refused); // not allowed yet: the next touch retries
    };
    /** Let the playing track go: set aside to resume later, or faded out for good. */
    const release = (ms: number, keep: boolean) => {
        const el = current;
        current = null;
        if (!el) return;
        if (keep && !el.paused) {
            const old = parked.get(mood);
            if (old && old !== el) {
                old.pause();
                old.src = '';
                allTracks.delete(old);
            }
            parked.set(mood, el);
            fade(el, 0, ms, 'pause');
        } else fade(el, 0, ms, 'stop');
    };
    const stopAll = () => {
        setBlocked(false);
        window.clearTimeout(pending);
        pending = 0;
        if (current) fade(current, 0, 600, 'stop');
        current = null;
        for (const el of parked.values()) {
            el.pause();
            el.src = '';
            allTracks.delete(el);
        }
        parked.clear();
    };
    return {
        /** Change the mood (does nothing if it is already playing): out, a moment's silence, then in. */
        set(next: Mood): void {
            if (next === mood) return;
            const t = transition(mood, next);
            window.clearTimeout(pending);
            pending = 0;
            release(t.out, RESUMES.includes(mood));
            mood = next;
            // Visible to automated checks (and handy in the browser's inspector).
            document.documentElement.dataset.music = next;
            if (next === 'none') return;
            const wait = t.out + t.gap;
            if (wait <= 0) start(t.in);
            else pending = window.setTimeout(() => start(t.in), wait);
        },
        mood: () => mood,
        /** A touch: start whatever should be playing (again, if an earlier try was refused). */
        unlocked(): void {
            if (mood === 'none' || !settings.get().music || pending) return;
            if (!current) start(700);
            else if (current.paused && !pausedByHost) {
                const el = current;
                el.play().then(() => {
                    setBlocked(false);
                    hushOthers(el);
                    fade(el, target(), 700);
                }).catch(refused);
            }
        },
        /** Lower the music (0..1 of its volume) while something speaks over it; 1 restores it. */
        duck(level: number): void {
            duck = level;
            if (current && !current.paused) fade(current, target(), 900);
        },
        /** Whether a track is actually playing. */
        playing: (): boolean => !!current && !current.paused,
        /** Settings changed: follow the music switch and volume. */
        volume(): void {
            if (!settings.get().music) {
                stopAll();
                return;
            }
            if (!current && !pending) start(1200);
            else if (current) fade(current, target(), 300);
        },
        hidden(h: boolean): void {
            pausedByHost = h;
            if (!current) return;
            if (h) current.pause();
            else {
                const el = current;
                void el.play().then(() => fade(el, target(), 700)).catch(() => {});
            }
        },
        /** Silence everything (this module being replaced). */
        stopAll,
    };
})();

// The dev server swapping this module after an edit: the old player goes quiet first.
if (import.meta.hot) import.meta.hot.dispose(() => music.stopAll());

// Debug: with ?spawn= the sound state is exposed for automated checks.
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('spawn')) {
    (window as unknown as { __audio?: unknown }).__audio = { state: () => ctx?.state ?? 'none', buffers: () => [...buffers.keys()], settings: () => settings.get(), music: () => music.playing() };
}

// Start (or resume) sound on the first touch or key, as browsers require.
if (typeof window !== 'undefined') {
    const unlock = () => {
        const c = ensure();
        if (c && c.state !== 'running' && !hostPaused) c.resume().then(publish).catch(() => {});
        loadSounds();
        if (!hostPaused) {
            music.unlocked();
            ambience.kick();
        }
        publish();
    };
    // Touch screens only count a finished touch as a gesture, so listen to every kind.
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const) window.addEventListener(ev, unlock, { capture: true });
    // Fetch and decode right away, so sounds are ready by the first touch.
    loadSounds();
    settings.subscribe(applyVolume);
    settings.subscribe(() => music.volume());
    settings.subscribe(publish);
    settings.subscribe(() => ambience.kick());
    // A paused or hidden game is silent.
    document.addEventListener('visibilitychange', () => {
        music.hidden(document.hidden || hostPaused);
        ambience.kick();
        if (!ctx) return;
        if (document.hidden) void ctx.suspend();
        else if (!hostPaused) void ctx.resume().catch(() => {});
    });
}

// ---- whether sound is live, for the HUD's speaker button
export type SoundState = 'on' | 'off' | 'waiting';
let hostPaused = false;
let soundState: SoundState = 'waiting';
const soundListeners = new Set<() => void>();
function publish(): void {
    const s = settings.get();
    const next: SoundState = !s.sound && !s.music ? 'off' : (ctx && ctx.state === 'running') || music.playing() ? 'on' : 'waiting';
    if (next === soundState) return;
    soundState = next;
    if (next === 'on') console.info('[audio] sound is on');
    for (const l of soundListeners) l();
}
export function useSoundState(): SoundState {
    return useSyncExternalStore((l) => {
        soundListeners.add(l);
        return () => soundListeners.delete(l);
    }, () => soundState);
}
/** The RUN host paused or resumed the game (an overlay, a brief focus loss): silence it meanwhile. */
export function hostPause(paused: boolean): void {
    hostPaused = paused;
    music.hidden(paused || document.hidden);
    ambience.kick();
    if (ctx) void (paused ? ctx.suspend() : ctx.resume()).catch(() => {});
    publish();
}

const allowed = (name: string): boolean => {
    if (!ctx || !master || ctx.state !== 'running' || !settings.get().sound) return false;
    const now = performance.now();
    const gap = MIX[name as Sfx]?.gap ?? 40;
    if (now - (last.get(name) ?? -1e9) < gap) return false;
    last.set(name, now);
    return true;
};

/** Plain <audio> fallback for when Web Audio is not running (some embedded browsers). */
function sfxFallback(name: Sfx, volume: number): void {
    const s = settings.get();
    if (!s.sound || document.hidden || hostPaused) return;
    const now = performance.now();
    if (now - (last.get(name) ?? -1e9) < (MIX[name]?.gap ?? 40)) return;
    last.set(name, now);
    try {
        const el = new Audio(`sounds/${FILES[name]}`);
        el.volume = Math.max(0, Math.min(1, (MIX[name]?.gain ?? 0.7) * volume * s.volume));
        void el.play().catch(() => {});
    } catch {
        /* no audio at all here */
    }
}

/** Play one of the pack's sounds. `volume` scales it (e.g. quieter when far away). */
export function sfx(name: Sfx, volume = 1): void {
    const buf = buffers.get(name);
    if (!ctx || ctx.state !== 'running' || !buf) {
        sfxFallback(name, volume);
        return;
    }
    if (!allowed(name)) return;
    const src = ctx!.createBufferSource();
    src.buffer = buf;
    if (VARY.has(name)) src.playbackRate.value = 0.92 + Math.random() * 0.16;
    const g = ctx!.createGain();
    g.gain.value = (MIX[name]?.gain ?? 0.7) * volume;
    src.connect(g).connect(master!);
    src.start();
}

/** A burst of filtered noise (the base of the whoosh, chop, thunder and rain). */
function noise(seconds: number): AudioBuffer {
    const c = ctx!;
    const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
}

/** Sounds the pack does not have, made on the fly. */
export function synth(name: Synth, volume = 1): void {
    if (!allowed(name)) return;
    const c = ctx!;
    const t = c.currentTime;
    const out = c.createGain();
    out.gain.value = (MIX[name]?.gain ?? 0.5) * volume;
    out.connect(master!);
    const rate = VARY.has(name) ? 0.9 + Math.random() * 0.2 : 1;
    if (name === 'swing') {
        // A short rising-then-falling hiss.
        const src = c.createBufferSource();
        src.buffer = noise(0.22);
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 1.2;
        f.frequency.setValueAtTime(700 * rate, t);
        f.frequency.exponentialRampToValueAtTime(2600 * rate, t + 0.09);
        f.frequency.exponentialRampToValueAtTime(900 * rate, t + 0.2);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(1, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.21);
        src.connect(f).connect(g).connect(out);
        src.start(t);
    } else if (name === 'chop') {
        // A woody knock: a low thump and a short crack.
        const o = c.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(190 * rate, t);
        o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
        const g = c.createGain();
        g.gain.setValueAtTime(1, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.17);
        const n = c.createBufferSource();
        n.buffer = noise(0.06);
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1800 * rate;
        const g2 = c.createGain();
        g2.gain.setValueAtTime(0.7, t);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        n.connect(f).connect(g2).connect(out);
        n.start(t);
    } else if (name === 'mine') {
        // Steel on stone: two bright partials that ring briefly.
        for (const [freq, len] of [[1850, 0.25], [2770, 0.18]] as const) {
            const o = c.createOscillator();
            o.type = 'sine';
            o.frequency.value = freq * rate;
            const g = c.createGain();
            g.gain.setValueAtTime(0.5, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + len);
            o.connect(g).connect(out);
            o.start(t);
            o.stop(t + len + 0.01);
        }
        const n = c.createBufferSource();
        n.buffer = noise(0.04);
        const g2 = c.createGain();
        g2.gain.setValueAtTime(0.5, t);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        n.connect(g2).connect(out);
        n.start(t);
    } else {
        // Thunder: a crack, then a long low rumble.
        const n = c.createBufferSource();
        n.buffer = noise(2.4);
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(2400, t);
        f.frequency.exponentialRampToValueAtTime(160, t + 0.5);
        const g = c.createGain();
        g.gain.setValueAtTime(1, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
        n.connect(f).connect(g).connect(out);
        n.start(t);
    }
}

// ---- ambience: looping climate sounds (breeze and birds, rain, a crackling fire) that ease between levels
export type AmbientKind = 'breeze' | 'rain' | 'fire';
const AMBIENT_FILE: Record<AmbientKind, string> = { breeze: 'breeze.mp3', rain: 'rain.mp3', fire: 'fire.mp3' };
/** How loud each loop is at level 1 (before the effects volume). */
const AMBIENT_GAIN: Record<AmbientKind, number> = { breeze: 0.35, rain: 0.45, fire: 0.5 };

export const ambience = (() => {
    const want: Record<AmbientKind, number> = { breeze: 0, rain: 0, fire: 0 };
    const now: Record<AmbientKind, number> = { breeze: 0, rain: 0, fire: 0 };
    const els: Partial<Record<AmbientKind, HTMLAudioElement>> = {};
    let ticking = false;
    const silent = () => document.hidden || hostPaused || !settings.get().sound;
    const tick = () => {
        let busy = false;
        for (const k of Object.keys(want) as AmbientKind[]) {
            const goal = silent() ? 0 : want[k];
            now[k] += (goal - now[k]) * 0.12;
            if (Math.abs(goal - now[k]) < 0.005) now[k] = goal;
            if (now[k] !== goal) busy = true;
            let el = els[k];
            if (now[k] > 0.001 && !el) {
                el = new Audio(`ambience/${AMBIENT_FILE[k]}`);
                el.loop = true;
                el.volume = 0;
                els[k] = el;
            }
            if (!el) continue;
            el.volume = Math.max(0, Math.min(1, now[k] * AMBIENT_GAIN[k] * settings.get().volume));
            if (now[k] > 0.001 && el.paused) void el.play().catch(() => { /* not allowed yet: a touch retries */ });
            if (now[k] <= 0.001 && !el.paused) el.pause();
        }
        if (busy) window.setTimeout(tick, 100);
        else ticking = false;
    };
    const run = () => {
        if (ticking) return;
        ticking = true;
        tick();
    };
    return {
        /** Set how strongly each loop should play (0 silent .. 1 full); it eases there. */
        set(levels: Partial<Record<AmbientKind, number>>): void {
            let changed = false;
            for (const k of Object.keys(levels) as AmbientKind[]) {
                const v = Math.max(0, Math.min(1, levels[k] ?? 0));
                if (want[k] !== v) {
                    want[k] = v;
                    changed = true;
                }
            }
            if (changed) run();
        },
        /** A touch, a settings change, or coming back into view: start what should play. */
        kick(): void {
            for (const k of Object.keys(els) as AmbientKind[]) {
                const el = els[k]!;
                if (now[k] > 0.001 && el.paused && !silent()) void el.play().catch(() => {});
            }
            run();
        },
        /** Everything to silence (leaving the world). */
        clear(): void {
            this.set({ breeze: 0, rain: 0, fire: 0 });
        },
    };
})();

/** Rain, from the weather (kept for the scene's use; the climate pack's rain loop plays it). */
export function rainLevel(level: number): void {
    ambience.set({ rain: level });
}

// The dev server swapping this module: its climate loops fade away too.
if (import.meta.hot) import.meta.hot.dispose(() => ambience.clear());
