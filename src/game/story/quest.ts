/**
 * The quest engine for the story's four lands (land1-4.ts). It keeps the quest line's place in the
 * save (which land, which step, the side quests), hears what happens in the world (a prop broken, a
 * puzzle solved, a boss down, someone spoken to, a relic mended), finishes steps when their goal is
 * met, pays their rewards, tells their story (in turn, one page after another), moves you on to the
 * next land when one is pacified, keeps Lyra's two meters, and publishes the objective for the HUD.
 *
 * The world side (game/world/storyLayer.ts) shows the props, runs the timed fights and sends the
 * events here; this module never touches the scene.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { saveSystem, type QuestSave } from '../../saveConfig.ts';
import { store, type StoryPopup } from '../../state/store.ts';
import { sfx } from '../audio.ts';
import { progress } from '../progress.ts';
import { CHAPTER_COUNT, ITEMS, STACK_CAP, type ItemId } from '../survival.ts';
import type { Element, Region } from '../eidolon.ts';
import { ALL_BOSSES, LANDS, landOf, siteAt } from './lands.ts';
import type { Goal, Land, NpcKey, Reward, Step } from './types.ts';

/** What the world tells the story. */
export type QuestEvent =
    | { type: 'break'; prop: string }
    | { type: 'touch'; prop: string }
    | { type: 'puzzle'; puzzle: string }
    | { type: 'place'; item: ItemId }
    | { type: 'talk'; npc: NpcKey }
    | { type: 'boss'; code: number }
    | { type: 'drink'; item: ItemId }
    | { type: 'give'; item: ItemId }
    | { type: 'reach'; site: string }
    | { type: 'carried' }
    | { type: 'relic'; id: string }
    /** A timed or watched goal the world ran to its end (siege, defend, clear, stations, strikes, chord, forge). */
    | { type: 'done'; step: string };

/** A step in play: the main line's, or a side quest's. */
export interface Live {
    step: Step;
    /** The side quest it belongs to (null for the main line). */
    side: string | null;
    land: Land;
}

/** Story NPC ids by save NPC id (the save keeps the old ids for the first three). */
export const STORY_NPC: Record<string, NpcKey> = { theron: 'orin', varis: 'bram', lyra: 'lyra', kael: 'kael', lin: 'lin', thorne: 'thorne', nerissa: 'nerissa' };
const NPC_ID: Record<NpcKey, string> = { orin: 'theron', bram: 'varis', lyra: 'lyra', kael: 'kael', lin: 'lin', thorne: 'thorne', nerissa: 'nerissa' };
export const npcIdOf = (n: NpcKey) => NPC_ID[n];

const data = (): QuestSave | null => saveSystem.data?.quest ?? null;
/** A check is running (a reward that levels you up asks for another: it runs after). */
let checking = false;
let again = false;
const flagged = (f: string): boolean => !f || !!data()?.flags.includes(f);
/** The steps in play, kept until something in the quest changes (it is asked for many times a frame). */
let liveCache: { key: string; list: Live[] } | null = null;
const liveKey = (q: QuestSave, done: boolean) => `${q.land}|${q.main}|${done}|${q.flags.length}|${Object.entries(q.side).map(([k, v]) => k + v).join()}`;

/** The hero's name: the player's own, as the host knows it (Nirmal if it has none). */
let heroCache: string | null = null;
export function heroName(): string {
    // The name chosen in the character creator, else the player's own.
    const chosen = saveSystem.data?.hero?.name?.trim();
    if (chosen) return chosen;
    if (heroCache) return heroCache;
    try {
        const p = RundotGameAPI.getProfile();
        const n = (p.name || p.username || '').trim();
        heroCache = n && !p.isAnonymous ? n : 'Nirmal';
    } catch {
        heroCache = 'Nirmal';
    }
    return heroCache;
}
/** A story page with the hero's name in it. */
export const named = (p: StoryPopup): StoryPopup => ({ ...p, title: p.title.replace(/\{hero\}/g, heroName()), lines: p.lines.map((l) => l.replace(/\{hero\}/g, heroName())) });

function payReward(r: Reward | undefined): string[] {
    const d = saveSystem.data;
    const q = data();
    if (!d || !q || !r) return [];
    const got: string[] = [];
    for (const [k, n] of Object.entries(r.items ?? {}) as [ItemId, number][]) {
        d.bag[k] = Math.min(STACK_CAP, d.bag[k] + n);
        got.push(`${n} ${ITEMS[k].name}`);
    }
    for (const f of r.flags ?? []) if (!q.flags.includes(f)) q.flags.push(f);
    if (r.lyra) {
        q.lyra = Math.max(0, Math.min(100, q.lyra + r.lyra));
        if (r.lyra > 0) q.pressure = Math.max(0, q.pressure - r.lyra);
    }
    store.patch({ bag: { ...d.bag } });
    if (r.xp) {
        progress.gainXp(r.xp);
        got.unshift(`${r.xp} XP`);
    }
    return got;
}

