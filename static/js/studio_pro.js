/**
 * Studio Pro - Industrial Grade Production Suite
 * Depends on global AudioEngine (from studio.js) and ProjectDB
 * Falls back gracefully if not present.
 */

class StudioPro {
  static engine = null;
  static db = null;
  static isPlaying = false;
  static currentStep = 0;
  static stepInterval = null;
  static bpm = 90;
  static tracks = [
    { id: 'drums', label: '🥁 DRUMS', samples: ['kick', 'snare', 'hihat', 'clap'], pattern: new Array(16).fill(false) },
    { id: 'bass', label: '🎸 BASS', samples: ['bass'], pattern: new Array(16).fill(false) },
    { id: 'lead', label: '✨ LEAD', samples: ['lead'], pattern: new Array(16).fill(false) },
    { id: 'chords', label: '🎹 CHORDS', samples: ['chords'], pattern: new Array(16).fill(false) }
  ];
  static mediaRecorder = null;
  static recordedChunks = [];
  static lastBlob = null;
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

  static async init() {
    // Wait for engine from studio.js if not already present
    if (!window.rackEngine) {
      console.log("Waiting for AudioEngine...");
      await new Promise(resolve => {
        const check = setInterval(() => {
          if (window.rackEngine) {
            clearInterval(check);
            resolve();
          }
        }, 100);
        setTimeout(() => resolve(), 2000);
      });
    }
    this.engine = window.rackEngine;
    this.db = window.rackDB || (window.ProjectDB ? new window.ProjectDB() : null);
    if (this.engine && !this.engine.isInitialized) await this.engine.init();
    
    // Preload samples
    if (this.engine) {
      for (const [key, url] of Object.entries(this.sampleMap)) {
        this.engine.loadSample(key, url).catch(e => console.warn(`Sample ${key} not found`));
      }
    }
    this.buildUI();
    this.attachEvents();
    this.updateStatus("Studio Pro ready – industrial grade");
  }

  static buildUI() {
    const container = document.getElementById('tracksContainer');
    if (!container) return;
    container.innerHTML = '';
    this.tracks.forEach((track, idx) => {
      const trackDiv = document.createElement('div');
      trackDiv.className = 'track-row';
      trackDiv.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <strong style="width:80px;">${track.label}</strong>
          <button class="btn-pro solo-track" data-track="${track.id}" style="padding:4px 12px;">Solo</button>
          <button class="btn-pro mute-track" data-track="${track.id}" style="padding:4px 12px;">Mute</button>
          <span style="flex:1"></span>
          <span>Vol</span>
          <input type="range" class="track-vol" data-track="${track.id}" min="0" max="1" step="0.01" value="0.8" style="width:80px;">
        </div>
        <div class="step-grid" data-track="${track.id}" style="display:grid; grid-template-columns:repeat(16,1fr); gap:6px;">
          ${track.pattern.map((active, i) => `<div class="seq-step ${active ? 'active' : ''}" data-step="${i}">${i+1}</div>`).join('')}
        </div>
      `;
      container.appendChild(trackDiv);
    });
    // attach step clicks
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
    // solo/mute/vol placeholders – implement later
    document.querySelectorAll('.solo-track').forEach(btn => {
      btn.addEventListener('click', (e) => alert('Solo feature (advanced) – coming soon'));
    });
    document.querySelectorAll('.track-vol').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const trackId = slider.dataset.track;
        if (this.engine && this.engine.trackGains[trackId])
          this.engine.trackGains[trackId].gain.value = parseFloat(slider.value);
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
    document.getElementById('bpmControl')?.addEventListener('change', (e) => { this.bpm = parseInt(e.target.value); if (this.isPlaying) this.restartPlayback(); });
    document.getElementById('masterVol')?.addEventListener('input', (e) => { if (this.engine) this.engine.setMasterVolume(parseFloat(e.target.value)); });
    document.getElementById('proStartRec')?.addEventListener('click', () => this.startRecording());
    document.getElementById('proStopRec')?.addEventListener('click', () => this.stopRecording());
    document.getElementById('proDownloadRec')?.addEventListener('click', () => this.downloadRecording());
  }

  static startPlayback() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    const stepDuration = (60 / this.bpm) / 4;
    this.currentStep = 0;
    this.stepInterval = setInterval(() => {
      // visual highlight
      document.querySelectorAll('.seq-step').forEach(step => {
        const stepIdx = parseInt(step.dataset.step);
        if (stepIdx === this.currentStep) step.classList.add('playing');
        else step.classList.remove('playing');
      });
      // trigger sounds
      this.tracks.forEach(track => {
        if (track.pattern[this.currentStep]) {
          let sampleKey = track.id === 'drums' ? ['kick','snare','hihat','clap'][this.currentStep % 4] : track.id;
          if (!this.engine.buffers[sampleKey]) sampleKey = 'kick'; // fallback
          this.engine.playSample(sampleKey, 0, 1, track.id);
        }
      });
      this.currentStep = (this.currentStep + 1) % 16;
    }, stepDuration * 1000);
    this.updateStatus("Playing");
  }

  static stopPlayback() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    clearInterval(this.stepInterval);
    document.querySelectorAll('.seq-step').forEach(step => step.classList.remove('playing'));
    this.updateStatus("Stopped");
  }

  static restartPlayback() {
    if (this.isPlaying) {
      this.stopPlayback();
      setTimeout(() => this.startPlayback(), 50);
    }
  }

  static async saveProject() {
    const name = prompt("Project name:", `proj_${Date.now()}`);
    if (!name) return;
    const payload = {
      name, bpm: this.bpm, tracks: this.tracks.map(t => ({ id: t.id, pattern: t.pattern })),
      created: Date.now()
    };
    try {
      const res = await fetch('/api/save-project', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      alert(`Project saved on server: ${data.filename || data.id}`);
    } catch(e) {
      // fallback IndexedDB
      if (this.db && this.db.saveProject) {
        const id = await this.db.saveProject(payload);
        alert(`Saved locally (IndexedDB) id: ${id}`);
      } else alert("Save failed: server offline and no local DB");
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
      if (track) track.pattern = savedTrack.pattern;
    });
    this.buildUI(); // rebuild patterns
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
      this.updateStatus("Recording saved – ready to download");
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

  static updateStatus(msg) {
    const el = document.getElementById('studioStatusMsg');
    if (el) el.innerText = msg;
  }
}

window.StudioPro = StudioPro;
