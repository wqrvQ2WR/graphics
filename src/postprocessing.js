import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Custom Speed Warp & Vignette Shader
const SpeedWarpShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSpeedRatio: { value: 0.0 },
    uNitro: { value: 0.0 },
    uTime: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uSpeedRatio;
    uniform float uNitro;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5, 0.5);
      vec2 dir = vUv - center;
      float dist = length(dir);

      // Radial blur samples when boosting/speeding
      float blurStrength = (uSpeedRatio * 0.015) + (uNitro * 0.025);
      vec4 color = vec4(0.0);

      const int SAMPLES = 8;
      for (int i = 0; i < SAMPLES; i++) {
        float scale = 1.0 - blurStrength * (float(i) / float(SAMPLES)) * smoothstep(0.2, 0.9, dist);
        vec2 sampleUv = center + dir * scale;

        // Chromatic Aberration on edge
        float r = texture2D(tDiffuse, sampleUv + dir * (0.003 * uNitro)).r;
        float g = texture2D(tDiffuse, sampleUv).g;
        float b = texture2D(tDiffuse, sampleUv - dir * (0.003 * uNitro)).b;
        color += vec4(r, g, b, 1.0);
      }
      color /= float(SAMPLES);

      // Vignette on screen border
      float vignette = smoothstep(0.95, 0.35, dist);
      color.rgb *= mix(0.7, 1.0, vignette);

      // Cool cyber blue tint on high speed
      if (uNitro > 0.1) {
        color.rgb = mix(color.rgb, vec3(color.r * 0.85, color.g * 1.05, color.b * 1.2), uNitro * 0.25);
      }

      gl_FragColor = color;
    }
  `
};

export class PostProcessingManager {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.composer = new EffectComposer(renderer);

    // 1. Render Pass
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // 2. Unreal Bloom Pass (Cinematic neon lighting glow)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.3,  // Strength
      0.45, // Radius
      0.82  // Threshold
    );
    this.composer.addPass(this.bloomPass);

    // 3. Speed Warp & Radial Chromatic Aberration
    this.speedWarpPass = new ShaderPass(SpeedWarpShader);
    this.composer.addPass(this.speedWarpPass);

    // 4. Final Output Pass (Tonemapping & Color Space correction)
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    window.addEventListener('resize', () => {
      this.resize(window.innerWidth, window.innerHeight);
    });
  }

  resize(width, height) {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  update(speedRatio, isNitro, time) {
    this.speedWarpPass.uniforms.uSpeedRatio.value = speedRatio;
    this.speedWarpPass.uniforms.uNitro.value = isNitro ? 1.0 : 0.0;
    this.speedWarpPass.uniforms.uTime.value = time;
  }

  render() {
    this.composer.render();
  }
}
