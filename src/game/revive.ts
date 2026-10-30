/**
 * Revive tokens: bought with RUN Bits through the RUN shop (rundot/shop.config.json) and kept
 * as a consumable entitlement. A token is used automatically when you fall in a run, up to
 * REVIVE_MAX times per run, so paying never buys a place on the leaderboard by itself.
 * Every SDK call can reject, so each one is wrapped and degrades to "no tokens".
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { store } from '../state/store.ts';

export const REVIVE_ENTITLEMENT = 'revive_token';
export const REVIVE_MAX = 2;

export interface TokenPack {
    id: string;
    tokens: number;
    /** RUN Bits; the real price comes from the shop catalog when it loads */
    bits: number;
}

export const PACKS: TokenPack[] = [
    { id: 'revive_1', tokens: 1, bits: 20 },
    { id: 'revive_5', tokens: 5, bits: 80 },
    { id: 'revive_15', tokens: 15, bits: 200 },
];

// Debug: ?tokens=N gives local tokens with no shop calls.
const debug = new URLSearchParams(location.search).get('tokens');
let debugTokens = debug === null ? null : Math.max(0, Number(debug) || 0);

const track = (name: string, props: Record<string, unknown>) => {
    try {
        void RundotGameAPI.analytics.recordCustomEvent(name, props).catch(() => {});
    } catch { /* analytics is best effort */ }
};

/** Reads how many tokens the player owns into the store. */
export async function refreshTokens(): Promise<number> {
    if (debugTokens !== null) {
        store.patch({ reviveTokens: debugTokens });
        return debugTokens;
    }
    try {
        const n = await RundotGameAPI.entitlements.getQuantity(REVIVE_ENTITLEMENT);
        store.patch({ reviveTokens: n });
        return n;
    } catch (err) {
        console.warn('[revive] could not read tokens', err);
        return store.get().reviveTokens;
    }
}

/** The catalog prices (sales included), by pack id; falls back to the defaults above. */
export async function loadPrices(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const p of PACKS) out[p.id] = p.bits;
    try {
        const cat = await RundotGameAPI.shop.getCatalog();
        for (const it of cat.items) if (it.itemId in out) out[it.itemId] = Number(it.resolvedPrice.finalPrice.value) || out[it.itemId];
    } catch (err) {
        console.warn('[revive] could not read the shop catalog', err);
    }
    return out;
}

export type BuyResult = 'bought' | 'cancelled' | 'failed';

/** Buys a pack; the host opens the RUN Bits top-up if the player is short. */
export async function buyPack(pack: TokenPack): Promise<BuyResult> {
    track('checkout_started', { item_id: pack.id });
    if (debugTokens !== null) {
        debugTokens += pack.tokens;
        store.patch({ reviveTokens: debugTokens });
        return 'bought';
    }
    try {
        const r = await RundotGameAPI.shop.purchase(pack.id, crypto.randomUUID());
        if (!r.success) {
            track('purchase_failed', { item_id: pack.id, reason: 'cancelled' });
            return 'cancelled';
        }
        track('purchase_complete', { item_id: pack.id, tokens: pack.tokens });
        await refreshTokens();
        return 'bought';
    } catch (err) {
        console.warn('[revive] purchase failed', err);
        track('purchase_failed', { item_id: pack.id, reason: 'error' });
        return 'failed';
    }
}

/** Uses one token. False if there was none or the server said no. */
export async function useToken(): Promise<boolean> {
    if (debugTokens !== null) {
        if (debugTokens <= 0) return false;
        debugTokens -= 1;
        store.patch({ reviveTokens: debugTokens });
        return true;
    }
    try {
        const ent = await RundotGameAPI.entitlements.consumeEntitlement(REVIVE_ENTITLEMENT, 1, undefined, 'revive');
        store.patch({ reviveTokens: ent.quantity });
        track('revive_used', { left: ent.quantity });
        return true;
    } catch (err) {
        console.warn('[revive] could not use a token', err);
        return false;
    }
}
