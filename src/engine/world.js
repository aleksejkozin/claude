// World module - procedural style
// All units in meters (SI)

import { createBlock, blockToJSON, blockFromJSON, getBounds } from './block.js';
import {
  applyGravity,
  updatePosition,
  checkCollision,
  resolveCollision,
  applyDamping,
  constrainToWorld,
} from './physics.js';

export const COLLISION_ITERATIONS = 4;
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

  // Cache the stack at drag start - they move as a unit
  const stack = [block, ...findStackAbove(world, block)];
  // Store relative offsets from base block
  world.draggedStack = stack.map(b => ({
    block: b,
    offsetX: b.x - block.x,
    offsetY: b.y - block.y,
  }));

  block.isDragging = true;

  // Reset velocity for entire stack - they start fresh as a unit
  for (const b of stack) {
    b.vx = 0;
    b.vy = 0;
  }
}

const DRAG_STIFFNESS = 50;
const DRAG_DAMPING = 10;
const DRAG_MAX_FORCE = 100;

export function updateDrag(world, mouseX, mouseY, dt) {
  if (!world.draggedBlockId || !world.draggedStack) return;

  const block = getBlockById(world, world.draggedBlockId);
  if (!block) return;

  // Use cached stack from drag start - they move as a unit
  const stackEntries = world.draggedStack;
  const totalMass = stackEntries.reduce((sum, e) => sum + e.block.mass, 0);

  const targetX = mouseX - world.dragOffset.x;
  const targetY = mouseY - world.dragOffset.y;

  // Calculate force based on dragged block position
  let fx = (targetX - block.x) * DRAG_STIFFNESS - block.vx * DRAG_DAMPING;
  let fy = (targetY - block.y) * DRAG_STIFFNESS - block.vy * DRAG_DAMPING;

  const forceMag = Math.sqrt(fx * fx + fy * fy);
  if (forceMag > DRAG_MAX_FORCE) {
    fx = fx / forceMag * DRAG_MAX_FORCE;
    fy = fy / forceMag * DRAG_MAX_FORCE;
  }

  // Apply force to entire stack (F = ma, so a = F/m for total mass)
  const ax = fx / totalMass;
  const ay = fy / totalMass;

  for (const entry of stackEntries) {
    entry.block.vx += ax * entry.block.mass * dt;
    entry.block.vy += ay * entry.block.mass * dt;
  }
}

export function endDrag(world) {
  if (!world.draggedBlockId) return;

  const block = getBlockById(world, world.draggedBlockId);
  if (block) {
    block.isDragging = false;
  }

  world.draggedBlockId = null;
  world.draggedStack = null;
}

export function step(world, dt) {
  if (world.paused) return;

  const blocks = world.blocks;

  // Apply gravity
  blocks.forEach(block => {
    applyGravity(block, dt);
  });

  // Update positions
  blocks.forEach(block => {
    updatePosition(block, dt);
  });

  // Collision resolution (multiple iterations for stability)
  for (let iter = 0; iter < COLLISION_ITERATIONS; iter++) {
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const collision = checkCollision(blocks[i], blocks[j]);
        if (collision) {
          resolveCollision(blocks[i], blocks[j], collision, dt);
        }
      }
    }
  }

  // Constrain to world bounds
  blocks.forEach(block => {
    constrainToWorld(block, world.width, world.height);
  });

  // Restore relative positions in drag stack AFTER constraints (treat as rigid body)
  // This ensures the stack moves as a unit and stops together at boundaries
  if (world.draggedStack && world.draggedStack.length > 1) {
    const base = world.draggedStack[0].block;
    for (let i = 1; i < world.draggedStack.length; i++) {
      const entry = world.draggedStack[i];
      entry.block.x = base.x + entry.offsetX;
      entry.block.y = base.y + entry.offsetY;
      // Match base velocity (including any boundary bounce)
      entry.block.vx = base.vx;
      entry.block.vy = base.vy;
    }
  }

  // Apply damping
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

// Constrain a stack of blocks as a unit
function constrainStackToWorld(stack, worldWidth, worldHeight) {
  // Find the constraint violations for the bottom block
  const base = stack[0];
  const bounds = getBounds(base);

  // Right wall - stop entire stack
  if (bounds.right > worldWidth) {
    const correction = bounds.right - worldWidth;
    for (const block of stack) {
      block.x -= correction;
      if (block.vx > 0) {
        block.vx = -Math.abs(block.vx) * block.bounciness;
      }
    }
  }

  // Left wall - stop entire stack
  if (bounds.left < 0) {
    const correction = -bounds.left;
    for (const block of stack) {
      block.x += correction;
      if (block.vx < 0) {
        block.vx = Math.abs(block.vx) * block.bounciness;
      }
    }
  }

  // Apply individual vertical constraints
  for (const block of stack) {
    constrainToWorld(block, worldWidth, worldHeight);
  }
}

export function exportWorldState(world) {
  return JSON.stringify({
    width: world.width,
    height: world.height,
    blocks: world.blocks.filter(b => !b.isStatic).map(blockToJSON),
    blockTemplates: world.blockTemplates,
  }, null, 2);
}
