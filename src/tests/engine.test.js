import {
  test,
  assertEqual,
  assertApprox,
  assertTrue,
  assertFalse,
  assertNotNull,
  assertNull,
  assertStacked,
  assertNoHorizontalSlip,
  assertFollowedHorizontally,
  assertMovedRight,
  assertBounced,
  assertSettled,
  assertNoOverlap,
} from './test-runner.js';

import {
  placeOnFloor,
  placeOn,
  dragRight,
  simulate,
  keyframe,
} from './test-helpers.js';

import {
  createBlock,
  resetIdCounter,
  setPosition,
  setVelocity,
  getEffectiveFriction,
  getEffectiveBounciness,
  getBounds,
  getCenter,
  blockToJSON,
  blockFromJSON,
} from '../engine/block.js';

import {
  applyGravity,
  updatePosition,
  checkCollision,
  resolveCollision,
  applyDamping,
  constrainToWorld,
  GRAVITY,
} from '../engine/physics.js';

import {
  createWorld,
  addBlock,
  removeBlock,
  getBlockById,
  getBlockAt,
  selectBlock,
  startDrag,
  updateDrag,
  endDrag,
  step,
  clearBlocks,
  isBlockAbove,
  findBlocksDirectlyAbove,
  findStackAbove,
} from '../engine/world.js';

test('createBlock creates block with default values', () => {
  resetIdCounter();
  const block = createBlock();
  assertNotNull(block.id);
  assertEqual(block.x, 0);
  assertEqual(block.y, 0);
  assertApprox(block.width, 0.5, 0.01);
  assertApprox(block.height, 0.5, 0.01);
  assertEqual(block.mass, 1);
  assertApprox(block.friction, 0.5, 0.01);
  assertApprox(block.bounciness, 0.2, 0.01);
});

test('createBlock accepts custom options', () => {
  const block = createBlock({
    x: 1,
    y: 2,
    width: 0.8,
    height: 0.4,
    mass: 2.5,
    friction: 0.7,
  });
  assertEqual(block.x, 1);
  assertEqual(block.y, 2);
  assertApprox(block.width, 0.8, 0.01);
  assertApprox(block.height, 0.4, 0.01);
  assertEqual(block.mass, 2.5);
  assertApprox(block.friction, 0.7, 0.01);
});

test('setPosition updates block position', () => {
  const block = createBlock();
  setPosition(block, 0.5, 0.75);
  assertApprox(block.x, 0.5, 0.01);
  assertApprox(block.y, 0.75, 0.01);
});

test('setVelocity updates block velocity', () => {
  const block = createBlock();
  setVelocity(block, 10, -5);
  assertEqual(block.vx, 10);
  assertEqual(block.vy, -5);
});

test('getEffectiveFriction averages friction values', () => {
  const block1 = createBlock({ friction: 0.4 });
  const block2 = createBlock({ friction: 0.6 });
  assertApprox(getEffectiveFriction(block1, block2), 0.5, 0.01);
});

test('getEffectiveBounciness averages bounciness values', () => {
  const block1 = createBlock({ bounciness: 0.2 });
  const block2 = createBlock({ bounciness: 0.8 });
  assertApprox(getEffectiveBounciness(block1, block2), 0.5, 0.01);
});

test('getBounds returns correct boundaries', () => {
  const block = createBlock({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
  const bounds = getBounds(block);
  assertApprox(bounds.left, 0.1, 0.01);
  assertApprox(bounds.right, 0.4, 0.01);
  assertApprox(bounds.top, 0.2, 0.01);
  assertApprox(bounds.bottom, 0.6, 0.01);
});

test('getCenter returns center point', () => {
  const block = createBlock({ x: 0, y: 0, width: 1, height: 0.5 });
  const center = getCenter(block);
  assertApprox(center.x, 0.5, 0.01);
  assertApprox(center.y, 0.25, 0.01);
});

test('blockToJSON exports configurable properties', () => {
  const block = createBlock({ x: 1, y: 2, width: 0.6, mass: 3 });
  const json = blockToJSON(block);
  assertApprox(json.width, 0.6, 0.01);
  assertEqual(json.mass, 3);
  assertEqual(json.x, 1);
  assertEqual(json.y, 2);
});

test('blockFromJSON creates block from JSON', () => {
  const json = { width: 0.8, height: 0.3, mass: 2 };
  const block = blockFromJSON(json, 1, 2);
  assertApprox(block.width, 0.8, 0.01);
  assertApprox(block.height, 0.3, 0.01);
  assertEqual(block.mass, 2);
  assertEqual(block.x, 1);
  assertEqual(block.y, 2);
});

test('applyGravity increases downward velocity', () => {
  const block = createBlock();
  applyGravity(block, 0.1);
  assertApprox(block.vy, GRAVITY * 0.1, 0.01);
});

test('applyGravity does nothing to static blocks', () => {
  const block = createBlock({ isStatic: true });
  applyGravity(block, 0.1);
  assertEqual(block.vy, 0);
});

test('applyGravity affects dragging blocks (spring counters it)', () => {
  const block = createBlock();
  block.isDragging = true;
  applyGravity(block, 0.1);
  assertApprox(block.vy, GRAVITY * 0.1, 0.01);
});

test('updatePosition moves block by velocity', () => {
  const block = createBlock({ vx: 1, vy: 0.5 });
  updatePosition(block, 0.1);
  assertApprox(block.x, 0.1, 0.01);
  assertApprox(block.y, 0.05, 0.01);
});

test('checkCollision returns null for non-overlapping blocks', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 0.5, height: 0.5 });
  const block2 = createBlock({ x: 1, y: 1, width: 0.5, height: 0.5 });
  assertNull(checkCollision(block1, block2));
});

