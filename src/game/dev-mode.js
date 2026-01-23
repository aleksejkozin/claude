// Dev Mode - procedural style
// Handles dev UI, block creation, and main game loop

import { createBlock } from '../engine/block.js';
import {
  createWorld,
  addBlock,
  removeBlock,
  getBlockAt,
  getBlockById,
  selectBlock,
  startDrag,
  updateDrag,
  endDrag,
  step,
  clearBlocks,
  exportWorldState,
  importTemplates,
} from '../engine/world.js';
import { createRenderer, drawWorld, PIXELS_PER_METER } from '../renderer/canvas.js';

let world;
let renderer;
let lastTime = 0;

// DOM elements
let canvas;
let controls;

export function init(canvasElement, controlsElement) {
  canvas = canvasElement;
  controls = controlsElement;

  // Create world in meters (canvas pixels / PIXELS_PER_METER)
  const worldWidth = canvas.width / PIXELS_PER_METER;
  const worldHeight = canvas.height / PIXELS_PER_METER;
  world = createWorld(worldWidth, worldHeight);
  renderer = createRenderer(canvas);

  // Setup event listeners
  setupCanvasEvents();
  setupControlEvents();

  // Start game loop
  requestAnimationFrame(gameLoop);
}

function setupCanvasEvents() {
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);

  // Touch events for mobile
  canvas.addEventListener('touchstart', onTouchStart);
  canvas.addEventListener('touchmove', onTouchMove);
  canvas.addEventListener('touchend', onTouchEnd);
}

// Convert pixel coordinates to meters
function toMeters(pixelX, pixelY) {
  return {
    x: pixelX / PIXELS_PER_METER,
    y: pixelY / PIXELS_PER_METER,
  };
}

function onMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const pos = toMeters(e.clientX - rect.left, e.clientY - rect.top);

  const block = getBlockAt(world, pos.x, pos.y);
  if (block) {
    selectBlock(world, block.id);
    startDrag(world, block.id, pos.x, pos.y);
    updateControlsFromBlock(block);
  } else {
    selectBlock(world, null);
  }
}

function onMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const pos = toMeters(e.clientX - rect.left, e.clientY - rect.top);
  const dt = 1 / 60; // Approximate frame time
  updateDrag(world, pos.x, pos.y, dt);
}

function onMouseUp() {
  endDrag(world);
}

function onTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const pos = toMeters(touch.clientX - rect.left, touch.clientY - rect.top);

  const block = getBlockAt(world, pos.x, pos.y);
  if (block) {
    selectBlock(world, block.id);
    startDrag(world, block.id, pos.x, pos.y);
    updateControlsFromBlock(block);
  }
}

function onTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const pos = toMeters(touch.clientX - rect.left, touch.clientY - rect.top);
  const dt = 1 / 60;
  updateDrag(world, pos.x, pos.y, dt);
}

function onTouchEnd() {
  endDrag(world);
}

function setupControlEvents() {
  controls.querySelector('#create-block').addEventListener('click', onCreateBlock);
  controls.querySelector('#delete-block').addEventListener('click', onDeleteBlock);
  controls.querySelector('#clear-all').addEventListener('click', onClearAll);
  controls.querySelector('#toggle-pause').addEventListener('click', onTogglePause);
  controls.querySelector('#export-json').addEventListener('click', onExportJSON);
  controls.querySelector('#import-json').addEventListener('click', onImportJSON);

  // Update selected block when inputs change
  const inputs = controls.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('change', onInputChange);
  });
}

function getFormValues() {
  return {
    width: parseFloat(controls.querySelector('#block-width').value) || 0.5,
    height: parseFloat(controls.querySelector('#block-height').value) || 0.5,
    mass: parseFloat(controls.querySelector('#block-mass').value) || 1,
    friction: parseFloat(controls.querySelector('#block-friction').value) || 0.5,
    bounciness: parseFloat(controls.querySelector('#block-bounciness').value) || 0.2,
  };
}

function setFormValues(values) {
  controls.querySelector('#block-width').value = values.width;
  controls.querySelector('#block-height').value = values.height;
  controls.querySelector('#block-mass').value = values.mass;
  controls.querySelector('#block-friction').value = values.friction;
  controls.querySelector('#block-bounciness').value = values.bounciness;
}

function updateControlsFromBlock(block) {
  setFormValues({
    width: block.width,
    height: block.height,
    mass: block.mass,
    friction: block.friction,
    bounciness: block.bounciness,
  });
}

function onCreateBlock() {
  const values = getFormValues();
  const block = createBlock({
    ...values,
    x: world.width / 2 - values.width / 2,
    y: 0.5, // Start near top
  });
  addBlock(world, block);
  selectBlock(world, block.id);
}

function onDeleteBlock() {
  if (world.selectedBlockId) {
    removeBlock(world, world.selectedBlockId);
  }
}

function onClearAll() {
  if (confirm('Clear all blocks?')) {
    clearBlocks(world);
  }
}

function onTogglePause() {
  world.paused = !world.paused;
  const btn = controls.querySelector('#toggle-pause');
  btn.textContent = world.paused ? 'Resume' : 'Pause';
}

function onExportJSON() {
  const json = exportWorldState(world);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'world-state.json';
  a.click();
  URL.revokeObjectURL(url);
}

function onImportJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const success = importTemplates(world, e.target.result);
        if (success) {
          alert('Imported successfully!');
        } else {
          alert('Failed to import.');
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
}

function onInputChange() {
  if (world.selectedBlockId) {
    const block = getBlockById(world, world.selectedBlockId);
    if (block) {
      const values = getFormValues();
      block.width = values.width;
      block.height = values.height;
      block.mass = values.mass;
      block.friction = values.friction;
      block.bounciness = values.bounciness;
    }
  }
}

function gameLoop(currentTime) {
  const dt = Math.min((currentTime - lastTime) / 1000, 0.05); // Cap at 50ms
  lastTime = currentTime;

  // Update physics
  step(world, dt);

  // Render
  drawWorld(renderer, world);

  requestAnimationFrame(gameLoop);
}

// Export for testing
export { world, renderer };
