/**
 * The four skills. Monster drops are gems of the matching colour that you keep; a gem only
 * does something when it is spent on an upgrade at a visiting frog (a death loses the ones you still carry).
 */
import type { Skill } from '../shared/sim.ts';

export const SKILL_NAMES: Record<Skill, string> = { attack: 'Attack', defence: 'Defence', speed: 'Speed', vitality: 'Vitality' };
export const SKILL_CAP: Record<Skill, number> = { attack: 10, defence: 10, speed: 10, vitality: 4 };
export const SKILL_COLOR: Record<Skill, number> = { attack: 0xff6b6b, defence: 0x6ba8ff, speed: 0x5ee08a, vitality: 0xffc94d };
export const SKILL_BLURB: Record<Skill, string> = {
    attack: 'Hit harder',
    defence: 'Block more bites',
    speed: 'Run faster',
    vitality: 'One more heart',
};
/** Most gems of one colour you can carry. */
export const GEM_CAP = 99;
/** Gems an upgrade costs when the skill is at `level` (1 for the first, 2 for the second, ...). */
export const upgradeCost = (level: number): number => level + 1;
