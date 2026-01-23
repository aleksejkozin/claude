// Physics module - procedural style
// All units in meters (SI)

import { getBounds, getCenter, getEffectiveFriction, getEffectiveBounciness } from './block.js';

// Constants
export const GRAVITY = 9.8;           // m/s²
export const DAMPING = 0.99;          // per frame
export const SLEEP_THRESHOLD = 0.001; // m/s
export const MAX_VELOCITY = 100;      // m/s

export function applyGravity(block, dt) {
  if (block.isStatic || block.isDragging) return;
  block.vy += GRAVITY * dt;
}

export function updatePosition(block, dt) {
  if (block.isStatic || block.isDragging) return;
  block.x += block.vx * dt;
  block.y += block.vy * dt;
}

export function checkCollision(block1, block2) {
  const b1 = getBounds(block1);
  const b2 = getBounds(block2);

  // Calculate overlap on each axis
  const overlapX = Math.min(b1.right - b2.left, b2.right - b1.left);
  const overlapY = Math.min(b1.bottom - b2.top, b2.bottom - b1.top);

  // No collision if no overlap on either axis
  if (overlapX <= 0 || overlapY <= 0) return null;

  // Direction from block2 to block1 (center to center)
  const c1 = getCenter(block1);
  const c2 = getCenter(block2);
  const dirX = Math.sign(c1.x - c2.x) || 1;
  const dirY = Math.sign(c1.y - c2.y) || 1;

  return { overlapX, overlapY, dirX, dirY };
}

export function resolveCollision(block1, block2, collision, dt = 0) {
  if (!collision) return;
  if (block1.isStatic && block2.isStatic) return;

  const { overlapX, overlapY, dirX, dirY } = collision;

  // Determine the axis of minimum penetration
  // This is the axis we separate on and apply impulse
  const separateOnX = overlapX < overlapY;

  // Step 1: Separate blocks on the minimum penetration axis ONLY
  separateBlocks(block1, block2, overlapX, overlapY, dirX, dirY, separateOnX);

  // Step 2: Apply impulse on the separation axis ONLY
  applyImpulse(block1, block2, dirX, dirY, separateOnX);

  // Step 3: Apply friction on the tangent axis (perpendicular to separation)
  applyFriction(block1, block2, separateOnX, dt);
}

function separateBlocks(block1, block2, overlapX, overlapY, dirX, dirY, separateOnX) {
  const overlap = separateOnX ? overlapX : overlapY;
  const dir = separateOnX ? dirX : dirY;

  if (block1.isStatic) {
    // Only block2 moves
    if (separateOnX) {
      block2.x -= dir * overlap;
    } else {
      block2.y -= dir * overlap;
    }
  } else if (block2.isStatic) {
    // Only block1 moves
    if (separateOnX) {
      block1.x += dir * overlap;
    } else {
      block1.y += dir * overlap;
    }
  } else {
    // Both dynamic: split 50/50
    if (separateOnX) {
      block1.x += dir * overlap * 0.5;
      block2.x -= dir * overlap * 0.5;
    } else {
      block1.y += dir * overlap * 0.5;
      block2.y -= dir * overlap * 0.5;
    }
  }
}

function applyImpulse(block1, block2, dirX, dirY, separateOnX) {
  const bounciness = getEffectiveBounciness(block1, block2);

  const invMass1 = block1.isStatic ? 0 : 1 / block1.mass;
  const invMass2 = block2.isStatic ? 0 : 1 / block2.mass;
  const totalInvMass = invMass1 + invMass2;

  if (totalInvMass === 0) return;

  if (separateOnX) {
    // X axis collision - apply impulse on X only
    const relVx = block1.vx - block2.vx;
    const approaching = (relVx * dirX) < 0;

    if (approaching) {
      const j = -(1 + bounciness) * relVx / totalInvMass;
      if (!block1.isStatic && !block1.isDragging) {
        block1.vx += j * invMass1;
      }
      if (!block2.isStatic && !block2.isDragging) {
        block2.vx -= j * invMass2;
      }
    }
  } else {
    // Y axis collision - apply impulse on Y only
    const relVy = block1.vy - block2.vy;
    const approaching = (relVy * dirY) < 0;

    if (approaching) {
      const j = -(1 + bounciness) * relVy / totalInvMass;
      if (!block1.isStatic && !block1.isDragging) {
        block1.vy += j * invMass1;
      }
      if (!block2.isStatic && !block2.isDragging) {
        block2.vy -= j * invMass2;
      }
    }
  }
}

