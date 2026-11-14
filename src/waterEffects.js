import * as THREE from 'three';
import {
  createSplashParticleTexture,
  createWaterSprayMistTexture,
  createWaterRippleTexture
} from './textures.js';

export class WaterEffectsManager {
  constructor(scene) {
    this.scene = scene;

    // Textures
    this.splashTex = createSplashParticleTexture();
    this.mistTex = createWaterSprayMistTexture();
    this.rippleTex = createWaterRippleTexture();

    // 1. Tire Spray Rooster Tails (Continuous mist & droplets behind tires)
    this.maxTireSpray = 2400;
    this.sprayIndex = 0;
    this.initTireSpraySystem();

    // 2. High-Impact Puddle Splash Droplets (Violent bursts when hitting puddles)
    this.maxSplashDroplets = 1600;
    this.splashIndex = 0;
    this.initPuddleSplashSystem();

    // 3. Puddle Surface Ripple Discs
    this.maxRipples = 60;
    this.rippleIndex = 0;
    this.initPuddleRipples();

    // 4. Drift Vapor / Steam Clouds
    this.maxDriftSteam = 1200;
    this.steamIndex = 0;
    this.initDriftSteamSystem();

    // 5. Screen Water Splashes (droplets on camera lens)
    this.screenSplashes = [];
    this.screenCanvas = null;
    this.screenCtx = null;
    this.initScreenSplashes();
  }

