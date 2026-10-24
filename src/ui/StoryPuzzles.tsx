/**
 * The puzzles the later lands describe as data (game/story/types.ts PuzzleDef): sequences of
 * chimes or codes, dials (turned singly or coupled to the next), weights to balance, pipe routes,
 * frictionless sliding blocks, and basins to level. Plus the Strata-Loom, where relic shards are
 * mended, and the debate with Malakor at the Heart of the World.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { sfx } from '../game/audio.ts';
import { heroName, named, quest } from '../game/story/quest.ts';
import { ALL_RELICS } from '../game/story/lands.ts';
import type { PuzzleDef } from '../game/story/types.ts';
import { store, useStore } from '../state/store.ts';
import { PxButton, PxPanel } from './px.tsx';
import { Frame, Piece, tone } from './StoryPanels.tsx';

const INK = '#3a2414';

/** Strike these in order; a wrong one starts you over. */
function Sequence({ def, done }: { def: Extract<PuzzleDef, { kind: 'sequence' }>; done: () => void }) {
    const [got, setGot] = useState<number[]>([]);
    const hit = (k: number) => {
        tone(def.items[k].freq, 600);
        const next = [...got, k];
        if (def.order[next.length - 1] !== k) {
            setGot([]);
            return;
        }
        setGot(next);
        if (next.length === def.order.length) done();
    };
    const max = Math.max(...def.items.map((x) => x.freq));
    return (
        <div className="flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-end justify-center gap-2">
                {def.items.map((x, k) => (
                    <Piece key={k} label={x.label || `Pipe ${k + 1}`} on color={x.color} size={def.items.length > 6 ? 40 : 56} onPress={() => hit(k)}>
                        {x.label || <span style={{ display: 'inline-block', width: 8, height: 8 + (x.freq / max) * 26, background: '#1a0c10' }} />}
                    </Piece>
                ))}
            </div>
            <div className="flex gap-1">{def.order.map((_, n) => <span key={n} style={{ width: 12, height: 12, background: n < got.length ? '#15803d' : '#3a2f38', border: '2px solid #1a0c10' }} />)}</div>
        </div>
    );
}

/** Turn each dial to its mark (coupled: a turn also moves the next dial). */
function Dials({ def, done }: { def: Extract<PuzzleDef, { kind: 'dials' }>; done: () => void }) {
    const [d, setD] = useState(def.start);
    const turn = (k: number) => {
        sfx('click');
        const next = d.map((x, n) => (n === k || (def.couple && n === k + 1) ? (x + 1) % def.size : x));
        setD(next);
        if (next.every((x, n) => x === def.target[n])) done();
    };
    return (
        <div className="flex flex-wrap items-start justify-center gap-4">
            {d.map((x, k) => {
                const ok = x === def.target[k];
                return (
                    <div key={k} className="flex flex-col items-center gap-1">
                        <button type="button" aria-label={def.labels?.[k] ?? `Dial ${k + 1}`} onPointerDown={(e) => { e.preventDefault(); turn(k); }}
                            className="relative" style={{ width: 76, height: 76, borderRadius: def.show === 'level' ? 0 : '50%', background: '#3a2f38', border: `4px solid ${ok ? '#15803d' : '#1a0c10'}` }}>
                            {def.show === 'level' ? (
                                <span className="absolute inset-x-2 bottom-2" style={{ height: `${(x / (def.size - 1)) * 56}px`, background: ok ? '#86efac' : '#7dd3fc' }} />
                            ) : (
                                <>
                                    <span className="absolute left-1/2 top-1" style={{ width: 6, height: 8, marginLeft: -3, background: '#fde68a', transform: `rotate(${def.target[k] * (360 / def.size)}deg)`, transformOrigin: '3px 32px' }} />
                                    <span className="absolute left-1/2 top-1/2" style={{ width: 6, height: 30, marginLeft: -3, marginTop: -30, background: ok ? '#86efac' : '#e8dcc0', transform: `rotate(${x * (360 / def.size)}deg)`, transformOrigin: '3px 30px', transition: 'transform .15s steps(2)' }} />
                                </>
                            )}
                        </button>
                        <span className="text-[11px]" style={{ color: INK }}>{def.labels?.[k] ?? ''}</span>
                    </div>
                );
            })}
        </div>
    );
}

