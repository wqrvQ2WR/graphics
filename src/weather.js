import * as THREE from 'three';
import { createRainStreakTexture } from './textures.js';

export class WeatherManager {
  constructor(scene) {
    this.scene = scene;

    this.rainCount = 5500;
    this.rainBoxSize = { x: 120, y: 50, z: 120 };
    this.rainFallSpeed = 48; // m/s downwards

    this.rainTexture = createRainStreakTexture();
    this.initRainSystem();

    // Lightning Flash
    this.lightningLight = new THREE.DirectionalLight(0xd0e8ff, 0);
    this.lightningLight.position.set(0, 100, 0);
    this.scene.add(this.lightningLight);

    this.nextLightningTime = 8 + Math.random() * 12;
    this.isLightning = false;
    this.lightningDuration = 0;
  }

  initRainSystem() {
    const geom = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(this.rainCount * 3);
    this.rainVelocities = new Float32Array(this.rainCount);

    for (let i = 0; i < this.rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * this.rainBoxSize.x;
      this.rainPositions[i * 3 + 1] = Math.random() * this.rainBoxSize.y;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * this.rainBoxSize.z;
      this.rainVelocities[i] = this.rainFallSpeed + Math.random() * 12;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    const rainMat = new THREE.PointsMaterial({
      size: 1.2,
      map: this.rainTexture,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.rainPoints = new THREE.Points(geom, rainMat);
    this.scene.add(this.rainPoints);
  }

  update(carPosition, carVelocity, delta, onThunder) {
    // 1. Move Rain Box with Car
    this.rainPoints.position.set(carPosition.x, 0, carPosition.z);

    const posAttr = this.rainPoints.geometry.attributes.position;
    const pos = posAttr.array;

    for (let i = 0; i < this.rainCount; i++) {
      const idx = i * 3;

      // Fall downwards
      pos[idx + 1] -= this.rainVelocities[i] * delta;

      // Angular slant from car speed
      pos[idx + 2] -= carVelocity.z * 0.15 * delta;
      pos[idx] -= carVelocity.x * 0.15 * delta;

      // Recycle raindrops hitting the ground
      if (pos[idx + 1] < 0) {
        pos[idx + 1] = this.rainBoxSize.y;
        pos[idx] = (Math.random() - 0.5) * this.rainBoxSize.x;
        pos[idx + 2] = (Math.random() - 0.5) * this.rainBoxSize.z;
      }
    }
    posAttr.needsUpdate = true;

    // 2. Lightning Flashes
    this.nextLightningTime -= delta;
    if (this.nextLightningTime <= 0) {
      this.isLightning = true;
      this.lightningDuration = 0.15 + Math.random() * 0.15;
      this.nextLightningTime = 12 + Math.random() * 20;
      if (onThunder) onThunder();
    }

    if (this.isLightning) {
      this.lightningDuration -= delta;
      if (this.lightningDuration > 0) {
        // Strobe flash
        this.lightningLight.intensity = (Math.random() > 0.3 ? 4.5 : 1.0);
      } else {
        this.lightningLight.intensity = 0;
        this.isLightning = false;
      }
    }
  }
}
