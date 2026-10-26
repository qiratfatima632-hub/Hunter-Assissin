import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPointInVisionCone,
  hasLineOfSight,
  canPerformTakedown,
  calculateLevelResults,
} from './stealthRules.ts';

test('isPointInVisionCone correctly identifies points inside and outside cone', () => {
  const observer = { x: 0, z: 0 };
  const facingEast = 0; // along +X
  const fov = Math.PI / 2; // 90 degrees total (45 deg each side)
  const range = 10;

  // Directly ahead
  assert.equal(isPointInVisionCone(observer, facingEast, { x: 5, z: 0 }, fov, range), true);

  // Slightly to the right (within 45 deg)
  assert.equal(isPointInVisionCone(observer, facingEast, { x: 5, z: 2 }, fov, range), true);

  // Directly behind
  assert.equal(isPointInVisionCone(observer, facingEast, { x: -5, z: 0 }, fov, range), false);

  // Ahead but beyond range
  assert.equal(isPointInVisionCone(observer, facingEast, { x: 15, z: 0 }, fov, range), false);

  // Perpendicular 90 deg off (outside 45 deg half-fov)
  assert.equal(isPointInVisionCone(observer, facingEast, { x: 0, z: 5 }, fov, range), false);
});

test('hasLineOfSight is blocked by intervening obstacle boxes', () => {
  const player = { x: 0, z: 0 };
  const guard = { x: 10, z: 0 };

  const obstacles = [
    { x: 5, z: 0, width: 2, depth: 2 }, // Box directly in between
  ];

  // Blocked
  assert.equal(hasLineOfSight(player, guard, obstacles), false);

  // Clear path around obstacle
  const clearGuard = { x: 5, z: 10 };
  assert.equal(hasLineOfSight(player, clearGuard, obstacles), true);
});

test('canPerformTakedown checks distance and angle from behind', () => {
  const guardPos = { x: 0, z: 0 };
  const guardFacing = 0; // facing +X (East)

  // Player directly behind guard (at -X)
  const behindPlayer = { x: -1.5, z: 0 };
  assert.equal(canPerformTakedown(behindPlayer, guardPos, guardFacing, false, 2.2), true);

  // Player in front of guard (at +X)
  const inFrontPlayer = { x: 1.5, z: 0 };
  assert.equal(canPerformTakedown(inFrontPlayer, guardPos, guardFacing, false, 2.2), false);

  // Player too far away
  const farBehindPlayer = { x: -5, z: 0 };
  assert.equal(canPerformTakedown(farBehindPlayer, guardPos, guardFacing, false, 2.2), false);

  // Heavy guard requires strictly behind
  const sidePlayer = { x: 0.5, z: 1.5 }; // ~70 degrees
  assert.equal(canPerformTakedown(sidePlayer, guardPos, guardFacing, true, 2.2), false);
});

test('calculateLevelResults gives 3 stars for stealth and high coin completion under par', () => {
  const perfectRun = calculateLevelResults({
    timeTakenSec: 40,
    parTimeSec: 60,
    coinsCollected: 10,
    totalCoins: 10,
    alarmsTriggered: 0,
    guardsEliminated: 3,
    totalGuards: 3,
  });

  assert.equal(perfectRun.stars, 3);
  assert.equal(perfectRun.allCoinsFound, true);
  assert.equal(perfectRun.stealthBonus, 500);
  assert.ok(perfectRun.finalScore > 1000);

  const noisyRun = calculateLevelResults({
    timeTakenSec: 90,
    parTimeSec: 60,
    coinsCollected: 3,
    totalCoins: 10,
    alarmsTriggered: 3,
    guardsEliminated: 3,
    totalGuards: 3,
  });

  assert.equal(noisyRun.stars, 1);
});
