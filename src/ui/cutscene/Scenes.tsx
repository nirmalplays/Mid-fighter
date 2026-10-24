/**
 * The prologue's thirteen paintings, hand-built in SVG. Each takes the scene's length
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
            <Panel i={3} d={d} title="Terragrim" sub="Stone · The Conclave" el="earth">
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


// ---------------------------------------------------------------- 3. the Grand Arcane Tide
/** A demon of the abyss: a horned silhouette with burning eyes. */
function Demon({ x, y, s = 1, eye = '#ff4a1a', style }: { x: number; y: number; s?: number; eye?: string; style?: CSSProperties }) {
    return (
        <g transform={`translate(${x} ${y}) scale(${s})`}>
            <g style={style}>
                <path d="M-46 80 Q-60 20 -40 -20 Q-30 -50 -36 -78 Q-20 -60 -12 -50 Q0 -56 12 -50 Q20 -60 36 -78 Q30 -50 40 -20 Q60 20 46 80 Z" fill="#07030c" />
                <path d="M-40 -10 Q-80 10 -96 60 M40 -10 Q80 10 96 60" stroke="#07030c" strokeWidth="16" strokeLinecap="round" />
                <path d="M-96 60 l-10 14 M-96 60 l4 16 M96 60 l10 14 M96 60 l-4 16" stroke="#07030c" strokeWidth="6" strokeLinecap="round" />
                <ellipse cx="-12" cy="-30" rx="7" ry="4" fill={eye} style={{ filter: `drop-shadow(0 0 6px ${eye})` }} />
                <ellipse cx="12" cy="-30" rx="7" ry="4" fill={eye} style={{ filter: `drop-shadow(0 0 6px ${eye})` }} />
            </g>
        </g>
    );
}
function Tide({ d }: { d: number }) {
    return (
        <div className="absolute inset-0" style={at('cs-shake', d, 0.18, 0.1, 'linear both')}>
            <Camera d={d} from="scale(1.04)" to="scale(1.12)" origin="50% 70%">
                <Svg>
                    <defs>
                        <linearGradient id="t-sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="900"><stop offset="0" stopColor="#120414" /><stop offset="0.55" stopColor="#4a0e1e" /><stop offset="1" stopColor="#1a0608" /></linearGradient>
                        <radialGradient id="t-heart" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#fff" /><stop offset="0.3" stopColor="#ffb0f0" stopOpacity="0.9" /><stop offset="1" stopColor="#a020ff" stopOpacity="0" /></radialGradient>
                        <linearGradient id="t-rift" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e9d5ff" /><stop offset="0.4" stopColor="#a855f7" /><stop offset="1" stopColor="#2a0a4a" /></linearGradient>
                    </defs>
                    <rect x="-2400" y="-900" width="6400" height="2700" fill="url(#t-sky)" />
                    {/* the Heart, gone wild: it flickers and throws lightning */}
                    <circle cx="800" cy="200" r="150" fill="url(#t-heart)" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'eid-breathe 0.7s ease-in-out infinite' }} />
                    <path d="M800 170 L824 200 L800 236 L776 200 Z" fill="#fff6ff" stroke="#c084fc" strokeWidth="4" />
                    {[[-1, 0.1], [1, 0.3], [-1, 0.55], [1, 0.75]].map(([side, when], n) => (
                        <path key={n} d={`M800 220 L${800 + side * 60} 300 L${800 + side * 30} 320 L${800 + side * 140} 460`} stroke="#f0e0ff" strokeWidth="4" fill="none" style={at('cs-bolt', d, when, 0.06, 'linear both')} />
                    ))}
                    {/* the plain, split open */}
                    <path d="M-2400 560 L4000 560 L4000 1800 L-2400 1800 Z" fill="#1c0e12" />
                    <path d="M-2400 560 Q800 520 4000 560" stroke="#3a1a20" strokeWidth="6" fill="none" />
                    <g transform="translate(0 -90)">
                        {/* a tear across the plain, glowing from the abyss beneath */}
                        <g style={at('cs-reveal', d, 0.14, 0.18)}>
                            <path d="M220 770 L380 748 L470 770 L600 742 L720 768 L820 736 L940 766 L1080 740 L1200 764 L1380 752 L1210 800 L1090 784 L950 812 L820 790 L700 818 L590 792 L470 816 L360 796 Z" fill="url(#t-rift)" />
                            <ellipse cx="800" cy="780" rx="560" ry="80" fill="#a855f7" opacity="0.25" />
                        </g>
                        <path d="M220 770 L380 748 L470 770 L600 742 L720 768 L820 736 L940 766 L1080 740 L1200 764 L1380 752" stroke="#f5d0fe" strokeWidth="5" fill="none" strokeDasharray="1400" style={at('cs-crack', d, 0.1, 0.18, 'ease-in both')} />
                        {/* and the abyss climbs out */}
                        {[[480, 700, 0.8], [660, 690, 1.05], [860, 680, 1], [1060, 690, 0.85], [580, 720, 0.7], [960, 720, 0.75]].map(([x, y, sc], n) => (
                            <Demon key={n} x={x} y={y} s={sc} style={at('cs-climb', d, 0.32 + n * 0.07, 0.22)} />
                        ))}
                    </g>
                </Svg>
                <Particles n={30} color="#ff8a5a" glow="#ff2a1a" size={4} area={{ x: 15, y: 50, w: 70, h: 45 }} speed={5} />
            </Camera>
        </div>
    );
}

