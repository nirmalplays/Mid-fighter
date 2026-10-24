/**
 * The inventory, a leather-and-gold satchel: filters by kind (potions, materials, food, tools,
 * gems), a grid of gold-edged slots (20, more with upgrades; every stack takes a slot), the chosen
 * item large on the right with its story and what it does (use, set down, put in the hotbar,
 * drop), and your hearts and gems along the bottom. Also the workbench list for mending tools
 * and growing the backpack. It is the Bag's first page and opens with B (or I, or Tab).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { commands } from '../game/commands.ts';
import { progress } from '../game/progress.ts';
import {
    BACKPACK_TOP, backpackCost, backpackSlots, FOOD, HOTBAR_SLOTS, ITEM_IDS, ITEMS, slotsUsed, stackOf, WEAPONS,
    type ItemId,
} from '../game/survival.ts';
import { Ico, type IconName } from './icons.tsx';
import { store, useStore } from '../state/store.ts';
import { BROWN, BROWN_DARK, Btn, Cost, Icon, INK, press, ROW } from './hudKit.tsx';

/** The gold of the bag's frame and lettering. */
export const GOLD = '#d9a441';
const GOLD_DIM = '#8a6424';
const CREAM = '#f3e3c0';
const CINZEL = 'var(--font-pixel)';

/** What the inventory can be filtered to. */
type Cat = 'all' | 'potions' | 'materials' | 'food' | 'tools' | 'gems';
const CATS: { id: Cat; label: string; icon: IconName }[] = [
    { id: 'all', label: 'All', icon: 'bag' },
    { id: 'potions', label: 'Potions', icon: 'flask' },
    { id: 'materials', label: 'Materials', icon: 'rock' },
    { id: 'food', label: 'Food', icon: 'meat' },
    { id: 'tools', label: 'Tools', icon: 'sword' },
    { id: 'gems', label: 'Gems', icon: 'gem' },
];
const catOf = (k: ItemId): Exclude<Cat, 'all'> => {
    if (ITEMS[k].tool || k === 'trap_spike' || k === 'barricade') return 'tools';
    if (k.startsWith('potion_') || k.startsWith('oil_')) return 'potions';
    if (k.startsWith('gem')) return 'gems';
    if (FOOD[k]) return 'food';
    return 'materials';
};

/** A slot of the grid: a gold-edged dark well, the item, its count. */
function Slot({ id, n, on, onPick }: { id?: ItemId; n?: number; on?: boolean; onPick?: () => void }) {
    return (
        <button
            type="button"
            className="relative flex aspect-square items-center justify-center rounded-[6px] transition-transform active:scale-95"
            style={{
                background: on ? 'radial-gradient(circle at 50% 40%, #6b4a22, #3a2614)' : 'radial-gradient(circle at 50% 35%, #3a2a1e, #22170f)',
                border: `2px solid ${on ? '#ffe08a' : id ? GOLD : '#5a4126'}`,
                boxShadow: on ? '0 0 0 2px rgba(255,224,138,.35), 0 0 14px rgba(255,200,90,.45), inset 0 0 10px rgba(0,0,0,.6)' : 'inset 0 0 10px rgba(0,0,0,.6)',
            }}
            onPointerDown={press(() => id && onPick?.())}
            aria-label={id ? `${ITEMS[id].name}${n && n > 1 ? ` × ${n}` : ''}` : 'Empty slot'}
        >
            {id && <Icon id={id} size={40} />}
            {id && n !== undefined && n > 1 && <span className="absolute bottom-0.5 right-1 text-[12px] font-black tabular-nums text-white" style={{ textShadow: '0 1px 2px #000, 0 0 4px #000' }}>x{n}</span>}
        </button>
    );
}

/** A banner-shaped button (the reference's ribbons): notched ends, gold edge. */
export function Banner({ children, onPress, tone = 'dark', disabled = false }: { children: ReactNode; onPress: () => void; tone?: 'dark' | 'red'; disabled?: boolean }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onPointerDown={press(() => !disabled && onPress())}
            className="relative px-6 py-1.5 text-[14px] font-bold transition-transform active:translate-y-[2px] disabled:opacity-40"
            style={{
                fontFamily: CINZEL, color: CREAM,
                background: tone === 'red' ? 'linear-gradient(180deg, #6b2418, #3a120c)' : 'linear-gradient(180deg, #4a3220, #2a1a10)',
                clipPath: 'polygon(0 0, 100% 0, 92% 50%, 100% 100%, 0 100%, 8% 50%)',
                boxShadow: `inset 0 0 0 2px ${GOLD}`,
            }}
        >
            {children}
        </button>
    );
}

