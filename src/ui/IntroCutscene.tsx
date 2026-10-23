/**
 * The cinematic intro, shown on New Game: eight illustrated scenes (ui/cutscene/Scenes.tsx)
 * told by an old storyteller (game/narration.ts, voice files in public/voice), framed with
 * letterbox bars, film grain and a vignette, crossfading from shot to shot, and closing on
 * the MEH FIGHTER title card. Each scene lasts as long as its voice line (or a storyteller's
 * pace when there is no voice file), so it runs about a minute and a half.
 *
 * Sound: only the storyteller's voice and the cutscene's own music underneath (dipping a little
 * while he speaks). No effects or climate sounds.
 * Tap or Space: next scene. Skip (or Esc): straight to choosing a kingdom.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { progress } from '../game/progress.ts';
import { ambience, music } from '../game/audio.ts';
import { estimateSeconds, NARRATION } from '../game/narration.ts';
import { store } from '../state/store.ts';
import { settings } from '../game/settings.ts';
import { CHAPTER, SCENES } from './cutscene/Scenes.tsx';
import { PixelLogo } from './PixelLogo.tsx';

const SERIF = 'var(--font-pixel)';
const FADE = 1.2;
/** Gap after the narrator finishes before the next shot. */
const TAIL = 1.4;
const TITLE_SECONDS = 4.6;
/** The letterbox: the picture lives between the bars (never under them), so no scene is cut. */
const BAR_TOP = '9vh';
const BAR_BOTTOM = '15vh';

/** Grain that shimmers over the picture (an SVG noise tile). */
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity="0.9"/></svg>')}")`;

