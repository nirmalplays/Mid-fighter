/**
 * The in-engine cinematics: played in the world itself, with the story's people as actors. A
 * cinematic is a run of beats, one after another: people walk and turn and act, the camera glides and
 * shakes, effects and sounds fire, and a line of dialogue or narration comes up in the letterbox. A
 * beat with a spoken line lasts as long as the line (it waits for the voice to finish), so voices never
 * talk over each other, however long a recording runs. While one plays the player is hidden and has no
 * control, and the waves hold.
 *
 * The opening one, The Weight of Blank Eyes, in the Sealed Chamber at the bottom of the Deep-Strata Dig:
 * Lyra reading the Memory Pillar with her hand on it, Orin's warning, a mason's pick ringing on the
 * obsidian seal, Ignis rising out of it and seizing the Pillar while Lyra cannot let go (so her memories
 * go into the beast with it), the Mist pouring out over the guild, the beast smashing up through the
 * roof, and the hero waking in the dust to a Lyra who does not know them.
 */
import { Assets, Graphics, Rectangle, Sprite, Texture, type Container } from 'pixi.js';
import { music, sfx, synth } from '../audio.ts';
import { voice } from '../voice.ts';
import { store } from '../../state/store.ts';
import { createActor, type Actor } from './npcArt.ts';
import type { FxName } from './fxAtlas.ts';
import { DEMON_CELL, DEMON_FEET } from './demonAtlas.ts';

export interface CinematicView {
    /** Where the camera looks (tiles), and its zoom (1 = the game's). */
    cam: { u: number; v: number; zoom: number };
    shake: number;
}

/** The cinematic playing now (the HUD's Skip button and Escape end it). */
let current: Cinematic | null = null;
export const skipCinematic = () => current?.skip();

export interface Cinematic {
    /** Advance; null once it has ended (the scene then hands control back). */
    update(dtMs: number): CinematicView | null;
    /** Jump to the end. */
    skip(): void;
    /** Where the player stands when it ends. */
    end: { u: number; v: number };
    destroy(): void;
}

