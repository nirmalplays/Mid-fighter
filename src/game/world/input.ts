/**
 * Movement input: a floating virtual joystick (touch/mouse drag anywhere on
 * the canvas) plus WASD / arrow keys. read() returns a vector with length ≤ 1.
 */
export interface Input {
    read(): { x: number; y: number };
    /** Joystick state for drawing: origin and knob in CSS px, or null when idle. */
    joystick(): { ox: number; oy: number; kx: number; ky: number } | null;
    /** How far the finger is from where it touched down, in joystick radii (it can go past 1: a sprint push). 0 when idle. */
    reach(): number;
    destroy(): void;
}

export const JOY_RADIUS = 56;
/** Sprint on a touch screen: push the finger past the ring to this many radii (and hold a moment); ease back inside LET to walk. */
export const SPRINT_PUSH = 1.6;
export const SPRINT_LET = 1.35;

export function createInput(canvas: HTMLCanvasElement): Input {
    const keys = new Set<string>();
    let pid: number | null = null;
    let ox = 0, oy = 0, kx = 0, ky = 0;
    /** The finger's own distance from the touch-down point (the knob stops at the ring; the finger need not). */
    let raw = 0;

    const local = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
        if (pid !== null) return;
        pid = e.pointerId;
        const p = local(e);
        ox = kx = p.x;
        oy = ky = p.y;
        raw = 0;
        try { canvas.setPointerCapture(pid); } catch { /* not capturable */ }
    };
    const move = (e: PointerEvent) => {
        if (e.pointerId !== pid) return;
        const p = local(e);
        const dx = p.x - ox, dy = p.y - oy;
        const d = Math.hypot(dx, dy);
        raw = d;
        const k = d > JOY_RADIUS ? JOY_RADIUS / d : 1;
        kx = ox + dx * k;
        ky = oy + dy * k;
    };
    const up = (e: PointerEvent) => {
        if (e.pointerId === pid) {
            pid = null;
            raw = 0;
        }
    };
    const keyDown = (e: KeyboardEvent) => { keys.add(e.key.toLowerCase()); };
    const keyUp = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);

    return {
        read() {
            let x = 0, y = 0;
            if (pid !== null) {
                x = (kx - ox) / JOY_RADIUS;
                y = (ky - oy) / JOY_RADIUS;
            }
            if (keys.has('a') || keys.has('arrowleft')) x -= 1;
            if (keys.has('d') || keys.has('arrowright')) x += 1;
            if (keys.has('w') || keys.has('arrowup')) y -= 1;
            if (keys.has('s') || keys.has('arrowdown')) y += 1;
            const m = Math.hypot(x, y);
            return m > 1 ? { x: x / m, y: y / m } : { x, y };
        },
        joystick: () => (pid === null ? null : { ox, oy, kx, ky }),
        reach: () => (pid === null ? 0 : raw / JOY_RADIUS),
        destroy() {
            canvas.removeEventListener('pointerdown', down);
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up);
            canvas.removeEventListener('pointercancel', up);
            window.removeEventListener('keydown', keyDown);
            window.removeEventListener('keyup', keyUp);
        },
    };
}