// ---------------------------------------------------------------- 4. the wars of the Tide: the nations united
const BANNERS: [string, Element][] = [['#e8553a', 'fire'], ['#9ad8f8', 'air'], ['#2f8ad0', 'water'], ['#b08a5a', 'earth']];
function United({ d }: { d: number }) {
    return (
        <Camera d={d} from="translateY(2%) scale(1)" to="translateY(-3%) scale(1.06)" origin="50% 50%">
            <Svg>
                <defs>
                    <linearGradient id="u-sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="900"><stop offset="0" stopColor="#1a1030" /><stop offset="0.5" stopColor="#6a2a3a" /><stop offset="1" stopColor="#ff9a5a" /></linearGradient>
                    <radialGradient id="u-pit" cx="0.5" cy="1" r="0.8"><stop offset="0" stopColor="#b06bff" stopOpacity="0.8" /><stop offset="1" stopColor="#0a0410" stopOpacity="0" /></radialGradient>
                </defs>
                <rect x="-2400" y="-900" width="6400" height="2700" fill="url(#u-sky)" />
                {/* the abyss below, and the horde in it being driven back down */}
                <rect x="600" y="520" width="900" height="500" fill="url(#u-pit)" />
                {[[860, 660, 0.9], [1000, 620, 1], [1140, 670, 0.85], [1280, 640, 0.8], [940, 740, 0.7], [1200, 750, 0.7]].map(([x, y, sc], n) => (
                    <Demon key={n} x={x} y={y} s={sc} style={at('cs-sink', d, 0.55 + n * 0.04, 0.3, 'ease-in both')} />
                ))}
                {/* the ridge: one shield wall under four banners */}
                <path d="M-2400 900 L-2400 520 L380 500 Q560 520 700 600 L760 900 Z" fill="#140a14" />
                {BANNERS.map(([c], n) => (
                    <g key={n} transform={`translate(${170 + n * 120} ${420 - n * 6})`}>
                        <path d="M0 0 L0 150" stroke="#2a1a14" strokeWidth="6" />
                        <path d="M0 0 L70 10 L60 40 L70 70 L0 60 Z" fill={c} stroke="#140a14" strokeWidth="3" style={{ animation: `eid-sway ${2 + n * 0.3}s ease-in-out infinite`, transformOrigin: '0px 0px' }} />
                    </g>
                ))}
                {Array.from({ length: 11 }, (_, n) => (
                    <g key={n} transform={`translate(${120 + n * 52} ${560 + (n % 2) * 6})`}>
                        <circle cx="0" cy="-58" r="12" fill="#0b0716" />
                        <path d="M-16 -46 L16 -46 L20 20 L-20 20 Z" fill="#0b0716" />
                        <ellipse cx="18" cy="-14" rx="18" ry="26" fill={BANNERS[n % 4][0]} stroke="#0b0716" strokeWidth="4" />
                    </g>
                ))}
                {/* the Conclave's mages on the ledge above, their light converging on the rift */}
                {[200, 300, 400, 500].map((x, n) => (
                    <g key={n}>
                        <path d={`M${x - 20} 400 Q${x - 16} 340 ${x - 9} 312 Q${x} 300 ${x + 9} 312 Q${x + 16} 340 ${x + 20} 400 Z`} fill="#0b0716" />
                        <path d={`M${x + 14} 400 L${x + 24} 270`} stroke="#3a2a1a" strokeWidth="4" />
                        <circle cx={x} cy="300" r="10" fill="#0b0716" />
                        <circle cx={x + 24} cy="270" r="8" fill="#fff2c4" style={{ animation: 'eid-shimmer 1.4s ease-in-out infinite' }} />
                        <path d={`M${x + 24} 270 L1060 650`} stroke="#fff2c4" strokeWidth="3" opacity="0.5" style={at('cs-beam', d, 0.45, 0.45, 'ease-in-out both')} />
                    </g>
                ))}
            </Svg>
            <Particles n={26} color="#ffd06a" glow="#ff8a3a" size={4} area={{ x: 40, y: 50, w: 50, h: 40 }} speed={5} />
        </Camera>
    );
}

