// Test helpers for readable tests
// Provides placement functions and keyframe visualization

import { addBlock, startDrag, updateDrag, endDrag, step } from '../engine/world.js';

// Store keyframes during test execution
const keyframeCaptures = [];
let currentTestFile = null;

export function setTestFile(filePath) {
  currentTestFile = filePath;
  keyframeCaptures.length = 0;
}

export function getKeyframeCaptures() {
  return keyframeCaptures;
}

// Place block on floor at horizontal position
// at: 'left' | 'center' | 'right' | number (0-1 as fraction of world width)
export function placeOnFloor({ world, block, at }) {
  const floorY = world.height - block.height;

  let x;
  if (at === 'left') {
    x = 0;
  } else if (at === 'center') {
    x = (world.width - block.width) / 2;
  } else if (at === 'right') {
    x = world.width - block.width;
  } else if (typeof at === 'number') {
    x = at * (world.width - block.width);
  } else {
    throw new Error(`Invalid 'at' value: ${at}`);
  }

  block.x = x;
  block.y = floorY;
  addBlock(world, block);
  return block;
}

// Stack block on top of another block (centered)
export function placeOn({ block, on }) {
  const base = on;
  block.x = base.x + (base.width - block.width) / 2;
  block.y = base.y - block.height;

  // Find world from base block's context - base must already be in a world
  // We need to add block to the same world
  return block;
}

// Place block on top and add to world
export function placeOnAndAdd({ world, block, on }) {
  placeOn({ block, on });
  addBlock(world, block);
  return block;
}

// Drag block horizontally
export function dragRight({ world, block, distance, over }) {
  const startX = block.x + block.width / 2;
  const startY = block.y + block.height / 2;

  startDrag(world, block.id, startX, startY);

  const dt = 1 / 60;
  const steps = Math.round(over / dt);
  const distancePerStep = distance / steps;

  for (let i = 0; i < steps; i++) {
    const targetX = startX + (i + 1) * distancePerStep;
    updateDrag(world, targetX, startY, dt);
    step(world, dt);
  }

  endDrag(world);
}

export function dragLeft({ world, block, distance, over }) {
  dragRight({ world, block, distance: -distance, over });
}

// Simulate physics for a duration
export function simulate({ world, time }) {
  const dt = 1 / 60;
  const steps = Math.round(time / dt);
  for (let i = 0; i < steps; i++) {
    step(world, dt);
  }
}

// Capture keyframe for visualization
// Renders ASCII art of current world state
export function keyframe(world) {
  const ascii = renderWorldASCII(world);
  keyframeCaptures.push({
    index: keyframeCaptures.length + 1,
    ascii,
  });
  return ascii;
}

// Render world state as ASCII art
function renderWorldASCII(world) {
  // Config: 2 chars per 0.5 meters (so 4 chars per meter)
  const CHARS_PER_METER = 4;
  const width = Math.round(world.width * CHARS_PER_METER);
  const height = Math.round(world.height * CHARS_PER_METER) + 1; // +1 for floor

  // Create empty grid
  const grid = [];
  for (let y = 0; y < height; y++) {
    grid.push(new Array(width).fill('.'));
  }

  // Draw floor
  for (let x = 0; x < width; x++) {
    grid[height - 1][x] = '=';
  }

  // Draw each block
  for (const block of world.blocks) {
    if (block.isStatic) continue;

    const left = Math.round(block.x * CHARS_PER_METER);
    const top = Math.round(block.y * CHARS_PER_METER);
    const blockWidth = Math.max(block.id.length + 2, Math.round(block.width * CHARS_PER_METER));
    const blockHeight = Math.round(block.height * CHARS_PER_METER);

    // Determine velocity indicator
    let velocityChar = '';
    if (Math.abs(block.vx) > 0.1 || Math.abs(block.vy) > 0.1) {
      if (Math.abs(block.vx) > Math.abs(block.vy)) {
        velocityChar = block.vx > 0 ? '→' : '←';
      } else {
        velocityChar = block.vy > 0 ? '↓' : '↑';
      }
    }

    // Draw block label with brackets and velocity
    const label = `[${block.id}]${velocityChar}`;
    const labelRow = top;

    for (let i = 0; i < label.length && left + i < width; i++) {
      if (left + i >= 0 && labelRow >= 0 && labelRow < height - 1) {
        grid[labelRow][left + i] = label[i];
      }
    }
  }

  // Convert grid to string
  const lines = grid.map(row => row.join(''));

  // Trim trailing dots but keep structure
  return lines.join('\n');
}

// Update test file with captured keyframes
export function updateTestFileWithKeyframes(filePath, keyframes) {
  // This is meant to be called by the test runner after execution
  // It reads the file, finds KEYFRAME comments, and updates them

  // For browser environment, we'll just log the keyframes
  // For Node.js, we can actually update the file

  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return updateTestFileNode(filePath, keyframes);
  } else {
    console.log('Keyframes captured (browser mode - manual update needed):');
    keyframes.forEach(kf => {
      console.log(`KEYFRAME:${kf.index}`);
      console.log(kf.ascii);
      console.log('');
    });
    return false;
  }
}

async function updateTestFileNode(filePath, keyframes) {
  const fs = await import('fs');
  const path = await import('path');

  let content = fs.readFileSync(filePath, 'utf-8');

  // Find and replace each KEYFRAME comment
  let keyframeIndex = 0;
  content = content.replace(
    /\/\* KEYFRAME(?::\d+)?\s*\n[\s\S]*?\*\//g,
    (match) => {
      if (keyframeIndex < keyframes.length) {
        const kf = keyframes[keyframeIndex++];
        const indentedAscii = kf.ascii.split('\n').map(line => '     ' + line).join('\n');
        return `/* KEYFRAME:${kf.index}\n${indentedAscii}\n  */`;
      }
      return match;
    }
  );

  fs.writeFileSync(filePath, content);
  return true;
}
