/**
 * SoundFeedback – Global audible feedback for user interactions.
 * Generates short beeps/ clicks procedurally using Web Audio.
 */
class SoundFeedback {
  static ctx = null;
  static enabled = true;
  static volume = 0.3;
  static defaultDuration = 0.06;

  // Initialise the audio context on first user interaction (to avoid autoplay restrictions)
  static init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio not supported; feedback disabled.");
    }
  }

  // Ensure context is resumed (required after page load)
  static resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play a short "click" sound (impulse-like)
  static click(volume = this.volume, duration = this.defaultDuration) {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 800 + Math.random() * 200; // slight variation
    gain.gain.setValueAtTime(volume * 0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // Success: two-tone up (happy)
  static success() {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const notes = [523, 659, 784]; // C, E, G
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(this.volume * 0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
      }, i * 80);
    });
  }

  // Error: low descending tone (warning)
  static error() {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(this.volume * 0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  // Toggle: short blip (on/off)
  static toggle(on = true) {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = on ? 600 : 400;
    gain.gain.setValueAtTime(this.volume * 0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  // Enable/disable
  static setEnabled(val) {
    this.enabled = !!val;
    if (this.enabled) this.click(0.1); // test click
  }

  static setVolume(val) {
    this.volume = Math.min(1, Math.max(0, val));
  }
}

// Auto‑init on first user interaction (touch/click)
document.addEventListener('click', () => SoundFeedback.init(), { once: true });
document.addEventListener('touchstart', () => SoundFeedback.init(), { once: true });

// Expose globally
window.SoundFeedback = SoundFeedback;