// ---------------------------------------------------------------- 5. the Fourth Tide in the stars
function Charts({ d }: { d: number }) {
    return (
        <Camera d={d} from="scale(1)" to="scale(1.12)" origin="42% 55%">
            <Svg>
                <defs>
                    <radialGradient id="c-room" cx="0.5" cy="0.4" r="0.7"><stop offset="0" stopColor="#1e2a5a" /><stop offset="1" stopColor="#05060f" /></radialGradient>
                    <radialGradient id="c-omen" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#fff" /><stop offset="0.3" stopColor="#ff6a6a" /><stop offset="1" stopColor="#ff1a1a" stopOpacity="0" /></radialGradient>
                    <radialGradient id="c-candle" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ffd890" stopOpacity="0.8" /><stop offset="1" stopColor="#ffd890" stopOpacity="0" /></radialGradient>
                </defs>
                <rect x="-2400" y="-900" width="6400" height="2700" fill="url(#c-room)" />
                {/* the great round window full of stars */}
                <circle cx="800" cy="330" r="270" fill="#0a1030" stroke="#2a2a5a" strokeWidth="18" />
                {Array.from({ length: 60 }, (_, n) => <circle key={n} cx={800 + Math.cos(n * 2.4) * ((n * 37) % 250)} cy={330 + Math.sin(n * 2.4) * ((n * 37) % 250)} r={n % 6 ? 1.6 : 3} fill="#fff" style={{ animation: `eid-twinkle ${2 + (n % 3)}s ease-in-out ${n * 0.13}s infinite` }} />)}
                {/* the omen: a red star swelling */}
                <circle cx="930" cy="230" r="60" fill="url(#c-omen)" style={{ ...at('cs-grow', d, 0.35, 0.5), transformBox: 'fill-box', transformOrigin: 'center' }} />
                {/* the brass rings of the orrery turning */}
                {[[300, 90, 0], [240, 120, 40], [190, 70, -30]].map(([rx, ry, tilt], n) => (
                    <g key={n} transform={`rotate(${tilt} 800 330)`}>
                        <ellipse cx="800" cy="330" rx={rx} ry={ry} fill="none" stroke="#c69c5d" strokeWidth="5" opacity="0.8" strokeDasharray="40 14" style={{ animation: `cs-lava ${4 + n}s linear infinite` }} />
                    </g>
                ))}
                {/* the desk, the charts, a candle */}
                <path d="M300 900 L360 640 L1240 640 L1300 900 Z" fill="#1a1028" stroke="#05030a" strokeWidth="4" />
                <path d="M480 650 L760 630 L800 660 L520 690 Z" fill="#e8dcc0" stroke="#7a6a4a" strokeWidth="3" />
                {[0, 1, 2, 3].map((n) => <path key={n} d={`M${520 + n * 60} ${668 - n * 3} q30 -20 50 4`} stroke="#5a3a8a" strokeWidth="2" fill="none" />)}
                <circle cx="1080" cy="600" r="70" fill="url(#c-candle)" style={{ animation: 'eid-flicker 0.4s ease-in-out infinite' }} />
                <rect x="1072" y="610" width="16" height="34" fill="#e8dcc0" />
                <path d="M1080 592 Q1088 604 1080 612 Q1072 604 1080 592 Z" fill="#ffd06a" />
                {/* Malakor bent over the charts */}
                <path d="M640 640 Q600 560 620 500 Q640 460 690 470 Q740 480 760 540 Q770 600 760 640 Z" fill="#0b0716" />
                <circle cx="700" cy="456" r="26" fill="#0b0716" />
                <path d="M640 530 Q600 590 560 640" stroke="#0b0716" strokeWidth="18" strokeLinecap="round" />
                <path d="M700 430 L690 404 L706 420 L716 398 L720 428" fill="#0b0716" />
            </Svg>
            <Particles n={16} color="#ffe2a8" glow="#c69c5d" size={2} area={{ x: 30, y: 20, w: 40, h: 50 }} speed={12} kind="float" />
        </Camera>
    );
}