interface Ctx {
    layer: Container;
    ground: (u: number, v: number) => { x: number; y: number };
    zFor: (u: number, v: number) => number;
    fx: (name: FxName, u: number, v: number, opts: { scale: number; life: number; squash?: number; lift?: number }) => void;
    /** Hide or show the story's own props while the cinematic stages its scene. */
    props: (ids: string[], hidden: boolean) => void;
    onEnd: () => void;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** A line: who says it, the words (exactly what the recording says), whose portrait, the recording. */
interface Line { speaker: string; text: string; who?: string; file?: string }
interface Beat {
    /** What happens as the beat begins (`t` is the clock then, for scheduling tweens from it). */
    run?: (t: number) => void;
    line?: Line;
    /** The least it lasts (ms); a spoken line keeps it going until the voice is done. */
    min: number;
}

const LINES = {
    narr1: { speaker: 'Narrator', text: 'The ash-caverns of Pyraxis. The guild had dug for forty days, toward the stone that remembers.', file: 'cine_01.mp3' },
    lyraA: { speaker: 'Lyra', who: 'lyra', text: 'Come and look. It remembers the Third Tide... every soldier who held the line. Every name.', file: 'cine_lyra_a.mp3' },
    orin1: { speaker: 'Master Orin', who: 'orin', text: 'Careful with that obsidian, both of you. The old Conclave sealed these veins for a reason.', file: 'cine_orin_1.mp3' },
    lyraB: { speaker: 'Lyra', who: 'lyra', text: 'Orin... the seal is bleeding.', file: 'cine_lyra_b.mp3' },
    orin2: { speaker: 'Master Orin', who: 'orin', text: 'Get away from the seal!', file: 'cine_orin_2.mp3' },
    ignis: { speaker: 'Ignis', who: 'ignis', text: 'Little carvers. You opened my door. And you brought me something to eat.', file: 'cine_ignis_1.mp3' },
    lyraC: { speaker: 'Lyra', who: 'lyra', text: 'I can’t let go... it’s pulling everything out of me!', file: 'cine_lyra_c.mp3' },
    narr2: { speaker: 'Narrator', text: 'The Memory Pillar was gone. Swallowed whole. And with it, everything she remembered.', file: 'cine_02.mp3' },
    lyraD: { speaker: 'Lyra', who: 'lyra', text: '...Who... are you?', file: 'cine_lyra_4.mp3' },
} satisfies Record<string, Line>;

/** The opening cinematic, staged round the Sealed Chamber's centre (q). */
export function createIntroCinematic(c: Ctx, q: { u: number; v: number }): Cinematic {
    const P = (du: number, dv: number) => ({ u: q.u + du, v: q.v + dv });
    voice.preload(Object.values(LINES).map((l) => l.file));
    const actors: Actor[] = [];
    const extras: (Graphics | Sprite)[] = [];
    const actor = (who: string, du: number, dv: number, anim = 'idle', scale = 1) => {
        const a = createActor({ layer: c.layer, who, ground: c.ground, zFor: c.zFor, scale });
        const p = P(du, dv);
        a.at(p.u, p.v);
        a.play(anim, true, 150);
        actors.push(a);
        return a;
    };
    const stage = (g: Graphics | Sprite, at: { u: number; v: number }, dz = 0) => {
        const p = c.ground(at.u, at.v);
        g.position.set(p.x, p.y);
        g.zIndex = c.zFor(at.u, at.v) + dz;
        c.layer.addChild(g);
        extras.push(g);
        return g;
    };
    // Preload what is not in the critical bundle (the hero's falling and getting up, Ignis's sheets).
    void Assets.load([{ alias: 'char:getup', src: 'images/world/char/getup.png' }, { alias: 'char:die', src: 'images/world/char/die.png' }]).catch(() => undefined);
    const ignisTex: Record<string, Texture[][]> = {};
    for (const anim of ['move', 'attack'] as const) {
        void Assets.load({ alias: `enemy:d_ignis-${anim}`, src: `images/world/enemy/d_ignis-${anim}.png` }).then((t: Texture) => {
            const cols = Math.round(t.width / DEMON_CELL);
            ignisTex[anim] = Array.from({ length: 5 }, (_, r) => Array.from({ length: cols }, (__, k) => new Texture({ source: t.source, frame: new Rectangle(k * DEMON_CELL, r * DEMON_CELL, DEMON_CELL, DEMON_CELL) })));
        }).catch(() => undefined);
    }

    // ---- the stage: the Memory Pillar, the obsidian seal in the floor, the crack, the light from above
    const pillarAt = P(0.4, -2.6);
    const glow = stage(new Graphics().ellipse(0, -80, 70, 110).fill({ color: 0x7dd3fc, alpha: 0.14 }).ellipse(0, -80, 40, 70).fill({ color: 0xbae6fd, alpha: 0.18 }), pillarAt, -0.2);
    const pillar = stage(new Graphics(), pillarAt, 0.06) as Graphics;
    pillar.poly([-26, 0, 0, -13, 26, 0, 0, 13]).fill(0x5a5462).stroke({ width: 3, color: 0x1a0c10 });
    pillar.poly([-16, 0, -12, -150, 0, -172, 12, -150, 16, 0]).fill(0x7dd3fc).stroke({ width: 4, color: 0x1a0c10 });
    pillar.poly([-6, -20, -4, -140, 4, -150, 6, -24]).fill({ color: 0xffffff, alpha: 0.55 });
    const sealAt = P(2.2, -1.2);
    const seal = stage(new Graphics().ellipse(0, 0, 34, 16).fill(0x1a1020).stroke({ width: 3, color: 0x3a2a4a }).ellipse(0, 0, 20, 9).stroke({ width: 2, color: 0x8a5aff, alpha: 0.7 }), sealAt, -0.3);
    const crack = stage(new Graphics(), sealAt, -0.29) as Graphics;
    // The thread of light between Lyra's hand, the Pillar and the beast (her memories going with it).
    const thread = stage(new Graphics(), P(0, 0), 0.5) as Graphics;
    thread.position.set(0, 0);
    // The roof gives way: daylight pours down where the beast went through.
    const shaft = stage(new Graphics().poly([-60, -900, 60, -900, 110, 0, -110, 0]).fill({ color: 0xfff2c8, alpha: 0.22 }).ellipse(0, 0, 110, 40).fill({ color: 0xfff2c8, alpha: 0.18 }), P(1.8, -1.6), 0.4);
    shaft.alpha = 0;
    const ignis = new Sprite(Texture.EMPTY);
    ignis.anchor.set(DEMON_FEET.d_ignis[0] / DEMON_CELL, DEMON_FEET.d_ignis[1] / DEMON_CELL);
    ignis.alpha = 0;
    c.layer.addChild(ignis);
    extras.push(ignis);
    let ignisAnim: 'move' | 'attack' = 'move';
    let ignisRow = 0;
    let ignisAt = { ...sealAt };
    let ignisRise = 1;

    // ---- the cast: Lyra at the Pillar, Orin by the lamps, three masons at work, the hero arriving
    const lyra = actor('lyra', 0.9, -2.0);
    lyra.face(-0.5, -0.6);
    const orin = actor('orin', -2.2, 0.6);
    orin.face(1, -0.4);
    const m1 = actor('mason', 2.9, -0.2, 'swing-pickaxe');
    m1.face(-0.7, -1);
    const m2 = actor('mason2', -2.8, -1.6, 'swing-pickaxe');
    m2.face(-1, 0);
    const m3 = actor('mason', 1.2, 2.2);
    m3.face(1, 0.2);
    const hero = actor('hero', -0.4, 3.2);
    hero.face(0.2, -1);
    const STAGED = ['q_slab', 'q_b1', 'q_b2', 'q_b3'];
    c.props(STAGED, true);

    // ---- tweens and the camera
    type Tw = { start: number; dur: number; run: (k: number) => void; done?: () => void; ended?: boolean };
    const tweens: Tw[] = [];
    const later: { at: number; run: () => void; fired?: boolean }[] = [];
    const tween = (start: number, dur: number, run: (k: number) => void, done?: () => void) => tweens.push({ start, dur, run, done });
    const after = (at: number, run: () => void) => later.push({ at, run });
    const walk = (t: number, a: Actor, to: { u: number; v: number }, dur: number, anim = 'walk') => {
        const from = { u: a.u, v: a.v };
        a.face(to.u - from.u, to.v - from.v);
        a.play(anim, true, anim === 'run' ? 90 : 120);
        tween(t, dur, (k) => a.at(from.u + (to.u - from.u) * k, from.v + (to.v - from.v) * k), () => a.play('idle', true, 160));
    };
    const cam = { u: q.u, v: q.v + 1.2, zoom: 1 };
    const camTo = (t: number, to: { u: number; v: number }, zoom: number, dur: number) => {
        const from = { ...cam };
        tween(t, dur, (k) => {
            const e = ease(k);
            cam.u = from.u + (to.u - from.u) * e;
            cam.v = from.v + (to.v - from.v) * e;
            cam.zoom = from.zoom + (zoom - from.zoom) * e;
        });
    };
    let shake = 0;
    const cine = { line: null as { speaker: string; text: string; who?: string } | null, title: null as { top: string; main: string } | null, fade: 1, flash: 0 };
    const push = () => store.patch({ cine: { ...cine } });
    const fade = (t: number, dur: number, to: number) => {
        const from = cine.fade;
        tween(t, dur, (k) => { cine.fade = from + (to - from) * k; push(); });
    };
    const flash = (t: number) => tween(t, 700, (k) => { cine.flash = 1 - k; push(); });
    const hollow = (a: Actor) => {
        a.play('idle', true, 220);
        a.sprite.tint = 0xb8b4c8;
    };

    // ---- the beats
    const beats: Beat[] = [
        // The dig by lamplight. The narrator.
        { min: 2400, run: (t) => { music.set('cutscene'); fade(t, 2200, 0); camTo(t, P(0.2, -0.4), 1.05, 9000); } },
        { line: LINES.narr1, min: 3000 },
        // Lyra, her hand flat on the Pillar, reading it. You come over.
        { line: LINES.lyraA, min: 3000, run: (t) => {
            walk(t, hero, P(0.1, -0.9), 2600);
            camTo(t, P(0.6, -1.4), 1.2, 3000);
            after(t + 2700, () => { hero.face(0.5, -0.6); lyra.face(0.2, -0.8); });
        } },
        // Orin, from the lamps.
        { line: LINES.orin1, min: 3000, run: (t) => { orin.face(1, -1); walk(t, orin, P(-1.2, 0), 1400); lyra.face(-1, 0.6); } },
        // The masons' picks ring on: one bites the black glass of the seal. It cracks and glows.
        { min: 1800, run: (t) => {
            camTo(t, P(1.6, -1.2), 1.15, 1200);
            m1.face(sealAt.u - m1.u, sealAt.v - m1.v);
            for (const k of [0, 500, 1000]) after(t + k, () => { c.fx('hit', sealAt.u, sealAt.v, { scale: 1.8, life: 380, lift: 10 }); synth('mine'); });
            after(t + 1100, () => {
                crack.moveTo(-22, -2).lineTo(-6, 5).lineTo(6, -6).lineTo(24, 3).stroke({ width: 3, color: 0xff6a3d });
                shake = 300;
                sfx('fall');
            });
        } },
        { line: LINES.lyraB, min: 2400, run: (t) => {
            lyra.face(sealAt.u - lyra.u, sealAt.v - lyra.v);
            tween(t, 2600, (k) => { crack.alpha = 0.6 + 0.4 * Math.sin(k * 18); });
            m1.play('idle'); m2.play('idle');
        } },
        // Orin's shout; the floor heaves.
        { line: LINES.orin2, min: 1600, run: (t) => {
            shake = 900;
            sfx('thunderclap');
            c.fx('explosion', sealAt.u + 0.6, sealAt.v - 0.4, { scale: 2, life: 800 });
            walk(t, m1, P(3.6, 1.2), 900, 'run');
        } },
        // Ignis bursts out of the seal: a lord of black glass and fire.
        { min: 2600, run: (t) => {
            shake = 1800;
            sfx('wave');
            c.fx('explosion', sealAt.u, sealAt.v, { scale: 4.5, life: 1000 });
            c.fx('explosion', sealAt.u + 1.2, sealAt.v - 0.6, { scale: 3, life: 900 });
            seal.visible = false;
            crack.visible = false;
            // Pull back and up: he stands three times the hero's height.
            camTo(t, P(0.6, -2.4), 0.8, 1600);
            tween(t + 100, 1800, (k) => { ignisRise = 1 - ease(k); ignis.alpha = Math.min(1, k * 1.8); });
        } },
        { line: LINES.ignis, min: 3000, run: (t) => {
            ignisRow = 0;
            // The guild breaks and runs.
            walk(t, m2, P(-4.6, 1.6), 1500, 'run');
            walk(t, m3, P(-1.2, 4.6), 1500, 'run');
        } },
        // It reaches for the Pillar. Lyra's hand will not come away; the light runs out of her into it.
        { line: LINES.lyraC, min: 3200, run: (t) => {
            ignisAnim = 'attack';
            ignisRow = 1;
            tween(t, 700, (k) => { ignisAt = { u: sealAt.u - k * 1.1, v: sealAt.v - k * 0.9 }; });
            tween(t + 400, 3400, (k) => {
                thread.clear();
                const a = c.ground(lyra.u, lyra.v), b = c.ground(pillarAt.u, pillarAt.v), m = c.ground(ignisAt.u, ignisAt.v);
                const wob = Math.sin(k * 40) * 4;
                thread.moveTo(a.x, a.y - 40).lineTo(b.x + wob, b.y - 90).lineTo(m.x, m.y - 120).stroke({ width: 5 + 3 * Math.sin(k * 30), color: 0xbae6fd, alpha: 0.85 });
                thread.zIndex = c.zFor(lyra.u, lyra.v) + 0.4;
            }, () => thread.clear());
            after(t + 500, () => { c.fx('aura', lyra.u, lyra.v, { scale: 4, squash: 0.55, life: 1600 }); lyra.play('idle', true, 90); });
            // You run for her; the beast's heat throws you across the chamber.
            after(t + 900, () => walk(t + 900, hero, P(0.5, -1.4), 500, 'run'));
            after(t + 1500, () => {
                c.fx('explosion', hero.u, hero.v, { scale: 2.4, life: 700 });
                sfx('hurt');
                hero.play('die', false, 110);
            });
            tween(t + 1500, 420, (k) => { const p = P(0.5 - k * 1.2, -1.4 + k * 3.8); hero.at(p.u, p.v); });
        } },
        // The Pillar goes into the beast; a pale Mist pours from the broken seal over everyone else.
        { min: 3000, run: (t) => {
            flash(t);
            shake = 1400;
            sfx('explosion');
            for (let n = 0; n < 5; n++) c.fx('sparkle', pillarAt.u + (Math.random() - 0.5) * 1.6, pillarAt.v + (Math.random() - 0.5) * 1.2, { scale: 2.6, squash: 0.6, life: 900 });
            tween(t, 1200, (k) => { pillar.alpha = 1 - k; glow.alpha = 1 - k; pillar.scale.set(1 - 0.5 * k); });
            lyra.play('die', false, 140);
            after(t + 900, () => {
                for (const [du, dv] of [[0, 0], [-1.6, 1], [1.4, 1.6], [-3, -0.4]]) c.fx('aura', sealAt.u + du, sealAt.v + dv, { scale: 5, squash: 0.5, life: 1800 });
                for (const a of [orin, m1, m2, m3]) hollow(a);
            });
        } },
        // It smashes up through the roof; daylight and rubble come down; boulders crash round Lyra.
        { min: 3200, run: (t) => {
            ignisAnim = 'move';
            ignisRow = 4;
            sfx('wave');
            tween(t, 1300, (k) => { ignisAt = { u: sealAt.u - 1.1 + k * 0.6, v: sealAt.v - 0.9 - k * 0.6 }; ignisRise = -k * 5; ignis.alpha = 1 - k * k; });
            after(t + 600, () => { shaft.alpha = 1; shake = 1800; sfx('fall'); });
            after(t + 1400, () => {
                c.props(STAGED, false);
                shake = 1600;
                sfx('fall');
                for (const [du, dv] of [[-1.6, 0.4], [1.6, 0.4], [0, 1.8]]) c.fx('explosion', q.u + du, q.v + dv, { scale: 2.4, life: 800 });
            });
            fade(t + 2200, 1000, 1);
        } },
        // Black. The narrator.
        { line: LINES.narr2, min: 3000, run: () => {
            for (const a of [orin, m1, m2, m3]) a.sprite.visible = false;
            for (const g of [pillar, glow, thread]) g.visible = false;
            ignis.visible = false;
        } },
        // You come to in the dust under the hole in the roof. She is sitting there, walled in, unhurt. Nothing in her eyes.
        { min: 2200, run: (t) => {
            const p = P(0, 2.8);
            hero.at(p.u, p.v);
            hero.face(0, -1);
            hero.play('getup', false, 200);
            const l = P(0.3, -0.2);
            lyra.at(l.u, l.v);
            lyra.face(-0.3, 2.8);
            lyra.play('idle', true, 170);
            cam.u = q.u; cam.v = q.v + 1; cam.zoom = 1.2;
            shaft.alpha = 0.7;
            fade(t, 1800, 0);
        } },
        { line: LINES.lyraD, min: 2600 },
        { min: 3800, run: () => { cine.title = { top: 'Act I · Ashes of the Unwritten', main: 'The Weight of Blank Eyes' }; push(); sfx('chapter'); } },
    ];
    const end = P(0, 2.8);

    // The clock is real time (a slow frame never slows the film or desyncs it from the voice).
    let t0 = -1;
    let t = 0;
    let idx = -1;
    let beatEnd = 0;
    let over = false;
    const startBeat = (n: number) => {
        idx = n;
        const b = beats[n];
        if (!b) return;
        cine.line = b.line ? { speaker: b.line.speaker, text: b.line.text, who: b.line.who } : null;
        push();
        let dur = b.min;
        if (b.line?.file) {
            voice.play(b.line.file);
            // As long as the line, and a breath after it (a guess from its words if it has not loaded).
            const len = voice.length(b.line.file) ?? 900 + b.line.text.length * 60;
            dur = Math.max(dur, len + 450);
        }
        beatEnd = t + dur;
        b.run?.(t);
    };
    const finish = () => {
        if (over) return;
        over = true;
        voice.stop();
        music.duck(1);
        c.props(STAGED, false);
        store.patch({ cine: null });
        c.onEnd();
    };
    const me: Cinematic = {
        end,
        update(dtMs) {
            if (over) return null;
            const now = performance.now();
            if (t0 < 0) t0 = now;
            t = now - t0;
            if (idx < 0) startBeat(0);
            while (!over && t >= beatEnd) {
                if (idx + 1 >= beats.length) {
                    finish();
                    return null;
                }
                startBeat(idx + 1);
            }
            for (const l of later) if (!l.fired && t >= l.at) { l.fired = true; l.run(); }
            for (const w of tweens) {
                if (w.ended || t < w.start) continue;
                const k = Math.min(1, (t - w.start) / w.dur);
                w.run(k);
                if (k >= 1) { w.ended = true; w.done?.(); }
            }
            for (const a of actors) a.update(dtMs);
            const sheet = ignisTex[ignisAnim] ?? ignisTex.move;
            if (sheet) {
                const row = sheet[Math.min(ignisRow, sheet.length - 1)];
                ignis.texture = row[Math.floor(t / 120) % row.length];
            }
            const ip = c.ground(ignisAt.u, ignisAt.v);
            ignis.position.set(ip.x, ip.y + ignisRise * 140);
            ignis.zIndex = c.zFor(ignisAt.u, ignisAt.v) + 0.3;
            ignis.scale.set(1.35 * (ignisRise > 0 ? 0.5 + 0.5 * (1 - ignisRise) : 1));
            shake = Math.max(0, shake - dtMs);
            return { cam: { ...cam }, shake: shake > 0 ? Math.min(1, shake / 600) : 0 };
        },
        skip() {
            finish();
        },
        destroy() {
            voice.stop();
            for (const a of actors) a.destroy();
            for (const g of extras) g.destroy();
            if (!over) store.patch({ cine: null });
            if (current === me) current = null;
        },
    };
    current = me;
    return me;
}
