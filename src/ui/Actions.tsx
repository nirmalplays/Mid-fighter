/**
 * The action buttons. One family of buttons: a coloured, glossy face inside a gold bezel, with a
 * raised lip that sinks when pressed and a small name plate on the rim.
 *   Bottom right: Attack, big, in the corner; around it, on one even quarter-circle and all the
 *   same size, Heal · Spells · Skill · Dodge (always in that order, never touching).
 *   Above the hotbar: the action pill (Talk, Build, Chop, Travel...), only when there is
 *   something to do in front of you.
 *   Bottom left: Run, on the movement side.
 * The cluster scales down on short screens so it never runs into the objective panel.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { commands } from '../game/commands.ts';
import { KINGDOMS } from '../game/eidolon.ts';
import type { ItemId } from '../game/survival.ts';
import { SPELLS } from '../game/world/spells.ts';
import { store, useStore, type ActKind } from '../state/store.ts';
import { Icon, OUTLINE, press } from './hudKit.tsx';

/** A face colour: light (top), main, dark (bottom). */
type Face = [string, string, string];
const FACE: Record<string, Face> = {
    attack: ['#ff9a9a', '#e11d48', '#7f1d1d'],
    heal: ['#ffc4d0', '#f43f5e', '#881337'],
    spells: ['#ddd0ff', '#8b5cf6', '#3b0764'],
    dodge: ['#fff1a8', '#f59e0b', '#7c2d12'],
    run: ['#e2e8f0', '#64748b', '#1e293b'],
    runOn: ['#fff1a8', '#eab308', '#713f12'],
    plain: ['#f5e1c8', '#a8754a', '#4a2a14'],
};
const BEZEL = 'linear-gradient(160deg, #fff3c4 0%, #e0b04a 35%, #9a5b16 70%, #fde68a 100%)';
const LIP = '#3b1d0a';

/** One button of the family. `face` colours it; `plate` names it on its rim; `ring` replaces the gold bezel (the skill's meter). */
function GameButton({ size, face, label, plate, onPress, children, dim = false, glow, badge, ring }: {
    size: number; face: Face; label: string; plate?: string; onPress: () => void; children: ReactNode;
    dim?: boolean; glow?: string; badge?: ReactNode; ring?: string;
}) {
    const [down, setDown] = useState(false);
    const lip = Math.max(3, Math.round(size * 0.06));
    return (
        <button
            type="button"
            aria-label={label}
            className="pointer-events-auto relative touch-none select-none rounded-full"
            style={{
                width: size, height: size, padding: 3, background: ring ?? BEZEL,
                transform: down ? `translateY(${lip - 1}px)` : undefined,
                boxShadow: `0 ${down ? 1 : lip}px 0 ${LIP}, 0 ${down ? 3 : 8}px 14px rgba(0,0,0,.4)${glow ? `, 0 0 18px ${glow}` : ''}`,
                opacity: dim ? 0.55 : 1, transition: 'transform 60ms, box-shadow 60ms',
            }}
            onPointerDown={(e) => {
                setDown(true);
                press(onPress)(e);
            }}
            onPointerUp={() => setDown(false)}
            onPointerLeave={() => setDown(false)}
            onPointerCancel={() => setDown(false)}
        >
            <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full" style={{ background: `radial-gradient(circle at 50% 30%, ${face[0]} 0%, ${face[1]} 52%, ${face[2]} 100%)`, boxShadow: 'inset 0 -4px 8px rgba(0,0,0,.35)' }}>
                {/* the gloss */}
                <span className="pointer-events-none absolute rounded-full" style={{ left: '14%', right: '14%', top: '5%', height: '42%', background: 'linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,0))' }} />
                <span className="relative flex items-center justify-center" style={{ filter: 'drop-shadow(0 2px 1px rgba(0,0,0,.45))' }}>{children}</span>
            </span>
            {plate && (
                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 text-[9px] font-black uppercase tracking-wider text-white" style={{ bottom: -7, lineHeight: '14px', background: 'rgba(30,16,10,.92)', border: '1.5px solid #e0b04a' }}>
                    {plate}
                </span>
            )}
            {badge}
        </button>
    );
}

