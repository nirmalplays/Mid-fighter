/**
 * The leaderboard: one score per finished run (100 x the wave reached + enemies defeated),
 * through the RUN SDK. Every call can reject, so each one is wrapped and degrades to an
 * empty answer (the Game Over screen still works offline).
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

export interface ScoreRow {
    rank: number;
    name: string;
    score: number;
    wave: number;
    me: boolean;
}

export interface SubmitResult {
    accepted: boolean;
    rank: number | null;
    reason: string | null;
}

export const runScore = (wave: number, kills: number): number => 100 * wave + kills;

export async function submitRun(score: number, seconds: number, wave: number, kills: number): Promise<SubmitResult> {
    try {
        const r = await RundotGameAPI.leaderboard.submitScore({ score, duration: Math.max(1, Math.round(seconds)), metadata: { wave, kills } });
        return { accepted: r.accepted === true, rank: r.accepted ? r.rank ?? null : null, reason: r.accepted ? null : r.reason ?? null };
    } catch (err) {
        console.warn('[leaderboard] submit failed', err);
        return { accepted: false, rank: null, reason: 'Could not reach the leaderboard.' };
    }
}

/** The top scores, flagging the player's own row. */
export async function topScores(limit = 10): Promise<ScoreRow[]> {
    try {
        let me: string | null = null;
        try {
            me = RundotGameAPI.getProfile().id ?? null;
        } catch {
            /* no cached profile: no row is marked as yours */
        }
        const page = await RundotGameAPI.leaderboard.getPagedScores({ limit });
        return page.entries.map((e, i) => ({
            rank: e.rank ?? i + 1,
            name: e.username || 'Player',
            score: e.score,
            wave: typeof e.metadata?.wave === 'number' ? e.metadata.wave : Math.floor(e.score / 100),
            me: me !== null && e.profileId === me,
        }));
    } catch (err) {
        console.warn('[leaderboard] could not load scores', err);
        return [];
    }
}

/** The player's own rank, or null. */
export async function myRank(): Promise<number | null> {
    try {
        const r = await RundotGameAPI.leaderboard.getMyRank();
        return r.rank;
    } catch {
        return null;
    }
}