export const quest = {
    /** The story runs from the pledge until the fourth land is done. */
    active(): boolean {
        const d = saveSystem.data;
        return !!d && !!d.kingdom && !d.quest.done;
    },
    data,
    has: flagged,
    flag(f: string): void {
        const q = data();
        if (!q || q.flags.includes(f)) return;
        q.flags.push(f);
        saveSystem.save();
    },
    lyra(): number {
        return data()?.lyra ?? 0;
    },
    /** The land the story is in. */
    land(): Land {
        return landOf(data()?.land ?? 1);
    },
    /** May the player walk into this region? The lands the story has reached, and the citadel once its doors open. */
    open(r: Region): boolean {
        const q = data();
        if (!q) return true;
        if (r === 'citadel') return q.land >= 4 && q.flags.includes('citadel_open');
        const n = LANDS.findIndex((l) => l.el === (r as Element)) + 1;
        return n > 0 && n <= q.land;
    },

    /** The main line's step now (null once the story is done). */
    main(): Step | null {
        const q = data();
        return q && this.active() ? this.land().main[q.main] ?? null : null;
    },
    /** Every step in play: the main line's, then each open side quest's (of this land and the ones before). */
    live(): Live[] {
        const q = data();
        if (!q || !this.active()) return [];
        const key = liveKey(q, q.done);
        if (liveCache && liveCache.key === key) return liveCache.list;
        const land = this.land();
        const out: Live[] = [];
        const m = land.main[q.main];
        if (m) out.push({ step: m, side: null, land });
        for (const l of LANDS.slice(0, q.land)) {
            for (const s of l.sides) {
                const at = q.side[s.id];
                if (at === undefined || at >= s.steps.length) continue;
                out.push({ step: s.steps[at], side: s.id, land: l });
            }
        }
        liveCache = { key, list: out };
        return out;
    },
    /** Is this step (by id) in play right now? */
    isLive(id: string): boolean {
        return this.live().some((l) => l.step.id === id);
    },

    /** A counter for the step in play (torches placed). */
    count(key: string): number {
        return data()?.n[key] ?? 0;
    },
    bump(key: string, by = 1): void {
        const q = data();
        if (!q) return;
        q.n[key] = (q.n[key] ?? 0) + by;
        saveSystem.markDirty();
    },

    /** How far along a step's goal is. */
    goalProgress(step: Step): { have: number; need: number } {
        const d = saveSystem.data;
        if (!d) return { have: 0, need: 1 };
        const g: Goal = step.goal;
        switch (g.kind) {
            case 'break': return { have: g.props.filter((p) => this.has(`broke:${p}`)).length, need: g.props.length };
            case 'items': {
                const e = Object.entries(g.items) as [ItemId, number][];
                return { have: e.reduce((n, [k, want]) => n + Math.min(d.bag[k], want), 0), need: e.reduce((n, [, want]) => n + want, 0) };
            }
            case 'place': {
                const e = Object.entries(g.items) as [ItemId, number][];
                return { have: e.reduce((n, [k, want]) => n + Math.min(this.count(`${step.id}:${k}`), want), 0), need: e.reduce((n, [, want]) => n + want, 0) };
            }
            case 'build': return { have: Math.min(d.buildings[g.building], g.level), need: g.level };
            case 'shelters': return { have: g.props.filter((p) => this.has(`lit:${p}`)).length, need: g.props.length };
            case 'stations': return { have: g.props.filter((p) => this.has(`lit:${p}`)).length, need: g.props.length };
            case 'relics': return { have: g.ids.filter((r) => this.has(`relic:${r}`)).length, need: g.ids.length };
            default: return { have: this.has(`done:${step.id}`) ? 1 : 0, need: 1 };
        }
    },

    /** Hear something from the world: finish whatever step it completes. */
    on(e: QuestEvent): void {
        const q = data();
        if (!q || !this.active()) return;
        for (const { step } of this.live()) {
            const g = step.goal;
            let hit = false;
            if (e.type === 'break' && g.kind === 'break' && g.props.includes(e.prop)) {
                if (!q.flags.includes(`broke:${e.prop}`)) q.flags.push(`broke:${e.prop}`);
            } else if (e.type === 'touch' && g.kind === 'touch' && g.prop === e.prop) hit = true;
            else if (e.type === 'puzzle' && g.kind === 'puzzle' && g.puzzle === e.puzzle) hit = true;
            else if (e.type === 'place' && g.kind === 'place' && e.item in g.items) this.bump(`${step.id}:${e.item}`);
            else if (e.type === 'talk' && g.kind === 'talk' && g.npc === e.npc) hit = true;
            else if (e.type === 'boss' && g.kind === 'boss' && ALL_BOSSES[g.boss]?.code === e.code) hit = true;
            else if (e.type === 'drink' && g.kind === 'drink' && g.item === e.item) hit = true;
            else if (e.type === 'give' && g.kind === 'give' && g.item === e.item) hit = true;
            else if (e.type === 'reach' && g.kind === 'reach' && g.site === e.site) hit = true;
            else if (e.type === 'carried' && g.kind === 'carry') hit = true;
            else if (e.type === 'done' && e.step === step.id) hit = true;
            if (hit && !q.flags.includes(`done:${step.id}`)) q.flags.push(`done:${step.id}`);
        }
        if (e.type === 'relic' && !q.flags.includes(`relic:${e.id}`)) q.flags.push(`relic:${e.id}`);
        // Bosses always count (whenever they fall), so a step reached later is already met.
        if (e.type === 'boss' && !q.flags.includes(`boss:${e.code}`)) q.flags.push(`boss:${e.code}`);
        this.check();
    },

    /** Is a step's goal met? */
    met(step: Step): boolean {
        const g = step.goal;
        if (g.kind === 'boss' && ALL_BOSSES[g.boss] && this.has(`boss:${ALL_BOSSES[g.boss].code}`)) return true;
        const p = this.goalProgress(step);
        return p.have >= p.need;
    },

    /** Finish every step whose goal is met (main and sides), tell the story, open what comes next. */
    check(): void {
        const q = data();
        const d = saveSystem.data;
        if (!q || !d || !this.active()) return;
        // Paying a reward can level you up, which checks the story again: run once, then again if asked.
        if (checking) {
            again = true;
            return;
        }
        checking = true;
        try {
            do {
                again = false;
                this.checkOnce(q, d);
            } while (again);
        } finally {
            checking = false;
        }
        saveSystem.save();
        this.publish();
    },

    checkOnce(q: QuestSave, d: NonNullable<typeof saveSystem.data>): void {
        const openSides = () => {
            for (const l of LANDS.slice(0, q.land)) {
                for (const s of l.sides) {
                    if (q.side[s.id] !== undefined || !s.unlock || !flagged(s.unlock)) continue;
                    q.side[s.id] = 0;
                    store.tell(...(s.steps[0].intro ?? []).map(named));
                    store.patch({ banner: { text: `Side quest: ${s.title}`, id: Date.now() } });
                }
            }
        };
        for (let guard = 0; guard < 8; guard++) {
            openSides();
            let moved = false;
            for (const { step, side, land } of this.live()) {
                if (!this.met(step)) continue;
                moved = true;
                if (side === null) q.main += 1;
                else q.side[side] = (q.side[side] ?? 0) + 1;
                const got = payReward(step.reward);
                const pages = [...(step.outro ?? [])];
                let next = side === null ? land.main[q.main] : land.sides.find((s) => s.id === side)!.steps[q.side[side]];
                if (got.length && pages.length) pages[pages.length - 1] = { ...pages[pages.length - 1], reward: `Reward: ${got.join(' · ')}` };
                else if (got.length) store.patch({ banner: { text: `${step.task}: done · ${got.join(' · ')}`, id: Date.now() } });
                if (side === null && !next) {
                    if (q.land < LANDS.length) {
                        // The land is pacified: on to the next one (you are carried to where it begins).
                        q.land += 1;
                        q.main = 0;
                        q.pressure = 0;
                        const nl = this.land();
                        next = nl.main[0];
                        const at = siteAt(nl, nl.start);
                        d.world = { u: at.u, v: at.v + 2, set: false };
                        store.patch({ travelTo: { u: at.u, v: at.v + 2 }, banner: { text: nl.title, id: Date.now() } });
                    } else {
                        // The story is told: the endless Echoes of the old campaign take over.
                        q.done = true;
                        d.story.step = Math.max(d.story.step, CHAPTER_COUNT);
                        d.story.base = 0;
                    }
                    sfx('fanfare');
                } else sfx(side === null ? 'chapter' : 'levelup', side === null ? 1 : 0.7);
                if (next?.intro) pages.push(...next.intro);
                if (side !== null && !next) store.patch({ banner: { text: `Side quest complete: ${land.sides.find((s) => s.id === side)!.title}`, id: Date.now() } });
                store.tell(...pages.map(named));
                break;
            }
            if (!moved) break;
        }
        openSides();
    },

    /** Begin the story (a new game pledged to Pyraxis): the first step's story plays. */
    begin(): void {
        const q = data();
        if (!q) return;
        Object.assign(q, { land: 1, main: 0, side: {}, flags: [], n: {}, lyra: 30, pressure: 0, done: false, placed: [] });
        const land = this.land();
        const at = siteAt(land, land.start);
        const d = saveSystem.data;
        if (d) d.world = { u: at.u, v: at.v + 3, set: false };
        store.patch({ travelTo: { u: at.u, v: at.v + 3 } });
        saveSystem.save();
        // Land 1 opens with its in-engine cinematic (world/cinematic.ts) instead of story pages.
        if (land.n !== 1) store.tell(...(land.main[0].intro ?? []).map(named));
        else store.patch({ cine: { line: null, title: null, fade: 1, flash: 0 } });
        this.publish();
    },

    /** Is Lyra in your care (on the altar, between draughts)? From the carry in Land 1 until she is whole. */
    caring(): boolean {
        const q = data();
        return !!q && this.active() && q.land < 4 && !this.has('lyra_staff') && (q.land > 1 || this.has('done:carry'));
    },
    /**
     * Lyra's two meters: Crystallization Pressure climbs while the curse works on her; once it is high
     * her Soul Stability ebbs. The land's draught, given at the altar, eases the pressure.
     */
    tickLyra(dtSec: number): void {
        const q = data();
        if (!q || !this.caring()) return;
        const before = `${Math.ceil(q.lyra)}|${Math.ceil(q.pressure)}`;
        q.pressure = Math.min(100, q.pressure + dtSec / 25);
        if (q.pressure > 70) q.lyra = Math.max(0, q.lyra - dtSec / 20);
        const now = `${Math.ceil(q.lyra)}|${Math.ceil(q.pressure)}`;
        if (now !== before) {
            saveSystem.markDirty();
            const dr = this.land().draught;
            if (Math.ceil(q.pressure) === 70) store.patch({ banner: { text: `The Mist is closing on Lyra's mind. ${dr ? `Give her a ${ITEMS[dr].name}` : 'Go to her'}`, id: Date.now() } });
            store.saga({ lyra: Math.ceil(q.lyra), pressure: Math.ceil(q.pressure) });
        }
    },
    /** A draught (or a cherished thing) given to Lyra. */
    steady(n: number): void {
        const q = data();
        if (!q) return;
        q.lyra = Math.min(100, q.lyra + n);
        q.pressure = Math.max(0, q.pressure - 60);
        store.saga({ lyra: Math.ceil(q.lyra), pressure: Math.ceil(q.pressure) });
        saveSystem.save();
    },
    bedside(): string {
        const list = this.land().bedside;
        let line = list[0].line;
        for (const b of list) if (flagged(b.flag)) line = b.line;
        return line.replace(/\{hero\}/g, heroName());
    },
    /** A memory of Lyra this player has won back (for a Flashback Surge), or null. */
    memory(): string | null {
        const lines = LANDS.flatMap((l) => l.memories).filter((m) => flagged(m.flag)).map((m) => m.line);
        return lines.length ? lines[Math.floor(Math.random() * lines.length)].replace(/\{hero\}/g, heroName()) : null;
    },

    /** Push the objective (main step, how-to, side quests) and Lyra's meters to the HUD. */
    publish(): void {
        const q = data();
        if (!q) return;
        if (!this.active()) {
            if (store.get().saga.lyra !== null) store.saga({ lyra: null, pressure: null });
            return;
        }
        const live = this.live();
        const main = live.find((l) => l.side === null)?.step;
        if (!main) return;
        const p = this.goalProgress(main);
        const sides = live.filter((l) => l.side !== null).map((l) => ({ title: l.land.sides.find((s) => s.id === l.side)!.title, task: l.step.task }));
        const next = { title: main.quest, task: main.task, have: Math.min(p.have, p.need), need: p.need, step: q.land * 100 + q.main, how: main.how.replace(/\{hero\}/g, heroName()), act: main.act, land: this.land().title, sides };
        const cur = store.get().objective;
        if (JSON.stringify(cur) !== JSON.stringify(next)) store.patch({ objective: next });
        const caring = this.caring();
        const lyra = caring ? Math.ceil(q.lyra) : null;
        const pressure = caring ? Math.ceil(q.pressure) : null;
        if (store.get().saga.lyra !== lyra || store.get().saga.pressure !== pressure) store.saga({ lyra, pressure });
    },
};
