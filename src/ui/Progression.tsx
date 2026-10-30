/**
 * How the hero grows: the skill tree (game/talents.ts: a point a level, three branches, opened from the
 * Skills button), the Surge boons a fight hands you (game/boons.ts: three to choose from while the waves
 * hold), and the Surge meter under the vitals.
 */
import { commands } from '../game/commands.ts';
import { progress } from '../game/progress.ts';
import { BOON } from '../game/boons.ts';
import { BRANCHES, costFor, learnable, levelFor, rankOf, RESET_COST, spentOf, TALENTS, talentPoints, TALENT, whyNot } from '../game/talents.ts';
import { store, useStore } from '../state/store.ts';
import { BROWN, BROWN_DARK, Btn, Cost, Panel, press, ROW } from './hudKit.tsx';
import { Ico, type IconName } from './icons.tsx';

/** Skill points still to spend. */
export function useTalentPoints(): number {
    const level = useStore((s) => s.level);
    const talents = useStore((s) => s.talents);
    return Math.max(0, talentPoints(level) - spentOf(talents));
}
/** Talents that can take a rank right now (bar being at camp): the skill tree's badge counts these, not bare points. */
export function useTalentsReady(): number {
    const level = useStore((s) => s.level);
    const talents = useStore((s) => s.talents);
    const bag = useStore((s) => s.bag);
    return learnable(talents, level, bag);
}

/**
 * The skill tree: three branches side by side, each talent with its ranks, what the next one does, the level
 * it asks, and the materials it takes (what you have against what it needs). Learnt at camp.
 */