test('checkCollision detects overlapping blocks', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 0.5, height: 0.5 });
  const block2 = createBlock({ x: 0.4, y: 0, width: 0.5, height: 0.5 });
  const collision = checkCollision(block1, block2);
  assertNotNull(collision);
  assertTrue(collision.overlapX > 0);
  assertTrue(collision.overlapY > 0);
});

test('checkCollision returns correct direction for horizontal collision', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 0.5, height: 0.5 });
  const block2 = createBlock({ x: 0.45, y: 0, width: 0.5, height: 0.5 });
  const collision = checkCollision(block1, block2);
  assertNotNull(collision);
  assertEqual(collision.dirX, -1); // block1 is left of block2
});

test('checkCollision returns correct direction for vertical collision', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 0.5, height: 0.5 });
  const block2 = createBlock({ x: 0, y: 0.45, width: 0.5, height: 0.5 });
  const collision = checkCollision(block1, block2);
  assertNotNull(collision);
  assertEqual(collision.dirY, -1); // block1 is above block2
});

test('applyDamping reduces velocity', () => {
  const block = createBlock({ vx: 1, vy: 1 });
  applyDamping(block);
  assertTrue(block.vx < 1);
  assertTrue(block.vy < 1);
});

test('applyDamping applies sleep threshold', () => {
  const block = createBlock({ vx: 0.0001, vy: 0.0001 });
  applyDamping(block);
  assertEqual(block.vx, 0);
  assertEqual(block.vy, 0);
});

test('constrainToWorld keeps block inside bounds', () => {
  const block = createBlock({ x: -0.1, y: 0, width: 0.5, height: 0.5 });
  constrainToWorld(block, 4, 6);
  assertEqual(block.x, 0);
});

test('constrainToWorld bounces block off floor', () => {
  const block = createBlock({ x: 0, y: 5.8, width: 0.5, height: 0.5, vy: 1, bounciness: 0.5 });
  constrainToWorld(block, 4, 6);
  assertApprox(block.y, 5.5, 0.01);
  assertBounced(block);
});

test('createWorld initializes empty world', () => {
  const world = createWorld(4, 6);
  assertEqual(world.width, 4);
  assertEqual(world.height, 6);
  assertEqual(world.blocks.length, 0);
  assertNull(world.selectedBlockId);
});

test('addBlock adds block to world', () => {
  const world = createWorld(4, 6);
  const block = createBlock();
  addBlock(world, block);
  assertEqual(world.blocks.length, 1);
  assertEqual(world.blocks[0], block);
});

test('removeBlock removes block from world', () => {
  const world = createWorld(4, 6);
  const block = createBlock();
  addBlock(world, block);
  removeBlock(world, block.id);
  assertEqual(world.blocks.length, 0);
});

test('getBlockById finds block by id', () => {
  const world = createWorld(4, 6);
  const block = createBlock();
  addBlock(world, block);
  const found = getBlockById(world, block.id);
  assertEqual(found, block);
});

test('getBlockAt finds block at coordinates', () => {
  const world = createWorld(4, 6);
  const block = createBlock({ x: 1, y: 1, width: 0.5, height: 0.5 });
  addBlock(world, block);
  const found = getBlockAt(world, 1.25, 1.25);
  assertEqual(found, block);
});

test('getBlockAt returns null for empty space', () => {
  const world = createWorld(4, 6);
  const block = createBlock({ x: 1, y: 1, width: 0.5, height: 0.5 });
  addBlock(world, block);
  const found = getBlockAt(world, 2, 2);
  assertNull(found);
});

test('selectBlock sets selected block id', () => {
  const world = createWorld(4, 6);
  const block = createBlock();
  addBlock(world, block);
  selectBlock(world, block.id);
  assertEqual(world.selectedBlockId, block.id);
});

