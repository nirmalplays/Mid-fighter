/**
 * The intro cutscene's eight paintings, hand-built in SVG. Each takes the scene's length
 * (`d`, seconds) so its timed moments (panels revealing, the fall, the crack and flash)
 * land at the same point of the narration however long the voice line is. Motion is CSS
 * (cs-* keyframes in styles/app.css): a slow camera push on every shot, drifting clouds,
 * embers, rain, light shafts.
 */
import type { Element } from '../../game/eidolon.ts';
import { ELEMENT_ICON, ICON_PATHS, Sigil } from '../icons.tsx';
import type { CSSProperties, ReactNode } from 'react';
import { Cloud, Crane, LandscapeBackdrop } from '../Landscape.tsx';
import type { SceneId } from '../../game/narration.ts';

/** The part of each 1600 x 900 scene that always shows (the picture fits it whole); backgrounds reach far beyond. */
const VB = '0 50 1600 800';
/** An animation that starts `at` (0..1) of the way through a `d`-second scene. */
const at = (name: string, d: number, from: number, len: number, extra = 'ease-out both'): CSSProperties => ({
    animation: `${name} ${Math.max(0.2, d * len)}s ${extra}`,
    animationDelay: `${d * from}s`,
});
/** A slow camera move over the whole shot. */
function Camera({ d, from = 'scale(1)', to = 'scale(1.1)', origin = '50% 50%', children }: { d: number; from?: string; to?: string; origin?: string; children: ReactNode }) {
    return (
        <div className="absolute inset-0" style={{ ['--from' as string]: from, ['--to' as string]: to, transformOrigin: origin, animation: `cs-camera ${d + 1.4}s linear both` }}>
            {children}
        </div>
    );
}
const Svg = ({ children }: { children: ReactNode }) => (
    <svg viewBox={VB} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full overflow-visible">{children}</svg>
);

/** Rising sparks (embers, motes, bubbles) as plain CSS particles. */
function Particles({ n, color, glow, size = 4, area = { x: 0, y: 40, w: 100, h: 60 }, speed = 8, kind = 'rise' }: { n: number; color: string; glow: string; size?: number; area?: { x: number; y: number; w: number; h: number }; speed?: number; kind?: 'rise' | 'fall' | 'float' }) {
    const dots = Array.from({ length: n }, (_, i) => ({
        left: area.x + ((i * 37.7) % area.w),
        top: area.y + ((i * 53.3) % area.h),
        delay: (i * 0.61) % speed,
        dur: speed * (0.7 + ((i * 13) % 10) / 15),
        s: size * (0.6 + ((i * 7) % 5) / 6),
    }));
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {dots.map((p, i) => (
                <span
                    key={i}
                    className="absolute block rounded-full"
                    style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.s, height: p.s, background: color, boxShadow: `0 0 ${p.s * 2.5}px ${glow}`, animation: `cs-${kind} ${p.dur}s linear ${-p.delay}s infinite` }}
                />
            ))}
        </div>
    );
}

/** A floating continent: grassy top, rock underneath, mountains, the Heart on the peak. */
function Continent({ id, top = '#7fbf5a', top2 = '#c9d86a', rock = '#5a4a7a', rock2 = '#3a2f5a', heart = true }: { id: string; top?: string; top2?: string; rock?: string; rock2?: string; heart?: boolean }) {
    return (
        <g>
            <defs>
                <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={top} /><stop offset="0.5" stopColor={top2} /><stop offset="1" stopColor={top} /></linearGradient>
                <linearGradient id={`${id}-rock`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={rock} /><stop offset="1" stopColor={rock2} /></linearGradient>
                <radialGradient id={`${id}-heart`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#fffbe0" /><stop offset="0.35" stopColor="#ffd06a" stopOpacity="0.9" /><stop offset="1" stopColor="#ff8a3a" stopOpacity="0" /></radialGradient>
            </defs>
            <path d="M330 470 Q560 440 800 446 Q1040 440 1270 470 L1210 540 L1120 600 L1010 690 L900 640 L820 760 L740 650 L640 700 L520 610 L410 560 Z" fill={`url(#${id}-rock)`} stroke="#1a1030" strokeWidth="4" strokeLinejoin="round" />
            <path d="M380 520 Q600 540 800 520 Q1000 540 1220 518 M440 570 Q620 600 800 580 Q980 600 1160 568" stroke="#2a2048" strokeWidth="5" fill="none" opacity="0.6" />
            <ellipse cx="800" cy="466" rx="470" ry="40" fill={`url(#${id}-top)`} stroke="#1a1030" strokeWidth="4" />
            {/* mountains */}
            <path d="M560 466 L640 400 L700 430 L800 300 L900 420 L960 395 L1060 466 Z" fill="#6a5a9a" stroke="#1a1030" strokeWidth="3" strokeLinejoin="round" />
            <path d="M800 300 L900 420 L960 395 L1060 466 L860 466 Z" fill="#f2b977" opacity="0.75" />
            <path d="M800 300 L822 330 L812 340 L800 326 L788 342 L778 330 Z" fill="#fff4e0" />
            {/* trees and a village's warm windows */}
            {[430, 470, 505, 1110, 1150, 1185].map((x, n) => <path key={n} d={`M${x} 470 L${x + 10} 440 L${x + 20} 470 Z`} fill="#2f6a3a" stroke="#1a1030" strokeWidth="2" />)}
            {[620, 660, 940, 980].map((x, n) => <rect key={n} x={x} y="452" width="14" height="10" fill="#ffd98a" rx="2" />)}
            {/* waterfalls */}
            {[[480, 560, 140], [1150, 560, 170], [700, 680, 120]].map(([x, y, h], n) => (
                <g key={n}>
                    <rect x={x} y={y} width="10" height={h} fill="#bfe9ff" opacity="0.6" />
                    <rect x={x} y={y} width="10" height={h} fill="url(#cs-fall-dash)" style={{ animation: `cs-dash 1.2s linear ${n * 0.3}s infinite` }} />
                </g>
            ))}
            {heart && (
                <g>
                    <circle cx="800" cy="290" r="120" fill={`url(#${id}-heart)`} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'eid-breathe 3.2s ease-in-out infinite' }} />
                    <path d="M800 262 L818 290 L800 322 L782 290 Z" fill="#fff6c8" stroke="#ffb84a" strokeWidth="3" />
                    <rect x="796" y="0" width="8" height="270" fill="#fff2c4" opacity="0.25" />
                </g>
            )}
        </g>
    );
}

