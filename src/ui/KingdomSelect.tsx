/**
 * Choosing a kingdom after the intro (New Game): the four lands float as little isometric
 * models over a sea of clouds, with the sealed Void Citadel behind them. The scene tilts with
 * the pointer (a light 3D stage). Tap a land to bring it forward and read its powers; tap it
 * again (or Enter) and the camera flies into it: you pledge, its camp becomes home, and the
 * journey begins with Elder Theron's welcome. No sound effects here: only the music.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { progress } from '../game/progress.ts';
import { KINGDOMS, nextKingdom, type Element } from '../game/eidolon.ts';
import { store } from '../state/store.ts';

const SERIF = "Georgia, 'Times New Roman', serif";
/** The order the lands float in, left to right, and how far back each sits (a gentle arc). */
const ROW: Element[] = ['fire', 'air', 'water', 'earth'];
const DEPTH = [-30, -110, -110, -30];

// ---------------------------------------------------------------- the little lands (SVG, 300 x 320)
// The top of each land is an isometric diamond centred on (150, 120); a point (a, b) on it, each
// -1..1 along the two tile axes, sits at iso(a, b).
const iso = (a: number, b: number) => ({ x: 150 + (a - b) * 120 * 0.5, y: 120 + (a + b) * 60 * 0.5 });
const spin = (x: number, y: number, s: number): CSSProperties => ({ transformOrigin: `${x}px ${y}px`, animation: `cs-spin ${s}s linear infinite` });
const fill = (dur: number, delay = 0): CSSProperties => ({ transformBox: 'fill-box', transformOrigin: 'center', animation: `eid-breathe ${dur}s ease-in-out ${delay}s infinite` });

