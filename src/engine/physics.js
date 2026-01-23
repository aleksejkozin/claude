// Physics module - procedural style
// Handles gravity, collision detection and resolution

import { getBounds, getEffectiveFriction, getEffectiveBounciness, shouldStick } from './block.js';

export const GRAVITY = 980; // pixels per second squared

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

  const colliding = !(
    b1.right <= b2.left ||
    b1.left >= b2.right ||
    b1.bottom <= b2.top ||
    b1.top >= b2.bottom
  );

  if (!colliding) return null;

  // Calculate overlap on each axis
  const overlapLeft = b1.right - b2.left;
  const overlapRight = b2.right - b1.left;
  const overlapTop = b1.bottom - b2.top;
  const overlapBottom = b2.bottom - b1.top;

  const minOverlapX = Math.min(overlapLeft, overlapRight);
  const minOverlapY = Math.min(overlapTop, overlapBottom);

  // Always use center-to-center normal - works for both edge and corner collisions
  const center1x = block1.x + block1.width / 2;
  const center1y = block1.y + block1.height / 2;
  const center2x = block2.x + block2.width / 2;
  const center2y = block2.y + block2.height / 2;

  const dx = center1x - center2x;
  const dy = center1y - center2y;
  const length = Math.sqrt(dx * dx + dy * dy);

  let normal;
  if (length > 0) {
    normal = { x: dx / length, y: dy / length };
  } else {
    // Blocks perfectly overlapping, fallback to vertical
    normal = { x: 0, y: -1 };
  }

  const penetration = Math.min(minOverlapX, minOverlapY);

  return { normal, penetration };
}

export function resolveCollision(block1, block2, collision) {
  if (!collision) return;

  const { normal, penetration } = collision;

  // Both static? Nothing to do
  if (block1.isStatic && block2.isStatic) return;

  // Separate blocks
  separateBlocks(block1, block2, normal, penetration);

  // Calculate relative velocity
  const relVelX = block1.vx - block2.vx;
  const relVelY = block1.vy - block2.vy;
  const relVelAlongNormal = relVelX * normal.x + relVelY * normal.y;

  // Don't resolve if velocities are separating
  if (relVelAlongNormal > 0) return;

  // Get bounciness
  const bounciness = getEffectiveBounciness(block1, block2);

  // Calculate impulse
  const totalInverseMass =
    (block1.isStatic ? 0 : 1 / block1.mass) +
    (block2.isStatic ? 0 : 1 / block2.mass);

  if (totalInverseMass === 0) return;

  const impulse = -(1 + bounciness) * relVelAlongNormal / totalInverseMass;

  // Apply impulse
  if (!block1.isStatic && !block1.isDragging) {
    block1.vx += impulse * normal.x / block1.mass;
    block1.vy += impulse * normal.y / block1.mass;
  }
  if (!block2.isStatic && !block2.isDragging) {
    block2.vx -= impulse * normal.x / block2.mass;
    block2.vy -= impulse * normal.y / block2.mass;
  }

  // Apply friction (tangent to collision)
  applyFriction(block1, block2, normal);

  // Handle sticky blocks
  if (shouldStick(block1, block2)) {
    handleSticking(block1, block2);
  }
}

function separateBlocks(block1, block2, normal, penetration) {
  if (block1.isStatic && block2.isStatic) return;

  const totalInverseMass =
    (block1.isStatic ? 0 : 1 / block1.mass) +
    (block2.isStatic ? 0 : 1 / block2.mass);

  if (totalInverseMass === 0) return;

  const correction = penetration / totalInverseMass;
  const slop = 0.01; // Small tolerance to prevent jitter
  const correctionAmount = Math.max(penetration - slop, 0) / totalInverseMass * 0.8;

  if (!block1.isStatic) {
    block1.x += normal.x * correctionAmount / block1.mass;
    block1.y += normal.y * correctionAmount / block1.mass;
  }
  if (!block2.isStatic) {
    block2.x -= normal.x * correctionAmount / block2.mass;
    block2.y -= normal.y * correctionAmount / block2.mass;
  }
}