// ---------------------------------------------------------------- 6. the broken council
const ROYALS: { x: number; cloak: string; crown: string; standing?: boolean }[] = [
    { x: 420, cloak: '#8a2a1a', crown: '#ffb347', standing: true },
    { x: 640, cloak: '#a8c8e0', crown: '#e8f4ff' },
    { x: 960, cloak: '#1a4a7a', crown: '#7dd3fc' },
    { x: 1180, cloak: '#6a5034', crown: '#d8b878' },
];
function Council({ d }: { d: number }) {
    return (
        <Camera d={d} from="scale(1)" to="scale(1.08)" origin="50% 60%">
            <Svg>
                <defs>
                    <radialGradient id="k-room" cx="0.5" cy="0.35" r="0.75"><stop offset="0" stopColor="#4a3a2a" /><stop offset="1" stopColor="#0c0806" /></radialGradient>
                    <radialGradient id="k-anger" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ff4a1a" stopOpacity="0.55" /><stop offset="1" stopColor="#ff4a1a" stopOpacity="0" /></radialGradient>
                </defs>
                <rect x="-2400" y="-900" width="6400" height="2700" fill="url(#k-room)" />
                {/* the four banners, hung apart */}
                {BANNERS.map(([c], n) => (
                    <g key={n} transform={`translate(${380 + n * 280} 90)`}>
                        <path d="M-50 0 L50 0 L50 230 L0 200 L-50 230 Z" fill={c} stroke="#0c0806" strokeWidth="4" opacity="0.85" />
                        <g transform="translate(-24 60) scale(2)"><path d={ICON_PATHS[ELEMENT_ICON[BANNERS[n][1]]]} fill="#fff7e0" fillRule="evenodd" opacity="0.8" /></g>
                    </g>
                ))}
                {/* the king of Pyraxis, on his feet and furious */}
                <ellipse cx="420" cy="430" rx="160" ry="160" fill="url(#k-anger)" style={at('cs-reveal', d, 0.32, 0.12)} />
                {ROYALS.map((r, n) => (
                    <g key={n} transform={`translate(${r.x} ${r.standing ? 470 : 520})`}>
                        <g style={n === 0 ? at('cs-slam', d, 0.35, 0.08, 'linear both') : undefined}>
                            <path d="M-70 200 Q-74 60 -40 10 Q0 -14 40 10 Q74 60 70 200 Z" fill={r.cloak} stroke="#0c0806" strokeWidth="5" />
                            <circle cx="0" cy="-20" r="34" fill="#1a1210" stroke="#0c0806" strokeWidth="4" />
                            <path d="M-30 -48 L-22 -78 L-8 -56 L0 -84 L8 -56 L22 -78 L30 -48 Z" fill={r.crown} stroke="#0c0806" strokeWidth="3" />
                            {r.standing && <path d="M50 40 Q110 90 120 170" stroke={r.cloak} strokeWidth="26" strokeLinecap="round" />}
                        </g>
                    </g>
                ))}
                {/* the table */}
                <path d="M200 900 L300 660 L1300 660 L1400 900 Z" fill="#3a2414" stroke="#0c0806" strokeWidth="5" />
                <path d="M300 660 L1300 660 L1290 690 L310 690 Z" fill="#5a3a20" />
                <path d="M700 676 L900 676" stroke="#e8dcc0" strokeWidth="10" opacity="0.8" />
                {/* Malakor, apart, his charts unheeded */}
                <g transform="translate(1440 520)" style={at('cs-fade-up', d, 0.62, 0.15)}>
                    <path d="M-50 260 Q-56 80 -30 30 Q0 4 30 30 Q56 80 50 260 Z" fill="#2a1a44" stroke="#0c0806" strokeWidth="5" />
                    <circle cx="0" cy="10" r="26" fill="#1a1028" stroke="#0c0806" strokeWidth="4" />
                    <path d="M-26 -6 L-18 -34 L-6 -16 L0 -40 L6 -16 L18 -34 L26 -6 Z" fill="#140e1e" />
                    <path d="M-40 120 L40 110" stroke="#e8dcc0" strokeWidth="10" />
                </g>
            </Svg>
            <Particles n={14} color="#ffb070" glow="#ff6a1a" size={3} area={{ x: 15, y: 40, w: 30, h: 40 }} speed={6} />
        </Camera>
    );
}