/** A floating slab: rocky underside, two side faces, and the top the land's features stand on. */
function Slab({ id, top, top2, left, right, under, glow, children, below }: { id: string; top: string; top2: string; left: string; right: string; under: string; glow: string; children: ReactNode; below?: ReactNode }) {
    return (
        <>
            <defs>
                <radialGradient id={`${id}-aura`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor={glow} stopOpacity="0.55" /><stop offset="1" stopColor={glow} stopOpacity="0" /></radialGradient>
                <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={top2} /><stop offset="1" stopColor={top} /></linearGradient>
                <linearGradient id={`${id}-under`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={under} /><stop offset="1" stopColor="#0b0614" /></linearGradient>
            </defs>
            <ellipse cx="150" cy="170" rx="150" ry="120" fill={`url(#${id}-aura)`} />
            {below}
            {/* the rock underneath, jagged, with strata */}
            <path d="M30 146 L150 206 L270 146 L254 186 L222 200 L206 240 L176 248 L156 304 L132 254 L104 244 L86 204 L52 190 Z" fill={`url(#${id}-under)`} stroke="#0b0614" strokeWidth="3" strokeLinejoin="round" />
            <path d="M60 172 L150 214 L240 172 M96 214 L150 236 L200 214" stroke="#000" strokeOpacity="0.25" strokeWidth="3" fill="none" />
            {/* the slab's two sides */}
            <path d="M30 120 L150 180 L150 206 L30 146 Z" fill={left} stroke="#0b0614" strokeWidth="3" strokeLinejoin="round" />
            <path d="M150 180 L270 120 L270 146 L150 206 Z" fill={right} stroke="#0b0614" strokeWidth="3" strokeLinejoin="round" />
            {/* the top */}
            <path d="M150 60 L270 120 L150 180 L30 120 Z" fill={`url(#${id}-top)`} stroke="#0b0614" strokeWidth="3" strokeLinejoin="round" />
            <path d="M150 66 L258 120 L150 174 L42 120 Z" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="2" />
            {children}
        </>
    );
}

/** A pine tree standing at a point on the top. */
const Pine = ({ x, y, s = 1, c = '#2f6a3a' }: { x: number; y: number; s?: number; c?: string }) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
        <rect x="-2" y="-6" width="4" height="8" fill="#5a3a22" />
        <path d="M0 -34 L12 -14 L6 -14 L15 -2 L-15 -2 L-6 -14 L-12 -14 Z" fill={c} stroke="#0b0614" strokeWidth="2" strokeLinejoin="round" />
    </g>
);

function Pyraxis() {
    const v = iso(-0.1, -0.15);
    return (
        <Slab id="kf" top="#4a2420" top2="#6a3428" left="#3a1a16" right="#2a100e" under="#3a1a18" glow="#ff6a3d"
            below={<>{[[110, 220], [190, 236], [150, 268]].map(([x, y], n) => <circle key={n} cx={x} cy={y} r="2.5" fill="#ffb84a" style={{ transformBox: 'fill-box', animation: `ks-ember ${2.4 + n * 0.5}s linear ${n * 0.7}s infinite` }} />)}</>}>
            {/* magma glowing in the cracks below the rim */}
            <path d="M70 160 L96 196 L92 222 M206 176 L222 200" stroke="#ff7a2a" strokeWidth="3" fill="none" style={{ animation: 'eid-shimmer 1.8s ease-in-out infinite' }} />
            {/* the lava river across the land */}
            <path d="M52 124 Q96 140 128 132 T214 140 T252 124" stroke="#ff6a1a" strokeWidth="9" fill="none" strokeLinecap="round" />
            <path d="M52 124 Q96 140 128 132 T214 140 T252 124" stroke="#ffd06a" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="18 14" style={{ animation: 'cs-lava 2.2s linear infinite' }} />
            {/* obsidian spikes */}
            {[[78, 114], [222, 112], [200, 158], [96, 150]].map(([x, y], n) => <path key={n} d={`M${x - 7} ${y} L${x} ${y - 18} L${x + 7} ${y} Z`} fill="#1a0a0a" stroke="#0b0614" strokeWidth="2" />)}
            {/* the volcano */}
            <path d={`M${v.x - 48} ${v.y + 22} L${v.x - 14} ${v.y - 52} L${v.x + 14} ${v.y - 52} L${v.x + 48} ${v.y + 22} Q${v.x} ${v.y + 36} ${v.x - 48} ${v.y + 22} Z`} fill="#2e1412" stroke="#0b0614" strokeWidth="3" strokeLinejoin="round" />
            <path d={`M${v.x} ${v.y - 52} L${v.x + 14} ${v.y - 52} L${v.x + 48} ${v.y + 22} Q${v.x + 24} ${v.y + 30} ${v.x + 2} ${v.y + 31} Z`} fill="#5a2418" opacity="0.8" />
            <path d={`M${v.x - 4} ${v.y - 50} Q${v.x - 10} ${v.y - 20} ${v.x - 22} ${v.y + 10}`} stroke="#ff7a2a" strokeWidth="4" fill="none" strokeLinecap="round" />
            <ellipse cx={v.x} cy={v.y - 52} rx="15" ry="5" fill="#ffb84a" style={fill(1.6)} />
            {/* smoke from the crater */}
            {[0, 1, 2].map((n) => <circle key={n} cx={v.x} cy={v.y - 62} r="9" fill="#6a5a6a" opacity="0" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `ks-smoke 3.6s ease-out ${n * 1.2}s infinite` }} />)}
        </Slab>
    );
}