/** The same button outside the cluster (the top bar's Bag and Pause). */
export function GlassButton({ size, label, onPress, children }: { size: number; label: string; onPress: () => void; children: ReactNode }) {
    return <GameButton size={size} face={FACE.plain} label={label} onPress={onPress}>{children}</GameButton>;
}

/** A picture from public/images/hud. */
const Pic = ({ name, size, rotate = 0 }: { name: string; size: number; rotate?: number }) => (
    <img src={`images/hud/${name}.png`} width={size} height={size} draggable={false} alt="" style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined }} />
);
const Emoji = ({ c, size }: { c: string; size: number }) => <span style={{ fontSize: size, lineHeight: 1 }}>{c}</span>;

/** White line icons for the moves. */
function DodgeIcon({ size }: { size: number }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15a8 8 0 0 1 14.5-5" /><path d="M19 4v6h-6" />
        </svg>
    );
}
function RunIcon({ size }: { size: number }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 6l6 6-6 6" /><path d="M13 6l6 6-6 6" />
        </svg>
    );
}
function SpellIcon({ size }: { size: number }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="#fff">
            <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z" />
            <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z" opacity="0.85" />
        </svg>
    );
}

/** The colour, verb and picture of each kind of action. */
const ACT: Record<ActKind, { color: string; verb: string; icon: (s: number) => ReactNode }> = {
    talk: { color: '#38bdf8', verb: 'Talk', icon: (s) => <Emoji c="💬" size={s * 0.8} /> },
    build: { color: '#f59e0b', verb: 'Build', icon: (s) => <Pic name="hammer" size={s} /> },
    chop: { color: '#22c55e', verb: 'Chop', icon: (s) => <Pic name="axe" size={s} /> },
    mine: { color: '#22c55e', verb: 'Mine', icon: (s) => <Pic name="pickaxe" size={s} /> },
    pick: { color: '#22c55e', verb: 'Gather', icon: (s) => <Emoji c="🫐" size={s * 0.8} /> },
    open: { color: '#eab308', verb: 'Open', icon: (s) => <Pic name="chest" size={s} /> },
    search: { color: '#eab308', verb: 'Search', icon: (s) => <Emoji c="📦" size={s * 0.8} /> },
    bench: { color: '#a78bfa', verb: 'Workbench', icon: (s) => <Pic name="hammer" size={s} /> },
    travel: { color: '#f97316', verb: 'Camp fire', icon: (s) => <Emoji c="🔥" size={s * 0.8} /> },
    climb: { color: '#94a3b8', verb: 'Climb', icon: (s) => <Emoji c="🗼" size={s * 0.8} /> },
    challenge: { color: '#ef4444', verb: 'Fight', icon: (s) => <Emoji c="⚔️" size={s * 0.8} /> },
    fish: { color: '#0ea5e9', verb: 'Fish', icon: (s) => <Pic name="fishingpole" size={s} /> },
    drink: { color: '#0ea5e9', verb: 'Drink', icon: (s) => <Emoji c="💧" size={s * 0.8} /> },
    wait: { color: '#6b7280', verb: '', icon: (s) => <Emoji c="⏳" size={s * 0.7} /> },
};

