/**
 * Starting the story: a new game pledges to Pyraxis (the story always begins there; the other lands
 * open one by one as each is pacified), enters the world, and plays the opening cinematic.
 */
import { store } from '../../state/store.ts';
import { progress } from '../progress.ts';
import { quest } from './quest.ts';

export function beginStory(): void {
    if (!progress.kingdom()) progress.chooseKingdom('fire');
    progress.markIntroSeen();
    store.patch({ phase: 'playing' });
    quest.begin();
}