function Zephyria() {
    const m = iso(0.15, -0.35);
    return (
        <Slab id="ka" top="#7cc45a" top2="#b5e68a" left="#7a6a5a" right="#5a4a3a" under="#7a7a9a" glow="#7dd3fc"
            below={<g style={{ animation: 'eid-drift 9s ease-in-out infinite alternate' }}>{[[70, 250, 34], [120, 262, 26], [210, 256, 30], [250, 244, 22]].map(([x, y, r], n) => <ellipse key={n} cx={x} cy={y} rx={r} ry={r * 0.55} fill="#f6fbff" opacity="0.85" />)}</g>}>
            {/* little rocks drifting beside the isle */}
            {[[24, 56, 0.35, 0], [278, 70, 0.28, 1.4]].map(([x, y, s, d], n) => (
                <g key={n} style={{ animation: `eid-float ${4 + n}s ease-in-out ${d}s infinite` }}>
                    <g transform={`translate(${x} ${y}) scale(${s})`}>
                        <path d="M-60 0 L0 -30 L60 0 L0 30 Z" fill="#9ad07a" stroke="#0b0614" strokeWidth="6" />
                        <path d="M-60 0 L0 30 L60 0 L30 60 L0 90 L-30 60 Z" fill="#7a7a9a" stroke="#0b0614" strokeWidth="6" />
                    </g>
                </g>
            ))}
            {/* a dirt path */}
            <path d="M64 128 Q120 110 150 128 T236 118" stroke="#d9c79a" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.8" />
            {/* pines */}
            <Pine x={82} y={124} /><Pine x={100} y={140} s={0.85} /><Pine x={118} y={108} s={0.9} /><Pine x={214} y={150} s={0.8} /><Pine x={232} y={136} s={0.7} />
            {/* the windmill */}
            <path d={`M${m.x - 12} ${m.y + 18} L${m.x - 7} ${m.y - 34} L${m.x + 7} ${m.y - 34} L${m.x + 12} ${m.y + 18} Z`} fill="#f1e6d2" stroke="#0b0614" strokeWidth="3" strokeLinejoin="round" />
            <path d={`M${m.x - 10} ${m.y - 32} L${m.x} ${m.y - 46} L${m.x + 10} ${m.y - 32} Z`} fill="#c0563a" stroke="#0b0614" strokeWidth="3" strokeLinejoin="round" />
            <rect x={m.x - 4} y={m.y + 4} width="8" height="13" fill="#5a3a22" />
            <g style={spin(m.x, m.y - 30, 5)}>
                {[0, 90, 180, 270].map((a) => <rect key={a} x={m.x - 3} y={m.y - 64} width="6" height="34" fill="#fff8e8" stroke="#0b0614" strokeWidth="2" transform={`rotate(${a} ${m.x} ${m.y - 30})`} />)}
                <circle cx={m.x} cy={m.y - 30} r="4" fill="#5a3a22" />
            </g>
            {/* wind streaks */}
            {[[20, 80], [40, 200], [180, 50]].map(([x, y], n) => <path key={n} d={`M${x} ${y} q40 -10 80 0 t80 0`} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="30 140" style={{ animation: `cs-lava ${2 + n * 0.5}s linear infinite` }} opacity="0.75" />)}
        </Slab>
    );
}

function Aquatica() {
    const l = iso(0.3, -0.5);
    return (
        <Slab id="kw" top="#d9c48a" top2="#f2e2b0" left="#1e5a7a" right="#164a66" under="#25506e" glow="#38bdf8"
            below={<>
                {/* the waterfall pouring off the front edge, and its mist */}
                <path d="M196 196 L196 300" stroke="#9fe0ff" strokeWidth="12" strokeLinecap="round" opacity="0.75" />
                <path d="M196 196 L196 300" stroke="#fff" strokeWidth="5" strokeDasharray="14 12" style={{ animation: 'cs-lava 0.9s linear infinite' }} />
                <ellipse cx="196" cy="300" rx="26" ry="8" fill="#e0f6ff" opacity="0.6" style={fill(2)} />
            </>}>
            {/* the lagoon inside a ring of sand */}
            <defs><linearGradient id="kw-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7dd8f8" /><stop offset="1" stopColor="#1e88c8" /></linearGradient></defs>
            <path d="M150 76 L244 120 L150 164 L56 120 Z" fill="url(#kw-water)" stroke="#0e5a8a" strokeWidth="2" />
            <path d="M196 150 L210 160 L196 170" fill="#1e88c8" />
            {[[110, 112, 30], [160, 132, 40], [128, 140, 22], [190, 112, 26]].map(([x, y, w], n) => <rect key={n} x={x} y={y} width={w} height="2.5" rx="1" fill="#fff" style={{ animation: `eid-shimmer ${2 + n * 0.4}s ease-in-out ${n * 0.3}s infinite` }} />)}
            {/* a coral arch rising from the water */}
            <path d="M84 126 Q84 92 106 92 Q128 92 128 126 L120 126 Q120 100 106 100 Q92 100 92 126 Z" fill="#f472b6" stroke="#0b0614" strokeWidth="2.5" />
            <path d="M98 128 Q94 112 100 104 M114 128 Q120 112 112 104" stroke="#fda4af" strokeWidth="2" fill="none" />
            {/* the lighthouse on its rock */}
            <path d={`M${l.x - 16} ${l.y + 8} L${l.x} ${l.y - 2} L${l.x + 16} ${l.y + 8} L${l.x} ${l.y + 16} Z`} fill="#6a7a8a" stroke="#0b0614" strokeWidth="2" />
            <path d={`M${l.x - 7} ${l.y + 6} L${l.x - 4} ${l.y - 40} L${l.x + 4} ${l.y - 40} L${l.x + 7} ${l.y + 6} Z`} fill="#f8f4ec" stroke="#0b0614" strokeWidth="2.5" />
            <path d={`M${l.x - 6} ${l.y - 8} L${l.x + 6} ${l.y - 8} L${l.x + 5.5} ${l.y - 18} L${l.x - 5.5} ${l.y - 18} Z M${l.x - 5} ${l.y - 26} L${l.x + 5} ${l.y - 26} L${l.x + 4.6} ${l.y - 34} L${l.x - 4.6} ${l.y - 34} Z`} fill="#e04a3a" />
            <rect x={l.x - 5} y={l.y - 48} width="10" height="8" fill="#ffe8a0" stroke="#0b0614" strokeWidth="2" />
            <path d={`M${l.x - 6} ${l.y - 48} L${l.x} ${l.y - 56} L${l.x + 6} ${l.y - 48} Z`} fill="#e04a3a" stroke="#0b0614" strokeWidth="2" />
            <path d={`M${l.x} ${l.y - 44} L${l.x + 70} ${l.y - 62} L${l.x + 70} ${l.y - 30} Z`} fill="#fff6c8" opacity="0.3" style={{ animation: 'eid-shimmer 2.4s ease-in-out infinite' }} />
            {/* palms on the sand */}
            {[[64, 116], [236, 124]].map(([x, y], n) => (
                <g key={n} transform={`translate(${x} ${y})`}>
                    <path d="M0 0 Q-3 -16 2 -28" stroke="#7a5a32" strokeWidth="3.5" fill="none" />
                    <path d="M2 -28 q-14 -2 -20 6 M2 -28 q14 -4 20 4 M2 -28 q-6 -12 -16 -12 M2 -28 q8 -12 18 -10" stroke="#2f8a4a" strokeWidth="4" fill="none" strokeLinecap="round" />
                </g>
            ))}
        </Slab>
    );
}