// ---------------------------------------------------------------- 7. the Arch-Mage's verdict
const VERDICT = [
    { t: 'There will be no war.', x: 12, y: 30 },
    { t: 'Break the Heart.', x: 60, y: 24 },
    { t: 'End the cycle.', x: 20, y: 58 },
    { t: 'Forever.', x: 64, y: 54 },
];
function Verdict({ d }: { d: number }) {
    return (
        <Camera d={d} from="scale(1.05)" to="scale(0.98)" origin="50% 50%">
            <Svg>
                <defs>
                    <radialGradient id="v-fog" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#5a2a8a" stopOpacity="0.55" /><stop offset="1" stopColor="#5a2a8a" stopOpacity="0" /></radialGradient>
                    <radialGradient id="v-eye" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#f5d0ff" /><stop offset="0.5" stopColor="#c084fc" /><stop offset="1" stopColor="#7a2ad0" stopOpacity="0" /></radialGradient>
                </defs>
                <rect x="-2400" y="-900" width="6400" height="2700" fill="#05020c" />
                {[[300, 300, 520], [1200, 360, 600], [800, 560, 700], [100, 700, 500], [1500, 720, 520]].map(([x, y, r], n) => (
                    <circle key={n} cx={x} cy={y} r={r} fill="url(#v-fog)" style={{ animation: `eid-drift ${16 + n * 4}s ease-in-out ${-n * 3}s infinite alternate` }} />
                ))}
                {/* his eyes open in the dark: the decision made */}
                <g style={at('cs-eyes', d, 0.05, 0.25)}>
                    <ellipse cx="700" cy="250" rx="60" ry="14" fill="url(#v-eye)" />
                    <ellipse cx="900" cy="250" rx="60" ry="14" fill="url(#v-eye)" />
                    <ellipse cx="700" cy="250" rx="10" ry="12" fill="#1a0030" />
                    <ellipse cx="900" cy="250" rx="10" ry="12" fill="#1a0030" />
                </g>
                {/* the Heart below him, and the four lines he will cut it along */}
                <circle cx="800" cy="620" r="90" fill="#ffd06a" opacity="0.25" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'eid-breathe 3s ease-in-out infinite' }} />
                <path d="M800 586 L826 620 L800 660 L774 620 Z" fill="#fff6c8" stroke="#ffb84a" strokeWidth="3" />
                <path d="M800 520 L800 720 M700 620 L900 620" stroke="#c084fc" strokeWidth="4" strokeDasharray="300" style={at('cs-crack', d, 0.5, 0.3, 'ease-in both')} />
            </Svg>
            {VERDICT.map((w, n) => (
                <div
                    key={n}
                    className="absolute whitespace-nowrap italic"
                    style={{ left: `${w.x}%`, top: `${w.y}%`, fontFamily: 'var(--font-pixel)', fontSize: 'min(30px, 4.6vh)', color: '#e9d5ff', textShadow: '0 0 18px #a855f7, 0 0 4px #a855f7', ...at('cs-whisper', d, 0.12 + n * 0.17, 0.3, 'ease-in-out both') }}
                >
                    {w.t}
                </div>
            ))}
            <Particles n={20} color="#c084fc" glow="#7a2ad0" size={3} area={{ x: 0, y: 10, w: 100, h: 80 }} speed={14} kind="float" />
        </Camera>
    );
}

// ---------------------------------------------------------------- 8. the shattering
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

// ---------------------------------------------------------------- 9. what was forgotten: four lands apart, and the Mist
/** What the Mist took, drifting up and away as it is forgotten. */
const FORGOTTEN = [
    { t: 'the old songs', x: 10, y: 24 }, { t: 'our alliance', x: 64, y: 18 }, { t: 'my brother’s name', x: 30, y: 46 },
    { t: 'the Tide wars', x: 70, y: 50 }, { t: 'who we were', x: 44, y: 70 },
];
function Aftermath({ d }: { d: number }) {
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
            {/* the pale Mist rolling over everything */}
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 60%, rgba(230,226,240,.55), transparent 55%), radial-gradient(ellipse at 75% 40%, rgba(230,226,240,.45), transparent 50%)', ...at('cs-mist', d, 0.4, 0.6, 'ease-in-out both') }} />
            {FORGOTTEN.map((w, n) => (
                <div key={n} className="pointer-events-none absolute whitespace-nowrap italic" style={{ left: `${w.x}%`, top: `${w.y}%`, fontFamily: 'var(--font-pixel)', fontSize: 'min(24px, 3.8vh)', color: '#f4f2fa', textShadow: '0 0 12px #cbd5e1', ...at('cs-forget', d, 0.5 + n * 0.08, 0.3, 'ease-in-out both') }}>{w.t}</div>
            ))}
        </Camera>
    );
}


