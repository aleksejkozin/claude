// World module - procedural style
// All units in meters (SI)

import { createBlock, blockToJSON, blockFromJSON, getBounds } from './block.js';
import {
  applyGravity,
  updatePosition,
  detectAllContacts,
  solveVelocityConstraints,
  solvePositionConstraints,
  applyDamping,
  constrainToWorld,
  // Legacy API for backward compatibility
  checkCollision,
  resolveCollision,
} from './physics.js';

const CONTACT_TOLERANCE = 0.05; // meters - how close blocks must be to count as "in contact"

export function createWorld(width, height) {
  return {
    width,
    height,
    blocks: [],
    blockTemplates: [],
    selectedBlockId: null,
    draggedBlockId: null,
    dragOffset: { x: 0, y: 0 },
    paused: false,
  };
}

export function addBlock(world, block) {
  world.blocks.push(block);
  return block;
}

export function removeBlock(world, blockId) {
  const index = world.blocks.findIndex(b => b.id === blockId);
  if (index !== -1) {
    world.blocks.splice(index, 1);
    if (world.selectedBlockId === blockId) {
      world.selectedBlockId = null;
    }
    if (world.draggedBlockId === blockId) {
      world.draggedBlockId = null;
    }
  }
}

export function getBlockById(world, blockId) {
  return world.blocks.find(b => b.id === blockId);
}

export function getBlockAt(world, x, y) {
  // Return topmost block at position (reverse order)
  for (let i = world.blocks.length - 1; i >= 0; i--) {
    const block = world.blocks[i];
    if (
      x >= block.x &&
      x <= block.x + block.width &&
      y >= block.y &&
      y <= block.y + block.height
    ) {
      return block;
    }
  }
  return null;
}

export function selectBlock(world, blockId) {
  world.selectedBlockId = blockId;
}

export function startDrag(world, blockId, mouseX, mouseY) {
  const block = getBlockById(world, blockId);
  if (!block || block.isStatic) return;

  world.draggedBlockId = blockId;
  world.dragOffset = {
    x: mouseX - block.x,
    y: mouseY - block.y,
  };

  block.isDragging = true;
  block.vx = 0;
  block.vy = 0;
}

const DRAG_STIFFNESS = 50;
const DRAG_DAMPING = 10;
const DRAG_MAX_FORCE = 100;

export function updateDrag(world, mouseX, mouseY, dt) {
  if (!world.draggedBlockId) return;

  const block = getBlockById(world, world.draggedBlockId);
  if (!block) return;

  const targetX = mouseX - world.dragOffset.x;
  const targetY = mouseY - world.dragOffset.y;

  // Spring force toward mouse position
  let fx = (targetX - block.x) * DRAG_STIFFNESS - block.vx * DRAG_DAMPING;
  let fy = (targetY - block.y) * DRAG_STIFFNESS - block.vy * DRAG_DAMPING;

  // Clamp force magnitude
  const forceMag = Math.sqrt(fx * fx + fy * fy);
  if (forceMag > DRAG_MAX_FORCE) {
    fx = fx / forceMag * DRAG_MAX_FORCE;
    fy = fy / forceMag * DRAG_MAX_FORCE;
  }

  // Apply force only to dragged block
  // The constraint solver will propagate to stacked blocks via friction
  block.vx += fx / block.mass * dt;
  block.vy += fy / block.mass * dt;
}

export function endDrag(world) {
  if (!world.draggedBlockId) return;

  const block = getBlockById(world, world.draggedBlockId);
  if (block) {
    block.isDragging = false;
  }

  world.draggedBlockId = null;
}

export function step(world, dt) {
  if (world.paused) return;

  const blocks = world.blocks;

  // 1. Apply gravity
  blocks.forEach(block => {
    applyGravity(block, dt);
  });

  // 2. Update positions (integrate velocities)
  blocks.forEach(block => {
    updatePosition(block, dt);
  });

  // 3. Detect all contacts
  const contacts = detectAllContacts(blocks);

  // 4. Solve velocity constraints (sequential impulses)
  // This propagates impulses through the contact graph
  solveVelocityConstraints(contacts);

  // 5. Solve position constraints (fix penetration)
  solvePositionConstraints(contacts);

  // 6. Constrain to world bounds
  blocks.forEach(block => {
    constrainToWorld(block, world.width, world.height);
  });

  // 7. Apply damping
  blocks.forEach(block => {
    applyDamping(block);
  });
}

export function clearBlocks(world) {
  world.blocks = [];
  world.selectedBlockId = null;
  world.draggedBlockId = null;
}

export function saveBlockTemplate(world, block) {
  const template = blockToJSON(block);
  world.blockTemplates.push(template);
  return template;
}

export function exportTemplates(world) {
  return JSON.stringify(world.blockTemplates, null, 2);
}

export function importTemplates(world, jsonString) {
  try {
    const templates = JSON.parse(jsonString);
    if (Array.isArray(templates)) {
      world.blockTemplates = templates;
      return true;
    }
  } catch (e) {
    console.error('Failed to import templates:', e);
  }
  return false;
}

export function spawnFromTemplate(world, templateIndex, x, y) {
  if (templateIndex < 0 || templateIndex >= world.blockTemplates.length) {
    return null;
  }
  const block = blockFromJSON(world.blockTemplates[templateIndex], x, y);
  addBlock(world, block);
  return block;
}

export function isBlockAbove(upper, lower) {
  const upperBounds = getBounds(upper);
  const lowerBounds = getBounds(lower);

  const verticalContact = Math.abs(upperBounds.bottom - lowerBounds.top) < CONTACT_TOLERANCE;
  const horizontalOverlap = upperBounds.right > lowerBounds.left && upperBounds.left < lowerBounds.right;

  return verticalContact && horizontalOverlap;
}

export function findBlocksDirectlyAbove(world, block) {
  return world.blocks.filter(other =>
    other.id !== block.id &&
    !other.isStatic &&
    isBlockAbove(other, block)
  );
}

export function findStackAbove(world, block, visited = new Set()) {
  if (visited.has(block.id)) return [];
  visited.add(block.id);

  const directlyAbove = findBlocksDirectlyAbove(world, block);
  const stack = [...directlyAbove];

  for (const above of directlyAbove) {
    stack.push(...findStackAbove(world, above, visited));
  }

  return stack;
}

export function exportWorldState(world) {
  return JSON.stringify({
    width: world.width,
    height: world.height,
    blocks: world.blocks.filter(b => !b.isStatic).map(blockToJSON),
    blockTemplates: world.blockTemplates,
  }, null, 2);
}

// Re-export for backward compatibility with tests
export { checkCollision, resolveCollision };
