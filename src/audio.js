// Web Audio API Procedural Sound Synthesizer
// 100% self-contained, no external asset dependencies!

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.muted = false;

    // Master volume
    this.masterGain = null;

    // Engine Nodes
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.currentRPM = 900;
    this.targetRPM = 900;

    // Drift Audio Nodes
    this.driftGain = null;
    this.driftFilter = null;

    // Rain Ambience
    this.rainGain = null;

    // Music Arpeggiator
    this.musicEnabled = true;
    this.musicTimer = null;
    this.arpStep = 0;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // 1. Initialize Engine Synthesizer
      this.initEngineSynth();

      // 2. Initialize Drift Tire Sound
      this.initDriftSynth();

      // 3. Initialize Rain Ambience
      this.initRainSynth();

      // 4. Start Background Synthwave Music
      this.startSynthwaveBGM();

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not allowed or failed to init:', e);
    }
  }

  // Resume context if suspended
  resume() {
    if (!this.initialized) {
      this.init();
    } else if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    if (!this.masterGain || !this.ctx) return;
    this.muted = !this.muted;
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime);
    return this.muted;
  }

  // --- Engine Sound ---
  initEngineSynth() {
    const t = this.ctx.currentTime;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.18, t);

    // Multi-cylinder cross-modulated oscillator
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(45, t);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(90, t);

    // Engine lowpass filter
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(400, t);
    this.engineFilter.Q.setValueAtTime(3.5, t);

    // Sub rumble
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(30, t);
    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.4, t);
    subOsc.connect(subGain);
    subGain.connect(this.engineFilter);
    subOsc.start();

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  updateEngine(rpm, throttle, gear, isNitro) {
    if (!this.initialized || !this.ctx) return;

    this.targetRPM = rpm;
    this.currentRPM += (this.targetRPM - this.currentRPM) * 0.15;

    const baseFreq = 30 + (this.currentRPM / 9000) * 160;
    const t = this.ctx.currentTime;

    // Pitch
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, t, 0.04);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, t, 0.04);

    // Filter opens up as throttle increases
    const cutoff = 250 + throttle * 1400 + (this.currentRPM / 9000) * 2200 + (isNitro ? 1200 : 0);
    this.engineFilter.frequency.setTargetAtTime(cutoff, t, 0.04);

    // Volume
    const vol = 0.12 + throttle * 0.22 + (isNitro ? 0.15 : 0);
    this.engineGain.gain.setTargetAtTime(vol, t, 0.05);
  }

  // --- Drift Skid Audio ---
  initDriftSynth() {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.driftFilter = this.ctx.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
    this.driftFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    whiteNoise.connect(this.driftFilter);
    this.driftFilter.connect(this.driftGain);
    this.driftGain.connect(this.masterGain);

    whiteNoise.start();
  }

  updateDrift(slipAngle, speedRatio) {
    if (!this.initialized || !this.driftGain) return;
    const t = this.ctx.currentTime;

    if (slipAngle > 0.15 && speedRatio > 0.1) {
      const intensity = Math.min(1.0, (slipAngle - 0.15) * 1.8 * speedRatio);
      this.driftGain.gain.setTargetAtTime(intensity * 0.28, t, 0.04);
      this.driftFilter.frequency.setTargetAtTime(700 + intensity * 800, t, 0.04);
    } else {
      this.driftGain.gain.setTargetAtTime(0.0, t, 0.08);
    }
  }

  // --- Water Splash Sound (Triggered on Puddle hit) ---
  playWaterSplash(intensity = 0.5) {
    if (!this.initialized || !this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    // Water noise burst
    const dur = 0.35 + intensity * 0.25;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Liquid bubbly noise curve
      const env = 1.0 - (i / bufferSize);
      data[i] = (Math.random() * 2 - 1) * Math.pow(env, 1.8);
    }

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600 + intensity * 1400, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35 * Math.min(1.0, intensity * 1.2), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noiseSrc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noiseSrc.start(t);
  }

  // --- Turbo Blow-Off Valve Hiss ---
  playTurboBOV() {
    if (!this.initialized || !this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const dur = 0.3;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.sin((i / bufferSize) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2800, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    src.start(t);
  }

  // --- Exhaust Backfire Pop ---
  playBackfire() {
    if (!this.initialized || !this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  // --- Rain Ambience Sound ---
  initRainSynth() {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const rainSrc = this.ctx.createBufferSource();
    rainSrc.buffer = buffer;
    rainSrc.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.14, this.ctx.currentTime);

    rainSrc.connect(filter);
    filter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);

    rainSrc.start();
  }

  // --- Background Synthwave Bassline & Beat ---
  startSynthwaveBGM() {
    if (this.musicTimer) clearInterval(this.musicTimer);

    // Cyberpunk driving bass progression: Dm - F - C - Bb
    const bassNotes = [
      73.42, 73.42, 146.83, 73.42,   // D2, D2, D3, D2
      87.31, 87.31, 174.61, 87.31,   // F2, F2, F3, F2
      65.41, 65.41, 130.81, 65.41,   // C2, C2, C3, C2
      58.27, 58.27, 116.54, 58.27    // Bb1, Bb1, Bb2, Bb1
    ];

    const stepDuration = 135; // ~110 BPM 16th notes
    this.arpStep = 0;

    this.musicTimer = setInterval(() => {
      if (!this.musicEnabled || this.muted || !this.ctx || this.ctx.state !== 'running') return;

      const t = this.ctx.currentTime;
      const freq = bassNotes[this.arpStep % bassNotes.length];

      // Bass synth note
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, t);
      filter.frequency.exponentialRampToValueAtTime(150, t + 0.12);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.12);

      // Cyber kick drum on beats 0, 4, 8, 12
      if (this.arpStep % 4 === 0) {
        const kickOsc = this.ctx.createOscillator();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(120, t);
        kickOsc.frequency.exponentialRampToValueAtTime(35, t + 0.1);

        const kickGain = this.ctx.createGain();
        kickGain.gain.setValueAtTime(0.2, t);
        kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        kickOsc.connect(kickGain);
        kickGain.connect(this.masterGain);

        kickOsc.start(t);
        kickOsc.stop(t + 0.1);
      }

      this.arpStep++;
    }, stepDuration);
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    return this.musicEnabled;
  }
}
