// Test helpers for readable tests
// Provides placement functions and animated HTML recordings

import { addBlock, startDrag, updateDrag, endDrag, step } from '../engine/world.js';
import fs from 'fs';

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

// Create a recorder object (no global state)
export function createRecorder({ world, name }) {
  const frames = [];

  function captureFrame() {
    const frameData = {
      blocks: world.blocks.map(b => ({
        id: b.id,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        isStatic: b.isStatic,
      })),
    };
    frames.push(frameData);
  }

  // Capture initial frame
  captureFrame();

  return {
    captureFrame,

    save() {
      const path = `src/tests/recordings/${name}.html`;
      const html = generateAnimationHTML({ name, world, frames });

      const dir = 'src/tests/recordings';
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(path, html);
      console.log(`Recording saved: ${path} (${frames.length} frames)`);
      return path;
    },
  };
}

// Generate self-contained HTML animation
function generateAnimationHTML({ name, world, frames }) {
  const PIXELS_PER_METER = 60;
  const width = world.width * PIXELS_PER_METER;
  const height = world.height * PIXELS_PER_METER;

  // Assign colors to blocks by order of appearance
  const blockColors = {};
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
  let colorIndex = 0;

  for (const frame of frames) {
    for (const block of frame.blocks) {
      if (!blockColors[block.id] && !block.isStatic) {
        blockColors[block.id] = colors[colorIndex % colors.length];
        colorIndex++;
      }
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
  <title>Recording: ${name}</title>
  <style>
    body {
      margin: 20px;
      font-family: monospace;
      background: #1a1a2e;
      color: #eee;
    }
    h1 { margin-bottom: 10px; }
    .info { margin-bottom: 10px; color: #888; }
    canvas {
      border: 2px solid #444;
      background: #16213e;
    }
    .controls {
      margin-top: 10px;
    }
    button {
      padding: 5px 15px;
      margin-right: 10px;
      cursor: pointer;
    }
    #frameInfo {
      margin-left: 20px;
    }
  </style>
</head>
<body>
  <h1>${name}</h1>
  <div class="info">World: ${world.width}m x ${world.height}m | Frames: ${frames.length}</div>
  <canvas id="canvas" width="${width}" height="${height}"></canvas>
  <div class="controls">
    <button id="playBtn">Pause</button>
    <button id="stepBtn">Step</button>
    <input type="range" id="speedSlider" min="1" max="60" value="30">
    <span id="frameInfo">Frame 1/${frames.length}</span>
  </div>

  <script>
    const PIXELS_PER_METER = ${PIXELS_PER_METER};
    const frames = ${JSON.stringify(frames, null, 2)};
    const blockColors = ${JSON.stringify(blockColors)};

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const playBtn = document.getElementById('playBtn');
    const stepBtn = document.getElementById('stepBtn');
    const speedSlider = document.getElementById('speedSlider');
    const frameInfo = document.getElementById('frameInfo');

    let currentFrame = 0;
    let playing = true;
    let lastTime = 0;
    let frameInterval = 1000 / 30;

    speedSlider.addEventListener('input', () => {
      frameInterval = 1000 / speedSlider.value;
    });

    playBtn.addEventListener('click', () => {
      playing = !playing;
      playBtn.textContent = playing ? 'Pause' : 'Play';
    });

    stepBtn.addEventListener('click', () => {
      playing = false;
      playBtn.textContent = 'Play';
      currentFrame = (currentFrame + 1) % frames.length;
      render();
    });

    function render() {
      const frame = frames[currentFrame];
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw floor
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(0, canvas.height - 5, canvas.width, 5);

      // Draw blocks
      for (const block of frame.blocks) {
        const x = block.x * PIXELS_PER_METER;
        const y = block.y * PIXELS_PER_METER;
        const w = block.width * PIXELS_PER_METER;
        const h = block.height * PIXELS_PER_METER;

        if (block.isStatic) {
          ctx.fillStyle = '#718096';
        } else {
          ctx.fillStyle = blockColors[block.id] || '#888';
        }

        ctx.fillRect(x, y, w, h);

        // Border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
      }

      frameInfo.textContent = 'Frame ' + (currentFrame + 1) + '/' + frames.length;
    }

    function animate(time) {
      if (playing && time - lastTime > frameInterval) {
        currentFrame = (currentFrame + 1) % frames.length;
        lastTime = time;
        render();
      }
      requestAnimationFrame(animate);
    }

    render();
    requestAnimationFrame(animate);
  </script>

  <!-- Frame data for inspection -->
  <details style="margin-top: 20px;">
    <summary>Raw frame data (JSON)</summary>
    <pre style="background: #0d1117; padding: 10px; overflow: auto; max-height: 400px;">${JSON.stringify(frames, null, 2)}</pre>
  </details>
</body>
</html>`;
}

export function dragRight({ world, block, distance, over, recorder }) {
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

    if (recorder && i % captureEvery === 0) {
      recorder.captureFrame();
    }
  }

  endDrag(world);
  if (recorder) recorder.captureFrame();
}

export function dragLeft({ world, block, distance, over, recorder }) {
  dragRight({ world, block, distance: -distance, over, recorder });
}

export function simulate({ world, time, recorder }) {
  const dt = 1 / 60;
  const steps = Math.round(time / dt);
  const captureEvery = Math.max(1, Math.floor(steps / 20));

  for (let i = 0; i < steps; i++) {
    step(world, dt);
    if (recorder && i % captureEvery === 0) {
      recorder.captureFrame();
    }
  }
  if (recorder) recorder.captureFrame();
}
