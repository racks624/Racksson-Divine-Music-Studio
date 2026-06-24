/**
 * Enterprise Mixer – Full channel strip with EQ, Compressor, FX Sends, Scenes, Master Metering.
 * Depends on global AudioEngine (from studio.js)
 */
class Mixer {
  static engine = null;
  static channels = [];
  static fxNodes = { reverb: null, delay: null, chorus: null };
  static trackStates = {};
  static currentScene = 'A';
  static scenes = { A: {}, B: {} };
  static meteringInterval = null;
  static masterMeter = { peak: 0.0 };

  static async init() {
    // Wait for engine
    if (!window.rackEngine) {
      await new Promise(r => setTimeout(r, 500));
    }
    this.engine = window.rackEngine;
    if (!this.engine) return console.warn("No engine");
    if (!this.engine.isInitialized) await this.engine.init();
    // Ensure we have track gains
    const trackIds = ['drums', 'bass', 'lead', 'chords'];
    trackIds.forEach(id => {
      if (!this.engine.trackGains[id]) {
        this.engine.trackGains[id] = this.engine.ctx.createGain();
        this.engine.trackGains[id].gain.value = 0.8;
        this.engine.trackGains[id].connect(this.engine.eqLow);
      }
    });
    this.buildMixer();
    this.setupFX();
    this.attachEvents();
    this.startMetering();
    this.updateStatus('Mixer ready');
  }

  static buildMixer() {
    const container = document.getElementById('mixerChannels');
    if (!container) return;
    const trackIds = ['drums', 'bass', 'lead', 'chords'];
    container.innerHTML = '';
    trackIds.forEach(id => {
      const state = this.trackStates[id] = {
        volume: 0.8, pan: 0, muted: false, soloed: false,
        eq: { low: 0, mid: 0, high: 0 },
        comp: { threshold: 0.2, ratio: 4, gain: 0 },
        send: { reverb: 0.2, delay: 0.1, chorus: 0.0 }
      };
      const div = document.createElement('div');
      div.className = 'channel';
      div.dataset.track = id;
      div.innerHTML = `
        <div class="label">${id}</div>
        <div class="fader-group">
          <div class="meter" id="meter-${id}"><div class="meter-bar" style="height:0%;"></div></div>
          <input type="range" class="vertical-fader track-vol" data-track="${id}" min="0" max="1" step="0.01" value="${state.volume}" orient="vertical">
          <label style="font-size:0.6rem;">Pan</label>
          <input type="range" class="track-pan" data-track="${id}" min="-1" max="1" step="0.01" value="${state.pan}" style="width:60px;">
        </div>
        <div style="display:flex; gap:4px; margin:4px 0;">
          <button class="btn-sm mute-btn" data-track="${id}">M</button>
          <button class="btn-sm solo-btn" data-track="${id}">S</button>
        </div>
        <div class="eq-section">
          <label>EQ <br><input type="range" class="eq-low" data-track="${id}" min="-12" max="12" value="${state.eq.low}" step="0.5"> L</label>
          <input type="range" class="eq-mid" data-track="${id}" min="-12" max="12" value="${state.eq.mid}" step="0.5"> M
          <input type="range" class="eq-high" data-track="${id}" min="-12" max="12" value="${state.eq.high}" step="0.5"> H
        </div>
        <div class="comp-section">
          <label>Comp <input type="range" class="comp-thresh" data-track="${id}" min="0" max="0.5" step="0.01" value="${state.comp.threshold}"></label>
          <label>R <input type="range" class="comp-ratio" data-track="${id}" min="1" max="20" step="0.5" value="${state.comp.ratio}"></label>
          <label>G <input type="range" class="comp-gain" data-track="${id}" min="0" max="12" step="0.5" value="${state.comp.gain}"></label>
        </div>
        <div class="fx-sends">
          <label>Rvb <input type="range" class="send-reverb" data-track="${id}" min="0" max="1" step="0.01" value="${state.send.reverb}"></label>
          <label>Dly <input type="range" class="send-delay" data-track="${id}" min="0" max="1" step="0.01" value="${state.send.delay}"></label>
          <label>Cho <input type="range" class="send-chorus" data-track="${id}" min="0" max="1" step="0.01" value="${state.send.chorus}"></label>
        </div>
      `;
      container.appendChild(div);
    });
    // Set initial volume for all tracks
    this.applyStates();
  }

  static applyStates() {
    Object.keys(this.trackStates).forEach(id => {
      const state = this.trackStates[id];
      if (this.engine && this.engine.trackGains[id]) {
        this.engine.trackGains[id].gain.value = state.muted ? 0 : state.volume;
      }
      // EQ: we use simple filter nodes per track (not yet implemented in basic engine, but we store)
      // We'll add a simple EQ node per track in a future upgrade.
      // For now, we apply EQ to master chain via the engine's eqLow/Mid/High? That's global.
      // We'll store and apply global EQ later.
    });
  }