function applyFriction(block1, block2, separateOnX, dt) {
  const friction = getEffectiveFriction(block1, block2);

  // Friction acts on the tangent axis (perpendicular to collision)
  // With friction=1, relative tangent velocity should become 0 (move together)
  // With friction=0, no friction (slide freely)

  const canMove1 = !block1.isStatic && !block1.isDragging;
  const canMove2 = !block2.isStatic && !block2.isDragging;

  if (separateOnX) {
    // X collision - friction affects Y velocity (tangent)
    const relVy = block1.vy - block2.vy;

    if (canMove1 && canMove2) {
      // Both can move - split friction
      const impulse = relVy * friction * 0.5;
      block1.vy -= impulse;
      block2.vy += impulse;
    } else if (canMove1) {
      // Only block1 can move - it gets full friction
      block1.vy -= relVy * friction;
    } else if (canMove2) {
      // Only block2 can move - it gets full friction
      block2.vy += relVy * friction;
    }
  } else {
    // Y collision - friction affects X velocity (tangent)
    const relVx = block1.vx - block2.vx;

    if (canMove1 && canMove2) {
      // Both can move - split friction
      const impulse = relVx * friction * 0.5;
      block1.vx -= impulse;
      block2.vx += impulse;
    } else if (canMove1) {
      // Only block1 can move - it gets full friction
      block1.vx -= relVx * friction;
      // Position correction: when dragged block moves, carry the resting block
      // This eliminates the one-frame delay that causes slippage
      if (block2.isDragging && dt > 0) {
        block1.x -= relVx * friction * dt;
      }
    } else if (canMove2) {
      // Only block2 can move - it gets full friction
      block2.vx += relVx * friction;
      // Position correction for dragged block
      if (block1.isDragging && dt > 0) {
        block2.x += relVx * friction * dt;
      }
    }
  }
}

export function applyDamping(block) {
  if (block.isStatic || block.isDragging) return;

  block.vx *= DAMPING;
  block.vy *= DAMPING;

  // Sleep threshold - stop micro-movements
  if (Math.abs(block.vx) < SLEEP_THRESHOLD) block.vx = 0;
  if (Math.abs(block.vy) < SLEEP_THRESHOLD) block.vy = 0;

  // Velocity cap
  if (Math.abs(block.vx) > MAX_VELOCITY) block.vx = Math.sign(block.vx) * MAX_VELOCITY;
  if (Math.abs(block.vy) > MAX_VELOCITY) block.vy = Math.sign(block.vy) * MAX_VELOCITY;
}

export function constrainToWorld(block, worldWidth, worldHeight) {
  if (block.isStatic) return;

  const bounds = getBounds(block);

  // Left wall
  if (bounds.left < 0) {
    block.x = 0;
    block.vx = Math.abs(block.vx) * block.bounciness;
  }
  // Right wall
  if (bounds.right > worldWidth) {
    block.x = worldWidth - block.width;
    block.vx = -Math.abs(block.vx) * block.bounciness;
  }
  // Floor
  if (bounds.bottom > worldHeight) {
    block.y = worldHeight - block.height;
    block.vy = -Math.abs(block.vy) * block.bounciness;
    // Ground friction
    block.vx *= (1 - block.friction * 0.1);
  }
  // Ceiling
  if (bounds.top < 0) {
    block.y = 0;
    block.vy = Math.abs(block.vy) * block.bounciness;
  }
}
