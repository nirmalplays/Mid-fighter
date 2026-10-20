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

function slice(name: string, scale: number): CSSProperties {
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
