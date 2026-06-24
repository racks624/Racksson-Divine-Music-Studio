/**
 * Global Instrumentals – Full sound lab with pad grid, looper, sample browser, scenes.
 * Integrates with AudioEngine, mixer, and BPM sync.
 */
class Instrumentals {
  static engine = null;
  static pads = [];
  static scenes = { A: [], B: [] };
  static currentScene = 'A';
  static recordedLoops = [];
  static loopRecorder = null;
  static loopChunks = [];
  static isLooping = false;
  static loopInterval = null;
  static bpm = 90;
  static quantize = 8;
  static isPlaying = false;
  static activeOsc = null;
  static sampleLibrary = [];

  static async init() {
    if (!window.rackEngine) {
      await new Promise(r => setTimeout(r, 500));
    }
    this.engine = window.rackEngine;
    if (!this.engine) return console.warn("No engine");
    if (!this.engine.isInitialized) await this.engine.init();
    // Load default pads
    this.loadDefaultPads();
    this.buildPads();
    this.attachEvents();
    this.setupDropZone();
    this.loadSampleLibrary();
    this.updateStatus('Instrumentals ready');
  }

  static loadDefaultPads() {
    this.pads = [
      { name: "Om", icon: "🕉️", category: "tone", freq: 432 },
      { name: "Tibetan", icon: "🔔", category: "tone", freq: 528 },
      { name: "Kick", icon: "🥁", category: "drum", sample: "kick" },
      { name: "Snare", icon: "🎵", category: "drum", sample: "snare" },
      { name: "Hihat", icon: "🔊", category: "drum", sample: "hihat" },
      { name: "Bass", icon: "🎸", category: "sample", sample: "bass" },
      { name: "Lead", icon: "✨", category: "sample", sample: "lead" },
      { name: "Chords", icon: "🎹", category: "sample", sample: "chords" },
      { name: "Heart", icon: "💚", category: "tone", freq: 639 },
      { name: "Third Eye", icon: "👁️", category: "tone", freq: 852 },
      { name: "Crown", icon: "👑", category: "tone", freq: 963 },
      { name: "Root", icon: "🌍", category: "tone", freq: 139 },
      { name: "Sacral", icon: "🍊", category: "tone", freq: 417 },
      { name: "Solar", icon: "☀️", category: "tone", freq: 528 },
      { name: "Custom 1", icon: "🎧", category: "sample", sample: null },
      { name: "Custom 2", icon: "🎧", category: "sample", sample: null },
      { name: "Custom 3", icon: "🎧", category: "sample", sample: null },
      { name: "Custom 4", icon: "🎧", category: "sample", sample: null },
    ];
  }