/** Put pieces on the pan until it weighs exactly the target (and, if set, with exactly `count` pieces). */
function Weights({ def, done }: { def: Extract<PuzzleDef, { kind: 'weights' }>; done: () => void }) {
    const [on, setOn] = useState(def.items.map(() => false));
    const sum = def.items.reduce((n, x, k) => n + (on[k] ? x.w : 0), 0);
    const press = (k: number) => {
        sfx('click');
        const next = on.map((x, n) => (n === k ? !x : x));
        setOn(next);
        const s = def.items.reduce((n, x, j) => n + (next[j] ? x.w : 0), 0);
        if (s === def.target && (!def.count || next.filter(Boolean).length === def.count)) done();
    };
    return (
        <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-2">{def.items.map((x, k) => <Piece key={k} label={x.label} on={on[k]} color={x.color} onPress={() => press(k)}>{x.w}</Piece>)}</div>
            <span className="text-[14px]" style={{ color: INK }}>{sum} / {def.target}</span>
        </div>
    );
}

// Pipe tiles: which sides are open (N, E, S, W) at rotation 0.
const OPEN: Record<string, boolean[]> = { I: [true, false, true, false], '-': [false, true, false, true], L: [true, true, false, false], T: [true, true, true, false], S: [true, true, true, true], E: [true, true, true, true], '.': [false, false, false, false] };
const openAt = (c: string, r: number, side: number) => OPEN[c][(side - r + 4) % 4];

