/**
 * The phone's Back button (Android; the host sends it through the SDK). It steps back the way Escape does
 * on a keyboard: in the world it closes the panel on top, else opens (or closes) the pause screen, and it
 * never quits from there; in the menus each screen's own Escape steps back. Only on the title screen, with
 * nothing left to step back from, does it say "not handled", and the host then leaves the game.
 */
import { store, type AppState } from '../state/store.ts';

export function backStep(): boolean {
    const s = store.get();
    if (s.phase === 'playing' && !s.cine && !s.pauseMenu) {
        // The panels that have no Escape key of their own, the topmost first.
        const panels: [boolean, Partial<AppState>][] = [
            [s.reviveShop, { reviveShop: false }],
            [s.talentsOpen, { talentsOpen: false }],
            [s.buildPanel !== null, { buildPanel: null }],
            [s.puzzle !== null, { puzzle: null }],
            [s.loom, { loom: false }],
            [s.bagTab !== null, { bagTab: null }],
            [s.bigMap, { bigMap: false }],
            [s.shop, { shop: false }],
            [s.npc !== null, { npc: null }],
            [s.travel, { travel: false }],
            [s.house !== null, { house: null }],
        ];
        const open = panels.find(([on]) => on);
        if (open) {
            store.patch(open[1]);
            return true;
        }
        // A choice that has to be made (a boon, the end of a run, a debate, a story page): Back waits for it.
        if (s.gameOver || s.boonOffer || s.debate || s.storyPopup) return true;
    }
    // Everything else steps back as Escape does: the pause screen (and its pages), a cinematic's skip, the menus.
    const esc = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true });
    window.dispatchEvent(esc);
    return esc.defaultPrevented || s.phase !== 'menu';
}
