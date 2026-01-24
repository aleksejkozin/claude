// Test helpers for readable tests
// Provides placement functions and keyframe visualization

import { addBlock, startDrag, updateDrag, endDrag, step } from '../engine/world.js';
import fs from 'fs';

// Fill characters for different blocks
const FILL_CHARS = ['#', '@', '%', '&', '*', 'O', 'X', '+'];

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

// Capture keyframe and update source file directly
export function keyframe(world) {
  const ascii = renderWorldASCII(world);

  // Print to console
  console.log('\n  KEYFRAME:');
  ascii.split('\n').forEach(line => console.log('  ' + line));
  console.log('');

  // Find caller location from stack trace
  const stack = new Error().stack;
  const callerLine = stack.split('\n')[2]; // [0]=Error, [1]=keyframe, [2]=caller
  const match = callerLine.match(/file:\/\/(.+):(\d+):\d+/);

  if (match) {
    const filePath = match[1];
    const lineNumber = parseInt(match[2], 10);
    updateKeyframeAtLine(filePath, lineNumber, ascii);
  }

  return ascii;
}

// Update the KEYFRAME comment following the given line
function updateKeyframeAtLine(filePath, lineNumber, ascii) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Find the KEYFRAME comment after the keyframe() call
  let keyframeStart = -1;
  let keyframeEnd = -1;

  for (let i = lineNumber; i < lines.length; i++) {
    if (lines[i].includes('/* KEYFRAME')) {
      keyframeStart = i;
      // Find closing */
      for (let j = i; j < lines.length; j++) {
        if (lines[j].includes('*/')) {
          keyframeEnd = j;
          break;
        }
      }
      break;
    }
    // Stop if we hit another statement (not whitespace or comment)
    if (lines[i].trim() && !lines[i].trim().startsWith('//') && !lines[i].trim().startsWith('/*')) {
      break;
    }
  }

  if (keyframeStart === -1 || keyframeEnd === -1) {
    return; // No keyframe comment found
  }

  // Get indentation from the keyframe line
  const indent = lines[keyframeStart].match(/^\s*/)[0];

  // Build new keyframe comment
  const asciiLines = ascii.split('\n').map(line => indent + '     ' + line);
  const newKeyframe = [
    indent + '/* KEYFRAME',
    ...asciiLines,
    indent + '*/'
  ];

  // Replace the old keyframe
  lines.splice(keyframeStart, keyframeEnd - keyframeStart + 1, ...newKeyframe);

  fs.writeFileSync(filePath, lines.join('\n'));
}

// Render world state as ASCII art
function renderWorldASCII(world) {
  const CHARS_PER_METER = 4;
  const width = Math.round(world.width * CHARS_PER_METER);
  const height = Math.round(world.height * CHARS_PER_METER) + 1;

  // Create empty grid
  const grid = [];
  for (let y = 0; y < height; y++) {
    grid.push(new Array(width).fill(' '));
  }

  // Draw floor
  for (let x = 0; x < width; x++) {
    grid[height - 1][x] = '=';
  }

  // Draw each block with fill character
  const dynamicBlocks = world.blocks.filter(b => !b.isStatic);

  for (let blockIndex = 0; blockIndex < dynamicBlocks.length; blockIndex++) {
    const block = dynamicBlocks[blockIndex];
    const fillChar = FILL_CHARS[blockIndex % FILL_CHARS.length];

    const left = Math.round(block.x * CHARS_PER_METER);
    const top = Math.round(block.y * CHARS_PER_METER);
    const blockWidth = Math.round(block.width * CHARS_PER_METER);
    const blockHeight = Math.round(block.height * CHARS_PER_METER);

    // Fill the block area
    for (let dy = 0; dy < blockHeight; dy++) {
      for (let dx = 0; dx < blockWidth; dx++) {
        const gx = left + dx;
        const gy = top + dy;
        if (gx >= 0 && gx < width && gy >= 0 && gy < height - 1) {
          grid[gy][gx] = fillChar;
        }
      }
    }
  }

  // Convert grid to string, trim empty rows from top
  let lines = grid.map(row => row.join(''));

  // Remove leading empty rows (all spaces)
  while (lines.length > 1 && /^ +$/.test(lines[0])) {
    lines.shift();
  }

  return lines.join('\n');
}
