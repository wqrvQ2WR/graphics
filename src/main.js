import * as THREE from 'three';
import { SuperCar } from './car.js';
import { CarPhysics } from './physics.js';
import { EnvironmentManager } from './environment.js';
import { WaterEffectsManager } from './waterEffects.js';
import { WeatherManager } from './weather.js';
import { SoundManager } from './audio.js';
import { CameraController } from './camera.js';
import { PostProcessingManager } from './postprocessing.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.clock = new THREE.Clock();

    // 1. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // 2. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
    this.cameraController = new CameraController(this.camera);

    // 3. Post-Processing Pipeline (Bloom, Motion Blur, Speed Warp)
    this.postProcessing = new PostProcessingManager(this.renderer, this.scene, this.camera);

    // 4. Subsystems
    this.sound = new SoundManager();
    this.car = new SuperCar(this.scene);
    this.physics = new CarPhysics(this.car);
    this.environment = new EnvironmentManager(this.scene);
    this.waterEffects = new WaterEffectsManager(this.scene);
    this.weather = new WeatherManager(this.scene);

    // 5. HUD DOM Elements
    this.initHUD();

    // 6. Event Listeners
    this.initEvents();

    // 7. Start Game Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initHUD() {
    this.speedValEl = document.getElementById('speed-val');
    this.gearValEl = document.getElementById('gear-val');
    this.rpmValEl = document.getElementById('rpm-val');
    this.rpmCircleEl = document.getElementById('rpm-circle');
    this.nitroFillEl = document.getElementById('nitro-fill');
    this.driftContainerEl = document.getElementById('drift-container');
    this.driftPointsEl = document.getElementById('drift-points');
    this.driftMultEl = document.getElementById('drift-mult');
    this.camBtn = document.getElementById('btn-camera');
    this.soundBtn = document.getElementById('btn-sound');
    this.soundIcon = document.getElementById('sound-icon');
    this.resetBtn = document.getElementById('btn-reset');
    this.customizerBtn = document.getElementById('btn-customizer');
    this.paletteBox = document.getElementById('palette-box');
    this.startOverlay = document.getElementById('start-overlay');
  }

  initEvents() {
    // Window Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.postProcessing.resize(window.innerWidth, window.innerHeight);
    });

    // Start Engine Overlay Click
    this.startOverlay.addEventListener('click', () => {
      this.sound.resume();
      this.startOverlay.style.opacity = '0';
      setTimeout(() => {
        this.startOverlay.style.display = 'none';
      }, 500);
    });

    // Camera Switch Button & 'C' Key
    const cycleCam = () => {
      const mode = this.cameraController.cycleMode();
      this.camBtn.querySelector('span').textContent = `📷 CAM: ${mode.toUpperCase()} [C]`;
    };

    this.camBtn.addEventListener('click', cycleCam);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyC') cycleCam();
      if (e.code === 'KeyR') this.resetCar();
    });

    // Sound Toggle Button
    this.soundBtn.addEventListener('click', () => {
      const isMuted = this.sound.toggleMute();
      this.soundIcon.textContent = isMuted ? '🔇' : '🔊';
    });

    // Reset Button
    this.resetBtn.addEventListener('click', () => this.resetCar());

    // Customizer Drawer Toggle
    this.customizerBtn.addEventListener('click', () => {
      this.paletteBox.classList.toggle('open');
    });

    // Color Swatches
    document.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        const type = e.target.dataset.type;
        const color = parseInt(e.target.dataset.color, 16);
        if (type === 'paint') {
          this.car.setPaintColor(color);
        } else if (type === 'neon') {
          this.car.setUnderglowColor(color);
        }
      });
    });
  }

  resetCar() {
    this.physics.reset();
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = Math.min(0.05, this.clock.getDelta());
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Update Physics
    this.physics.update(
      delta,
      () => this.sound.playTurboBOV(),
      () => this.sound.playBackfire()
    );

    const speedRatio = Math.min(1.0, Math.abs(this.physics.speed) / this.physics.maxSpeed);

    // 2. Tire Water Spray & Puddle Splashes
    const wheels = this.car.getWheelWorldPositions();
    wheels.forEach(wheel => {
      // Continuous Tire Spray Roostertails
      this.waterEffects.emitTireSpray(wheel.pos, this.physics.velocity, speedRatio, true);

      // Puddle Collision Test
      const puddleCheck = this.environment.checkPuddles(wheel.pos);
      if (puddleCheck.hit) {
        this.waterEffects.triggerPuddleSplash(
          wheel.pos,
          this.physics.velocity,
          speedRatio * (0.6 + puddleCheck.intensity * 0.6),
          (intensity) => this.sound.playWaterSplash(intensity)
        );
      }

      // Drift Steam from rear wheels
      if (!wheel.isFront && this.physics.isDrifting) {
        this.waterEffects.emitDriftSteam(wheel.pos, this.physics.slipAngle, speedRatio);
      }
    });

    // 3. Update Audio Synthesizer
    const throttleVal = this.physics.inputs.throttle ? 1.0 : (this.physics.inputs.brake ? -0.5 : 0.0);
    this.sound.updateEngine(this.physics.rpm, Math.max(0, throttleVal), this.physics.gear, this.physics.isNitroActive);
    this.sound.updateDrift(Math.abs(this.physics.slipAngle), speedRatio);

    // 4. Update Water Particles & HUD Droplets
    this.waterEffects.update(delta);

    // 5. Update Environment & Looping Track
    this.environment.update(this.physics.position.z, elapsedTime, delta);

    // 6. Update Weather & Rain
    this.weather.update(
      this.physics.position,
      this.physics.velocity,
      delta,
      () => {}
    );

    // 7. Update Camera
    this.cameraController.update(
      this.physics.position,
      this.physics.yaw,
      this.physics.speed,
      this.physics.isNitroActive,
      this.physics.isDrifting,
      delta
    );

    // 8. Update Post-Processing Effects
    this.postProcessing.update(speedRatio, this.physics.isNitroActive, elapsedTime);

    // 9. Update HUD Instruments
    this.updateHUD(speedRatio);

    // 10. Render Frame via Postprocessing Composer
    this.postProcessing.render();
  }

  updateHUD(speedRatio) {
    // Speed km/h
    const kmh = Math.max(0, Math.round(this.physics.speed * 3.6));
    this.speedValEl.textContent = kmh;

    // Gear
    if (this.physics.gear === -1) {
      this.gearValEl.textContent = 'REVERSE';
      this.gearValEl.style.color = '#ff4444';
    } else {
      this.gearValEl.textContent = `GEAR ${this.physics.gear}`;
      this.gearValEl.style.color = '#ffaa00';
    }

    // RPM
    const rpm = Math.round(this.physics.rpm);
    this.rpmValEl.textContent = `${rpm} RPM`;

    // Circular RPM gauge (Circumference = 2 * PI * 85 = 534)
    const rpmFraction = Math.max(0, Math.min(1.0, (rpm - 900) / (8800 - 900)));
    const offset = 534 - (rpmFraction * 534);
    this.rpmCircleEl.style.strokeDashoffset = offset;

    // Change RPM color on redline
    if (rpm > 7800) {
      this.rpmCircleEl.style.stroke = '#ff0033';
    } else if (rpm > 6200) {
      this.rpmCircleEl.style.stroke = '#ffaa00';
    } else {
      this.rpmCircleEl.style.stroke = '#00f0ff';
    }

    // Nitro Bar
    this.nitroFillEl.style.height = `${this.physics.nitro}%`;
    if (this.physics.isNitroActive) {
      this.nitroFillEl.classList.add('boosting');
    } else {
      this.nitroFillEl.classList.remove('boosting');
    }

    // Drift Score Notification
    if (this.physics.isDrifting && Math.abs(this.physics.speed) > 10) {
      this.driftContainerEl.classList.add('active');
      this.driftPointsEl.textContent = `+${this.physics.currentDriftScore.toLocaleString()}`;
      this.driftMultEl.textContent = `x${this.physics.driftMultiplier} COMBO`;
    } else {
      this.driftContainerEl.classList.remove('active');
    }
  }
}

// Start Game on Page Load
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
