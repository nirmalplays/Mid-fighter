/**
 * The game controls, all cut from the UI Asset Pack's buttons (stone, and wood for Attack), with
 * pixel icons, a small name under each and its key in the corner. Laid out like Genshin's:
 *   bottom right: Attack (large) in the corner, Skill to its left, Spells above-left, Dodge above,
 *   Heal further left; every button has clear space around it, nothing touches.
 *   bottom left: Run, on the movement side.
 *   beside the player: what E does here (Talk, Build, Chop...), only when something is in reach.
 * The cluster scales down on short screens so it never runs into the panels above it.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { commands } from '../game/commands.ts';
import { KINGDOMS } from '../game/eidolon.ts';
import type { ItemId } from '../game/survival.ts';
import { SPELLS } from '../game/world/spells.ts';
import { store, useStore, type ActKind } from '../state/store.ts';
import { useHudLayout } from './HudTop.tsx';
import { press } from './hudKit.tsx';
import { uiHeight } from './uiScale.ts';
import { ELEMENT_ICON, Ico, type IconName } from './icons.tsx';
import { KeyCap, PackButton, PackIcon, slice, SwordSprite } from './px.tsx';

const SHADOW = '0 2px 0 #000, 0 0 3px #000';

/** A control: the pack button, its name beneath, its key at the top corner. */
function Control({ size, name, keyHint, children, ...rest }: Parameters<typeof PackButton>[0] & { name: string; keyHint?: string }) {
    return (
        <div className="relative flex flex-col items-center" style={{ width: size }}>
            <PackButton size={size} {...rest}>{children}</PackButton>
            {keyHint && <KeyCap style={{ position: 'absolute', top: -7, right: -7 }}>{keyHint}</KeyCap>}
            <span className="pointer-events-none mt-0.5 whitespace-nowrap text-[11px] leading-none text-[#f3e3c0]" style={{ textShadow: SHADOW }}>{name}</span>
        </div>
    );
}

/** The kingdom's skill: the button darkens from the top while it charges; full, it glows (key Q). */
function SkillControl({ size }: { size: number }) {
    const meter = useStore((s) => s.meter);
    const kingdom = useStore((s) => s.kingdom);
    if (!kingdom) return <div style={{ width: size }} />;
    const k = KINGDOMS[kingdom];
    const ready = meter >= 100;
    return (
        <Control size={size} name={ready ? 'Ready!' : `${k.skill.name.split(' ')[0]} ${meter}%`} keyHint="Q" label={`${k.skill.name} (${meter}%)`} glow={ready ? k.css : undefined} onPress={() => commands.emit({ type: 'skill' })}>
            <Ico name={ELEMENT_ICON[kingdom]} size={size * 0.56} color={k.css} />
            {!ready && <span className="pointer-events-none absolute inset-x-[6px] top-[6px] bg-black/55" style={{ height: `calc((100% - 14px) * ${1 - meter / 100})` }} />}
        </Control>
    );
}

/** One tap drinks a healing draught (or eats the best food carried); the count sits on it. */
function HealControl({ size }: { size: number }) {
    const bag = useStore((s) => s.bag);
    const order: ItemId[] = ['potion_red', 'meal', 'cooked_meat', 'berries'];
    const id = order.find((k) => bag[k] > 0) ?? null;
    // H heals too.
    useEffect(() => {
        const on = (e: KeyboardEvent) => {
            if (e.repeat || (e.key !== 'h' && e.key !== 'H') || store.get().phase !== 'playing') return;
            const best = order.find((k) => store.get().bag[k] > 0);
            if (best) commands.emit({ type: 'item', id: best });
        };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    });
    return (
        <Control size={size} name="Heal" keyHint="H" label="Heal" dim={!id} onPress={() => id && commands.emit({ type: 'item', id })}>
            <Ico name="flask" size={size * 0.56} color="#ef4444" />
            <span className="pointer-events-none absolute bottom-[3px] right-[5px] text-[12px] leading-none text-white" style={{ textShadow: SHADOW }}>{id ? bag[id] : 0}</span>
        </Control>
    );
}

