// Canvas renderer - procedural style
// Converts meters to pixels for display

export const PIXELS_PER_METER = 100;

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

  // Convert meters to pixels
  const x = block.x * PIXELS_PER_METER;
  const y = block.y * PIXELS_PER_METER;
  const width = block.width * PIXELS_PER_METER;
  const height = block.height * PIXELS_PER_METER;

  // Color based on mass
  const color = getBlockColor(block);
  const borderColor = isSelected ? '#ffff00' : '#333';
  const borderWidth = isSelected ? 3 : 1;

  ctx.fillStyle = color;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;

  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);

  // Draw property indicators
  drawPropertyIndicators(renderer, block, x, y);
}

function getBlockColor(block) {
  // Color varies by mass (heavier = more red/orange)
  const massHue = Math.min(block.mass / 5, 1);
  const r = Math.floor(100 + massHue * 100);
  const g = Math.floor(150 - massHue * 50);
  const b = Math.floor(200 - massHue * 100);

  // Green tint for bouncy blocks
  if (block.bounciness > 0.5) {
    return `rgb(${Math.floor(r * 0.8)}, ${Math.floor(g * 1.2)}, ${Math.floor(b * 0.8)})`;
  }

  return `rgb(${r}, ${g}, ${b})`;
}

function drawPropertyIndicators(renderer, block, x, y) {
  const { ctx } = renderer;
  const indicatorSize = 6;
  const padding = 3;
  let offsetX = padding;

  // Friction indicator (blue = slippery, orange = grippy)
  const frictionHue = block.friction; // 0 = blue, 1 = orange
  const fr = Math.floor(frictionHue * 255);
  const fb = Math.floor((1 - frictionHue) * 255);
  ctx.fillStyle = `rgb(${fr}, 100, ${fb})`;
  ctx.beginPath();
  ctx.arc(x + offsetX + indicatorSize / 2, y + padding + indicatorSize / 2, indicatorSize / 2, 0, Math.PI * 2);
  ctx.fill();
  offsetX += indicatorSize + 2;

  // Bounciness indicator (green) if > 0.3
  if (block.bounciness > 0.3) {
    const intensity = Math.floor(block.bounciness * 255);
    ctx.fillStyle = `rgb(0, ${intensity}, 50)`;
    ctx.beginPath();
    ctx.arc(x + offsetX + indicatorSize / 2, y + padding + indicatorSize / 2, indicatorSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawWorld(renderer, world) {
  clear(renderer);

  // Draw ground
  drawGround(renderer, world);

  // Draw all blocks
  world.blocks.forEach(block => {
    const isSelected = block.id === world.selectedBlockId;
    drawBlock(renderer, block, isSelected);
  });
}

function drawGround(renderer, world) {
  const { ctx, canvas } = renderer;
  const groundY = world.height * PIXELS_PER_METER - 5;

  ctx.fillStyle = '#2d5016';
  ctx.fillRect(0, groundY, canvas.width, 5);

  // Ground pattern
  ctx.strokeStyle = '#3d6020';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x + 10, groundY + 5);
    ctx.stroke();
  }
}

export function resizeCanvas(renderer, width, height) {
  renderer.canvas.width = width;
  renderer.canvas.height = height;
}

// Convert pixel coordinates to meters
export function pixelsToMeters(pixels) {
  return pixels / PIXELS_PER_METER;
}

// Convert meters to pixels
export function metersToPixels(meters) {
  return meters * PIXELS_PER_METER;
}
