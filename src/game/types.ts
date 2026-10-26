/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameState = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type EnemyType = 'basic' | 'heavy' | 'elite' | 'boss';

export interface Skin {
  id: string;
  name: string;
  codename: string;
  description: string;
  perk: string;
  cost: number;
  hoodColor: string;
  suitColor: string;
  scarfColor: string;
  eyeColor: string;
  accentGlow: string;
}

export interface PatrolPoint {
  x: number;
  z: number;
  waitTime?: number;
}

export interface EnemyConfig {
  id: string;
  type: EnemyType;
  spawn: { x: number; z: number };
  facingAngle: number;
  patrol: PatrolPoint[];
  maxHp?: number;
}

export interface ObstacleDef {
  id: string;
  type: 'wall' | 'crate' | 'container' | 'pillar' | 'server' | 'laser' | 'plant' | 'couch' | 'gate';
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color?: string;
  isCover?: boolean;
  requiresKeycard?: boolean;
}

export interface LevelConfig {
  id: number;
  name: string;
  location: string;
  theme: 'warehouse' | 'rooftop' | 'techvault' | 'desert' | 'penthouse';
  parTimeSec: number;
  playerSpawn: { x: number; z: number; angle: number };
  exitPoint: { x: number; z: number; label: string; icon: string };
  guards: EnemyConfig[];
  coins: { id: string; x: number; z: number }[];
  obstacles: ObstacleDef[];
  keycard?: { x: number; z: number; gateId: string };
  terminal?: { x: number; z: number; label: string };
  fogColor: number;
  groundColor: number;
  lightKeyColor: number;
  lightFillColor: number;
  ambientIntensity: number;
}

export interface RunStats {
  levelId: number;
  timeSec: number;
  coinsCollected: number;
  totalCoins: number;
  guardsEliminated: number;
  totalGuards: number;
  alarmsTriggered: number;
  stars: number;
  score: number;
  stealthBonus: number;
  timeBonus: number;
}

export interface UserSaveData {
  coins: number;
  selectedSkinId: string;
  unlockedSkinIds: string[];
  unlockedLevelMax: number;
  levelStars: Record<number, number>; // levelId -> stars (1-3)
  highScores: Record<number, number>;
  smokeBombs: number;
  upgrades: {
    runSpeed: number; // 0, 1, 2
    sneakSpeed: number; // 0, 1, 2
    radarRange: number; // 0, 1, 2
  };
}
