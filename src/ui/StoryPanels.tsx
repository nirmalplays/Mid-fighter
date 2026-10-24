/**
 * The story's own screens (Land 1): the eight puzzles (each a small, self-contained pixel panel
 * that reports back to the quest when solved), and the story's HUD: siege and defence timers, the
 * Memory Spire's health, the finishing blow's beat, the Resonant Hymn button, and the Amnesia
 * Mist and sulfur fog over the screen.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { commands } from '../game/commands.ts';
import { sfx } from '../game/audio.ts';
import { quest } from '../game/story/quest.ts';
import { store, useStore, type PuzzleId } from '../state/store.ts';
import { Ico } from './icons.tsx';
import { KeyCap, PackButton, PxButton, PxPanel } from './px.tsx';
import { ALL_PUZZLES } from '../game/story/lands.ts';
import { DataPuzzle } from './StoryPuzzles.tsx';

// ------------------------------------------------------------------ tones (the chimes and the song)

let ctx: AudioContext | null = null;
export function tone(freq: number, ms = 600): void {
    try {
        ctx ??= new AudioContext();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + ms / 1000 + 0.05);
    } catch {
        /* no sound: the puzzle still works by sight */
    }
}

const GOLD = '#ffd98a';
/** Text on the light stone panels. */
const INKC = '#3a2414';

export function Frame({ title, hint, children, onLeave }: { title: string; hint: string; children: ReactNode; onLeave: () => void }) {
    return (
        <div className="pointer-events-auto absolute inset-0 z-[45] flex items-center justify-center" style={{ background: 'rgba(6,4,12,.72)' }}>
            <PxPanel frame={5} className="flex w-[min(520px,94vw)] flex-col gap-3 px-6 py-5" style={{ color: INKC }}>
                <div className="text-[30px] leading-none" style={{ fontFamily: 'var(--font-relic)', color: '#7a4a14' }}>{title}</div>
                <div className="text-[13px] leading-snug" style={{ color: INKC }}>{hint}</div>
                <div className="flex min-h-[200px] items-center justify-center">{children}</div>
                <div className="flex justify-end">
                    <PxButton variant="stone" onClick={onLeave}>Step back</PxButton>
                </div>
            </PxPanel>
        </div>
    );
}

/** A round pixel button for puzzle pieces. */
export function Piece({ on, color, size = 54, onPress, children, label }: { on?: boolean; color: string; size?: number; onPress: () => void; children?: ReactNode; label: string }) {
    return (
        <button
            type="button"
            aria-label={label}
            onPointerDown={(e) => { e.preventDefault(); onPress(); }}
            className="flex items-center justify-center text-[13px] font-black"
            style={{ width: size, height: size, background: on ? color : '#3a2f38', border: '3px solid #1a0c10', boxShadow: on ? `0 0 14px ${color}, inset 0 -4px 0 rgba(0,0,0,.3)` : 'inset 0 -4px 0 rgba(0,0,0,.4)', color: on ? '#1a0c10' : '#e8dcc0', imageRendering: 'pixelated' }}
        >
            {children}
        </button>
    );
}

