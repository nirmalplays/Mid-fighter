/**
 * The prologue, shown on New Game: thirteen illustrated scenes (ui/cutscene/Scenes.tsx) telling the
 * story of Eidolon (game/narration.ts): the storyteller, and in their own voices Malakor, a commander
 * on the line, the quarrelling king and queen, and Lyra. Framed with letterbox bars, film grain and a
 * vignette, crossfading from scene to scene, closing on the title card.
 *
 * A scene holds one or more lines and lasts as long as they do: every line waits for its recording to
 * finish (they go through the one voice channel, game/voice.ts, so no two ever overlap), with a breath
 * between lines and a longer one between scenes. Subtitles name whoever speaks.
 * Tap, Space or Enter: the next line. Skip (or Esc): straight into the dig.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { progress } from '../game/progress.ts';
import { beginStory } from '../game/story/begin.ts';
import { ambience, music } from '../game/audio.ts';
import { voice } from '../game/voice.ts';
import { estimateSeconds, NARRATION, SPEAKER_COLOR } from '../game/narration.ts';
import { CHAPTER, SCENES } from './cutscene/Scenes.tsx';
import { PixelLogo } from './PixelLogo.tsx';

const SERIF = 'var(--font-pixel)';
const FADE = 1.2;
/** Breath after a line before the next in the same scene, and before a new scene (seconds). */
const GAP_LINE = 0.55;
const GAP_SCENE = 1.3;
const TITLE_SECONDS = 5.2;
/** The letterbox: the picture lives between the bars (never under them), so no scene is cut. */
const BAR_TOP = '9vh';
const BAR_BOTTOM = '15vh';

/** Grain that shimmers over the picture (an SVG noise tile). */
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity="0.9"/></svg>')}")`;

/** The scenes in order, each with the lines it holds (consecutive lines of the same scene). */
const RUNS: { scene: (typeof NARRATION)[number]['scene']; lines: number[] }[] = [];
NARRATION.forEach((l, n) => {
    const last = RUNS[RUNS.length - 1];
    if (last && last.scene === l.scene) last.lines.push(n);
    else RUNS.push({ scene: l.scene, lines: [n] });
});
const RUN_OF = NARRATION.map((_, n) => RUNS.findIndex((r) => r.lines.includes(n)));

/** How long a line holds the screen (its recording, or a storyteller's pace without one), with its breath after. */
function lineSeconds(n: number): number {
    const l = NARRATION[n];
    const len = voice.length(l.file);
    const said = len !== null ? len / 1000 : estimateSeconds(l);
    const sameScene = NARRATION[n + 1]?.scene === l.scene;
    return said + (sameScene ? GAP_LINE : GAP_SCENE);
}