// ---------------------------------------------------------------- 1. one world
function OneWorld({ d }: { d: number }) {
    return (
        <Camera d={d} from="scale(0.98) translateY(1%)" to="scale(1.07)" origin="50% 45%">
            <Svg>
                <defs>
                    <linearGradient id="s1-sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="900"><stop offset="0" stopColor="#0f1640" /><stop offset="0.45" stopColor="#3b3a8a" /><stop offset="0.75" stopColor="#d9827a" /><stop offset="1" stopColor="#ffd28a" /></linearGradient>
                    <pattern id="cs-fall-dash" width="10" height="24" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#ffffff" opacity="0.7" /></pattern>
                </defs>
                <rect x="-2400" y="-900" width="6400" height="2700" fill="url(#s1-sky)" />
                {/* light rays from the Heart */}
                <g style={{ transformOrigin: '800px 300px', animation: 'cs-spin 140s linear infinite' }} opacity="0.13">
                    {Array.from({ length: 14 }, (_, n) => <path key={n} d="M800 300 L790 -600 L810 -600 Z" fill="#fff2c4" transform={`rotate(${n * (360 / 14)} 800 300)`} />)}
                </g>
                {Array.from({ length: 36 }, (_, n) => <circle key={n} cx={(n * 431) % 1600} cy={(n * 173) % 300} r={n % 5 ? 1.2 : 2} fill="#fff" opacity="0.7" style={{ animation: `eid-twinkle ${2 + (n % 3)}s ease-in-out ${n * 0.2}s infinite` }} />)}
                {/* the sea of clouds below */}
                <g style={{ animation: 'eid-drift 30s ease-in-out infinite alternate' }}>
                    <Cloud x={160} y={720} s={2.2} lit="#ffd6c0" shade="#c79ad0" />
                    <Cloud x={1180} y={740} s={2.4} lit="#ffd0b8" shade="#c08ad0" />
                    <Cloud x={640} y={820} s={2.6} lit="#ffe0c8" shade="#b98ad0" />
                </g>
                <g style={{ animation: 'eid-float 10s ease-in-out infinite' }}>
                    <Continent id="s1" />
                </g>
                <g style={{ animation: 'eid-drift 40s ease-in-out -8s infinite alternate-reverse' }}>
                    <Cloud x={180} y={380} s={1} lit="#ffd8c8" />
                    <Cloud x={1340} y={330} s={1.2} lit="#ffe2c8" />
                </g>
                <g style={{ animation: 'eid-cranes 38s linear infinite' }}>
                    {[[0, 0, 1], [50, 22, 0.9], [100, 8, 0.85], [-34, 34, 0.8], [150, 34, 0.75]].map(([x, y, s], n) => <Crane key={n} x={x} y={y} s={s} delay={n * 0.15} />)}
                </g>
            </Svg>
            <Particles n={28} color="#fff6d0" glow="#ffd06a" size={3} area={{ x: 20, y: 20, w: 60, h: 60 }} speed={9} kind="float" />
        </Camera>
    );
}

