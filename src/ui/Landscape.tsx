/**
 * The home screen's painting: a dusk sky over a great mountain lit gold on its sunward
 * face, clouds and a flock of cranes, a still lake, dark shore rocks, reeds in the
 * foreground and a wanderer in a straw hat looking out toward the peaks. Hand-built SVG
 * in layers, with slow motion (drifting clouds, flying cranes, swaying reeds, a scarf in
 * the wind) from the keyframes in styles/app.css, and a little parallax with the pointer.
 */
import { useEffect, useMemo, useState } from 'react';

/** A puffy cloud: overlapping circles, lit warm on top and lilac underneath. */
export function Cloud({ x, y, s, lit = '#ffd6b0', shade = '#b79bd6' }: { x: number; y: number; s: number; lit?: string; shade?: string }) {
    const puffs: [number, number, number][] = [[0, 0, 34], [36, -14, 40], [78, -4, 32], [108, 8, 24], [-30, 10, 24], [50, 14, 30]];
    return (
        <g transform={`translate(${x} ${y}) scale(${s})`}>
            {puffs.map(([px, py, r], n) => <circle key={`s${n}`} cx={px} cy={py + 8} r={r} fill={shade} />)}
            {puffs.map(([px, py, r], n) => <circle key={`l${n}`} cx={px - 2} cy={py} r={r * 0.92} fill={lit} />)}
            <ellipse cx={40} cy={24} rx={84} ry={14} fill={shade} opacity={0.9} />
        </g>
    );
}

/** A crane in flight: white body, black wingtips (wings beat with eid-flap). */
export function Crane({ x, y, s, delay }: { x: number; y: number; s: number; delay: number }) {
    return (
        <g transform={`translate(${x} ${y}) scale(${s})`}>
            <g style={{ animation: `eid-flap 1.1s ease-in-out ${delay}s infinite`, transformOrigin: '0px 0px', transformBox: 'fill-box' }}>
                <path d="M-22 -6 Q-10 -14 0 0 Q10 -14 22 -6 Q12 -4 0 4 Q-12 -4 -22 -6 Z" fill="#fbf7f2" />
                <path d="M-22 -6 Q-17 -9 -13 -8 L-16 -3 Z M22 -6 Q17 -9 13 -8 L16 -3 Z" fill="#1d1a2e" />
            </g>
            <path d="M-2 1 L14 3 L16 2 L2 -1 Z" fill="#fbf7f2" />
            <circle cx={16} cy={2.2} r={1.6} fill="#c0392b" />
        </g>
    );
}