/** Turn the pipe tiles so a run connects S to E. */
function Route({ def, done }: { def: Extract<PuzzleDef, { kind: 'route' }>; done: () => void }) {
    const H = def.grid.length, W = def.grid[0].length;
    const [rot, setRot] = useState(() => def.rot.map((row) => row.split('').map(Number)));
    const flow = useMemo(() => {
        const seen = new Set<string>();
        let sx = 0, sy = 0;
        def.grid.forEach((row, y) => row.split('').forEach((c, x) => { if (c === 'S') { sx = x; sy = y; } }));
        const stack = [[sx, sy]];
        seen.add(`${sx},${sy}`);
        const D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        while (stack.length) {
            const [x, y] = stack.pop()!;
            const c = def.grid[y][x];
            for (let s = 0; s < 4; s++) {
                if (!openAt(c, rot[y][x], s)) continue;
                const nx = x + D[s][0], ny = y + D[s][1];
                if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(`${nx},${ny}`)) continue;
                const nc = def.grid[ny][nx];
                if (nc === '.' || !openAt(nc, rot[ny][nx], (s + 2) % 4)) continue;
                seen.add(`${nx},${ny}`);
                stack.push([nx, ny]);
            }
        }
        return seen;
    }, [rot, def, H, W]);
    const turn = (x: number, y: number) => {
        const c = def.grid[y][x];
        if (c === '.' || c === 'S' || c === 'E') return;
        sfx('click');
        const next = rot.map((row) => [...row]);
        next[y][x] = (next[y][x] + 1) % 4;
        setRot(next);
    };
    let ex = 0, ey = 0;
    def.grid.forEach((row, y) => row.split('').forEach((c, x) => { if (c === 'E') { ex = x; ey = y; } }));
    const solved = flow.has(`${ex},${ey}`);
    if (solved) window.setTimeout(done, 350);
    return (
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${W}, 52px)` }}>
            {def.grid.flatMap((row, y) => row.split('').map((c, x) => {
                const lit = flow.has(`${x},${y}`);
                const col = lit ? '#fbbf24' : '#8a7a60';
                return (
                    <button key={`${x},${y}`} type="button" aria-label={`Tile ${x + 1},${y + 1}`} onPointerDown={(e) => { e.preventDefault(); turn(x, y); }}
                        className="relative" style={{ width: 52, height: 52, background: c === '.' ? '#2a2026' : '#3a2f38', border: '2px solid #1a0c10' }}>
                        {c !== '.' && [0, 1, 2, 3].filter((s) => openAt(c, rot[y][x], s)).map((s) => (
                            <span key={s} className="absolute" style={{ background: col, ...(s === 0 ? { left: 21, top: 0, width: 10, height: 26 } : s === 1 ? { left: 26, top: 21, width: 26, height: 10 } : s === 2 ? { left: 21, top: 26, width: 10, height: 26 } : { left: 0, top: 21, width: 26, height: 10 }) }} />
                        ))}
                        {(c === 'S' || c === 'E') && <span className="absolute inset-3 flex items-center justify-center text-[12px] font-black" style={{ background: '#fde68a', color: INK }}>{c}</span>}
                    </button>
                );
            }))}
        </div>
    );
}

/** Blocks slide until they hit something; raise a few ice pillars as stops. All blocks on switches to win. */
function Slide({ def, done }: { def: Extract<PuzzleDef, { kind: 'slide' }>; done: () => void }) {
    const [blocks, setBlocks] = useState(def.blocks.map(([x, y]) => [x, y]));
    const [pillars, setPillars] = useState<[number, number][]>([]);
    const [pick, setPick] = useState<number | null>(null);
    const [mode, setMode] = useState<'move' | 'pillar'>('move');
    const solid = (x: number, y: number, skip: number) =>
        x < 0 || y < 0 || x >= def.size || y >= def.size || def.walls.some(([a, b]) => a === x && b === y) || pillars.some(([a, b]) => a === x && b === y) || blocks.some(([a, b], k) => k !== skip && a === x && b === y);
    const push = (dx: number, dy: number) => {
        if (pick === null) return;
        let [x, y] = blocks[pick];
        while (!solid(x + dx, y + dy, pick)) { x += dx; y += dy; }
        const next = blocks.map((b, k) => (k === pick ? [x, y] : b));
        setBlocks(next);
        sfx('click');
        if (def.switches.every(([a, b]) => next.some(([c, d]) => c === a && d === b))) done();
    };
    const cell = (x: number, y: number) => {
        if (mode === 'pillar') {
            if (pillars.some(([a, b]) => a === x && b === y)) setPillars(pillars.filter(([a, b]) => !(a === x && b === y)));
            else if (pillars.length < def.pillars && !solid(x, y, -1)) setPillars([...pillars, [x, y]]);
            return;
        }
        const k = blocks.findIndex(([a, b]) => a === x && b === y);
        setPick(k >= 0 ? k : null);
    };
    const reset = () => { setBlocks(def.blocks.map(([x, y]) => [x, y])); setPillars([]); setPick(null); };
    return (
        <div className="flex items-center gap-4">
            <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${def.size}, 40px)` }}>
                {Array.from({ length: def.size * def.size }, (_, n) => {
                    const x = n % def.size, y = Math.floor(n / def.size);
                    const b = blocks.findIndex(([a, c]) => a === x && c === y);
                    const sw = def.switches.some(([a, c]) => a === x && c === y);
                    const wall = def.walls.some(([a, c]) => a === x && c === y);
                    const pil = pillars.some(([a, c]) => a === x && c === y);
                    return (
                        <button key={n} type="button" aria-label={`Cell ${x + 1},${y + 1}`} onPointerDown={(e) => { e.preventDefault(); cell(x, y); }}
                            style={{ width: 40, height: 40, background: wall ? '#1a0c10' : pil ? '#bae6fd' : sw ? '#5a6a3a' : '#cfe7f5', border: `2px solid ${b >= 0 && b === pick ? '#f59e0b' : '#6a8aa0'}` }}>
                            {b >= 0 && <span className="block h-full w-full" style={{ background: '#78716c', border: '3px solid #1a0c10' }} />}
                        </button>
                    );
                })}
            </div>
            <div className="flex flex-col items-center gap-1">
                <div className="grid grid-cols-3 gap-1">
                    <span /><Piece label="Up" color="#fde68a" on size={38} onPress={() => push(0, -1)}>▲</Piece><span />
                    <Piece label="Left" color="#fde68a" on size={38} onPress={() => push(-1, 0)}>◀</Piece><span /><Piece label="Right" color="#fde68a" on size={38} onPress={() => push(1, 0)}>▶</Piece>
                    <span /><Piece label="Down" color="#fde68a" on size={38} onPress={() => push(0, 1)}>▼</Piece><span />
                </div>
                <PxButton variant={mode === 'pillar' ? 'wood' : 'stone'} onClick={() => setMode(mode === 'move' ? 'pillar' : 'move')}>{mode === 'move' ? `Pillars (${def.pillars - pillars.length})` : 'Move blocks'}</PxButton>
                <PxButton variant="stone" onClick={reset}>Reset</PxButton>
            </div>
        </div>
    );
}