// ---------------------------------------------------------------- 10. the jailers over the Cores
// Three Cores with their jailers (Storm, Fire with Ignis, Frost); the Heart itself is in the citadel (the fourth vault).
const CELLS: { x: number; core: string; eye: string; big?: boolean }[] = [
    { x: 250, core: '#7dd3fc', eye: '#bae6fd' },
    { x: 590, core: '#ff6a3d', eye: '#ffd06a', big: true },
    { x: 1010, core: '#38bdf8', eye: '#a5f3fc' },
];
function Wardens({ d }: { d: number }) {
    return (
        <Camera d={d} from="scale(1)" to="scale(1.14)" origin="37% 55%">
            <Svg>
                <rect x="-2400" y="-900" width="6400" height="2700" fill="#05030a" />
                {CELLS.map((c, n) => (
                    <g key={n}>
                        {/* the vault, the Core on its pedestal, its light */}
                        <path d={`M${c.x - 150} 820 L${c.x - 150} 230 Q${c.x} 120 ${c.x + 150} 230 L${c.x + 150} 820 Z`} fill="#0e0a16" stroke="#1e1830" strokeWidth="6" />
                        <g opacity="0.22"><ellipse cx={c.x} cy="700" rx="120" ry="60" fill={c.core} style={{ animation: `cs-pulse ${2 + n * 0.3}s ease-in-out infinite` }} /></g>
                        <rect x={c.x - 34} y="690" width="68" height="110" fill="#1e1830" stroke="#05030a" strokeWidth="4" />
                        <path d={`M${c.x} 620 L${c.x + 26} 660 L${c.x} 700 L${c.x - 26} 660 Z`} fill={c.core} stroke="#fff" strokeWidth="3" style={{ filter: `drop-shadow(0 0 14px ${c.core})` }} />
                        {/* the jailer, chained above it */}
                        <g style={{ animation: `eid-float ${4 + n}s ease-in-out infinite` }}>
                            <Demon x={c.x} y={c.big ? 420 : 440} s={c.big ? 1.6 : 1.15} eye={c.eye} />
                        </g>
                        {[-1, 1].map((side) => (
                            <path key={side} d={`M${c.x + side * 140} 240 Q${c.x + side * 80} 330 ${c.x + side * 30} ${c.big ? 400 : 420}`} stroke="#5a5070" strokeWidth="7" fill="none" strokeDasharray="14 8" />
                        ))}
                    </g>
                ))}
                {/* the fourth: no jailer, only the Heart, kept in his citadel where Terragrim stood */}
                <g style={at('cs-reveal', d, 0.68, 0.12)}>
                    <path d="M1200 820 L1200 230 Q1350 120 1500 230 L1500 820 Z" fill="#120a1e" stroke="#3a2a5a" strokeWidth="6" />
                    <path d="M1290 820 L1310 360 L1350 250 L1390 360 L1410 820 Z" fill="#1a1028" stroke="#8b5cf6" strokeWidth="3" />
                    <circle cx="1350" cy="560" r="110" fill="#ffd06a" opacity="0.25" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'eid-breathe 3s ease-in-out infinite' }} />
                    <path d="M1350 520 L1378 560 L1350 604 L1322 560 Z" fill="#fff6c8" stroke="#ffb84a" strokeWidth="4" />
                    <path d="M1350 250 L1350 210" stroke="#e9d5ff" strokeWidth="4" />
                </g>
                {/* the light falls on Pyraxis's jailer when the narrator names him */}
                <g opacity="0.35"><ellipse cx="590" cy="440" rx="230" ry="300" fill="#ff6a1a" style={at('cs-reveal', d, 0.4, 0.15)} /></g>
            </Svg>
            <Particles n={20} color="#ffb070" glow="#ff4a1a" size={3} area={{ x: 26, y: 30, w: 22, h: 60 }} speed={6} />
        </Camera>
    );
}