// ---------------------------------------------------------------- 2. the four peoples
function Panel({ i, d, title, sub, el, children }: { i: number; d: number; title: string; sub: string; el: Element; children: ReactNode }) {
    return (
        <div className="absolute inset-y-0 overflow-hidden" style={{ left: `${i * 25}%`, width: '25%', borderLeft: i ? '2px solid rgba(255,214,140,.55)' : undefined, ...at('cs-panel-in', d, 0.04 + i * 0.22, 0.12) }}>
            <div className="absolute inset-0" style={{ animation: `cs-camera ${d}s linear both`, ['--from' as string]: 'scale(1.06)', ['--to' as string]: 'scale(1)' }}>{children}</div>
            <div className="absolute inset-x-0 bottom-[14%] text-center" style={at('cs-fade-up', d, 0.1 + i * 0.22, 0.08)}>
                <div className="flex justify-center"><Sigil el={el} size={40} /></div>
                <div className="text-[min(30px,4.6vh)] font-bold tracking-wide text-white" style={{ fontFamily: 'var(--font-pixel)', textShadow: '0 3px 12px rgba(0,0,0,.6)' }}>{title}</div>
                <div className="text-[min(12px,2vh)] font-semibold uppercase tracking-[0.3em] text-white/75">{sub}</div>
            </div>
        </div>
    );
}
function Peoples({ d }: { d: number }) {
    return (
        <div className="absolute inset-0 bg-black">
            <Panel i={0} d={d} title="Pyraxis" sub="Fire" el="fire">
                <svg viewBox="0 140 400 700" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full overflow-visible">
                    <defs><linearGradient id="p1" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="900"><stop offset="0" stopColor="#1a0505" /><stop offset="0.55" stopColor="#7a1f10" /><stop offset="1" stopColor="#ff7a3a" /></linearGradient></defs>
                    <rect x="-800" y="-600" width="2000" height="2200" fill="url(#p1)" />
                    <path d="M-20 620 L120 330 L170 360 L210 300 L280 400 L420 620 Z" fill="#2a1010" />
                    <path d="M190 310 Q200 280 220 300 L230 330 Z" fill="#ffb84a" style={{ animation: 'eid-breathe 1.6s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />
                    <path d="M205 320 Q180 420 230 480 Q260 560 200 640" stroke="#ff8a2a" strokeWidth="12" fill="none" strokeDasharray="30 18" style={{ animation: 'cs-lava 2s linear infinite' }} />
                    <path d="M205 320 Q180 420 230 480 Q260 560 200 640" stroke="#ffd06a" strokeWidth="4" fill="none" opacity="0.8" />
                    <path d="M-800 1600 L-800 640 L-20 640 Q200 600 420 650 L1200 650 L1200 1600 Z" fill="#1a0808" />
                </svg>
                <Particles n={22} color="#ffb84a" glow="#ff6a1a" size={4} area={{ x: 10, y: 50, w: 80, h: 50 }} speed={6} />
            </Panel>
            <Panel i={1} d={d} title="Zephyria" sub="Wind" el="air">
                <svg viewBox="0 140 400 700" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full overflow-visible">
                    <defs><linearGradient id="p2" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="900"><stop offset="0" stopColor="#7fb6e8" /><stop offset="0.7" stopColor="#d6ecff" /><stop offset="1" stopColor="#f6fbff" /></linearGradient></defs>
                    <rect x="-800" y="-600" width="2000" height="2200" fill="url(#p2)" />
                    {[[200, 360, 1.2], [80, 560, 0.7], [320, 640, 0.6]].map(([x, y, s], n) => (
                        <g key={n} style={{ animation: `eid-float ${6 + n}s ease-in-out ${n}s infinite` }}>
                            <g transform={`translate(${x} ${y}) scale(${s})`}>
                                <path d="M-90 0 Q0 -20 90 0 L50 50 L0 110 L-50 50 Z" fill="#8a8aa8" stroke="#3a3a5a" strokeWidth="4" />
                                <ellipse cx="0" cy="0" rx="92" ry="16" fill="#9ad07a" stroke="#3a3a5a" strokeWidth="4" />
                                <path d="M-30 -8 L-20 -40 L-10 -8 Z M10 -8 L22 -50 L34 -8 Z" fill="#4a8a5a" />
                            </g>
                        </g>
                    ))}
                    {Array.from({ length: 7 }, (_, n) => (
                        <path key={n} d={`M-40 ${200 + n * 90} Q120 ${170 + n * 90} 260 ${210 + n * 90} T560 ${200 + n * 90}`} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="120 600" opacity="0.7" style={{ animation: `cs-wind ${3 + (n % 3)}s linear ${n * 0.5}s infinite` }} />
                    ))}
                </svg>
            </Panel>
            <Panel i={2} d={d} title="Aquatica" sub="Tide" el="water">
                <svg viewBox="0 140 400 700" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full overflow-visible">
                    <defs><linearGradient id="p3" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="900"><stop offset="0" stopColor="#2a8ab0" /><stop offset="0.5" stopColor="#0a3a5a" /><stop offset="1" stopColor="#041a2a" /></linearGradient></defs>
                    <rect x="-800" y="-600" width="2000" height="2200" fill="url(#p3)" />
                    {[[60, 0.18], [170, 0.12], [290, 0.16]].map(([x, o], n) => <path key={n} d={`M${x} 0 L${x + 60} 0 L${x + 140} 900 L${x - 40} 900 Z`} fill="#bff3ff" opacity={o} style={{ animation: `eid-shimmer ${4 + n}s ease-in-out ${n}s infinite` }} />)}
                    <path d="M80 900 L80 560 Q200 440 320 560 L320 900 L280 900 L280 580 Q200 500 120 580 L120 900 Z" fill="#163a52" stroke="#0a2030" strokeWidth="4" />
                    <path d="M-800 1600 L-800 860 L-20 860 Q100 820 200 860 Q300 820 420 860 L1200 860 L1200 1600 Z" fill="#0a2030" />
                    {[[40, 760], [350, 700], [200, 800]].map(([x, y], n) => <path key={n} d={`M${x} ${y} q-10 -60 0 -120 q10 -60 0 -120`} stroke="#2a8a6a" strokeWidth="6" fill="none" style={{ animation: `eid-sway ${3 + n}s ease-in-out infinite`, transformOrigin: `${x}px ${y}px` }} />)}
                </svg>
                <Particles n={20} color="rgba(220,250,255,.7)" glow="#9ef" size={6} area={{ x: 10, y: 50, w: 80, h: 50 }} speed={7} />
            </Panel>
            <Panel i={3} d={d} title="Terragrim" sub="Stone" el="earth">
                <svg viewBox="0 140 400 700" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full overflow-visible">
                    <defs><radialGradient id="p4" gradientUnits="userSpaceOnUse" cx="200" cy="315" r="720"><stop offset="0" stopColor="#8a6a3a" /><stop offset="0.5" stopColor="#3a2412" /><stop offset="1" stopColor="#140a04" /></radialGradient></defs>
                    <rect x="-800" y="-600" width="2000" height="2200" fill="url(#p4)" />
                    <path d="M-800 -600 L60 -600 L60 0 Q120 180 90 380 Q40 600 60 900 L60 1600 L-800 1600 Z M1200 -600 L340 -600 L340 0 Q280 160 310 360 Q370 560 330 900 L330 1600 L1200 1600 Z" fill="#241408" />
                    {[[120, 0], [260, 0], [200, 0]].map(([x], n) => <path key={n} d={`M${x} 0 Q${x + 40} 200 ${x - 20} 380 Q${x - 60} 520 ${x + 10} 700`} stroke="#5a3a1a" strokeWidth={22 - n * 5} fill="none" strokeLinecap="round" />)}
                    {[[90, 700], [150, 740], [300, 690], [250, 760], [340, 740]].map(([x, y], n) => (
                        <g key={n}>
                            <ellipse cx={x} cy={y} rx="16" ry="9" fill="#7af0c8" style={{ animation: `eid-shimmer ${2 + n * 0.4}s ease-in-out infinite` }} />
                            <rect x={x - 3} y={y} width="6" height="22" fill="#d8c8a8" />
                        </g>
                    ))}
                    <path d="M-800 1600 L-800 780 L0 780 Q200 740 400 790 L1200 790 L1200 1600 Z" fill="#1a0e06" />
                </svg>
                <Particles n={18} color="#ffe2a8" glow="#c69c5d" size={3} area={{ x: 10, y: 20, w: 80, h: 70 }} speed={10} kind="float" />
            </Panel>
        </div>
    );
}

// ---------------------------------------------------------------- 3. the guardian
function Guardian({ d }: { d: number }) {
    const cols = [[220, 1], [420, 0.82], [590, 0.68], [1010, 0.68], [1180, 0.82], [1380, 1]] as const;
    return (
        <Camera d={d} from="scale(0.98)" to="scale(1.06)" origin="50% 55%">
            <Svg>
                <defs>
                    <linearGradient id="s3-wall" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="900"><stop offset="0" stopColor="#0d0a24" /><stop offset="1" stopColor="#2a2058" /></linearGradient>
                    <linearGradient id="s3-floor" gradientUnits="userSpaceOnUse" x1="0" y1="620" x2="0" y2="900"><stop offset="0" stopColor="#3a2e6a" /><stop offset="1" stopColor="#120c28" /></linearGradient>
                    <radialGradient id="s3-heart" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#fffbe0" /><stop offset="0.3" stopColor="#ffd06a" stopOpacity="0.85" /><stop offset="1" stopColor="#ff8a3a" stopOpacity="0" /></radialGradient>
                    <linearGradient id="s3-shaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe8b0" stopOpacity="0.4" /><stop offset="1" stopColor="#ffe8b0" stopOpacity="0" /></linearGradient>
                </defs>
                <rect x="-2400" y="-900" width="6400" height="2700" fill="url(#s3-wall)" />
                {/* the great window and its light */}
                <path d="M700 120 L900 120 L900 330 Q800 250 700 330 Z" fill="#ffcf8a" opacity="0.55" />
                <path d="M700 120 Q800 60 900 120" fill="none" stroke="#1a1238" strokeWidth="14" />
                <path d="M700 330 L900 330 L1240 900 L360 900 Z" fill="url(#s3-shaft)" style={{ animation: 'eid-shimmer 6s ease-in-out infinite' }} />
                <path d="M-2400 620 L4000 620 L4000 1800 L-2400 1800 Z" fill="url(#s3-floor)" />
                {[0, 1, 2, 3, 4].map((n) => <path key={n} d={`M${800 - (n + 1) * 260} 900 L${800 - (n + 1) * 40} 620`} stroke="#4a3e8a" strokeWidth="2" opacity="0.5" />)}
                {[0, 1, 2, 3, 4].map((n) => <path key={`r${n}`} d={`M${800 + (n + 1) * 260} 900 L${800 + (n + 1) * 40} 620`} stroke="#4a3e8a" strokeWidth="2" opacity="0.5" />)}
                {/* columns */}
                {cols.map(([x, s], n) => (
                    <g key={n} transform={`translate(${x} 620) scale(${s})`}>
                        <rect x="-36" y="-560" width="72" height="560" fill="#1e1844" stroke="#0a0820" strokeWidth="4" />
                        <rect x="-50" y="-590" width="100" height="34" fill="#2a2258" />
                        <rect x="-50" y="-10" width="100" height="20" fill="#2a2258" />
                        <rect x="-36" y="-560" width="16" height="560" fill="#3a3278" opacity="0.6" />
                    </g>
                ))}
                {/* the altar and the Heart */}
                <path d="M720 620 L880 620 L860 560 L740 560 Z" fill="#2e2660" stroke="#0a0820" strokeWidth="4" />
                <circle cx="800" cy="470" r="150" fill="url(#s3-heart)" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'eid-breathe 3s ease-in-out infinite' }} />
                <g style={{ animation: 'eid-float 4s ease-in-out infinite' }}>
                    <path d="M800 430 L828 472 L800 520 L772 472 Z" fill="#fff6c8" stroke="#ffb84a" strokeWidth="4" />
                </g>
                {/* Malakor, from behind */}
                <ellipse cx="640" cy="880" rx="120" ry="18" fill="#000" opacity="0.5" />
                <path d="M640 520 Q610 530 600 600 Q585 720 560 880 L720 880 Q695 720 680 600 Q670 530 640 520 Z" fill="#0b0716" />
                <path d="M640 470 Q612 476 608 520 Q640 540 672 520 Q668 476 640 470 Z" fill="#0b0716" />
                <path d="M600 600 Q560 660 540 700" stroke="#0b0716" strokeWidth="18" strokeLinecap="round" />
                <path d="M676 600 Q740 560 760 520" stroke="#0b0716" strokeWidth="16" strokeLinecap="round" style={{ ...at('cs-reach', d, 0.45, 0.4), transformBox: 'fill-box', transformOrigin: '0% 100%' }} />
                <path d="M640 470 Q612 476 608 520" stroke="#ffcf8a" strokeWidth="2" fill="none" opacity="0.5" />
            </Svg>
            <Particles n={30} color="#ffe8b0" glow="#ffd06a" size={3} area={{ x: 25, y: 10, w: 50, h: 70 }} speed={12} kind="float" />
        </Camera>
    );
}

