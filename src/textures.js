import * as THREE from 'three';

// Procedural Canvas Texture Generator

export function createAsphaltTextures() {
  const width = 1024;
  const height = 1024;

  // 1. Diffuse / Base Color
  const canvasDiff = document.createElement('canvas');
  canvasDiff.width = width;
  canvasDiff.height = height;
  const ctxD = canvasDiff.getContext('2d');

  // Dark wet asphalt base
  ctxD.fillStyle = '#14171c';
  ctxD.fillRect(0, 0, width, height);

  // Micro gravel noise
  const imgDataD = ctxD.getImageData(0, 0, width, height);
  const dataD = imgDataD.data;
  for (let i = 0; i < dataD.length; i += 4) {
    const noise = (Math.random() - 0.5) * 28;
    const val = Math.max(12, Math.min(45, 24 + noise));
    dataD[i] = val;
    dataD[i + 1] = val + 2;
    dataD[i + 2] = val + 6; // slightly cool wet asphalt tint
  }
  ctxD.putImageData(imgDataD, 0, 0);

  // Road markings (lanes)
  // Left solid yellow, center dashed white, right solid white
  ctxD.lineWidth = 14;
  // Left border line
  ctxD.strokeStyle = 'rgba(235, 175, 40, 0.85)';
  ctxD.beginPath();
  ctxD.moveTo(80, 0);
  ctxD.lineTo(80, height);
  ctxD.stroke();

  // Right border line
  ctxD.strokeStyle = 'rgba(230, 235, 245, 0.85)';
  ctxD.beginPath();
  ctxD.moveTo(width - 80, 0);
  ctxD.lineTo(width - 80, height);
  ctxD.stroke();

  // Lane dividers (dashed lines)
  ctxD.lineWidth = 10;
  ctxD.setLineDash([70, 60]);
  ctxD.strokeStyle = 'rgba(220, 230, 240, 0.8)';

  // 3-lane road dividers
  const lane1 = width * 0.36;
  const lane2 = width * 0.64;

  ctxD.beginPath();
  ctxD.moveTo(lane1, 0);
  ctxD.lineTo(lane1, height);
  ctxD.stroke();

  ctxD.beginPath();
  ctxD.moveTo(lane2, 0);
  ctxD.lineTo(lane2, height);
  ctxD.stroke();

  // 2. Puddle Mask & Roughness Map
  // Puddles should be very dark in roughness (smooth = 0.05), rough asphalt is 0.7 - 0.85
  const canvasRough = document.createElement('canvas');
  canvasRough.width = width;
  canvasRough.height = height;
  const ctxR = canvasRough.getContext('2d');

  // Base asphalt roughness
  ctxR.fillStyle = '#bfbfbf'; // high roughness
  ctxR.fillRect(0, 0, width, height);

  // Draw organic puddles (darker in roughness map)
  const drawPuddle = (ctx, x, y, rx, ry, rot) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
    grad.addColorStop(0, 'rgba(10, 10, 10, 1.0)');     // Puddle center (mirror smooth)
    grad.addColorStop(0.6, 'rgba(30, 30, 30, 0.95)');
    grad.addColorStop(0.85, 'rgba(80, 80, 80, 0.6)');  // Wet rim
    grad.addColorStop(1, 'rgba(191, 191, 191, 0.0)');   // Blend to damp asphalt
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Multiple puddles placed realistically in wheel ruts and lanes
  drawPuddle(ctxR, 260, 300, 140, 80, 0.2);
  drawPuddle(ctxR, 230, 350, 100, 60, -0.1);
  drawPuddle(ctxR, 700, 650, 160, 90, -0.3);
  drawPuddle(ctxR, 740, 700, 110, 70, 0.1);
  drawPuddle(ctxR, 480, 150, 120, 75, 0.4);
  drawPuddle(ctxR, 520, 880, 150, 95, -0.2);
  drawPuddle(ctxR, 380, 920, 90, 50, 0.3);

  // 3. Normal Map
  // Normal map where puddles are flat (128, 128, 255) and asphalt has surface gravel bumps
  const canvasNorm = document.createElement('canvas');
  canvasNorm.width = width;
  canvasNorm.height = height;
  const ctxN = canvasNorm.getContext('2d');

  const roughData = ctxR.getImageData(0, 0, width, height).data;
  const imgDataN = ctxN.createImageData(width, height);
  const dataN = imgDataN.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const roughnessVal = roughData[idx]; // 0 to 255
      const isPuddleFactor = 1.0 - (roughnessVal / 255.0); // 1 = deep puddle, 0 = asphalt

      // Asphalt bump noise
      const nx = 128 + ((Math.random() - 0.5) * 45) * (1.0 - isPuddleFactor);
      const ny = 128 + ((Math.random() - 0.5) * 45) * (1.0 - isPuddleFactor);
      const nz = 255;

      dataN[idx] = Math.max(0, Math.min(255, nx));
      dataN[idx + 1] = Math.max(0, Math.min(255, ny));
      dataN[idx + 2] = nz;
      dataN[idx + 3] = 255;
    }
  }
  ctxN.putImageData(imgDataN, 0, 0);

  // Convert to Three.js textures
  const diffTex = new THREE.CanvasTexture(canvasDiff);
  diffTex.wrapS = THREE.RepeatWrapping;
  diffTex.wrapT = THREE.RepeatWrapping;

  const roughTex = new THREE.CanvasTexture(canvasRough);
  roughTex.wrapS = THREE.RepeatWrapping;
  roughTex.wrapT = THREE.RepeatWrapping;

  const normTex = new THREE.CanvasTexture(canvasNorm);
  normTex.wrapS = THREE.RepeatWrapping;
  normTex.wrapT = THREE.RepeatWrapping;

  return { diffTex, roughTex, normTex };
}

