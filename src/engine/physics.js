// Physics module - constraint-based solver with sequential impulses
// All units in meters (SI)
//
// This implements a simplified Box2D-style constraint solver:
// 1. Detect contacts between all block pairs
// 2. Build velocity constraints for each contact (normal + friction)
// 3. Iteratively solve constraints using sequential impulses
// 4. Apply position correction to fix remaining penetration
//
// Key insight: instead of solving constraints once, we iterate multiple times.
// Each iteration, impulses propagate through the contact graph, allowing
// stacked blocks to correctly transfer forces through the entire stack.

import { getBounds, getCenter, getEffectiveFriction, getEffectiveBounciness } from './block.js';

// Constants
export const GRAVITY = 9.8;           // m/s²
export const DAMPING = 0.99;          // per frame
export const SLEEP_THRESHOLD = 0.001; // m/s
export const MAX_VELOCITY = 100;      // m/s
export const VELOCITY_ITERATIONS = 8; // iterations for velocity solver
export const POSITION_ITERATIONS = 3; // iterations for position correction
export const POSITION_SLOP = 0.005;   // allowed penetration (meters)
export const POSITION_CORRECTION = 0.2; // fraction of penetration to correct per iteration

export function applyGravity(block, dt) {
  if (block.isStatic) return;
  block.vy += GRAVITY * dt;
}

export function updatePosition(block, dt) {
  if (block.isStatic) return;
  block.x += block.vx * dt;
  block.y += block.vy * dt;
}

// Detect contact between two blocks
// Returns contact info or null if no contact
export function detectContact(block1, block2) {
  const b1 = getBounds(block1);
  const b2 = getBounds(block2);

  const overlapX = Math.min(b1.right - b2.left, b2.right - b1.left);
  const overlapY = Math.min(b1.bottom - b2.top, b2.bottom - b1.top);

  if (overlapX <= 0 || overlapY <= 0) return null;

  // Determine contact normal (points from block2 to block1)
  // Use minimum penetration axis
  const c1 = getCenter(block1);
  const c2 = getCenter(block2);

  let normalX, normalY, penetration;

  if (overlapX < overlapY) {
    // Separate on X axis
    normalX = c1.x > c2.x ? 1 : -1;
    normalY = 0;
    penetration = overlapX;
  } else {
    // Separate on Y axis
    normalX = 0;
    normalY = c1.y > c2.y ? 1 : -1;
    penetration = overlapY;
  }

  return {
    block1,
    block2,
    normalX,
    normalY,
    penetration,
    // Tangent is perpendicular to normal
    tangentX: -normalY,
    tangentY: normalX,
    // Cached values for solver
    friction: getEffectiveFriction(block1, block2),
    bounciness: getEffectiveBounciness(block1, block2),
    // Accumulated impulses (for warm starting in future, currently reset each frame)
    normalImpulse: 0,
    tangentImpulse: 0,
  };
}

// Build list of all contacts in the world
export function detectAllContacts(blocks) {
  const contacts = [];

  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const contact = detectContact(blocks[i], blocks[j]);
      if (contact) {
        contacts.push(contact);
      }
    }
  }

  return contacts;
}

// Solve velocity constraints for all contacts
// This is the core of the constraint solver
export function solveVelocityConstraints(contacts) {
  for (let iter = 0; iter < VELOCITY_ITERATIONS; iter++) {
    for (const contact of contacts) {
      solveContactVelocity(contact);
    }
  }
}

// Solve velocity constraint for a single contact
function solveContactVelocity(contact) {
  const { block1, block2, normalX, normalY, tangentX, tangentY, friction, bounciness } = contact;

  const invMass1 = block1.isStatic ? 0 : 1 / block1.mass;
  const invMass2 = block2.isStatic ? 0 : 1 / block2.mass;
  const totalInvMass = invMass1 + invMass2;

  if (totalInvMass === 0) return;

  // --- Normal constraint (prevent penetration) ---

  // Relative velocity at contact point
  const relVx = block1.vx - block2.vx;
  const relVy = block1.vy - block2.vy;

  // Relative velocity along normal
  const relVelNormal = relVx * normalX + relVy * normalY;

  // Only apply impulse if blocks are approaching
  if (relVelNormal < 0) {
    // Impulse magnitude (with restitution)
    let normalImpulse = -(1 + bounciness) * relVelNormal / totalInvMass;

    // Clamp to non-negative (can only push apart, not pull together)
    const oldNormalImpulse = contact.normalImpulse;
    contact.normalImpulse = Math.max(oldNormalImpulse + normalImpulse, 0);
    normalImpulse = contact.normalImpulse - oldNormalImpulse;

    // Apply normal impulse
    if (!block1.isStatic) {
      block1.vx += normalImpulse * invMass1 * normalX;
      block1.vy += normalImpulse * invMass1 * normalY;
    }
    if (!block2.isStatic) {
      block2.vx -= normalImpulse * invMass2 * normalX;
      block2.vy -= normalImpulse * invMass2 * normalY;
    }
  }

  // --- Friction constraint (resist sliding) ---

  // Recalculate relative velocity after normal impulse
  const relVx2 = block1.vx - block2.vx;
  const relVy2 = block1.vy - block2.vy;

  // Relative velocity along tangent
  const relVelTangent = relVx2 * tangentX + relVy2 * tangentY;

  // Friction impulse to stop tangent motion
  let tangentImpulse = -relVelTangent / totalInvMass;

  // For game physics: friction works even without normal force
  // Scale friction impulse by friction coefficient directly
  // This allows high-friction blocks to move together
  tangentImpulse *= friction;

  // Apply friction impulse
  if (!block1.isStatic) {
    block1.vx += tangentImpulse * invMass1 * tangentX;
    block1.vy += tangentImpulse * invMass1 * tangentY;
  }
  if (!block2.isStatic) {
    block2.vx -= tangentImpulse * invMass2 * tangentX;
    block2.vy -= tangentImpulse * invMass2 * tangentY;
  }

  // Update accumulated tangent impulse for tracking
  contact.tangentImpulse += tangentImpulse;
}