export default function IntroCutscene() {
    const [line, setLine] = useState(-1);
    const [prevRun, setPrevRun] = useState<number | null>(null);
    const lengths = useRef<number[]>([]);
    const timers = useRef<number[]>([]);
    const done = useRef(false);
    const title = line >= NARRATION.length;
    const run = line >= 0 && !title ? RUN_OF[line] : -1;

    const clearTimers = () => {
        for (const t of timers.current) window.clearTimeout(t);
        timers.current = [];
    };

    const finish = useCallback(() => {
        if (done.current) return;
        done.current = true;
        clearTimers();
        voice.stop();
        music.duck(1);
        ambience.clear();
        // The story always begins in Pyraxis: straight from the prologue into the dig.
        progress.markIntroSeen();
        beginStory();
    }, []);

    // Load every line first (so their lengths are known), briefly; then begin.
    useEffect(() => {
        voice.preload(NARRATION.map((l) => l.file));
        music.set('cutscene');
        const t0 = performance.now();
        const wait = window.setInterval(() => {
            const all = NARRATION.every((l) => voice.length(l.file) !== null);
            if (all || performance.now() - t0 > 3500) {
                window.clearInterval(wait);
                setLine((n) => (n < 0 ? 0 : n));
            }
        }, 120);
        return () => {
            window.clearInterval(wait);
            clearTimers();
            voice.stop();
            music.duck(1);
        };
    }, []);

    const next = useCallback(() => {
        if (line < 0) return;
        setLine((n) => n + 1);
    }, [line]);

    // Start a line: its voice, how long it holds, and (on a new scene) the scene's own length.
    useEffect(() => {
        if (line < 0) return;
        clearTimers();
        if (title) {
            voice.stop();
            setPrevRun(RUNS.length - 1);
            timers.current.push(window.setTimeout(() => setPrevRun(null), FADE * 1000 + 100));
            timers.current.push(window.setTimeout(finish, TITLE_SECONDS * 1000));
            return clearTimers;
        }
        const r = RUN_OF[line];
        // A new scene: it lasts as long as all its lines (its paintings time their moments to it).
        if (RUNS[r].lines[0] === line) {
            lengths.current[r] = RUNS[r].lines.reduce((s, n) => s + lineSeconds(n), 0);
            if (r > 0) {
                setPrevRun(r - 1);
                timers.current.push(window.setTimeout(() => setPrevRun(null), FADE * 1000 + 100));
            }
        }
        // Nothing from the world may sound under the story.
        ambience.clear();
        voice.play(NARRATION[line].file);
        timers.current.push(window.setTimeout(() => setLine((n) => (n === line ? n + 1 : n)), lineSeconds(line) * 1000));
        return clearTimers;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [line]);

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

    // Words appear one by one across the line as it is spoken.
    const cur = line >= 0 && !title ? NARRATION[line] : null;
    const words = useMemo(() => (cur ? cur.subtitle.split(' ') : []), [cur]);
    const span = cur ? Math.max(1, (voice.length(cur.file) ?? estimateSeconds(cur) * 1000) / 1000) * 0.9 : 1;

    const scene = (r: number, out: boolean) => {
        const S = SCENES[RUNS[r].scene];
        const style: CSSProperties = { animation: `${out ? 'cs-scene-out' : 'cs-scene-in'} ${FADE}s ease-in-out both` };
        return (
            // Same key while fading in and out, so the scene's own motion carries on through the crossfade.
            <div key={`scene-${r}`} className="absolute inset-0" style={style}>
                <S d={lengths.current[r] ?? 10} />
            </div>
        );
    };

    return (
        <div className="absolute inset-0 overflow-hidden bg-black" data-quiet onPointerDown={() => (title ? finish() : next())}>
            {/* the picture, framed by the bars */}
            <div className="absolute inset-x-0 overflow-hidden" style={{ top: BAR_TOP, bottom: BAR_BOTTOM }}>
                {prevRun !== null && prevRun !== run && scene(prevRun, true)}
                {run >= 0 && scene(run, false)}
                {title && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: '#030806', animation: `cs-scene-in ${FADE}s ease-in-out both` }}>
                        <div style={{ width: 'min(900px, 74vw, 160vh)' }}>
                            <PixelLogo intro />
                        </div>
                        <div className="-mt-[2vh] text-[min(15px,2.6vh)] uppercase tracking-[0.5em] text-[#f3e3c0]" style={{ animation: 'cs-fade-up 1.2s ease-out 2.4s both' }}>The Weaver of Unwritten Ashes</div>
                    </div>
                )}
            </div>
            {/* film: vignette (over the picture) and grain */}
            <div className="pointer-events-none absolute inset-x-0" style={{ top: BAR_TOP, bottom: BAR_BOTTOM, background: 'radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0,0,0,.45) 100%)' }} />
            <div className="pointer-events-none absolute -inset-[10%] opacity-[0.07] mix-blend-overlay" style={{ backgroundImage: GRAIN, animation: 'cs-grain 0.6s steps(3) infinite' }} />
            {/* letterbox: the chapter, and how far through the story */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-black px-6" style={{ height: BAR_TOP, animation: 'cs-letterbox-top 1.2s ease-out both' }}>
                <span key={`c${run}`} className="text-[min(13px,2.2vh)] font-semibold uppercase tracking-[0.35em] text-[#c9b8e8]" style={{ fontFamily: 'var(--font-pixel)', animation: 'cs-fade-up 1.2s ease-out .4s both' }}>
                    {run >= 0 ? CHAPTER[RUNS[run].scene] : ''}
                </span>
                <span className="flex gap-1.5">
                    {RUNS.map((_, n) => <span key={n} className="h-1 w-4 rounded-full" style={{ background: title || n < run ? '#ffd98a' : n === run ? '#fff3c4' : 'rgba(255,255,255,.2)' }} />)}
                </span>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center justify-center bg-black px-8" style={{ height: BAR_BOTTOM, animation: 'cs-letterbox-bottom 1.2s ease-out both' }}>
                {cur && cur.speaker !== 'Narrator' && (
                    <div key={`n${line}`} className="mb-1 text-[min(14px,2.4vh)] font-bold uppercase tracking-[0.3em]" style={{ color: SPEAKER_COLOR[cur.speaker], fontFamily: 'var(--font-pixel)', animation: 'cs-fade-up .4s ease-out both' }}>{cur.speaker}</div>
                )}
                {cur && (
                    <p key={`s${line}`} className="max-w-[min(1000px,92vw)] text-center text-[min(21px,3.4vh)] leading-snug" style={{ fontFamily: SERIF, textShadow: '0 2px 8px #000', color: SPEAKER_COLOR[cur.speaker], fontStyle: cur.speaker === 'Narrator' ? undefined : 'italic' }}>
                        {words.map((w, n) => (
                            <span key={n} className="inline-block" style={{ animation: 'cs-word .5s ease-out both', animationDelay: `${0.15 + (n / Math.max(1, words.length)) * span}s`, marginRight: '0.28em' }}>{w}</span>
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
            <div className="pointer-events-none absolute left-6 text-[10px] font-semibold tracking-[0.3em] text-white/40" style={{ top: `calc(${BAR_TOP} + 18px)` }}>TAP FOR THE NEXT LINE</div>
        </div>
    );
}
