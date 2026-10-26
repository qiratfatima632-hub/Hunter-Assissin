/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserSaveData } from './types.ts';

const STORAGE_KEY = 'cartoon_hunter_assassin_save_v1';

export const DEFAULT_SAVE_DATA: UserSaveData = {
  coins: 40, // starting pocket money
  selectedSkinId: 'shadow_ninja',
  unlockedSkinIds: ['shadow_ninja'],
  unlockedLevelMax: 1,
  levelStars: {},
  highScores: {},
  smokeBombs: 2,
  upgrades: {
    runSpeed: 0,
    sneakSpeed: 0,
    radarRange: 0,
  },
};

export function loadSaveData(): UserSaveData {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_SAVE_DATA };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SAVE_DATA };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SAVE_DATA,
      ...parsed,
      unlockedSkinIds: Array.isArray(parsed.unlockedSkinIds)
        ? parsed.unlockedSkinIds
        : ['shadow_ninja'],
      levelStars: parsed.levelStars || {},
      highScores: parsed.highScores || {},
      upgrades: {
        ...DEFAULT_SAVE_DATA.upgrades,
        ...(parsed.upgrades || {}),
      },
    };
  } catch {
    return { ...DEFAULT_SAVE_DATA };
  }
}

export function writeSaveData(data: UserSaveData): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}