  static buildPads() {
    const container = document.getElementById('instrumentPadGrid');
    if (!container) return;
    container.innerHTML = '';
    this.pads.forEach((pad, idx) => {
      const div = document.createElement('div');
      div.className = 'sound-pad';
      div.dataset.index = idx;
      div.innerHTML = `
        <div class="pad-icon">${pad.icon}</div>
        <div class="pad-label">${pad.name}</div>
        <div class="pad-category">${pad.category}</div>
        <div class="pad-freq">${pad.freq ? pad.freq + 'Hz' : (pad.sample || '')}</div>
      `;
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playPad(pad);
        div.classList.add('active');
        setTimeout(() => div.classList.remove('active'), 150);
      });
      container.appendChild(div);
    });
  }

  static playPad(pad) {
    if (!this.engine) return;
    if (pad.category === 'tone' && pad.freq) {
      if (this.activeOsc) {
        this.engine.stopChakra('inst_tone');
        this.activeOsc = null;
      }
      this.engine.startChakra('inst_tone', pad.freq);
      this.activeOsc = 'inst_tone';
      setTimeout(() => {
        if (this.activeOsc === 'inst_tone') {
          this.engine.stopChakra('inst_tone');
          this.activeOsc = null;
        }
      }, 2000);
    } else if (pad.sample) {
      let key = pad.sample;
      if (!this.engine.buffers[key]) key = 'kick';
      this.engine.playSample(key, 0, 1, 'inst_pad');
    }
  }

  static attachEvents() {
    document.getElementById('startLoopRec')?.addEventListener('click', () => this.startLoopRecording());
    document.getElementById('stopLoopRec')?.addEventListener('click', () => this.stopLoopRecording());
    document.getElementById('playLoopBtn')?.addEventListener('click', () => this.playLastLoop());
    document.getElementById('clearLoopsBtn')?.addEventListener('click', () => this.clearLoops());
    document.getElementById('loopBpm')?.addEventListener('change', (e) => {
      this.bpm = parseInt(e.target.value) || 90;
      this.updateStatus(`BPM set to ${this.bpm}`);
    });
    document.getElementById('quantizeSelect')?.addEventListener('change', (e) => {
      this.quantize = parseInt(e.target.value);
    });
    // Scenes
    document.querySelectorAll('.scene-btn[data-scene]').forEach(btn => {
      btn.addEventListener('click', () => {
        const scene = btn.dataset.scene;
        this.currentScene = scene;
        document.querySelectorAll('.scene-btn[data-scene]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadScene(scene);
      });
    });
    document.getElementById('saveSceneBtn')?.addEventListener('click', () => this.saveScene());
    document.getElementById('loadSceneBtn')?.addEventListener('click', () => document.getElementById('sceneFile')?.click());
    document.getElementById('sceneFile')?.addEventListener('change', (e) => this.loadSceneFromFile(e));
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        if (this.isPlaying) this.stopLoopPlayback();
        else this.playLastLoop();
      }
      if (e.key === 'r' || e.key === 'R') {
        if (this.isLooping) this.stopLoopRecording();
        else this.startLoopRecording();
      }
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        if (this.pads[idx]) this.playPad(this.pads[idx]);
      }
    });
  }

  // ---------- Loop Recorder ----------
  static async startLoopRecording() {
    if (!this.engine || !this.engine.getMediaStream) {
      alert("Recording requires media stream.");
      return;
    }
    const stream = this.engine.getMediaStream();
    if (!stream) { alert("No master stream."); return; }
    this.loopChunks = [];
    this.loopRecorder = new MediaRecorder(stream);
    this.loopRecorder.ondataavailable = (ev) => { if (ev.data.size) this.loopChunks.push(ev.data); };
    this.loopRecorder.onstop = () => {
      const blob = new Blob(this.loopChunks, { type: 'audio/webm' });
      // Quantize: store loop with BPM info
      this.recordedLoops.unshift({ blob, bpm: this.bpm, quantize: this.quantize });
      this.updateLoopList();
      this.updateStatus('Loop saved');
    };
    this.loopRecorder.start();
    this.isLooping = true;
    this.updateStatus('🔴 Recording loop...');
  }

  static stopLoopRecording() {
    if (this.loopRecorder && this.loopRecorder.state !== 'inactive') {
      this.loopRecorder.stop();
      this.isLooping = false;
      this.updateStatus('Recording stopped');
    }
  }

  // ---------- Loop Playback (BPM‑sync) ----------
  static playLastLoop() {
    if (this.recordedLoops.length === 0) {
      alert("No loops recorded");
      return;
    }
    if (this.isPlaying) {
      this.stopLoopPlayback();
      return;
    }
    const loop = this.recordedLoops[0];
    const url = URL.createObjectURL(loop.blob);
    const audio = new Audio();
    audio.src = url;
    audio.play();
    this.isPlaying = true;
    this.updateStatus('▶ Playing loop');
    audio.onended = () => {
      this.isPlaying = false;
      URL.revokeObjectURL(url);
      this.updateStatus('Loop finished');
      // Auto-repeat if quantize?
    };
  }

  static stopLoopPlayback() {
    // Not trivial with Audio element – we'll reload.
    alert('Stop playback not implemented; refresh page.');
  }

  // ---------- Loop Management ----------
  static updateLoopList() {
    const container = document.getElementById('loopList');
    if (!container) return;
    container.innerHTML = '';
    if (this.recordedLoops.length === 0) {
      container.innerHTML = '<p style="color:#666;">No loops recorded.</p>';
      return;
    }
    this.recordedLoops.forEach((loop, idx) => {
      const div = document.createElement('div');
      div.className = 'loop-slot';
      const date = new Date().toLocaleTimeString();
      const sizeKB = (loop.blob.size / 1024).toFixed(0);
      div.innerHTML = `
        <span>🎧 Loop ${idx+1} (${sizeKB} KB) - ${date} @ ${loop.bpm} BPM</span>
        <div>
          <button class="btn play-loop" data-idx="${idx}">▶</button>
          <button class="btn delete-loop" data-idx="${idx}">🗑️</button>
        </div>
      `;
      container.appendChild(div);
    });
    container.querySelectorAll('.play-loop').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.idx);
        const loop = this.recordedLoops[idx];
        const url = URL.createObjectURL(loop.blob);
        const audio = new Audio();
        audio.src = url;
        audio.play();
        audio.onended = () => URL.revokeObjectURL(url);
      });
    });
    container.querySelectorAll('.delete-loop').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.idx);
        this.recordedLoops.splice(idx, 1);
        this.updateLoopList();
      });
    });
  }

  static clearLoops() {
    this.recordedLoops = [];
    this.updateLoopList();
    this.updateStatus('All loops cleared');
  }

  // ---------- Sample Upload & Library ----------
  static setupDropZone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    if (!dropZone || !fileInput) return;
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      this.handleFiles(e.dataTransfer.files);
    });
  }

  static async handleFiles(files) {
    for (const file of files) {
      if (!file.type.startsWith('audio/')) {
        alert(`Skipping ${file.name} – not audio.`);
        continue;
      }
      try {
        const formData = new FormData();
        formData.append('sample', file);
        const res = await fetch('/api/upload-sample', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
          // Add to pad grid as custom sample
          const newPad = {
            name: file.name.replace(/\.[^.]+$/, ''),
            icon: '🎧',
            category: 'sample',
            sample: data.filename,
            freq: null
          };
          this.pads.push(newPad);
          this.buildPads();
          // Load into engine
          const url = `/static/audio/uploads/${data.filename}`;
          await this.engine.loadSample(data.filename, url);
          this.loadSampleLibrary();
          this.updateStatus(`Uploaded ${file.name}`);
        } else {
          alert(`Upload failed: ${data.error || 'Unknown'}`);
        }
      } catch(e) {
        console.error(e);
        alert(`Error uploading ${file.name}`);
      }
    }
  }

  static async loadSampleLibrary() {
    try {
      const res = await fetch('/api/samples');
      const data = await res.json();
      this.sampleLibrary = data.samples || [];
      this.renderSampleBrowser();
    } catch(e) {
      console.warn('Sample list not available');
    }
  }

  static renderSampleBrowser() {
    const container = document.getElementById('sampleBrowser');
    if (!container) return;
    container.innerHTML = '';
    if (this.sampleLibrary.length === 0) {
      container.innerHTML = '<div style="color:#666;">No samples uploaded yet.</div>';
      return;
    }
    this.sampleLibrary.forEach(sample => {
      const div = document.createElement('div');
      div.className = 'sample-item';
      div.innerHTML = `
        <span>${sample}</span>
        <button class="btn btn-sm" data-sample="${sample}">▶</button>
      `;
      container.appendChild(div);
    });
    container.querySelectorAll('.sample-item button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = btn.dataset.sample;
        const url = `/static/audio/uploads/${name}`;
        this.engine.loadSample(name, url).then(() => {
          this.engine.playSample(name, 0, 1, 'inst_pad');
        });
      });
    });
  }

  // ---------- Scenes ----------
  static saveScene() {
    const scene = this.currentScene;
    const state = {
      pads: this.pads.map(p => ({ ...p })),
      loops: this.recordedLoops.map(l => ({ bpm: l.bpm, quantize: l.quantize, blob: l.blob })) // can't store blob in JSON, just metadata
    };
    this.scenes[scene] = state;
    this.updateStatus(`Scene ${scene} saved`);
    // Optionally download JSON (skip blob)
    const exportState = {
      pads: state.pads,
      loops: state.loops.map(l => ({ bpm: l.bpm, quantize: l.quantize }))
    };
    const blob = new Blob([JSON.stringify(exportState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `instrumentals_scene_${scene}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static loadScene(scene) {
    const state = this.scenes[scene];
    if (!state) { this.updateStatus(`Scene ${scene} empty`); return; }
    // Restore pads (ignore loop blobs)
    this.pads = state.pads.map(p => ({ ...p }));
    this.buildPads();
    this.updateStatus(`Scene ${scene} loaded`);
  }

  static loadSceneFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.pads) {
          this.pads = data.pads;
          this.buildPads();
          this.updateStatus('Scene loaded from file');
        }
      } catch(err) {
        alert('Invalid scene file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  // ---------- Utility ----------
  static updateStatus(msg) {
    const el = document.getElementById('statusBar');
    if (el) el.innerText = msg;
  }
}

document.addEventListener('DOMContentLoaded', () => Instrumentals.init());
