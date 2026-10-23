/**
 * The four kingdoms as little isometric models: a floating slab of their land with its rocky
 * underside and what grows and burns and flows on top (a volcano and lava river, a windmill isle,
 * a lagoon with a lighthouse and waterfall, a mesa with crystals and a lantern-lit mine). Drawn in
 * a 300 × 320 SVG box; used by the kingdom choice (ui/KingdomSelect.tsx).
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Element } from '../../game/eidolon.ts';

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

export const LAND: Record<Element, () => ReactNode> = { fire: Pyraxis, air: Zephyria, water: Aquatica, earth: Terragrim };