/** The action pill above the hotbar: what Use (E) does right now, as a big button. */
function ActionPill() {
    const act = useStore((s) => s.act);
    const revive = useStore((s) => s.reviveTarget);
    const shown = revive ? { color: '#22c55e', verb: 'Teammate', label: 'Help them up', icon: (s: number) => <Emoji c="🤝" size={s * 0.8} /> } : act ? { ...ACT[act.kind], label: act.label } : null;
    if (!shown) return null;
    return (
        <div className="pointer-events-none absolute flex justify-center pb-safe-bottom" style={{ left: 150, right: 276, bottom: 76 }} data-quiet>
            <button
                type="button"
                aria-label={shown.label}
                className="pointer-events-auto flex touch-none items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-transform active:translate-y-[3px]"
                style={{ background: BEZEL, boxShadow: `0 4px 0 ${LIP}, 0 8px 16px rgba(0,0,0,.45), 0 0 18px ${shown.color}88`, animation: 'act-in .18s ease-out both' }}
                onPointerDown={press(() => commands.emit({ type: 'use' }))}
            >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `radial-gradient(circle at 50% 30%, #fff 0%, ${shown.color} 55%, #1e1b18 120%)`, boxShadow: 'inset 0 -3px 6px rgba(0,0,0,.35)' }}>
                    {shown.icon(28)}
                </span>
                <span className="flex flex-col items-start leading-tight">
                    {shown.verb && <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5a2e0c]">{shown.verb}</span>}
                    <span className="max-w-[240px] truncate whitespace-nowrap text-[15px] font-black text-[#2b1206]">{shown.label}</span>
                </span>
                <span className="ml-1 rounded-md px-1.5 text-[10px] font-black text-[#fff3c4]" style={{ background: 'rgba(43,18,6,.75)', lineHeight: '16px' }}>E</span>
            </button>
        </div>
    );
}

/** The home kingdom's skill: its meter fills the bezel; full, it glows (key Q). */
function SkillButton({ size }: { size: number }) {
    const meter = useStore((s) => s.meter);
    const kingdom = useStore((s) => s.kingdom);
    if (!kingdom) return null;
    const k = KINGDOMS[kingdom];
    const ready = meter >= 100;
    return (
        <GameButton
            size={size}
            face={['#ffffff', k.css, '#1f1030']}
            label={`${k.skill.name} (${meter}%)`}
            plate={ready ? 'Ready!' : `Skill ${meter}%`}
            ring={`conic-gradient(${k.css} ${meter * 3.6}deg, #4a3a2a 0deg)`}
            glow={ready ? k.css : undefined}
            onPress={() => commands.emit({ type: 'skill' })}
        >
            <span style={{ fontSize: size * 0.42, lineHeight: 1 }}>{k.glyph}</span>
        </GameButton>
    );
}

/** One tap drinks a healing draught (or eats the best food carried). */
function HealButton({ size }: { size: number }) {
    const bag = useStore((s) => s.bag);
    const order: ItemId[] = ['potion_red', 'meal', 'cooked_meat', 'berries'];
    const id = order.find((k) => bag[k] > 0) ?? null;
    return (
        <GameButton
            size={size}
            face={FACE.heal}
            label="Heal"
            plate="Heal"
            dim={!id}
            onPress={() => id && commands.emit({ type: 'item', id })}
            badge={<span className="absolute -right-1 -top-1 min-w-[20px] rounded-full px-1 text-center text-[11px] font-black leading-[18px] text-[#2b0f1c]" style={{ background: '#fde68a', border: '2px solid #2b0f1c' }}>{id ? bag[id] : 0}</span>}
        >
            <Icon id={id ?? 'potion_red'} size={size * 0.56} />
        </GameButton>
    );
}

/** The Attack button (size) and its centre, from the screen's bottom-right corner. */
const ATTACK = 92;
const ORIGIN = 66;
/** The ring: Heal · Spells · Skill · Dodge, all one size, evenly round the quarter-circle from the left to straight up. */
const SMALL = 58;
const RADIUS = 140;
const RING_ORDER = ['heal', 'spells', 'skill', 'dodge'] as const;
const ringAt = (n: number): CSSProperties => {
    const a = Math.PI - (n * Math.PI) / 2 / (RING_ORDER.length - 1);
    const x = Math.cos(a) * RADIUS, y = Math.sin(a) * RADIUS;
    return { position: 'absolute', right: ORIGIN - x - SMALL / 2, bottom: ORIGIN + y - SMALL / 2 };
};