// ---------------------------------------------------------------- 4. the exile
function Exile({ d }: { d: number }) {
    return (
        <Camera d={d} from="translateY(3%) scale(1)" to="translateY(-6%) scale(1.06)" origin="50% 50%">
            <Svg>
                <defs>
                    <linearGradient id="s4-sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="900"><stop offset="0" stopColor="#0a0a24" /><stop offset="0.4" stopColor="#2a1a4a" /><stop offset="1" stopColor="#070310" /></linearGradient>
                    <radialGradient id="s4-pit" cx="0.5" cy="1" r="0.8"><stop offset="0" stopColor="#b06bff" stopOpacity="0.8" /><stop offset="0.5" stopColor="#4a1a7a" stopOpacity="0.5" /><stop offset="1" stopColor="#070310" stopOpacity="0" /></radialGradient>
                </defs>
                <rect x="-2400" y="-900" width="6400" height="2700" fill="url(#s4-sky)" />
                <rect x="-400" y="300" width="2400" height="900" fill="url(#s4-pit)" style={{ animation: 'eid-shimmer 3s ease-in-out infinite' }} />
                {/* the chasm walls */}
                <path d="M-2400 260 L520 260 L560 320 L520 480 L560 700 L480 900 L480 1800 L-2400 1800 Z" fill="#120a24" stroke="#2a1a4a" strokeWidth="4" />
                <path d="M4000 260 L1080 260 L1040 330 L1080 500 L1030 720 L1110 900 L1110 1800 L4000 1800 Z" fill="#120a24" stroke="#2a1a4a" strokeWidth="4" />
                {/* the Council on the ledges, staffs raised, light converging */}
                {[120, 230, 340, 450, 1150, 1260, 1370, 1480].map((x, n) => (
                    <g key={n}>
                        <path d={`M${x} 260 Q${x - 18} 200 ${x - 14} 150 Q${x} 128 ${x + 14} 150 Q${x + 18} 200 ${x} 260 Z`} fill="#0b0716" />
                        <circle cx={x} cy="140" r="12" fill="#0b0716" />
                        <path d={`M${x + 16} 250 L${x + 30} 90`} stroke="#3a2a1a" strokeWidth="5" />
                        <circle cx={x + 30} cy="86" r="9" fill="#fff2c4" style={{ animation: 'eid-shimmer 1.4s ease-in-out infinite' }} />
                        <path d={`M${x + 30} 86 L800 ${380}`} stroke="#fff2c4" strokeWidth="3" opacity="0.5" style={at('cs-beam', d, 0.1, 0.5, 'ease-in-out both')} />
                    </g>
                ))}
                {/* Malakor falls */}
                <g style={at('cs-fall', d, 0.35, 0.55, 'ease-in both')}>
                    <g transform="translate(800 380)">
                        <path d="M0 -40 Q-22 -36 -26 -6 Q-30 40 -50 70 L50 70 Q30 40 26 -6 Q22 -36 0 -40 Z" fill="#0b0716" stroke="#b06bff" strokeWidth="2" />
                        <circle cx="0" cy="-50" r="16" fill="#0b0716" stroke="#b06bff" strokeWidth="2" />
                        <path d="M-26 -6 Q-60 -40 -70 -70 M26 -6 Q60 -40 70 -70" stroke="#0b0716" strokeWidth="10" strokeLinecap="round" />
                    </g>
                </g>
            </Svg>
            <Particles n={26} color="#d8b4fe" glow="#b06bff" size={4} area={{ x: 30, y: 40, w: 40, h: 60 }} speed={5} />
        </Camera>
    );
}

