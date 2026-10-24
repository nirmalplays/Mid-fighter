/**
 * The start of a new journey: name the hero and the journey (its save slot), and dress the hero
 * (skin, outfit, hairstyle and its colour, an accessory). The preview is the hero's own sheets,
 * dressed the way the game will dress them, turning on the spot. Begin makes a new save slot (the
 * other journeys stay) and plays the opening.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { slice } from './px.tsx';
import { slots } from '../game/slots.ts';
import { sfx } from '../game/audio.ts';
import { store } from '../state/store.ts';
import { ACC_COLORS, ACC_NAMES, ACCS, DEFAULT_LOOK, dressCanvas, HAIR_COLORS, HAIR_NAMES, HAIRS, OUTFITS, preloadPieces, SKINS, type HeroLook } from '../game/world/heroLook.ts';
import { CHAR_CELL } from '../game/world/characterAtlas.ts';

const NAMES = ['Aren', 'Kael', 'Mira', 'Tamsin', 'Oren', 'Sable', 'Wren', 'Idris', 'Juno', 'Rook'];
const JOURNEYS = ['The Ash Road', 'The Long Dig', 'Ember and Echo', 'The Stone That Remembers', 'A Quiet Vow'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** One sheet image, loaded once. */
function useSheet(file: string): HTMLImageElement | null {
    const [img, setImg] = useState<HTMLImageElement | null>(null);
    useEffect(() => {
        const i = new Image();
        i.onload = () => setImg(i);
        i.src = `images/world/char/${file}.png`;
    }, [file]);
    return img;
}

/** The hero in the chosen look, idle or walking, turning slowly through the facings. */
function Preview({ look, anim }: { look: HeroLook; anim: 'idle' | 'walk' }) {
    const sheet = useSheet(anim);
    const [ready, setReady] = useState(false);
    useEffect(() => { void preloadPieces().then(() => setReady(true)); }, []);
    const dressed = useMemo(() => (sheet && ready ? dressCanvas(anim, sheet, look) : null), [sheet, ready, look, anim]);
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (!dressed) return;
        const cols = Math.round(dressed.width / CHAR_CELL);
        let raf = 0;
        const t0 = performance.now();
        const draw = (now: number) => {
            const c = ref.current;
            if (c) {
                const g = c.getContext('2d')!;
                g.clearRect(0, 0, c.width, c.height);
                const t = now - t0;
                const col = Math.floor(t / 120) % cols;
                // Turn: front, three-quarter, side, three-quarter back, back, and round again (mirrored).
                const step = Math.floor(t / 1800) % 8;
                const row = step <= 4 ? step : 8 - step;
                const flip = step > 4;
                g.save();
                if (flip) {
                    g.translate(c.width, 0);
                    g.scale(-1, 1);
                }
                g.imageSmoothingEnabled = true;
                g.drawImage(dressed, col * CHAR_CELL, row * CHAR_CELL, CHAR_CELL, CHAR_CELL, 0, 0, c.width, c.height);
                g.restore();
            }
            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [dressed]);
    return <canvas ref={ref} width={360} height={360} className="h-full w-full" aria-label="Your hero" />;
}

function Swatches({ colors, value, set, label }: { colors: string[]; value: number; set: (n: number) => void; label: string }) {
    return (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
            {colors.map((c, n) => (
                <button key={c} type="button" role="radio" aria-checked={n === value} aria-label={`${label} ${n + 1}`} onClick={() => { sfx('click'); set(n); }}
                    className="h-7 w-7 rounded-sm transition-transform hover:scale-110"
                    style={{ background: c, border: '2px solid #1b1622', boxShadow: n === value ? '0 0 0 2px #f3e3c0, 0 0 10px #f3e3c0aa' : 'inset 0 -3px 0 rgba(0,0,0,.25)' }} />
            ))}
        </div>
    );
}

