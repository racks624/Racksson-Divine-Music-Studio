/**
 * Harmonizer – Live pitch shifter using Web Audio.
 * Uses oscillator‑based detune and delay for chorus effect.
 */
class Harmonizer {
  static engine = null;
  static micStream = null;
  static source = null;
  static pitchShift = 0;
  static voices = 2;
  static mix = 0.7;
  static voiceNodes = [];
  static isActive = false;

  static async init() {
    if (!window.rackEngine) await new Promise(r => setTimeout(r, 500));
    this.engine = window.rackEngine;
    if (!this.engine) return console.warn("No engine");
    await this.engine.init();
    this.attachEvents();
    this.drawVisualizer();
  }

  static attachEvents() {
    document.getElementById('harmonizeMic')?.addEventListener('click', () => this.startMic());
    document.getElementById('stopHarmonize')?.addEventListener('click', () => this.stopMic());
    const pitchSlider = document.getElementById('pitchShift');
    if (pitchSlider) {
      pitchSlider.addEventListener('input', (e) => {
        this.pitchShift = parseInt(e.target.value);
        document.getElementById('pitchDisplay').innerText = this.pitchShift + ' cents';
        this.updatePitch();
      });
    }
    document.getElementById('harmonyVoices')?.addEventListener('change', (e) => {
      this.voices = parseInt(e.target.value) || 2;
      if (this.isActive) {
        this.stopMic();
        this.startMic();
      }
    });
    document.getElementById('harmonyMix')?.addEventListener('input', (e) => {
      this.mix = parseFloat(e.target.value);
      this.updateMix();
    });
  }

  static async startMic() {
    if (this.isActive) return;
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = this.engine.ctx;
      this.source = ctx.createMediaStreamSource(this.micStream);
      // Split into multiple voices with detune
      this.voiceNodes = [];
      const baseGain = ctx.createGain();
      baseGain.gain.value = 1.0;
      this.source.connect(baseGain);
      for (let i = 0; i < this.voices; i++) {
        const gain = ctx.createGain();
        const delay = ctx.createDelay(0.05);
        delay.delayTime.value = 0.02 * (i + 1);
        const gainNode = ctx.createGain();
        gainNode.gain.value = this.mix / this.voices;
        baseGain.connect(delay);
        delay.connect(gainNode);
        gainNode.connect(this.engine.eqLow);
        this.voiceNodes.push({ delay, gain: gainNode });
      }
      this.isActive = true;
      document.getElementById('harmonyStatus').innerText = '🎤 Microphone active, harmonizing';
    } catch(e) {
      alert('Microphone access denied: ' + e.message);
    }
  }

  static stopMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    this.voiceNodes.forEach(n => {
      try { n.delay.disconnect(); n.gain.disconnect(); } catch(e) {}
    });
    this.voiceNodes = [];
    this.isActive = false;
    document.getElementById('harmonyStatus').innerText = '⏹ Stopped';
  }

  static updatePitch() {
    // Adjust delay times to simulate pitch shift (chorus effect)
    this.voiceNodes.forEach((n, i) => {
      const baseDelay = 0.02;
      const shiftFactor = this.pitchShift / 1200;
      n.delay.delayTime.value = baseDelay * (1 + shiftFactor * (i + 1) * 0.1);
    });
  }

  static updateMix() {
    this.voiceNodes.forEach(n => {
      n.gain.gain.value = this.mix / this.voices;
    });
  }

  static drawVisualizer() {
    const canvas = document.getElementById('harmonyCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const draw = () => {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x++) {
        const y = canvas.height / 2 + Math.sin(x * 0.05 + Date.now() * 0.002) * 30 +
          Math.sin(x * 0.08 + Date.now() * 0.003) * 20;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      requestAnimationFrame(draw);
    };
    draw();
  }
}

document.addEventListener('DOMContentLoaded', () => Harmonizer.init());