// ---------------------------------------------------------------- 5. the whispers
const WHISPERS = [
    { t: 'They steal your fire.', x: 14, y: 30 },
    { t: 'They poison your water.', x: 58, y: 22 },
    { t: 'They are coming for you.', x: 22, y: 58 },
    { t: 'Trust no one.', x: 64, y: 52 },
    { t: 'Strike first.', x: 40, y: 40 },
];
function Whispers({ d }: { d: number }) {
    return (
        <Camera d={d} from="scale(1.05)" to="scale(0.98)" origin="50% 50%">
            <Svg>
                <defs>
                    <radialGradient id="s5-fog" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#5a2a8a" stopOpacity="0.55" /><stop offset="1" stopColor="#5a2a8a" stopOpacity="0" /></radialGradient>
                    <radialGradient id="s5-eye" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#f5d0ff" /><stop offset="0.5" stopColor="#c084fc" /><stop offset="1" stopColor="#7a2ad0" stopOpacity="0" /></radialGradient>
                </defs>
                <rect x="-2400" y="-900" width="6400" height="2700" fill="#05020c" />
                {[[300, 300, 520], [1200, 360, 600], [800, 560, 700], [100, 700, 500], [1500, 720, 520]].map(([x, y, r], n) => (
                    <circle key={n} cx={x} cy={y} r={r} fill="url(#s5-fog)" style={{ animation: `eid-drift ${16 + n * 4}s ease-in-out ${-n * 3}s infinite alternate` }} />
                ))}
                {/* the eyes open */}
                <g style={at('cs-eyes', d, 0.05, 0.25)}>
                    <ellipse cx="700" cy="250" rx="60" ry="14" fill="url(#s5-eye)" />
                    <ellipse cx="900" cy="250" rx="60" ry="14" fill="url(#s5-eye)" />
                    <ellipse cx="700" cy="250" rx="10" ry="12" fill="#1a0030" />
                    <ellipse cx="900" cy="250" rx="10" ry="12" fill="#1a0030" />
                </g>
                {/* villages below, their fires turning from warm to angry */}
                <path d="M-2400 1800 L-2400 790 L0 790 Q400 760 800 780 Q1200 760 1600 790 L4000 790 L4000 1800 Z" fill="#0b0716" />
                {[150, 470, 790, 1110, 1430].map((x, n) => (
                    <g key={n}>
                        {[0, 1, 2].map((k) => <path key={k} d={`M${x + k * 46 - 46} 790 L${x + k * 46 - 46} 760 L${x + k * 46 - 26} 742 L${x + k * 46 - 6} 760 L${x + k * 46 - 6} 790 Z`} fill="#140c22" />)}
                        <circle cx={x} cy="800" r="9" style={{ ...at('cs-anger', d, 0.25 + n * 0.08, 0.3, 'ease-in-out both'), fill: '#ffd06a' }} />
                    </g>
                ))}
            </Svg>
            {WHISPERS.map((w, n) => (
                <div
                    key={n}
                    className="absolute whitespace-nowrap italic"
                    style={{ left: `${w.x}%`, top: `${w.y}%`, fontFamily: 'var(--font-pixel)', fontSize: 'min(30px, 4.6vh)', color: '#e9d5ff', textShadow: '0 0 18px #a855f7, 0 0 4px #a855f7', ...at('cs-whisper', d, 0.18 + n * 0.13, 0.32, 'ease-in-out both') }}
                >
                    {w.t}
                </div>
            ))}
            <Particles n={20} color="#c084fc" glow="#7a2ad0" size={3} area={{ x: 0, y: 10, w: 100, h: 80 }} speed={14} kind="float" />
        </Camera>
    );
}