function Choice({ options, names, value, set, label }: { options: string[]; names: Record<string, string>; value: string; set: (s: string) => void; label: string }) {
    const i = Math.max(0, options.indexOf(value));
    const go = (d: number) => { sfx('click'); set(options[(i + d + options.length) % options.length]); };
    return (
        <div className="flex items-center gap-2" aria-label={label}>
            <button type="button" onClick={() => go(-1)} className="px-2 text-[18px]" style={{ ...slice('btn2-normal', 2), color: '#fbf7f0' }} aria-label={`Previous ${label}`}>‹</button>
            <span className="min-w-[132px] text-center text-[16px] text-[#f3eefb]" style={{ textShadow: '0 2px 0 #000' }}>{names[value] ?? value}</span>
            <button type="button" onClick={() => go(1)} className="px-2 text-[18px]" style={{ ...slice('btn2-normal', 2), color: '#fbf7f0' }} aria-label={`Next ${label}`}>›</button>
        </div>
    );
}

export function CharacterCreator({ onBack }: { onBack: () => void }) {
    const [name, setName] = useState('');
    const [journey, setJourney] = useState(() => `Journey ${slots.list().length + 1}`);
    const [look, setLookState] = useState<HeroLook>({ ...DEFAULT_LOOK });
    const [anim, setAnim] = useState<'idle' | 'walk'>('idle');
    const [busy, setBusy] = useState(false);
    const set = (p: Partial<HeroLook>) => setLookState((l) => ({ ...l, ...p }));
    const randomise = () => {
        sfx('click');
        setLookState({
            skin: Math.floor(Math.random() * SKINS.length), outfit: Math.floor(Math.random() * OUTFITS.length),
            hair: pick(HAIRS), hairColor: Math.floor(Math.random() * HAIR_COLORS.length),
            acc: pick(ACCS), accColor: Math.floor(Math.random() * ACC_COLORS.length),
        });
        if (!name.trim()) setName(pick(NAMES));
    };
    const heroName = name.trim().slice(0, 16);
    const begin = async () => {
        if (!heroName || busy) return;
        setBusy(true);
        sfx('start');
        await slots.create(journey.trim().slice(0, 32) || JOURNEYS[0], heroName, look);
        store.patch({ phase: 'intro' });
    };
    useEffect(() => {
        const on = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onBack();
            else if (e.key === 'Enter' && heroName) void begin();
        };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    });
    const label = 'text-[12px] tracking-[0.25em] text-[#d8c89a]';
    const input = 'w-full px-3 py-2 text-[18px] outline-none placeholder:text-[#2f2a35]/40';
    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto p-4" style={{ background: 'radial-gradient(ellipse at 35% 50%, rgba(60,30,14,.75), rgba(2,6,4,.92) 70%)', animation: 'menu-in .4s ease-out both' }}>
            <div className="flex w-[min(940px,96vw)] flex-col gap-4 md:flex-row md:items-stretch">
                {/* the hero */}
                <div className="relative flex flex-col items-center md:w-[42%]">
                    <p className="mb-1 text-[13px] tracking-[0.35em] text-[#f3e3c0]/80">THE ARCHAEOLOGIST</p>
                    <div className="relative aspect-square w-[min(340px,70vw)]">
                        <div className="absolute inset-x-[12%] bottom-[8%] h-[14%] rounded-[50%]" style={{ background: 'radial-gradient(ellipse, rgba(255,170,90,.45), rgba(255,120,40,0) 70%)' }} />
                        <Preview look={look} anim={anim} />
                    </div>
                    <p className="-mt-2 text-[28px] leading-none text-[#fff3d6]" style={{ fontFamily: 'var(--font-relic)', textShadow: '0 3px 0 #000' }}>{heroName || 'Unnamed'}</p>
                    <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => setAnim(anim === 'idle' ? 'walk' : 'idle')} className="px-3 text-[13px]" style={{ ...slice('btn2-normal', 2), color: '#fbf7f0' }}>{anim === 'idle' ? 'Walk' : 'Stand'}</button>
                        <button type="button" onClick={randomise} className="px-3 text-[13px]" style={{ ...slice('btn2-normal', 2), color: '#fbf7f0' }}>Surprise me</button>
                    </div>
                </div>
                {/* the choices */}
                <div className="flex flex-1 flex-col gap-3 rounded-md p-4" style={{ background: 'linear-gradient(180deg, rgba(40,32,46,.92), rgba(20,16,24,.92))', border: '2px solid #1b1622', boxShadow: '0 0 0 1px rgba(243,227,192,.25), 0 10px 30px rgba(0,0,0,.6)' }}>
                    <div className="text-center text-[30px] leading-none text-[#f3e3c0]" style={{ fontFamily: 'var(--font-relic)' }}>A New Journey</div>
                    <label className="flex flex-col gap-1">
                        <span className={label}>YOUR NAME</span>
                        <input autoFocus value={name} onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} '\-]/gu, '').slice(0, 16))} placeholder="Who digs for the stone?" maxLength={16} spellCheck={false} autoComplete="off" className={input} style={{ ...slice('btn2-pressed', 3), color: '#2f2a35' }} />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className={label}>JOURNEY NAME <span className="tracking-normal text-white/40">(its save slot)</span></span>
                        <input value={journey} onChange={(e) => setJourney(e.target.value.slice(0, 32))} maxLength={32} spellCheck={false} autoComplete="off" className={input} style={{ ...slice('btn2-pressed', 3), color: '#2f2a35' }} />
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1"><span className={label}>SKIN</span><Swatches label="Skin" colors={SKINS} value={look.skin} set={(skin) => set({ skin })} /></div>
                        <div className="flex flex-col gap-1"><span className={label}>OUTFIT</span><Swatches label="Outfit" colors={OUTFITS} value={look.outfit} set={(outfit) => set({ outfit })} /></div>
                        <div className="flex flex-col gap-1"><span className={label}>HAIR</span><Choice label="hairstyle" options={HAIRS} names={HAIR_NAMES} value={look.hair} set={(hair) => set({ hair })} /></div>
                        <div className="flex flex-col gap-1"><span className={label}>HAIR COLOUR</span><Swatches label="Hair colour" colors={HAIR_COLORS} value={look.hairColor} set={(hairColor) => set({ hairColor })} /></div>
                        <div className="flex flex-col gap-1"><span className={label}>ACCESSORY</span><Choice label="accessory" options={ACCS} names={ACC_NAMES} value={look.acc} set={(acc) => set({ acc })} /></div>
                        <div className="flex flex-col gap-1"><span className={label}>ACCESSORY COLOUR</span><Swatches label="Accessory colour" colors={ACC_COLORS} value={look.accColor} set={(accColor) => set({ accColor })} /></div>
                    </div>
                    <p className="text-[12px] leading-snug text-white/50">Your other journeys stay saved. Continue any of them from Load Journey.</p>
                    <div className="mt-auto flex items-center justify-end gap-2">
                        <button type="button" onClick={onBack} className="px-4 py-1 text-[16px]" style={{ ...slice('btn2-normal', 2), color: '#fbf7f0' }}>Back</button>
                        <button type="button" disabled={!heroName || busy} onClick={() => void begin()} className="px-6 py-1 text-[18px] disabled:opacity-40" style={{ ...slice('btn3-normal', 2), color: '#fff3d6' }}>{heroName ? 'Begin' : 'Name your hero'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** When a journey was last played, in words. */
function ago(t: number): string {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 90) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return new Date(t).toLocaleDateString();
}
export function playTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/** Every journey: load one, rename it, or delete it (not the one in play). */
export function JourneyList({ onBack, onLoaded }: { onBack: () => void; onLoaded: () => void }) {
    const [, force] = useState(0);
    const list = slots.list();
    const cur = slots.current();
    const [editing, setEditing] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [confirm, setConfirm] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        const on = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editing) onBack(); };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    });
    const load = async (id: string) => {
        if (busy) return;
        setBusy(true);
        sfx('start');
        if (await slots.load(id)) onLoaded();
        setBusy(false);
    };
    const btn = 'px-2 text-[13px]';
    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4" style={{ background: 'rgba(2,6,4,.8)', animation: 'menu-in .3s ease-out both' }} onPointerDown={(e) => e.target === e.currentTarget && onBack()}>
            <div className="flex max-h-[calc(100dvh-40px)] w-[min(640px,94vw)] flex-col gap-2 rounded-md p-4" style={{ background: 'linear-gradient(180deg, rgba(40,32,46,.95), rgba(20,16,24,.95))', border: '2px solid #1b1622', boxShadow: '0 0 0 1px rgba(243,227,192,.25), 0 10px 30px rgba(0,0,0,.6)' }}>
                <div className="text-center text-[30px] leading-none text-[#f3e3c0]" style={{ fontFamily: 'var(--font-relic)' }}>Journeys</div>
                {list.length === 0 && <p className="py-6 text-center text-white/60">No journeys yet. Begin a new one from the menu.</p>}
                <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                    {list.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 rounded-sm px-3 py-2" style={{ background: s.id === cur?.id ? 'rgba(196,148,52,.22)' : 'rgba(255,255,255,.05)', border: `1px solid ${s.id === cur?.id ? 'rgba(243,227,192,.5)' : 'rgba(255,255,255,.08)'}` }}>
                            <div className="min-w-0 flex-1">
                                {editing === s.id ? (
                                    <input autoFocus value={draft} maxLength={32} onChange={(e) => setDraft(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { void slots.rename(s.id, draft.trim()); setEditing(null); force((n) => n + 1); } else if (e.key === 'Escape') { setEditing(null); e.stopPropagation(); } }}
                                        className="w-full px-2 py-0.5 text-[16px] outline-none" style={{ ...slice('btn2-pressed', 2), color: '#2f2a35' }} />
                                ) : (
                                    <p className="truncate text-[17px] text-[#fff3d6]">{s.name}{s.id === cur?.id && <span className="ml-2 text-[11px] tracking-[0.2em] text-[#e0b860]">LAST PLAYED</span>}</p>
                                )}
                                <p className="truncate text-[12px] text-white/60">{s.hero} · {s.where || 'The beginning'}</p>
                                <p className="text-[11px] text-white/40">{playTime(s.seconds)} played · {ago(s.updated)}</p>
                            </div>
                            <div className="flex shrink-0 gap-1.5">
                                <button type="button" disabled={busy} onClick={() => void load(s.id)} className={`${btn} py-0.5 text-[15px]`} style={{ ...slice('btn3-normal', 2), color: '#fff3d6' }}>Load</button>
                                <button type="button" onClick={() => { setEditing(s.id); setDraft(s.name); }} className={btn} style={{ ...slice('btn2-normal', 2), color: '#fbf7f0' }}>Rename</button>
                                {s.id !== cur?.id && (
                                    <button type="button" onClick={() => {
                                        if (confirm !== s.id) { setConfirm(s.id); window.setTimeout(() => setConfirm((c) => (c === s.id ? null : c)), 4000); return; }
                                        void slots.remove(s.id).then(() => force((n) => n + 1));
                                        setConfirm(null);
                                    }} className={btn} style={{ ...slice('btn2-normal', 2), color: confirm === s.id ? '#ffb4a0' : '#fbf7f0' }}>{confirm === s.id ? 'Sure?' : 'Delete'}</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-1 flex justify-end">
                    <button type="button" onClick={onBack} className="px-4 py-1 text-[16px]" style={{ ...slice('btn2-normal', 2), color: '#fbf7f0' }}>Back</button>
                </div>
            </div>
        </div>
    );
}