/** The Threefold Seal: three rings; turning one turns the next one in as well. */
function Seal({ done }: { done: () => void }) {
    const [r, setR] = useState([5, 2, 6]);
    const turn = (n: number) => {
        sfx('click');
        const next = r.map((x, k) => (k === n || (k === n + 1 && n < 2) ? (x + 1) % 8 : x));
        setR(next);
        if (next.every((x) => x === 0)) done();
    };
    const size = [190, 136, 82];
    return (
        <div className="flex items-center gap-5">
            <div className="relative" style={{ width: 200, height: 200 }}>
                {r.map((x, n) => (
                    <button key={n} type="button" aria-label={`Ring ${n + 1}`} onPointerDown={(e) => { e.preventDefault(); turn(n); }}
                        className="absolute rounded-full" style={{ left: (200 - size[n]) / 2, top: (200 - size[n]) / 2, width: size[n], height: size[n], border: '10px solid', borderColor: x === 0 ? '#7dd3fc' : ['#8a8178', '#6e6560', '#5a524c'][n], background: n === 2 ? '#2a2026' : 'transparent', transform: `rotate(${x * 45}deg)`, transition: 'transform .18s steps(3)' }}>
                        <span className="absolute left-1/2 -translate-x-1/2" style={{ bottom: -12, width: 14, height: 14, background: '#ffd98a', border: '2px solid #1a0c10' }} />
                    </button>
                ))}
                <span className="absolute left-1/2 -translate-x-1/2" style={{ bottom: -26, width: 6, height: 18, background: '#c2843a' }} />
            </div>
            <div className="text-[12px] leading-snug" style={{ color: INKC, width: 130 }}>Every channel (gold notch) must point down at the copper conduit. Turning a ring turns the one inside it too.</div>
        </div>
    );
}

/** The geysers: weight three so the steam that reaches the basin is exactly 9. */
function Steam({ done }: { done: () => void }) {
    const P = [2, 4, 3, 5, 1];
    const [w, setW] = useState([false, false, false, false, false]);
    const sum = P.reduce((n, p, k) => n + (w[k] ? p : 0), 0);
    const count = w.filter(Boolean).length;
    const press = (k: number) => {
        sfx('click');
        const next = w.map((x, n) => (n === k ? !x : x));
        if (next.filter(Boolean).length > 3) return;
        setW(next);
        const s = P.reduce((n, p, j) => n + (next[j] ? p : 0), 0);
        if (next.filter(Boolean).length === 3 && s === 9) done();
    };
    return (
        <div className="flex flex-col items-center gap-3">
            <div className="flex gap-3">
                {P.map((p, k) => (
                    <Piece key={k} label={`Geyser ${k + 1}`} on={w[k]} color="#f0b070" onPress={() => press(k)}>{p}</Piece>
                ))}
            </div>
            <div className="text-[14px]" style={{ color: sum === 9 && count === 3 ? '#15803d' : INKC }}>Basin heat: {sum} / 9 · basalt {count} / 3</div>
        </div>
    );
}

/** Three chimes in the order on the nursery wall: low C, high G, middle E. */
function Chimes({ done }: { done: () => void }) {
    const NOTES = [{ n: 'C', f: 262, h: 70 }, { n: 'E', f: 330, h: 95 }, { n: 'G', f: 392, h: 120 }];
    const want = [0, 2, 1];
    const [got, setGot] = useState<number[]>([]);
    const hit = (k: number) => {
        tone(NOTES[k].f);
        const next = [...got, k];
        if (want[next.length - 1] !== k) { setGot([]); return; }
        setGot(next);
        if (next.length === want.length) done();
    };
    return (
        <div className="flex items-end gap-6">
            {NOTES.map((x, k) => (
                <button key={k} type="button" aria-label={`Chime ${x.n}`} onPointerDown={(e) => { e.preventDefault(); hit(k); }}
                    className="flex flex-col items-center justify-end" style={{ width: 46, height: x.h + 30 }}>
                    <span style={{ width: 20, height: x.h, background: 'linear-gradient(90deg, #a87a3a, #e0b060, #a87a3a)', border: '3px solid #1a0c10' }} />
                    <span className="mt-1 text-[14px]" style={{ color: INKC }}>{x.n}</span>
                </button>
            ))}
            <div className="ml-2 flex gap-1">{want.map((_, n) => <span key={n} style={{ width: 12, height: 12, background: n < got.length ? '#86efac' : '#3a2f38', border: '2px solid #1a0c10' }} />)}</div>
        </div>
    );
}