export function ActionCluster() {
    const sprint = useStore((s) => s.sprint);
    const stamina = useStore((s) => s.stamina);
    const spells = useStore((s) => s.spells);
    const spellState = useStore((s) => s.spellState);
    const [more, setMore] = useState(false);
    // Short screens: shrink the whole cluster (it is laid out for about 600 px of height).
    const [scale, setScale] = useState(1);
    useEffect(() => {
        const fit = () => setScale(Math.max(0.66, Math.min(1, window.innerHeight / 600)));
        fit();
        window.addEventListener('resize', fit);
        return () => window.removeEventListener('resize', fit);
    }, []);
    const anyUnlocked = spells.unlocked.some(Boolean);
    const button = (key: (typeof RING_ORDER)[number]) => {
        if (key === 'heal') return <HealButton size={SMALL} />;
        if (key === 'skill') return <SkillButton size={SMALL} />;
        if (key === 'spells') {
            return (
                <GameButton size={SMALL} face={FACE.spells} label="Spells" plate="Spells" glow={more ? '#a78bfa' : undefined} onPress={() => setMore((m) => !m)}>
                    <SpellIcon size={28} />
                </GameButton>
            );
        }
        return (
            <GameButton size={SMALL} face={FACE.dodge} label="Dodge roll" plate="Dodge" dim={stamina.tired} onPress={() => commands.emit({ type: 'dodge' })}>
                <DodgeIcon size={28} />
            </GameButton>
        );
    };
    return (
        <>
            <div className="pointer-events-none absolute bottom-0 right-0 pb-safe-bottom pr-1" data-quiet>
                <div className="relative" style={{ width: 300, height: 260, transform: `scale(${scale})`, transformOrigin: '100% 100%' }}>
                    {/* the spells, opened from their button */}
                    {more && (
                        <div className="pointer-events-auto absolute flex items-end gap-3 rounded-2xl px-3 pb-3 pt-2" style={{ right: 40, bottom: 250, background: 'rgba(30,16,10,.88)', border: '2px solid #e0b04a' }}>
                            {!anyUnlocked && <span className="max-w-[200px] text-center text-[12px] font-bold text-white">No spells yet. Find the frog to unlock one.</span>}
                            {SPELLS.map((sp, i) => {
                                if (!spells.unlocked[i]) return null;
                                const st = spellState[i];
                                const empty = st.charges < 1;
                                return (
                                    <div key={sp.name} className="relative flex flex-col items-center">
                                        <GameButton size={52} face={FACE.spells} label={sp.name} dim={empty} onPress={() => { commands.emit({ type: 'spell', index: i }); setMore(false); }}>
                                            <img src={`images/${sp.icon}`} width={30} height={30} draggable={false} alt="" style={{ objectFit: 'contain' }} />
                                            {empty && <span className="absolute inset-0 flex items-center justify-center text-[16px] font-black text-white" style={{ textShadow: OUTLINE }}>{st.cd}</span>}
                                        </GameButton>
                                        <div className="mt-1.5 flex gap-0.5">
                                            {Array.from({ length: st.max }, (_, n) => <span key={n} className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: n < st.charges ? '#fde68a' : 'rgba(255,255,255,.25)' }} />)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="absolute" style={{ right: ORIGIN - ATTACK / 2, bottom: ORIGIN - ATTACK / 2 }}>
                        <GameButton size={ATTACK} face={FACE.attack} label="Attack" glow="#f43f5e66" onPress={() => commands.emit({ type: 'attack' })}>
                            <Pic name="sword" size={60} rotate={-42} />
                        </GameButton>
                    </div>
                    {RING_ORDER.map((key, n) => <div key={key} style={ringAt(n)}>{button(key)}</div>)}
                </div>
            </div>
            {/* Run, on the movement side */}
            <div className="pointer-events-none absolute bottom-3 left-3 pb-safe-bottom" data-quiet>
                <GameButton size={50} face={sprint ? FACE.runOn : FACE.run} label="Sprint" plate={sprint ? 'Running' : 'Run'} glow={sprint ? '#eab308' : undefined} onPress={() => store.patch({ sprint: !store.get().sprint })}>
                    <RunIcon size={24} />
                </GameButton>
            </div>
            <ActionPill />
        </>
    );
}
