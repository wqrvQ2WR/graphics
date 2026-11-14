import * as THREE from 'three';

export class CarPhysics {
  constructor(carModel) {
    this.car = carModel;

    // Position & Orientation
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.heading = new THREE.Vector3(0, 0, 1);
    this.yaw = 0; // Car rotation around Y axis

    // Speed & Motion Dynamics
    this.speed = 0; // m/s forward speed
    this.maxSpeed = 75; // ~270 km/h
    this.maxReverseSpeed = -15; // ~54 km/h
    this.acceleration = 28; // m/s^2
    this.braking = 45; // m/s^2
    this.drag = 0.985; // air resistance
    this.lateralVelocity = 0;

    // Steering
    this.steerAngle = 0;
    this.maxSteerAngle = 0.58; // radians (~33 degrees)
    this.steerSpeed = 3.5;
    this.steerReturnSpeed = 5.0;

    // Drift Dynamics (Wet Asphalt Drifting!)
    this.slipAngle = 0;
    this.isDrifting = false;
    this.driftScore = 0;
    this.currentDriftScore = 0;
    this.driftMultiplier = 1;
    this.driftStreakTime = 0;

    // Nitro Boost
    this.nitro = 100; // 0 to 100%
    this.isNitroActive = false;
    this.nitroDrainRate = 25; // % per second
    this.nitroRechargeRate = 8; // % per second on drift/cruising

    // Transmission & Engine
    this.rpm = 900;
    this.gear = 1;
    this.gearRatios = [0, 3.8, 2.5, 1.8, 1.3, 1.0, 0.75]; // Gears 1-6
    this.gearMaxSpeeds = [0, 14, 26, 40, 54, 66, 80]; // m/s per gear

    // Inputs
    this.inputs = {
      throttle: false,
      brake: false,
      left: false,
      right: false,
      handbrake: false,
      nitro: false
    };

    this.setupControls();
  }