/** Four obsidian shields bounce the sunbeam on: each must be turned right before the beam goes further. */
function Mirror({ done }: { done: () => void }) {
    const want = [1, 3, 0, 2];
    const [m, setM] = useState([0, 0, 0, 0]);
    let reach = 0;
    while (reach < 4 && m[reach] === want[reach]) reach++;
    const turn = (k: number) => {
        sfx('click');
        const next = m.map((x, n) => (n === k ? (x + 1) % 4 : x));
        setM(next);
        if (next.every((x, n) => x === want[n])) done();
    };
    return (
        <div className="flex items-center gap-2">
            <span style={{ width: 22, height: 22, background: '#fde68a', boxShadow: '0 0 16px #fde68a' }} />
            {m.map((x, k) => (
                <div key={k} className="flex items-center gap-2">
                    <span style={{ width: 30, height: 4, background: k <= reach ? '#fde68a' : '#3a2f38', boxShadow: k <= reach ? '0 0 8px #fde68a' : 'none' }} />
                    <Piece label={`Shield ${k + 1}`} on={k < reach} color="#fde68a" size={48} onPress={() => turn(k)}>
                        <span style={{ display: 'inline-block', width: 28, height: 6, background: '#1a1018', transform: `rotate(${x * 45}deg)` }} />
                    </Piece>
                </div>
            ))}
            <span style={{ width: 30, height: 4, background: reach >= 4 ? '#fde68a' : '#3a2f38' }} />
            <span style={{ width: 28, height: 28, background: reach >= 4 ? '#fde68a' : '#4a4450', border: '3px solid #1a0c10' }} />
        </div>
    );
}

/** Three gears: each pair meshes when their teeth add up to a full turn. */
function Gears({ done }: { done: () => void }) {
    const [g, setG] = useState([2, 1, 4]);
    const mesh = (a: number, b: number) => (a + b) % 6 === 0;
    const turn = (k: number) => {
        sfx('click');
        const next = g.map((x, n) => (n === k ? (x + 1) % 6 : x));
        setG(next);
        if (mesh(next[0], next[1]) && mesh(next[1], next[2])) done();
    };
    return (
        <div className="flex items-center gap-1">
            {g.map((x, k) => (
                <div key={k} className="flex items-center gap-1">
                    {k > 0 && <span style={{ width: 14, height: 14, background: mesh(g[k - 1], x) ? '#86efac' : '#f87171', border: '2px solid #1a0c10' }} />}
                    <button type="button" aria-label={`Gear ${k + 1}`} onPointerDown={(e) => { e.preventDefault(); turn(k); }}
                        style={{ width: 84, height: 84, borderRadius: '50%', border: '10px dashed #b08a4a', background: '#3a2f38', transform: `rotate(${x * 60}deg)`, transition: 'transform .2s steps(3)' }}>
                        <span className="block text-[16px]" style={{ color: GOLD, transform: `rotate(${-x * 60}deg)` }}>{x}</span>
                    </button>
                </div>
            ))}
        </div>
    );
}

/** The Architect's Scale: the golden keystone weighs 9; balance it with pumice (1), basalt (3) and obsidian (5). */
function Scale({ done }: { done: () => void }) {
    const STONES = [{ n: 'Pumice', w: 1, c: '#d6d3d1' }, { n: 'Pumice', w: 1, c: '#d6d3d1' }, { n: 'Basalt', w: 3, c: '#57534e' }, { n: 'Basalt', w: 3, c: '#57534e' }, { n: 'Obsidian', w: 5, c: '#1e1b2e' }];
    const [on, setOn] = useState(STONES.map(() => false));
    const sum = STONES.reduce((n, s, k) => n + (on[k] ? s.w : 0), 0);
    const tilt = Math.max(-12, Math.min(12, (9 - sum) * 3));
    const press = (k: number) => {
        sfx('click');
        const next = on.map((x, n) => (n === k ? !x : x));
        setOn(next);
        if (STONES.reduce((n, s, j) => n + (next[j] ? s.w : 0), 0) === 9) done();
    };
    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative" style={{ width: 300, height: 90 }}>
                <div className="absolute left-1/2 top-2 -translate-x-1/2" style={{ width: 260, height: 6, background: '#d4b06a', transform: `rotate(${-tilt}deg)`, transition: 'transform .25s steps(4)' }}>
                    <span className="absolute -left-2 top-2 text-[12px]" style={{ color: INKC }}>Keystone 9</span>
                    <span className="absolute -right-2 top-2 text-[12px]" style={{ color: INKC }}>{sum}</span>
                </div>
                <span className="absolute left-1/2 top-2 -translate-x-1/2" style={{ width: 10, height: 80, background: '#7a5230' }} />
            </div>
            <div className="flex gap-2">
                {STONES.map((s, k) => (
                    <Piece key={k} label={`${s.n} ${s.w}`} on={on[k]} color={GOLD} size={52} onPress={() => press(k)}>
                        <span className="flex flex-col items-center"><span style={{ width: 18, height: 14, background: s.c, border: '2px solid #1a0c10' }} />{s.w}</span>
                    </Piece>
                ))}
            </div>
        </div>
    );
}

