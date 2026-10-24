/**
 * Guidance: what to do next is never a mystery.
 *   ObjectiveCard: a new objective slides in at the top of the screen whenever the story moves on
 *   (after any story pages are closed), so the next goal is always announced, not just listed.
 *   Coach: first-time tips with the keys to press, shown at the moment they matter (moving, striking,
 *   lifting Lyra, gathering, the bag, the waves and the respite, rolling, healing) and each only once.
 */
import { useEffect, useRef, useState } from 'react';
import { sfx } from '../game/audio.ts';
import { quest } from '../game/story/quest.ts';
import { store, useStore } from '../state/store.ts';
import { KeyCap } from './px.tsx';

export function ObjectiveCard() {
    const step = useStore((s) => s.objective?.step ?? null);
    const busy = useStore((s) => !!s.storyPopup || !!s.cine || !!s.puzzle);
    const [card, setCard] = useState<{ title: string; task: string; id: number } | null>(null);
    const shownFor = useRef<number | null>(null);
    useEffect(() => {
        if (step === null || busy || shownFor.current === step) return;
        const first = shownFor.current === null;
        shownFor.current = step;
        const o = store.get().objective;
        if (!o) return;
        setCard({ title: o.title, task: o.task, id: Date.now() });
        if (!first) sfx('chapter', 0.5);
        const id = window.setTimeout(() => setCard(null), 4200);
        return () => window.clearTimeout(id);
    }, [step, busy]);
    if (!card) return null;
    return (
        <div key={card.id} className="pointer-events-none absolute left-1/2 top-[16%] z-[30] flex -translate-x-1/2 flex-col items-center gap-1 px-6 py-2" style={{ animation: 'objective-card 4.2s ease-out both', background: 'linear-gradient(90deg, rgba(8,6,14,0), rgba(8,6,14,.78) 18%, rgba(8,6,14,.78) 82%, rgba(8,6,14,0))' }}>
            <span className="text-[11px] uppercase tracking-[0.35em] text-[#e0a948]" style={{ fontFamily: 'var(--font-pixel)' }}>New objective · {card.title}</span>
            <span className="text-center text-[min(24px,4vh)] leading-tight text-[#fff3d6]" style={{ fontFamily: 'var(--font-pixel)', textShadow: '0 2px 4px #000' }}>{card.task}</span>
        </div>
    );
}

interface Tip { id: string; keys: string[]; text: string }

/** Which tip applies now (the first whose moment it is and that has not been learnt). */
function pick(s: ReturnType<typeof store.get>, moved: number, seen: Set<string>): Tip | null {
    const step = quest.active() ? quest.main()?.id ?? null : null;
    const o = s.objective;
    const done = (id: string) => seen.has(id) || quest.has(`tip:${id}`);
    const tips: (Tip & { when: boolean })[] = [
        { id: 'move', keys: ['W', 'A', 'S', 'D'], text: 'Move (or drag the stick on a touch screen)', when: step === 'free' && moved < 1.5 },
        { id: 'strike', keys: ['J', 'Space'], text: 'Strike: break the three boulders walling Lyra in', when: step === 'free' && (o?.have ?? 0) === 0 },
        { id: 'fracture', keys: ['J'], text: 'Three hits in a row, and the fourth bursts as a Runic Fracture', when: step === 'free' && (o?.have ?? 0) >= 1 },
        { id: 'lift', keys: ['E'], text: 'Use: take Lyra’s hand', when: step === 'carry' && !s.saga.carrying },
        { id: 'carry', keys: ['J'], text: 'Lead her to the Watchtower (the gold marker). Leeches hunt her: fight them off', when: step === 'carry' && s.saga.carrying },
        { id: 'gather', keys: ['3', 'E'], text: 'Pickaxe is on 3, axe on 2. Walk up to a rock or a tree and press E', when: step === 'gather' },
        { id: 'bag', keys: ['B'], text: 'Your bag: items, crafting, camp building and the map', when: step === 'gather' && (o?.have ?? 0) >= 3 },
        { id: 'spire', keys: ['E'], text: 'Press E at the cracked Memory Spire', when: step === 'seal' },
        { id: 'waves', keys: ['K'], text: 'Waves come five at a time. Beat them for a 90-second respite. Inside a Sanctuary’s stone ring nothing can reach you', when: s.fighting && s.wave > 0 && !s.wavesHeld },
        { id: 'roll', keys: ['K', 'L'], text: 'Roll: you cannot be hit mid-roll', when: s.danger && s.hp < s.maxHp },
        { id: 'heal', keys: ['H'], text: 'Drink a healing draught', when: s.hp > 0 && s.hp <= s.maxHp * 0.4 && s.bag.potion_red > 0 },
        { id: 'respite', keys: ['B'], text: 'Respite! Build (Bag › Camp), craft and brew before the next onslaught', when: !s.fighting && s.wave > 0 },
        { id: 'craft', keys: ['B'], text: 'Craft at a workbench: Bag › Craft (way-torches, traps, draughts)', when: step === 'descend' || step === 'torches' },
        { id: 'hymn', keys: ['R'], text: 'The Resonant Hymn: stuns everything near you and breaks some boss wards', when: s.saga.hymn !== null },
    ];
    const t = tips.find((x) => x.when && !done(x.id));
    return t ? { id: t.id, keys: t.keys, text: t.text } : null;
}

export function Coach() {
    const [tip, setTip] = useState<Tip | null>(null);
    const seen = useRef(new Set<string>());
    const start = useRef<{ x: number; y: number } | null>(null);
    useEffect(() => {
        let shownAt = 0;
        let cur: Tip | null = null;
        const id = window.setInterval(() => {
            const s = store.get();
            if (s.cine || s.storyPopup || s.puzzle || s.bagTab || s.npc || s.phase !== 'playing') {
                if (cur) { cur = null; setTip(null); }
                return;
            }
            if (!start.current) start.current = { x: s.tileX, y: s.tileY };
            const moved = Math.hypot(s.tileX - start.current.x, s.tileY - start.current.y);
            const next = pick(s, moved, seen.current);
            // A tip stays at least 4 s; one that no longer applies is learnt.
            if (cur && next?.id !== cur.id) {
                if (Date.now() - shownAt < 4000 && next) return;
                seen.current.add(cur.id);
                quest.flag(`tip:${cur.id}`);
            }
            if (next?.id !== cur?.id) {
                cur = next;
                shownAt = Date.now();
                setTip(next);
            } else if (cur && ['waves', 'roll', 'heal', 'respite', 'hymn', 'bag', 'craft'].includes(cur.id) && Date.now() - shownAt > 9000) {
                // Timed tips go once read.
                seen.current.add(cur.id);
                quest.flag(`tip:${cur.id}`);
                cur = null;
                setTip(null);
            }
        }, 400);
        return () => window.clearInterval(id);
    }, []);
    if (!tip) return null;
    return (
        <div key={tip.id} className="pointer-events-none absolute left-1/2 z-[12] flex -translate-x-1/2 items-center gap-2 px-4 py-2" style={{ bottom: 196, background: 'rgba(8,6,14,.78)', border: '2px solid #e0a948', boxShadow: '0 0 0 2px #1a0c10', animation: 'cs-fade-up .35s ease-out both', maxWidth: 'min(640px, 92vw)' }}>
            <span className="flex gap-1">{tip.keys.map((k) => <KeyCap key={k}>{k}</KeyCap>)}</span>
            <span className="text-[14px] leading-snug text-[#fff3d6]" style={{ fontFamily: 'var(--font-pixel)' }}>{tip.text}</span>
        </div>
    );
}
