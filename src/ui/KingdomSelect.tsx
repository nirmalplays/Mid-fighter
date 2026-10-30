/**
 * Choosing a kingdom: Eidolon as a fractured orrery. The Heart of Eidolon burns at the centre,
 * cracked into drifting shards; the four kingdoms ride their own orbits around it in 3D, nearer
 * ones larger and brighter, farther ones lost in haze.
 *   Drag anywhere to swing the whole system round (and up and down to tilt it); it keeps turning
 *   by itself, slowly. Hover a land and it lights up with its element (embers, wind, bubbles,
 *   stone dust) and shows its lore; click it and the camera swings to it and closes in, with its
 *   full card and a way in. The story always begins in Pyraxis: the other lands are sealed by the
 *   Abyssal Maelstrom until their turn comes. Entering flies into the land and Land 1 begins.
 * `KingdomOrbit mode="view"` is the same sky from the home screen, to read about the kingdoms.
 * No sound effects here: only the music.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { progress } from '../game/progress.ts';
import { quest } from '../game/story/quest.ts';
import { ELEMENTS, KINGDOMS, nextKingdom, type Element } from '../game/eidolon.ts';
import { store } from '../state/store.ts';
import { LAND } from './kingdom/Islands.tsx';
import { Sigil } from './icons.tsx';
import { PxButton } from './px.tsx';

const CINZEL = 'var(--font-pixel)';
/** Each kingdom's orbit (radius, relative), where on it it starts, and how fast it goes round (radians a second). */
const ORBIT: Record<Element, { r: number; a0: number; w: number }> = {
    fire: { r: 0.56, a0: 0.3, w: 0.07 },
    air: { r: 0.72, a0: 2.0, w: 0.055 },
    water: { r: 0.87, a0: 3.6, w: 0.045 },
    earth: { r: 1.0, a0: 5.0, w: 0.037 },
};
/** The colour of each element's particles. */
const MOTE: Record<Element, string[]> = {
    fire: ['#ffb84a', '#ff6a1a', '#ffe08a'],
    air: ['#e0f6ff', '#9fe0ff', '#ffffff'],
    water: ['#bdeeff', '#7dd8f8', '#e8fbff'],
    earth: ['#e8c48a', '#a8d88a', '#ffe9b8'],
};

/** A land, drawn once (its wrapper moves; the drawing itself never re-renders). */
const LandArt = memo(function LandArt({ el }: { el: Element }) {
    return <svg viewBox="0 0 300 320" className="h-full w-full overflow-visible">{LAND[el]()}</svg>;
});

/** The fractured Heart of Eidolon: shards of light around a white core, drifting and pulsing. */
function Heart() {
    const shards: [string, number][] = [
        ['M100 30 L120 78 L100 92 L82 70 Z', 0], ['M124 82 L160 96 L118 112 L104 96 Z', 0.7], ['M78 76 L98 98 L82 118 L40 98 Z', 1.4],
        ['M104 104 L124 118 L112 170 L92 124 Z', 2.1], ['M86 126 L104 172 L70 136 Z', 2.8],
    ];
    return (
        <svg viewBox="0 0 200 200" className="h-full w-full overflow-visible">
            <defs>
                <radialGradient id="hrt-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#fff6d8" stopOpacity="0.95" /><stop offset="0.35" stopColor="#ffb86a" stopOpacity="0.55" /><stop offset="1" stopColor="#a855f7" stopOpacity="0" /></radialGradient>
                <linearGradient id="hrt-shard" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="0.5" stopColor="#ffd98a" /><stop offset="1" stopColor="#e07a3a" /></linearGradient>
            </defs>
            <circle cx="100" cy="100" r="100" fill="url(#hrt-glow)" style={{ animation: 'logo-breathe 3s ease-in-out infinite' }} />
            {[0, 1].map((n) => (
                <ellipse key={n} cx="100" cy="100" rx={86 - n * 18} ry={30 - n * 6} fill="none" stroke={n ? '#c4b5fd' : '#ffd98a'} strokeWidth="1.5" strokeDasharray="6 10" opacity="0.7"
                    style={{ transformOrigin: '100px 100px', animation: `cs-spin ${18 + n * 8}s linear ${n ? 'reverse' : 'normal'} infinite` }} />
            ))}
            <circle cx="100" cy="100" r="16" fill="#fffbe8" style={{ animation: 'logo-breathe 1.6s ease-in-out infinite' }} />
            {shards.map(([d, delay], n) => (
                <path key={n} d={d} fill="url(#hrt-shard)" stroke="#7a3a10" strokeWidth="1.5" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `orb-shard 4s ease-in-out ${delay}s infinite` }} />
            ))}
        </svg>
    );
}

