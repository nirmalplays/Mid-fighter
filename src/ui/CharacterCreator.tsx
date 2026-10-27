/**
 * The start of a new journey, in three steps: Class (warrior, ranger or arcanist: three cards, each
 * hero holding the class's tool), Look (presets, a harmonious randomiser, and every part of the hero:
 * skin, eyes, outfit and trim, hair, headwear, face, back and shoulders) and Name (the hero and the
 * journey, i.e. its save slot). The hero stands on a little stage through all of it, dressed by the
 * same code that dresses them in the world (world/heroLook.ts), turnable by dragging or the arrow
 * keys, standing, walking or attacking. Begin makes a new save slot (the other journeys stay) with
 * the name, look and class, and plays the opening.
 *
 * Keys: Enter = next step (Begin on the last), Escape = previous step (or the menu), 1-3 = jump to a
 * step, Left/Right = choose a class or turn the hero, R = randomise the look. Inside a row of choices
 * the arrow keys move along it.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { slice } from './px.tsx';
import { slots } from '../game/slots.ts';
import { sfx } from '../game/audio.ts';
import { store } from '../state/store.ts';
import { CLASS_IDS, CLASSES, type ClassId } from '../game/classes.ts';
import {
    ACC_COLOR_NAMES, ACC_COLORS, ACC_NAMES, ACCS, accFits, dressCanvas, dressFrame, EYE_NAMES, EYES, FACE_NAMES, FACES, faceFits,
    GEAR_NAMES, GEARS, HAIR_COLOR_NAMES, HAIR_COLORS, HAIR_NAMES, hairTakesColor, HAIRS, HATS, lookKey, normalizeLook, OUTFIT_NAMES,
    OUTFITS, preloadPieces, SKIN_NAMES, SKIN_ORDER, SKINS, TRIM_NAMES, TRIMS, type HeroLook,
} from '../game/world/heroLook.ts';
import { CHAR_CELL } from '../game/world/characterAtlas.ts';
import { ISO_FRAMES, ISO_VERSION } from '../game/world/isoAtlas.ts';
import { CLASS_SHOW, frameMs, JOURNEYS, NAMES, pick, PRESETS, randomLook, sameLook } from './creatorData.ts';

type Anim = 'idle' | 'walk' | 'attack';
type Img = HTMLImageElement;

/* ------------------------------------------------------------------ images */

const imgCache = new Map<string, Promise<Img | null>>();
function loadImg(src: string): Promise<Img | null> {
    let p = imgCache.get(src);
    if (!p) {
        p = new Promise((done) => {
            const i = new Image();
            i.onload = () => done(i);
            i.onerror = () => done(null);
            i.src = src;
        });
        imgCache.set(src, p);
    }
    return p;
}
const sheetSrc = (file: string) => `images/world/char/${file}.png`;
const ISO_SRC = `images/world/iso.png?v=${ISO_VERSION}`;

