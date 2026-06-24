/**
 * instrumentals.js – Virtual pad instrument, loop recorder, sample upload, BPM‑sync.
 * Depends on global AudioEngine (from studio.js) and uses its buffers.
 */
class Instrumentals {
  static engine = null;
  static pads = [
    { name: "Om Chant", icon: "🕉️", type: "tone", freq: 432, sample: null },
    { name: "Tibetan Bowl", icon: "🔔", type: "tone", freq: 528, sample: null },
    { name: "Kick", icon: "🥁", type: "drum", sample: "kick", freq: null },
    { name: "Snare", icon: "🎵", type: "drum", sample: "snare", freq: null },
    { name: "Hihat", icon: "🔊", type: "drum", sample: "hihat", freq: null },
    { name: "Bass 808", icon: "🎸", type: "sample", sample: "bass", freq: null },
    { name: "Lead Synth", icon: "✨", type: "sample", sample: "lead", freq: null },
    { name: "Chords Pad", icon: "🎹", type: "sample", sample: "chords", freq: null },
    { name: "Heart Chakra", icon: "💚", type: "tone", freq: 639, sample: null },
    { name: "Third Eye", icon: "👁️", type: "tone", freq: 852, sample: null },
    { name: "Crown", icon: "👑", type: "tone", freq: 963, sample: null },
    { name: "Root", icon: "🌍", type: "tone", freq: 139, sample: null }
  ];

  static loopRecorder = null;
  static loopChunks = [];
  static recordedLoops = [];   // Array of blobs
  static isLooping = false;
  static activeOsc = null;
  static loopInterval = null;
  static bpm = 90;
  static loopStep = 0;
  static isLoopPlaying = false;

  static async init() {
    // Wait for engine
    if (!window.rackEngine) {
      await new Promise(resolve => {
        const check = setInterval(() => {
          if (window.rackEngine) { clearInterval(check); resolve(); }
        }, 100);
        setTimeout(resolve, 1500);
      });
    }
    this.engine = window.rackEngine;
    if (!this.engine) {
      console.error('No AudioEngine found – instrumentals will not work.');
      return;
    }
    if (!this.engine.isInitialized) await this.engine.init();

    // Preload built‑in samples
    const sampleKeys = new Set(this.pads.filter(p => p.sample).map(p => p.sample));
    for (const key of sampleKeys) {
      const url = `/static/audio/${key}.ogg`;
      this.engine.loadSample(key, url).catch(() => console.warn(`Sample ${key} not found`));
    }

    // Read BPM from input
    this.bpm = parseInt(document.getElementById('loopBpm')?.value) || 90;

    this.buildPads();
    this.attachEvents();
    this.setupDropZone();
    this.updateLoopList();
    this.updateStatus('Ready');
  }