/** The Word-Lock: turn each tablet's prism until its star matches the fresco (turning one nudges the next). */
function Prism({ done }: { done: () => void }) {
    const want = [2, 5, 1];
    const [p, setP] = useState([0, 0, 0]);
    const turn = (k: number) => {
        sfx('click');
        const next = p.map((x, n) => (n === k || (n === k + 1 && k < 2) ? (x + 1) % 6 : x));
        setP(next);
        if (next.every((x, n) => x === want[n])) done();
    };
    const star = (x: number) => ({ left: 20 + x * 34, top: 10 });
    return (
        <div className="flex flex-col items-center gap-3">
            {want.map((w, k) => (
                <div key={k} className="flex items-center gap-3">
                    <div className="relative" style={{ width: 230, height: 30, background: '#1a1430', border: '2px solid #4c3a6a' }}>
                        <span className="absolute" style={{ ...star(w), width: 10, height: 10, border: '2px solid #a78bfa' }} />
                        <span className="absolute" style={{ ...star(p[k]), width: 10, height: 10, background: p[k] === w ? '#fde68a' : '#7dd3fc', boxShadow: p[k] === w ? '0 0 10px #fde68a' : 'none' }} />
                    </div>
                    <Piece label={`Prism ${k + 1}`} on={p[k] === w} color="#fde68a" size={40} onPress={() => turn(k)}>{['I', 'II', 'III'][k]}</Piece>
                </div>
            ))}
        </div>
    );
}

/** The Solstice Gate: strike the four elemental chimes in the order of Lyra's song (the notes are on the lintel). */
function Song({ done }: { done: () => void }) {
    const CH = [{ n: 'Fire', c: '#ff6a3d', f: 440 }, { n: 'Air', c: '#7dd3fc', f: 392 }, { n: 'Water', c: '#60a5fa', f: 294 }, { n: 'Earth', c: '#a3e635', f: 220 }];
    // Her grandmother's melody: low, middle-low, high, middle-high.
    const want = [3, 2, 0, 1];
    const [got, setGot] = useState<number[]>([]);
    const hit = (k: number) => {
        tone(CH[k].f, 700);
        const next = [...got, k];
        if (want[next.length - 1] !== k) { setGot([]); return; }
        setGot(next);
        if (next.length === 4) done();
    };
    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative" style={{ width: 220, height: 70, background: '#2a2026', border: '2px solid #5a4a3a' }}>
                {[0, 1, 2, 3].map((n) => <span key={n} className="absolute inset-x-2" style={{ top: 12 + n * 14, height: 1, background: '#6a5a4a' }} />)}
                {want.map((k, n) => <span key={n} className="absolute" style={{ left: 24 + n * 48, top: 52 - (CH[k].f - 200) / 5, width: 14, height: 10, borderRadius: '50%', background: n < got.length ? '#86efac' : '#e8dcc0' }} />)}
            </div>
            <div className="flex gap-3">
                {CH.map((x, k) => (
                    <Piece key={k} label={`${x.n} chime`} on color={x.c} size={58} onPress={() => hit(k)}>{x.n}</Piece>
                ))}
            </div>
        </div>
    );
}

