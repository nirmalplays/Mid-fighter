/**
 * Pixel-art UI parts from the UI Asset Pack (Beowulf): 9-slice buttons with pressed states,
 * panel frames and the 16 px icon strip, drawn with CSS border-image so they stay crisp at any
 * size. Prepared by tools/build-ui.py.
 */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { UI_SLICES } from './uiSlices.ts';

/** Pixels per source pixel. */
const SCALE = 2;

/** Icon order in the strip. */
export const ICON = { home: 0, help: 1, pause: 2, play: 3, mail: 4, back: 5, menu: 6, share: 7, refresh: 8, plus: 9, upload: 10, download: 11, save: 12 } as const;

/** A UI Asset Pack piece as a 9-slice CSS border image, `scale` screen pixels per art pixel. */
export function slice(name: string, scale: number): CSSProperties {
    const [l, t, r, b] = UI_SLICES[name];
    return {
        borderStyle: 'solid',
        borderWidth: `${t * scale}px ${r * scale}px ${b * scale}px ${l * scale}px`,
        borderImage: `url(images/ui/${name}.png) ${t} ${r} ${b} ${l} fill / ${t * scale}px ${r * scale}px ${b * scale}px ${l * scale}px stretch`,
        imageRendering: 'pixelated',
    };
}

export function PxIcon({ index, size = 32 }: { index: number; size?: number }) {
    const k = size / 16;
    return (
        <span
            aria-hidden="true"
            style={{
                display: 'inline-block',
                width: size,
                height: size,
                flex: 'none',
                backgroundImage: 'url(images/ui/icons.png)',
                backgroundSize: `${13 * 16 * k}px ${16 * k}px`,
                backgroundPosition: `${-index * 16 * k}px 0`,
                imageRendering: 'pixelated',
            }}
        />
    );
}

/** wood = brown (primary), stone = grey (secondary), white = light (tertiary). */
export type PxVariant = 'wood' | 'stone' | 'white';
const VARIANT: Record<PxVariant, { n: 1 | 2 | 3; color: string; shadow: string }> = {
    wood: { n: 3, color: '#fff3d6', shadow: '#3b2412' },
    stone: { n: 2, color: '#fbf7f0', shadow: '#2f2a35' },
    white: { n: 1, color: '#33284f', shadow: 'rgba(255,255,255,.6)' },
};

export function PxButton({ variant = 'wood', icon, sub, disabled, onClick, className = '', style, children }: {
    variant?: PxVariant;
    icon?: number;
    /** A smaller second line under the label. */
    sub?: string;
    disabled?: boolean;
    onClick: () => void;
    className?: string;
    style?: CSSProperties;
    children: ReactNode;
}) {
    const [down, setDown] = useState(false);
    const v = VARIANT[variant];
    const state = disabled ? 'normal' : down ? 'pressed' : 'normal';
    return (
        <button
            type="button"
            disabled={disabled}
            onPointerDown={() => setDown(true)}
            onPointerUp={() => setDown(false)}
            onPointerLeave={() => setDown(false)}
            onPointerCancel={() => setDown(false)}
            onClick={onClick}
            className={`flex touch-manipulation items-center justify-center gap-2 font-black leading-tight ${className}`}
            style={{
                ...slice(`btn${v.n}-${state}`, SCALE),
                color: v.color,
                textShadow: `0 2px 0 ${v.shadow}`,
                opacity: disabled ? 0.55 : 1,
                paddingTop: down ? 3 : 0,
                paddingBottom: down ? 0 : 3,
                ...style,
            }}
        >
            {icon !== undefined && <PxIcon index={icon} size={24} />}
            <span className="flex flex-col items-start text-left">
                <span style={{ fontSize: 17 }}>{children}</span>
                {sub && <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.85 }}>{sub}</span>}
            </span>
        </button>
    );
}

/** A framed panel (wood by default). */
export function PxPanel({ frame = 6, className = '', style, children }: { frame?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
    return (
        <div className={className} style={{ ...slice(`frame${frame}`, 2), ...style }}>
            {children}
        </div>
    );
}

/** The pack's icon strips (13 icons of 16 px: home, help, pause, play, mail, back, menu, share, refresh, plus, upload, download, save). */
export function PackIcon({ index, size = 24, set = 'shade' }: { index: number; size?: number; set?: 'shade' | 'white' | 'wood' }) {
    const k = size / 16;
    return (
        <span
            aria-hidden="true"
            style={{
                display: 'inline-block', width: size, height: size, flex: 'none',
                backgroundImage: `url(images/ui/icons-${set}.png)`, backgroundSize: `${208 * k}px ${16 * k}px`, backgroundPosition: `${-index * 16 * k}px 0`, imageRendering: 'pixelated',
            }}
        />
    );
}

/** A sword from the sword sheet (6 × 5 of 32 px), pixel-crisp. */
export function SwordSprite({ index, size = 32, style }: { index: number; size?: number; style?: CSSProperties }) {
    const k = size / 32;
    return (
        <span
            aria-hidden="true"
            style={{
                display: 'inline-block', width: size, height: size, flex: 'none',
                backgroundImage: 'url(images/swords.png)', backgroundSize: `${192 * k}px ${160 * k}px`,
                backgroundPosition: `${-(index % 6) * 32 * k}px ${-Math.floor(index / 6) * 32 * k}px`, imageRendering: 'pixelated', ...style,
            }}
        />
    );
}

/**
 * A square game button cut from the pack's 9-slice buttons (stone, wood or white), with its hover
 * and pressed frames; it sinks a pixel when pressed. Fires on pointer-down (game controls).
 */
export function PackButton({ variant = 'stone', size, label, onPress, children, dim = false, glow, style }: {
    variant?: PxVariant; size: number; label: string; onPress: () => void; children: ReactNode; dim?: boolean; glow?: string; style?: CSSProperties;
}) {
    const [down, setDown] = useState(false);
    const [over, setOver] = useState(false);
    const n = VARIANT[variant].n;
    const scale = size >= 64 ? 3 : 2;
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className="pointer-events-auto relative flex touch-none select-none items-center justify-center"
            style={{
                ...slice(`btn${n}-${down ? 'pressed' : over ? 'hover' : 'normal'}`, scale),
                width: size, height: size, boxSizing: 'border-box',
                paddingTop: down ? scale : 0, paddingBottom: down ? 0 : scale,
                opacity: dim ? 0.5 : 1,
                filter: glow ? `drop-shadow(0 0 6px ${glow}) drop-shadow(0 0 2px ${glow})` : undefined,
                ...style,
            }}
            onPointerEnter={() => setOver(true)}
            onPointerLeave={() => { setOver(false); setDown(false); }}
            onPointerDown={(e) => {
                e.preventDefault();
                setDown(true);
                onPress();
            }}
            onPointerUp={() => setDown(false)}
            onPointerCancel={() => setDown(false)}
        >
            {children}
        </button>
    );
}

/** A little keyboard key (the pack's white button), for key hints. */
export function KeyCap({ children, style }: { children: ReactNode; style?: CSSProperties }) {
    return (
        <span className="kbd-only pointer-events-none inline-flex items-center justify-center px-[3px] text-[10px] leading-none" style={{ ...slice('btn1-normal', 1), minWidth: 18, height: 20, boxSizing: 'border-box', color: '#33284f', ...style }}>
            {children}
        </span>
    );
}