// ---------------------------------------------------------------- 11. three hundred years: the Cores bleeding
function Cracks({ d }: { d: number }) {
    const isles: [number, number, string][] = [[330, 380, '#ff6a3d'], [600, 230, '#7dd3fc'], [1000, 240, '#38bdf8'], [1270, 390, '#c084fc']];
    return (
        <div className="absolute inset-0" style={at('cs-shake', d, 0.5, 0.12, 'linear both')}>
            <Camera d={d} from="scale(1)" to="scale(1.1)" origin="50% 70%">
                <Svg>
                    <defs>
                        <linearGradient id="r-sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="900"><stop offset="0" stopColor="#0a0618" /><stop offset="1" stopColor="#2a0a30" /></linearGradient>
                    </defs>
                    <rect x="-2400" y="-900" width="6400" height="2700" fill="url(#r-sky)" />
                    {/* the Maelstrom, rising and turning */}
                    <defs>
                        <radialGradient id="r-pool" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#000" /><stop offset="0.35" stopColor="#1a0630" /><stop offset="0.8" stopColor="#5a1a8a" stopOpacity="0.7" /><stop offset="1" stopColor="#5a1a8a" stopOpacity="0" /></radialGradient>
                    </defs>
                    <g transform="translate(800 800) scale(1 0.34)">
                        <circle cx="0" cy="0" r="720" fill="url(#r-pool)" />
                        <g style={{ animation: 'cs-spin 9s linear infinite' }}>
                            {Array.from({ length: 10 }, (_, n) => (
                                <path key={n} d={`M0 0 Q${180 + n * 10} ${-60 - n * 20} ${300 + n * 40} ${120 + n * 30}`} stroke="#c084fc" strokeWidth={9 - n * 0.6} fill="none" opacity={0.75 - n * 0.05} strokeLinecap="round" transform={`rotate(${n * 36})`} />
                            ))}
                        </g>
                    </g>
                    {/* the four lands, cracked, their Cores' light bleeding out of them */}
                    {isles.map(([x, y, c], n) => (
                        <g key={n} transform={`translate(${x} ${y})`}>
                            <g style={{ animation: `eid-float ${6 + n}s ease-in-out ${n}s infinite` }}>
                                <path d="M-110 0 Q0 -18 110 0 L70 50 L10 120 L-50 60 Z" fill="#2a2040" stroke="#0a0618" strokeWidth="4" />
                                <ellipse cx="0" cy="0" rx="112" ry="20" fill={c} opacity="0.8" stroke="#0a0618" strokeWidth="4" />
                                <path d="M-30 -2 L-10 30 L-20 60 L0 100" stroke={c} strokeWidth="5" fill="none" strokeDasharray="200" style={{ ...at('cs-crack', d, 0.1 + n * 0.08, 0.3, 'ease-in both'), filter: `drop-shadow(0 0 6px ${c})` }} />
                                {[0, 1, 2].map((k) => <rect key={k} x={-6 + k * 10} y="110" width="5" height="120" fill={c} opacity="0.7" style={{ animation: `cs-dash ${0.8 + k * 0.2}s linear infinite` }} />)}
                            </g>
                        </g>
                    ))}
                    {/* eyes in the dark water: the jailers waking */}
                    {[[560, 640], [1040, 660], [800, 720]].map(([x, y], n) => (
                        <g key={n} style={at('cs-eyes', d, 0.45 + n * 0.1, 0.15)}>
                            <ellipse cx={x - 14} cy={y} rx="9" ry="4" fill="#ff4a1a" />
                            <ellipse cx={x + 14} cy={y} rx="9" ry="4" fill="#ff4a1a" />
                        </g>
                    ))}
                </Svg>
                <Particles n={24} color="#e9d5ff" glow="#a855f7" size={3} area={{ x: 0, y: 0, w: 100, h: 90 }} speed={6} kind="fall" />
            </Camera>
        </div>
    );
}