const PUZZLES: Record<PuzzleId, { title: string; hint: string; C: (p: { done: () => void }) => ReactNode }> = {
    seal: { title: 'The Threefold Seal', hint: 'Copper conduits wait below the Memory Spire. Turn the three stone rings until every channel meets them.', C: Seal },
    steam: { title: 'The Hot Springs', hint: 'Weight three of the five geysers with basalt to force their steam into the dry basin. The lotus needs a heat of exactly 9.', C: Steam },
    chimes: { title: 'The Acoustic Lock', hint: 'Faded paint on the nursery wall: three chimes, struck low, then high, then middle.', C: Chimes },
    mirror: { title: 'The Mirror-Beam', hint: 'A shaft of sunlight falls through the ceiling. Turn each obsidian shield until the beam carries on to the next, and on to the sarcophagus.', C: Mirror },
    gears: { title: 'Siphon Alpha', hint: 'The counterweight is free. Turn the gears until every pair of teeth meshes (the lights turn green).', C: Gears },
    scale: { title: "The Architect's Scale", hint: 'The golden keystone weighs 9. Balance it with pumice (1), basalt (3) and obsidian (5).', C: Scale },
    prism: { title: 'The Runic Word-Lock', hint: 'Set the three Solstice Tablets. Turn their prisms until each projected star sits on its fresco star. Turning one nudges the next.', C: Prism },
    song: { title: 'The Solstice Gate', hint: "Lyra's grandmother's song is carved over the gate. Strike the four elemental chimes in its order, the lowest note first.", C: Song },
};

/** The open puzzle (store.puzzle), if any. */
export function PuzzlePanel() {
    const open = useStore((s) => s.puzzle);
    if (!open) return null;
    const leave = () => store.patch({ puzzle: null });
    const done = () => {
        if (!store.get().puzzle) return;
        sfx('chapter');
        store.patch({ puzzle: null });
        quest.on({ type: 'puzzle', puzzle: open.id });
    };
    const p = PUZZLES[open.id];
    if (!p) {
        const def = ALL_PUZZLES[open.id];
        if (!def || def.kind === 'debate') return null;
        return (
            <Frame title={def.title} hint={def.hint} onLeave={leave}>
                <DataPuzzle key={open.id} def={def} done={done} />
            </Frame>
        );
    }
    const C = p.C;
    return (
        <Frame title={p.title} hint={p.hint} onLeave={leave}>
            <C key={open.id} done={done} />
        </Frame>
    );
}

// ------------------------------------------------------------------ the story HUD

