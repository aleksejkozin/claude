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
  exportTemplates,
  saveBlockTemplate
} from '../engine/world.js';
import { createRenderer, drawWorld, drawDevUI } from '../renderer/canvas.js';

let world;
let renderer;
let lastTime = 0;
let mouseX = 0;
let mouseY = 0;
let previewBlock = null;
let isRunning = true;

// DOM elements
let canvas;
let controls;

export function init(canvasElement, controlsElement) {
  canvas = canvasElement;
  controls = controlsElement;

  // Create world and renderer
  world = createWorld(canvas.width, canvas.height);
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

function onMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const block = getBlockAt(world, x, y);
  if (block) {
    selectBlock(world, block.id);
    startDrag(world, block.id, x, y);
    updateControlsFromBlock(block);
  } else {
    selectBlock(world, null);
  }
}

function onMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;

  updateDrag(world, mouseX, mouseY);
}

function onMouseUp(e) {
  endDrag(world);
}

function onTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  const block = getBlockAt(world, x, y);
  if (block) {
    selectBlock(world, block.id);
    startDrag(world, block.id, x, y);
    updateControlsFromBlock(block);
  }
}

function onTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  mouseX = touch.clientX - rect.left;
  mouseY = touch.clientY - rect.top;

  updateDrag(world, mouseX, mouseY);
}

function onTouchEnd(e) {
  endDrag(world);
}

function setupControlEvents() {
  // Create block button
  controls.querySelector('#create-block').addEventListener('click', onCreateBlock);

  // Delete block button
  controls.querySelector('#delete-block').addEventListener('click', onDeleteBlock);

  // Clear all button
  controls.querySelector('#clear-all').addEventListener('click', onClearAll);

  // Pause/Resume button
  controls.querySelector('#toggle-pause').addEventListener('click', onTogglePause);

  // Export JSON button
  controls.querySelector('#export-json').addEventListener('click', onExportJSON);

  // Import JSON button
  controls.querySelector('#import-json').addEventListener('click', onImportJSON);

  // Save as template button
  controls.querySelector('#save-template').addEventListener('click', onSaveTemplate);

  // Update selected block when inputs change
  const inputs = controls.querySelectorAll('input, select');
  inputs.forEach(input => {
    input.addEventListener('change', onInputChange);
  });
}

function getFormValues() {
  return {
    width: parseFloat(controls.querySelector('#block-width').value) || 50,
    height: parseFloat(controls.querySelector('#block-height').value) || 50,
    mass: parseFloat(controls.querySelector('#block-mass').value) || 1,
    friction: parseFloat(controls.querySelector('#block-friction').value) || 0.5,
    bounciness: parseFloat(controls.querySelector('#block-bounciness').value) || 0.2,
    sticky: controls.querySelector('#block-sticky').checked,
    slippery: controls.querySelector('#block-slippery').checked,
    shape: controls.querySelector('#block-shape').value,
  };
}

function setFormValues(values) {
  controls.querySelector('#block-width').value = values.width;
  controls.querySelector('#block-height').value = values.height;
  controls.querySelector('#block-mass').value = values.mass;
  controls.querySelector('#block-friction').value = values.friction;
  controls.querySelector('#block-bounciness').value = values.bounciness;
  controls.querySelector('#block-sticky').checked = values.sticky;
  controls.querySelector('#block-slippery').checked = values.slippery;
  controls.querySelector('#block-shape').value = values.shape;
}

function updateControlsFromBlock(block) {
  setFormValues({
    width: block.width,
    height: block.height,
    mass: block.mass,
    friction: block.friction,
    bounciness: block.bounciness,
    sticky: block.sticky,
    slippery: block.slippery,
    shape: block.shape,
  });
}

function onCreateBlock() {
  const values = getFormValues();
  const block = createBlock({
    ...values,
    x: world.width / 2 - values.width / 2,
    y: 50,
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
  a.download = 'tower-blocks.json';
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
          alert('Templates imported successfully!');
        } else {
          alert('Failed to import templates.');
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
}

function onSaveTemplate() {
  if (world.selectedBlockId) {
    const block = getBlockById(world, world.selectedBlockId);
    if (block) {
      saveBlockTemplate(world, block);
      alert('Block saved as template!');
    }
  } else {
    // Save current form values as template
    const values = getFormValues();
    const tempBlock = createBlock(values);
    saveBlockTemplate(world, tempBlock);
    alert('Current settings saved as template!');
  }
}

function onInputChange() {
  // Update selected block with new values
  if (world.selectedBlockId) {
    const block = getBlockById(world, world.selectedBlockId);
    if (block) {
      const values = getFormValues();
      block.width = values.width;
      block.height = values.height;
      block.mass = values.mass;
      block.friction = values.friction;
      block.bounciness = values.bounciness;
      block.sticky = values.sticky;
      block.slippery = values.slippery;
      block.shape = values.shape;
    }
  }

  // Update preview block
  previewBlock = createBlock(getFormValues());
}

function gameLoop(currentTime) {
  const dt = Math.min((currentTime - lastTime) / 1000, 0.05); // Cap at 50ms
  lastTime = currentTime;

  // Update physics
  step(world, dt);

  // Render
  drawWorld(renderer, world);

  // Draw dev UI overlay
  if (!world.draggedBlockId) {
    drawDevUI(renderer, mouseX, mouseY, previewBlock);
  }

  requestAnimationFrame(gameLoop);
}

// Export for testing
export { world, renderer };