type Mode = 'pledge' | 'view';

export function KingdomOrbit({ mode, onClose }: { mode: Mode; onClose?: () => void }) {
    const root = useRef<HTMLDivElement>(null);
    const ringRef = useRef<SVGSVGElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const heartRef = useRef<HTMLDivElement>(null);
    const landRefs = useRef<Partial<Record<Element, HTMLButtonElement | null>>>({});
    const [hover, setHover] = useState<Element | null>(null);
    const [locked, setLocked] = useState<Element | null>(null);
    const [entering, setEntering] = useState<Element | null>(null);
    // The camera and the system, kept outside React (the frame loop moves them).
    const cam = useRef({ yaw: 0.6, yawVel: 0, tilt: 1.02, zoom: 1, fu: 0, fv: 0, t: 0 });
    const state = useRef({ hover: null as Element | null, locked: null as Element | null, entering: null as Element | null });
    state.current = { hover, locked, entering };
    const drag = useRef<{ x: number; y: number; moved: number } | null>(null);

    const pledge = (e: Element) => {
        progress.chooseKingdom(e);
        progress.markIntroSeen();
        store.patch({ phase: 'playing' });
        quest.begin();
    };
    /** The story begins in Pyraxis; the other lands wait behind the Maelstrom. */
    const sealed = (e: Element) => mode === 'pledge' && e !== 'fire';
    const enter = (e: Element) => {
        if (mode !== 'pledge' || state.current.entering || sealed(e)) return;
        setEntering(e);
        window.setTimeout(() => pledge(e), 1200);
    };
    const choose = (e: Element) => {
        if (drag.current && drag.current.moved > 6) return; // it was a drag, not a click
        if (state.current.locked === e) enter(e);
        else setLocked(e);
    };

    // The frame loop: turn the system, place everything, draw the rings and the particles.
    useEffect(() => {
        let raf = 0;
        let last = performance.now();
        const motes: { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; r: number }[] = [];
        const step = (now: number) => {
            raf = requestAnimationFrame(step);
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            const box = root.current?.getBoundingClientRect();
            if (!box) return;
            const W = box.width, H = box.height;
            const c = cam.current;
            const { locked: lk, entering: en, hover: hv } = state.current;
            c.t += dt;
            // The system turns by itself (not while a land is locked), and coasts after a drag.
            if (!drag.current) {
                c.yaw += c.yawVel * dt;
                c.yawVel *= Math.exp(-dt * 2.2);
            }
            const angle = (e: Element) => ORBIT[e].a0 + ORBIT[e].w * c.t;
            // Where a land sits in the orbital plane, turned by the camera's yaw.
            const world = (e: Element) => {
                const a = angle(e) + c.yaw;
                return { u: Math.cos(a) * ORBIT[e].r, v: Math.sin(a) * ORBIT[e].r };
            };
            // Locked: swing the yaw so the land comes round to the front, and close in on it.
            if (lk) {
                const a = angle(lk) + c.yaw;
                const want = Math.PI / 2; // straight toward the camera
                let d = want - a;
                d = Math.atan2(Math.sin(d), Math.cos(d));
                c.yaw += d * Math.min(1, dt * 3);
                c.yawVel = 0;
                // Hold the land still in its orbit while it is watched.
                c.t -= dt;
            }
            const target = lk ? world(lk) : { u: 0, v: 0 };
            const zoomWant = en ? 7 : lk ? 2.1 : 1;
            c.fu += (target.u - c.fu) * Math.min(1, dt * (en ? 2 : 3));
            c.fv += (target.v - c.fv) * Math.min(1, dt * (en ? 2 : 3));
            c.zoom += (zoomWant - c.zoom) * Math.min(1, dt * (en ? 1.6 : 2.6));
            // Project a point of the orbital plane (u, v, lifted h) to the screen, with depth.
            const S = Math.min(W * 0.42, H * 0.62) * c.zoom;
            const cx = W * (lk ? 0.36 : 0.5), cy = H * (lk ? 0.52 : 0.56);
            const sinT = Math.sin(c.tilt), cosT = Math.cos(c.tilt);
            const project = (u: number, v: number, h = 0) => {
                const du = u - c.fu, dv = v - c.fv;
                const depth = dv * sinT; // + toward the camera
                const k = 2.4 / (2.4 - depth * 0.9); // nearer is bigger
                return { x: cx + du * S * k, y: cy + (dv * cosT - h) * S * k, k, depth };
            };
            // The orbits.
            const ring = ringRef.current;
            if (ring) {
                ring.setAttribute('viewBox', `0 0 ${W} ${H}`);
                const paths = ring.querySelectorAll('path');
                ELEMENTS.forEach((e, n) => {
                    let d = '';
                    for (let s = 0; s <= 72; s++) {
                        const a = (s / 72) * Math.PI * 2;
                        const p = project(Math.cos(a) * ORBIT[e].r, Math.sin(a) * ORBIT[e].r);
                        d += `${s ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
                    }
                    const el = paths[n];
                    el.setAttribute('d', d);
                    el.setAttribute('stroke-opacity', hv === e || lk === e ? '0.9' : en ? '0' : '0.32');
                });
            }
            // The Heart.
            const hp = project(0, 0, 0);
            if (heartRef.current) {
                const size = 0.42 * S * hp.k;
                heartRef.current.style.transform = `translate(${hp.x - size / 2}px, ${hp.y - size * 0.62}px)`;
                heartRef.current.style.width = heartRef.current.style.height = `${size}px`;
                heartRef.current.style.opacity = en ? '0' : lk ? '0.18' : '1';
            }
            // The lands: placed, sized and lit by how near they are.
            for (const e of ELEMENTS) {
                const b = landRefs.current[e];
                if (!b) continue;
                const w = world(e);
                const bob = Math.sin(c.t * 1.3 + ORBIT[e].a0) * 0.02;
                const p = project(w.u, w.v, 0.05 + bob);
                const size = 0.36 * S * p.k;
                const near = Math.max(0, Math.min(1, (p.depth + 1) / 2));
                const focus = !lk || lk === e;
                b.style.width = `${size}px`;
                b.style.height = `${size * (320 / 300)}px`;
                b.style.transform = `translate(${p.x - size / 2}px, ${p.y - size * 0.55}px)`;
                b.style.zIndex = String(Math.round(100 + p.depth * 50));
                b.style.filter = `brightness(${(0.55 + 0.5 * near) * (focus ? 1 : 0.5)}) saturate(${0.6 + 0.4 * near}) ${hv === e || lk === e ? `drop-shadow(0 0 ${18 * p.k}px ${KINGDOMS[e].css})` : ''}`;
                b.style.opacity = en && en !== e ? '0' : '1';
                // Its element streams off it while it is hovered or chosen.
                if ((hv === e || lk === e) && Math.random() < dt * 40) {
                    const col = MOTE[e];
                    const spread = size * 0.35;
                    motes.push({
                        x: p.x + (Math.random() - 0.5) * spread * 2, y: p.y - size * 0.1 + (Math.random() - 0.5) * spread * 0.6,
                        vx: e === 'air' ? 40 + Math.random() * 40 : (Math.random() - 0.5) * 20, vy: e === 'water' ? -20 - Math.random() * 20 : e === 'earth' ? -10 - Math.random() * 15 : -40 - Math.random() * 40,
                        life: 0, max: 1 + Math.random() * 0.8, c: col[Math.floor(Math.random() * col.length)], r: (1.5 + Math.random() * 2.5) * Math.min(2, p.k),
                    });
                }
            }
            // Embers rising from the Heart.
            if (!en && Math.random() < dt * 14) {
                motes.push({ x: hp.x + (Math.random() - 0.5) * 30 * hp.k, y: hp.y - 10, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 40, life: 0, max: 1.5 + Math.random(), c: Math.random() < 0.5 ? '#ffd98a' : '#c4b5fd', r: 1.5 + Math.random() * 2 });
            }
            const cv = canvas.current;
            if (cv) {
                const dpr = Math.min(2, window.devicePixelRatio || 1);
                if (cv.width !== Math.round(W * dpr)) {
                    cv.width = Math.round(W * dpr);
                    cv.height = Math.round(H * dpr);
                }
                const ctx = cv.getContext('2d')!;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, W, H);
                for (let n = motes.length - 1; n >= 0; n--) {
                    const m = motes[n];
                    m.life += dt;
                    if (m.life > m.max) {
                        motes.splice(n, 1);
                        continue;
                    }
                    m.x += m.vx * dt;
                    m.y += m.vy * dt;
                    const a = Math.sin((m.life / m.max) * Math.PI);
                    const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 4);
                    g.addColorStop(0, m.c);
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.globalAlpha = a;
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.arc(m.x, m.y, m.r * 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, []);

    // Drag to turn the system (and tilt it).
    const onDown = (e: React.PointerEvent) => {
        drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
    };
    useEffect(() => {
        const move = (e: PointerEvent) => {
            const d = drag.current;
            if (!d) return;
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            d.moved += Math.abs(dx) + Math.abs(dy);
            d.x = e.clientX;
            d.y = e.clientY;
            const c = cam.current;
            if (state.current.locked && d.moved > 30) setLocked(null);
            const turn = -dx / 220;
            c.yaw += turn;
            c.yawVel = turn / 0.016;
            c.tilt = Math.max(0.6, Math.min(1.35, c.tilt - dy / 400));
        };
        const up = () => {
            window.setTimeout(() => { drag.current = null; }, 0);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
    }, []);
    // Keys: left and right turn to the next land, Enter goes in, Escape steps back.
    useEffect(() => {
        const on = (ev: KeyboardEvent) => {
            const cur = state.current.locked ?? state.current.hover;
            const n = cur ? ELEMENTS.indexOf(cur) : -1;
            if (ev.key === 'ArrowRight') setLocked(ELEMENTS[(n + 1) % 4]);
            else if (ev.key === 'ArrowLeft') setLocked(ELEMENTS[(n + 3) % 4]);
            else if (ev.key === 'Enter' && state.current.locked) enter(state.current.locked);
            else if (ev.key === 'Escape') {
                ev.preventDefault();
                if (state.current.locked) setLocked(null);
                else onClose?.();
            }
        };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    });

    const card = locked ?? hover;
    const k = card ? KINGDOMS[card] : null;
    return (
        <div
            ref={root}
            data-quiet
            className="absolute inset-0 z-30 select-none overflow-hidden touch-none"
            style={{ background: 'radial-gradient(ellipse at 50% 55%, #2a1650 0%, #120a2a 45%, #05030c 100%)', cursor: drag.current ? 'grabbing' : 'grab' }}
            onPointerDown={onDown}
        >
            {/* stars and a far nebula */}
            {Array.from({ length: 80 }, (_, n) => (
                <span key={n} className="pointer-events-none absolute block rounded-full bg-white" style={{ left: `${(n * 37.3) % 100}%`, top: `${(n * 23.7) % 100}%`, width: n % 9 ? 1.5 : 3, height: n % 9 ? 1.5 : 3, animation: `eid-twinkle ${2 + (n % 4)}s ease-in-out ${(n % 9) * 0.3}s infinite` }} />
            ))}
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 30%, rgba(124,58,237,.18), transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(14,165,233,.12), transparent 50%)' }} />

            {/* the orbits, the Heart, the lands, the particles */}
            <svg ref={ringRef} className="pointer-events-none absolute inset-0 h-full w-full">
                {ELEMENTS.map((e) => <path key={e} fill="none" stroke={KINGDOMS[e].css} strokeWidth="1.5" strokeDasharray="4 8" style={{ transition: 'stroke-opacity .3s' }} />)}
            </svg>
            <div ref={heartRef} className="pointer-events-none absolute left-0 top-0" style={{ zIndex: 100, transition: 'opacity .6s' }}>
                <Heart />
            </div>
            {ELEMENTS.map((e) => (
                <button
                    key={e}
                    ref={(b) => { landRefs.current[e] = b; }}
                    type="button"
                    aria-label={KINGDOMS[e].name}
                    className="absolute left-0 top-0 cursor-pointer outline-none"
                    style={{ transition: 'opacity .6s' }}
                    onPointerEnter={() => setHover(e)}
                    onPointerLeave={() => setHover((h) => (h === e ? null : h))}
                    onClick={() => choose(e)}
                >
                    <LandArt el={e} />
                </button>
            ))}
            <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 400 }} />

            {/* title */}
            <div className="pointer-events-none absolute inset-x-0 top-[3vh] text-center" style={{ zIndex: 500, opacity: entering || locked ? 0 : 1, transition: 'opacity .4s' }}>
                <h2 className="text-[min(48px,8vh)] leading-none text-[#ffd98a]" style={{ fontFamily: 'var(--font-relic)', textShadow: '0 3px 0 #1b0f08, 0 0 18px rgba(255,170,80,.45)' }}>
                    {mode === 'pledge' ? 'Your journey begins' : 'The Shattered Lands'}
                </h2>
                <p className="text-[min(12px,2.4vh)] font-semibold tracking-[0.2em] text-[#c9b8e8]" style={{ fontFamily: CINZEL }}>
                    {locked ? (mode === 'pledge' ? (sealed(locked) ? 'Sealed by the Abyssal Maelstrom' : `Tap ${KINGDOMS[locked].name} again, or Enter, to begin`) : 'Drag to look at another') : mode === 'pledge' ? 'The ash-caverns of Pyraxis call · tap a land to look closer' : 'Drag to turn the world · tap a land to look closer'}
                </p>
            </div>

            {/* the lore card */}
            {k && card && !entering && (
                // (placed by the outer box; the inner one slides in, so the two transforms never fight)
                <div
                    className="absolute flex"
                    style={{
                        zIndex: 500,
                        ...(locked
                            ? { right: '3vw', top: '4vh', bottom: '4vh', alignItems: 'center', width: 'min(340px, 44vw)' }
                            : { left: 0, right: 0, bottom: '4vh', justifyContent: 'center' }),
                    }}
                    onPointerDown={(ev) => ev.stopPropagation()}
                >
                <div
                    key={`${card}-${locked ? 'l' : 'h'}`}
                    className="flex max-h-full flex-col gap-1.5 overflow-y-auto p-[min(16px,2.6vh)] text-[#f3ecff]"
                    style={{
                        animation: 'cs-fade-up .35s ease-out both', width: locked ? '100%' : 'min(420px, 80vw)',
                        background: 'rgba(14,8,26,.94)', border: `4px solid ${k.css}`, boxShadow: `0 0 0 4px #0b0614, 6px 6px 0 4px rgba(0,0,0,.45)`,
                    }}
                >
                    <div className="flex items-center gap-2.5">
                        <Sigil el={card} size={38} />
                        <div className="leading-tight">
                            <div className="text-[min(30px,5.4vh)] leading-none" style={{ fontFamily: 'var(--font-relic)', color: '#ffd98a' }}>{k.name}</div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: k.css }}>{k.land}</div>
                        </div>
                    </div>
                    <p className="text-[min(13px,3vh)] font-medium leading-snug text-white/85">{k.theme}.</p>
                    {locked && (
                        <>
                            <p className="text-[min(12px,2.8vh)] leading-snug text-white/70">{card === 'fire' ? 'Ignis the Molten Scourge woke in the ash-caverns and swallowed the Memory Pillar, and Lyra with it. Your story begins here.' : sealed(card) ? `Adrift beyond the Abyssal Maelstrom. Its bridge opens only when ${KINGDOMS[card === 'air' ? 'fire' : card === 'water' ? 'air' : 'water'].name} is pacified.` : `Ruled now by ${k.warden.name}, ${k.warden.title}, who holds the seal to ${KINGDOMS[nextKingdom(card)].name}.`}</p>
                            <div className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,.06)' }}>
                                <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: k.css }}>Passive</div>
                                <div className="text-[min(13px,3vh)] font-semibold">{k.power}</div>
                            </div>
                            <div className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,.06)' }}>
                                <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: k.css }}>Skill · {k.skill.name}</div>
                                <div className="text-[min(13px,3vh)] font-semibold">{k.skill.blurb}</div>
                            </div>
                            <div className="mt-1 flex gap-2">
                                {mode === 'pledge' && !sealed(card) && (
                                    <PxButton variant="wood" className="flex-1 py-1.5" onClick={() => enter(card)}>Enter {k.name}</PxButton>
                                )}
                                <PxButton variant="stone" className="py-1.5" onClick={() => setLocked(null)}>Back</PxButton>
                            </div>
                        </>
                    )}
                    {!locked && <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">Tap to look closer</p>}
                </div>
                </div>
            )}

            {mode === 'view' && onClose && !locked && (
                <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} className="absolute left-[3vw] top-[3vh] rounded-xl px-4 py-2 text-[13px] font-bold text-white/90"
                    style={{ zIndex: 600, fontFamily: CINZEL, border: '1.5px solid rgba(255,255,255,.45)', background: 'rgba(10,6,20,.6)' }}>
                    Back
                </button>
            )}

            {/* flying in: the land's light fills the view */}
            {entering && <div className="pointer-events-none absolute inset-0" style={{ zIndex: 700, background: `radial-gradient(circle at 50% 50%, #fff 0%, ${KINGDOMS[entering].css} 45%, #0b0614 100%)`, animation: 'ks-flash 1.2s ease-in both' }} />}
        </div>
    );
}

/** After the intro (New Game): choose the kingdom you pledge to. */
export default function KingdomSelect() {
    return <KingdomOrbit mode="pledge" />;
}

