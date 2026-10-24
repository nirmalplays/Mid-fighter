/**
 * The HUD's building blocks, shared by the survival HUD and the inventory: the tan-and-plum
 * colours, an item icon with its wear bar, chunky buttons, cost chips, a modal panel and a
 * progress bar.
 */
import { Ico, type IconName } from './icons.tsx';
import type { ReactNode } from 'react';
import { ITEMS, type Bag, type ItemId } from '../game/survival.ts';
import { useStore } from '../state/store.ts';

export const TAN = '#e9bf9a';
export const TAN_LIGHT = '#f6d9ba';
export const BROWN = '#b4725b';
export const BROWN_DARK = '#7d4636';
export const INK = '#3a2025';
export const OUTLINE = '0 2px 0 #1a0c10, 0 0 4px #1a0c10, 2px 0 0 #1a0c10, -2px 0 0 #1a0c10';
export const PANEL = { background: `linear-gradient(${TAN_LIGHT}, ${TAN})`, border: `4px solid ${BROWN}`, boxShadow: `inset 0 0 0 2px ${TAN_LIGHT}, 0 4px 0 ${BROWN_DARK}`, color: INK };
export const ROW = { background: 'rgba(255,255,255,.55)', border: `2px solid ${BROWN}` };

export const press = (fn: () => void) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
};

export function Icon({ id, size = 28, dim = false }: { id: ItemId; size?: number; dim?: boolean }) {
    // Story items are drawn from the game's pixel icons ('ico:<icon>:<colour>').
    const ico = ITEMS[id].icon.startsWith('ico:') ? ITEMS[id].icon.split(':') : null;
    if (ico) return <Ico name={ico[1] as IconName} size={size} color={ico[2]} style={{ opacity: dim ? 0.4 : 1 }} />;
    return <img src={`images/${ITEMS[id].icon}`} width={size} height={size} draggable={false} alt="" style={{ objectFit: 'contain', opacity: dim ? 0.4 : 1, filter: 'drop-shadow(0 2px 0 rgba(43,15,28,.25))' }} />;
}

/** A plain chunky button in the panel style. */
export function Btn({ onPress, disabled, children, color = '#7ee081', className = '' }: { onPress: () => void; disabled?: boolean; children: ReactNode; color?: string; className?: string }) {
    return (
        <button
            type="button"
            disabled={disabled}
            className={`flex items-center justify-center gap-1 rounded-lg px-2.5 font-black active:translate-y-[2px] ${className}`}
            style={{ minHeight: 34, background: disabled ? '#cfc3b8' : color, border: `3px solid ${BROWN}`, fontSize: 13, opacity: disabled ? 0.7 : 1, color: INK }}
            onPointerDown={disabled ? undefined : press(onPress)}
        >
            {children}
        </button>
    );
}

/** The cost of something, each part showing what you have against what it takes. */
export function Cost({ cost, bag }: { cost: Partial<Bag>; bag: Bag }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {(Object.keys(cost) as ItemId[]).map((k) => {
                const ok = bag[k] >= (cost[k] ?? 0);
                return (
                    <span key={k} className="flex items-center gap-0.5 rounded-md px-1 text-[12px] font-black tabular-nums" style={{ background: ok ? 'rgba(126,224,129,.35)' : 'rgba(255,107,107,.3)' }}>
                        <Icon id={k} size={18} />
                        {bag[k]}/{cost[k]}
                    </span>
                );
            })}
        </div>
    );
}

/** A modal panel shell. */
export function Panel({ z = 20, width = 470, onClose, children }: { z?: number; width?: number; onClose?: () => void; children: ReactNode }) {
    return (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center" style={{ zIndex: z, background: 'rgba(10,6,16,.5)' }} onPointerDown={onClose ? press(onClose) : undefined}>
            <div className="flex max-h-[94%] flex-col gap-2 rounded-2xl p-3" style={{ width: `min(${width}px, 94vw)`, ...PANEL }} onPointerDown={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
}


export function Bar({ f, color, h = 10, children }: { f: number; color: string; h?: number; children?: ReactNode }) {
    return (
        <div className="relative flex-1 overflow-hidden rounded-full" style={{ height: h, background: '#1d1216', border: '2px solid #6b4a52' }}>
            <div className="absolute inset-y-0 left-0 transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(1, f)) * 100}%`, background: color }} />
            {children}
        </div>
    );
}