/** Pieces and a set of sheets, loaded: null until they all are. */
function useImages(srcs: string[]): (Img | null)[] | null {
    const key = srcs.join('|');
    const [state, setState] = useState<{ key: string; imgs: (Img | null)[] } | null>(null);
    useEffect(() => {
        let live = true;
        void Promise.all([preloadPieces(), ...srcs.map(loadImg)]).then(([, ...imgs]) => {
            if (live) setState({ key, imgs: imgs as (Img | null)[] });
        });
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    return state && state.key === key ? state.imgs : null;
}

/** Dressed sheets, kept for the last few looks (each is a whole sheet). */
const dressedCache = new Map<string, HTMLCanvasElement>();
function dressedSheet(file: string, img: Img, look: HeroLook): HTMLCanvasElement {
    const k = `${file}|${lookKey(look)}`;
    let c = dressedCache.get(k);
    if (c) {
        dressedCache.delete(k);
        dressedCache.set(k, c);
        return c;
    }
    c = dressCanvas(file, img, look);
    dressedCache.set(k, c);
    if (dressedCache.size > 14) dressedCache.delete(dressedCache.keys().next().value!);
    return c;
}

/* ------------------------------------------------------------- the stage */

/** Facing 0-7 going round: 0 = facing the viewer; the turned rows mirrored on the way back. */
const facingRow = (f: number) => {
    const s = ((f % 8) + 8) % 8;
    return { row: s <= 4 ? s : 8 - s, flip: s > 4 };
};

/**
 * The hero on a block of ground with a soft shadow, playing an animation in a facing. `compact` drops
 * the block for a smaller plinth glow (the class cards).
 */
function HeroStage({ look, cls, anim, facing, onTurn, compact = false, label }: {
    look: HeroLook; cls: ClassId; anim: Anim; facing: number; onTurn?: (d: number) => void; compact?: boolean; label: string;
}) {
    const show = CLASS_SHOW[cls];
    const file = anim === 'idle' ? show.idle : anim === 'walk' ? show.walk : show.attack;
    const imgs = useImages([sheetSrc(file), ISO_SRC, sheetSrc(show.idle)]);
    const sheet = useMemo(() => (imgs?.[0] ? dressedSheet(file, imgs[0], look) : null), [imgs, file, look]);
    const iso = imgs?.[1] ?? null;
    const ref = useRef<HTMLCanvasElement>(null);
    const facingRef = useRef(facing);
    facingRef.current = facing;
    useEffect(() => {
        const c = ref.current;
        if (!c || !sheet) return;
        const cols = Math.round(sheet.width / CHAR_CELL);
        const ms = frameMs(file);
        let raf = 0;
        const t0 = performance.now();
        const draw = (now: number) => {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
            if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
            const g = c.getContext('2d')!;
            g.clearRect(0, 0, w, h);
            const t = now - t0;
            // An attack plays through, then a beat of stillness, then again.
            let col: number;
            if (anim === 'attack') {
                const cycle = cols * ms + 520;
                const k = t % cycle;
                col = Math.min(cols - 1, Math.floor(k / ms));
            } else col = Math.floor(t / ms) % cols;
            const { row, flip } = facingRow(facingRef.current);
            // Size: the hero is about 130 of the cell's 180 px tall and 90 wide; on the stage it stands on
            // a block of ground about as wide as it is tall, the whole fitting the canvas (and never blown
            // up past ~2x, where the art goes soft).
            const S = compact ? Math.min(1.3, (h - 6) / 150, w / 120) : Math.min(2.1, (h - 10) / 215, w / 135);
            const cx = w / 2;
            const feetY = compact ? h - 8 * S : h - 84 * S;
            // The ground: an iso block of earth with grass on top, or a soft plinth glow.
            if (!compact && iso) {
                const dirt = ISO_FRAMES.dirt1, grass = ISO_FRAMES.grass1;
                const bw = 125 * S;
                const bs = bw / 153;
                const bx = cx - bw / 2, by = feetY - 52 * bs;
                g.imageSmoothingEnabled = true;
                if (dirt) g.drawImage(iso, dirt[0], dirt[1], dirt[2], dirt[3], bx, by, dirt[2] * bs, dirt[3] * bs);
                if (grass) g.drawImage(iso, grass[0], grass[1], grass[2], grass[3], bx, by - 2 * bs, grass[2] * bs, grass[3] * bs);
            } else if (compact) {
                const glow = g.createRadialGradient(cx, feetY, 0, cx, feetY, 80 * S);
                glow.addColorStop(0, `${show.color}55`);
                glow.addColorStop(1, `${show.color}00`);
                g.fillStyle = glow;
                g.fillRect(0, feetY - 60 * S, w, 120 * S);
            }
            // The shadow under the feet.
            g.fillStyle = 'rgba(20,8,16,.38)';
            g.beginPath();
            g.ellipse(cx, feetY, 30 * S, 11 * S, 0, 0, Math.PI * 2);
            g.fill();
            // The hero: the cell's feet sit at about y = 166.
            g.save();
            g.translate(cx, feetY - 166 * S);
            if (flip) g.scale(-1, 1);
            g.imageSmoothingEnabled = true;
            g.imageSmoothingQuality = 'high';
            g.drawImage(sheet, col * CHAR_CELL, row * CHAR_CELL, CHAR_CELL, CHAR_CELL, -90 * S, 0, CHAR_CELL * S, CHAR_CELL * S);
            g.restore();
            // The arcanist's bolt: a ley spark gathering between the raised hands (seen from the front and side).
            if (show.spark && anim === 'attack' && col >= 1 && row <= 2) {
                const k = (t % (cols * ms + 520)) / (cols * ms);
                const r = (5 + 9 * Math.min(1, k)) * S;
                const sx = cx + (flip ? 1 : -1) * (row === 0 ? 0 : 34) * S;
                const sy = feetY - (row === 0 ? 52 : 60) * S;
                const spark = g.createRadialGradient(sx, sy, 0, sx, sy, r * 2.2);
                spark.addColorStop(0, 'rgba(240,230,255,.95)');
                spark.addColorStop(0.35, 'rgba(170,130,255,.75)');
                spark.addColorStop(1, 'rgba(120,80,255,0)');
                g.fillStyle = spark;
                g.beginPath();
                g.arc(sx, sy, r * 2.2, 0, Math.PI * 2);
                g.fill();
            }
            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [sheet, iso, anim, file, compact, show]);

    // Drag to turn: every ~40 px of drag turns the hero one step.
    const drag = useRef<{ x: number; acc: number } | null>(null);
    return (
        <canvas
            ref={ref}
            role={onTurn ? 'img' : undefined}
            aria-label={label}
            className={`h-full w-full ${onTurn ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
            onPointerDown={onTurn ? (e) => { drag.current = { x: e.clientX, acc: 0 }; e.currentTarget.setPointerCapture(e.pointerId); } : undefined}
            onPointerMove={onTurn ? (e) => {
                const d = drag.current;
                if (!d) return;
                d.acc += e.clientX - d.x;
                d.x = e.clientX;
                while (Math.abs(d.acc) >= 40) {
                    const s = Math.sign(d.acc);
                    d.acc -= s * 40;
                    onTurn(s);
                }
            } : undefined}
            onPointerUp={onTurn ? () => { drag.current = null; } : undefined}
            onPointerCancel={onTurn ? () => { drag.current = null; } : undefined}
        />
    );
}

/* ---------------------------------------------------------- small parts */

const ink = '#1b1622';
const gold = '#f3e3c0';
const panelStyle = { background: 'linear-gradient(180deg, rgba(40,32,46,.94), rgba(20,16,24,.94))', border: `2px solid ${ink}`, boxShadow: '0 0 0 1px rgba(243,227,192,.22), 0 10px 30px rgba(0,0,0,.55)' };
const btn2 = { ...slice('btn2-normal', 2), color: '#fbf7f0', textShadow: '0 2px 0 #2f2a35' };
const btn3 = { ...slice('btn3-normal', 2), color: '#fff3d6', textShadow: '0 2px 0 #3b2412' };

function Emblem({ cls, size = 44 }: { cls: ClassId; size?: number }) {
    const c = CLASS_SHOW[cls];
    const o = '#340129';
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 2px 0 rgba(0,0,0,.6))' }}>
            <path d="M16 1 L29 6 L29 16 Q29 26 16 31 Q3 26 3 16 L3 6 Z" fill={c.dark} stroke={o} strokeWidth="2" />
            <path d="M16 4 L26 8 L26 16 Q26 24 16 28 Q6 24 6 16 L6 8 Z" fill="none" stroke={c.color} strokeWidth="1.2" opacity=".7" />
            {cls === 'warrior' && (
                <g stroke={o} strokeWidth="1.2" strokeLinejoin="round">
                    <path d="M16 6 L18 9 L18 19 L14 19 L14 9 Z" fill="#dfe4f0" />
                    <rect x="10.5" y="19" width="11" height="2.6" rx="1" fill={c.color} />
                    <rect x="14.6" y="21.6" width="2.8" height="4" fill="#7a4a2a" />
                    <circle cx="16" cy="26.6" r="1.6" fill={c.color} />
                </g>
            )}
            {cls === 'ranger' && (
                <g stroke={o} strokeWidth="1.2" strokeLinejoin="round">
                    <path d="M9 24 Q16 6 25 9 Q19 13 16 18 Q13 22 9 24 Z" fill={c.color} />
                    <path d="M10 23 L22 11" stroke="#2a4a1a" strokeWidth="1" fill="none" />
                    <path d="M8 26 L24 8" stroke="#c89a5a" strokeWidth="1.6" fill="none" />
                    <path d="M22 7 L26 6 L25 10 Z" fill="#dfe4f0" />
                </g>
            )}
            {cls === 'arcanist' && (
                <g stroke={o} strokeWidth="1.1" strokeLinejoin="round">
                    <circle cx="16" cy="16" r="7.5" fill="none" stroke={c.color} strokeWidth="1.4" />
                    <path d="M16 6 L18 14 L26 16 L18 18 L16 26 L14 18 L6 16 L14 14 Z" fill="#efe6ff" />
                    <circle cx="16" cy="16" r="2.2" fill={c.color} />
                </g>
            )}
        </svg>
    );
}

/** Arrow keys move along a row of choices (a radio group): Left/Up back, Right/Down on. */
function rovingKeys(count: number, index: number, set: (i: number) => void) {
    return (e: ReactKeyboardEvent) => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        e.stopPropagation();
        const n = (index + d + count) % count;
        set(n);
        const group = e.currentTarget as HTMLElement;
        requestAnimationFrame(() => (group.querySelectorAll<HTMLElement>('[role=radio]')[n])?.focus());
    };
}

function Section({ title, value, children }: { title: string; value?: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
                <span className="text-[13px] tracking-[0.2em] text-[#d8c89a]">{title.toUpperCase()}</span>
                {value && <span className="truncate text-[14px] text-[#fff3d6]">{value}</span>}
            </div>
            {children}
        </div>
    );
}

/** A row of colour swatches, shown in `order` (indices into `colors`). */
function Swatches({ colors, names, value, set, label, order, matchColor }: {
    colors: string[]; names: string[]; value: number; set: (n: number) => void; label: string; order?: number[]; matchColor?: string;
}) {
    const ord = order ?? colors.map((_, i) => i);
    const at = Math.max(0, ord.indexOf(value));
    return (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label} onKeyDown={rovingKeys(ord.length, at, (n) => { sfx('click'); set(ord[n]); })}>
            {ord.map((n) => {
                const on = n === value;
                const c = colors[n] || matchColor || '#888';
                return (
                    <button key={n} type="button" role="radio" aria-checked={on} aria-label={`${label}: ${names[n]}`} title={names[n]} tabIndex={on ? 0 : -1}
                        onClick={() => { sfx('click'); set(n); }}
                        className="relative h-9 w-9 shrink-0 rounded-[3px] outline-none transition-transform hover:scale-110 focus-visible:scale-110"
                        style={{ background: c, border: `2px solid ${ink}`, boxShadow: on ? `0 0 0 2px ${gold}, 0 0 10px ${gold}aa` : 'inset 0 -4px 0 rgba(0,0,0,.25), inset 0 3px 0 rgba(255,255,255,.18)' }}>
                        {!colors[n] && <span className="absolute inset-0 flex items-center justify-center text-[10px] leading-none text-white" style={{ textShadow: '0 1px 0 #000' }}>=</span>}
                    </button>
                );
            })}
        </div>
    );
}

/** Head-and-shoulders (or whole hero) thumbnails of the hero wearing each option. */
type ThumbView = { row: number; crop: [number, number, number, number] };
const HEAD_VIEW: ThumbView = { row: 0, crop: [32, 6, 116, 116] };
const HEAD_TURNED: ThumbView = { row: 1, crop: [26, 6, 124, 124] };
const BODY_BACK: ThumbView = { row: 3, crop: [20, 22, 140, 150] };
const BODY_FRONT: ThumbView = { row: 1, crop: [20, 22, 140, 150] };

function Thumb({ look, view, idle }: { look: HeroLook; view: ThumbView; idle: Img }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const c = ref.current;
        if (!c) return;
        const f = dressFrame('idle', idle, view.row, 0, look);
        const [x, y, w, h] = view.crop;
        c.width = w;
        c.height = h;
        const g = c.getContext('2d')!;
        g.clearRect(0, 0, w, h);
        g.drawImage(f, x, y, w, h, 0, 0, w, h);
    }, [look, view, idle]);
    return <canvas ref={ref} className="h-full w-full object-contain" aria-hidden="true" />;
}

function Options({ label, options, names, value, set, lookFor, view, idle, fits }: {
    label: string; options: string[]; names: Record<string, string>; value: string; set: (v: string) => void;
    lookFor: (v: string) => HeroLook; view: (v: string) => ThumbView; idle: Img | null; fits?: (v: string) => boolean;
}) {
    const at = Math.max(0, options.indexOf(value));
    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-1.5" role="radiogroup" aria-label={label}
            onKeyDown={rovingKeys(options.length, at, (n) => { sfx('click'); set(options[n]); })}>
            {options.map((o) => {
                const on = o === value;
                const ok = fits ? fits(o) : true;
                return (
                    <button key={o} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} title={ok ? names[o] : `${names[o]} (hidden by your hat)`}
                        onClick={() => { sfx('click'); set(o); }}
                        className="flex min-h-[76px] flex-col items-center justify-end overflow-hidden rounded-[4px] px-0.5 pb-1 outline-none transition-transform focus-visible:scale-105"
                        style={{ background: on ? 'rgba(196,148,52,.28)' : 'rgba(255,255,255,.05)', border: `2px solid ${on ? gold : 'rgba(255,255,255,.08)'}`, opacity: ok ? 1 : 0.45 }}>
                        <span className="block h-[52px] w-[52px]">{idle && <Thumb look={lookFor(o)} view={view(o)} idle={idle} />}</span>
                        <span className="w-full truncate text-center text-[12px] leading-tight text-[#f3eefb]">{names[o]}</span>
                    </button>
                );
            })}
        </div>
    );
}

/* -------------------------------------------------------------- creator */

/** The look in a line of words, for the name step's summary. */
function describe(l: HeroLook): string {
    const parts = [
        `${SKIN_NAMES[l.skin]} skin`,
        l.eyes ? `${EYE_NAMES[l.eyes].toLowerCase()} eyes` : '',
        `${OUTFIT_NAMES[l.outfit].toLowerCase()} outfit${l.trim ? ` with ${TRIM_NAMES[l.trim].toLowerCase()} trim` : ''}`,
        hairTakesColor(l.hair) ? `${HAIR_COLOR_NAMES[l.hairColor].toLowerCase()} ${HAIR_NAMES[l.hair].toLowerCase()} hair` : HAIR_NAMES[l.hair].toLowerCase(),
        l.acc !== 'none' && accFits(l.hair, l.acc) ? `${ACC_COLOR_NAMES[l.accColor].toLowerCase()} ${ACC_NAMES[l.acc].toLowerCase()}` : '',
        l.face !== 'none' && faceFits(l.hair, l.face) ? FACE_NAMES[l.face].toLowerCase() : '',
        l.gear !== 'none' ? GEAR_NAMES[l.gear].toLowerCase() : '',
    ].filter(Boolean);
    return parts.join(' · ');
}

const STEPS = ['Class', 'Look', 'Name'] as const;
type Tab = 'presets' | 'body' | 'hair' | 'gear';
const TABS: { id: Tab; name: string }[] = [{ id: 'presets', name: 'Presets' }, { id: 'body', name: 'Body' }, { id: 'hair', name: 'Hair' }, { id: 'gear', name: 'Gear' }];
const signature = (cls: ClassId) => PRESETS.find((p) => p.cls === cls)!;

export function CharacterCreator({ onBack }: { onBack: () => void }) {
    const [step, setStep] = useState(0);
    const [cls, setCls] = useState<ClassId>('warrior');
    const [look, setLookState] = useState<HeroLook>(() => ({ ...signature('warrior').look }));
    /** Until the player touches the look, choosing a class dresses the hero in its signature preset. */
    const [touched, setTouched] = useState(false);
    const [tab, setTab] = useState<Tab>('presets');
    const [anim, setAnim] = useState<Anim>('idle');
    const [facing, setFacing] = useState(7);
    const [name, setName] = useState('');
    const [journey, setJourney] = useState('');
    const [nudge, setNudge] = useState(0);
    const [busy, setBusy] = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);
    const idleImgs = useImages([sheetSrc('idle')]);
    const idle = idleImgs?.[0] ?? null;

    const set = (p: Partial<HeroLook>) => { setTouched(true); setLookState((l) => normalizeLook({ ...l, ...p })); };
    const chooseClass = (c: ClassId) => {
        sfx('click');
        setCls(c);
        if (!touched) setLookState({ ...signature(c).look });
    };
    const randomise = useCallback(() => {
        sfx('click');
        setTouched(true);
        setLookState(randomLook(cls));
    }, [cls]);
    const turn = useCallback((d: number) => setFacing((f) => (f + d + 8) % 8), []);
    const heroName = name.trim().slice(0, 16);
    const go = (n: number) => {
        const s = Math.max(0, Math.min(2, n));
        if (s === step) return;
        sfx('click');
        setStep(s);
        if (s === 2) window.setTimeout(() => { if (!window.matchMedia('(pointer: coarse)').matches) nameRef.current?.focus(); }, 60);
    };
    const begin = async () => {
        if (busy) return;
        if (!heroName) {
            setNudge((n) => n + 1);
            nameRef.current?.focus();
            return;
        }
        setBusy(true);
        sfx('start');
        await slots.create(journey.trim().slice(0, 32) || `${heroName}'s Journey`, heroName, look, cls);
        store.patch({ phase: 'intro' });
    };
    const next = () => (step < 2 ? go(step + 1) : void begin());
    const back = () => (step > 0 ? go(step - 1) : onBack());

    useEffect(() => {
        const on = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            const typing = t instanceof HTMLInputElement;
            const inGroup = !!t?.closest?.('[role=radiogroup]');
            if (e.key === 'Escape') { e.preventDefault(); if (typing) t.blur(); back(); return; }
            if (e.key === 'Enter') {
                // A focused button does its own thing on Enter; anywhere else Enter moves on.
                if (t instanceof HTMLButtonElement) return;
                e.preventDefault();
                next();
                return;
            }
            if (typing || inGroup || e.altKey || e.ctrlKey || e.metaKey) return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                const d = e.key === 'ArrowRight' ? 1 : -1;
                if (step === 0) chooseClass(CLASS_IDS[(CLASS_IDS.indexOf(cls) + d + 3) % 3]);
                else turn(-d);
                e.preventDefault();
            } else if (e.key >= '1' && e.key <= '3') go(Number(e.key) - 1);
            else if ((e.key === 'r' || e.key === 'R') && step === 1) randomise();
        };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    });

    const preset = PRESETS.find((p) => sameLook(p.look, look));
    const C = CLASSES[cls];
    const show = CLASS_SHOW[cls];
    const hat = HATS.has(look.hair);

    const header = (
        <div className="flex shrink-0 items-center gap-2 px-2 pt-2 sm:px-4">
            <button type="button" onClick={back} className="min-h-[44px] min-w-[84px] px-3 text-[16px]" style={btn2}>{step === 0 ? 'Menu' : 'Back'}</button>
            <nav className="mx-auto flex items-center gap-1 sm:gap-2" aria-label="Steps">
                {STEPS.map((s, i) => {
                    const on = i === step;
                    return (
                        <button key={s} type="button" onClick={() => go(i)} aria-current={on ? 'step' : undefined}
                            className="flex min-h-[44px] items-center gap-2 rounded-[4px] px-2 sm:px-3"
                            style={{ background: on ? 'rgba(196,148,52,.25)' : 'transparent', border: `2px solid ${on ? gold : 'transparent'}` }}>
                            <span className="flex h-7 w-7 items-center justify-center rounded-full text-[14px]" style={{ background: i < step ? '#c49434' : on ? gold : 'rgba(255,255,255,.12)', color: i <= step ? ink : '#f3eefb' }}>{i < step ? '✓' : i + 1}</span>
                            <span className={`${on ? 'text-[#fff3d6]' : 'text-white/60 max-[600px]:hidden'}`} style={{ fontFamily: 'var(--font-relic)', fontSize: 24, lineHeight: 1 }}>{s}</span>
                        </button>
                    );
                })}
            </nav>
            <button type="button" onClick={next} disabled={busy} className="min-h-[44px] min-w-[96px] px-4 text-[18px] disabled:opacity-50" style={btn3}>
                {step < 2 ? 'Next' : 'Begin'}
            </button>
        </div>
    );

    // ---- Step 1: the class.
    const classStep = (
        <div className="flex min-h-0 flex-1 items-center justify-center gap-2 p-2 sm:gap-4 sm:p-4" role="radiogroup" aria-label="Class"
            onKeyDown={rovingKeys(3, CLASS_IDS.indexOf(cls), (n) => chooseClass(CLASS_IDS[n]))}>
            {CLASS_IDS.map((id) => {
                const on = id === cls;
                const s = CLASS_SHOW[id];
                const k = CLASSES[id];
                return (
                    <button key={id} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
                        onClick={() => (on ? go(1) : chooseClass(id))}
                        className="relative flex h-full max-h-[540px] min-w-0 max-w-[400px] flex-1 flex-col items-center justify-center overflow-hidden rounded-[6px] px-2 pb-2 text-left outline-none transition-transform duration-200 sm:px-4 sm:pb-4"
                        style={{
                            background: on ? `linear-gradient(180deg, ${s.dark}ee, rgba(20,16,24,.95) 70%)` : 'linear-gradient(180deg, rgba(40,32,46,.9), rgba(20,16,24,.92))',
                            border: `2px solid ${on ? s.color : ink}`,
                            boxShadow: on ? `0 0 0 2px ${ink}, 0 0 24px ${s.color}66, 0 12px 30px rgba(0,0,0,.6)` : '0 0 0 1px rgba(243,227,192,.18), 0 8px 20px rgba(0,0,0,.5)',
                            transform: on ? 'translateY(-4px)' : 'none',
                            opacity: on ? 1 : 0.82,
                        }}>
                        <div className="absolute left-2 top-2 sm:left-3 sm:top-3"><Emblem cls={id} size={40} /></div>
                        <div className="relative min-h-0 w-full flex-1" style={{ minHeight: 90, maxHeight: 320 }}>
                            <HeroStage look={on ? look : touched ? look : signature(id).look} cls={id} anim={on ? 'attack' : 'idle'} facing={7} compact label={`${k.name} preview`} />
                        </div>
                        <div className="w-full shrink-0">
                            <div className="text-center leading-none" style={{ fontFamily: 'var(--font-relic)', fontSize: 'clamp(26px, 5.4vh, 40px)', color: on ? '#fff3d6' : '#e6dccb', textShadow: '0 3px 0 #000' }}>{k.name}</div>
                            <p className="mt-1 text-center text-[14px] leading-snug text-[#f3eefb] max-[420px]:text-[13px]">{k.blurb}</p>
                            <p className="mt-1 text-center text-[12.5px] leading-snug text-white/60 [@media(max-height:420px)]:hidden">{k.style}</p>
                            <p className="mt-1 text-center text-[11px] tracking-[0.18em]" style={{ color: s.color }}>{s.carries.toUpperCase()}</p>
                        </div>
                    </button>
                );
            })}
        </div>
    );

    // The stage with its controls, shared by the Look and Name steps.
    const stage = (
        <div className="relative flex min-h-0 min-w-0 flex-[1_1_44%] flex-col">
            <div className="flex shrink-0 flex-col items-center">
                <div className="flex items-center gap-2">
                    <Emblem cls={cls} size={28} />
                    <span className="leading-none text-[#fff3d6]" style={{ fontFamily: 'var(--font-relic)', fontSize: 'clamp(24px, 5vh, 34px)', textShadow: '0 3px 0 #000' }}>{step === 2 && heroName ? heroName : C.name}</span>
                </div>
                <span className="text-[12px] tracking-[0.2em] text-[#d8c89a]" style={{ textShadow: '0 2px 0 #000' }}>{(step === 2 && heroName ? `${C.name} · ${preset ? preset.name : 'your own look'}` : preset ? preset.name : 'Your own look').toUpperCase()}</span>
            </div>
            <div className="relative min-h-0 flex-1">
                <HeroStage look={look} cls={cls} anim={anim} facing={facing} onTurn={turn} label={`Your hero, ${C.name}${preset ? `, ${preset.name}` : ''}. Drag or use the arrow keys to turn.`} />
                <button type="button" aria-label="Turn left" onClick={() => turn(1)} className="absolute left-0 top-1/2 h-11 w-11 -translate-y-1/2 text-[20px]" style={btn2}>‹</button>
                <button type="button" aria-label="Turn right" onClick={() => turn(-1)} className="absolute right-0 top-1/2 h-11 w-11 -translate-y-1/2 text-[20px]" style={btn2}>›</button>
            </div>
            <div className="flex shrink-0 items-center justify-center pb-1" role="radiogroup" aria-label="Pose" onKeyDown={rovingKeys(3, ['idle', 'walk', 'attack'].indexOf(anim), (n) => setAnim((['idle', 'walk', 'attack'] as Anim[])[n]))}>
                {(['idle', 'walk', 'attack'] as Anim[]).map((a) => (
                    <button key={a} type="button" role="radio" aria-checked={anim === a} tabIndex={anim === a ? 0 : -1} onClick={() => { sfx('click'); setAnim(a); }}
                        className="min-h-[40px] min-w-[72px] px-2.5 text-[14px] sm:px-3" style={{ ...slice(anim === a ? 'btn2-pressed' : 'btn2-normal', 2), color: anim === a ? '#2f2a35' : '#fbf7f0' }}>
                        {a === 'idle' ? 'Stand' : a === 'walk' ? 'Walk' : 'Attack'}
                    </button>
                ))}
            </div>
        </div>
    );

    // ---- Step 2: the look.
    const lookTabs = (
        <div className="flex shrink-0 gap-1 border-b border-white/10 px-2 pt-2" role="tablist" aria-label="Look">
            {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { sfx('click'); setTab(t.id); }}
                    className="min-h-[40px] flex-1 rounded-t-[4px] px-1 text-[15px]"
                    style={{ background: tab === t.id ? 'rgba(196,148,52,.25)' : 'transparent', color: tab === t.id ? '#fff3d6' : 'rgba(255,255,255,.6)', borderBottom: `2px solid ${tab === t.id ? gold : 'transparent'}` }}>
                    {t.name}
                </button>
            ))}
            <button type="button" onClick={randomise} title="A random look that holds together (R)" className="mb-1 min-h-[38px] shrink-0 px-2.5 text-[14px]" style={btn3}>⚄ Random</button>
        </div>
    );
    // The chosen class's presets first.
    const presetList = [...PRESETS].sort((a, b) => Number(b.cls === cls) - Number(a.cls === cls));
    const presetsPane = (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2" role="radiogroup" aria-label="Presets"
                onKeyDown={rovingKeys(presetList.length, Math.max(0, preset ? presetList.indexOf(preset) : 0), (n) => { sfx('click'); set(presetList[n].look); })}>
                {presetList.map((p) => {
                    const on = p === preset;
                    return (
                        <button key={p.name} type="button" role="radio" aria-checked={on} tabIndex={on || (!preset && p === presetList[0]) ? 0 : -1}
                            onClick={() => { sfx('click'); set(p.look); }}
                            className="flex flex-col items-center rounded-[4px] px-1 pb-1.5 outline-none focus-visible:scale-105"
                            style={{ background: on ? 'rgba(196,148,52,.28)' : 'rgba(255,255,255,.05)', border: `2px solid ${on ? gold : 'rgba(255,255,255,.08)'}` }}>
                            <span className="block h-[78px] w-[72px]">{idle && <Thumb look={p.look} view={BODY_FRONT} idle={idle} />}</span>
                            <span className="text-center text-[13px] leading-tight text-[#fff3d6]">{p.name}</span>
                            <span className="text-[10.5px] tracking-[0.15em]" style={{ color: CLASS_SHOW[p.cls].color }}>{CLASSES[p.cls].name.toUpperCase()}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
    const bodyPane = (
        <div className="flex flex-col gap-3">
            <Section title="Skin" value={SKIN_NAMES[look.skin]}><Swatches label="Skin" colors={SKINS} names={SKIN_NAMES} order={SKIN_ORDER} value={look.skin} set={(skin) => set({ skin })} /></Section>
            <Section title="Eyes" value={EYE_NAMES[look.eyes]}><Swatches label="Eyes" colors={EYES.map((e, i) => (i === 0 ? '#3a1a30' : e))} names={EYE_NAMES} value={look.eyes} set={(eyes) => set({ eyes })} /></Section>
            <Section title="Outfit" value={OUTFIT_NAMES[look.outfit]}><Swatches label="Outfit" colors={OUTFITS} names={OUTFIT_NAMES} value={look.outfit} set={(outfit) => set({ outfit })} /></Section>
            <Section title="Trim" value={`${TRIM_NAMES[look.trim]} · legs, cape and hood`}><Swatches label="Trim" colors={TRIMS} names={TRIM_NAMES} matchColor={OUTFITS[look.outfit]} value={look.trim} set={(trim) => set({ trim })} /></Section>
        </div>
    );
    const hairPane = (
        <div className="flex flex-col gap-3">
            <Section title="Hairstyle" value={HAIR_NAMES[look.hair]}>
                <Options label="Hairstyle" options={HAIRS} names={HAIR_NAMES} value={look.hair} set={(hair) => set({ hair })} idle={idle}
                    lookFor={(hair) => ({ ...look, hair })} view={(h) => (['ponytail', 'braids', 'mohawk'].includes(h) ? HEAD_TURNED : HEAD_VIEW)} />
            </Section>
            {hairTakesColor(look.hair)
                ? <Section title="Hair colour" value={HAIR_COLOR_NAMES[look.hairColor]}><Swatches label="Hair colour" colors={HAIR_COLORS} names={HAIR_COLOR_NAMES} value={look.hairColor} set={(hairColor) => set({ hairColor })} /></Section>
                : <p className="text-[13px] text-white/55">{look.hair === 'hood' ? 'The hood is cut from your trim cloth (Body › Trim).' : look.hair === 'none' ? 'Shaved clean: no colour to choose.' : 'This hat keeps its own colours.'}</p>}
        </div>
    );
    const gearPane = (
        <div className="flex flex-col gap-3">
            <Section title="Headwear" value={ACC_NAMES[look.acc] + (accFits(look.hair, look.acc) ? '' : ' (hidden by your hat)')}>
                <Options label="Headwear" options={ACCS} names={ACC_NAMES} value={look.acc} set={(acc) => set({ acc })} idle={idle}
                    lookFor={(acc) => ({ ...look, acc })} view={() => HEAD_VIEW} fits={(a) => accFits(look.hair, a)} />
            </Section>
            {look.acc !== 'none' && accFits(look.hair, look.acc) && (
                <Section title="Headwear colour" value={ACC_COLOR_NAMES[look.accColor]}><Swatches label="Headwear colour" colors={ACC_COLORS} names={ACC_COLOR_NAMES} value={look.accColor} set={(accColor) => set({ accColor })} /></Section>
            )}
            <Section title="Face" value={FACE_NAMES[look.face] + (faceFits(look.hair, look.face) ? '' : ' (hidden by your hat)')}>
                <Options label="Face" options={FACES} names={FACE_NAMES} value={look.face} set={(face) => set({ face })} idle={idle}
                    lookFor={(face) => ({ ...look, face })} view={() => HEAD_VIEW} fits={(f) => faceFits(look.hair, f)} />
            </Section>
            <Section title="Back and shoulders" value={GEAR_NAMES[look.gear]}>
                <Options label="Back and shoulders" options={GEARS} names={GEAR_NAMES} value={look.gear} set={(gear) => set({ gear })} idle={idle}
                    lookFor={(gear) => ({ ...look, gear })} view={(g) => (g === 'cape' || g === 'mantle' ? BODY_BACK : BODY_FRONT)} />
            </Section>
            {hat && <p className="text-[12.5px] text-white/50">Hats hide bands, circlets and earrings; those options are dimmed.</p>}
        </div>
    );
    const lookStep = (
        <div className="flex min-h-0 flex-1 gap-2 p-2 sm:gap-4 sm:p-4">
            {stage}
            <div className="flex min-h-0 min-w-0 flex-[1_1_56%] flex-col rounded-[6px]" style={panelStyle}>
                {lookTabs}
                <div className="pan-y min-h-0 flex-1 overflow-y-auto p-3" role="tabpanel">
                    {tab === 'presets' ? presetsPane : tab === 'body' ? bodyPane : tab === 'hair' ? hairPane : gearPane}
                </div>
            </div>
        </div>
    );

    // ---- Step 3: the name.
    const input = 'w-full min-w-0 px-3 py-2 text-[18px] outline-none placeholder:text-[#2f2a35]/45';
    const nameStep = (
        <div className="flex min-h-0 flex-1 gap-2 p-2 sm:gap-4 sm:p-4">
            {stage}
            <div className="pan-y flex min-h-0 min-w-0 flex-[1_1_56%] flex-col gap-3 overflow-y-auto rounded-[6px] p-3 sm:p-4" style={panelStyle}>
                <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] tracking-[0.2em] text-[#d8c89a]">HERO NAME</span>
                    <div className="flex gap-2" key={nudge} style={nudge ? { animation: 'cc-nudge .35s' } : undefined}>
                        <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} '\-]/gu, '').slice(0, 16))}
                            placeholder={`${C.name} name`} maxLength={16} spellCheck={false} autoComplete="off" enterKeyHint="go" aria-required="true"
                            className={input} style={{ ...slice('btn2-pressed', 3), color: '#2f2a35' }} />
                        <button type="button" onClick={() => { sfx('click'); setName(pick(NAMES[cls].filter((n) => n !== name))); }} className="min-h-[44px] shrink-0 px-3 text-[15px]" style={btn2} title="A name for a hero of this class">⚄ Name</button>
                    </div>
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] tracking-[0.2em] text-[#d8c89a]">JOURNEY <span className="tracking-normal text-white/45">· the name of this save</span></span>
                    <div className="flex gap-2">
                        <input value={journey} onChange={(e) => setJourney(e.target.value.slice(0, 32))} placeholder={`${heroName || 'Your hero'}'s Journey`}
                            maxLength={32} spellCheck={false} autoComplete="off" enterKeyHint="go" className={input} style={{ ...slice('btn2-pressed', 3), color: '#2f2a35' }} />
                        <button type="button" onClick={() => { sfx('click'); setJourney(pick(JOURNEYS.filter((j) => j !== journey))); }} className="min-h-[44px] shrink-0 px-3 text-[15px]" style={btn2} title="A name for the journey">⚄ Title</button>
                    </div>
                </label>
                <div className="flex flex-col gap-2 rounded-[4px] p-2.5" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}>
                    <div className="flex items-center gap-3">
                        <Emblem cls={cls} size={36} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[16px] text-[#fff3d6]">{heroName || 'Unnamed'} · {C.name}{preset ? ` · ${preset.name}` : ''}</p>
                            <p className="text-[12.5px] leading-snug text-white/60">{C.style}</p>
                        </div>
                    </div>
                    <p className="text-[12.5px] leading-snug text-white/50 [@media(max-height:420px)]:hidden">{describe(look)}</p>
                </div>
                <button type="button" onClick={() => void begin()} disabled={busy} className="mt-auto min-h-[48px] shrink-0 px-6 text-[20px] disabled:opacity-50" style={btn3}>
                    {heroName ? `Begin as ${heroName}` : 'Name your hero to begin'}
                </button>
                <p className="-mt-1 text-center text-[12px] text-white/40">Your other journeys stay saved.</p>
            </div>
        </div>
    );

    return (
        <div className="absolute inset-0 z-20 flex flex-col" style={{ background: `radial-gradient(ellipse at 30% 45%, ${show.dark}cc, rgba(2,6,4,.94) 72%)`, animation: 'menu-in .4s ease-out both', transition: 'background .4s' }}>
            <style>{'@keyframes cc-nudge{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}'}</style>
            <div className="mx-auto flex h-full w-full max-w-[1180px] min-h-0 flex-col">
                {header}
                {step === 0 ? classStep : step === 1 ? lookStep : nameStep}
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
    const btn = 'min-h-[40px] min-w-[56px] px-2 text-[13px]';
    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4" style={{ background: 'rgba(2,6,4,.8)', animation: 'menu-in .3s ease-out both' }} onPointerDown={(e) => e.target === e.currentTarget && onBack()}>
            <div className="flex max-h-[calc(100dvh-40px)] w-[min(640px,94vw)] flex-col gap-2 rounded-md p-4" style={{ background: 'linear-gradient(180deg, rgba(40,32,46,.95), rgba(20,16,24,.95))', border: '2px solid #1b1622', boxShadow: '0 0 0 1px rgba(243,227,192,.25), 0 10px 30px rgba(0,0,0,.6)' }}>
                <div className="text-center text-[30px] leading-none text-[#f3e3c0]" style={{ fontFamily: 'var(--font-relic)' }}>Journeys</div>
                {list.length === 0 && <p className="py-6 text-center text-white/60">No journeys yet. Begin a new one from the menu.</p>}
                <div className="pan-y flex flex-col gap-2 overflow-y-auto pr-1">
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
                                <button type="button" disabled={busy} onClick={() => void load(s.id)} className={`${btn} text-[15px]`} style={{ ...slice('btn3-normal', 2), color: '#fff3d6' }}>Load</button>
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
