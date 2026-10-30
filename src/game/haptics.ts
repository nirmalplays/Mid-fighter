/**
 * A buzz in the hand for the moments that matter on a phone: taking a hit, a heavy blow landing, a kill
 * that counts, a level, falling. Through the RUN host's haptics when the game runs inside it, else the
 * browser's vibration (Android; iPhones' browsers have none, and then this does nothing). Settings can
 * turn it off; buzzes closer than a beat apart are dropped so a crowd never turns it into a drone.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { sdkReady } from '../sdk/runSdk.ts';
import { settings } from './settings.ts';

export type Buzz = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
/** The same, as vibration patterns (ms on, off, on...). */
const PATTERN: Record<Buzz, number | number[]> = { light: 12, medium: 25, heavy: 45, success: [18, 60, 30], warning: [30, 50, 30], error: [70, 50, 110] };
/** The least time between two buzzes (a stronger one may cut in sooner). */
const GAP_MS = 90;
const RANK: Record<Buzz, number> = { light: 0, medium: 1, warning: 1, heavy: 2, success: 2, error: 3 };
let lastAt = -1e9;
let lastRank = 0;

export function buzz(kind: Buzz): void {
    if (!settings.get().haptics) return;
    const now = performance.now();
    if (now - lastAt < GAP_MS && RANK[kind] <= lastRank) return;
    lastAt = now;
    lastRank = RANK[kind];
    if (sdkReady()) {
        try {
            void RundotGameAPI.triggerHapticAsync(kind as Parameters<typeof RundotGameAPI.triggerHapticAsync>[0]).catch(() => vibrate(kind));
            return;
        } catch {
            /* the host has no haptics: fall back to the browser */
        }
    }
    vibrate(kind);
}

function vibrate(kind: Buzz): void {
    try {
        navigator.vibrate?.(PATTERN[kind]);
    } catch {
        /* not allowed here */
    }
}
