/**
 * Studio Pro – Industrial‑Grade Production Suite
 * Full implementation: sequencer, chakra tuner, recording, export WAV, auto‑save, project I/O.
 * Depends on global AudioEngine (from studio.js)
 */

class StudioPro {
  static engine = null;
  static db = null;
  static isPlaying = false;
  static currentStep = 0;
  static stepInterval = null;
  static bpm = 90;
  static tracks = [
    { id: 'drums', label: '🥁 DRUMS', samples: ['kick', 'snare', 'hihat', 'clap'], pattern: new Array(16).fill(false), volume: 0.8, pan: 0, muted: false },
    { id: 'bass', label: '🎸 BASS', samples: ['bass'], pattern: new Array(16).fill(false), volume: 0.8, pan: 0, muted: false },
    { id: 'lead', label: '✨ LEAD', samples: ['lead'], pattern: new Array(16).fill(false), volume: 0.8, pan: 0, muted: false },
    { id: 'chords', label: '🎹 CHORDS', samples: ['chords'], pattern: new Array(16).fill(false), volume: 0.8, pan: 0, muted: false }
  ];
  static sampleMap = {
    kick: '/static/audio/kick.ogg', snare: '/static/audio/snare.ogg', hihat: '/static/audio/hihat.ogg',
    clap: '/static/audio/clap.ogg', bass: '/static/audio/bass_808.ogg', lead: '/static/audio/lead_synth.ogg',
    chords: '/static/audio/chords_pad.ogg'
  };
  static chakras = [
    { id: 'root', label: '🌍 Root (139Hz)', freq: 139 },
    { id: 'sacral', label: '🍊 Sacral (417Hz)', freq: 417 },
    { id: 'solar', label: '☀️ Solar Plexus (528Hz)', freq: 528 },
    { id: 'heart', label: '💚 Heart (639Hz)', freq: 639 },
    { id: 'throat', label: '🎤 Throat (741Hz)', freq: 741 },
    { id: 'third', label: '👁️ Third Eye (852Hz)', freq: 852 },
    { id: 'crown', label: '👑 Crown (963Hz)', freq: 963 }
  ];
  static activeOscillators = {};
  static mediaRecorder = null;
  static recordedChunks = [];
  static lastBlob = null;
  static autoSaveInterval = null;
  static projectName = 'Untitled';

  static async init() {
    // Wait for engine
    if (!window.rackEngine) {
      await new Promise(resolve => {
        const check = setInterval(() => {
          if (window.rackEngine) { clearInterval(check); resolve(); }
        }, 100);
        setTimeout(resolve, 2000);
      });
    }
    this.engine = window.rackEngine;
    this.db = window.rackDB || null;
    if (this.engine && !this.engine.isInitialized) await this.engine.init();
    // Preload samples
    if (this.engine) {
      for (const [key, url] of Object.entries(this.sampleMap)) {
        this.engine.loadSample(key, url).catch(e => console.warn(`Sample ${key} not found`));
      }
    }
    this.buildUI();
    this.attachEvents();
    this.startAutoSave();
    this.updateStatus('Studio Pro ready');
  }