export default function IntroCutscene() {
    const [index, setIndex] = useState(0);
    const [prev, setPrev] = useState<number | null>(null);
    const [dur, setDur] = useState(() => estimateSeconds(NARRATION[0]));
    const [speaking, setSpeaking] = useState(0); // seconds of the current voice line (0 = no voice)
    const voices = useRef<(HTMLAudioElement | null)[]>([]);
    /** Each scene's length, kept so a scene fading out keeps its own timing. */
    const lengths = useRef<number[]>([]);
    const timers = useRef<number[]>([]);
    const done = useRef(false);
    const title = index >= NARRATION.length;

    // Load every voice line up front (a missing file just means no voice for it).
    useEffect(() => {
        voices.current = NARRATION.map((line) => {
            try {
                const el = new Audio(`voice/${line.file}`);
                el.preload = 'auto';
                el.addEventListener('error', () => { el.dataset.missing = '1'; });
                return el;
            } catch {
                return null;
            }
        });
        return () => {
            for (const el of voices.current) el?.pause();
        };
    }, []);

    const clearTimers = () => {
        for (const t of timers.current) window.clearTimeout(t);
        timers.current = [];
    };

    const finish = useCallback(() => {
        if (done.current) return;
        done.current = true;
        clearTimers();
        for (const el of voices.current) el?.pause();
        music.duck(1);
        ambience.clear();
        progress.markIntroSeen();
        store.patch({ phase: 'kingdom' });
    }, []);

    const next = useCallback(() => {
        setPrev(index);
        setIndex((i) => i + 1);
    }, [index]);

    // Start a scene: its voice, its length, its climate and its cues.
    useEffect(() => {
        clearTimers();
        for (const el of voices.current) el?.pause();
        if (prev !== null) timers.current.push(window.setTimeout(() => setPrev(null), FADE * 1000 + 100));
        if (title) {
            music.duck(1);
            timers.current.push(window.setTimeout(finish, TITLE_SECONDS * 1000));
            return clearTimers;
        }
        const line = NARRATION[index];
        // Nothing from the world may sound under the story (a loop left over from a game, say).
        ambience.clear();
        const el = voices.current[index];
        // A scene left early (or set up twice by React in development) must not start its voice later.
        let live = true;
        const begin = (voiceSec: number) => {
            if (!live) return;
            const d = voiceSec > 0 ? Math.max(voiceSec + TAIL, 5) : estimateSeconds(line);
            lengths.current[index] = d;
            setDur(d);
            setSpeaking(voiceSec);
            if (voiceSec > 0 && el) {
                el.currentTime = 0;
                // The narrator follows the sound settings, sitting a little above the music (about 7 dB at the
                // default volumes): the music only dips under the voice, it never vanishes.
                const st = settings.get();
                el.volume = st.sound ? Math.min(1, 0.4 + 0.55 * st.volume) : 0;
                music.duck(0.6);
                void el.play().catch(() => {});
                el.onended = () => music.duck(1);
            } else music.duck(1);
            timers.current.push(window.setTimeout(() => {
                setPrev(index);
                setIndex(index + 1);
            }, d * 1000));
        };
        // Wait (briefly) for the voice file to say how long it is.
        if (el && !el.dataset.missing) {
            if (Number.isFinite(el.duration) && el.duration > 0) begin(el.duration);
            else {
                let started = false;
                const go = (sec: number) => {
                    if (started) return;
                    started = true;
                    begin(sec);
                };
                el.addEventListener('loadedmetadata', () => go(Number.isFinite(el.duration) ? el.duration : 0), { once: true });
                el.addEventListener('error', () => go(0), { once: true });
                timers.current.push(window.setTimeout(() => go(0), 1500));
            }
        } else begin(0);
        return () => {
            live = false;
            clearTimers();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index]);

    useEffect(() => {
        const on = (e: KeyboardEvent) => {
            if (e.key === 'Escape') finish();
            else if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (title) finish();
                else next();
            }
        };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    }, [finish, next, title]);
    useEffect(() => () => {
        clearTimers();
        music.duck(1);
    }, []);

    // Words appear one by one across the narrator's line.
    const words = useMemo(() => (title ? [] : NARRATION[index].subtitle.split(' ')), [index, title]);
    const span = (speaking > 0 ? speaking : dur - TAIL) * 0.92;

    const scene = (i: number, out: boolean) => {
        const S = SCENES[NARRATION[i].scene];
        const style: CSSProperties = { animation: `${out ? 'cs-scene-out' : 'cs-scene-in'} ${FADE}s ease-in-out both` };
        return (
            // Same key while fading in and out, so the scene's own motion carries on through the crossfade.
            <div key={`scene-${i}`} className="absolute inset-0" style={style}>
                <S d={lengths.current[i] ?? dur} />
            </div>
        );
    };

    return (
        <div className="absolute inset-0 overflow-hidden bg-black" data-quiet onPointerDown={() => (title ? finish() : next())}>
            {/* the picture, framed by the bars */}
            <div className="absolute inset-x-0 overflow-hidden" style={{ top: BAR_TOP, bottom: BAR_BOTTOM }}>
                {prev !== null && prev < NARRATION.length && scene(prev, true)}
                {!title && scene(index, false)}
                {title && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: '#030806', animation: `cs-scene-in ${FADE}s ease-in-out both` }}>
                        <div style={{ width: 'min(900px, 74vw, 160vh)' }}>
                            <PixelLogo intro />
                        </div>
                        <div className="-mt-[2vh] text-[min(15px,2.6vh)] uppercase tracking-[0.5em] text-[#f3e3c0]" style={{ animation: 'cs-fade-up 1.2s ease-out 2.4s both' }}>The Fracture of Eidolon</div>
                    </div>
                )}
            </div>
            {/* film: vignette (over the picture) and grain */}
            <div className="pointer-events-none absolute inset-x-0" style={{ top: BAR_TOP, bottom: BAR_BOTTOM, background: 'radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0,0,0,.45) 100%)' }} />
            <div className="pointer-events-none absolute -inset-[10%] opacity-[0.07] mix-blend-overlay" style={{ backgroundImage: GRAIN, animation: 'cs-grain 0.6s steps(3) infinite' }} />
            {/* letterbox */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-black px-6" style={{ height: BAR_TOP, animation: 'cs-letterbox-top 1.2s ease-out both' }}>
                <span key={`c${index}`} className="text-[min(13px,2.2vh)] font-semibold uppercase tracking-[0.35em] text-[#c9b8e8]" style={{ fontFamily: 'var(--font-pixel)', animation: 'cs-fade-up 1.2s ease-out .4s both' }}>
                    {title ? '' : CHAPTER[NARRATION[index].scene]}
                </span>
                <span className="flex gap-1.5">
                    {NARRATION.map((_, n) => <span key={n} className="h-1 w-5 rounded-full" style={{ background: n < index ? '#ffd98a' : n === index ? '#fff3c4' : 'rgba(255,255,255,.2)' }} />)}
                </span>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-black px-8" style={{ height: BAR_BOTTOM, animation: 'cs-letterbox-bottom 1.2s ease-out both' }}>
                {!title && (
                    <p key={`s${index}`} className="max-w-[min(1000px,92vw)] text-center text-[min(21px,3.4vh)] leading-snug text-[#f3eefb]" style={{ fontFamily: SERIF, textShadow: '0 2px 8px #000' }}>
                        {words.map((w, n) => (
                            <span key={n} className="inline-block" style={{ animation: 'cs-word .5s ease-out both', animationDelay: `${0.3 + (n / Math.max(1, words.length)) * span}s`, marginRight: '0.28em' }}>{w}</span>
                        ))}
                    </p>
                )}
            </div>
            <button
                type="button"
                onPointerDown={(e) => {
                    e.stopPropagation();
                    finish();
                }}
                className="absolute right-6 rounded-sm px-4 py-1 text-[12px] font-semibold tracking-wider text-white/85 hover:bg-white/10"
                style={{ top: `calc(${BAR_TOP} + 12px)`, border: '1px solid rgba(255,255,255,.5)', background: 'rgba(0,0,0,.35)' }}
            >
                SKIP ›
            </button>
            <div className="pointer-events-none absolute left-6 text-[10px] font-semibold tracking-[0.3em] text-white/40" style={{ top: `calc(${BAR_TOP} + 18px)` }}>TAP FOR THE NEXT SCENE</div>
        </div>
    );
}
