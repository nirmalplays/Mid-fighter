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

/** The outline colour used by the game's sprites (dark plum). Buttons and icons share it. */
const PLUM = '#2b0f1c';

type Face = 'tan' | 'red' | 'dark';
const FACES: Record<Face, { light: string; mid: string; dark: string }> = {
    tan: { light: '#fff1d6', mid: '#f1c996', dark: '#d79c68' },
    red: { light: '#ff9a82', mid: '#ee5a48', dark: '#c0342f' },
    dark: { light: '#6d4d86', mid: '#4a2f63', dark: '#341f48' },
};

/**
 * A round action button in the same style as the sprites: a thick plum outline, a soft
 * two-tone face with one highlight, and a hard drop shadow that it sinks into when pressed.
 * Keep the diameter at 44 px or more so it is easy to hit with a thumb.
 */
function RoundBtn({ size, onPress, face = 'tan', label, className = '', children }: {
    size: number; onPress: () => void; face?: Face; label?: string; className?: string; children: ReactNode;
}) {
    const f = FACES[face];
    const lip = Math.max(3, Math.round(size * 0.055));
    return (
        <button
            type="button"
            aria-label={label}
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: `radial-gradient(circle at 36% 28%, ${f.light} 0%, ${f.mid} 52%, ${f.dark} 100%)`,
                border: `${Math.max(3, Math.round(size * 0.055))}px solid ${PLUM}`,
                boxShadow: `inset 0 ${-lip}px 0 rgba(60,20,20,.22), inset 0 ${Math.round(lip * 0.7)}px 0 rgba(255,255,255,.55), 0 ${lip}px 0 ${PLUM}, 0 ${lip + 5}px 10px rgba(0,0,0,.35)`,
                color: PLUM,
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

/** An item picture from public/images/hud (the same outlined art as the world), sized to its button. */
function Pic({ name, size, rotate = 0 }: { name: string; size: number; rotate?: number }) {
    return (
        <img
            src={`images/hud/${name}.png`}
            width={size}
            height={size}
            draggable={false}
            alt=""
            style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined, filter: 'drop-shadow(0 2px 0 rgba(43,15,28,.25))' }}
        />
    );
}

/** A cartoon open hand for "bare hands": white with the sprites' plum outline. */
function HandIcon({ size }: { size: number }) {
    const shapes = (
        <>
            <rect x="7" y="2" width="3.4" height="11" rx="1.7" />
            <rect x="10.8" y="0.6" width="3.4" height="12.4" rx="1.7" />
            <rect x="14.6" y="1.6" width="3.4" height="11.4" rx="1.7" />
            <rect x="18.2" y="4" width="3.2" height="9" rx="1.6" />
            <rect x="4.6" y="10" width="17.2" height="11" rx="5.2" />
            <rect x="1.4" y="9.6" width="3.6" height="9" rx="1.8" transform="rotate(-28 3.2 14)" />
        </>
    );
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
            <g fill={PLUM} stroke={PLUM} strokeWidth="2.6" strokeLinejoin="round">{shapes}</g>
            <g fill="#ffffff">{shapes}</g>
        </svg>
    );
}

/** Pause: two rounded bars. */
function PauseIcon({ size }: { size: number }) {
    return (
        <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
            <rect x="3" y="2.5" width="3.6" height="11" rx="1.4" fill={PLUM} />
            <rect x="9.4" y="2.5" width="3.6" height="11" rx="1.4" fill={PLUM} />
        </svg>
    );
}

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

const SKILL_CHIPS: { key: 'attack' | 'defence' | 'speed'; color: string; label: string }[] = [
    { key: 'attack', color: '#ff6b6b', label: 'Attack' },
    { key: 'defence', color: '#6ba8ff', label: 'Defence' },
    { key: 'speed', color: '#5ee08a', label: 'Speed' },
];

/** Skill levels earned from monster drops: just the gem and the number, under the health plaque. */
function SkillChips() {
    const skills = useStore((s) => s.skills);
    return (
        <div className="absolute left-3 flex gap-3" style={{ top: 80 }}>
            {SKILL_CHIPS.map((c) => (
                <div
                    key={c.key}
                    aria-label={`${c.label} ${skills[c.key]}`}
                    className="flex items-center gap-0.5 text-[17px] font-black tabular-nums text-white"
                    style={{ textShadow: '0 2px 0 #1a0c10, 0 0 4px #1a0c10, 2px 0 0 #1a0c10, -2px 0 0 #1a0c10' }}
                >
                    <img src={`images/hud/gem-${c.key}.png`} width={30} height={30} draggable={false} alt="" style={{ filter: 'drop-shadow(0 2px 0 rgba(26,12,16,.6))' }} />
                    {skills[c.key]}
                </div>
            ))}
        </div>
    );
}

