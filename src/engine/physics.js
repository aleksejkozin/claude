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

  // Direction from B to A (center to center)
  const c1 = getCenter(block1);
  const c2 = getCenter(block2);
  const dirX = Math.sign(c1.x - c2.x) || 1;
  const dirY = Math.sign(c1.y - c2.y) || 1;

  return { overlapX, overlapY, dirX, dirY };
}

export function resolveCollision(block1, block2, collision) {
  if (!collision) return;
  if (block1.isStatic && block2.isStatic) return;

  const { overlapX, overlapY, dirX, dirY } = collision;

  // Step 1: Separate blocks on each axis
  separateBlocks(block1, block2, overlapX, overlapY, dirX, dirY);

  // Step 2: Apply impulse on each axis independently
  applyImpulse(block1, block2, dirX, dirY);

  // Step 3: Apply friction (tangent to collision)
  applyFriction(block1, block2, overlapX, overlapY);
}

function separateBlocks(block1, block2, overlapX, overlapY, dirX, dirY) {
  // Simple 50/50 split for dynamic blocks, full push for static
  if (block1.isStatic) {
    block2.x -= dirX * overlapX;
    block2.y -= dirY * overlapY;
  } else if (block2.isStatic) {
    block1.x += dirX * overlapX;
    block1.y += dirY * overlapY;
  } else {
    // Both dynamic: split 50/50
    block1.x += dirX * overlapX * 0.5;
    block1.y += dirY * overlapY * 0.5;
    block2.x -= dirX * overlapX * 0.5;
    block2.y -= dirY * overlapY * 0.5;
  }
}

function applyImpulse(block1, block2, dirX, dirY) {
  const bounciness = getEffectiveBounciness(block1, block2);

  const invMass1 = block1.isStatic ? 0 : 1 / block1.mass;
  const invMass2 = block2.isStatic ? 0 : 1 / block2.mass;
  const totalInvMass = invMass1 + invMass2;

  if (totalInvMass === 0) return;

  // X axis impulse
  const relVx = block1.vx - block2.vx;
  const approachingX = (relVx * dirX) < 0;

  if (approachingX) {
    const jx = -(1 + bounciness) * relVx / totalInvMass;
    if (!block1.isStatic && !block1.isDragging) {
      block1.vx += jx * invMass1;
    }
    if (!block2.isStatic && !block2.isDragging) {
      block2.vx -= jx * invMass2;
    }
  }

  // Y axis impulse
  const relVy = block1.vy - block2.vy;
  const approachingY = (relVy * dirY) < 0;

  if (approachingY) {
    const jy = -(1 + bounciness) * relVy / totalInvMass;
    if (!block1.isStatic && !block1.isDragging) {
      block1.vy += jy * invMass1;
    }
    if (!block2.isStatic && !block2.isDragging) {
      block2.vy -= jy * invMass2;
    }
  }
}

function applyFriction(block1, block2, overlapX, overlapY) {
  const friction = getEffectiveFriction(block1, block2);

  // Determine which axis is the contact surface
  // Smaller overlap = separation axis, larger overlap = contact surface (tangent)
  if (overlapX < overlapY) {
    // Vertical contact surface - friction affects Y velocity
    const relVy = block1.vy - block2.vy;
    const frictionImpulse = relVy * friction * 0.5;

    if (!block1.isStatic && !block1.isDragging) {
      block1.vy -= frictionImpulse;
    }
    if (!block2.isStatic && !block2.isDragging) {
      block2.vy += frictionImpulse;
    }
  } else {
    // Horizontal contact surface - friction affects X velocity
    const relVx = block1.vx - block2.vx;
    const frictionImpulse = relVx * friction * 0.5;

    if (!block1.isStatic && !block1.isDragging) {
      block1.vx -= frictionImpulse;
    }
    if (!block2.isStatic && !block2.isDragging) {
      block2.vx += frictionImpulse;
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
