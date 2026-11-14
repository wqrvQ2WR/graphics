import * as THREE from 'three';
import {
  createAsphaltTextures,
  createNeonBillboardTextures
} from './textures.js';

export class EnvironmentManager {
  constructor(scene) {
    this.scene = scene;

    // Track Dimensions
    this.roadWidth = 32;
    this.segmentLength = 300;
    this.numSegments = 6; // Total active track length = 1800m
    this.segments = [];

    // Billboards and Lighting
    this.billboardTextures = createNeonBillboardTextures();
    this.animatedLights = [];
    this.searchlights = [];

    // Puddle definitions (in track local coordinates)
    this.puddles = [];

    // Textures
    const { diffTex, roughTex, normTex } = createAsphaltTextures();
    this.asphaltDiff = diffTex;
    this.asphaltRough = roughTex;
    this.asphaltNorm = normTex;

    // Repeat textures along the road
    this.asphaltDiff.repeat.set(1, 15);
    this.asphaltRough.repeat.set(1, 15);
    this.asphaltNorm.repeat.set(1, 15);

    // Setup Track Segments
    this.buildTrack();

    // Setup Cyberpunk Skyline
    this.buildCitySkyline();

    // Setup Ambient Lighting
    this.setupLighting();
  }

  setupLighting() {
    // Atmospheric deep blue ambient light
    const ambient = new THREE.AmbientLight(0x0a1226, 1.8);
    this.scene.add(ambient);

    // Moonlight / distant cyber twilight
    const dirLight = new THREE.DirectionalLight(0x2a4575, 1.2);
    dirLight.position.set(50, 100, 50);
    this.scene.add(dirLight);

    // Cyberpunk Atmospheric Fog
    this.scene.fog = new THREE.FogExp2(0x060914, 0.0035);
  }

  buildTrack() {
    // Wet Road Material with high specular clearcoat
    this.roadMaterial = new THREE.MeshPhysicalMaterial({
      map: this.asphaltDiff,
      roughnessMap: this.asphaltRough,
      normalMap: this.asphaltNorm,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.25,
      metalness: 0.15,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
      reflectivity: 0.95
    });

    // Guardrail Material (Galvanized metal with cat-eye reflectors)
    this.guardrailMat = new THREE.MeshStandardMaterial({
      color: 0x8899aa,
      metalness: 0.85,
      roughness: 0.25
    });

    // Create modular track segments
    for (let i = 0; i < this.numSegments; i++) {
      const zOffset = (i - 1) * this.segmentLength;
      const segment = this.createTrackSegment(zOffset);
      this.segments.push(segment);
    }
  }