/** Wave countdown, or how many monsters are left while a wave is on. */
function WavePill() {
    const wave = useStore((s) => s.wave);
    const next = useStore((s) => s.nextWaveIn);
    const left = useStore((s) => s.waveLeft);
    const shared = useStore((s) => s.sharedMonsters);
    const mm = Math.floor(next / 60);
    const ss = String(next % 60).padStart(2, '0');
    const fighting = left !== null && left > 0;
    return (
        <div
            className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-xl px-3 text-[13px] font-black tabular-nums text-white"
            style={{ top: 8, height: 34, background: fighting ? 'rgba(120,20,20,.85)' : 'rgba(22,12,16,.72)', border: `3px solid ${fighting ? '#ff6b6b' : '#6b4a52'}` }}
        >
            {fighting ? (
                <span>Wave {wave} · {left} left{shared ? ' · shared' : ''}</span>
            ) : (
                <span>{wave > 0 ? `Wave ${wave + 1}` : 'Wave 1'} in {mm}:{ss}{shared ? ' · shared' : ''}</span>
            )}
        </div>
    );
}

/** The workshop portal while it is open: a green pill with an arrow, distance and seconds left. */
function SafePill() {
    const aim = useStore((s) => s.safeAim);
    if (!aim) return null;
    return (
        <div
            className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-xl px-3 text-[13px] font-black tabular-nums text-white"
            style={{ top: 46, height: 30, background: 'rgba(20,90,50,.88)', border: '3px solid #4ade80' }}
        >
            <span style={{ display: 'inline-block', transform: `rotate(${aim.angle}rad)`, fontSize: 15, lineHeight: 1 }}>➤</span>
            <span>Safe portal · {Math.round(aim.dist)} tiles · {aim.left}s</span>
        </div>
    );
}

/** A message that fades after a couple of seconds (wave starts, pickups). */
function Banner() {
    const banner = useStore((s) => s.banner);
    const [shown, setShown] = useState<string | null>(null);
    useEffect(() => {
        if (!banner) return;
        setShown(banner.text);
        const id = window.setTimeout(() => setShown(null), 2400);
        return () => window.clearTimeout(id);
    }, [banner]);
    return (
        <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center text-xl font-black text-white transition-opacity duration-500"
            style={{ top: 86, opacity: shown ? 1 : 0, textShadow: '0 2px 0 #1a0c10, 0 0 8px #1a0c10, 2px 0 0 #1a0c10, -2px 0 0 #1a0c10' }}
        >
            {shown ?? ''}
        </div>
    );
}

const BUFF_INFO: Record<string, { label: string; color: string }> = {
    blue: { label: 'Attack x1.5', color: '#5aa8ff' },
    yellow: { label: 'Speed x1.4', color: '#ffd84d' },
    purple: { label: 'Shield', color: '#b070ff' },
    black: { label: 'Rage', color: '#c9b8e0' },
};