// ---------------------------------------------------------------- 12. the guild, the Pillar, you and Lyra
function Guild({ d }: { d: number }) {
    return (
        <Camera d={d} from="scale(1.02)" to="scale(1.12)" origin="55% 60%">
            <Svg>
                <defs>
                    <radialGradient id="g-cave" cx="0.55" cy="0.55" r="0.7"><stop offset="0" stopColor="#5a3a24" /><stop offset="1" stopColor="#0c0604" /></radialGradient>
                    <radialGradient id="g-lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ffd890" stopOpacity="0.55" /><stop offset="1" stopColor="#ffd890" stopOpacity="0" /></radialGradient>
                    <radialGradient id="g-pillar" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#bae6fd" stopOpacity="0.7" /><stop offset="1" stopColor="#7dd3fc" stopOpacity="0" /></radialGradient>
                </defs>
                <rect x="-2400" y="-900" width="6400" height="2700" fill="url(#g-cave)" />
                {/* the cavern's rock arch */}
                <path d="M-2400 -900 L4000 -900 L4000 1800 L1480 1800 L1500 500 Q1460 160 1100 90 Q800 40 500 90 Q140 160 100 500 L120 1800 L-2400 1800 Z" fill="#140a06" />
                {/* scaffolds and lanterns */}
                {[[260, 520], [1340, 500]].map(([x, y], n) => (
                    <g key={n}>
                        <path d={`M${x - 60} 900 L${x - 60} ${y} M${x + 60} 900 L${x + 60} ${y} M${x - 70} ${y} L${x + 70} ${y} M${x - 60} ${y + 140} L${x + 60} ${y + 60}`} stroke="#6a4224" strokeWidth="12" />
                        <circle cx={x} cy={y - 30} r="90" fill="url(#g-lamp)" style={{ animation: 'eid-flicker 0.5s ease-in-out infinite' }} />
                        <rect x={x - 10} y={y - 46} width="20" height="28" fill="#ffd06a" stroke="#3a2010" strokeWidth="3" />
                    </g>
                ))}
                {/* the Memory Pillar */}
                <circle cx="860" cy="430" r="230" fill="url(#g-pillar)" style={{ animation: 'cs-pulse 3s ease-in-out infinite' }} />
                <path d="M830 760 L838 230 L860 190 L882 230 L890 760 Z" fill="#7dd3fc" stroke="#0c0604" strokeWidth="6" />
                <path d="M846 740 L850 250 L858 236 L862 740 Z" fill="#fff" opacity="0.55" />
                {/* Lyra, reaching for the stone */}
                <g transform="translate(720 760)">
                    <path d="M-34 0 Q-36 -90 -14 -120 Q0 -130 14 -120 Q36 -90 34 0 Z" fill="#2f7a6a" stroke="#0c0604" strokeWidth="5" />
                    <circle cx="0" cy="-146" r="28" fill="#f2c9a0" stroke="#0c0604" strokeWidth="4" />
                    <path d="M-30 -150 Q-34 -186 0 -182 Q34 -186 30 -150 L32 -96 L20 -100 L22 -150 Z" fill="#8a3a1c" stroke="#0c0604" strokeWidth="4" />
                    <rect x="-28" y="-172" width="56" height="10" fill="#e0a948" />
                    <path d="M26 -96 Q70 -130 100 -170" stroke="#2f7a6a" strokeWidth="18" strokeLinecap="round" style={at('cs-reach', d, 0.3, 0.3)} />
                </g>
                {/* and you, with your pick, a step behind */}
                <g transform="translate(560 790)">
                    <path d="M-34 0 Q-36 -90 -14 -120 Q0 -130 14 -120 Q36 -90 34 0 Z" fill="#5a6e8a" stroke="#0c0604" strokeWidth="5" />
                    <circle cx="0" cy="-146" r="28" fill="#e8c09a" stroke="#0c0604" strokeWidth="4" />
                    <path d="M-30 -160 Q0 -196 30 -160 Z" fill="#5a3a22" stroke="#0c0604" strokeWidth="4" />
                    <path d="M30 -80 L80 -180 M60 -190 L100 -170" stroke="#7a5a3a" strokeWidth="10" strokeLinecap="round" />
                </g>
            </Svg>
            <Particles n={26} color="#fff2c4" glow="#ffd06a" size={2} area={{ x: 25, y: 10, w: 55, h: 70 }} speed={11} kind="float" />
        </Camera>
    );
}

// ---------------------------------------------------------------- 13. where your story begins
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
    tide: Tide,
    united: United,
    charts: Charts,
    council: Council,
    verdict: Verdict,
    sunder: Sunder,
    aftermath: Aftermath,
    wardens: Wardens,
    cracks: Cracks,
    guild: Guild,
    survivor: Survivor,
};

/** Chapter captions in the top bar. */
export const CHAPTER: Record<SceneId, string> = {
    oneworld: 'I · The Heart of the World',
    peoples: 'II · The Four Nations',
    tide: 'III · The Grand Arcane Tide',
    united: 'IV · The Wars of the Tide',
    charts: 'V · The Fourth Tide',
    council: 'VI · The Broken Council',
    verdict: 'VII · The Arch-Mage’s Verdict',
    sunder: 'VIII · The Shattering',
    aftermath: 'IX · What Was Forgotten',
    wardens: 'X · The Jailers',
    cracks: 'XI · Three Hundred Years',
    guild: 'XII · The Stone That Remembers',
    survivor: 'XIII · Your Story',
};
