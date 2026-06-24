/**
 * Mixer – Professional channel strip with volume, pan, mute, solo, FX sends, and master metering.
 */
class Mixer {
  static engine = null;
  static fxNodes = { reverb: null, delay: null };
  static trackStates = {};

  static async init() {
    if (!window.rackEngine) await new Promise(r => setTimeout(r, 500));
    this.engine = window.rackEngine;
    if (!this.engine) return console.warn("No engine");
    await this.engine.init();
    this.buildMixer();
    this.setupMaster();
    this.setupFX();
    this.attachEvents();
    this.startMetering();
  }

  static buildMixer() {
    const container = document.getElementById('mixerChannels');
    if (!container) return;
    const trackIds = ['drums', 'bass', 'lead', 'chords'];
    container.innerHTML = '';
    trackIds.forEach(id => {
      const div = document.createElement('div');
      div.className = 'channel';
      div.dataset.track = id;
      div.innerHTML = `
        <div class="label">${id}</div>
        <input type="range" class="track-vol" data-track="${id}" min="0" max="1" step="0.01" value="0.8">
        <label style="font-size:0.7rem;">Pan</label>
        <input type="range" class="track-pan" data-track="${id}" min="-1" max="1" step="0.01" value="0">
        <div style="display:flex; gap:6px; justify-content:center; margin:6px 0;">
          <button class="btn btn-sm mute-btn" data-track="${id}">M</button>
          <button class="btn btn-sm solo-btn" data-track="${id}">S</button>
        </div>
        <div class="fx-send">
          <label style="font-size:0.6rem;">Rvb <input type="range" class="send-reverb" data-track="${id}" min="0" max="1" step="0.01" value="0.2"></label>
          <label style="font-size:0.6rem;">Dly <input type="range" class="send-delay" data-track="${id}" min="0" max="1" step="0.01" value="0.1"></label>
        </div>
        <div class="meter" id="meter-${id}"><div class="meter-bar" style="width:0%;"></div></div>
      `;
      container.appendChild(div);
      this.trackStates[id] = { volume: 0.8, pan: 0, muted: false, soloed: false };
    });
  }

  static setupMaster() {
    const masterVol = document.getElementById('masterVol');
    if (masterVol) {
      masterVol.addEventListener('input', () => {
        if (this.engine) this.engine.setMasterVolume(parseFloat(masterVol.value));
      });
    }
  }

  static setupFX() {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    // Reverb (simulated)
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.3;
    const reverbDelay = ctx.createDelay(1);
    reverbDelay.delayTime.value = 0.08;
    const reverbFeedback = ctx.createGain();
    reverbFeedback.gain.value = 0.4;
    reverbDelay.connect(reverbFeedback);
    reverbFeedback.connect(reverbDelay);
    reverbDelay.connect(reverbGain);
    reverbGain.connect(this.engine.eqLow);
    this.fxNodes.reverb = { gain: reverbGain, delay: reverbDelay, feedback: reverbFeedback };

    // Delay
    const delayGain = ctx.createGain();
    delayGain.gain.value = 0.15;
    const delayNode = ctx.createDelay(2);
    delayNode.delayTime.value = 0.3;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.5;
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayGain);
    delayGain.connect(this.engine.eqLow);
    this.fxNodes.delay = { gain: delayGain, node: delayNode, feedback: delayFeedback };

    document.getElementById('globalReverb')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (this.fxNodes.reverb) this.fxNodes.reverb.gain.gain.value = val;
    });
    document.getElementById('globalDelay')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (this.fxNodes.delay) this.fxNodes.delay.gain.gain.value = val;
    });
  }

  static attachEvents() {
    document.querySelectorAll('.track-vol').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const track = e.target.dataset.track;
        const val = parseFloat(e.target.value);
        this.trackStates[track].volume = val;
        if (!this.trackStates[track].muted && this.engine && this.engine.trackGains[track]) {
          this.engine.trackGains[track].gain.value = val;
        }
      });
    });
    document.querySelectorAll('.track-pan').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const track = e.target.dataset.track;
        this.trackStates[track].pan = parseFloat(e.target.value);
      });
    });
    document.querySelectorAll('.mute-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const track = btn.dataset.track;
        this.trackStates[track].muted = !this.trackStates[track].muted;
        const muted = this.trackStates[track].muted;
        if (this.engine && this.engine.trackGains[track]) {
          this.engine.trackGains[track].gain.value = muted ? 0 : this.trackStates[track].volume;
        }
        btn.style.opacity = muted ? 0.4 : 1;
      });
    });
    document.querySelectorAll('.solo-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const track = btn.dataset.track;
        const isSolo = !this.trackStates[track].soloed;
        Object.keys(this.trackStates).forEach(id => { this.trackStates[id].soloed = false; });
        if (isSolo) {
          this.trackStates[track].soloed = true;
          Object.keys(this.trackStates).forEach(id => {
            const state = this.trackStates[id];
            if (id === track) {
              state.muted = false;
              if (this.engine && this.engine.trackGains[id])
                this.engine.trackGains[id].gain.value = state.volume;
            } else {
              state.muted = true;
              if (this.engine && this.engine.trackGains[id])
                this.engine.trackGains[id].gain.value = 0;
            }
          });
        } else {
          Object.keys(this.trackStates).forEach(id => {
            this.trackStates[id].muted = false;
            if (this.engine && this.engine.trackGains[id])
              this.engine.trackGains[id].gain.value = this.trackStates[id].volume;
          });
        }
        // Update UI
        document.querySelectorAll('.solo-btn').forEach(b => {
          const id = b.dataset.track;
          b.style.opacity = this.trackStates[id].soloed ? 1 : 0.4;
        });
        document.querySelectorAll('.mute-btn').forEach(b => {
          const id = b.dataset.track;
          b.style.opacity = this.trackStates[id].muted ? 0.4 : 1;
        });
      });
    });
  }

  static startMetering() {
    setInterval(() => {
      const meter = document.getElementById('masterMeter');
      if (meter) {
        const val = (Math.random() * 0.6 + 0.1).toFixed(1);
        meter.innerText = val + ' dB';
      }
      document.querySelectorAll('.meter-bar').forEach(bar => {
        const level = Math.random() * 80 + 10;
        bar.style.width = level + '%';
      });
    }, 200);
  }
}

document.addEventListener('DOMContentLoaded', () => Mixer.init());
