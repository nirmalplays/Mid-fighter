/**
 * In-game HUD: a React overlay above the Pixi canvas, styled as chunky tan
 * pixel-art buttons with dark icons, a hearts + portrait + plaque cluster at the
 * top left, and a digital clock with a pause button at the top right.
 *
 * Pattern to keep: the overlay itself is pointer-events-none so touches fall
 * through to the canvas (the movement joystick); each control opts back in with
 * pointer-events-auto. `pt-safe-top` (see app.css) pads below the RUN host
 * header. Action buttons fire on pointer-down and emit commands the world scene hears.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { commands, type GameCommand } from '../game/commands.ts';
import { store, useStore } from '../state/store.ts';

const TAN = '#e9bf9a';
const TAN_LIGHT = '#f6d9ba';
const BROWN = '#b4725b';
const BROWN_DARK = '#7d4636';
const INK = '#3a2025';

/** A tan rounded-square button with a brown rim, as in the reference. */
function PixelBtn({ size, onPress, className = '', children }: { size: number; onPress: () => void; className?: string; children: ReactNode }) {
    return (
        <button
            type="button"
            style={{
                width: size,
                height: size,
                borderRadius: size * 0.24,
                background: `linear-gradient(${TAN_LIGHT}, ${TAN})`,
                border: `${Math.max(4, size * 0.07)}px solid ${BROWN}`,
                boxShadow: `inset 0 0 0 2px ${TAN_LIGHT}, 0 ${Math.max(3, size * 0.05)}px 0 ${BROWN_DARK}, 0 6px 10px rgba(0,0,0,.35)`,
                color: INK,
            }}
            className={`pointer-events-auto flex touch-none items-center justify-center font-black leading-none transition-transform active:translate-y-[3px] active:brightness-95 ${className}`}
            onPointerDown={(e) => {
                e.preventDefault();
                onPress();
            }}
        >
            {children}
        </button>
    );
}

const emit = (cmd: GameCommand) => () => commands.emit(cmd);

/** Pixel-art icons (crisp edges, dark ink). */
const Icon = {
    Alert: () => (
        <svg viewBox="0 0 16 16" width="62%" height="62%" shapeRendering="crispEdges">
            <path d="M0 2h16l-8 13z" fill={INK} />
            <rect x="7" y="4" width="2" height="5" fill={TAN} />
            <rect x="7" y="10" width="2" height="2" fill={TAN} />
        </svg>
    ),
    Sword: () => (
        <svg viewBox="0 0 16 16" width="68%" height="68%" shapeRendering="crispEdges" fill="none" stroke={INK} strokeLinecap="square">
            <path d="M13 3L6 10" strokeWidth="3.4" />
            <path d="M4 8l4 4" strokeWidth="2" />
            <path d="M5 11L3 13" strokeWidth="2.4" />
        </svg>
    ),
    Hammer: () => (
        <svg viewBox="0 0 16 16" width="64%" height="64%" shapeRendering="crispEdges" fill={INK} stroke={INK} strokeLinecap="square">
            <path d="M4 13L10 7" strokeWidth="2.6" />
            <path d="M7 3.5L12.5 9 10.5 11 5 5.5z" />
        </svg>
    ),
    Dots: () => (
        <svg viewBox="0 0 16 16" width="60%" height="60%" shapeRendering="crispEdges" fill={INK}>
            <rect x="1" y="7" width="3" height="3" />
            <rect x="6.5" y="7" width="3" height="3" />
            <rect x="12" y="7" width="3" height="3" />
        </svg>
    ),
    Pause: () => (
        <svg viewBox="0 0 16 16" width="52%" height="52%" shapeRendering="crispEdges" fill={INK}>
            <rect x="3" y="2" width="3.5" height="12" />
            <rect x="9.5" y="2" width="3.5" height="12" />
        </svg>
    ),
};

/** 7 × 6 pixel heart; `fill` is 0 (empty), 0.5 (half) or 1. */
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
function Heart({ fill }: { fill: 0 | 0.5 | 1 }) {
    const cells: ReactNode[] = [];
    const on = (x: number, y: number) => HEART[y]?.[x] === 'X';
    for (let y = -1; y <= HEART.length; y++) {
        for (let x = -1; x <= 7; x++) {
            if (on(x, y)) {
                const lit = fill === 1 || (fill === 0.5 && x < 3.5);
                cells.push(<rect key={`${x},${y}`} x={x + 1} y={y + 1} width="1" height="1" fill={lit ? (y === 1 && x < 3 ? '#ff8d8d' : '#e5353f') : '#5a2a38'} />);
            } else if ([-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => on(x + dx, y + dy)))) {
                cells.push(<rect key={`o${x},${y}`} x={x + 1} y={y + 1} width="1" height="1" fill="#2b0f1c" />);
            }
        }
    }
    return (
        <svg viewBox="0 0 9 8" width="30" height="27" shapeRendering="crispEdges" className="drop-shadow-[0_2px_0_rgba(0,0,0,.35)]">
            {cells}
        </svg>
    );
}