function Terragrim() {
    // A raised mesa on the back of the land, with the mine's mouth in its front.
    const c = iso(-0.35, -0.35);
    const h = 26;
    return (
        <Slab id="ke" top="#b0844e" top2="#d8b07a" left="#8a6a3a" right="#6a4a2a" under="#5a3a1e" glow="#c69c5d"
            below={<>{[[80, 196], [128, 236], [180, 240], [226, 190]].map(([x, y], n) => (
                <path key={n} d={`M${x} ${y} q-8 22 2 40 q8 16 -2 30`} stroke="#6a4a22" strokeWidth="3" fill="none" strokeLinecap="round" style={{ transformOrigin: `${x}px ${y}px`, animation: `eid-sway ${3 + n * 0.6}s ease-in-out infinite` }} />
            ))}</>}>
            {/* the mesa */}
            <path d={`M${c.x - 50} ${c.y} L${c.x} ${c.y + 25} L${c.x} ${c.y + 25 - h} L${c.x - 50} ${c.y - h} Z`} fill="#9a7444" stroke="#0b0614" strokeWidth="2.5" strokeLinejoin="round" />
            <path d={`M${c.x} ${c.y + 25} L${c.x + 50} ${c.y} L${c.x + 50} ${c.y - h} L${c.x} ${c.y + 25 - h} Z`} fill="#7a5630" stroke="#0b0614" strokeWidth="2.5" strokeLinejoin="round" />
            <path d={`M${c.x} ${c.y - 25 - h} L${c.x + 50} ${c.y - h} L${c.x} ${c.y + 25 - h} L${c.x - 50} ${c.y - h} Z`} fill="#e0bc84" stroke="#0b0614" strokeWidth="2.5" strokeLinejoin="round" />
            {/* the mine's mouth and its lantern */}
            <path d={`M${c.x + 14} ${c.y + 18} L${c.x + 14} ${c.y + 4} Q${c.x + 24} ${c.y - 8} ${c.x + 34} ${c.y - 2} L${c.x + 34} ${c.y + 8} Z`} fill="#1a0e06" stroke="#0b0614" strokeWidth="2" />
            <circle cx={c.x + 40} cy={c.y - 4} r="4" fill="#ffd06a" style={fill(1.4)} />
            <circle cx={c.x + 40} cy={c.y - 4} r="12" fill="#ffd06a" opacity="0.25" style={{ animation: 'eid-shimmer 1.4s ease-in-out infinite' }} />
            {/* crystals */}
            {[[188, 116, '#c084fc', 1], [204, 126, '#5eead4', 0.8], [176, 132, '#a78bfa', 0.7], [226, 140, '#5eead4', 0.6]].map(([x, y, col, s], n) => (
                <g key={n} transform={`translate(${x} ${y}) scale(${s})`}>
                    <path d="M-8 0 L-5 -26 L0 -36 L5 -26 L8 0 Z" fill={col as string} stroke="#0b0614" strokeWidth="2.5" />
                    <path d="M0 -36 L5 -26 L8 0 L0 0 Z" fill="#fff" opacity="0.3" />
                    <circle cx="0" cy="-16" r="16" fill={col as string} opacity="0.2" style={{ animation: `eid-shimmer ${1.8 + n * 0.3}s ease-in-out infinite` }} />
                </g>
            ))}
            {/* glowing mushrooms */}
            {[[98, 146], [114, 156], [140, 160]].map(([x, y], n) => (
                <g key={n} transform={`translate(${x} ${y}) scale(${1 - n * 0.15})`}>
                    <rect x="-2" y="-12" width="4" height="12" fill="#efe2c8" />
                    <path d="M-11 -11 Q0 -26 11 -11 Z" fill="#2dd4bf" stroke="#0b0614" strokeWidth="2" />
                    <circle cx="0" cy="-14" r="12" fill="#5eead4" opacity="0.18" style={{ animation: `eid-shimmer ${2 + n * 0.5}s ease-in-out infinite` }} />
                </g>
            ))}
        </Slab>
    );
}