test('startDrag begins dragging block', () => {
  const world = createWorld(4, 6);
  const block = createBlock({ x: 1, y: 1 });
  addBlock(world, block);
  startDrag(world, block.id, 1.1, 1.1);
  assertEqual(world.draggedBlockId, block.id);
  assertTrue(block.isDragging);
});

test('updateDrag applies spring force toward mouse', () => {
  const world = createWorld(4, 6);
  const block = createBlock({ x: 1, y: 1, width: 0.5, height: 0.5 });
  addBlock(world, block);
  startDrag(world, block.id, 1.25, 1.25);
  updateDrag(world, 2.25, 1.25, 0.016);
  assertTrue(block.vx > 0);
});

test('updateDrag spring force is limited', () => {
  const world = createWorld(4, 6);
  const block = createBlock({ x: 1, y: 1, width: 0.5, height: 0.5 });
  addBlock(world, block);
  startDrag(world, block.id, 1.25, 1.25);
  updateDrag(world, 100, 1.25, 0.016);
  assertTrue(block.vx < 10);
});

test('endDrag stops dragging', () => {
  const world = createWorld(4, 6);
  const block = createBlock({ x: 1, y: 1 });
  addBlock(world, block);
  startDrag(world, block.id, 1.1, 1.1);
  endDrag(world);
  assertNull(world.draggedBlockId);
  assertFalse(block.isDragging);
});

test('clearBlocks removes all blocks', () => {
  const world = createWorld(4, 6);
  addBlock(world, createBlock());
  addBlock(world, createBlock());
  clearBlocks(world);
  assertEqual(world.blocks.length, 0);
});

test('step updates physics for all blocks', () => {
  const world = createWorld(4, 6);
  const block = createBlock({ x: 1, y: 1, vx: 1 });
  addBlock(world, block);
  step(world, 0.1);
  assertTrue(block.x > 1);
  assertTrue(block.vy > 0);
});

test('step does nothing when paused', () => {
  const world = createWorld(4, 6);
  world.paused = true;
  const block = createBlock({ x: 1, y: 1, vx: 1 });
  addBlock(world, block);
  step(world, 0.1);
  assertEqual(block.x, 1);
  assertEqual(block.vy, 0);
});

test('resolveCollision separates overlapping blocks', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 0.5, height: 0.5 });
  const block2 = createBlock({ x: 0.4, y: 0, width: 0.5, height: 0.5 });
  const collision = checkCollision(block1, block2);
  resolveCollision(block1, block2, collision);
  assertNoOverlap(block1, block2);
});

test('resolveCollision transfers momentum on impact', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 0.5, height: 0.5, vx: 5 });
  const block2 = createBlock({ x: 0.4, y: 0, width: 0.5, height: 0.5, vx: 0 });
  const collision = checkCollision(block1, block2);
  resolveCollision(block1, block2, collision);
  assertTrue(block1.vx < 5);
  assertTrue(block2.vx > 0);
});

test('resolveCollision does not move static blocks', () => {
  const staticBlock = createBlock({ x: 0, y: 0, width: 0.5, height: 0.5, isStatic: true });
  const dynamicBlock = createBlock({ x: 0.4, y: 0, width: 0.5, height: 0.5 });
  const collision = checkCollision(staticBlock, dynamicBlock);
  resolveCollision(staticBlock, dynamicBlock, collision);
  assertNoHorizontalSlip(staticBlock, 0);
  assertApprox(staticBlock.y, 0, 0.01);
  assertTrue(dynamicBlock.x > 0.4);
});

test('vertical collision separates on Y axis only', () => {
  const bottom = createBlock({ x: 1, y: 3, width: 0.5, height: 0.5, isStatic: true });
  const top = createBlock({ x: 1, y: 2.55, width: 0.5, height: 0.5, vy: 2, bounciness: 0.5 });

  const originalBottomX = bottom.x;
  const originalTopX = top.x;

  const collision = checkCollision(top, bottom);
  assertNotNull(collision);
  assertApprox(collision.overlapX, 0.5, 0.01);
  assertApprox(collision.overlapY, 0.05, 0.01);

  resolveCollision(top, bottom, collision);

  assertNoHorizontalSlip(bottom, originalBottomX);
  assertNoHorizontalSlip(top, originalTopX);
  assertBounced(top);
  assertSettled(bottom);
});

test('friction=1 equalizes velocity between blocks', () => {
  const bottom = createBlock({ x: 1, y: 3, width: 0.5, height: 0.5, friction: 1.0, vx: 5 });
  const top = createBlock({ x: 1, y: 2.55, width: 0.5, height: 0.5, friction: 1.0 });

  const collision = checkCollision(top, bottom);
  assertNotNull(collision);
  resolveCollision(top, bottom, collision);

  assertApprox(top.vx, 2.5, 0.1);
  assertApprox(bottom.vx, 2.5, 0.1);
});