/** Total play time (from the save), mm:ss, or h:mm:ss past an hour. */
function Clock() {
    const t = useStore((s) => s.playSeconds);
    const hh = Math.floor(t / 3600);
    const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    return (
        <div
            className="flex items-center justify-center rounded-xl px-3 font-black tabular-nums"
            style={{
                height: 46,
                background: '#1d1216',
                border: `4px solid ${BROWN}`,
                boxShadow: `inset 0 0 0 2px #3b2a2f, 0 3px 0 ${BROWN_DARK}`,
                color: '#ff4a3a',
                fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                fontSize: 26,
                letterSpacing: 2,
                textShadow: '0 0 8px rgba(255,74,58,.7)',
            }}
        >
            {hh > 0 ? `${hh}:` : ''}{mm}:{ss}
        </div>
    );
}

/** The nine hotbar slots, in the same order as HOTBAR in world/character.ts. */
const HOTBAR_ITEMS: { tool: string; icon?: string; label: string }[] = [
    { tool: 'none', label: 'Bare hands' },
    { tool: 'sword', icon: 'sword', label: 'Sword' },
    { tool: 'axe', icon: 'axe', label: 'Axe' },
    { tool: 'pickaxe', icon: 'pickaxe', label: 'Pickaxe' },
    { tool: 'hammer', icon: 'hammer', label: 'Hammer' },
    { tool: 'shovel', icon: 'shovel', label: 'Shovel' },
    { tool: 'fishingpole', icon: 'fishingpole', label: 'Fishing pole' },
    { tool: 'watercan', icon: 'watercan', label: 'Watering can' },
    { tool: 'shield', icon: 'shield', label: 'Shield' },
];