/** Potion boosts that are running, with seconds left. */
function Buffs() {
    const buffs = useStore((s) => s.buffs);
    if (buffs.length === 0) return null;
    return (
        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 gap-2" style={{ top: 120 }}>
            {buffs.map((b) => (
                <div
                    key={b.key}
                    className="whitespace-nowrap rounded-full px-3 text-sm font-black text-white"
                    style={{ background: 'rgba(20,16,30,.85)', border: `3px solid ${BUFF_INFO[b.key]?.color ?? '#fff'}`, lineHeight: '24px' }}
                >
                    {BUFF_INFO[b.key]?.label} · {b.left}s
                </div>
            ))}
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

/**
 * A Minecraft-style hotbar: tap a slot (or press 1-9) to hold that item; its name shows briefly.
 * It sits between the left info pills and the action buttons, never under either.
 */
function Hotbar() {
    const toolId = useStore((s) => s.toolId);
    const owned = useStore((s) => s.swordsOwned.length);
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
        <div className="pointer-events-none absolute bottom-2 flex flex-col items-center gap-1 pb-safe-bottom" style={{ left: 150, right: 276 }}>
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
                                // Shrinks on narrow screens so nine slots always fit the gap.
                                width: 'min(40px, calc((100vw - 450px) / 9))',
                                height: 'min(40px, calc((100vw - 450px) / 9))',
                                background: 'rgba(72,72,72,.72)',
                                border: selected ? '3px solid #fff' : '3px solid #5a5a5a',
                                boxShadow: selected ? '0 0 0 2px #000' : 'none',
                                borderRadius: 2,
                            }}
                            onPointerDown={(e) => {
                                e.preventDefault();
                                // Tapping the sword slot while holding the sword steps through the swords you own.
                                if (it.tool === 'sword' && selected && owned > 0) commands.emit({ type: 'sword', delta: 1 });
                                else commands.emit({ type: 'equip', tool: it.tool });
                            }}
                        >
                            {it.icon ? (
                                <img src={`images/hud/${it.icon}.png`} width={32} height={32} draggable={false} alt="" />
                            ) : (
                                <HandIcon size={26} />
                            )}
                            <span className="absolute bottom-[-1px] right-[2px] text-[10px] font-bold leading-none text-white" style={{ textShadow: '0 1px 0 #000, 1px 0 0 #000' }}>
                                {i + 1}
                            </span>
                            {it.tool === 'sword' && owned > 0 && (
                                <span className="absolute left-[1px] top-[-5px] rounded-full bg-amber-300 px-[4px] text-[10px] font-black leading-[13px] text-[#3b2412]" style={{ border: '1px solid #2b0f1c' }}>
                                    {owned}
                                </span>
                            )}
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
    const maxHp = useStore((s) => s.maxHp);
    const paused = useStore((s) => s.paused);
    const inBase = useStore((s) => s.phase === 'base');
    const netStatus = useStore((s) => s.netStatus);
    const online = useStore((s) => s.online);
    const roomCode = useStore((s) => s.roomCode);
    const kills = useStore((s) => s.kills);
    const [more, setMore] = useState(false);
    const toolId = useStore((s) => s.toolId);

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
                        {Array.from({ length: Math.ceil(maxHp / 2) }, (_, i) => i).map((i) => (
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
                <RoundBtn size={48} label="Pause" onPress={() => store.patch({ phase: 'menu' })}>
                    <PauseIcon size={24} />
                </RoundBtn>
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
                        if (inBase) store.patch({ phase: 'playing' });
                        else store.patch({ phase: 'base' });
                    }}
                >
                    {inBase ? 'World' : 'Workshop'}
                </button>
            </div>

            <Hotbar />
            {!inBase && <SkillChips />}
            {!inBase && <WavePill />}
            {!inBase && <SafePill />}
            {!inBase && <Banner />}
            {!inBase && <Buffs />}

            {/* Actions, bottom right, in the thumb's arc: Attack (big), Use (the held tool), Actions menu */}
            <div className="absolute bottom-0 right-0 pb-safe-bottom pr-4">
                {more && (
                    <div className="absolute flex gap-2 rounded-2xl p-2" style={{ bottom: 168, right: 30, background: 'rgba(31,14,38,.78)', border: `3px solid ${PLUM}` }}>
                        {([['Dig', 'dig', 'shovel'], ['Fish', 'fish', 'fishingpole'], ['Sit', 'sit', 'log']] as const).map(([label, type, pic]) => (
                            <div key={type} className="flex flex-col items-center gap-0.5">
                                <RoundBtn size={52} label={label} onPress={emit({ type })}><Pic name={pic} size={32} /></RoundBtn>
                                <span className="text-[11px] font-black text-white" style={{ textShadow: '0 1px 0 #000' }}>{label}</span>
                            </div>
                        ))}
                    </div>
                )}
                <div className="relative h-[190px] w-[250px]">
                    <div className="absolute bottom-1 right-0">
                        <RoundBtn size={96} face="red" label="Attack" onPress={emit({ type: 'attack' })}><Pic name="sword" size={80} rotate={-42} /></RoundBtn>
                    </div>
                    <div className="absolute bottom-2 right-[112px]">
                        <RoundBtn size={66} label="Use held item" onPress={emit({ type: 'use' })}>
                            {toolId === 'none' ? <HandIcon size={38} /> : <Pic name={toolId} size={46} />}
                        </RoundBtn>
                    </div>
                    <div className="absolute bottom-[104px] right-[56px]">
                        <RoundBtn size={52} label="More actions" onPress={() => setMore((m) => !m)}><Pic name="chest" size={34} /></RoundBtn>
                    </div>
                </div>
            </div>

            {/* World readout, small */}
            {/* Enemies defeated */}
            {!inBase && kills > 0 && (
                <div className="absolute bottom-[50px] left-2 rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-bold text-white">
                    ⚔️ Defeated · {kills}
                </div>
            )}

            {/* Multiplayer: the room's code (tap to copy) and how many are in it */}
            {netStatus !== 'off' && (
                <button
                    type="button"
                    className="pointer-events-auto absolute bottom-6 left-2 flex touch-manipulation items-center gap-1.5 rounded-md bg-black/50 px-2 py-0.5 text-[11px] font-bold text-white"
                    onClick={() => {
                        if (roomCode) {
                            try { void navigator.clipboard?.writeText(roomCode); } catch { /* clipboard unavailable */ }
                            store.patch({ banner: { text: `Room code ${roomCode} copied`, id: Date.now() } });
                        }
                    }}
                >
                    <span className={`inline-block h-2 w-2 rounded-full ${netStatus === 'online' ? 'bg-emerald-400' : 'animate-pulse bg-amber-300'}`} />
                    {netStatus !== 'online'
                        ? 'Connecting…'
                        : roomCode
                            ? `Room ${roomCode} · ${online}`
                            : `Online · ${online} ${online === 1 ? 'player' : 'players'}`}
                </button>
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