const LAND: Record<Element, () => ReactNode> = { fire: Pyraxis, air: Zephyria, water: Aquatica, earth: Terragrim };

/** The sealed citadel far behind the lands. */
function Citadel() {
    return (
        <svg viewBox="0 0 200 220" className="h-full w-full">
            <defs><radialGradient id="kc-v" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#000" /><stop offset="0.55" stopColor="#3a0a6a" /><stop offset="1" stopColor="#7a2ad0" stopOpacity="0" /></radialGradient></defs>
            <g style={spin(100, 60, 12)}>
                <circle cx="100" cy="60" r="58" fill="url(#kc-v)" />
                {[0, 120, 240].map((a) => <path key={a} d="M100 60 m-48 0 a48 48 0 0 1 48 -48" stroke="#c084fc" strokeWidth="2.5" fill="none" opacity="0.6" transform={`rotate(${a} 100 60)`} />)}
            </g>
            <path d="M60 170 Q100 158 140 170 L118 196 L100 214 L82 196 Z" fill="#1a1030" stroke="#000" strokeWidth="3" />
            <path d="M80 170 L88 100 L94 170 Z M96 170 L100 56 L104 170 Z M106 170 L112 108 L120 170 Z" fill="#0b0716" stroke="#8b5cf6" strokeWidth="1.5" />
        </svg>
    );
}