// ---------------------------------------------------------------- 6. the sundering
function Sunder({ d }: { d: number }) {
    // Each piece turns about its own middle as it drifts away.
    const piece = (n: number): CSSProperties => ({ ...at(`cs-split${n}`, d, 0.46, 0.5, 'cubic-bezier(.2,.7,.2,1) both'), transformBox: 'fill-box', transformOrigin: 'center' });
    return (
        <div className="absolute inset-0" style={at('cs-shake', d, 0.44, 0.12, 'linear both')}>
            <Camera d={d} from="scale(1.05)" to="scale(0.96)" origin="50% 55%">
                <Svg>
                    <defs>
                        <linearGradient id="s6-sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="900"><stop offset="0" stopColor="#12040c" /><stop offset="0.5" stopColor="#5a1a2a" /><stop offset="1" stopColor="#ff6a3a" /></linearGradient>
                        <pattern id="cs-fall-dash" width="10" height="24" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#ffffff" opacity="0.7" /></pattern>
                    </defs>
                    <rect x="-2400" y="-900" width="6400" height="2700" fill="url(#s6-sky)" />
                    {/* the continent breaks in four */}
                    <defs>
                        <clipPath id="s6-q1"><path d="M0 0 L800 0 L790 480 L0 480 Z" /></clipPath>
                        <clipPath id="s6-q2"><path d="M800 0 L1600 0 L1600 470 L790 480 Z" /></clipPath>
                        <clipPath id="s6-q3"><path d="M0 480 L790 480 L780 900 L0 900 Z" /></clipPath>
                        <clipPath id="s6-q4"><path d="M790 480 L1600 470 L1600 900 L780 900 Z" /></clipPath>
                    </defs>
                    {[1, 2, 3, 4].map((n) => (
                        <g key={n} style={piece(n)}>
                            <g clipPath={`url(#s6-q${n})`}>
                                <Continent id={`s6c${n}`} top="#7a8a4a" top2="#b0904a" rock="#4a2a3a" rock2="#2a1424" heart={false} />
                            </g>
                        </g>
                    ))}
                    {/* cracks of fire spreading */}
                    <path d="M800 300 L795 380 L810 440 L790 480 L800 560 L784 650 L800 760" stroke="#ffd06a" strokeWidth="6" fill="none" strokeDasharray="600" style={at('cs-crack', d, 0.12, 0.3, 'ease-in both')} />
                    <path d="M330 470 L520 476 L660 470 L790 480 L930 474 L1080 478 L1270 470" stroke="#ffd06a" strokeWidth="6" fill="none" strokeDasharray="1000" style={at('cs-crack', d, 0.22, 0.24, 'ease-in both')} />
                    {/* the Heart shatters */}
                    <circle cx="800" cy="300" r="40" fill="#fff6c8" style={at('cs-burst', d, 0.43, 0.3, 'ease-out both')} />
                    {/* falling rocks */}
                    {Array.from({ length: 16 }, (_, n) => (
                        // (position on the outer group; the fall is a CSS transform on the rock itself, so they do not fight)
                        <g key={n} transform={`translate(${380 + ((n * 97) % 840)} ${500 + ((n * 41) % 120)})`}>
                            <path d="M0 0 L14 -6 L22 8 L8 18 L-6 10 Z" fill="#3a1e2a" stroke="#1a0a10" strokeWidth="2" style={{ ...at('cs-debris', d, 0.48 + (n % 5) * 0.03, 0.45, 'ease-in both'), transformBox: 'fill-box', transformOrigin: 'center' }} />
                        </g>
                    ))}
                </Svg>
                <Particles n={30} color="#ffb84a" glow="#ff4a1a" size={4} area={{ x: 20, y: 40, w: 60, h: 50 }} speed={5} />
            </Camera>
            {/* the flash */}
            <div className="pointer-events-none absolute inset-0 bg-white" style={at('cs-flash', d, 0.44, 0.14, 'ease-out both')} />
        </div>
    );
}