  // --- 1. Continuous Tire Spray (Rooster Tails) ---
  initTireSpraySystem() {
    const geom = new THREE.BufferGeometry();
    this.sprayPositions = new Float32Array(this.maxTireSpray * 3);
    this.sprayVelocities = new Float32Array(this.maxTireSpray * 3);
    this.sprayAges = new Float32Array(this.maxTireSpray);
    this.sprayLifetimes = new Float32Array(this.maxTireSpray);
    this.spraySizes = new Float32Array(this.maxTireSpray);
    this.sprayOpacities = new Float32Array(this.maxTireSpray);

    // Initialize off-screen
    for (let i = 0; i < this.maxTireSpray; i++) {
      this.sprayPositions[i * 3 + 1] = -999;
      this.sprayAges[i] = 999;
      this.sprayLifetimes[i] = 1.0;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(this.sprayPositions, 3));
    geom.setAttribute('size', new THREE.BufferAttribute(this.spraySizes, 1));
    geom.setAttribute('opacity', new THREE.BufferAttribute(this.sprayOpacities, 1));

    // Custom Shader Material for soft luminous water spray mist
    const sprayMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTexture: { value: this.mistTex },
        uColor: { value: new THREE.Color(0xd0e8ff) }
      },
      vertexShader: `
        attribute float size;
        attribute float opacity;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (400.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 320.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec3 uColor;
        varying float vOpacity;
        void main() {
          if (vOpacity <= 0.001) discard;
          vec4 texColor = texture2D(uTexture, gl_PointCoord);
          gl_FragColor = vec4(uColor, texColor.a * vOpacity * 0.7);
        }
      `
    });

    this.sprayPoints = new THREE.Points(geom, sprayMat);
    this.sprayPoints.frustumCulled = false;
    this.scene.add(this.sprayPoints);
  }

  // --- 2. High-Impact Puddle Splash Droplets ---
  initPuddleSplashSystem() {
    const geom = new THREE.BufferGeometry();
    this.splashPositions = new Float32Array(this.maxSplashDroplets * 3);
    this.splashVelocities = new Float32Array(this.maxSplashDroplets * 3);
    this.splashAges = new Float32Array(this.maxSplashDroplets);
    this.splashLifetimes = new Float32Array(this.maxSplashDroplets);
    this.splashSizes = new Float32Array(this.maxSplashDroplets);

    for (let i = 0; i < this.maxSplashDroplets; i++) {
      this.splashPositions[i * 3 + 1] = -999;
      this.splashAges[i] = 999;
      this.splashLifetimes[i] = 1.0;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(this.splashPositions, 3));
    geom.setAttribute('size', new THREE.BufferAttribute(this.splashSizes, 1));

    const splashMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending, // Sparkling water droplet highlights
      uniforms: {
        uTexture: { value: this.splashTex },
        uColor: { value: new THREE.Color(0xffffff) }
      },
      vertexShader: `
        attribute float size;
        varying float vSize;
        void main() {
          vSize = size;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (500.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 200.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec3 uColor;
        varying float vSize;
        void main() {
          if (vSize <= 0.001) discard;
          vec4 texColor = texture2D(uTexture, gl_PointCoord);
          // High specularity glint
          gl_FragColor = vec4(uColor * 1.4, texColor.a * 0.95);
        }
      `
    });

    this.splashPoints = new THREE.Points(geom, splashMat);
    this.splashPoints.frustumCulled = false;
    this.scene.add(this.splashPoints);
  }

  // --- 3. Expanding Puddle Ripples ---
  initPuddleRipples() {
    const geom = new THREE.PlaneGeometry(1, 1);
    geom.rotateX(-Math.PI / 2); // Lay flat on ground

    const mat = new THREE.MeshBasicMaterial({
      map: this.rippleTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    this.ripples = [];
    for (let i = 0; i < this.maxRipples; i++) {
      const mesh = new THREE.Mesh(geom, mat.clone());
      mesh.position.set(0, -999, 0);
      mesh.visible = false;
      this.scene.add(mesh);
      this.ripples.push({
        mesh,
        age: 999,
        lifetime: 0.8,
        baseScale: 1,
        maxScale: 6
      });
    }
  }

  // --- 4. Wet Drift Vapor / Steam ---
  initDriftSteamSystem() {
    const geom = new THREE.BufferGeometry();
    this.steamPositions = new Float32Array(this.maxDriftSteam * 3);
    this.steamVelocities = new Float32Array(this.maxDriftSteam * 3);
    this.steamAges = new Float32Array(this.maxDriftSteam);
    this.steamLifetimes = new Float32Array(this.maxDriftSteam);
    this.steamSizes = new Float32Array(this.maxDriftSteam);
    this.steamOpacities = new Float32Array(this.maxDriftSteam);

    for (let i = 0; i < this.maxDriftSteam; i++) {
      this.steamPositions[i * 3 + 1] = -999;
      this.steamAges[i] = 999;
      this.steamLifetimes[i] = 1.0;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(this.steamPositions, 3));
    geom.setAttribute('size', new THREE.BufferAttribute(this.steamSizes, 1));
    geom.setAttribute('opacity', new THREE.BufferAttribute(this.steamOpacities, 1));

    const steamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTexture: { value: this.mistTex },
        uColor: { value: new THREE.Color(0x90c5f0) } // Atmospheric vapor blue
      },
      vertexShader: `
        attribute float size;
        attribute float opacity;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (350.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 380.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec3 uColor;
        varying float vOpacity;
        void main() {
          if (vOpacity <= 0.001) discard;
          vec4 tex = texture2D(uTexture, gl_PointCoord);
          gl_FragColor = vec4(uColor, tex.a * vOpacity * 0.55);
        }
      `
    });

    this.steamPoints = new THREE.Points(geom, steamMat);
    this.steamPoints.frustumCulled = false;
    this.scene.add(this.steamPoints);
  }

  // --- 5. Screen Water Droplets Overlay ---
  initScreenSplashes() {
    this.screenCanvas = document.getElementById('water-screen-canvas');
    if (this.screenCanvas) {
      this.screenCanvas.width = window.innerWidth;
      this.screenCanvas.height = window.innerHeight;
      this.screenCtx = this.screenCanvas.getContext('2d');
    }

    window.addEventListener('resize', () => {
      if (this.screenCanvas) {
        this.screenCanvas.width = window.innerWidth;
        this.screenCanvas.height = window.innerHeight;
      }
    });
  }

  // Spawn Tire Spray Particles
  emitTireSpray(wheelWorldPos, carVelocityVec, speedRatio, isWet = true) {
    if (!isWet || speedRatio < 0.05) return;

    // Emit more particles at higher speeds
    const count = Math.min(8, Math.floor(speedRatio * 8) + 1);

    for (let c = 0; c < count; c++) {
      const idx = this.sprayIndex;
      this.sprayIndex = (this.sprayIndex + 1) % this.maxTireSpray;

      const p3 = idx * 3;
      // Start slightly behind the tire contact point
      this.sprayPositions[p3] = wheelWorldPos.x + (Math.random() - 0.5) * 0.25;
      this.sprayPositions[p3 + 1] = Math.max(0.05, wheelWorldPos.y + 0.05 + Math.random() * 0.15);
      this.sprayPositions[p3 + 2] = wheelWorldPos.z + (Math.random() - 0.5) * 0.25;

      // Ejected backward and upward
      const backwardFactor = -0.55 * speedRatio;
      this.sprayVelocities[p3] = -carVelocityVec.x * backwardFactor + (Math.random() - 0.5) * (0.8 + speedRatio * 1.5);
      this.sprayVelocities[p3 + 1] = 0.8 + Math.random() * (1.8 + speedRatio * 4.5); // high roostertail spray
      this.sprayVelocities[p3 + 2] = -carVelocityVec.z * backwardFactor + (Math.random() - 0.5) * (0.8 + speedRatio * 1.5);

      this.sprayAges[idx] = 0;
      this.sprayLifetimes[idx] = 0.45 + Math.random() * 0.45;
      this.spraySizes[idx] = (0.6 + Math.random() * 0.8) * (1 + speedRatio * 1.8);
      this.sprayOpacities[idx] = 0.85;
    }
  }

  // Spawn Violent Puddle Splash
  triggerPuddleSplash(pos, velocityVec, speedRatio, onSoundSplash) {
    if (speedRatio < 0.1) return;

    // Trigger splash sound
    if (onSoundSplash) {
      onSoundSplash(speedRatio);
    }

    // 1. Splash Droplet Cloud
    const dropletCount = Math.min(120, Math.floor(40 + speedRatio * 90));
    for (let i = 0; i < dropletCount; i++) {
      const idx = this.splashIndex;
      this.splashIndex = (this.splashIndex + 1) % this.maxSplashDroplets;

      const p3 = idx * 3;
      this.splashPositions[p3] = pos.x + (Math.random() - 0.5) * 0.6;
      this.splashPositions[p3 + 1] = 0.1 + Math.random() * 0.2;
      this.splashPositions[p3 + 2] = pos.z + (Math.random() - 0.5) * 0.6;

      // Cone angle / fan burst to the sides and upwards
      const angle = Math.random() * Math.PI * 2;
      const speed = (2.5 + Math.random() * 9.0) * (0.6 + speedRatio * 1.2);
      const verticalSpeed = (3.5 + Math.random() * 7.5) * (0.5 + speedRatio * 1.2);

      this.splashVelocities[p3] = Math.cos(angle) * speed + velocityVec.x * 0.2;
      this.splashVelocities[p3 + 1] = verticalSpeed;
      this.splashVelocities[p3 + 2] = Math.sin(angle) * speed + velocityVec.z * 0.2;

      this.splashAges[idx] = 0;
      this.splashLifetimes[idx] = 0.5 + Math.random() * 0.6;
      this.splashSizes[idx] = 0.8 + Math.random() * 1.6;
    }

    // 2. Spawn Expanding Ripple on Puddle
    this.spawnRipple(pos.x, pos.z, 2.5 + speedRatio * 3.5);

    // 3. Add Screen Water Droplets
    const numScreenDrops = Math.floor(2 + speedRatio * 6);
    for (let d = 0; d < numScreenDrops; d++) {
      this.addScreenDroplet();
    }
  }

  // Spawn Puddle Ripple
  spawnRipple(x, z, scale) {
    const rip = this.ripples[this.rippleIndex];
    this.rippleIndex = (this.rippleIndex + 1) % this.maxRipples;

    rip.mesh.position.set(x, 0.03, z);
    rip.mesh.scale.set(0.5, 0.5, 0.5);
    rip.mesh.visible = true;
    rip.age = 0;
    rip.lifetime = 0.75;
    rip.maxScale = scale;
  }

  // Spawn Drift Steam
  emitDriftSteam(wheelPos, driftAngle, speedRatio) {
    if (speedRatio < 0.15 || Math.abs(driftAngle) < 0.2) return;

    const count = Math.min(10, Math.floor(Math.abs(driftAngle) * 12) + 2);
    for (let c = 0; c < count; c++) {
      const idx = this.steamIndex;
      this.steamIndex = (this.steamIndex + 1) % this.maxDriftSteam;

      const p3 = idx * 3;
      this.steamPositions[p3] = wheelPos.x + (Math.random() - 0.5) * 0.4;
      this.steamPositions[p3 + 1] = 0.1 + Math.random() * 0.2;
      this.steamPositions[p3 + 2] = wheelPos.z + (Math.random() - 0.5) * 0.4;

      // Vapor kicks out sideways from slide
      this.steamVelocities[p3] = (Math.random() - 0.5) * 3.0;
      this.steamVelocities[p3 + 1] = 0.5 + Math.random() * 1.5;
      this.steamVelocities[p3 + 2] = (Math.random() - 0.5) * 3.0;

      this.steamAges[idx] = 0;
      this.steamLifetimes[idx] = 0.8 + Math.random() * 0.7;
      this.steamSizes[idx] = 1.2 + Math.random() * 1.8;
      this.steamOpacities[idx] = 0.65;
    }
  }

  // Add Droplet to Camera Screen
  addScreenDroplet() {
    if (!this.screenCanvas) return;
    const w = this.screenCanvas.width;
    const h = this.screenCanvas.height;

    this.screenSplashes.push({
      x: Math.random() * w,
      y: Math.random() * h * 0.8,
      radius: 6 + Math.random() * 18,
      speedY: 20 + Math.random() * 60, // runs down windshield/lens
      opacity: 0.85 + Math.random() * 0.15,
      life: 1.0,
      decay: 0.25 + Math.random() * 0.2
    });
  }

  // Main Update Loop
  update(delta) {
    // 1. Update Continuous Tire Spray
    const posAttr = this.sprayPoints.geometry.attributes.position;
    const sizeAttr = this.sprayPoints.geometry.attributes.size;
    const opacAttr = this.sprayPoints.geometry.attributes.opacity;

    let needSprayUpdate = false;
    for (let i = 0; i < this.maxTireSpray; i++) {
      if (this.sprayAges[i] < this.sprayLifetimes[i]) {
        this.sprayAges[i] += delta;
        const progress = this.sprayAges[i] / this.sprayLifetimes[i];

        if (progress >= 1.0) {
          this.sprayPositions[i * 3 + 1] = -999;
          this.sprayOpacities[i] = 0;
        } else {
          const p3 = i * 3;
          // Apply velocity and air drag
          this.sprayPositions[p3] += this.sprayVelocities[p3] * delta;
          this.sprayPositions[p3 + 1] += this.sprayVelocities[p3 + 1] * delta;
          this.sprayPositions[p3 + 2] += this.sprayVelocities[p3 + 2] * delta;

          // Gravity and air drag
          this.sprayVelocities[p3 + 1] -= 9.8 * 0.25 * delta;
          this.sprayVelocities[p3] *= (1.0 - 1.2 * delta);
          this.sprayVelocities[p3 + 2] *= (1.0 - 1.2 * delta);

          // Expansion and fade
          this.spraySizes[i] *= (1.0 + 1.8 * delta);
          this.sprayOpacities[i] = (1.0 - progress) * 0.85;
        }
        needSprayUpdate = true;
      }
    }

    if (needSprayUpdate) {
      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      opacAttr.needsUpdate = true;
    }

    // 2. Update Violent Splash Droplets
    const sPosAttr = this.splashPoints.geometry.attributes.position;
    const sSizeAttr = this.splashPoints.geometry.attributes.size;
    let needSplashUpdate = false;

    for (let i = 0; i < this.maxSplashDroplets; i++) {
      if (this.splashAges[i] < this.splashLifetimes[i]) {
        this.splashAges[i] += delta;
        const progress = this.splashAges[i] / this.splashLifetimes[i];

        if (progress >= 1.0) {
          this.splashPositions[i * 3 + 1] = -999;
          this.splashSizes[i] = 0;
        } else {
          const p3 = i * 3;
          this.splashPositions[p3] += this.splashVelocities[p3] * delta;
          this.splashPositions[p3 + 1] += this.splashVelocities[p3 + 1] * delta;
          this.splashPositions[p3 + 2] += this.splashVelocities[p3 + 2] * delta;

          // Water gravity
          this.splashVelocities[p3 + 1] -= 18.0 * delta;

          // Ground bounce/splat
          if (this.splashPositions[p3 + 1] < 0.05) {
            this.splashPositions[p3 + 1] = 0.05;
            this.splashVelocities[p3 + 1] = -this.splashVelocities[p3 + 1] * 0.25;
            this.splashVelocities[p3] *= 0.5;
            this.splashVelocities[p3 + 2] *= 0.5;
          }

          this.splashSizes[i] = (1.0 - progress * 0.8) * 1.5;
        }
        needSplashUpdate = true;
      }
    }

    if (needSplashUpdate) {
      sPosAttr.needsUpdate = true;
      sSizeAttr.needsUpdate = true;
    }

    // 3. Update Puddle Ripples
    for (let i = 0; i < this.maxRipples; i++) {
      const rip = this.ripples[i];
      if (rip.age < rip.lifetime) {
        rip.age += delta;
        const progress = rip.age / rip.lifetime;
        if (progress >= 1.0) {
          rip.mesh.visible = false;
        } else {
          const scale = rip.baseScale + progress * (rip.maxScale - rip.baseScale);
          rip.mesh.scale.set(scale, scale, scale);
          rip.mesh.material.opacity = (1.0 - progress) * 0.75;
        }
      }
    }

    // 4. Update Drift Steam
    const stPosAttr = this.steamPoints.geometry.attributes.position;
    const stSizeAttr = this.steamPoints.geometry.attributes.size;
    const stOpacAttr = this.steamPoints.geometry.attributes.opacity;
    let needSteamUpdate = false;

    for (let i = 0; i < this.maxDriftSteam; i++) {
      if (this.steamAges[i] < this.steamLifetimes[i]) {
        this.steamAges[i] += delta;
        const progress = this.steamAges[i] / this.steamLifetimes[i];

        if (progress >= 1.0) {
          this.steamPositions[i * 3 + 1] = -999;
          this.steamOpacities[i] = 0;
        } else {
          const p3 = i * 3;
          this.steamPositions[p3] += this.steamVelocities[p3] * delta;
          this.steamPositions[p3 + 1] += this.steamVelocities[p3 + 1] * delta;
          this.steamPositions[p3 + 2] += this.steamVelocities[p3 + 2] * delta;

          this.steamSizes[i] *= (1.0 + 1.5 * delta);
          this.steamOpacities[i] = (1.0 - progress) * 0.55;
        }
        needSteamUpdate = true;
      }
    }

    if (needSteamUpdate) {
      stPosAttr.needsUpdate = true;
      stSizeAttr.needsUpdate = true;
      stOpacAttr.needsUpdate = true;
    }

    // 5. Update Screen Splashes (2D Canvas HUD)
    this.updateScreenDroplets(delta);
  }

  // Draw Camera Lens Droplets
  updateScreenDroplets(delta) {
    if (!this.screenCtx || !this.screenCanvas) return;
    const ctx = this.screenCtx;
    ctx.clearRect(0, 0, this.screenCanvas.width, this.screenCanvas.height);

    for (let i = this.screenSplashes.length - 1; i >= 0; i--) {
      const drop = this.screenSplashes[i];
      drop.life -= drop.decay * delta;
      drop.y += drop.speedY * delta;

      if (drop.life <= 0 || drop.y > this.screenCanvas.height + 50) {
        this.screenSplashes.splice(i, 1);
        continue;
      }

      const alpha = drop.opacity * drop.life;
      ctx.save();
      ctx.translate(drop.x, drop.y);

      // Droplet body with refraction ring
      const grad = ctx.createRadialGradient(-drop.radius * 0.3, -drop.radius * 0.3, 1, 0, 0, drop.radius);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
      grad.addColorStop(0.3, `rgba(210, 240, 255, ${alpha * 0.5})`);
      grad.addColorStop(0.8, `rgba(160, 210, 255, ${alpha * 0.2})`);
      grad.addColorStop(1, `rgba(100, 180, 240, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      // Teardrop / oval shape stretching slightly as it runs down
      ctx.ellipse(0, 0, drop.radius, drop.radius * 1.35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sharp glint
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(-drop.radius * 0.35, -drop.radius * 0.4, drop.radius * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}