/** `framed`: show exactly the part from the peak down to the wanderer's feet (the cutscene fits that box whole). */
/** The landscape's essential part: the mountain's peak (y 128) to the wanderer's feet (y 900). */
export const LANDSCAPE_FRAME = '0 110 1600 790';
export function LandscapeBackdrop({ framed = false }: { framed?: boolean } = {}) {
    const [p, setP] = useState({ x: 0, y: 0 });
    useEffect(() => {
        const on = (e: PointerEvent) => setP({ x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 });
        window.addEventListener('pointermove', on);
        return () => window.removeEventListener('pointermove', on);
    }, []);
    const par = (depth: number) => ({ transform: `translate(${-p.x * 26 * depth}px, ${-p.y * 12 * depth}px)`, transition: 'transform .25s ease-out' });
    // Reeds: fixed at first render so they do not jump about.
    const reeds = useMemo(() => Array.from({ length: 70 }, (_, n) => {
        const x = 980 + n * 9.2 + Math.sin(n * 7.3) * 14;
        const h = 150 + Math.abs(Math.sin(n * 2.1)) * 170;
        const bend = Math.sin(n * 1.7) * 26;
        return { x, h, bend, head: n % 3 !== 0, delay: (n % 9) * 0.23, tone: n % 4 };
    }), []);
    const leftReeds = useMemo(() => Array.from({ length: 22 }, (_, n) => ({ x: 20 + n * 13, h: 60 + Math.abs(Math.sin(n * 1.9)) * 80, bend: Math.sin(n) * 12, delay: (n % 7) * 0.3 })), []);
    const REED = ['#d9a441', '#b88a3a', '#e8c46a', '#9a7a3a'];

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ background: '#2a1f5c' }}>
            <svg viewBox={framed ? LANDSCAPE_FRAME : '0 0 1600 900'} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
                <defs>
                    <linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#231a55" />
                        <stop offset="0.35" stopColor="#4a3486" />
                        <stop offset="0.6" stopColor="#9a5a9c" />
                        <stop offset="0.78" stopColor="#e88a6f" />
                        <stop offset="0.9" stopColor="#f6b46a" />
                    </linearGradient>
                    <radialGradient id="ls-sun" cx="0.72" cy="0.42" r="0.45">
                        <stop offset="0" stopColor="#ffd98a" stopOpacity="0.9" />
                        <stop offset="0.4" stopColor="#ff9a5a" stopOpacity="0.35" />
                        <stop offset="1" stopColor="#ff9a5a" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="ls-lit" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#ffe3a0" />
                        <stop offset="0.45" stopColor="#f6a85a" />
                        <stop offset="1" stopColor="#d9744a" />
                    </linearGradient>
                    <linearGradient id="ls-shade" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#7a5aa6" />
                        <stop offset="1" stopColor="#4a3a86" />
                    </linearGradient>
                    <linearGradient id="ls-lake" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#b08ad0" />
                        <stop offset="0.4" stopColor="#6a6ac8" />
                        <stop offset="1" stopColor="#2d3a8a" />
                    </linearGradient>
                    <linearGradient id="ls-mist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#f3c8d8" stopOpacity="0" />
                        <stop offset="1" stopColor="#f3c8d8" stopOpacity="0.55" />
                    </linearGradient>
                    <linearGradient id="ls-hat" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#ffe08a" />
                        <stop offset="1" stopColor="#d99a3a" />
                    </linearGradient>
                </defs>

                {/* sky and sun */}
                <rect width="1600" height="900" fill="url(#ls-sky)" />
                <rect width="1600" height="900" fill="url(#ls-sun)" />
                {[[120, 80], [340, 40], [520, 120], [760, 60], [1420, 70], [1260, 30], [220, 190], [640, 200]].map(([x, y], n) => (
                    <circle key={n} cx={x} cy={y} r={n % 3 ? 1.2 : 1.8} fill="#fff" opacity={0.7} style={{ animation: `eid-twinkle ${2 + (n % 3)}s ease-in-out ${n * 0.4}s infinite` }} />
                ))}

                {/* far ridges */}
                <g style={par(0.15)}>
                    <path d="M0 560 L120 500 L230 530 L360 470 L470 520 L560 490 L640 540 L640 600 L0 600 Z" fill="#8a6ab8" opacity="0.7" />
                    <path d="M1250 540 L1350 490 L1460 520 L1600 470 L1600 600 L1250 600 Z" fill="#8a6ab8" opacity="0.6" />
                </g>

                {/* the great mountain */}
                <g style={par(0.3)}>
                    <path d="M560 620 L760 420 L860 360 L960 230 L1040 150 L1080 128 L1120 160 L1180 230 L1260 300 L1330 360 L1420 430 L1600 560 L1600 640 L560 640 Z" fill="url(#ls-shade)" />
                    {/* sunlit faces */}
                    <path d="M1080 128 L1120 160 L1180 230 L1260 300 L1330 360 L1420 430 L1500 500 L1380 520 L1250 470 L1170 400 L1120 330 L1095 240 Z" fill="url(#ls-lit)" />
                    <path d="M1080 128 L1060 200 L1010 260 L960 330 L900 380 L960 380 L1030 330 L1070 260 Z" fill="#f2b977" opacity="0.85" />
                    <path d="M860 360 L900 380 L820 450 L760 470 L800 420 Z" fill="#e9a36a" opacity="0.6" />
                    {/* snow and ridges */}
                    <path d="M1080 128 L1100 150 L1094 190 L1080 170 L1066 196 L1058 160 Z" fill="#fff4e0" />
                    <path d="M1095 240 L1120 330 L1170 400 L1250 470" fill="none" stroke="#c86a4a" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
                    <path d="M1060 200 L1010 260 L960 330 L900 380" fill="none" stroke="#5a3d8a" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
                    <path d="M640 560 L760 470 L830 500 L900 470 L980 520 L1060 480 L1140 540 L1260 520 L1380 560 L1600 540 L1600 640 L640 640 Z" fill="#5a4a9a" opacity="0.85" />
                </g>

                {/* clouds drifting around the peak */}
                <g style={{ ...par(0.4) }}>
                    <g style={{ animation: 'eid-drift 38s ease-in-out infinite alternate' }}>
                        <Cloud x={1300} y={150} s={1.3} />
                        <Cloud x={820} y={300} s={0.9} lit="#ffc9b5" />
                    </g>
                    <g style={{ animation: 'eid-drift 52s ease-in-out -12s infinite alternate-reverse' }}>
                        <Cloud x={1420} y={420} s={1.1} lit="#ffe0c4" shade="#c7a7e0" />
                        <Cloud x={600} y={170} s={0.7} lit="#f8c0d0" />
                    </g>
                </g>

                {/* a flock of cranes crossing toward the mountain */}
                <g style={{ animation: 'eid-cranes 46s linear infinite' }}>
                    {[[0, 0, 1], [60, 24, 0.9], [120, 6, 0.85], [-40, 40, 0.8], [180, 40, 0.75], [240, 18, 0.7], [90, 62, 0.7], [300, 52, 0.65], [30, 86, 0.6], [360, 30, 0.6]].map(([x, y, s], n) => (
                        <Crane key={n} x={x} y={y} s={s * 1.2} delay={n * 0.13} />
                    ))}
                </g>

                {/* mid hills, blue and violet */}
                <g style={par(0.55)}>
                    <path d="M0 640 Q160 560 320 600 T640 620 L700 700 L0 700 Z" fill="#3e3f96" />
                    <path d="M900 660 Q1100 590 1300 630 T1600 600 L1600 720 L900 720 Z" fill="#363a8c" />
                    <rect y="600" width="1600" height="120" fill="url(#ls-mist)" />
                </g>

                {/* the lake: sky colours, the mountain's warm reflection and shimmer */}
                <g style={par(0.7)}>
                    <path d="M0 690 Q400 670 800 685 T1600 690 L1600 900 L0 900 Z" fill="url(#ls-lake)" />
                    <path d="M1000 690 L1080 760 L1160 700 L1300 740 L1420 700 Z" fill="#f6a85a" opacity="0.18" />
                    {[[200, 715, 160], [520, 735, 240], [860, 722, 200], [1180, 750, 180], [340, 770, 120], [980, 790, 220]].map(([x, y, w], n) => (
                        <rect key={n} x={x} y={y} width={w} height={3} rx={1.5} fill="#fff" style={{ animation: `eid-shimmer ${3 + n % 3}s ease-in-out ${n * 0.5}s infinite` }} />
                    ))}
                </g>

                {/* shore rocks and the dark near bank */}
                <g style={par(0.85)}>
                    <path d="M0 760 Q120 740 260 770 Q380 800 420 860 L420 900 L0 900 Z" fill="#1d2257" />
                    <ellipse cx="300" cy="800" rx="70" ry="34" fill="#2a2f78" />
                    <ellipse cx="290" cy="790" rx="52" ry="18" fill="#3c4596" />
                    <ellipse cx="520" cy="830" rx="56" ry="26" fill="#252a6c" />
                    <ellipse cx="512" cy="822" rx="40" ry="12" fill="#3a428f" />
                    <ellipse cx="860" cy="820" rx="40" ry="18" fill="#2a2f78" />
                    <path d="M380 900 Q700 820 1000 860 L1000 900 Z" fill="#141a45" />
                    {leftReeds.map((r, n) => (
                        <g key={n} style={{ animation: `eid-sway 4s ease-in-out ${r.delay}s infinite`, transformOrigin: `${r.x}px 900px` }}>
                            <path d={`M${r.x} 900 Q${r.x + r.bend * 0.4} ${900 - r.h * 0.5} ${r.x + r.bend} ${900 - r.h}`} stroke="#3c4a8a" strokeWidth="3" fill="none" />
                        </g>
                    ))}
                </g>

                {/* foreground reeds swaying, on the near bank the wanderer stands on */}
                <g style={par(1)}>
                    <path d="M820 830 Q1100 770 1600 790 L1600 900 L820 900 Z" fill="#231d4e" />
                    <path d="M880 828 Q1120 782 1600 800" stroke="#4a3f8a" strokeWidth="6" fill="none" opacity="0.7" />
                    {reeds.map((r, n) => (
                        <g key={n} style={{ animation: `eid-sway ${3.4 + (n % 5) * 0.3}s ease-in-out ${r.delay}s infinite`, transformOrigin: `${r.x}px 900px` }}>
                            <path d={`M${r.x} 910 Q${r.x + r.bend * 0.4} ${900 - r.h * 0.55} ${r.x + r.bend} ${900 - r.h}`} stroke={REED[r.tone]} strokeWidth={r.tone === 3 ? 3 : 4} fill="none" strokeLinecap="round" />
                            {r.head && <ellipse cx={r.x + r.bend} cy={900 - r.h - 12} rx="4.5" ry="15" fill={REED[(r.tone + 1) % 4]} transform={`rotate(${r.bend / 3} ${r.x + r.bend} ${900 - r.h})`} />}
                        </g>
                    ))}
                </g>

                {/* the wanderer, looking toward the peaks */}
                <g style={par(1.1)}>
                    <g transform="translate(1270 560)">
                        {/* scarf in the wind */}
                        <path d="M-6 92 Q-90 70 -170 112 Q-120 96 -60 122 Q-110 132 -150 160 Q-60 140 4 118 Z" fill="#e2563a" style={{ animation: 'eid-scarf 2.4s ease-in-out infinite', transformOrigin: '0px 100px' }} />
                        <path d="M-6 92 Q-90 70 -170 112" stroke="#9a2a20" strokeWidth="3" fill="none" style={{ animation: 'eid-scarf 2.4s ease-in-out infinite', transformOrigin: '0px 100px' }} />
                        {/* legs and robe */}
                        <path d="M-40 190 L-56 340 L-20 340 L-6 230 L10 340 L46 340 L34 190 Z" fill="#3a2433" />
                        <path d="M-58 110 Q-70 200 -66 260 L60 260 Q66 200 54 110 Q0 90 -58 110 Z" fill="#8a2f2a" />
                        <path d="M-58 110 Q-64 180 -60 240 L-30 240 Q-34 180 -26 110 Z" fill="#a63b30" />
                        {/* backpack */}
                        <rect x="-50" y="120" width="76" height="96" rx="16" fill="#2f3a6e" stroke="#151a3a" strokeWidth="4" />
                        <rect x="-38" y="132" width="52" height="30" rx="8" fill="#3d4a88" />
                        <path d="M-50 150 Q-60 160 -54 190" stroke="#c9a46a" strokeWidth="5" fill="none" />
                        {/* bedroll */}
                        <rect x="-58" y="104" width="92" height="22" rx="11" fill="#c98a4a" stroke="#6b3f22" strokeWidth="3" />
                        {/* neck, scarf knot */}
                        <ellipse cx="0" cy="96" rx="26" ry="12" fill="#e2563a" />
                        {/* straw hat */}
                        <path d="M-118 76 L0 6 L118 76 Q0 98 -118 76 Z" fill="url(#ls-hat)" stroke="#7a4a1a" strokeWidth="4" strokeLinejoin="round" />
                        <path d="M-80 66 L0 18 M-40 72 L0 18 M40 72 L0 18 M80 66 L0 18" stroke="#b07a2a" strokeWidth="2" opacity="0.6" />
                        <path d="M-118 76 Q0 98 118 76" stroke="#7a4a1a" strokeWidth="4" fill="none" />
                        {/* staff */}
                        <path d="M70 110 L96 340" stroke="#5a3a22" strokeWidth="7" strokeLinecap="round" />
                        <circle cx="66" cy="104" r="8" fill="#e8c46a" stroke="#5a3a22" strokeWidth="3" />
                    </g>
                </g>

                {/* a soft vignette so the words read */}
                <rect width="1600" height="900" fill="url(#ls-vignette)" />
                <defs>
                    <linearGradient id="ls-vignette" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#120a2e" stopOpacity="0.55" />
                        <stop offset="0.45" stopColor="#120a2e" stopOpacity="0.1" />
                        <stop offset="1" stopColor="#120a2e" stopOpacity="0" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
}
