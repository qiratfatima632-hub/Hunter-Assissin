/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Vector2D {
  x: number;
  z: number;
}

export interface ObstacleBox {
  x: number;
  z: number;
  width: number;
  depth: number;
}

/**
 * Checks if a target point is within an observer's conical field of view.
 * @param observerPos Observer coordinate (x, z)
 * @param observerFacingAngle Angle observer is looking (radians, 0 = +X, PI/2 = +Z)
 * @param targetPos Target coordinate (x, z)
 * @param fovRad Total field of view in radians (e.g. Math.PI * 0.45 ~ 80 deg)
 * @param range Maximum detection distance
 */
export function isPointInVisionCone(
  observerPos: Vector2D,
  observerFacingAngle: number,
  targetPos: Vector2D,
  fovRad: number,
  range: number
): boolean {
  const dx = targetPos.x - observerPos.x;
  const dz = targetPos.z - observerPos.z;
  const distSq = dx * dx + dz * dz;

  if (distSq > range * range || distSq < 0.0001) {
    return false;
  }

  const angleToTarget = Math.atan2(dz, dx);
  let angleDiff = Math.abs(angleToTarget - observerFacingAngle);

  // Normalize angle difference to [0, PI]
  while (angleDiff > Math.PI) {
    angleDiff = Math.abs(angleDiff - 2 * Math.PI);
  }

  return angleDiff <= fovRad / 2;
}

/**
 * Fast 2D raycast / line-of-sight test between observer and target against axis-aligned box obstacles.
 */
export function hasLineOfSight(
  from: Vector2D,
  to: Vector2D,
  obstacles: ObstacleBox[]
): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.001) return true;

  // Step along the ray in small increments
  const stepSize = 0.4;
  const steps = Math.ceil(dist / stepSize);
  const stepX = dx / steps;
  const stepZ = dz / steps;

  for (let i = 1; i < steps; i++) {
    const testX = from.x + stepX * i;
    const testZ = from.z + stepZ * i;

    for (const obs of obstacles) {
      const halfW = obs.width / 2;
      const halfD = obs.depth / 2;
      if (
        testX >= obs.x - halfW &&
        testX <= obs.x + halfW &&
        testZ >= obs.z - halfD &&
        testZ <= obs.z + halfD
      ) {
        return false; // Obstructed by obstacle
      }
    }
  }

  return true;
}

/**
 * Checks if the player can perform a stealth takedown on an enemy.
 * Allowed if:
 * 1. Player is within takedown range.
 * 2. Player is behind the enemy OR enemy is not currently facing/alerted to player.
 */
export function canPerformTakedown(
  playerPos: Vector2D,
  enemyPos: Vector2D,
  enemyFacingAngle: number,
  isBehindStrict: boolean = false,
  maxDistance: number = 2.2
): boolean {
  const dx = playerPos.x - enemyPos.x;
  const dz = playerPos.z - enemyPos.z;
  const dist = Math.hypot(dx, dz);

  if (dist > maxDistance) return false;

  // Angle from enemy to player
  const angleToPlayer = Math.atan2(dz, dx);
  let angleDiff = Math.abs(angleToPlayer - enemyFacingAngle);
  while (angleDiff > Math.PI) {
    angleDiff = Math.abs(angleDiff - 2 * Math.PI);
  }

  // If strict behind (e.g. for Heavy Brutes), angleDiff must be > 100 degrees (PI * 0.55)
  if (isBehindStrict) {
    return angleDiff > Math.PI * 0.55;
  }

  // Regular guards: player must not be directly in front (angleDiff > 45 deg or sneaking behind)
  return angleDiff > Math.PI * 0.25;
}

/**
 * Calculate stars (1-3) and final score based on level metrics.
 */
export function calculateLevelResults(params: {
  timeTakenSec: number;
  parTimeSec: number;
  coinsCollected: number;
  totalCoins: number;
  alarmsTriggered: number;
  guardsEliminated: number;
  totalGuards: number;
}) {
  let stars = 1;
  const coinRatio = params.totalCoins > 0 ? params.coinsCollected / params.totalCoins : 1;
  const stealthy = params.alarmsTriggered === 0;
  const underParTime = params.timeTakenSec <= params.parTimeSec;

  if (stealthy && (coinRatio >= 0.7 || underParTime)) {
    stars = 2;
  }
  if (stealthy && coinRatio >= 0.9 && underParTime) {
    stars = 3;
  }

  const baseScore = params.guardsEliminated * 150 + params.coinsCollected * 50;
  const stealthBonus = params.alarmsTriggered === 0 ? 500 : Math.max(0, 500 - params.alarmsTriggered * 150);
  const timeBonus = Math.max(0, Math.floor((params.parTimeSec - params.timeTakenSec) * 10));
  const finalScore = baseScore + stealthBonus + timeBonus;

  return {
    stars,
    finalScore,
    stealthBonus,
    timeBonus,
    allCoinsFound: params.coinsCollected >= params.totalCoins,
  };
}