test('stacked block follows dragged block with friction=1', () => {
  const world = createWorld(10, 10);
  const bottom = createBlock({ x: 2, y: 3, width: 0.5, height: 0.5, friction: 1.0, bounciness: 0 });
  const top = createBlock({ x: 2, y: 2.5, width: 0.5, height: 0.5, friction: 1.0, bounciness: 0 });
  addBlock(world, bottom);
  addBlock(world, top);

  for (let i = 0; i < 30; i++) step(world, 0.016);

  const startX = bottom.x;
  const topStartX = top.x;
  const dragStartX = bottom.x + bottom.width / 2;
  const dragStartY = bottom.y + bottom.height / 2;
  startDrag(world, bottom.id, dragStartX, dragStartY);

  for (let i = 0; i < 30; i++) {
    updateDrag(world, dragStartX + (i + 1) * 0.02, dragStartY, 0.016);
    step(world, 0.016);
  }

  assertFollowedHorizontally(top, bottom, topStartX, startX, 0.2);
});

test('full game cycle: drop block, drag base, top stays stacked', () => {
  const world = createWorld(4, 4);
  const base = createBlock({ x: 1.5, y: 3.0, width: 1.0, height: 0.5, friction: 0.8, bounciness: 0.1 });
  const top = createBlock({ x: 1.75, y: 1.0, width: 0.5, height: 0.5, friction: 0.8, bounciness: 0.1 });
  addBlock(world, base);
  addBlock(world, top);

  const dt = 1/60;
  for (let i = 0; i < 60; i++) step(world, dt);
  assertStacked(top, base);

  const baseStartX = base.x;
  const topStartX = top.x;
  const topStartY = top.y;
  const dragStartX = base.x + base.width/2;
  const dragStartY = base.y + base.height/2;

  startDrag(world, base.id, dragStartX, dragStartY);
  for (let i = 0; i < 30; i++) {
    updateDrag(world, dragStartX + (i+1) * (1.0/30), dragStartY, dt);
    step(world, dt);
  }
  endDrag(world);

  for (let i = 0; i < 120; i++) step(world, dt);

  assertMovedRight(base, baseStartX, 0.5);
  assertFollowedHorizontally(top, base, topStartX, baseStartX, 0.2);
  assertStacked(top, base);
  assertApprox(top.y, topStartY, 0.15);
});

test('isBlockAbove detects stacked blocks', () => {
  const bottom = createBlock({ x: 1, y: 2, width: 0.5, height: 0.5 });
  const top = createBlock({ x: 1, y: 1.5, width: 0.5, height: 0.5 });
  assertTrue(isBlockAbove(top, bottom));
});

test('isBlockAbove rejects non-touching blocks', () => {
  const bottom = createBlock({ x: 1, y: 2, width: 0.5, height: 0.5 });
  const top = createBlock({ x: 1, y: 1, width: 0.5, height: 0.5 });
  assertFalse(isBlockAbove(top, bottom));
});

test('isBlockAbove rejects horizontally separated blocks', () => {
  const bottom = createBlock({ x: 1, y: 2, width: 0.5, height: 0.5 });
  const top = createBlock({ x: 3, y: 1.5, width: 0.5, height: 0.5 });
  assertFalse(isBlockAbove(top, bottom));
});

test('findStackAbove finds multi-layer stack', () => {
  const world = createWorld(4, 4);
  const base = createBlock({ x: 1, y: 3, width: 0.5, height: 0.5 });
  const mid = createBlock({ x: 1, y: 2.5, width: 0.5, height: 0.5 });
  const top = createBlock({ x: 1, y: 2, width: 0.5, height: 0.5 });
  addBlock(world, base);
  addBlock(world, mid);
  addBlock(world, top);

  const stack = findStackAbove(world, base);
  assertEqual(stack.length, 2);
  assertTrue(stack.includes(mid));
  assertTrue(stack.includes(top));
});

test('dragging base lets physics move stack via friction (readable)', () => {
  const world = createWorld(4, 4);

  const base = createBlock({ id: 'base', friction: 1.0 });
  const top = createBlock({ id: 'top', friction: 1.0 });

  placeOnFloor({ world, block: base, at: 'center' });
  placeOn({ world, block: top, on: base });

  keyframe(world);
  /*
            @@       
            @@       
            ##       
            ##       
     ================
  */

  dragRight({ world, block: base, distance: 0.5, over: 0.3 });

  keyframe(world);
  /*
            @@       
            @@       
             ##      
             ##      
     ================
  */

  assertTrue(top.vx > 0);
});