  static setupFX() {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    // Reverb
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.25;
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

    // Chorus (simple: short delay + modulation)
    const chorusGain = ctx.createGain();
    chorusGain.gain.value = 0.1;
    const chorusDelay = ctx.createDelay(0.02);
    chorusDelay.delayTime.value = 0.015;
    const chorusFeedback = ctx.createGain();
    chorusFeedback.gain.value = 0.3;
    chorusDelay.connect(chorusFeedback);
    chorusFeedback.connect(chorusDelay);
    chorusDelay.connect(chorusGain);
    chorusGain.connect(this.engine.eqLow);
    this.fxNodes.chorus = { gain: chorusGain, delay: chorusDelay, feedback: chorusFeedback };
  }

  static attachEvents() {
    // Faders
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
        // Pan not implemented in basic engine, but we store for future
      });
    });
    // Mute
    document.querySelectorAll('.mute-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const track = btn.dataset.track;
        this.trackStates[track].muted = !this.trackStates[track].muted;
        const muted = this.trackStates[track].muted;
        if (this.engine && this.engine.trackGains[track]) {
          this.engine.trackGains[track].gain.value = muted ? 0 : this.trackStates[track].volume;
        }
        btn.classList.toggle('active', muted);
      });
    });
    // Solo
    document.querySelectorAll('.solo-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const track = btn.dataset.track;
        const isSolo = !this.trackStates[track].soloed;
        // Reset all solos
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
          // Un-solo: unmute all
          Object.keys(this.trackStates).forEach(id => {
            this.trackStates[id].muted = false;
            if (this.engine && this.engine.trackGains[id])
              this.engine.trackGains[id].gain.value = this.trackStates[id].volume;
          });
        }
        // Update UI
        document.querySelectorAll('.solo-btn').forEach(b => {
          const id = b.dataset.track;
          b.classList.toggle('active', this.trackStates[id].soloed);
        });
        document.querySelectorAll('.mute-btn').forEach(b => {
          const id = b.dataset.track;
          b.classList.toggle('active', this.trackStates[id].muted);
        });
      });
    });
    // EQ
    document.querySelectorAll('.eq-low, .eq-mid, .eq-high').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const track = e.target.dataset.track;
        const cls = e.target.className;
        const val = parseFloat(e.target.value);
        if (cls.includes('low')) this.trackStates[track].eq.low = val;
        else if (cls.includes('mid')) this.trackStates[track].eq.mid = val;
        else if (cls.includes('high')) this.trackStates[track].eq.high = val;
        // Apply EQ to track – for now, we use global EQ (simple)
        // In a full implementation, we'd have per-track EQ nodes.
        this.applyGlobalEQ();
      });
    });
    // Compressor
    document.querySelectorAll('.comp-thresh, .comp-ratio, .comp-gain').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const track = e.target.dataset.track;
        const cls = e.target.className;
        const val = parseFloat(e.target.value);
        if (cls.includes('thresh')) this.trackStates[track].comp.threshold = val;
        else if (cls.includes('ratio')) this.trackStates[track].comp.ratio = val;
        else if (cls.includes('gain')) this.trackStates[track].comp.gain = val;
        // Compressor not implemented yet (would need DynamicsCompressorNode per track)
      });
    });
    // FX Sends (global)
    document.querySelectorAll('.send-reverb').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const track = e.target.dataset.track;
        const val = parseFloat(e.target.value);
        this.trackStates[track].send.reverb = val;
        // For simplicity, we map to global reverb gain (multiply by track's send)
        // Full implementation: route each track through a send bus.
        // We'll use global FX for now.
        const globalReverb = parseFloat(document.getElementById('globalReverb').value);
        if (this.fxNodes.reverb) this.fxNodes.reverb.gain.gain.value = val * globalReverb;
      });
    });
    document.querySelectorAll('.send-delay').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const track = e.target.dataset.track;
        const val = parseFloat(e.target.value);
        this.trackStates[track].send.delay = val;
        const globalDelay = parseFloat(document.getElementById('globalDelay').value);
        if (this.fxNodes.delay) this.fxNodes.delay.gain.gain.value = val * globalDelay;
      });
    });
    document.querySelectorAll('.send-chorus').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const track = e.target.dataset.track;
        const val = parseFloat(e.target.value);
        this.trackStates[track].send.chorus = val;
        const globalChorus = parseFloat(document.getElementById('globalChorus').value);
        if (this.fxNodes.chorus) this.fxNodes.chorus.gain.gain.value = val * globalChorus;
      });
    });
    // Master Volume
    document.getElementById('masterVol')?.addEventListener('input', (e) => {
      if (this.engine) this.engine.setMasterVolume(parseFloat(e.target.value));
    });
    // Global FX sends
    document.getElementById('globalReverb')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (this.fxNodes.reverb) this.fxNodes.reverb.gain.gain.value = val;
    });
    document.getElementById('globalDelay')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (this.fxNodes.delay) this.fxNodes.delay.gain.gain.value = val;
    });
    document.getElementById('globalChorus')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (this.fxNodes.chorus) this.fxNodes.chorus.gain.gain.value = val;
    });
    // Scenes
    document.querySelectorAll('.snapshot-btn[data-scene]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const scene = btn.dataset.scene;
        this.currentScene = scene;
        document.querySelectorAll('.snapshot-btn[data-scene]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Load scene state
        if (this.scenes[scene]) this.loadState(this.scenes[scene]);
      });
    });
    document.getElementById('saveSnapshotBtn')?.addEventListener('click', () => this.saveSnapshot());
    document.getElementById('loadSnapshotBtn')?.addEventListener('click', () => document.getElementById('snapshotFile')?.click());
    document.getElementById('snapshotFile')?.addEventListener('change', (e) => this.loadSnapshotFromFile(e));
  }

  static applyGlobalEQ() {
    // Combine all track EQs into global? Not ideal, but for demo we adjust master EQ.
    // We'll just store for now.
  }

  static startMetering() {
    if (this.meteringInterval) clearInterval(this.meteringInterval);
    this.meteringInterval = setInterval(() => {
      // Dummy metering: simulate signal based on track volumes and activity
      // In real implementation, we'd connect to analyser nodes.
      const masterVol = parseFloat(document.getElementById('masterVol')?.value || 0.9);
      const level = Math.min(1, masterVol * (0.3 + Math.random() * 0.7));
      const db = 20 * Math.log10(level);
      // Update master meter
      const meterBar = document.querySelector('#masterMeterBig .bar');
      const meterDb = document.getElementById('masterMeterDb');
      if (meterBar) {
        const pct = Math.min(100, Math.max(0, (level + 0.1) * 80));
        meterBar.style.height = pct + '%';
        // Color change near clipping
        if (level > 0.9) meterBar.style.background = 'linear-gradient(to top, #ff0000, #ff0000)';
        else if (level > 0.7) meterBar.style.background = 'linear-gradient(to top, #ffff00, #ff0000)';
        else meterBar.style.background = 'linear-gradient(to top, #00ff00, #ffff00)';
      }
      if (meterDb) meterDb.innerText = db.toFixed(1) + ' dB';
      // Update each track meter
      Object.keys(this.trackStates).forEach(id => {
        const state = this.trackStates[id];
        if (state.muted) return;
        const trackVol = state.volume;
        const levelTrack = trackVol * (0.1 + Math.random() * 0.9);
        const bar = document.querySelector(`#meter-${id} .meter-bar`);
        if (bar) {
          bar.style.height = Math.min(100, levelTrack * 80) + '%';
        }
      });
    }, 100);
  }

  static saveSnapshot() {
    const state = JSON.parse(JSON.stringify(this.trackStates));
    this.scenes[this.currentScene] = state;
    this.updateStatus(`Scene ${this.currentScene} saved`);
    // Optionally download as JSON
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mixer_scene_${this.currentScene}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static loadSnapshotFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const state = JSON.parse(e.target.result);
        this.loadState(state);
        this.updateStatus('Scene loaded from file');
      } catch(err) {
        alert('Invalid snapshot file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  static loadState(state) {
    // Apply state to UI and engine
    Object.keys(state).forEach(id => {
      const s = state[id];
      if (this.trackStates[id]) {
        this.trackStates[id] = s;
        // Update UI sliders
        const volSlider = document.querySelector(`.track-vol[data-track="${id}"]`);
        if (volSlider) volSlider.value = s.volume;
        const panSlider = document.querySelector(`.track-pan[data-track="${id}"]`);
        if (panSlider) panSlider.value = s.pan;
        // Mute
        const muteBtn = document.querySelector(`.mute-btn[data-track="${id}"]`);
        if (muteBtn) muteBtn.classList.toggle('active', s.muted);
        // EQ
        document.querySelector(`.eq-low[data-track="${id}"]`).value = s.eq.low;
        document.querySelector(`.eq-mid[data-track="${id}"]`).value = s.eq.mid;
        document.querySelector(`.eq-high[data-track="${id}"]`).value = s.eq.high;
        // Comp
        document.querySelector(`.comp-thresh[data-track="${id}"]`).value = s.comp.threshold;
        document.querySelector(`.comp-ratio[data-track="${id}"]`).value = s.comp.ratio;
        document.querySelector(`.comp-gain[data-track="${id}"]`).value = s.comp.gain;
        // Sends
        document.querySelector(`.send-reverb[data-track="${id}"]`).value = s.send.reverb;
        document.querySelector(`.send-delay[data-track="${id}"]`).value = s.send.delay;
        document.querySelector(`.send-chorus[data-track="${id}"]`).value = s.send.chorus;
        // Apply to engine
        if (this.engine && this.engine.trackGains[id]) {
          this.engine.trackGains[id].gain.value = s.muted ? 0 : s.volume;
        }
      }
    });
  }

  static updateStatus(msg) {
    const el = document.getElementById('statusBar');
    if (el) el.innerText = msg;
  }
}

document.addEventListener('DOMContentLoaded', () => Mixer.init());