function applyFriction(block1, block2, normal) {
  // Tangent is perpendicular to normal
  const tangent = { x: -normal.y, y: normal.x };

  const relVelX = block1.vx - block2.vx;
  const relVelY = block1.vy - block2.vy;
  const relVelAlongTangent = relVelX * tangent.x + relVelY * tangent.y;

  const friction = getEffectiveFriction(block1, block2);
  const frictionImpulse = relVelAlongTangent * friction;

  if (!block1.isStatic && !block1.isDragging) {
    block1.vx -= frictionImpulse * tangent.x * 0.5;
    block1.vy -= frictionImpulse * tangent.y * 0.5;
  }
  if (!block2.isStatic && !block2.isDragging) {
    block2.vx += frictionImpulse * tangent.x * 0.5;
    block2.vy += frictionImpulse * tangent.y * 0.5;
  }
}

function handleSticking(block1, block2) {
  if (!block1.stuckTo.includes(block2.id)) {
    block1.stuckTo.push(block2.id);
  }
  if (!block2.stuckTo.includes(block1.id)) {
    block2.stuckTo.push(block1.id);
  }
}

export function unstick(block1, block2) {
  block1.stuckTo = block1.stuckTo.filter(id => id !== block2.id);
  block2.stuckTo = block2.stuckTo.filter(id => id !== block1.id);
}

export function isStuckTo(block1, block2) {
  return block1.stuckTo.includes(block2.id);
}

export function applyDamping(block, damping = 0.99) {
  if (block.isStatic || block.isDragging) return;
  block.vx *= damping;
  block.vy *= damping;
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
    // Apply ground friction
    block.vx *= (1 - block.friction * 0.1);
  }
  // Ceiling (optional, blocks can go above)
  if (bounds.top < 0) {
    block.y = 0;
    block.vy = Math.abs(block.vy) * block.bounciness;
  }
}

// Check if blockOnTop is resting on blockBelow
export function isRestingOn(blockOnTop, blockBelow) {
  const topBounds = getBounds(blockOnTop);
  const belowBounds = getBounds(blockBelow);

  // Check vertical alignment: top block's bottom should be at or just above below block's top
  const verticalContact = Math.abs(topBounds.bottom - belowBounds.top) < 2;

  // Check horizontal overlap
  const horizontalOverlap =
    topBounds.right > belowBounds.left + 1 &&
    topBounds.left < belowBounds.right - 1;

  return verticalContact && horizontalOverlap;
}

// Find all blocks resting on top of a given block
export function getBlocksRestingOn(block, allBlocks) {
  return allBlocks.filter(other =>
    other.id !== block.id &&
    !other.isStatic &&
    !other.isDragging &&
    isRestingOn(other, block)
  );
}

// Apply drag friction: when a block is dragged, blocks on top move with it
// Also sets velocity so blocks continue with inertia when drag stops
export function applyDragFriction(draggedBlock, allBlocks, dx, dy, dt, visited = new Set()) {
  if (visited.has(draggedBlock.id)) return;
  visited.add(draggedBlock.id);

  const blocksOnTop = getBlocksRestingOn(draggedBlock, allBlocks);

  for (const block of blocksOnTop) {
    const friction = getEffectiveFriction(draggedBlock, block);

    // Move block based on friction (high friction = moves more with dragged block)
    // Sticky blocks move 100% with the dragged block
    const moveFactor = draggedBlock.sticky || block.sticky ? 1.0 : friction;

    const effectiveDx = dx * moveFactor;
    block.x += effectiveDx;
    block.y += dy;

    // Set velocity for inertia (when drag stops, block continues moving)
    if (dt > 0) {
      block.vx = effectiveDx / dt;
      block.vy = dy / dt;
    }

    // Recursively apply to blocks on top of this one
    applyDragFriction(block, allBlocks, effectiveDx, dy, dt, visited);
  }
}