/** Each wheel pours one measure from a basin into the next (round the ring); level them all. */
function Levels({ def, done }: { def: Extract<PuzzleDef, { kind: 'levels' }>; done: () => void }) {
    const [lv, setLv] = useState(def.start);
    const pour = (k: number) => {
        if (lv[k] < def.step) return;
        sfx('click');
        const next = [...lv];
        next[k] -= def.step;
        next[(k + 1) % next.length] += def.step;
        setLv(next);
        if (next.every((x) => x === def.target)) done();
    };
    const max = Math.max(...def.start) + def.step * 2;
    return (
        <div className="flex items-end gap-4">
            {lv.map((x, k) => (
                <div key={k} className="flex flex-col items-center gap-1">
                    <div className="relative" style={{ width: 54, height: 110, background: '#2a2026', border: '3px solid #1a0c10' }}>
                        <span className="absolute inset-x-0 bottom-0" style={{ height: `${(x / max) * 100}%`, background: x === def.target ? '#86efac' : '#38bdf8' }} />
                        <span className="absolute inset-x-0" style={{ bottom: `${(def.target / max) * 100}%`, height: 2, background: '#fde68a' }} />
                    </div>
                    <Piece label={`Wheel ${k + 1}`} color="#fde68a" on size={40} onPress={() => pour(k)}>›</Piece>
                </div>
            ))}
        </div>
    );
}

export function DataPuzzle({ def, done }: { def: PuzzleDef; done: () => void }): ReactNode {
    if (def.kind === 'sequence') return <Sequence def={def} done={done} />;
    if (def.kind === 'dials') return <Dials def={def} done={done} />;
    if (def.kind === 'weights') return <Weights def={def} done={done} />;
    if (def.kind === 'route') return <Route def={def} done={done} />;
    if (def.kind === 'slide') return <Slide def={def} done={done} />;
    if (def.kind === 'levels') return <Levels def={def} done={done} />;
    return null;
}

// ------------------------------------------------------------------ the Strata-Loom