// Water Splash Droplet Particle Texture (High-res with specular rim)
export function createSplashParticleTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const center = size / 2;
  const grad = ctx.createRadialGradient(center - 10, center - 10, 2, center, center, center * 0.9);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');     // Specular glint
  grad.addColorStop(0.2, 'rgba(220, 245, 255, 0.9)');    // Droplet body
  grad.addColorStop(0.5, 'rgba(160, 220, 255, 0.6)');    // Translucent water
  grad.addColorStop(0.8, 'rgba(120, 190, 255, 0.25)');   // Rim
  grad.addColorStop(1, 'rgba(100, 180, 255, 0.0)');      // Soft falloff

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(center, center, center * 0.85, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// Tire Water Spray Mist Texture
export function createWaterSprayMistTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const center = size / 2;
  const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
  grad.addColorStop(0, 'rgba(220, 240, 255, 0.6)');
  grad.addColorStop(0.3, 'rgba(190, 220, 245, 0.35)');
  grad.addColorStop(0.7, 'rgba(160, 200, 230, 0.12)');
  grad.addColorStop(1, 'rgba(140, 180, 220, 0.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(center, center, center, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// Water Ripple Ring Texture for Puddles
export function createWaterRippleTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const center = size / 2;
  ctx.clearRect(0, 0, size, size);

  // Concentric thin rings
  ctx.strokeStyle = 'rgba(220, 240, 255, 0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(center, center, 40, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(200, 230, 255, 0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(center, center, 75, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(180, 220, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center, center, 110, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// Rain Streak Particle Texture
export function createRainStreakTexture() {
  const width = 16;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
  grad.addColorStop(0.4, 'rgba(210, 235, 255, 0.4)');
  grad.addColorStop(0.9, 'rgba(240, 250, 255, 0.95)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 1.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(width * 0.35, 0, width * 0.3, height);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// Cyberpunk Neon Billboard Textures
export function createNeonBillboardTextures() {
  const boards = [];
  const configs = [
    {
      title: 'NEO VELOCITY',
      sub: 'SPEED // OVERDRIVE 2088',
      kanji: '超光速',
      color: '#00f0ff',
      accent: '#ff0077',
      bg: '#050711'
    },
    {
      title: 'AQUA DRIFT',
      sub: 'CAUTION // WET HIGHWAY',
      kanji: '水飛沫',
      color: '#00ffaa',
      accent: '#0088ff',
      bg: '#040b10'
    },
    {
      title: 'CYBER TOKYO',
      sub: 'MIDNIGHT RACING CORPS',
      kanji: '東京夜走',
      color: '#ff0055',
      accent: '#ffaa00',
      bg: '#100508'
    },
    {
      title: 'QUANTUM NITRO',
      sub: 'PURE HIGH-OCTANE ADRENALINE',
      kanji: '量子爆走',
      color: '#b000ff',
      accent: '#00f0ff',
      bg: '#0a0414'
    }
  ];

  configs.forEach(cfg => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = cfg.bg;
    ctx.fillRect(0, 0, 1024, 512);

    // Glowing border frame
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 14;
    ctx.shadowColor = cfg.color;
    ctx.shadowBlur = 25;
    ctx.strokeRect(20, 20, 984, 472);

    // Inner grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    for (let x = 40; x < 1000; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x, 470);
      ctx.stroke();
    }
    for (let y = 40; y < 480; y += 40) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(984, y);
      ctx.stroke();
    }

    // Kanji Watermark in background
    ctx.font = '900 180px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.textAlign = 'right';
    ctx.fillText(cfg.kanji, 960, 280);

    // Main Title with glow
    ctx.font = '900 76px sans-serif';
    ctx.textAlign = 'left';
    ctx.shadowColor = cfg.color;
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(cfg.title, 80, 180);

    // Kanji front
    ctx.font = 'bold 50px sans-serif';
    ctx.fillStyle = cfg.accent;
    ctx.shadowColor = cfg.accent;
    ctx.shadowBlur = 20;
    ctx.fillText(cfg.kanji, 80, 260);

    // Subtitle
    ctx.font = '600 36px monospace';
    ctx.fillStyle = cfg.color;
    ctx.shadowColor = cfg.color;
    ctx.shadowBlur = 15;
    ctx.fillText(cfg.sub, 80, 340);

    // Cyber decorative bar
    ctx.fillStyle = cfg.accent;
    ctx.fillRect(80, 390, 400, 10);
    ctx.fillStyle = cfg.color;
    ctx.fillRect(500, 390, 200, 10);

    const tex = new THREE.CanvasTexture(canvas);
    boards.push(tex);
  });

  return boards;
}

// Drilled Brake Disc Texture
export function createBrakeDiscTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const center = size / 2;

  // Steel brushed finish
  const grad = ctx.createRadialGradient(center, center, 60, center, center, 240);
  grad.addColorStop(0, '#555555');
  grad.addColorStop(0.3, '#bbbbbb');
  grad.addColorStop(0.5, '#777777');
  grad.addColorStop(0.8, '#cccccc');
  grad.addColorStop(1, '#333333');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(center, center, 240, 0, Math.PI * 2);
  ctx.fill();

  // Circular brushed grooves
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let r = 80; r < 235; r += 3) {
    ctx.beginPath();
    ctx.arc(center, center, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Cross-drilled cooling holes
  ctx.fillStyle = '#111111';
  const numSpokes = 16;
  for (let i = 0; i < numSpokes; i++) {
    const angle = (i / numSpokes) * Math.PI * 2;
    for (let r = 100; r < 220; r += 28) {
      const hx = center + Math.cos(angle + (r * 0.003)) * r;
      const hy = center + Math.sin(angle + (r * 0.003)) * r;
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Center hat
  ctx.fillStyle = '#222222';
  ctx.beginPath();
  ctx.arc(center, center, 75, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// Tire Tread Normal / Bump Map
export function createTireTreadTexture() {
  const width = 256;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, width, height);

  // Deep tire tread grooves
  ctx.fillStyle = '#000000';
  // Longitudinal grooves
  ctx.fillRect(40, 0, 16, height);
  ctx.fillRect(90, 0, 16, height);
  ctx.fillRect(150, 0, 16, height);
  ctx.fillRect(200, 0, 16, height);

  // Lateral rain water sipes / drainage channels
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#050505';
  for (let y = 0; y < height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(40, y + 16);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(106, y);
    ctx.lineTo(150, y + 16);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(216, y);
    ctx.lineTo(256, y + 16);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
