import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase'; // 'chase', 'hood', 'bumper', 'orbit'

    // Target positions and lookats
    this.currentPos = new THREE.Vector3(0, 5, -10);
    this.currentLookAt = new THREE.Vector3(0, 1, 0);

    // Chase Cam parameters
    this.chaseDistance = 6.8;
    this.chaseHeight = 2.4;
    this.baseFov = 62;
    this.targetFov = 62;

    // Camera shake
    this.shakeIntensity = 0;

    // Orbit angle for cinematic idle
    this.orbitAngle = 0;
  }

  cycleMode() {
    const modes = ['chase', 'hood', 'bumper'];
    const idx = modes.indexOf(this.mode);
    this.mode = modes[(idx + 1) % modes.length];
    return this.mode;
  }

  update(carPosition, carYaw, carSpeed, isNitro, isDrifting, delta) {
    const speedRatio = Math.min(1.0, Math.abs(carSpeed) / 75.0);

    // Dynamic FOV (Speed Warp zoom effect)
    this.targetFov = this.baseFov + (speedRatio * 14.0) + (isNitro ? 8.0 : 0.0);
    this.camera.fov += (this.targetFov - this.camera.fov) * 0.1;
    this.camera.updateProjectionMatrix();

    // Camera shake calculation (bumps and speed vibration)
    this.shakeIntensity = (speedRatio * 0.04) + (isDrifting ? 0.05 : 0.0) + (isNitro ? 0.06 : 0.0);
    const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * this.shakeIntensity;

    if (this.mode === 'chase') {
      // Dynamic Chase Cam with inertia lag
      const backOffset = this.chaseDistance + speedRatio * 1.5;
      const heightOffset = this.chaseHeight - (speedRatio * 0.3);

      const targetX = carPosition.x - Math.sin(carYaw) * backOffset;
      const targetY = carPosition.y + heightOffset;
      const targetZ = carPosition.z - Math.cos(carYaw) * backOffset;

      const targetPos = new THREE.Vector3(targetX + shakeX, targetY + shakeY, targetZ);
      this.currentPos.lerp(targetPos, 0.12);

      // Look slightly ahead of car
      const lookDist = 8.0 + speedRatio * 8.0;
      const lookTarget = new THREE.Vector3(
        carPosition.x + Math.sin(carYaw) * lookDist,
        carPosition.y + 0.8,
        carPosition.z + Math.cos(carYaw) * lookDist
      );
      this.currentLookAt.lerp(lookTarget, 0.15);

      this.camera.position.copy(this.currentPos);
      this.camera.lookAt(this.currentLookAt);

    } else if (this.mode === 'hood') {
      // Hood Cam: fast and low
      const hoodOffset = 0.5;
      const hoodY = 1.15;
      const posX = carPosition.x + Math.sin(carYaw) * hoodOffset;
      const posY = carPosition.y + hoodY;
      const posZ = carPosition.z + Math.cos(carYaw) * hoodOffset;

      this.camera.position.set(posX + shakeX, posY + shakeY, posZ);

      const lookTarget = new THREE.Vector3(
        carPosition.x + Math.sin(carYaw) * 25.0,
        carPosition.y + 1.0,
        carPosition.z + Math.cos(carYaw) * 25.0
      );
      this.camera.lookAt(lookTarget);

    } else if (this.mode === 'bumper') {
      // Bumper Cam: ultra low angle for maximum speed thrill
      const posX = carPosition.x + Math.sin(carYaw) * 1.8;
      const posY = carPosition.y + 0.35;
      const posZ = carPosition.z + Math.cos(carYaw) * 1.8;

      this.camera.position.set(posX + shakeX, posY + shakeY, posZ);

      const lookTarget = new THREE.Vector3(
        carPosition.x + Math.sin(carYaw) * 30.0,
        carPosition.y + 0.35,
        carPosition.z + Math.cos(carYaw) * 30.0
      );
      this.camera.lookAt(lookTarget);
    }
  }
}