export function TalentPanel() {
    const open = useStore((s) => s.talentsOpen);
    const talents = useStore((s) => s.talents);
    const level = useStore((s) => s.level);
    const bag = useStore((s) => s.bag);
    const inCamp = useStore((s) => s.inCamp);
    const points = useTalentPoints();
    if (!open) return null;
    const have = (c: Partial<typeof bag>) => (Object.keys(c) as (keyof typeof bag)[]).every((k) => bag[k] >= (c[k] ?? 0));
    const close = () => store.patch({ talentsOpen: false });
    return (
        <Panel z={30} width={640} onClose={close}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col leading-tight">
                    <span className="text-[18px] font-black">Skill tree</span>
                    <span className="text-[12px] font-bold" style={{ color: BROWN_DARK }}>
                        {points > 0 ? `${points} point${points > 1 ? 's' : ''} to spend` : 'A point every two levels'} · Level {level} · {inCamp ? 'At camp: you can learn here' : 'Learn at camp (by the fire)'}
                    </span>
                    <span className="text-[11px] font-bold" style={{ color: BROWN_DARK }}>Each rank takes a point, a level, and materials from the world: hunt, mine and gather for them.</span>
                </div>
                <div className="flex gap-1.5">
                    {spentOf(talents) > 0 && <Btn color="#fff" disabled={!inCamp || !have(RESET_COST)} onPress={() => progress.resetTalents()}>Reset ({RESET_COST.gold} gold)</Btn>}
                    <Btn color="#fff" onPress={close}>Close</Btn>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2 overflow-y-auto">
                {BRANCHES.map((b) => (
                    <div key={b.id} className="flex flex-col gap-1.5">
                        <div className="rounded-md px-2 py-0.5 text-center text-[13px] font-black uppercase tracking-wide" style={{ background: b.color, border: `2px solid ${BROWN}` }}>{b.name}</div>
                        {TALENTS.filter((t) => t.branch === b.id).map((t) => {
                            const r = rankOf(talents, t.id);
                            const why = whyNot(talents, level, t.id, inCamp, have);
                            const locked = !!t.needs && rankOf(talents, t.needs) < 1;
                            const maxed = r >= t.max;
                            const short = !maxed && !locked && level < levelFor(talents, t.id);
                            return (
                                <div key={t.id} className="flex flex-col gap-1 rounded-xl p-1.5" style={{ ...ROW, opacity: locked ? 0.55 : 1, background: r > 0 ? 'rgba(255,255,255,.8)' : ROW.background }}>
                                    <div className="flex items-center gap-1.5">
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ background: r > 0 ? b.color : 'rgba(0,0,0,.12)', border: `2px solid ${BROWN}` }}>
                                            <Ico name={t.icon as IconName} size={18} color={r > 0 ? '#3a2025' : '#7d4636'} />
                                        </span>
                                        <span className="flex-1 text-[13px] font-black leading-tight">{t.name}</span>
                                        <span className="text-[11px] font-black tabular-nums">{r}/{t.max}</span>
                                    </div>
                                    <span className="text-[11px] font-bold leading-snug" style={{ color: BROWN_DARK }}>
                                        {locked ? `Needs ${TALENT[t.needs!].name}` : maxed ? t.blurb(t.max - 1) : t.blurb(r)}
                                    </span>
                                    {!maxed && !locked && (
                                        <>
                                            <span className="text-[10px] font-black uppercase" style={{ color: short ? '#b91c1c' : '#15803d' }}>Level {levelFor(talents, t.id)}{short ? ` (you are ${level})` : ''}</span>
                                            <Cost cost={costFor(talents, t.id)} bag={bag} />
                                            {why && why !== 'Mastered' && <span className="text-[10px] font-black" style={{ color: '#b45309' }}>{why}</span>}
                                        </>
                                    )}
                                    {!maxed && <Btn disabled={why !== null} onPress={() => progress.learnTalent(t.id)}>{r > 0 ? 'Rank up' : 'Learn'}</Btn>}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </Panel>
    );
}

/** Three boons to choose from; the waves hold until you pick. */
export function BoonPicker() {
    const offer = useStore((s) => s.boonOffer);
    const boons = useStore((s) => s.boons);
    if (!offer) return null;
    return (
        <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center gap-3" style={{ background: 'rgba(10,6,16,.62)' }}>
            <div className="text-center leading-tight" style={{ textShadow: '0 2px 0 #000' }}>
                <div className="text-[13px] font-black uppercase tracking-[0.2em] text-[#fde68a]">Surge!</div>
                <div className="text-[20px] font-black text-white">Choose a boon</div>
                <div className="text-[11px] font-bold text-white/70">It lasts until you fall · the waves wait</div>
            </div>
            <div className="flex flex-wrap justify-center gap-3 px-3">
                {offer.map((id) => {
                    const b = BOON[id];
                    const have = boons[id] ?? 0;
                    return (
                        <button
                            key={id}
                            type="button"
                            className="flex w-[170px] flex-col items-center gap-1.5 rounded-2xl p-3 text-center active:translate-y-[2px]"
                            style={{ background: 'linear-gradient(#2a1f3a, #1a1226)', border: `3px solid ${b.color}`, boxShadow: `0 0 18px ${b.color}55, 0 4px 0 #0b0712`, color: '#fff' }}
                            onPointerDown={press(() => commands.emit({ type: 'boon', id }))}
                        >
                            <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `${b.color}33`, border: `2px solid ${b.color}` }}>
                                <Ico name={b.icon as IconName} size={28} color={b.color} />
                            </span>
                            <span className="text-[15px] font-black">{b.name}{id !== 'mend' && have > 0 ? ` ${have + 1}` : ''}</span>
                            <span className="text-[12px] font-bold leading-snug text-white/85">{b.blurb(have)}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/** The Surge meter: kills toward the next boon (a thin violet bar under the experience line). */
export function SurgeBar() {
    const surge = useStore((s) => s.surge);
    const boons = useStore((s) => s.boons);
    const taken = Object.values(boons).reduce((n, x) => n + (x ?? 0), 0);
    const f = surge.need > 0 ? Math.min(1, surge.have / surge.need) : 0;
    return (
        <div className="flex w-[min(340px,100%)] items-center gap-1.5 pl-[34px]" title={`Surge: ${surge.have}/${surge.need} kills to the next boon`}>
            <Ico name="bolt" size={11} color="#c4b5fd" />
            <span className="relative block h-[4px] flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(0,0,0,.5)' }}>
                <span className="absolute inset-y-0 left-0" style={{ width: `${f * 100}%`, background: 'linear-gradient(90deg, #a78bfa, #f0abfc)', transition: 'width .2s' }} />
            </span>
            {taken > 0 && <span className="text-[10px] font-black text-[#ddd6fe]" style={{ textShadow: '0 1px 2px #000' }}>{taken} boon{taken > 1 ? 's' : ''}</span>}
        </div>
    );
}

/** A small count over a button (skill points to spend). */
export function Badge({ n }: { n: number }) {
    if (n <= 0) return null;
    return (
        <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-black text-white" style={{ background: '#ef4444', border: '2px solid #2b0f1c' }}>
            {n}
        </span>
    );
}
