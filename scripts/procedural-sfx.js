/**
 * Cyberpunk RED Procedural Web Audio API Sound Synthesizer
 * Zero-latency fallback audio engine for Cyberpunk tactical stingers
 */

class CPRProceduralSFX {
  constructor() {
    this.ctx = null;
  }

  getAudioContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Play procedural sound by key
   * @param {string} type - trauma, ncpd, emp, breach, flatline, door, gunfire, panic
   * @param {number} volume - 0.0 to 1.0
   */
  play(type, volume = 0.8) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      switch (type) {
        case "trauma":
          this._playTraumaSiren(ctx, volume);
          break;
        case "ncpd":
          this._playNCPDAlarm(ctx, volume);
          break;
        case "emp":
          this._playEMPBlast(ctx, volume);
          break;
        case "breach":
          this._playBreachChime(ctx, volume);
          break;
        case "flatline":
          this._playFlatline(ctx, volume);
          break;
        case "door":
          this._playDoorHack(ctx, volume);
          break;
        case "gunfire":
          this._playGunfire(ctx, volume);
          break;
        case "panic":
          this._playPanicRiot(ctx, volume);
          break;
        default:
          this._playGenericBeep(ctx, volume);
          break;
      }
    } catch (err) {
      console.warn("CPRAudioDeck | Procedural audio error:", err);
    }
  }

  _playTraumaSiren(ctx, volume) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    // Dual tone pulse 850Hz / 600Hz
    osc.frequency.setValueAtTime(850, now);
    osc.frequency.setValueAtTime(850, now + 0.25);
    osc.frequency.setValueAtTime(600, now + 0.26);
    osc.frequency.setValueAtTime(600, now + 0.5);
    osc.frequency.setValueAtTime(850, now + 0.51);
    osc.frequency.setValueAtTime(850, now + 0.75);
    osc.frequency.setValueAtTime(600, now + 0.76);
    osc.frequency.setValueAtTime(600, now + 1.0);

    gain.gain.setValueAtTime(volume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.25);
  }

  _playNCPDAlarm(ctx, volume) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    // Downward chirps
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.25;
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.2);
    }

    gain.gain.setValueAtTime(volume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.9);
  }

  _playEMPBlast(ctx, volume) {
    const now = ctx.currentTime;
    // Sub oscillator
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 1.5);
    oscGain.gain.setValueAtTime(volume * 0.7, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    // Noise burst
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(60, now + 0.5);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    noise.start(now);
    osc.stop(now + 1.55);
    noise.stop(now + 0.55);
  }

  _playBreachChime(ctx, volume) {
    const now = ctx.currentTime;
    const freqs = [440, 554, 659, 880, 1108];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.06;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(volume * 0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  _playFlatline(ctx, volume) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(950, now);

    gain.gain.setValueAtTime(volume * 0.45, now);
    gain.gain.setValueAtTime(volume * 0.45, now + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.85);
  }

  _playDoorHack(ctx, volume) {
    const now = ctx.currentTime;
    // High double bleep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.setValueAtTime(2400, now + 0.08);

    gain.gain.setValueAtTime(volume * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.28);
  }

  _playGunfire(ctx, volume) {
    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(300, now);
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.42);
  }

  _playPanicRiot(ctx, volume) {
    const now = ctx.currentTime;
    const freqs = [180, 240, 310, 420];
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f + (Math.random() * 80 - 40), now + 1.0);

      gain.gain.setValueAtTime(volume * 0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.25);
    });
  }

  _playGenericBeep(ctx, volume) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, now);
    gain.gain.setValueAtTime(volume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }
}

export const proceduralSFX = new CPRProceduralSFX();