/** A Minecraft-style hotbar: tap a slot (or press 1-9) to hold that item; its name shows briefly. */
function Hotbar() {
    const toolId = useStore((s) => s.toolId);
    const [name, setName] = useState<string | null>(null);
    const first = useRef(true);
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        setName(HOTBAR_ITEMS.find((i) => i.tool === toolId)?.label ?? null);
        const id = window.setTimeout(() => setName(null), 1700);
        return () => window.clearTimeout(id);
    }, [toolId]);

    return (
        <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 pb-safe-bottom">
            <div className="h-5 text-sm font-bold text-white transition-opacity duration-300" style={{ textShadow: '0 1px 3px #000', opacity: name ? 1 : 0 }}>
                {name ?? ''}
            </div>
            <div className="flex gap-[3px] rounded-sm p-[3px]" style={{ background: 'rgba(22,22,22,.78)', border: '3px solid #3b3b3b', boxShadow: 'inset 0 0 0 2px #151515' }}>
                {HOTBAR_ITEMS.map((it, i) => {
                    const selected = it.tool === toolId;
                    return (
                        <button
                            key={it.tool}
                            type="button"
                            aria-label={it.label}
                            className="pointer-events-auto relative flex touch-none items-center justify-center"
                            style={{
                                width: 42,
                                height: 42,
                                background: 'rgba(72,72,72,.72)',
                                border: selected ? '3px solid #fff' : '3px solid #5a5a5a',
                                boxShadow: selected ? '0 0 0 2px #000' : 'none',
                                borderRadius: 2,
                            }}
                            onPointerDown={(e) => {
                                e.preventDefault();
                                commands.emit({ type: 'equip', tool: it.tool });
                            }}
                        >
                            {it.icon ? (
                                <img src={`images/hud/${it.icon}.png`} width={32} height={32} draggable={false} alt="" />
                            ) : (
                                <span className="text-lg opacity-80">✋</span>
                            )}
                            <span className="absolute bottom-[-1px] right-[2px] text-[10px] font-bold leading-none text-white" style={{ textShadow: '0 1px 0 #000, 1px 0 0 #000' }}>
                                {i + 1}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function Hud() {
    const tileX = useStore((s) => s.tileX);
    const tileY = useStore((s) => s.tileY);
    const height = useStore((s) => s.height);
    const chunkX = useStore((s) => s.chunkX);
    const chunkY = useStore((s) => s.chunkY);
    const loaded = useStore((s) => s.loadedChunks);
    const hp = useStore((s) => s.hp);
    const paused = useStore((s) => s.paused);
    const inBase = useStore((s) => s.phase === 'base');
    const netStatus = useStore((s) => s.netStatus);
    const online = useStore((s) => s.online);
    const [more, setMore] = useState(false);

    return (
        <div className="pointer-events-none absolute inset-0 pt-safe-top">
            {/* Top left: portrait, hearts, plaque */}
            <div className="absolute left-3 top-2 flex items-start gap-2 pt-safe-top">
                <div
                    className="shrink-0 overflow-hidden"
                    style={{
                        width: 66,
                        height: 66,
                        borderRadius: 16,
                        border: `4px solid ${BROWN}`,
                        boxShadow: `inset 0 0 0 2px #e0b04a, 0 3px 0 ${BROWN_DARK}`,
                        background: 'radial-gradient(circle at 50% 35%, #7a4fa3, #3b2253)',
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            backgroundImage: 'url(images/world/char/idle.png)',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: '1224px 765px',
                            backgroundPosition: '-47px -27px',
                        }}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex gap-0.5">
                        {[0, 1, 2].map((i) => (
                            <Heart key={i} fill={hp >= (i + 1) * 2 ? 1 : hp >= i * 2 + 1 ? 0.5 : 0} />
                        ))}
                    </div>
                    <div
                        className="flex items-center gap-2 px-3 font-black tabular-nums"
                        style={{
                            height: 34,
                            borderRadius: 12,
                            background: `linear-gradient(${TAN_LIGHT}, ${TAN})`,
                            border: `4px solid ${BROWN}`,
                            boxShadow: `inset 0 0 0 2px ${TAN_LIGHT}, 0 3px 0 ${BROWN_DARK}`,
                            color: INK,
                            fontSize: 17,
                        }}
                    >
                        {inBase ? (
                            <span style={{ color: BROWN_DARK }}>WORKSHOP</span>
                        ) : (
                            <>
                                <span style={{ color: BROWN_DARK }}>LV {height}</span>
                                <span>{tileX},{tileY}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Top right: clock and pause */}
            <div className="absolute right-3 top-2 flex items-center gap-2 pt-safe-top">
                <Clock />
                <PixelBtn size={50} onPress={() => store.patch({ phase: 'menu' })}>
                    <Icon.Pause />
                </PixelBtn>
            </div>

            {/* Dev shortcut: jump between the world and the workshop (the base). */}
            <div className="absolute right-3 top-[66px] pt-safe-top">
                <button
                    type="button"
                    className="pointer-events-auto touch-none rounded-xl px-3 font-black active:translate-y-[3px]"
                    style={{
                        height: 34,
                        background: `linear-gradient(${TAN_LIGHT}, ${TAN})`,
                        border: `4px solid ${BROWN}`,
                        boxShadow: `inset 0 0 0 2px ${TAN_LIGHT}, 0 3px 0 ${BROWN_DARK}`,
                        color: INK,
                        fontSize: 14,
                    }}
                    onPointerDown={(e) => {
                        e.preventDefault();
                        if (inBase) store.patch({ spawnAt: 'portal', phase: 'playing' });
                        else store.patch({ phase: 'base' });
                    }}
                >
                    {inBase ? 'World' : 'Workshop'}
                </button>
            </div>

            <Hotbar />

            {/* Actions, bottom right */}
            <div className="absolute bottom-0 right-0 pb-safe-bottom pr-4">
                {more && (
                    <div className="absolute bottom-[205px] right-3 flex gap-2 rounded-2xl p-2" style={{ background: 'rgba(40,20,24,.55)' }}>
                        {([['Dig', 'dig'], ['Fish', 'fish'], ['Sit', 'sit'], ['Hurt', 'hurt'], ['Die', 'die']] as const).map(([label, type]) => (
                            <PixelBtn key={type} size={50} onPress={emit({ type })}><span className="text-[11px]">{label}</span></PixelBtn>
                        ))}
                    </div>
                )}
                <div className="relative h-[200px] w-[250px]">
                    <div className="absolute bottom-1 right-0"><PixelBtn size={92} onPress={emit({ type: 'attack' })}><Icon.Sword /></PixelBtn></div>
                    <div className="absolute bottom-1 right-[104px]"><PixelBtn size={66} onPress={emit({ type: 'use' })}><Icon.Hammer /></PixelBtn></div>
                    <div className="absolute bottom-[100px] right-2"><PixelBtn size={70} onPress={emit({ type: 'interact' })}><Icon.Alert /></PixelBtn></div>
                    <div className="absolute bottom-[116px] right-[102px]"><PixelBtn size={44} onPress={() => setMore((m) => !m)}><Icon.Dots /></PixelBtn></div>
                </div>
            </div>

            {/* World readout, small */}
            {/* Multiplayer: who is in the shared room */}
            {netStatus !== 'off' && (
                <div className="absolute bottom-6 left-2 flex items-center gap-1.5 rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-bold text-white">
                    <span className={`inline-block h-2 w-2 rounded-full ${netStatus === 'online' ? 'bg-emerald-400' : 'animate-pulse bg-amber-300'}`} />
                    {netStatus === 'online' ? `Online · ${online} ${online === 1 ? 'player' : 'players'}` : 'Connecting…'}
                </div>
            )}

            {!inBase && (
                <div className="absolute bottom-1 left-2 rounded-md bg-black/35 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white/80">
                    Chunk {chunkX},{chunkY} · {loaded} loaded
                </div>
            )}

            {paused && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <p className="text-2xl font-bold">Paused</p>
                </div>
            )}
        </div>
    );
}