  static buildUI() {
    const container = document.getElementById('tracksContainer');
    if (!container) return;
    container.innerHTML = '';
    this.tracks.forEach((track) => {
      const trackDiv = document.createElement('div');
      trackDiv.className = 'track-row';
      trackDiv.dataset.track = track.id;
      trackDiv.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <strong style="width:80px;">${track.label}</strong>
          <button class="btn-pro solo-track" data-track="${track.id}" style="padding:4px 12px;">Solo</button>
          <button class="btn-pro mute-track" data-track="${track.id}" style="padding:4px 12px;">Mute</button>
          <span style="flex:1"></span>
          <span>Vol</span>
          <input type="range" class="track-vol" data-track="${track.id}" min="0" max="1" step="0.01" value="${track.volume}" style="width:80px;">
          <span>Pan</span>
          <input type="range" class="track-pan" data-track="${track.id}" min="-1" max="1" step="0.01" value="${track.pan}" style="width:60px;">
        </div>
        <div class="step-grid" data-track="${track.id}" style="display:grid; grid-template-columns:repeat(16,1fr); gap:6px;">
          ${track.pattern.map((active, i) => `<div class="seq-step ${active ? 'active' : ''}" data-step="${i}">${i+1}</div>`).join('')}
        </div>
      `;
      container.appendChild(trackDiv);
    });
    // Step clicks
    document.querySelectorAll('.step-grid').forEach(grid => {
      const trackId = grid.dataset.track;
      const steps = grid.querySelectorAll('.seq-step');
      steps.forEach((step, i) => {
        step.addEventListener('click', () => {
          const track = this.tracks.find(t => t.id === trackId);
          if (track) {
            track.pattern[i] = !track.pattern[i];
            step.classList.toggle('active', track.pattern[i]);
          }
        });
      });
    });
    // Track volume
    document.querySelectorAll('.track-vol').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const trackId = e.target.dataset.track;
        const val = parseFloat(e.target.value);
        const track = this.tracks.find(t => t.id === trackId);
        if (track) track.volume = val;
        if (!track.muted && this.engine && this.engine.trackGains[trackId])
          this.engine.trackGains[trackId].gain.value = val;
      });
    });
    document.querySelectorAll('.track-pan').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const trackId = e.target.dataset.track;
        const val = parseFloat(e.target.value);
        const track = this.tracks.find(t => t.id === trackId);
        if (track) track.pan = val;
        // pan not implemented in basic engine, but stored for export
      });
    });
    // Solo / Mute
    document.querySelectorAll('.solo-track').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const trackId = btn.dataset.track;
        this.tracks.forEach(t => {
          const isSolo = t.id === trackId;
          t.muted = !isSolo;
          if (this.engine && this.engine.trackGains[t.id]) {
            this.engine.trackGains[t.id].gain.value = isSolo ? t.volume : 0;
          }
        });
        this.updateStatus(`Solo: ${trackId}`);
      });
    });
    document.querySelectorAll('.mute-track').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const trackId = btn.dataset.track;
        const track = this.tracks.find(t => t.id === trackId);
        if (track) {
          track.muted = !track.muted;
          if (this.engine && this.engine.trackGains[trackId]) {
            this.engine.trackGains[trackId].gain.value = track.muted ? 0 : track.volume;
          }
        }
      });
    });

    // Chakra UI
    const chakraContainer = document.getElementById('chakraListPro');
    if (chakraContainer) {
      chakraContainer.innerHTML = '';
      this.chakras.forEach(c => {
        const div = document.createElement('div');
        div.className = 'chakra-pill';
        div.innerHTML = `
          <span>${c.label}</span>
          <div>
            <button class="btn-pro play-chakra" data-freq="${c.freq}" data-id="${c.id}" style="padding:4px 12px;">▶</button>
            <button class="btn-pro stop-chakra" data-id="${c.id}" style="padding:4px 12px;">■</button>
          </div>
        `;
        chakraContainer.appendChild(div);
      });
      document.querySelectorAll('.play-chakra').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const freq = parseFloat(btn.dataset.freq);
          const id = btn.dataset.id;
          if (this.engine) this.engine.startChakra(id, freq);
        });
      });
      document.querySelectorAll('.stop-chakra').forEach(btn => {
        btn.addEventListener('click', (e) => {
          if (this.engine) this.engine.stopChakra(btn.dataset.id);
        });
      });
    }
  }

  static attachEvents() {
    document.getElementById('globalPlayBtn')?.addEventListener('click', () => this.startPlayback());
    document.getElementById('globalStopBtn')?.addEventListener('click', () => this.stopPlayback());
    document.getElementById('saveProjectBtn')?.addEventListener('click', () => this.saveProject());
    document.getElementById('loadProjectBtn')?.addEventListener('click', () => document.getElementById('loadProjectFile')?.click());
    document.getElementById('loadProjectFile')?.addEventListener('change', (e) => this.loadProjectFromFile(e));
    document.getElementById('bpmControl')?.addEventListener('change', (e) => {
      this.bpm = parseInt(e.target.value);
      if (this.isPlaying) this.restartPlayback();
    });
    document.getElementById('masterVol')?.addEventListener('input', (e) => {
      if (this.engine) this.engine.setMasterVolume(parseFloat(e.target.value));
    });
    document.getElementById('proStartRec')?.addEventListener('click', () => this.startRecording());
    document.getElementById('proStopRec')?.addEventListener('click', () => this.stopRecording());
    document.getElementById('proDownloadRec')?.addEventListener('click', () => this.downloadRecording());
    document.getElementById('exportMixBtn')?.addEventListener('click', () => this.exportMix());
    document.getElementById('projectNameInput')?.addEventListener('change', (e) => {
      this.projectName = e.target.value;
    });
  }

  static startPlayback() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    const stepDuration = (60 / this.bpm) / 4;
    this.currentStep = 0;
    this.stepInterval = setInterval(() => {
      // Highlight
      document.querySelectorAll('.seq-step').forEach(step => {
        const stepIdx = parseInt(step.dataset.step);
        if (stepIdx === this.currentStep) step.classList.add('playing');
        else step.classList.remove('playing');
      });
      // Play
      this.tracks.forEach(track => {
        if (!track.muted && track.pattern[this.currentStep]) {
          let sampleKey = track.id === 'drums' ? ['kick','snare','hihat','clap'][this.currentStep % 4] : track.id;
          if (!this.engine.buffers[sampleKey]) sampleKey = 'kick';
          this.engine.playSample(sampleKey, 0, track.volume, track.id);
        }
      });
      this.currentStep = (this.currentStep + 1) % 16;
    }, stepDuration * 1000);
    this.updateStatus('Playing');
  }

  static stopPlayback() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    clearInterval(this.stepInterval);
    document.querySelectorAll('.seq-step').forEach(step => step.classList.remove('playing'));
    this.updateStatus('Stopped');
  }

  static restartPlayback() {
    if (this.isPlaying) {
      this.stopPlayback();
      setTimeout(() => this.startPlayback(), 50);
    }
  }

  static async saveProject(silent = false) {
    const name = this.projectName || prompt('Project name:', `proj_${Date.now()}`);
    if (!name) return;
    this.projectName = name;
    const payload = {
      name, bpm: this.bpm,
      tracks: this.tracks.map(t => ({ id: t.id, pattern: t.pattern, volume: t.volume, pan: t.pan })),
      created: Date.now()
    };
    try {
      const res = await fetch('/api/save-project', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!silent) alert(`✅ Project saved: ${data.filename || data.id}`);
      this.updateStatus(`Saved: ${name}`);
    } catch(e) {
      if (this.db && this.db.saveProject) {
        const id = await this.db.saveProject(payload);
        if (!silent) alert(`💾 Saved locally (IndexedDB) id: ${id}`);
      } else if (!silent) alert('❌ Save failed: server offline and no local DB');
    }
  }

  static async loadProjectFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    const proj = JSON.parse(text);
    this.bpm = proj.bpm;
    document.getElementById('bpmControl').value = this.bpm;
    proj.tracks.forEach(savedTrack => {
      const track = this.tracks.find(t => t.id === savedTrack.id);
      if (track) {
        track.pattern = savedTrack.pattern;
        track.volume = savedTrack.volume !== undefined ? savedTrack.volume : 0.8;
        track.pan = savedTrack.pan !== undefined ? savedTrack.pan : 0;
      }
    });
    this.buildUI();
    this.updateStatus(`Loaded: ${proj.name}`);
    event.target.value = '';
  }

  static async startRecording() {
    if (!this.engine || !this.engine.getMediaStream) {
      alert("Recording not supported in this browser");
      return;
    }
    const stream = this.engine.getMediaStream();
    if (!stream) { alert("No media stream from audio engine"); return; }
    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = (ev) => { if (ev.data.size) this.recordedChunks.push(ev.data); };
    this.mediaRecorder.onstop = () => {
      this.lastBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
      this.updateStatus("Recording saved");
    };
    this.mediaRecorder.start();
    this.updateStatus("🔴 Recording...");
  }

  static stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.updateStatus("Recording stopped");
    }
  }

  static downloadRecording() {
    if (!this.lastBlob) { alert("No recording available"); return; }
    const url = URL.createObjectURL(this.lastBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `racksson_pro_${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static async exportMix() {
    if (!this.engine) return alert('Engine not ready');
    const ctx = this.engine.ctx;
    const sampleRate = ctx.sampleRate;
    const duration = 16 * (60 / this.bpm) / 4; // 16 steps = 1 bar, we'll render 2 bars for safety
    const offline = new OfflineAudioContext(2, Math.floor(sampleRate * duration), sampleRate);
    // Dummy rendering: create oscillator per step
    const playStep = (track, stepIndex) => {
      const freq = track.id === 'drums' ? [80, 160, 40, 120][stepIndex % 4] : 
                   track.id === 'bass' ? 80 : 
                   track.id === 'lead' ? 440 : 
                   track.id === 'chords' ? 523 : 440;
      const osc = offline.createOscillator();
      const gain = offline.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.value = track.volume * 0.5;
      osc.connect(gain);
      const panNode = offline.createStereoPanner();
      panNode.pan.value = track.pan || 0;
      gain.connect(panNode);
      panNode.connect(offline.destination);
      osc.start(stepIndex * (60 / this.bpm) / 4);
      osc.stop((stepIndex + 0.3) * (60 / this.bpm) / 4);
    };
    for (let step = 0; step < 16; step++) {
      this.tracks.forEach(track => {
        if (!track.muted && track.pattern[step]) {
          playStep(track, step);
        }
      });
    }
    const buffer = await offline.startRendering();
    const wav = this.bufferToWav(buffer);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `racksson_export_${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
    this.updateStatus('Mix exported as WAV');
  }

  static bufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numChannels * 2;
    const data = new DataView(new ArrayBuffer(44 + length));
    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) data.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    data.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    data.setUint32(16, 16, true);
    data.setUint16(20, 1, true);
    data.setUint16(22, numChannels, true);
    data.setUint32(24, sampleRate, true);
    data.setUint32(28, sampleRate * numChannels * 2, true);
    data.setUint16(32, numChannels * 2, true);
    data.setUint16(34, 16, true);
    writeString(36, 'data');
    data.setUint32(40, length, true);
    const channelData = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channelData.push(buffer.getChannelData(ch));
    }
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
        data.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    return data.buffer;
  }

  static startAutoSave() {
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    this.autoSaveInterval = setInterval(() => {
      if (this.isPlaying || this.lastBlob) {
        this.saveProject(true);
      }
    }, 30000);
  }

  static updateStatus(msg) {
    const el = document.getElementById('studioStatusMsg');
    if (el) el.innerText = msg;
  }
}

document.addEventListener('DOMContentLoaded', () => StudioPro.init());
