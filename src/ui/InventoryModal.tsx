/**
 * The inventory: a Minecraft-style backpack grid (20 slots, more with upgrades; every stack
 * takes a slot) with the four hotbar slots it feeds, item details and actions (use, set down,
 * put in the hotbar, drop), and the workbench list for mending tools and growing the backpack.
 * It shows as the Bag tab and opens with I or Tab.
 */
import { useEffect, useState } from 'react';
import { commands } from '../game/commands.ts';
import { progress } from '../game/progress.ts';
import {
    BACKPACK_TOP, backpackCost, backpackSlots, FOOD, HOTBAR_SLOTS, ITEM_IDS, ITEMS, repairCost, slotsUsed, stackOf, TOOL_ITEMS, WEAPONS,
    type ItemId,
} from '../game/survival.ts';
import { store, useStore } from '../state/store.ts';
import { BROWN, BROWN_DARK, Btn, Cost, Icon, INK, press, ROW, Wear } from './hudKit.tsx';

export function InventoryGrid() {
    const bag = useStore((s) => s.bag);
    const hotbar = useStore((s) => s.hotbar);
    const backpack = useStore((s) => s.backpack);
    const weapon = useStore((s) => s.gear.weapon);
    const [pick, setPick] = useState<ItemId | null>(null);
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
    const used = slotsUsed(bag, hotbar);
    const food = pick ? FOOD[pick] : undefined;
    const name = (k: ItemId) => (k === 'tool_sword' ? WEAPONS[weapon].name : ITEMS[k].name);
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[12px] font-black" style={{ color: used >= max ? '#b91c1c' : BROWN_DARK }}>
                <span>Backpack {used}/{max} slots{used >= max ? ' · full!' : ''}</span>
                <span>Hotbar: tap an item, then a number</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
                {Array.from({ length: Math.max(max, cells.length) }, (_, n) => {
                    const c = cells[n];
                    return (
                        <button key={n} type="button" className="relative flex aspect-square items-center justify-center rounded-lg" style={{ background: c && pick === c.id ? '#fff' : c ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.08)', border: `2px solid ${c && pick === c.id ? INK : BROWN}` }} onPointerDown={press(() => c && setPick(c.id))}>
                            {c && <Icon id={c.id} size={32} />}
                            {c && c.n > 1 && <span className="absolute bottom-0 right-1 text-[11px] font-black tabular-nums" style={{ color: INK }}>{c.n}</span>}
                            {c && ITEMS[c.id].tool && <Wear id={c.id} />}
                        </button>
                    );
                })}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold" style={{ color: BROWN_DARK }}>
                In the hotbar:
                {hotbar.map((h, n) => <span key={n} className="flex items-center gap-0.5 rounded px-1" style={{ background: 'rgba(255,255,255,.5)' }}>{n + 1}{h ? <Icon id={h} size={18} /> : '·'}</span>)}
            </div>
            {pick && bag[pick] > 0 && (
                <div className="flex flex-col gap-1.5 rounded-xl px-2 py-1.5" style={ROW}>
                    <div className="flex items-center gap-2">
                        <Icon id={pick} size={34} />
                        <div className="flex-1 leading-tight">
                            <div className="text-[14px] font-black">{name(pick)} × {bag[pick]}</div>
                            <div className="text-[12px] font-bold" style={{ color: BROWN_DARK }}>
                                {ITEMS[pick].blurb}
                                {food ? ` · ${[food.hunger ? `🍖+${food.hunger}` : '', food.thirst ? `💧+${food.thirst}` : '', food.heal ? `❤+${food.heal}` : ''].filter(Boolean).join(' ')}` : ''}
                                {ITEMS[pick].tool ? ` · wear ${progress.durability(pick).now}/${progress.durability(pick).max}` : ''}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                        {ITEMS[pick].usable && <Btn onPress={() => commands.emit({ type: 'item', id: pick })}>Use</Btn>}
                        {ITEMS[pick].placeable && <Btn onPress={() => { commands.emit({ type: 'item', id: pick }); store.patch({ bagTab: null }); }}>Set down</Btn>}
                        {(ITEMS[pick].tool || ITEMS[pick].usable || ITEMS[pick].placeable) && Array.from({ length: HOTBAR_SLOTS }, (_, n) => (
                            <Btn key={n} color={hotbar[n] === pick ? '#fde68a' : '#fff'} onPress={() => progress.setHotbar(n, hotbar[n] === pick ? null : pick)}>{hotbar[n] === pick ? `✓ ${n + 1}` : `→ ${n + 1}`}</Btn>
                        ))}
                        {!ITEMS[pick].tool && <Btn color="#fecaca" onPress={() => progress.discard(pick, Math.min(bag[pick], stackOf(pick)))}>Drop {Math.min(bag[pick], stackOf(pick))}</Btn>}
                    </div>
                </div>
            )}
        </div>
    );
}

/** Mending tools and weapons (at a workbench: in a liberated camp or a house), and upgrading the backpack. */
export function RepairList({ bench }: { bench: boolean }) {
    const bag = useStore((s) => s.bag);
    const weapon = useStore((s) => s.gear.weapon);
    useStore((s) => s.durability);
    const backpack = useStore((s) => s.backpack);
    const owned = TOOL_ITEMS.filter((k) => bag[k] > 0);
    return (
        <div className="flex flex-col gap-1.5">
            <div className="text-[12px] font-black" style={{ color: BROWN_DARK }}>Repairs {bench ? '' : '· at a workbench (a liberated camp or a house)'}</div>
            {owned.map((k) => {
                const d = progress.durability(k);
                const cost = repairCost(k, weapon);
                return (
                    <div key={k} className="flex items-center gap-2 rounded-xl px-2 py-0.5" style={ROW}>
                        <div className="relative"><Icon id={k} size={30} /></div>
                        <div className="flex flex-1 flex-col gap-0.5 leading-tight">
                            <div className="text-[12px] font-black">{k === 'tool_sword' ? WEAPONS[weapon].name : ITEMS[k].name} · {d.now}/{d.max}{d.now <= 0 ? ' · BROKEN' : ''}</div>
                            <Cost cost={cost} bag={bag} />
                        </div>
                        <Btn disabled={!bench || d.now >= d.max || !progress.has(cost)} onPress={() => progress.repair(k)}>Repair</Btn>
                    </div>
                );
            })}
            <div className="flex items-center gap-2 rounded-xl px-2 py-1" style={ROW}>
                <span className="text-[24px]">🎒</span>
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