// ---------------------------------------------------------------- 7. the kingdoms and the citadel
function Kingdoms({ d }: { d: number }) {
    const isles: [number, number, string, Element][] = [[330, 520, '#ff6a3d', 'fire'], [560, 300, '#7dd3fc', 'air'], [1060, 320, '#38bdf8', 'water'], [1290, 540, '#c69c5d', 'earth']];
    return (
        <Camera d={d} from="translateX(2%) scale(0.98)" to="translateX(-2%) scale(1.05)" origin="50% 50%">
            <Svg>
                <defs>
                    <linearGradient id="s7-sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="900"><stop offset="0" stopColor="#0a0618" /><stop offset="0.6" stopColor="#2a1a4a" /><stop offset="1" stopColor="#4a2a5a" /></linearGradient>
                    <radialGradient id="s7-dome" cx="0.5" cy="0.6" r="0.6"><stop offset="0" stopColor="#c084fc" stopOpacity="0.05" /><stop offset="0.85" stopColor="#a855f7" stopOpacity="0.35" /><stop offset="1" stopColor="#e9d5ff" stopOpacity="0.7" /></radialGradient>
                    <radialGradient id="s7-vortex" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#000" /><stop offset="0.5" stopColor="#3a0a6a" /><stop offset="1" stopColor="#7a2ad0" stopOpacity="0" /></radialGradient>
                </defs>
                <rect x="-2400" y="-900" width="6400" height="2700" fill="url(#s7-sky)" />
                <g style={{ animation: 'eid-drift 34s ease-in-out infinite alternate' }}>
                    <Cloud x={120} y={780} s={2.4} lit="#5a3a7a" shade="#2a1a4a" />
                    <Cloud x={1150} y={790} s={2.6} lit="#5a3a7a" shade="#2a1a4a" />
                </g>
                {/* the four kingdoms under their barriers */}
                {isles.map(([x, y, c, g], n) => (
                    <g key={n} transform={`translate(${x} ${y})`}>
                        <g style={{ animation: `eid-float ${7 + n}s ease-in-out ${n}s infinite` }}>
                            <ellipse cx="0" cy="40" rx="130" ry="40" fill={c} opacity="0.25" />
                            <path d="M-110 0 Q0 -18 110 0 L70 50 L10 120 L-50 60 Z" fill="#2a2040" stroke="#0a0618" strokeWidth="4" />
                            <ellipse cx="0" cy="0" rx="112" ry="20" fill={c} opacity="0.85" stroke="#0a0618" strokeWidth="4" />
                            <path d="M-120 4 Q-120 -150 0 -150 Q120 -150 120 4" fill="url(#s7-dome)" stroke="#d8b4fe" strokeWidth="2" opacity="0.9" style={{ animation: `eid-shimmer ${2.5 + n * 0.4}s ease-in-out infinite` }} />
                            {/* the kingdom's emblem glowing inside its barrier */}
                            <circle cx="0" cy="-62" r="30" fill={c} opacity="0.25" />
                            <g transform="translate(-24 -86) scale(2)"><path d={ICON_PATHS[ELEMENT_ICON[g]]} fill="#fff7e0" fillRule="evenodd" style={{ filter: `drop-shadow(0 0 3px ${c})` }} /></g>
                        </g>
                    </g>
                ))}
                {/* the Void Citadel */}
                <g transform="translate(800 520)">
                    <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'cs-spin 9s linear infinite' }}>
                        <circle cx="0" cy="-250" r="190" fill="url(#s7-vortex)" />
                        {[0, 1, 2, 3].map((n) => <path key={n} d="M0 -250 m-170 0 a170 170 0 0 1 170 -170" stroke="#c084fc" strokeWidth="5" fill="none" opacity="0.6" transform={`rotate(${n * 90} 0 -250)`} />)}
                    </g>
                    <path d="M-150 120 Q0 90 150 120 L90 200 L0 260 L-90 200 Z" fill="#1a1030" stroke="#000" strokeWidth="4" />
                    <path d="M-60 120 L-40 -120 L-20 120 Z M-14 120 L0 -230 L14 120 Z M20 120 L40 -140 L60 120 Z" fill="#0b0716" stroke="#8b5cf6" strokeWidth="2" />
                    <path d="M0 -230 L0 -250" stroke="#e9d5ff" strokeWidth="4" />
                </g>
                {/* lightning from the vortex */}
                {[[-1, 0.2], [1, 0.55], [-1, 0.8]].map(([side, when], n) => (
                    <path key={n} d={`M800 270 L${800 + side * 80} 350 L${800 + side * 50} 370 L${800 + side * 170} 480`} stroke="#f0e0ff" strokeWidth="4" fill="none" style={at('cs-bolt', d, when, 0.06, 'linear both')} />
                ))}
            </Svg>
            <Particles n={24} color="#e9d5ff" glow="#a855f7" size={3} area={{ x: 0, y: 0, w: 100, h: 90 }} speed={6} kind="fall" />
        </Camera>
    );
}