/** What each kind of action looks like beside the player. */
const ACT: Record<ActKind, { verb: string; icon: IconName | 'axe' | 'pickaxe' | 'hammer'; color: string }> = {
    talk: { verb: 'Talk', icon: 'talk', color: '#bae6fd' },
    build: { verb: 'Build', icon: 'hammer', color: '#fde68a' },
    chop: { verb: 'Chop', icon: 'axe', color: '#bbf7d0' },
    mine: { verb: 'Mine', icon: 'pickaxe', color: '#bbf7d0' },
    pick: { verb: 'Gather', icon: 'berry', color: '#f9a8d4' },
    open: { verb: 'Open', icon: 'crate', color: '#fde68a' },
    search: { verb: 'Search', icon: 'crate', color: '#fde68a' },
    bench: { verb: 'Workbench', icon: 'hammer', color: '#ddd6fe' },
    travel: { verb: 'Camp fire', icon: 'campfire', color: '#fdba74' },
    climb: { verb: 'Climb', icon: 'tower', color: '#e5e7eb' },
    challenge: { verb: 'Fight', icon: 'swords', color: '#fca5a5' },
    fish: { verb: 'Fish', icon: 'wave', color: '#bae6fd' },
    drink: { verb: 'Drink', icon: 'drop', color: '#bae6fd' },
    wait: { verb: '', icon: 'hourglass', color: '#d1d5db' },
};

/** What E does here, beside the player: the key, a wood plate with the icon and the words. */
function ActionPrompt() {
    const act = useStore((s) => s.act);
    const revive = useStore((s) => s.reviveTarget);
    const shown = revive ? { verb: 'Teammate', icon: 'hands' as IconName, color: '#bbf7d0', label: 'Help them up' } : act ? { ...ACT[act.kind], label: act.label } : null;
    if (!shown) return null;
    const icon = shown.icon === 'axe' || shown.icon === 'pickaxe' || shown.icon === 'hammer'
        ? <img src={`images/hud/${shown.icon}.png`} width={26} height={26} alt="" draggable={false} />
        : <Ico name={shown.icon} size={24} color={shown.color} />;
    return (
        <div className="pointer-events-none absolute" style={{ left: 'calc(50% + 64px)', top: 'calc(50% - 18px)' }} data-quiet>
            <button
                type="button"
                aria-label={shown.label}
                className="pointer-events-auto flex min-h-[46px] touch-none items-center gap-2 transition-transform active:translate-y-[2px]"
                style={{ animation: 'act-in .15s ease-out both' }}
                onPointerDown={press(() => commands.emit({ type: 'use' }))}
            >
                <KeyCap style={{ height: 24, minWidth: 24, fontSize: 13 }}>E</KeyCap>
                <span className="flex items-center gap-2 py-0.5 pl-1 pr-3" style={{ ...slice('btn3-normal', 2), color: '#fff3d6', textShadow: '0 2px 0 #3b2412' }}>
                    {icon}
                    <span className="flex flex-col items-start leading-tight">
                        {shown.verb && <span className="text-[10px] uppercase tracking-[0.14em] text-[#ffe0a8]">{shown.verb}</span>}
                        <span className="max-w-[220px] truncate whitespace-nowrap text-[14px]">{shown.label}</span>
                    </span>
                </span>
            </button>
        </div>
    );
}

/** The cluster's layout: each control's centre as (left, up) from the screen's bottom-right corner, and its size. */
type Spot = Record<'attack' | 'skill' | 'spells' | 'dodge' | 'heal', { r: number; b: number; s: number }>;
const SPOT: Spot = {
    attack: { r: 70, b: 76, s: 84 },
    skill: { r: 172, b: 56, s: 62 },
    spells: { r: 156, b: 160, s: 54 },
    dodge: { r: 64, b: 182, s: 54 },
    heal: { r: 262, b: 50, s: 52 },
};
/** A phone held sideways: the Attack button in the thumb's corner, the others in an arc round it, none under 46 px. */
const SPOT_COMPACT: Spot = {
    attack: { r: 54, b: 58, s: 78 },
    dodge: { r: 54, b: 144, s: 54 },
    spells: { r: 130, b: 122, s: 52 },
    skill: { r: 136, b: 48, s: 54 },
    heal: { r: 198, b: 96, s: 50 },
};
const place = (spot: Spot, k: keyof Spot): CSSProperties => ({ position: 'absolute', right: spot[k].r - spot[k].s / 2, bottom: spot[k].b - spot[k].s / 2 - 8 });

