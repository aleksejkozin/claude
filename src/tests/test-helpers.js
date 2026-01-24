// Test helpers for readable tests
// Provides placement functions and animated ASCII recordings

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

// Recording state
let currentRecording = null;

export function startRecording({ world, name }) {
  currentRecording = { name, world, frames: [] };
  captureFrame();
}

export function captureFrame() {
  if (!currentRecording) return;
  currentRecording.frames.push(renderWorldASCII(currentRecording.world));
}

export function stopRecording() {
  if (!currentRecording) return null;

  const { name, frames } = currentRecording;
  const path = `src/tests/recordings/${name}.txt`;

  let content = `Recording: ${name}\n`;
  content += `Frames: ${frames.length}\n\n`;

  for (let i = 0; i < frames.length; i++) {
    content += `--- Frame ${i + 1} ---\n`;
    content += frames[i] + '\n\n';
  }

  const dir = 'src/tests/recordings';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(path, content);
  console.log(`Recording saved: ${path} (${frames.length} frames)`);

  currentRecording = null;
  return path;
}

export function dragRight({ world, block, distance, over }) {
  const startX = block.x + block.width / 2;
  const startY = block.y + block.height / 2;

  startDrag(world, block.id, startX, startY);

  const dt = 1 / 60;
  const steps = Math.round(over / dt);
  const distancePerStep = distance / steps;
  const captureEvery = Math.max(1, Math.floor(steps / 20));

  for (let i = 0; i < steps; i++) {
    const targetX = startX + (i + 1) * distancePerStep;
    updateDrag(world, targetX, startY, dt);
    step(world, dt);

    if (currentRecording && i % captureEvery === 0) {
      captureFrame();
    }
  }

  endDrag(world);
  if (currentRecording) captureFrame();
}

export function dragLeft({ world, block, distance, over }) {
  dragRight({ world, block, distance: -distance, over });
}

export function simulate({ world, time }) {
  const dt = 1 / 60;
  const steps = Math.round(time / dt);
  const captureEvery = Math.max(1, Math.floor(steps / 20));

  for (let i = 0; i < steps; i++) {
    step(world, dt);
    if (currentRecording && i % captureEvery === 0) {
      captureFrame();
    }
  }
  if (currentRecording) captureFrame();
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