export default function KingdomSelect() {
    const [pick, setPick] = useState<Element | null>(null);
    const [entering, setEntering] = useState<Element | null>(null);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const root = useRef<HTMLDivElement>(null);

    const pledge = (e: Element) => {
        progress.chooseKingdom(e);
        progress.markIntroSeen();
        const first = progress.chapter();
        store.patch({
            phase: 'playing',
            storyPopup: { speaker: 'Elder Theron', title: `Welcome to ${KINGDOMS[e].name}`, lines: [`The essence of ${KINGDOMS[e].name} flows into you: ${KINGDOMS[e].power}. This camp is your home now.`, ...first.say, `Your first task: ${first.task}.`] },
        });
    };
    const choose = (e: Element) => {
        if (entering) return;
        if (pick !== e) {
            setPick(e);
            return;
        }
        // The same land again: fly in.
        setEntering(e);
        window.setTimeout(() => pledge(e), 1100);
    };

    // The stage leans toward the pointer (or the device's touch) for a sense of depth.
    useEffect(() => {
        const on = (ev: PointerEvent) => {
            const r = root.current?.getBoundingClientRect();
            if (!r) return;
            setTilt({ x: (ev.clientX - r.left) / r.width - 0.5, y: (ev.clientY - r.top) / r.height - 0.5 });
        };
        window.addEventListener('pointermove', on);
        return () => window.removeEventListener('pointermove', on);
    }, []);
    // Keys: left and right pick a land, Enter goes in.
    useEffect(() => {
        const on = (ev: KeyboardEvent) => {
            const n = pick ? ROW.indexOf(pick) : -1;
            if (ev.key === 'ArrowRight') choose(ROW[(n + 1) % 4]);
            else if (ev.key === 'ArrowLeft') choose(ROW[(n + 3) % 4]);
            else if ((ev.key === 'Enter' || ev.key === ' ') && pick) choose(pick);
        };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    });

    const k = pick ? KINGDOMS[pick] : null;
    const W = 'min(23vw, 46vh)';
    return (
        // (data-quiet: no click sounds on this screen, only its music)
        <div ref={root} data-quiet className="absolute inset-0 overflow-hidden select-none" style={{ background: 'linear-gradient(180deg, #070418 0%, #1a0f3a 38%, #3a1f5a 68%, #6a3a6a 100%)' }}>
            {/* stars and a low moon */}
            {Array.from({ length: 60 }, (_, n) => (
                <span key={n} className="absolute block rounded-full bg-white" style={{ left: `${(n * 37.3) % 100}%`, top: `${(n * 23.7) % 55}%`, width: n % 7 ? 2 : 3, height: n % 7 ? 2 : 3, animation: `eid-twinkle ${2 + (n % 4)}s ease-in-out ${(n % 9) * 0.3}s infinite` }} />
            ))}
            <div className="absolute rounded-full" style={{ right: '9%', top: '9%', width: '12vh', height: '12vh', background: 'radial-gradient(circle at 40% 40%, #fff6e0, #f6c87a 55%, rgba(246,200,122,0) 72%)', filter: 'blur(0.5px)', opacity: 0.85 }} />
            {/* the sea of clouds far below */}
            <div className="absolute inset-x-[-10%] bottom-[-6%] h-[34%]" style={{ animation: 'eid-drift 26s ease-in-out infinite alternate' }}>
                {Array.from({ length: 12 }, (_, n) => (
                    <span key={n} className="absolute block rounded-full" style={{ left: `${n * 9 - 4}%`, bottom: `${(n % 3) * 14}%`, width: '22%', height: '70%', background: 'radial-gradient(ellipse at 50% 40%, rgba(255,214,230,.55), rgba(190,150,220,.25) 55%, transparent 72%)' }} />
                ))}
            </div>

            {/* title */}
            <div className="pointer-events-none absolute inset-x-0 top-[3vh] z-10 text-center">
                <h2 className="text-[min(34px,6.4vh)] font-bold text-white" style={{ fontFamily: SERIF, textShadow: '0 3px 16px rgba(0,0,0,.6)' }}>Choose your kingdom</h2>
                <p className="text-[min(13px,2.6vh)] font-semibold tracking-wide text-white/75">{pick ? `Tap ${KINGDOMS[pick].name} again to enter` : 'Tap a land to look closer · its essence becomes yours'}</p>
            </div>

            {/* the 3D stage */}
            {/* (the stage layers let touches through: the lands sit behind their plane, and only they take taps) */}
            <div className="pointer-events-none absolute inset-0" style={{ perspective: '1100px', perspectiveOrigin: '50% 35%' }}>
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        transformStyle: 'preserve-3d',
                        transform: entering ? 'none' : `rotateX(${8 - tilt.y * 6}deg) rotateY(${tilt.x * 10}deg)`,
                        transition: 'transform .6s cubic-bezier(.2,.7,.2,1)',
                    }}
                >
                    {/* the Void Citadel, sealed, far behind */}
                    <div className="pointer-events-none absolute left-1/2" style={{ top: '11%', width: 'min(15vw, 26vh)', transform: 'translateX(-50%) translateZ(-420px)', opacity: entering ? 0 : 0.7, transition: 'opacity .6s' }}>
                        <div className="w-full" style={{ animation: 'eid-float 8s ease-in-out infinite' }}><Citadel /></div>
                    </div>

                    {/* the four lands */}
                    {ROW.map((e, n) => {
                        const on = pick === e;
                        const dim = (pick && !on) || (entering && entering !== e);
                        const flying = entering === e;
                        const x = (n - 1.5) * 24;
                        const z = flying ? 700 : DEPTH[n] + (on ? 90 : 0);
                        return (
                            <button
                                key={e}
                                type="button"
                                onClick={() => choose(e)}
                                className="group pointer-events-auto absolute flex flex-col items-center outline-none"
                                style={{
                                    left: `calc(50% + ${x}vw)`, top: on ? '20%' : '24%', width: W,
                                    transform: `translateX(-50%) translateZ(${z}px)`, transformStyle: 'preserve-3d',
                                    transition: `transform ${flying ? 1.1 : 0.5}s cubic-bezier(.3,.6,.2,1), top .5s, opacity .5s, filter .5s`,
                                    opacity: entering && !flying ? 0 : dim ? 0.55 : 1,
                                    filter: dim ? 'saturate(.55) brightness(.8)' : 'none',
                                    zIndex: on ? 5 : 1,
                                }}
                            >
                                <div className="w-full transition-transform duration-300 group-hover:-translate-y-2" style={{ animation: `eid-float ${5 + n * 0.7}s ease-in-out ${n * 0.6}s infinite` }}>
                                    <svg viewBox="0 0 300 320" className="w-full overflow-visible" style={{ filter: `drop-shadow(0 0 ${on ? 26 : 10}px ${KINGDOMS[e].css}${on ? 'cc' : '66'})`, transition: 'filter .4s' }}>
                                        {LAND[e]()}
                                    </svg>
                                </div>
                                <div className="mt-[-4%] flex flex-col items-center" style={{ textShadow: '0 2px 8px #000' }}>
                                    <span className="text-[min(22px,4.4vh)] font-bold text-white" style={{ fontFamily: SERIF }}>{KINGDOMS[e].glyph} {KINGDOMS[e].name}</span>
                                    <span className="text-[min(11px,2.2vh)] font-bold uppercase tracking-[0.25em]" style={{ color: KINGDOMS[e].css }}>{KINGDOMS[e].land}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* what the chosen land gives, and the way in */}
            {k && pick && (
                <div key={pick} className="absolute inset-x-0 bottom-[2.5vh] z-20 flex justify-center px-4" style={{ animation: 'cs-fade-up .45s ease-out both', opacity: entering ? 0 : 1, transition: 'opacity .4s' }}>
                    <div className="flex w-full max-w-[880px] items-center gap-3 rounded-2xl px-4 py-2.5 text-[#efe8fa]" style={{ background: 'rgba(14,8,26,.82)', border: `2px solid ${k.css}`, boxShadow: `0 0 30px ${k.css}55`, backdropFilter: 'blur(6px)' }}>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-snug">
                            <div className="text-[min(13px,2.6vh)] font-bold text-white/85">{k.theme}. Ruled by {k.warden.name}, who holds the seal to {KINGDOMS[nextKingdom(pick)].name}.</div>
                            <div className="text-[min(13px,2.6vh)]"><span className="font-black uppercase tracking-wide" style={{ color: k.css }}>Passive · </span><span className="font-bold">{k.power}</span></div>
                            <div className="text-[min(13px,2.6vh)]"><span className="font-black uppercase tracking-wide" style={{ color: k.css }}>{k.skill.name} · </span><span className="font-bold">{k.skill.blurb}</span></div>
                        </div>
                        <button
                            type="button"
                            onClick={() => choose(pick)}
                            className="shrink-0 rounded-xl px-5 py-3 text-[min(17px,3.4vh)] font-black text-white transition-transform hover:scale-105 active:scale-95"
                            style={{ background: `linear-gradient(180deg, ${k.css}, #0b0614 160%)`, border: '2px solid #fff', boxShadow: `0 0 18px ${k.css}` }}
                        >
                            Enter {k.name} ›
                        </button>
                    </div>
                </div>
            )}

            {/* flying in: the land's light fills the view */}
            {entering && <div className="pointer-events-none absolute inset-0 z-30" style={{ background: `radial-gradient(circle at 50% 45%, #fff 0%, ${KINGDOMS[entering].css} 45%, #0b0614 100%)`, animation: 'ks-flash 1.1s ease-in both' }} />}
        </div>
    );
}
