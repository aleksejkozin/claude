// Canvas renderer - procedural style
// Pure rendering functions, no game logic

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

export function clear(renderer, color = '#1a1a2e') {
  const { ctx, canvas } = renderer;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function drawBlock(renderer, block, isSelected = false) {
  const { ctx } = renderer;

  // Determine color based on block properties
  let color = getBlockColor(block);
  let borderColor = isSelected ? '#ffff00' : '#333';
  let borderWidth = isSelected ? 3 : 1;

  ctx.fillStyle = color;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;

  ctx.fillRect(block.x, block.y, block.width, block.height);
  ctx.strokeRect(block.x, block.y, block.width, block.height);

  // Draw property indicators
  drawPropertyIndicators(renderer, block);
}

function getBlockColor(block) {
  // Base color varies by mass
  const massHue = Math.min(block.mass / 5, 1); // 0-1 based on mass
  const r = Math.floor(100 + massHue * 100);
  const g = Math.floor(150 - massHue * 50);
  const b = Math.floor(200 - massHue * 100);

  // Modify based on properties
  if (block.sticky) {
    return `rgb(${r}, ${Math.floor(g * 0.7)}, ${Math.floor(b * 0.5)})`; // Orange tint
  }
  if (block.slippery) {
    return `rgb(${Math.floor(r * 0.7)}, ${g}, ${Math.floor(b * 1.2)})`; // Blue tint
  }
  if (block.bounciness > 0.5) {
    return `rgb(${Math.floor(r * 0.8)}, ${Math.floor(g * 1.2)}, ${Math.floor(b * 0.8)})`; // Green tint
  }

  return `rgb(${r}, ${g}, ${b})`;
}

function drawPropertyIndicators(renderer, block) {
  const { ctx } = renderer;
  const indicatorSize = 6;
  const padding = 3;
  let offsetX = padding;

  // Sticky indicator (orange dot)
  if (block.sticky) {
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(block.x + offsetX + indicatorSize / 2, block.y + padding + indicatorSize / 2, indicatorSize / 2, 0, Math.PI * 2);
    ctx.fill();
    offsetX += indicatorSize + 2;
  }

  // Slippery indicator (blue dot)
  if (block.slippery) {
    ctx.fillStyle = '#00aaff';
    ctx.beginPath();
    ctx.arc(block.x + offsetX + indicatorSize / 2, block.y + padding + indicatorSize / 2, indicatorSize / 2, 0, Math.PI * 2);
    ctx.fill();
    offsetX += indicatorSize + 2;
  }

  // Bouncy indicator (green dot) if bounciness > 0.5
  if (block.bounciness > 0.5) {
    ctx.fillStyle = '#00ff44';
    ctx.beginPath();
    ctx.arc(block.x + offsetX + indicatorSize / 2, block.y + padding + indicatorSize / 2, indicatorSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawWorld(renderer, world) {
  clear(renderer);

  // Draw all blocks
  world.blocks.forEach(block => {
    const isSelected = block.id === world.selectedBlockId;
    drawBlock(renderer, block, isSelected);
  });

  // Draw tower height indicator
  drawHeightIndicator(renderer, world);

  // Draw ground line
  drawGround(renderer, world);
}

function drawHeightIndicator(renderer, world) {
  const { ctx, canvas } = renderer;

  // Find highest block
  let minY = world.height;
  world.blocks.forEach(block => {
    if (!block.isStatic && block.y < minY) {
      minY = block.y;
    }
  });

  const towerHeight = world.height - minY;

  // Draw height line
  ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(0, minY);
  ctx.lineTo(canvas.width, minY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw height text
  ctx.fillStyle = '#ffff00';
  ctx.font = '14px monospace';
  ctx.fillText(`Height: ${Math.floor(towerHeight)}px`, 10, 20);
}

function drawGround(renderer, world) {
  const { ctx, canvas } = renderer;

  ctx.fillStyle = '#2d5016';
  ctx.fillRect(0, world.height - 5, canvas.width, 5);

  // Ground pattern
  ctx.strokeStyle = '#3d6020';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, world.height - 5);
    ctx.lineTo(x + 10, world.height);
    ctx.stroke();
  }
}

export function drawDevUI(renderer, mouseX, mouseY, previewBlock) {
  const { ctx } = renderer;

  // Draw preview block at mouse position if we have one
  if (previewBlock) {
    ctx.globalAlpha = 0.5;
    drawBlock(renderer, {
      ...previewBlock,
      x: mouseX - previewBlock.width / 2,
      y: mouseY - previewBlock.height / 2,
    }, false);
    ctx.globalAlpha = 1;
  }

  // Draw crosshair at mouse
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.moveTo(mouseX - 10, mouseY);
  ctx.lineTo(mouseX + 10, mouseY);
  ctx.moveTo(mouseX, mouseY - 10);
  ctx.lineTo(mouseX, mouseY + 10);
  ctx.stroke();
}

export function resizeCanvas(renderer, width, height) {
  renderer.canvas.width = width;
  renderer.canvas.height = height;
}