/** The Archaeologist's Workbench: turn each shard to its grain, brush off the ash, seal the seams with gold. */
export function LoomPanel() {
    const open = useStore((s) => s.loom);
    const [pick, setPick] = useState<string | null>(null);
    const [phase, setPhase] = useState<'turn' | 'brush' | 'seal'>('turn');
    const [rot, setRot] = useState<number[]>([]);
    const [ash, setAsh] = useState<boolean[]>([]);
    const [seams, setSeams] = useState<boolean[]>([]);
    if (!open) return null;
    const ready = ALL_RELICS.filter((r) => quest.has(`shard:${r.id}`) && !quest.has(`relic:${r.id}`));
    const done = ALL_RELICS.filter((r) => quest.has(`relic:${r.id}`));
    const relic = ALL_RELICS.find((r) => r.id === pick) ?? null;
    const close = () => { store.patch({ loom: false }); setPick(null); };
    const start = (id: string) => {
        const r = ALL_RELICS.find((x) => x.id === id)!;
        setPick(id);
        setPhase('turn');
        setRot(Array.from({ length: r.shards }, (_, n) => 1 + ((n * 7 + r.n) % 3)));
        setAsh(Array.from({ length: 8 }, () => true));
        setSeams(Array.from({ length: r.shards - 1 }, () => false));
    };
    const finish = () => {
        if (!relic) return;
        sfx('chapter');
        tone(523, 900);
        quest.on({ type: 'relic', id: relic.id });
        store.patch({ loom: false });
        store.tell(named(relic.vision));
        setPick(null);
    };
    return (
        <div className="pointer-events-auto absolute inset-0 z-[45] flex items-center justify-center" style={{ background: 'rgba(6,4,12,.72)' }}>
            <PxPanel frame={5} className="flex w-[min(560px,94vw)] flex-col gap-3 px-6 py-5" style={{ color: INK }}>
                <div className="text-[30px] leading-none" style={{ fontFamily: 'var(--font-relic)', color: '#7a4a14' }}>The Strata-Loom</div>
                {!relic && (
                    <>
                        <div className="text-[13px]">Mend the Corrupted Memory Relics you dug up. Each mended relic shows what Malakor buried.</div>
                        {ready.length === 0 && <div className="text-[13px] italic">No shards waiting. Defeat a land's champions to dig up their relics.</div>}
                        {ready.map((r) => <PxButton key={r.id} variant="wood" onClick={() => start(r.id)} sub={`${r.shards} shards`}>{r.title}</PxButton>)}
                        {done.length > 0 && <div className="text-[12px]">Mended: {done.map((r) => r.title).join(' · ')}</div>}
                    </>
                )}
                {relic && phase === 'turn' && (
                    <>
                        <div className="text-[13px]">1. Turn each shard until its grain lines up (the gold edge on top).</div>
                        <div className="flex justify-center gap-2">
                            {rot.map((r, k) => (
                                <Piece key={k} label={`Shard ${k + 1}`} on={r === 0} color="#fde68a" size={60} onPress={() => { sfx('click'); const nx = rot.map((x, n) => (n === k ? (x + 1) % 4 : x)); setRot(nx); if (nx.every((x) => x === 0)) setPhase('brush'); }}>
                                    <span style={{ display: 'inline-block', width: 34, height: 34, background: '#6a6070', borderTop: '6px solid #fbbf24', transform: `rotate(${r * 90}deg)`, clipPath: `polygon(${k % 2 ? '0 0,100% 0,80% 100%,10% 90%' : '10% 0,100% 10%,90% 100%,0 80%'})` }} />
                                </Piece>
                            ))}
                        </div>
                    </>
                )}
                {relic && phase === 'brush' && (
                    <>
                        <div className="text-[13px]">2. Brush away the fossilized ash (tap or drag over it).</div>
                        <div className="mx-auto grid grid-cols-4 gap-1" style={{ background: '#8a8494', padding: 6 }}>
                            {ash.map((a, k) => (
                                <span key={k} onPointerDown={() => brush(k)} onPointerEnter={(e) => { if (e.buttons) brush(k); }}
                                    style={{ width: 56, height: 40, background: a ? '#4a4040' : '#c4b5fd', border: '2px solid #1a0c10', cursor: 'pointer' }} />
                            ))}
                        </div>
                    </>
                )}
                {relic && phase === 'seal' && (
                    <>
                        <div className="text-[13px]">3. Pour molten gold-resin along each seam, then strike the harmonic chime.</div>
                        <div className="flex items-center justify-center gap-1">
                            {seams.map((s, k) => (
                                <button key={k} type="button" aria-label={`Seam ${k + 1}`} onPointerDown={(e) => { e.preventDefault(); sfx('click'); setSeams(seams.map((x, n) => (n === k ? true : x))); }}
                                    style={{ width: 16, height: 64, background: s ? '#fbbf24' : '#2a2026', border: '2px solid #1a0c10' }} />
                            ))}
                        </div>
                        <PxButton variant="wood" disabled={!seams.every(Boolean)} onClick={finish}>Strike the chime</PxButton>
                    </>
                )}
                <div className="flex justify-end gap-2">
                    {relic && <PxButton variant="stone" onClick={() => setPick(null)}>Another relic</PxButton>}
                    <PxButton variant="stone" onClick={close}>Step back</PxButton>
                </div>
            </PxPanel>
        </div>
    );
    function brush(k: number) {
        if (!ash[k]) return;
        sfx('click');
        const nx = ash.map((x, n) => (n === k ? false : x));
        setAsh(nx);
        if (nx.every((x) => !x)) setPhase('seal');
    }
}

// ------------------------------------------------------------------ the debate at the Heart of the World

interface Evidence { id: string; label: string; has: () => boolean }
const EVIDENCE: Evidence[] = [
    { id: 'ledger', label: 'The Uncensored Ledger (Pyraxis)', has: () => quest.has('tome') },
    { id: 'fork', label: "Vael's Tuning Fork (Zephyria)", has: () => quest.has('fork') },
    { id: 'goblet', label: "Seraphina's poisoned goblet (Relic VIII)", has: () => quest.has('relic:murder') },
    { id: 'confession', label: 'The Year 52 Confession Crystal', has: () => quest.has('confession') },
    { id: 'knot', label: "Cedric's Mantle Stabilizer Knot", has: () => true },
    { id: 'heart', label: 'Speak from the heart', has: () => true },
];
const STAGES: { malakor: string; right: string[]; win: string; plain: string }[] = [
    {
        malakor: '"Look upon the Heart, little mason. Every five hundred years it breaks open and the abyss marches out. When the Fourth Tide came, your kings bickered like children over border tolls! They would have lost that war. I ended the cycle because I loved this world enough to mutilate it rather than watch it die!"',
        right: ['ledger'],
        win: '"You broke it out of arrogance, not love. We dug up the Uncensored Ledger in Pyraxis: united, the nations could have won the Fourth Tide, as they won the three before it! You burned the proof because you would not trust ordinary people to stand together without you playing god!"',
        plain: '"You never trusted us to try." Malakor smiles thinly. "Trust is a luxury of the living."',
    },
    {
        malakor: '"And if they had broken ranks? One coward king, one betrayal on the field, and the abyss eats everyone. A gamble no sane ruler takes! Yes, the Mist took their histories. But they breathe! Their hearts beat! What is a forgotten name against the survival of the race?"',
        right: ['fork', 'goblet'],
        win: '"Ask your sister Vael, who wept in the dark for three hundred years waiting for you! Ask Seraphina, whom you poisoned at your own table! Survival isn\'t meat staying warm. It is remembering who you hold in the dark!"',
        plain: '"People are more than breath." He laughs, a dry sound. "Sentiment."',
    },
    {
        malakor: '"Then what do you want of me, Weaver of Ashes?"',
        right: ['confession'],
        win: '"We found your conservatory. You recalculated the charts fifty-two years after the Shattering: united, we would have won. You have known for two and a half centuries that you butchered the world for a mistake. You are not holding these lands apart to protect us: you hold them apart because if we reunite them and live, your whole life becomes an unforgivable sin."',
        plain: '"We want our world back." He looks away. "Then you will have to take it."',
    },
];

export function DebatePanel() {
    const open = useStore((s) => s.debate);
    const [stage, setStage] = useState(0);
    const [said, setSaid] = useState<string | null>(null);
    const [won, setWon] = useState(0);
    if (!open) return null;
    const hasConfession = quest.has('confession');
    const last = hasConfession ? 3 : 2;
    const s = STAGES[stage];
    const answer = (e: Evidence) => {
        sfx('click');
        const right = s.right.includes(e.id);
        setSaid(right ? s.win : e.id === 'heart' ? s.plain : `You hold up ${e.label.toLowerCase()}. Malakor barely glances at it. "Is that all you carried up my stairs?"`);
        if (right) setWon(won + 1);
        if (right || e.id === 'heart') window.setTimeout(() => { setSaid(null); setStage(stage + 1); }, 4200);
    };
    const end = () => {
        store.patch({ debate: false });
        setStage(0);
        setWon(0);
        quest.on({ type: 'puzzle', puzzle: 'debate' });
        store.tell(named({
            speaker: 'Malakor', title: 'Then Prove It', style: 'cinematic',
            lines: won >= last
                ? ['His cold composure finally shatters. Tears of liquid mana spill down his scarred face.', `"Then prove it to me, Weaver of Unwritten Ashes! Show this old butcher that your chisel is stronger than my fear!"`]
                : ['Malakor raises his Grand Astral Staff.', '"Words. Let us see if your chisel is as sharp as your tongue."'],
        }));
    };
    return (
        <div className="pointer-events-auto absolute inset-0 z-[45] flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, rgba(70,40,110,.6), rgba(4,2,10,.94))' }}>
            <div className="flex w-[min(640px,94vw)] flex-col gap-3 p-5" style={{ background: 'rgba(14,8,26,.95)', border: '3px solid #9d6bff', color: '#ede4ff' }}>
                <div className="text-[12px] uppercase tracking-[0.2em] text-[#c4a5ff]">The Cradle of the Heart · Exchange {Math.min(stage + 1, last)} of {last}</div>
                {stage < last ? (
                    <>
                        <div className="text-[26px] leading-none" style={{ fontFamily: 'var(--font-relic)', color: '#fde68a' }}>Malakor</div>
                        <p className="text-[15px] leading-snug">{s.malakor}</p>
                        {said ? (
                            <p className="story-line text-[15px] leading-snug text-[#bae6fd]"><b>{heroName()}:</b> {said}</p>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[12px] text-[#c4a5ff]">Answer him with what you dug up:</span>
                                {EVIDENCE.filter((e) => e.has()).map((e) => <PxButton key={e.id} variant={e.id === 'heart' ? 'stone' : 'wood'} onClick={() => answer(e)}>{e.label}</PxButton>)}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <p className="text-[15px] leading-snug">{won >= last ? 'Every word lands. The Arch-Mage of the Broken Axis stands silent at the edge of the Heart.' : 'Malakor has heard enough.'}</p>
                        <PxButton variant="wood" onClick={end}>Draw your chisel</PxButton>
                    </>
                )}
            </div>
        </div>
    );
}
