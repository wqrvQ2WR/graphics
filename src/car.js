import * as THREE from 'three';
import { createBrakeDiscTexture, createTireTreadTexture } from './textures.js';

export class SuperCar {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    // Wheel Meshes for animation
    this.wheels = [];
    this.frontWheelDummies = []; // For steering rotation
    this.rearWheelDummies = [];

    // Lighting elements on the car
    this.headlights = [];
    this.headlightSpotlights = [];
    this.headlightBeams = [];
    this.taillightMat = null;
    this.taillightPointLight = null;
    this.underglowLight = null;

    // Nitro exhaust flames
    this.flameMeshes = [];

    // Textures
    this.brakeDiscTex = createBrakeDiscTexture();
    this.tireTreadTex = createTireTreadTexture();

    this.buildCar();
    this.scene.add(this.group);
  }

  buildCar() {
    // === 1. CAR BODY & MATERIALS ===
    // Metallic clearcoat paint
    this.bodyPaintMat = new THREE.MeshPhysicalMaterial({
      color: 0x0d1b2a, // Deep Cyber Midnight Blue / Obsidian
      metalness: 0.85,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 1.0
    });

    // Matte / Gloss Carbon Fiber
    this.carbonMat = new THREE.MeshStandardMaterial({
      color: 0x111114,
      metalness: 0.3,
      roughness: 0.35
    });

    // Tinted Glass
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x050a10,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.6,
      transparent: true,
      opacity: 0.88
    });

    // Chrome / Polished Metal
    this.chromeMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      metalness: 0.95,
      roughness: 0.1
    });

    // Dark trim
    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1e,
      roughness: 0.6
    });

    // Car Body Main Chassis Group
    this.chassis = new THREE.Group();
    this.chassis.position.y = 0.38; // Suspension height above ground
    this.group.add(this.chassis);

    // Main Lower Fuselage
    const baseGeom = new THREE.BoxGeometry(1.95, 0.45, 4.3);
    const baseMesh = new THREE.Mesh(baseGeom, this.bodyPaintMat);
    baseMesh.position.set(0, 0.22, 0);
    this.chassis.add(baseMesh);

    // Sloped Front Hood & Nose
    const hoodGeom = new THREE.CylinderGeometry(0.85, 0.98, 1.4, 4);
    hoodGeom.rotateY(Math.PI / 4);
    hoodGeom.rotateX(-Math.PI / 16);
    const hoodMesh = new THREE.Mesh(hoodGeom, this.bodyPaintMat);
    hoodMesh.scale.set(1.95, 0.35, 1.0);
    hoodMesh.position.set(0, 0.36, 1.35);
    this.chassis.add(hoodMesh);

    // Front Aerodynamic Splitter (Carbon)
    const splitterGeom = new THREE.BoxGeometry(2.05, 0.06, 0.6);
    const splitter = new THREE.Mesh(splitterGeom, this.carbonMat);
    splitter.position.set(0, 0.04, 2.15);
    this.chassis.add(splitter);

    // Front Bumper Air Intake Grilles
    const intakeGeom = new THREE.BoxGeometry(1.5, 0.22, 0.1);
    const intake = new THREE.Mesh(intakeGeom, darkTrimMat);
    intake.position.set(0, 0.18, 2.16);
    this.chassis.add(intake);

    // Cabin / Roof Canopy
    const cabinGeom = new THREE.BoxGeometry(1.5, 0.48, 2.1);
    const cabin = new THREE.Mesh(cabinGeom, glassMat);
    cabin.position.set(0, 0.64, -0.2);
    this.chassis.add(cabin);

    // Roof Top Panel
    const roofGeom = new THREE.BoxGeometry(1.42, 0.05, 1.7);
    const roof = new THREE.Mesh(roofGeom, this.bodyPaintMat);
    roof.position.set(0, 0.89, -0.25);
    this.chassis.add(roof);

    // Sloped Windshield Frame (A-Pillars)
    const pillarGeom = new THREE.BoxGeometry(0.08, 0.55, 0.08);
    const leftPillar = new THREE.Mesh(pillarGeom, this.bodyPaintMat);
    leftPillar.position.set(-0.72, 0.62, 0.7);
    leftPillar.rotation.x = -Math.PI / 5;
    this.chassis.add(leftPillar);

    const rightPillar = leftPillar.clone();
    rightPillar.position.x = 0.72;
    this.chassis.add(rightPillar);

    // Side Skirts (Carbon)
    const skirtGeom = new THREE.BoxGeometry(0.12, 0.08, 2.4);
    const leftSkirt = new THREE.Mesh(skirtGeom, this.carbonMat);
    leftSkirt.position.set(-1.02, 0.08, 0);
    this.chassis.add(leftSkirt);

    const rightSkirt = leftSkirt.clone();
    rightSkirt.position.x = 1.02;
    this.chassis.add(rightSkirt);

    // Rear Diffuser (Carbon)
    const diffuserGeom = new THREE.BoxGeometry(1.85, 0.15, 0.5);
    const diffuser = new THREE.Mesh(diffuserGeom, this.carbonMat);
    diffuser.position.set(0, 0.12, -2.15);
    diffuser.rotation.x = Math.PI / 14;
    this.chassis.add(diffuser);

    // GT Wing Spoiler
    const wingGeom = new THREE.BoxGeometry(1.9, 0.04, 0.38);
    const wing = new THREE.Mesh(wingGeom, this.carbonMat);
    wing.position.set(0, 0.88, -2.05);

    const strutGeom = new THREE.BoxGeometry(0.04, 0.35, 0.12);
    const leftStrut = new THREE.Mesh(strutGeom, this.carbonMat);
    leftStrut.position.set(-0.6, 0.7, -2.0);
    const rightStrut = leftStrut.clone();
    rightStrut.position.x = 0.6;

    this.chassis.add(wing);
    this.chassis.add(leftStrut);
    this.chassis.add(rightStrut);

    // Side Mirrors
    const mirrorGeom = new THREE.BoxGeometry(0.22, 0.1, 0.14);
    const leftMirror = new THREE.Mesh(mirrorGeom, this.carbonMat);
    leftMirror.position.set(-1.05, 0.62, 0.65);
    this.chassis.add(leftMirror);

    const rightMirror = leftMirror.clone();
    rightMirror.position.x = 1.05;
    this.chassis.add(rightMirror);

    // === 2. LIGHTING & VOLUMETRIC BEAMS ===
    // Headlights (Dual Projector LED Blocks)
    const headlightMat = new THREE.MeshBasicMaterial({
      color: 0x88f5ff // Brilliant icy cyan
    });

    const hlGeom = new THREE.BoxGeometry(0.38, 0.09, 0.08);
    const leftHL = new THREE.Mesh(hlGeom, headlightMat);
    leftHL.position.set(-0.7, 0.32, 2.14);
    this.chassis.add(leftHL);

    const rightHL = leftHL.clone();
    rightHL.position.x = 0.7;
    this.chassis.add(rightHL);

    // Real-time Spotlights projecting onto the wet road
    const createSpot = (x) => {
      const spot = new THREE.SpotLight(0xa5f0ff, 8.0, 65, Math.PI / 5.5, 0.45, 1.2);
      spot.position.set(x, 0.35, 2.1);
      const target = new THREE.Object3D();
      target.position.set(x * 0.5, 0, 25);
      this.chassis.add(spot);
      this.chassis.add(target);
      spot.target = target;
      return spot;
    };

    this.headlightSpotlights.push(createSpot(-0.7));
    this.headlightSpotlights.push(createSpot(0.7));

    // Volumetric Headlight Light Cones (Mist light scattering)
    const coneGeom = new THREE.ConeGeometry(3.5, 22, 16, 1, true);
    coneGeom.rotateX(Math.PI / 2);
    coneGeom.translate(0, 0, 11);

    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x33b0ff,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const leftCone = new THREE.Mesh(coneGeom, coneMat);
    leftCone.position.set(-0.7, 0.3, 2.1);
    this.chassis.add(leftCone);
    this.headlightBeams.push(leftCone);

    const rightCone = leftCone.clone();
    rightCone.position.x = 0.7;
    this.chassis.add(rightCone);
    this.headlightBeams.push(rightCone);

    // Rear Taillights: Full-width continuous Cyberpunk LED bar
    this.taillightMat = new THREE.MeshBasicMaterial({
      color: 0xff0028 // Intense red
    });

    const tlGeom = new THREE.BoxGeometry(1.85, 0.08, 0.05);
    const tailBar = new THREE.Mesh(tlGeom, this.taillightMat);
    tailBar.position.set(0, 0.42, -2.16);
    this.chassis.add(tailBar);

    // Rear Point Light reflecting off road behind
    this.taillightPointLight = new THREE.PointLight(0xff0022, 2.5, 12, 1.5);
    this.taillightPointLight.position.set(0, 0.4, -2.4);
    this.chassis.add(this.taillightPointLight);

    // Underglow Neon (Cyan/Blue ground illumination)
    this.underglowLight = new THREE.PointLight(0x00f0ff, 4.0, 6.0, 1.8);
    this.underglowLight.position.set(0, -0.15, 0);
    this.chassis.add(this.underglowLight);

    // Underglow glowing neon tubes
    const tubeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const tubeGeom = new THREE.CylinderGeometry(0.02, 0.02, 2.4);
    tubeGeom.rotateZ(Math.PI / 2);

    const leftTube = new THREE.Mesh(tubeGeom, tubeMat);
    leftTube.position.set(-0.85, -0.05, 0);
    this.chassis.add(leftTube);

    const rightTube = leftTube.clone();
    rightTube.position.x = 0.85;
    this.chassis.add(rightTube);

    // Dual Exhaust Tips
    const pipeGeom = new THREE.CylinderGeometry(0.07, 0.07, 0.25, 16);
    pipeGeom.rotateX(Math.PI / 2);

    const leftPipe = new THREE.Mesh(pipeGeom, this.chromeMat);
    leftPipe.position.set(-0.45, 0.16, -2.15);
    this.chassis.add(leftPipe);

    const rightPipe = leftPipe.clone();
    rightPipe.position.x = 0.45;
    this.chassis.add(rightPipe);

    // Nitro Flame Cones (hidden by default)
    const flameGeom = new THREE.ConeGeometry(0.14, 0.8, 12);
    flameGeom.rotateX(-Math.PI / 2);
    flameGeom.translate(0, 0, -0.4);

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });

    const leftFlame = new THREE.Mesh(flameGeom, flameMat);
    leftFlame.position.set(-0.45, 0.16, -2.25);
    this.chassis.add(leftFlame);
    this.flameMeshes.push(leftFlame);

    const rightFlame = new THREE.Mesh(flameGeom, flameMat.clone());
    rightFlame.position.set(0.45, 0.16, -2.25);
    this.chassis.add(rightFlame);
    this.flameMeshes.push(rightFlame);

    // === 3. WHEELS & BRAKE CALIPERS ===
    this.buildWheels();
  }

  buildWheels() {
    const wheelRadius = 0.38;
    const wheelWidth = 0.32;

    // Tire Material
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x121212,
      roughness: 0.85,
      metalness: 0.1,
      bumpMap: this.tireTreadTex,
      bumpScale: 0.04
    });

    // Rim Material (Forged alloy)
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x22242a,
      metalness: 0.9,
      roughness: 0.2
    });

    // Brake Disc Material
    const discMat = new THREE.MeshStandardMaterial({
      map: this.brakeDiscTex,
      metalness: 0.85,
      roughness: 0.25,
      side: THREE.DoubleSide
    });

    // Brake Caliper Material (Brembo Gloss Red)
    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0xee1122,
      metalness: 0.4,
      roughness: 0.2
    });

    const positions = [
      { name: 'FL', x: -0.96, y: wheelRadius, z: 1.35, isFront: true },
      { name: 'FR', x: 0.96, y: wheelRadius, z: 1.35, isFront: true },
      { name: 'RL', x: -0.98, y: wheelRadius, z: -1.35, isFront: false },
      { name: 'RR', x: 0.98, y: wheelRadius, z: -1.35, isFront: false }
    ];

    positions.forEach(pos => {
      // Dummy for steering pivot (Z-aligned rotation)
      const pivot = new THREE.Group();
      pivot.position.set(pos.x, pos.y, pos.z);
      this.group.add(pivot);

      // Rotating Wheel Group (rotates along X-axis when driving)
      const wheelRot = new THREE.Group();
      pivot.add(wheelRot);

      // Tire Outer Ring
      const tireGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24);
      tireGeom.rotateZ(Math.PI / 2);
      const tireMesh = new THREE.Mesh(tireGeom, tireMat);
      wheelRot.add(tireMesh);

      // Alloy Rim
      const rimGeom = new THREE.CylinderGeometry(wheelRadius * 0.78, wheelRadius * 0.78, wheelWidth * 0.95, 18);
      rimGeom.rotateZ(Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimGeom, rimMat);
      wheelRot.add(rimMesh);

      // Multi-spoke star geometry
      for (let s = 0; s < 5; s++) {
        const spokeGeom = new THREE.BoxGeometry(wheelWidth * 0.98, 0.05, wheelRadius * 0.72);
        spokeGeom.rotateX((s / 5) * Math.PI);
        const spoke = new THREE.Mesh(spokeGeom, this.chromeMat);
        wheelRot.add(spoke);
      }

      // Slotted Brake Rotor Disc
      const discGeom = new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, 0.02, 24);
      discGeom.rotateZ(Math.PI / 2);
      const discMesh = new THREE.Mesh(discGeom, discMat);
      wheelRot.add(discMesh);

      // Red Brake Caliper (does NOT rotate with wheel, stays stationary with pivot)
      const caliperGeom = new THREE.BoxGeometry(0.12, 0.16, 0.22);
      const caliper = new THREE.Mesh(caliperGeom, caliperMat);
      caliper.position.set(pos.x > 0 ? -0.06 : 0.06, wheelRadius * 0.28, 0);
      pivot.add(caliper);

      this.wheels.push({
        name: pos.name,
        pivot,
        rotGroup: wheelRot,
        isFront: pos.isFront,
        localPos: new THREE.Vector3(pos.x, pos.y, pos.z)
      });

      if (pos.isFront) {
        this.frontWheelDummies.push(pivot);
      } else {
        this.rearWheelDummies.push(pivot);
      }
    });
  }

  // Update wheel spin, steering angle, suspension lean, lighting
  updateVisuals(speed, steerAngle, driftAngle, isBraking, isNitro, delta) {
    // 1. Wheel Spin
    const rotationAmount = (speed * delta) / 0.38; // v = omega * r
    this.wheels.forEach(w => {
      w.rotGroup.rotation.x += rotationAmount;
    });

    // 2. Front Wheel Steering
    this.frontWheelDummies.forEach(d => {
      d.rotation.y = steerAngle;
    });

    // 3. Body Roll & Pitch (Chassis dynamic suspension movement)
    // Lateral roll during sharp turns
    const targetRoll = -steerAngle * (speed / 35.0) * 0.12;
    this.chassis.rotation.z += (targetRoll - this.chassis.rotation.z) * 0.18;

    // Pitch: squats on throttle, dives forward on braking
    const targetPitch = (isBraking ? -0.06 : 0.03 * (speed / 40.0));
    this.chassis.rotation.x += (targetPitch - this.chassis.rotation.x) * 0.15;

    // 4. Taillight / Braking glow
    if (isBraking) {
      this.taillightMat.color.setHex(0xff1100);
      this.taillightPointLight.intensity = 8.0;
    } else {
      this.taillightMat.color.setHex(0xaa0015);
      this.taillightPointLight.intensity = 2.0;
    }

    // 5. Nitro Exhaust Flames
    this.flameMeshes.forEach(flame => {
      if (isNitro) {
        flame.material.opacity = 0.85 + Math.random() * 0.15;
        const scaleZ = 1.0 + Math.random() * 0.7;
        flame.scale.set(1.0 + Math.random() * 0.3, 1.0 + Math.random() * 0.3, scaleZ);
        flame.material.color.set(Math.random() > 0.4 ? 0x00f0ff : 0x0077ff);
      } else {
        flame.material.opacity = 0;
      }
    });
  }

  // Get world positions of all 4 tires (for water spray emitters)
  getWheelWorldPositions() {
    const worldPositions = [];
    const tempVec = new THREE.Vector3();
    this.wheels.forEach(w => {
      w.pivot.getWorldPosition(tempVec);
      worldPositions.push({
        name: w.name,
        isFront: w.isFront,
        pos: tempVec.clone()
      });
    });
    return worldPositions;
  }

  // Paint color customizer
  setPaintColor(hex) {
    this.bodyPaintMat.color.setHex(hex);
  }

  setUnderglowColor(hex) {
    this.underglowLight.color.setHex(hex);
  }
}