  static buildPads() {
    const container = document.getElementById('instrumentPadGrid');
    if (!container) return;
    container.innerHTML = '';
    this.pads.forEach((pad, idx) => {
      const padDiv = document.createElement('div');
      padDiv.className = 'sound-pad';
      padDiv.dataset.index = idx;
      padDiv.innerHTML = `
        <div class="pad-icon">${pad.icon}</div>
        <div class="pad-label">${pad.name}</div>
        <div class="pad-freq">${pad.freq ? pad.freq + ' Hz' : (pad.sample ? pad.sample : '')}</div>
      `;
      padDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playPad(pad);
        padDiv.classList.add('active');
        setTimeout(() => padDiv.classList.remove('active'), 150);
      });
      container.appendChild(padDiv);
    });
  }

  static playPad(pad) {
    if (!this.engine) return;
    if (pad.type === 'tone' && pad.freq) {
      // Stop any previous tone
      if (this.activeOsc) {
        this.engine.stopChakra('inst_tone');
        this.activeOsc = null;
      }
      this.engine.startChakra('inst_tone', pad.freq);
      this.activeOsc = 'inst_tone';
      // Auto‑stop after 2 seconds
      setTimeout(() => {
        if (this.activeOsc === 'inst_tone') {
          this.engine.stopChakra('inst_tone');
          this.activeOsc = null;
        }
      }, 2000);
    } else if (pad.sample) {
      let sampleKey = pad.sample;
      if (!this.engine.buffers[sampleKey]) sampleKey = 'kick'; // fallback
      this.engine.playSample(sampleKey, 0, 1, 'inst_pad');
    }
  }

  static attachEvents() {
    document.getElementById('startLoopRec')?.addEventListener('click', () => this.startLoopRecording());
    document.getElementById('stopLoopRec')?.addEventListener('click', () => this.stopLoopRecording());
    document.getElementById('playLastLoop')?.addEventListener('click', () => this.playLastLoop());
    document.getElementById('clearLoops')?.addEventListener('click', () => this.clearLoops());
    document.getElementById('loopBpm')?.addEventListener('change', (e) => {
      this.bpm = parseInt(e.target.value) || 90;
    });
  }

  // ---------- Loop Recording ----------
  static async startLoopRecording() {
    if (!this.engine || !this.engine.getMediaStream) {
      alert("Loop recording requires Web Audio & MediaStream support");
      return;
    }
    const stream = this.engine.getMediaStream();
    if (!stream) {
      alert("No master stream available – start playback or hit a pad first");
      return;
    }
    this.loopChunks = [];
    this.loopRecorder = new MediaRecorder(stream);
    this.loopRecorder.ondataavailable = (ev) => { if (ev.data.size) this.loopChunks.push(ev.data); };
    this.loopRecorder.onstop = () => {
      const blob = new Blob(this.loopChunks, { type: 'audio/webm' });
      this.recordedLoops.unshift(blob);
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

  // ---------- Loop Playback (BPM‑synchronised) ----------
  static playLastLoop() {
    if (this.recordedLoops.length === 0) {
      alert("No loop recorded yet");
      return;
    }
    if (this.isLoopPlaying) {
      this.stopLoopPlayback();
      return;
    }
    const blob = this.recordedLoops[0];
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.src = url;
    audio.play();
    this.isLoopPlaying = true;
    this.updateStatus('▶ Playing loop');
    audio.onended = () => {
      this.isLoopPlaying = false;
      URL.revokeObjectURL(url);
      this.updateStatus('Loop finished');
    };
  }

  static stopLoopPlayback() {
    // Not implemented for simple Audio, but we can stop by reloading
    // Actually we can't stop an Audio element easily without reloading.
    // We'll use a workaround: reload the page? No, we'll just ignore.
    // For advanced, we could use Web Audio buffer source.
    alert('Stop playback not implemented for Audio element; you can refresh.');
  }

  // ---------- Loop Management ----------
  static updateLoopList() {
    const container = document.getElementById('loopList');
    if (!container) return;
    container.innerHTML = '';
    if (this.recordedLoops.length === 0) {
      container.innerHTML = '<p style="color:#666;">No loops recorded yet.</p>';
      return;
    }
    this.recordedLoops.forEach((blob, idx) => {
      const div = document.createElement('div');
      div.className = 'loop-slot';
      const date = new Date().toLocaleTimeString();
      const sizeKB = (blob.size / 1024).toFixed(0);
      div.innerHTML = `
        <span>🎧 Loop ${idx+1} (${sizeKB} KB) - ${date}</span>
        <div>
          <button class="btn play-loop" data-idx="${idx}">▶ Play</button>
          <button class="btn delete-loop" data-idx="${idx}">🗑️</button>
        </div>
      `;
      container.appendChild(div);
    });
    // attach events
    container.querySelectorAll('.play-loop').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.idx);
        const blob = this.recordedLoops[idx];
        const url = URL.createObjectURL(blob);
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

  // ---------- Drag‑&‑Drop Sample Upload ----------
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
      // Check if audio
      if (!file.type.startsWith('audio/')) {
        alert(`Skipping ${file.name} – not an audio file.`);
        continue;
      }
      try {
        const formData = new FormData();
        formData.append('sample', file);
        const res = await fetch('/api/upload-sample', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
          // Add a new pad dynamically
          const newPad = {
            name: file.name.replace(/\.[^.]+$/, ''),
            icon: '🎵',
            type: 'sample',
            sample: data.filename,
            freq: null
          };
          this.pads.push(newPad);
          this.buildPads(); // rebuild grid
          // Load the sample into engine
          const url = `/static/audio/uploads/${data.filename}`;
          await this.engine.loadSample(data.filename, url);
          this.updateStatus(`Uploaded ${file.name}`);
        } else {
          alert(`Upload failed: ${data.error || 'Unknown error'}`);
        }
      } catch (e) {
        console.error(e);
        alert(`Error uploading ${file.name}: ${e.message}`);
      }
    }
  }

  // ---------- Utility ----------
  static updateStatus(msg) {
    const el = document.getElementById('loopStatus');
    if (el) el.innerText = msg;
  }
}

// Auto‑init after DOM
document.addEventListener('DOMContentLoaded', () => Instrumentals.init());