/** Health as hearts (two halves to a heart). */
function Hearts({ hp, max }: { hp: number; max: number }) {
    const n = Math.ceil(max / 2);
    return (
        <span className="flex flex-wrap items-center gap-0.5">
            {Array.from({ length: n }, (_, i) => {
                const fill = Math.max(0, Math.min(2, hp - i * 2));
                return (
                    <span key={i} className="relative inline-block" style={{ width: 18, height: 18 }}>
                        <Ico name="heart" size={18} color="#3a1810" style={{ position: 'absolute', inset: 0 }} />
                        {fill > 0 && (
                            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: fill === 2 ? 18 : 9 }}>
                                <Ico name="heart" size={18} color="#e0302a" style={{ filter: 'drop-shadow(0 0 2px rgba(255,80,60,.6))' }} />
                            </span>
                        )}
                    </span>
                );
            })}
        </span>
    );
}

export function InventoryGrid() {
    const bag = useStore((s) => s.bag);
    const hotbar = useStore((s) => s.hotbar);
    const backpack = useStore((s) => s.backpack);
    const weapon = useStore((s) => s.gear.weapon);
    const hp = useStore((s) => s.hp);
    const maxHp = useStore((s) => s.maxHp);
    const gems = useStore((s) => s.gems);
    const [pick, setPick] = useState<ItemId | null>(null);
    const [cat, setCat] = useState<Cat>('all');
    const max = backpackSlots(backpack);
    // Every stack is a slot; the first stack of a hotbar item rides in the hotbar instead.
    const cells: { id: ItemId; n: number }[] = [];
    for (const k of ITEM_IDS) {
        let left = bag[k];
        if (!(left > 0)) continue;
        const stack = stackOf(k);
        let skip = hotbar.includes(k);
        while (left > 0) {
            const n = Math.min(stack, left);
            left -= n;
            if (skip) { skip = false; continue; }
            cells.push({ id: k, n });
        }
    }
    const shown = cat === 'all' ? cells : cells.filter((c) => catOf(c.id) === cat);
    const used = slotsUsed(bag, hotbar);
    const sel = pick && bag[pick] > 0 ? pick : (shown[0]?.id ?? null);
    const food = sel ? FOOD[sel] : undefined;
    const name = (k: ItemId) => (k === 'tool_sword' ? WEAPONS[weapon].name : ITEMS[k].name);
    const slots = cat === 'all' ? Math.max(max, shown.length) : Math.max(10, Math.ceil(shown.length / 5) * 5);
    return (
        <div className="flex h-full min-h-0 gap-3">
            {/* the grid */}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-1">
                    {CATS.map((c) => (
                        <button key={c.id} type="button" onPointerDown={press(() => setCat(c.id))} title={c.label}
                            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors"
                            style={{ fontFamily: CINZEL, color: cat === c.id ? '#2a1a10' : CREAM, background: cat === c.id ? GOLD : 'rgba(0,0,0,.25)', border: `1.5px solid ${cat === c.id ? '#ffe08a' : GOLD_DIM}` }}>
                            <Ico name={c.icon} size={13} color={cat === c.id ? '#2a1a10' : GOLD} />
                            {c.label}
                        </button>
                    ))}
                    <span className="ml-auto text-[12px] font-bold" style={{ fontFamily: CINZEL, color: used >= max ? '#f87171' : CREAM }}>Capacity {used}/{max}</span>
                </div>
                <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
                    {Array.from({ length: slots }, (_, n) => {
                        const c = shown[n];
                        return <Slot key={n} id={c?.id} n={c?.n} on={!!c && sel === c.id} onPick={() => c && setPick(c.id)} />;
                    })}
                </div>
                {/* hearts, gems, and what rides in the hotbar */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2" style={{ borderColor: GOLD_DIM }}>
                    <Hearts hp={hp} max={maxHp} />
                    <span className="flex items-center gap-2">
                        {(['attack', 'defence', 'speed', 'vitality'] as const).map((g) => (
                            <span key={g} className="flex items-center gap-0.5 text-[12px] font-black tabular-nums" style={{ color: CREAM }}>
                                <img src={`images/hud/gem-${g}.png`} width={18} height={18} draggable={false} alt="" />{gems[g]}
                            </span>
                        ))}
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-[11px] font-bold" style={{ color: CREAM }}>
                        Hotbar
                        {hotbar.map((h, n) => (
                            <span key={n} className="flex h-6 w-6 items-center justify-center rounded" style={{ background: 'rgba(0,0,0,.35)', border: `1px solid ${GOLD_DIM}` }}>{h ? <Icon id={h} size={18} /> : <span className="text-[10px] text-white/40">{n + 1}</span>}</span>
                        ))}
                    </span>
                </div>
            </div>

            {/* the chosen item, large */}
            <div className="hidden w-[min(300px,34%)] shrink-0 flex-col items-center gap-2 rounded-xl p-3 sm:flex" style={{ background: 'radial-gradient(circle at 50% 25%, #4a3320 0%, #24170e 70%)', border: `2px solid ${GOLD_DIM}` }}>
                {sel ? (
                    <>
                        <div className="flex aspect-square w-[70%] items-center justify-center rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,210,120,.25), transparent 70%)' }}>
                            <Icon id={sel} size={120} />
                        </div>
                        <div className="text-center text-[min(22px,4.2vh)] font-bold leading-tight" style={{ fontFamily: CINZEL, color: GOLD }}>{name(sel)}</div>
                        <div className="text-center text-[12px] font-semibold leading-snug" style={{ color: CREAM }}>
                            {ITEMS[sel].blurb}.
                            {food && <span className="mt-1 block">{[food.hunger ? `Hunger +${food.hunger}` : '', food.thirst ? `Thirst +${food.thirst}` : '', food.heal ? `Health +${food.heal}` : ''].filter(Boolean).join(' · ')}</span>}
                            <span className="mt-1 block text-white/60">You carry {bag[sel]}</span>
                        </div>
                        <div className="mt-auto flex flex-col items-center gap-1.5">
                            {(ITEMS[sel].tool || ITEMS[sel].usable || ITEMS[sel].placeable) && (
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD_DIM }}>Hotbar</span>
                                    {Array.from({ length: HOTBAR_SLOTS }, (_, n) => (
                                        <button key={n} type="button" onPointerDown={press(() => progress.setHotbar(n, hotbar[n] === sel ? null : sel))}
                                            className="h-6 w-6 rounded text-[12px] font-black" style={{ color: hotbar[n] === sel ? '#2a1a10' : CREAM, background: hotbar[n] === sel ? GOLD : 'rgba(0,0,0,.35)', border: `1px solid ${GOLD_DIM}` }}>{n + 1}</button>
                                    ))}
                                </div>
                            )}
                            <div className="flex flex-wrap justify-center gap-2">
                                {ITEMS[sel].usable && <Banner onPress={() => commands.emit({ type: 'item', id: sel })}>Use</Banner>}
                                {ITEMS[sel].placeable && <Banner onPress={() => { commands.emit({ type: 'item', id: sel }); store.patch({ bagTab: null }); }}>Set down</Banner>}
                                {!ITEMS[sel].tool && <Banner tone="red" onPress={() => progress.discard(sel, Math.min(bag[sel], stackOf(sel)))}>Drop</Banner>}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="m-auto text-center text-[13px] font-semibold" style={{ color: CREAM }}>Nothing here yet. Gather, loot and craft to fill your pack.</div>
                )}
            </div>
        </div>
    );
}