  setupControls() {
    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.inputs.throttle = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.inputs.brake = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.inputs.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.inputs.right = true;
          break;
        case 'Space':
          this.inputs.handbrake = true;
          e.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyN':
          this.inputs.nitro = true;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.inputs.throttle = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.inputs.brake = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.inputs.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.inputs.right = false;
          break;
        case 'Space':
          this.inputs.handbrake = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyN':
          this.inputs.nitro = false;
          break;
      }
    });
  }

  update(delta, onTurboRelease, onBackfire) {
    // 1. Steering Input
    let targetSteer = 0;
    if (this.inputs.left) targetSteer += this.maxSteerAngle;
    if (this.inputs.right) targetSteer -= this.maxSteerAngle;

    // High-speed steering dampening (speed-sensitive steering)
    const speedRatio = Math.abs(this.speed) / this.maxSpeed;
    const steerScale = Math.max(0.45, 1.0 - speedRatio * 0.45);
    targetSteer *= steerScale;

    if (targetSteer !== 0) {
      this.steerAngle += (targetSteer - this.steerAngle) * this.steerSpeed * delta;
    } else {
      this.steerAngle += (0 - this.steerAngle) * this.steerReturnSpeed * delta;
    }

    // 2. Nitro Boost Handling
    this.isNitroActive = false;
    let boostAccel = 1.0;
    if (this.inputs.nitro && this.nitro > 0 && this.speed > 3 && this.inputs.throttle) {
      this.isNitroActive = true;
      this.nitro = Math.max(0, this.nitro - this.nitroDrainRate * delta);
      boostAccel = 1.6;
    } else if (!this.inputs.nitro && this.nitro < 100) {
      // Natural recharge
      this.nitro = Math.min(100, this.nitro + this.nitroRechargeRate * 0.5 * delta);
    }

    // 3. Throttle & Braking
    const wasHighRPM = this.rpm > 6500;

    if (this.inputs.throttle) {
      if (this.speed >= 0) {
        const topLimit = this.isNitroActive ? this.maxSpeed * 1.25 : this.maxSpeed;
        const powerCurve = Math.max(0.2, 1.0 - Math.pow(this.speed / topLimit, 1.6));
        this.speed += this.acceleration * boostAccel * powerCurve * delta;
      } else {
        // Braking while going backward
        this.speed += this.braking * 1.2 * delta;
      }
    } else if (this.inputs.brake) {
      if (this.speed > 0.5) {
        this.speed -= this.braking * delta;
      } else {
        // Reverse gear
        this.speed -= this.acceleration * 0.55 * delta;
        if (this.speed < this.maxReverseSpeed) this.speed = this.maxReverseSpeed;
      }
    } else {
      // Coasting drag
      this.speed *= Math.pow(this.drag, delta * 60);
      if (Math.abs(this.speed) < 0.1) this.speed = 0;
    }

    // Check throttle liftoff for turbo sound & backfire
    if (!this.inputs.throttle && wasHighRPM && Math.random() < 0.25) {
      if (onTurboRelease) onTurboRelease();
      if (Math.random() < 0.4 && onBackfire) onBackfire();
    }

    // 4. Drift Mechanics (Wet Road Physics)
    const wetGripFactor = 0.94; // Wet asphalt has reduced lateral grip
    let corneringForce = (this.speed * Math.sin(this.steerAngle)) * 1.5;

    // Handbrake breaks traction immediately
    if (this.inputs.handbrake && Math.abs(this.speed) > 5) {
      this.slipAngle += this.steerAngle * 4.5 * delta;
      this.speed *= (1.0 - 0.35 * delta); // handbrake friction slows car
      this.isDrifting = true;
    } else if (Math.abs(this.steerAngle) > 0.25 && this.speed > 18) {
      // Power oversteer drift initiation
      this.slipAngle += (this.steerAngle * 2.2 - this.slipAngle) * 3.5 * delta;
      this.isDrifting = Math.abs(this.slipAngle) > 0.18;
    } else {
      // Traction recovery
      this.slipAngle *= Math.pow(0.85, delta * 60);
      if (Math.abs(this.slipAngle) < 0.05) {
        this.slipAngle = 0;
        this.isDrifting = false;
      }
    }

    // Clamp max slip angle
    this.slipAngle = Math.max(-0.95, Math.min(0.95, this.slipAngle));

    // 5. Yaw & Orientation Update
    const turnRate = (this.speed * Math.tan(this.steerAngle) / 2.8) + (this.slipAngle * 2.5);
    this.yaw += turnRate * delta;

    // Calculate heading vector
    this.heading.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));

    // Calculate actual movement velocity vector (blending heading and slip angle)
    const moveAngle = this.yaw + this.slipAngle * 0.7;
    this.velocity.set(
      Math.sin(moveAngle) * this.speed,
      0,
      Math.cos(moveAngle) * this.speed
    );

    // Apply movement
    this.position.addScaledVector(this.velocity, delta);

    // Boundary constraints: Keep car on the multi-lane wet highway (X between -15 and 15)
    if (this.position.x < -14.5) {
      this.position.x = -14.5;
      this.velocity.x *= -0.2;
      this.yaw += 0.05;
    } else if (this.position.x > 14.5) {
      this.position.x = 14.5;
      this.velocity.x *= -0.2;
      this.yaw -= 0.05;
    }

    // Update Car 3D Mesh Transform
    this.car.group.position.copy(this.position);
    this.car.group.rotation.y = this.yaw;

    // 6. Drift Scoring & Nitro Reward
    if (this.isDrifting && Math.abs(this.speed) > 10) {
      this.driftStreakTime += delta;
      this.driftMultiplier = Math.min(5, Math.floor(this.driftStreakTime * 0.8) + 1);
      const points = Math.floor(Math.abs(this.slipAngle) * this.speed * 8 * this.driftMultiplier * delta);
      this.currentDriftScore += points;
      this.driftScore += points;

      // Drifting recharges Nitro rapidly!
      this.nitro = Math.min(100, this.nitro + this.nitroRechargeRate * 2.5 * delta);
    } else {
      if (this.driftStreakTime > 0.5) {
        // Drift ended successfully
        this.driftStreakTime = 0;
        this.currentDriftScore = 0;
      }
    }

    // 7. Transmission Gears & Engine RPM Calculation
    this.calculateGearAndRPM();

    // 8. Update Visuals
    const isBraking = this.inputs.brake && this.speed > 0;
    this.car.updateVisuals(
      this.speed,
      this.steerAngle,
      this.slipAngle,
      isBraking,
      this.isNitroActive,
      delta
    );
  }

  calculateGearAndRPM() {
    if (this.speed < -0.1) {
      this.gear = -1; // Reverse
      this.rpm = 1000 + (Math.abs(this.speed) / Math.abs(this.maxReverseSpeed)) * 5000;
      return;
    }

    const currentSpeed = Math.max(0, this.speed);
    // Find matching gear
    let g = 1;
    for (let i = 1; i <= 6; i++) {
      if (currentSpeed < this.gearMaxSpeeds[i]) {
        g = i;
        break;
      }
      g = 6;
    }
    this.gear = g;

    // Calculate RPM inside current gear
    const minSpeedInGear = this.gear === 1 ? 0 : this.gearMaxSpeeds[this.gear - 1];
    const maxSpeedInGear = this.gearMaxSpeeds[this.gear];
    const gearFraction = Math.max(0, Math.min(1, (currentSpeed - minSpeedInGear) / (maxSpeedInGear - minSpeedInGear)));

    const idleRPM = 950;
    const maxRPM = 8800;
    this.rpm = idleRPM + gearFraction * (maxRPM - idleRPM);

    if (this.inputs.throttle && this.speed < 2) {
      // Revving in place
      this.rpm = Math.min(8500, this.rpm + 4000);
    }
  }

  reset() {
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.speed = 0;
    this.slipAngle = 0;
    this.steerAngle = 0;
    this.isDrifting = false;
    this.nitro = 100;
    this.driftStreakTime = 0;
    this.currentDriftScore = 0;
  }
}