export function ActionCluster() {
    const sprint = useStore((s) => s.sprint);
    const stamina = useStore((s) => s.stamina);
    const spells = useStore((s) => s.spells);
    const spellState = useStore((s) => s.spellState);
    const swordIdx = useStore((s) => s.swordIdx);
    const [more, setMore] = useState(false);
    const { compact } = useHudLayout();
    const spot = compact ? SPOT_COMPACT : SPOT;
    // Tall screens shrink the cluster a little on the way down (laid out for about 600 px of height);
    // a sideways phone has its own arc and keeps every button thumb-sized.
    const [scale, setScale] = useState(1);
    useEffect(() => {
        const fit = () => setScale(compact ? 1 : Math.max(0.66, Math.min(1, uiHeight() / 600)));
        fit();
        window.addEventListener('resize', fit);
        return () => window.removeEventListener('resize', fit);
    }, [compact]);
    const anyUnlocked = spells.unlocked.some(Boolean);
    const box = (k: keyof Spot, node: ReactNode) => <div style={place(spot, k)}>{node}</div>;
    return (
        <>
            <div className="pointer-events-none absolute bottom-0 right-0 pb-safe-bottom pr-1" data-quiet>
                <div className="relative" style={{ width: compact ? 232 : 310, height: compact ? 190 : 240, transform: `scale(${scale})`, transformOrigin: '100% 100%' }}>
                    {/* the spells, opened from their button */}
                    {more && (
                        <div className="pointer-events-auto absolute flex items-end gap-3 px-3 pb-3 pt-2" style={{ ...slice('frame5', 2), right: compact ? 6 : 40, bottom: compact ? 182 : 222 }}>
                            {!anyUnlocked && <span className="max-w-[200px] text-center text-[12px] text-[#2f2a35]">No spells yet. Find the frog to unlock one.</span>}
                            {SPELLS.map((sp, i) => {
                                if (!spells.unlocked[i]) return null;
                                const st = spellState[i];
                                const empty = st.charges < 1;
                                return (
                                    <Control key={sp.name} size={compact ? 50 : 48} name={empty ? `${st.cd}s` : `${st.charges}/${st.max}`} label={sp.name} dim={empty} onPress={() => { commands.emit({ type: 'spell', index: i }); setMore(false); }}>
                                        <img src={`images/${sp.icon}`} width={28} height={28} draggable={false} alt="" style={{ objectFit: 'contain' }} />
                                    </Control>
                                );
                            })}
                        </div>
                    )}
                    {box('attack', (
                        <Control variant="wood" size={spot.attack.s} name="Attack" keyHint="J" label="Attack" onPress={() => commands.emit({ type: 'attack' })}>
                            <SwordSprite index={swordIdx >= 0 ? swordIdx : 13} size={56} />
                        </Control>
                    ))}
                    {box('skill', <SkillControl size={spot.skill.s} />)}
                    {box('spells', (
                        <Control size={spot.spells.s} name="Spells" label="Spells" glow={more ? '#c4b5fd' : undefined} onPress={() => setMore((m) => !m)}>
                            <Ico name="star" size={30} color="#c4b5fd" />
                        </Control>
                    ))}
                    {box('dodge', (
                        <Control size={spot.dodge.s} name="Dodge" keyHint="K" label="Dodge roll" dim={stamina.tired} onPress={() => commands.emit({ type: 'dodge' })}>
                            <PackIcon index={8} size={30} />
                        </Control>
                    ))}
                    {box('heal', <HealControl size={spot.heal.s} />)}
                </div>
            </div>
            {/* Run, on the movement side */}
            <div className="pointer-events-none absolute bottom-2 pb-safe-bottom" style={{ left: 'max(12px, env(safe-area-inset-left))' }} data-quiet>
                <Control size={compact ? 54 : 50} name={sprint ? 'Running' : 'Run'} keyHint="Shift" label="Sprint" glow={sprint ? '#fde047' : undefined} variant={sprint ? 'wood' : 'stone'} onPress={() => store.patch({ sprint: !store.get().sprint })}>
                    <PackIcon index={3} size={26} />
                </Control>
            </div>
            <ActionPrompt />
        </>
    );
}