  createTrackSegment(zPos) {
    const group = new THREE.Group();
    group.position.z = zPos;

    // 1. Asphalt Road Plane
    const roadGeom = new THREE.PlaneGeometry(this.roadWidth, this.segmentLength, 1, 1);
    roadGeom.rotateX(-Math.PI / 2);
    const roadMesh = new THREE.Mesh(roadGeom, this.roadMaterial);
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // 2. Concrete Shoulder & Curbs
    const curbGeom = new THREE.BoxGeometry(1.5, 0.25, this.segmentLength);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.8 });

    const leftCurb = new THREE.Mesh(curbGeom, curbMat);
    leftCurb.position.set(-this.roadWidth / 2 - 0.75, 0.1, 0);
    group.add(leftCurb);

    const rightCurb = leftCurb.clone();
    rightCurb.position.x = this.roadWidth / 2 + 0.75;
    group.add(rightCurb);

    // 3. Guard Rails
    const railGeom = new THREE.BoxGeometry(0.2, 0.6, this.segmentLength);
    const leftRail = new THREE.Mesh(railGeom, this.guardrailMat);
    leftRail.position.set(-this.roadWidth / 2 - 1.2, 0.5, 0);
    group.add(leftRail);

    const rightRail = leftRail.clone();
    rightRail.position.x = this.roadWidth / 2 + 1.2;
    group.add(rightRail);

    // 4. Streetlights (Every 50m along both sides)
    const poleGeom = new THREE.CylinderGeometry(0.12, 0.18, 9, 8);
    const armGeom = new THREE.BoxGeometry(3.5, 0.12, 0.12);
    const lampHeadGeom = new THREE.BoxGeometry(0.8, 0.15, 0.4);

    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 }); // Warm sodium or cyan light
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333339, metalness: 0.7, roughness: 0.3 });

    // Volumetric Cone for Streetlights
    const lightConeGeom = new THREE.ConeGeometry(5.5, 9, 16, 1, true);
    lightConeGeom.translate(0, -4.5, 0);
    const lightConeMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    for (let z = -this.segmentLength / 2 + 25; z < this.segmentLength / 2; z += 50) {
      // Left Streetlight
      const leftPole = new THREE.Mesh(poleGeom, poleMat);
      leftPole.position.set(-this.roadWidth / 2 - 2.5, 4.5, z);
      const leftArm = new THREE.Mesh(armGeom, poleMat);
      leftArm.position.set(1.5, 4.3, 0);
      leftPole.add(leftArm);

      const leftLamp = new THREE.Mesh(lampHeadGeom, lampMat);
      leftLamp.position.set(3.0, 4.25, 0);
      leftPole.add(leftLamp);

      const leftCone = new THREE.Mesh(lightConeGeom, lightConeMat);
      leftCone.position.set(3.0, 4.25, 0);
      leftPole.add(leftCone);

      // Real PointLight pool on road
      const leftLight = new THREE.PointLight(0xffa834, 1.8, 22, 1.6);
      leftLight.position.set(3.0, 4.0, 0);
      leftPole.add(leftLight);

      group.add(leftPole);

      // Right Streetlight
      const rightPole = new THREE.Mesh(poleGeom, poleMat);
      rightPole.position.set(this.roadWidth / 2 + 2.5, 4.5, z);
      const rightArm = new THREE.Mesh(armGeom, poleMat);
      rightArm.position.set(-1.5, 4.3, 0);
      rightPole.add(rightArm);

      const rightLamp = new THREE.Mesh(lampHeadGeom, lampMat);
      rightLamp.position.set(-3.0, 4.25, 0);
      rightPole.add(rightLamp);

      const rightCone = new THREE.Mesh(lightConeGeom, lightConeMat);
      rightCone.position.set(-3.0, 4.25, 0);
      rightPole.add(rightCone);

      const rightLight = new THREE.PointLight(0xffa834, 1.8, 22, 1.6);
      rightLight.position.set(-3.0, 4.0, 0);
      rightPole.add(rightLight);

      group.add(rightPole);
    }

    // 5. Giant Neon Billboards & Overhead Highway Gantries
    this.addSegmentDecorations(group);

    // 6. Generate Puddle Hit-boxes for this segment
    this.generateSegmentPuddles(zPos);

    this.scene.add(group);
    return { group, zPos };
  }

  addSegmentDecorations(group) {
    // Overhead Highway Gantry Bridge
    const gantryGeom = new THREE.BoxGeometry(this.roadWidth + 4, 1.2, 0.8);
    const gantryLegGeom = new THREE.CylinderGeometry(0.3, 0.3, 10, 8);
    const gantryMat = new THREE.MeshStandardMaterial({ color: 0x1f242e, metalness: 0.8, roughness: 0.3 });

    const gantry = new THREE.Mesh(gantryGeom, gantryMat);
    gantry.position.set(0, 9.5, 0);

    const legL = new THREE.Mesh(gantryLegGeom, gantryMat);
    legL.position.set(-this.roadWidth / 2 - 1.5, -4.5, 0);
    gantry.add(legL);

    const legR = legL.clone();
    legR.position.x = this.roadWidth / 2 + 1.5;
    gantry.add(legR);

    // Billboard on Gantry
    const bTex = this.billboardTextures[Math.floor(Math.random() * this.billboardTextures.length)];
    const bbGeom = new THREE.PlaneGeometry(16, 5);
    const bbMat = new THREE.MeshBasicMaterial({
      map: bTex,
      side: THREE.DoubleSide
    });
    const bbMesh = new THREE.Mesh(bbGeom, bbMat);
    bbMesh.position.set(0, 1.2, 0.45);
    gantry.add(bbMesh);

    group.add(gantry);

    // Giant Roadside Holographic Billboards (Left & Right)
    const sideBbGeom = new THREE.PlaneGeometry(24, 12);
    const sideBTex = this.billboardTextures[Math.floor(Math.random() * this.billboardTextures.length)];
    const sideBbMat = new THREE.MeshBasicMaterial({
      map: sideBTex,
      side: THREE.DoubleSide
    });

    const leftBillboard = new THREE.Mesh(sideBbGeom, sideBbMat);
    leftBillboard.position.set(-this.roadWidth / 2 - 12, 12, 70);
    leftBillboard.rotation.y = Math.PI / 12;
    group.add(leftBillboard);

    const rightBTex = this.billboardTextures[Math.floor(Math.random() * this.billboardTextures.length)];
    const rightBillboard = new THREE.Mesh(sideBbGeom, new THREE.MeshBasicMaterial({ map: rightBTex, side: THREE.DoubleSide }));
    rightBillboard.position.set(this.roadWidth / 2 + 12, 12, -70);
    rightBillboard.rotation.y = -Math.PI / 12;
    group.add(rightBillboard);
  }

  generateSegmentPuddles(zBase) {
    // Generate 4-6 puddle zones per segment with varied positions
    const offsets = [
      { x: -5.5, z: -100, radius: 4.5 },
      { x: 4.8, z: -40, radius: 5.0 },
      { x: -1.2, z: 20, radius: 6.0 },
      { x: 6.5, z: 80, radius: 4.2 },
      { x: -4.0, z: 120, radius: 5.2 }
    ];

    offsets.forEach(o => {
      this.puddles.push({
        x: o.x,
        z: zBase + o.z,
        radius: o.radius
      });
    });
  }

  buildCitySkyline() {
    const cityGroup = new THREE.Group();
    const buildingGeom = new THREE.BoxGeometry(1, 1, 1);

    // Glowing window materials
    const windowMat1 = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const windowMat2 = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    const windowMat3 = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x070b14,
      roughness: 0.9,
      metalness: 0.2
    });

    // Create 120 skyscrapers lining the distance
    for (let i = 0; i < 140; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = side * (50 + Math.random() * 220);
      const z = (Math.random() - 0.5) * 2200;
      const height = 60 + Math.random() * 220;
      const width = 25 + Math.random() * 45;
      const depth = 25 + Math.random() * 45;

      const building = new THREE.Mesh(buildingGeom, buildingMat);
      building.scale.set(width, height, depth);
      building.position.set(x, height / 2, z);
      cityGroup.add(building);

      // Rooftop antenna with blinking beacon
      const antennaGeom = new THREE.CylinderGeometry(0.2, 0.4, 25, 4);
      const antenna = new THREE.Mesh(antennaGeom, buildingMat);
      antenna.position.set(x, height + 12.5, z);
      cityGroup.add(antenna);

      const beaconGeom = new THREE.SphereGeometry(1.2, 8, 8);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0xff0033 : 0x00ffff
      });
      const beacon = new THREE.Mesh(beaconGeom, beaconMat);
      beacon.position.set(x, height + 25, z);
      cityGroup.add(beacon);
      this.animatedLights.push({ mesh: beacon, baseColor: beaconMat.color.clone() });
    }

    // Sky searchlights sweeping across clouds
    for (let s = 0; s < 6; s++) {
      const searchGeom = new THREE.ConeGeometry(8, 250, 12, 1, true);
      searchGeom.translate(0, 125, 0);

      const searchMat = new THREE.MeshBasicMaterial({
        color: s % 2 === 0 ? 0x00f0ff : 0xff0055,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const searchMesh = new THREE.Mesh(searchGeom, searchMat);
      const sx = (Math.random() - 0.5) * 350;
      const sz = (Math.random() - 0.5) * 1200;
      searchMesh.position.set(sx, 0, sz);
      cityGroup.add(searchMesh);

      this.searchlights.push({
        mesh: searchMesh,
        speed: 0.5 + Math.random() * 0.8,
        offset: Math.random() * Math.PI * 2
      });
    }

    this.scene.add(cityGroup);
  }

  // Check if a wheel hit any puddle
  checkPuddles(wheelPos) {
    for (let i = 0; i < this.puddles.length; i++) {
      const p = this.puddles[i];
      const dx = wheelPos.x - p.x;
      const dz = wheelPos.z - p.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < p.radius * p.radius) {
        // In puddle! Return intensity based on closeness to center
        const dist = Math.sqrt(distSq);
        const intensity = 1.0 - (dist / p.radius);
        return { hit: true, intensity };
      }
    }
    return { hit: false, intensity: 0 };
  }

  // Update track segments position to seamlessly loop around car
  update(carZ, time, delta) {
    // 1. Endless Highway Segment Looping
    this.segments.forEach(seg => {
      const dist = carZ - seg.zPos;
      // If car is far ahead of this segment, leapfrog it to the front
      if (dist > this.segmentLength * 1.5) {
        seg.zPos += this.segmentLength * this.numSegments;
        seg.group.position.z = seg.zPos;

        // Reposition puddles for this segment
        this.puddles = this.puddles.filter(p => p.z >= seg.zPos - this.segmentLength * 0.5);
        this.generateSegmentPuddles(seg.zPos);
      } else if (dist < -this.segmentLength * (this.numSegments - 1.5)) {
        // If car goes backwards
        seg.zPos -= this.segmentLength * this.numSegments;
        seg.group.position.z = seg.zPos;
      }
    });

    // 2. Animate Rooftop Beacons
    this.animatedLights.forEach((light, idx) => {
      const blink = Math.sin(time * 3 + idx) > 0.5;
      light.mesh.visible = blink;
    });

    // 3. Animate Sky Searchlights
    this.searchlights.forEach(sl => {
      sl.mesh.rotation.z = Math.sin(time * sl.speed + sl.offset) * 0.35;
      sl.mesh.rotation.x = Math.cos(time * sl.speed * 0.8 + sl.offset) * 0.25;
    });
  }
}