/** Timers, the Spire's health, the finishing beat, the Hymn button, and the Mist and the sulfur over the screen. */
export function StoryHud() {
    const saga = useStore((s) => s.saga);
    const phase = useStore((s) => s.phase);
    const [, tick] = useState(0);
    const raf = useRef(0);
    // The beat ring animates between store updates.
    useEffect(() => {
        if (!saga.qte) return;
        const loop = () => { tick((n) => n + 1); raf.current = requestAnimationFrame(loop); };
        raf.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf.current);
    }, [saga.qte]);
    if (phase !== 'playing') return null;
    return (
        <>
            {saga.mist > 0 && (
                <div className="pointer-events-none absolute inset-0 z-[4]" style={{ background: `radial-gradient(ellipse at center, rgba(235,238,245,${saga.mist * 0.15}) 20%, rgba(235,238,245,${0.25 + saga.mist * 0.6}) 85%)`, animation: 'mist-breathe 4s ease-in-out infinite' }} />
            )}
            {saga.sulfur && <div className="pointer-events-none absolute inset-0 z-[4]" style={{ background: 'radial-gradient(ellipse at center, rgba(200,220,60,.08) 30%, rgba(170,190,30,.45) 95%)' }} />}
            {(saga.timer || saga.spire) && (
                <div className="pointer-events-none absolute left-1/2 z-[6] flex -translate-x-1/2 flex-col items-center gap-1" style={{ top: 92 }} data-quiet>
                    {saga.timer && (
                        <PxPanel frame={5} className="flex items-center gap-2 px-4 py-1.5" style={{ color: INKC }}>
                            <Ico name="hourglass" size={14} color="#7a4a14" />
                            <span className="text-[18px] leading-none" style={{ fontFamily: 'var(--font-relic)' }}>{saga.timer.label}</span>
                            {saga.timer.left > 0 && <span className="text-[16px] tabular-nums">{Math.floor(saga.timer.left / 60)}:{String(saga.timer.left % 60).padStart(2, '0')}</span>}
                        </PxPanel>
                    )}
                    {saga.spire && (
                        <span className="flex items-center gap-1.5 text-[12px] font-black text-[#bae6fd]" style={{ textShadow: '0 1px 2px #000' }}>
                            Memory Spire
                            <span className="relative h-[8px] w-36 overflow-hidden" style={{ background: 'rgba(0,0,0,.6)', outline: '2px solid #1a0c10' }}>
                                <span className="absolute inset-y-0 left-0" style={{ width: `${(saga.spire.hp / saga.spire.max) * 100}%`, background: saga.spire.hp < saga.spire.max * 0.3 ? '#f87171' : '#7dd3fc' }} />
                            </span>
                        </span>
                    )}
                </div>
            )}
            {saga.qte && <Beat hit={saga.qte.hit} need={saga.qte.need} label={saga.qte.label} />}
            {saga.dark && <div className="pointer-events-none absolute inset-0 z-[4]" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,.2) 8%, rgba(0,4,12,.94) 32%)' }} />}
            {saga.frost > 0 && <div className="pointer-events-none absolute inset-0 z-[4]" style={{ boxShadow: `inset 0 0 ${60 + saga.frost * 120}px rgba(186,230,253,${0.25 + saga.frost * 0.5})` }} />}
            {saga.surge && <Surge key={saga.surge.id} line={saga.surge.line} />}
            {saga.invert && <div className="pointer-events-none absolute left-1/2 top-[30%] z-[6] -translate-x-1/2 text-[15px] font-black text-[#5eead4]" style={{ textShadow: '0 1px 3px #000' }}>Your senses are twisted · ring the Hymn (R)</div>}
            {saga.frost > 0.05 && (
                <div className="pointer-events-none absolute left-1/2 z-[6] flex -translate-x-1/2 items-center gap-1.5 text-[12px] font-black text-[#bae6fd]" style={{ bottom: 168, textShadow: '0 1px 2px #000' }}>
                    Frostbite
                    <span className="relative h-[7px] w-28 overflow-hidden" style={{ background: 'rgba(0,0,0,.6)', outline: '2px solid #1a0c10' }}>
                        <span className="absolute inset-y-0 left-0" style={{ width: `${saga.frost * 100}%`, background: saga.frost >= 1 ? '#f87171' : '#bae6fd' }} />
                    </span>
                </div>
            )}
            {saga.zones && (
                <div className="pointer-events-none absolute left-1/2 z-[6] flex -translate-x-1/2 flex-col items-center gap-0.5" style={{ top: 132 }}>
                    <span className="flex gap-1">{['Left limb', 'Right limb', 'Torso cage', 'Core anchor'].map((z, n) => <span key={z} title={z} style={{ width: 22, height: 8, background: n < saga.zones!.broken ? '#f59e0b' : 'rgba(0,0,0,.55)', outline: '2px solid #1a0c10' }} />)}</span>
                    {saga.zones.mount && <span className="flex items-center gap-1 text-[13px] font-black text-[#fde68a]" style={{ textShadow: '0 1px 3px #000' }}>Staggered! <KeyCap>F</KeyCap> Grapple-mount</span>}
                </div>
            )}
            {saga.wedges > 0 && (
                <div className="pointer-events-none absolute z-[6] flex items-center gap-1 text-[12px] font-black text-[#fde68a]" style={{ left: 16, bottom: 120, textShadow: '0 1px 2px #000' }}>Wedges planted {saga.wedges}/3 · <KeyCap>E</KeyCap> detonate</div>
            )}
            {saga.carrying && (
                <div className="pointer-events-none absolute left-1/2 z-[6] -translate-x-1/2 text-[13px] font-black text-[#bae6fd]" style={{ bottom: 150, textShadow: '0 1px 3px #000' }}>Carrying Lyra · you move slower</div>
            )}
            {saga.companion !== null && (
                <div className="pointer-events-auto absolute z-[7] flex flex-col items-center gap-0.5" style={{ right: 250, bottom: 214 }}>
                    <PackButton variant="stone" size={50} label="Lyra's synergy" dim={saga.companion > 0} glow={saga.companion === 0 ? '#5eead4' : undefined} onPress={() => commands.emit({ type: 'skill' })}>
                        {saga.companion > 0 ? <span className="text-[16px] font-black text-white">{saga.companion}</span> : <Ico name="heart" size={22} color="#5eead4" />}
                    </PackButton>
                    <span className="flex items-center gap-1 text-[10px] font-black text-white" style={{ textShadow: '0 1px 2px #000' }}>Lyra <KeyCap>Q</KeyCap></span>
                </div>
            )}
            {saga.hymn !== null && (
                <div className="pointer-events-auto absolute z-[7] flex flex-col items-center gap-0.5" style={{ right: 250, bottom: 140 }}>
                    <PackButton variant="stone" size={50} label="Resonant Hymn" dim={saga.hymn > 0} glow={saga.hymn === 0 ? '#7dd3fc' : undefined} onPress={() => commands.emit({ type: 'hymn' })}>
                        {saga.hymn > 0 ? <span className="text-[16px] font-black text-white">{saga.hymn}</span> : <Ico name="star" size={22} color="#bae6fd" />}
                    </PackButton>
                    <span className="flex items-center gap-1 text-[10px] font-black text-white" style={{ textShadow: '0 1px 2px #000' }}>Hymn <KeyCap>R</KeyCap></span>
                </div>
            )}
        </>
    );
}