// ---------------------------------------------------------------- 8. the survivor
const EDGE_FADE = 'linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent), linear-gradient(180deg, transparent, #000 3%, #000 97%, transparent)';
function Survivor({ d }: { d: number }) {
    return (
        <Camera d={d} from="scale(1.1)" to="scale(1)" origin="79% 100%">
            {/* the painting, soft and dim, filling whatever the window has beyond it */}
            <div className="absolute inset-0" style={{ filter: 'blur(14px) brightness(.75)', transform: 'scale(1.08)' }}>
                <LandscapeBackdrop />
            </div>
            {/* the painting itself, always whole from the peak to the wanderer's feet */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ containerType: 'size' }}>
                <div
                    className="relative"
                    style={{
                        width: 'min(100cqw, calc(100cqh * 1600 / 790))', height: 'min(100cqh, calc(100cqw * 790 / 1600))',
                        // Soft edges on every side, so the painting melts into its blurred surround.
                        maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE, maskComposite: 'intersect', WebkitMaskComposite: 'source-in',
                    }}
                >
                    <LandscapeBackdrop framed />
                </div>
            </div>
            {/* dawn breaking */}
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 70% 45%, rgba(255,214,140,.45), transparent 55%)', ...at('cs-dawn', d, 0.1, 0.8, 'ease-in-out both') }} />
        </Camera>
    );
}

export const SCENES: Record<SceneId, (p: { d: number }) => ReactNode> = {
    oneworld: OneWorld,
    peoples: Peoples,
    guardian: Guardian,
    exile: Exile,
    whispers: Whispers,
    sunder: Sunder,
    kingdoms: Kingdoms,
    survivor: Survivor,
};

/** Chapter captions in the top bar. */
export const CHAPTER: Record<SceneId, string> = {
    oneworld: 'I · The Heart of Eidolon',
    peoples: 'II · The Four Peoples',
    guardian: 'III · The Guardian',
    exile: 'IV · The Exile',
    whispers: 'V · The Whispers',
    sunder: 'VI · The Sundering',
    kingdoms: 'VII · The Fractured Lands',
    survivor: 'VIII · The Survivor',
};
