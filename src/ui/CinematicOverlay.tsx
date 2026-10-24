/**
 * What a cinematic puts on the screen over the world: the letterbox, the fade to and from black, a
 * white flash, the speaker's portrait and their line (typed out), the act's title card, and Skip.
 * The world itself (world/cinematic.ts) moves the camera and the actors underneath.
 */
import { useEffect, useState } from 'react';
import { useStore } from '../state/store.ts';
import { skipCinematic } from '../game/world/cinematic.ts';
import { Assets, type Texture } from 'pixi.js';
import { heroPortrait } from '../game/world/heroLook.ts';

/** The hero's portrait in their chosen look (a whole idle sheet's worth of url, cropped by CSS like the others). */
function heroSrc(): string {
    try {
        const res = Assets.get<Texture>('char:idle').source.resource as HTMLImageElement;
        return heroPortrait(res);
    } catch {
        return 'images/world/char/idle.png';
    }
}

/** A head-and-shoulders crop of a person's front idle frame. */
function Portrait({ who }: { who: string }) {
    // The hero in their look, a demon its own portrait (tools/build-demons.py), the others their idle sheet.
    const whole = who === 'hero' || who === 'ignis';
    const src = who === 'hero' ? heroSrc() : who === 'ignis' ? 'images/world/npc/d_ignis-portrait.png' : `images/world/npc/${who}-idle.png`;
    const k = 0.84;
    return (
        <span
            aria-hidden="true"
            className="shrink-0"
            style={{
                width: 84, height: 84, border: '3px solid #e0a948', background: `#20161e url(${src}) no-repeat`,
                ...(whole ? { backgroundSize: '84px 84px', backgroundPosition: '0 0' } : { backgroundSize: `${1440 * k}px ${900 * k}px`, backgroundPosition: `${-40 * k}px ${-12 * k}px` }), imageRendering: 'auto',
                boxShadow: '0 0 0 3px #1a0c10',
            }}
        />
    );
}

function Typed({ text }: { text: string }) {
    const [n, setN] = useState(0);
    useEffect(() => {
        setN(0);
        const id = window.setInterval(() => setN((x) => (x >= text.length ? x : x + 1)), 26);
        return () => window.clearInterval(id);
    }, [text]);
    return <>{text.slice(0, n)}<span style={{ opacity: 0 }}>{text.slice(n)}</span></>;
}

export function CinematicOverlay() {
    const cine = useStore((s) => s.cine);
    if (!cine) return null;
    const narrator = cine.line?.speaker === 'Narrator';
    return (
        <div className="pointer-events-auto absolute inset-0 z-[60] select-none">
            <div className="absolute inset-0 bg-black" style={{ opacity: cine.fade }} />
            {cine.flash > 0 && <div className="absolute inset-0 bg-white" style={{ opacity: cine.flash * 0.85 }} />}
            <div className="absolute inset-x-0 top-0 h-[10vh] bg-black" />
            <div className="absolute inset-x-0 bottom-0 h-[16vh] bg-black" />
            {cine.line && (
                <div className="absolute inset-x-0 bottom-[2.5vh] flex justify-center px-4">
                    {narrator ? (
                        <p key={cine.line.text} className="story-line max-w-[min(900px,92vw)] text-center text-[min(20px,3.2vh)] italic leading-snug text-[#f5ead2]" style={{ fontFamily: 'var(--font-pixel)', textShadow: '0 2px 6px #000' }}>
                            <Typed text={cine.line.text} />
                        </p>
                    ) : (
                        <div key={cine.line.text} className="story-line flex w-[min(820px,94vw)] items-center gap-3">
                            {cine.line.who && <Portrait who={cine.line.who} />}
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[min(22px,3.4vh)] leading-none text-[#e0a948]" style={{ fontFamily: 'var(--font-relic)' }}>{cine.line.speaker}</span>
                                <p className="text-[min(19px,3vh)] leading-snug text-[#f5ead2]" style={{ fontFamily: 'var(--font-pixel)', textShadow: '0 2px 4px #000' }}>
                                    <Typed text={cine.line.text} />
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {cine.title && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ animation: 'cs-fade-up 1.2s ease-out both', background: 'radial-gradient(ellipse at center, rgba(6,4,10,.82) 0%, rgba(6,4,10,.55) 45%, rgba(6,4,10,0) 75%)' }}>
                    <span className="text-[min(14px,2.4vh)] uppercase tracking-[0.4em] text-[#c9b8e8]" style={{ fontFamily: 'var(--font-pixel)' }}>{cine.title.top}</span>
                    <span className="text-[min(56px,9vh)] leading-none text-[#ffd98a]" style={{ fontFamily: 'var(--font-relic)', textShadow: '0 3px 0 #1b0f08, 0 0 24px rgba(255,170,80,.45)' }}>{cine.title.main}</span>
                </div>
            )}
            <button
                type="button"
                onClick={() => skipCinematic()}
                className="absolute right-4 top-[3vh] rounded-sm px-3 py-1 text-[12px] tracking-[0.2em] text-white/70 hover:text-white"
                style={{ fontFamily: 'var(--font-pixel)', border: '1px solid rgba(255,255,255,.3)' }}
            >
                SKIP ▸ ESC
            </button>
        </div>
    );
}
