/**
 * Meh Fighter is played sideways (game.config.prod.json: orientation "landscape"; the RUN app turns
 * the phone's screen for it). Anywhere that does not (a phone browser tab, a host that did not turn),
 * a phone held upright gets this instead of a squashed game: the game pauses behind it and carries on
 * the moment the phone is turned.
 */
import { useEffect, useState } from 'react';
import { store } from '../state/store.ts';

/** A touch screen taller than it is wide (never a desktop window, however narrow). */
function upright(): boolean {
    return window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth * 1.08;
}

export default function RotatePrompt() {
    const [on, setOn] = useState(upright);
    useEffect(() => {
        const check = () => setOn(upright());
        window.addEventListener('resize', check);
        window.addEventListener('orientationchange', check);
        return () => {
            window.removeEventListener('resize', check);
            window.removeEventListener('orientationchange', check);
        };
    }, []);
    // The game waits while the prompt is up (the host's own pause is a separate reason, so only undo ours).
    useEffect(() => {
        if (!on) return;
        const was = store.get().paused;
        store.patch({ paused: true });
        return () => store.patch({ paused: was });
    }, [on]);
    if (!on) return null;
    return (
        <div role="alert" className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-6 px-8 text-center" style={{ background: 'radial-gradient(ellipse at 50% 40%, #1b1424, #05030a 75%)', color: '#f3e3c0' }}>
            <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
                <g style={{ transformOrigin: '66px 66px', animation: 'rotate-hint 2.6s ease-in-out infinite' }}>
                    <rect x="38" y="14" width="56" height="104" rx="10" fill="#241a30" stroke="#e0a948" strokeWidth="5" />
                    <rect x="46" y="28" width="40" height="70" rx="3" fill="#3a2a52" />
                    <circle cx="66" cy="107" r="4" fill="#e0a948" />
                </g>
                <path d="M104 30 q16 14 8 38" fill="none" stroke="#e0a948" strokeWidth="5" strokeLinecap="round" />
                <path d="M118 62 l-6 10 l-11 -5" fill="none" stroke="#e0a948" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="text-[28px] leading-tight" style={{ fontFamily: 'var(--font-relic)' }}>Turn your phone sideways</div>
            <div className="max-w-[280px] text-[15px] leading-snug text-white/70">Meh Fighter is played in landscape. Your journey waits where you left it.</div>
        </div>
    );
}
