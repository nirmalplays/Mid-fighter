/**
 * Save slots: every journey is its own save, kept side by side. A new game starts a new slot (the old
 * ones stay, to be continued any time), the player can keep named save states ("Save as") and load,
 * rename or delete any of them. Each slot is one key in RUN's appStorage; a small index lists them
 * (name, hero, where in the story, play time, when last played) and remembers the last one used.
 * The journey played before slots existed is kept as the first slot.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { defaultSave, saveSystem, type FighterSave } from '../saveConfig.ts';
import { store } from '../state/store.ts';
import { KINGDOMS } from './eidolon.ts';
import { LANDS } from './story/lands.ts';
import { normalizeLook, setLook, type HeroLook } from './world/heroLook.ts';
import { isClassId, type ClassId } from './classes.ts';

export interface SlotInfo {
    id: string;
    key: string;
    name: string;
    hero: string;
    /** Where the journey stands, in words (the land and the quest). */
    where: string;
    seconds: number;
    updated: number;
}
interface SlotIndex {
    last: string | null;
    slots: SlotInfo[];
}

const INDEX = 'meh-slots';
const LEGACY = 'bounce-lab-save';
let index: SlotIndex = { last: null, slots: [] };

async function readIndex(): Promise<SlotIndex> {
    try {
        const raw = await RundotGameAPI.appStorage.getItem(INDEX);
        const v = raw ? JSON.parse(raw) : null;
        if (v && Array.isArray(v.slots)) return { last: typeof v.last === 'string' ? v.last : null, slots: v.slots.filter((s: SlotInfo) => s && typeof s.key === 'string') };
    } catch { /* a broken index starts empty */ }
    return { last: null, slots: [] };
}
function writeIndex(): void {
    void RundotGameAPI.appStorage.setItem(INDEX, JSON.stringify(index)).catch(() => undefined);
    store.patch({ slotsVersion: Date.now() });
}

/** Where a save stands, in a few words. */
function whereOf(d: FighterSave): string {
    if (!d.kingdom) return 'The beginning';
    if (d.quest.done) return d.kingdom ? `${KINGDOMS[d.kingdom].name} · after the story` : 'After the story';
    const land = LANDS[Math.min(LANDS.length, Math.max(1, d.quest.land)) - 1];
    const step = land.main[d.quest.main];
    return `${land.title.split(',')[0]} · ${step ? step.quest : 'pacified'}`;
}

/** Push the loaded save into the HUD's state (after boot, or after switching slots). */
let applyHook: (() => void) | null = null;
export const onSlotLoaded = (fn: () => void) => { applyHook = fn; };

let touchAt = 0;

export const slots = {
    /** Read the index (and adopt the pre-slot save as a slot), then point the save system at the last slot used. */
    async init(): Promise<void> {
        index = await readIndex();
        if (index.slots.length === 0) {
            try {
                const raw = await RundotGameAPI.appStorage.getItem(LEGACY);
                if (raw) {
                    const d = JSON.parse(raw) as FighterSave;
                    index.slots.push({ id: 'legacy', key: LEGACY, name: 'First journey', hero: d.hero?.name || 'Archaeologist', where: '', seconds: Math.floor(d.playSeconds ?? 0), updated: Date.now() });
                    index.last = 'legacy';
                    writeIndex();
                }
            } catch { /* nothing to adopt */ }
        }
        const last = index.slots.find((s) => s.id === index.last) ?? index.slots[0];
        saveSystem.setKey(last ? last.key : `meh-slot-scratch`);
    },
    list(): SlotInfo[] {
        return [...index.slots].sort((a, b) => b.updated - a.updated);
    },
    current(): SlotInfo | null {
        return index.slots.find((s) => s.id === index.last) ?? null;
    },
    /** Switch to a slot: load it and make it the current one. */
    async load(id: string): Promise<boolean> {
        const s = index.slots.find((x) => x.id === id);
        if (!s) return false;
        await saveSystem.flush();
        saveSystem.setKey(s.key);
        await saveSystem.load();
        index.last = id;
        writeIndex();
        this.touch(true);
        applyHook?.();
        return true;
    },
    /** A new journey in a new slot (the others stay), for a hero with this name, look and class. */
    async create(name: string, hero: string, look: HeroLook, cls: ClassId = 'warrior'): Promise<void> {
        await saveSystem.flush();
        const id = `s${Date.now().toString(36)}`;
        const key = `meh-slot-${id}`;
        saveSystem.setKey(key);
        saveSystem.data = defaultSave();
        const dressed = normalizeLook(look);
        // Assigned onto the fresh save's hero so any field the save adds keeps its default.
        Object.assign(saveSystem.data.hero, { name: hero, look: dressed, cls: isClassId(cls) ? cls : 'warrior' });
        setLook(dressed);
        index.slots.push({ id, key, name, hero, where: 'The beginning', seconds: 0, updated: Date.now() });
        index.last = id;
        await saveSystem.flush();
        writeIndex();
        applyHook?.();
    },
    /** Keep a copy of the journey as it stands now under a new name (play carries on in the current slot). */
    async saveAs(name: string): Promise<SlotInfo | null> {
        const d = saveSystem.data;
        if (!d) return null;
        await saveSystem.flush();
        const id = `s${Date.now().toString(36)}`;
        const key = `meh-slot-${id}`;
        try {
            await RundotGameAPI.appStorage.setItem(key, JSON.stringify(d));
        } catch {
            return null;
        }
        const info: SlotInfo = { id, key, name, hero: d.hero.name || 'Archaeologist', where: whereOf(d), seconds: Math.floor(d.playSeconds), updated: Date.now() };
        index.slots.push(info);
        writeIndex();
        return info;
    },
    async rename(id: string, name: string): Promise<void> {
        const s = index.slots.find((x) => x.id === id);
        if (!s) return;
        s.name = name.slice(0, 32) || s.name;
        writeIndex();
    },
    /** Delete a slot (never the one being played). */
    async remove(id: string): Promise<void> {
        const s = index.slots.find((x) => x.id === id);
        if (!s || id === index.last) return;
        index.slots = index.slots.filter((x) => x.id !== id);
        try { await RundotGameAPI.appStorage.removeItem(s.key); } catch { /* the index no longer lists it */ }
        writeIndex();
    },
    /** Refresh the current slot's line in the index (where, play time, when): cheap, at most every 20 s unless forced. */
    touch(force = false): void {
        const d = saveSystem.data;
        const s = this.current();
        if (!d || !s) return;
        const now = Date.now();
        if (!force && now - touchAt < 20000) return;
        touchAt = now;
        s.where = whereOf(d);
        s.seconds = Math.floor(d.playSeconds);
        s.hero = d.hero.name || s.hero;
        s.updated = now;
        writeIndex();
    },
};