/** At a workbench (in a liberated camp or a house): upgrading the backpack. */
export function RepairList(_: { bench: boolean }) {
    const bag = useStore((s) => s.bag);
    const backpack = useStore((s) => s.backpack);
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 rounded-xl px-2 py-1" style={ROW}>
                <Ico name="bag" size={24} color="#7d4636" />
                <div className="flex flex-1 flex-col gap-0.5 leading-tight">
                    <div className="text-[13px] font-black">Backpack · {backpackSlots(backpack)} slots{backpack < BACKPACK_TOP ? ` → ${backpackSlots(backpack + 1)}` : ' (largest)'}</div>
                    {backpack < BACKPACK_TOP && <Cost cost={backpackCost(backpack)} bag={bag} />}
                </div>
                {backpack < BACKPACK_TOP && <Btn disabled={!progress.has(backpackCost(backpack))} onPress={() => progress.upgradeBackpack()}>Upgrade</Btn>}
            </div>
        </div>
    );
}


/** I or Tab opens the inventory (and closes it again). */
export function useInventoryKey(): void {
    useEffect(() => {
        const on = (e: KeyboardEvent) => {
            if (e.repeat || !['b', 'B', 'i', 'I', 'Tab'].includes(e.key)) return;
            if (store.get().phase !== 'playing') return;
            e.preventDefault();
            store.patch({ bagTab: store.get().bagTab ? null : 'items' });
        };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    }, []);
}
