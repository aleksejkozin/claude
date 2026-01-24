// Test helpers for readable tests
// Provides placement functions and keyframe visualization

import { addBlock, startDrag, updateDrag, endDrag, step } from '../engine/world.js';
import fs from 'fs';

// Fill characters for different blocks
const FILL_CHARS = ['#', '@', '%', '&', '*', 'O', 'X', '+'];

// Small random offset to simulate human imprecision
function humanOffset() {
  return (Math.random() - 0.5) * 0.15; // ±0.075m (visible at 4 chars/meter)
}

// Simulate physics for settling
function settle(world, time = 0.2) {
  const dt = 1 / 60;
  const steps = Math.round(time / dt);
  for (let i = 0; i < steps; i++) {
    step(world, dt);
  }
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

  block.x = x + humanOffset();
  block.y = floorY;
  addBlock(world, block);
  settle(world);
  return block;
}

// Stack block on top of another block with slight imprecision
export function placeOn({ world, block, on }) {
  const base = on;
  block.x = base.x + (base.width - block.width) / 2 + humanOffset();
  block.y = base.y - block.height - 0.05; // slight drop
  addBlock(world, block);
  settle(world);
  return block;
}

// Place a static wall
export function placeWall({ world, block, at }) {
  block.isStatic = true;
  if (at === 'left') {
    block.x = 0;
  } else if (at === 'right') {
    block.x = world.width - block.width;
  }
  block.y = world.height - block.height;
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

export function simulate({ world, time }) {
  const dt = 1 / 60;
  const steps = Math.round(time / dt);
  for (let i = 0; i < steps; i++) {
    step(world, dt);
  }
}

// Collect keyframes during execution, update file at end
const pendingKeyframes = [];

export function keyframe(world) {
  const ascii = renderWorldASCII(world);

  // Print to console
  console.log('\n  KEYFRAME:');
  ascii.split('\n').forEach(line => console.log('  ' + line));
  console.log('');

  // Find caller file and line from stack trace
  const stack = new Error().stack;
  const callerLine = stack.split('\n')[2];
  const match = callerLine.match(/file:\/\/(.+):(\d+):\d+/);

  if (match) {
    const filePath = match[1];
    const lineNumber = parseInt(match[2], 10);
    pendingKeyframes.push({ filePath, lineNumber, ascii });
  }

  return ascii;
}

// Update all keyframes at process exit (bottom to top to preserve line numbers)
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    // Group by file
    const byFile = new Map();
    for (const kf of pendingKeyframes) {
      if (!byFile.has(kf.filePath)) byFile.set(kf.filePath, []);
      byFile.get(kf.filePath).push(kf);
    }

    // Update each file
    for (const [filePath, keyframes] of byFile) {
      // Sort by line number descending (bottom to top)
      keyframes.sort((a, b) => b.lineNumber - a.lineNumber);

      let content = fs.readFileSync(filePath, 'utf-8');
      let lines = content.split('\n');

      for (const { lineNumber, ascii } of keyframes) {
        lines = updateKeyframeAtLine(lines, lineNumber, ascii);
      }

      fs.writeFileSync(filePath, lines.join('\n'));
    }
  });
}

function updateKeyframeAtLine(lines, lineNumber, ascii) {
  // Line number is 1-based, array is 0-based
  const callLineIndex = lineNumber - 1;

  if (callLineIndex < 0 || callLineIndex >= lines.length) return lines;

  // Look for existing comment block after the call
  let commentStart = -1;
  let commentEnd = -1;

  for (let i = callLineIndex + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '') continue; // skip blank lines
    if (trimmed.startsWith('/*')) {
      commentStart = i;
      for (let j = i; j < lines.length; j++) {
        if (lines[j].includes('*/')) {
          commentEnd = j;
          break;
        }
      }
      break;
    }
    // Hit non-comment code, stop looking
    break;
  }

  // Get indentation from the keyframe call line
  const indent = lines[callLineIndex].match(/^\s*/)[0];

  // Build new comment
  const asciiLines = ascii.split('\n').map(line => indent + '   ' + line);
  const newComment = [
    indent + '/*',
    ...asciiLines,
    indent + '*/'
  ];

  if (commentStart !== -1 && commentEnd !== -1) {
    // Replace existing comment
    lines.splice(commentStart, commentEnd - commentStart + 1, ...newComment);
  } else {
    // Insert new comment after the keyframe call
    lines.splice(callLineIndex + 1, 0, ...newComment);
  }

  return lines;
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

  // Draw static blocks (walls) first
  for (const block of world.blocks.filter(b => b.isStatic)) {
    const left = Math.round(block.x * CHARS_PER_METER);
    const top = Math.round(block.y * CHARS_PER_METER);
    const blockWidth = Math.round(block.width * CHARS_PER_METER);
    const blockHeight = Math.round(block.height * CHARS_PER_METER);

    for (let dy = 0; dy < blockHeight; dy++) {
      for (let dx = 0; dx < blockWidth; dx++) {
        const gx = left + dx;
        const gy = top + dy;
        if (gx >= 0 && gx < width && gy >= 0 && gy < height - 1) {
          grid[gy][gx] = '|';
        }
      }
    }
  }

  // Draw dynamic blocks with fill character
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