// Solve position constraints (fix remaining penetration)
export function solvePositionConstraints(contacts) {
  for (let iter = 0; iter < POSITION_ITERATIONS; iter++) {
    for (const contact of contacts) {
      solveContactPosition(contact);
    }
  }
}

// Solve position constraint for a single contact
function solveContactPosition(contact) {
  const { block1, block2, normalX, normalY } = contact;

  // Recalculate penetration (it may have changed)
  const b1 = getBounds(block1);
  const b2 = getBounds(block2);

  const overlapX = Math.min(b1.right - b2.left, b2.right - b1.left);
  const overlapY = Math.min(b1.bottom - b2.top, b2.bottom - b1.top);

  if (overlapX <= 0 || overlapY <= 0) return;

  // Use the same axis as initial contact
  const penetration = normalX !== 0 ? overlapX : overlapY;

  // Only correct if penetration exceeds slop
  const correction = Math.max(penetration - POSITION_SLOP, 0) * POSITION_CORRECTION;

  if (correction <= 0) return;

  const invMass1 = block1.isStatic ? 0 : 1 / block1.mass;
  const invMass2 = block2.isStatic ? 0 : 1 / block2.mass;
  const totalInvMass = invMass1 + invMass2;

  if (totalInvMass === 0) return;

  // Apply position correction
  const correctionX = correction * normalX / totalInvMass;
  const correctionY = correction * normalY / totalInvMass;

  if (!block1.isStatic) {
    block1.x += correctionX * invMass1;
    block1.y += correctionY * invMass1;
  }
  if (!block2.isStatic) {
    block2.x -= correctionX * invMass2;
    block2.y -= correctionY * invMass2;
  }
}

export function applyDamping(block) {
  if (block.isStatic) return;

  block.vx *= DAMPING;
  block.vy *= DAMPING;

  if (Math.abs(block.vx) < SLEEP_THRESHOLD) block.vx = 0;
  if (Math.abs(block.vy) < SLEEP_THRESHOLD) block.vy = 0;

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

// Legacy API for backward compatibility with tests
export function checkCollision(block1, block2) {
  const b1 = getBounds(block1);
  const b2 = getBounds(block2);

  const overlapX = Math.min(b1.right - b2.left, b2.right - b1.left);
  const overlapY = Math.min(b1.bottom - b2.top, b2.bottom - b1.top);

  if (overlapX <= 0 || overlapY <= 0) return null;

  const c1 = getCenter(block1);
  const c2 = getCenter(block2);
  const dirX = Math.sign(c1.x - c2.x) || 1;
  const dirY = Math.sign(c1.y - c2.y) || 1;

  return { overlapX, overlapY, dirX, dirY };
}

// Legacy API - now uses constraint solver internally
// For backward compatibility, this fully separates blocks in a single call
export function resolveCollision(block1, block2, collision, dt = 0) {
  if (!collision) return;
  if (block1.isStatic && block2.isStatic) return;

  // Create a single contact and solve it
  const contact = detectContact(block1, block2);
  if (contact) {
    // Multiple iterations for single contact
    for (let i = 0; i < VELOCITY_ITERATIONS; i++) {
      solveContactVelocity(contact);
    }
    // For legacy API: full separation (not partial correction)
    // Use more iterations with higher correction to ensure complete separation
    for (let i = 0; i < 10; i++) {
      solveContactPositionFull(contact);
    }
  }
}

// Full position correction for legacy API (100% correction, no slop)
function solveContactPositionFull(contact) {
  const { block1, block2, normalX, normalY } = contact;

  const b1 = getBounds(block1);
  const b2 = getBounds(block2);

  const overlapX = Math.min(b1.right - b2.left, b2.right - b1.left);
  const overlapY = Math.min(b1.bottom - b2.top, b2.bottom - b1.top);

  if (overlapX <= 0 || overlapY <= 0) return;

  const penetration = normalX !== 0 ? overlapX : overlapY;
  // No slop for legacy API - full separation required
  const correction = penetration;

  if (correction <= 0) return;

  const invMass1 = block1.isStatic ? 0 : 1 / block1.mass;
  const invMass2 = block2.isStatic ? 0 : 1 / block2.mass;
  const totalInvMass = invMass1 + invMass2;

  if (totalInvMass === 0) return;

  const correctionX = correction * normalX / totalInvMass;
  const correctionY = correction * normalY / totalInvMass;

  if (!block1.isStatic) {
    block1.x += correctionX * invMass1;
    block1.y += correctionY * invMass1;
  }
  if (!block2.isStatic) {
    block2.x -= correctionX * invMass2;
    block2.y -= correctionY * invMass2;
  }
}