/** A Flashback Surge: the screen desaturates, a memory of Lyra flashes across it. */
function Surge({ line }: { line: string }) {
    return (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center" style={{ animation: 'surge-fade 5s ease-out both', backdropFilter: 'grayscale(.85) contrast(1.15)', background: 'radial-gradient(ellipse at center, rgba(245,158,11,.08), rgba(56,189,248,.25))' }}>
            <p className="max-w-[min(640px,86vw)] text-center text-[20px] italic leading-snug text-[#fde68a]" style={{ fontFamily: 'var(--font-pixel)', textShadow: '0 2px 6px #000' }}>{line}</p>
        </div>
    );
}

/** The finishing blow: a ring closes on the chisel; attack as it lands. */
function Beat({ hit, need, label }: { hit: number; need: number; label?: string }) {
    const t = (performance.now() % 900) / 900;
    const on = t > 0.72 || t < 0.12;
    const r = 70 - t * 50;
    return (
        <div className="pointer-events-none absolute left-1/2 top-[38%] z-[8] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
            <div className="relative" style={{ width: 150, height: 150 }}>
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: r * 2, height: r * 2, border: `4px solid ${on ? '#fde68a' : '#ffffff88'}` }} />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: 40, height: 40, background: on ? '#fde68a' : '#3a2f38', border: '3px solid #1a0c10', boxShadow: on ? '0 0 24px #fde68a' : 'none' }} />
            </div>
            <div className="flex gap-1">{Array.from({ length: need }, (_, n) => <span key={n} style={{ width: 14, height: 14, background: n < hit ? '#fde68a' : '#3a2f38', border: '2px solid #1a0c10' }} />)}</div>
            <span className="text-[14px] font-black text-[#fde68a]" style={{ textShadow: '0 1px 3px #000' }}>{label ?? 'Attack on the beat'}</span>
        </div>
    );
}
