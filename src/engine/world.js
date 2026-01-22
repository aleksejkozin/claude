// World module - procedural style
// Manages world state and simulation loop

import { createBlock, blockToJSON, blockFromJSON } from './block.js';
import {
  applyGravity,
  updatePosition,
  checkCollision,
  resolveCollision,
  applyDamping,
  constrainToWorld,
  applyDragFriction
} from './physics.js';

export function createWorld(width, height) {
  return {
    width,
    height,
    blocks: [],
    blockTemplates: [], // saved block configurations
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
    // Clean up stuckTo references
    world.blocks.forEach(b => {
      b.stuckTo = b.stuckTo.filter(id => id !== blockId);
    });
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
  // Return topmost block at position (reverse order since later blocks are on top)
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

export function updateDrag(world, mouseX, mouseY) {
  if (!world.draggedBlockId) return;

  const block = getBlockById(world, world.draggedBlockId);
  if (!block) return;

  const newX = mouseX - world.dragOffset.x;
  const newY = mouseY - world.dragOffset.y;
  const dx = newX - block.x;
  const dy = newY - block.y;

  block.x = newX;
  block.y = newY;

  // Apply friction to blocks resting on top
  applyDragFriction(block, world.blocks, dx, dy);
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

  // Apply gravity to all blocks
  blocks.forEach(block => {
    applyGravity(block, dt);
  });

  // Update positions
  blocks.forEach(block => {
    updatePosition(block, dt);
  });

  // Check and resolve collisions (multiple iterations for stability)
  const iterations = 4;
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const collision = checkCollision(blocks[i], blocks[j]);
        if (collision) {
          resolveCollision(blocks[i], blocks[j], collision);
        }
      }
    }
  }

  // Constrain to world bounds
  blocks.forEach(block => {
    constrainToWorld(block, world.width, world.height);
  });

  // Apply damping
  blocks.forEach(block => {
    applyDamping(block);
  });
}

export function getTowerHeight(world) {
  if (world.blocks.length === 0) return 0;

  let minY = world.height;
  world.blocks.forEach(block => {
    if (!block.isStatic && block.y < minY) {
      minY = block.y;
    }
  });

  return world.height - minY;
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

export function exportWorldState(world) {
  return JSON.stringify({
    width: world.width,
    height: world.height,
    blocks: world.blocks.filter(b => !b.isStatic).map(blockToJSON),
    blockTemplates: world.blockTemplates,
  }, null, 2);
}
