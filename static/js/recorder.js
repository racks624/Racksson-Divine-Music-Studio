/**
 * Recorder – Professional audio capture with waveform, playback, and server upload.
 * Depends on global AudioEngine (studio.js) for master stream, but can also use mic.
 */
class Recorder {
  static engine = null;
  static mediaRecorder = null;
  static recordedChunks = [];
  static blob = null;
  static isRecording = false;
  static isPlaying = false;
  static audioPlayer = null;
  static waveformCtx = null;
  static analyser = null;
  static stream = null;
  static recordings = []; // local cache

  static async init() {
    // Wait for engine
    if (!window.rackEngine) {
      await new Promise(r => setTimeout(r, 500));
    }
    this.engine = window.rackEngine;
    if (!this.engine) {
      console.warn("AudioEngine not ready; recorder will use microphone directly.");
    } else {
      if (!this.engine.isInitialized) await this.engine.init();
      // Get master stream from engine (for recording master output)
      if (this.engine.getMediaStream) {
        this.stream = this.engine.getMediaStream();
      }
    }
    // If no master stream, fallback to microphone
    if (!this.stream) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        alert("No audio input available. Please grant microphone permissions.");
        return;
      }
    }
    this.setupWaveform();
    this.attachEvents();
    this.loadSavedRecordings();
    this.updateStatus('Ready');
  }

  static setupWaveform() {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return;
    this.waveformCtx = canvas.getContext('2d');
    // Resize
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width || 600;
    canvas.height = 120;
    // Create analyser if we have stream
    if (this.stream && this.engine && this.engine.ctx) {
      this.analyser = this.engine.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      const source = this.engine.ctx.createMediaStreamSource(this.stream);
      source.connect(this.analyser);
      this.drawWaveform();
    }
  }

  static drawWaveform() {
    if (!this.waveformCtx || !this.analyser) {
      // Draw a placeholder
      const canvas = document.getElementById('waveformCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#333';
      ctx.font = '14px sans-serif';
      ctx.fillText('🎵 Waveform will appear while recording', 20, canvas.height/2);
      return;
    }
    const bufferLength = this.analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    const draw = () => {
      if (!this.isRecording && !this.isPlaying) {
        // Still draw a gentle line
        this.analyser.getByteTimeDomainData(dataArray);
      } else {
        this.analyser.getByteTimeDomainData(dataArray);
      }
      const canvas = document.getElementById('waveformCanvas');
      if (!canvas) return;
      const ctx = this.waveformCtx;
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#d4af37';
      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
      requestAnimationFrame(draw);
    };
    draw();
  }

  static attachEvents() {
    document.getElementById('recStartBtn')?.addEventListener('click', () => this.startRecording());
    document.getElementById('recStopBtn')?.addEventListener('click', () => this.stopRecording());
    document.getElementById('recPlayBtn')?.addEventListener('click', () => this.playRecording());
    document.getElementById('recDownloadBtn')?.addEventListener('click', () => this.downloadRecording());
    document.getElementById('recClearBtn')?.addEventListener('click', () => this.clearRecording());
  }

  static async startRecording() {
    if (this.isRecording) return;
    // Reset chunks
    this.recordedChunks = [];
    if (!this.stream) {
      alert("No audio stream available.");
      return;
    }
    try {
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (ev) => {
        if (ev.data.size) this.recordedChunks.push(ev.data);
      };
      this.mediaRecorder.onstop = () => {
        this.blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        this.isRecording = false;
        document.getElementById('recStopBtn').disabled = true;
        document.getElementById('recPlayBtn').disabled = false;
        document.getElementById('recDownloadBtn').disabled = false;
        document.getElementById('recIndicator').classList.add('hidden');
        this.updateStatus('Recording stopped');
        // Save to list and server
        this.saveRecording();
        // Feedback
        if (window.SoundFeedback) SoundFeedback.success();
      };
      this.mediaRecorder.start();
      this.isRecording = true;
      document.getElementById('recStartBtn').disabled = true;
      document.getElementById('recStopBtn').disabled = false;
      document.getElementById('recPlayBtn').disabled = true;
      document.getElementById('recDownloadBtn').disabled = true;
      document.getElementById('recIndicator').classList.remove('hidden');
      this.updateStatus('🔴 Recording...');
      // Start timer
      this.startTimer();
      // feedback
      if (window.SoundFeedback) SoundFeedback.click(0.2);
    } catch (e) {
      alert('Recording failed: ' + e.message);
      if (window.SoundFeedback) SoundFeedback.error();
    }
  }

  static stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;
    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.stopTimer();
  }

  static playRecording() {
    if (!this.blob) return;
    if (this.isPlaying) {
      // Stop playback
      if (this.audioPlayer) {
        this.audioPlayer.pause();
        this.audioPlayer.currentTime = 0;
        this.isPlaying = false;
        document.getElementById('recPlayBtn').textContent = '▶ Play';
        if (window.SoundFeedback) SoundFeedback.click();
        return;
      }
    }
    const url = URL.createObjectURL(this.blob);
    this.audioPlayer = new Audio();
    this.audioPlayer.src = url;
    this.audioPlayer.play();
    this.isPlaying = true;
    document.getElementById('recPlayBtn').textContent = '⏸ Pause';
    if (window.SoundFeedback) SoundFeedback.click();
    this.audioPlayer.onended = () => {
      this.isPlaying = false;
      document.getElementById('recPlayBtn').textContent = '▶ Play';
      URL.revokeObjectURL(url);
    };
    this.audioPlayer.onpause = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        document.getElementById('recPlayBtn').textContent = '▶ Play';
      }
    };
  }

  static downloadRecording() {
    if (!this.blob) return;
    const url = URL.createObjectURL(this.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording_${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    if (window.SoundFeedback) SoundFeedback.success();
  }

  static clearRecording() {
    this.blob = null;
    this.recordedChunks = [];
    document.getElementById('recPlayBtn').disabled = true;
    document.getElementById('recDownloadBtn').disabled = true;
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer = null;
    }
    this.isPlaying = false;
    document.getElementById('recPlayBtn').textContent = '▶ Play';
    this.updateStatus('Recording cleared');
    if (window.SoundFeedback) SoundFeedback.click();
  }

  // ---- Timer ----
  static startTimer() {
    let seconds = 0;
    const el = document.getElementById('recTime');
    this.timerInterval = setInterval(() => {
      seconds++;
      const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
      const secs = String(seconds % 60).padStart(2, '0');
      el.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  static stopTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  }

  // ---- Save Recording ----
  static async saveRecording() {
    if (!this.blob) return;
    // Add to local list
    this.recordings.unshift({
      id: Date.now(),
      date: new Date().toLocaleString(),
      size: this.blob.size,
      blob: this.blob,
    });
    this.renderSavedRecordings();
    // Upload to server
    try {
      const formData = new FormData();
      formData.append('audio_data', this.blob, `recording_${Date.now()}.webm`);
      const res = await fetch('/api/save-recording', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        console.log('Uploaded to server:', data.filename);
        if (window.SoundFeedback) SoundFeedback.success();
      } else {
        console.warn('Server upload failed:', data);
      }
    } catch (e) {
      console.warn('Server upload error:', e);
    }
  }

  // ---- Load saved recordings from server ----
  static async loadSavedRecordings() {
    try {
      const res = await fetch('/api/recordings');
      if (!res.ok) return;
      const data = await res.json();
      // data.recordings is an array of filenames
      // We'll just show them as list items (but we don't have blobs for playback)
      // So we show them with download links (but we need full URL)
      // For simplicity, we'll show a list with download links.
      const list = document.getElementById('savedRecordingsList');
      if (!list) return;
      list.innerHTML = '';
      if (data.recordings && data.recordings.length) {
        data.recordings.forEach(fn => {
          const div = document.createElement('div');
          div.className = 'saved-recording';
          div.innerHTML = `
            <span>📄 ${fn}</span>
            <div>
              <a href="/static/audio/uploads/${fn}" download class="btn btn-sm">⬇️</a>
              <button class="btn btn-sm server-play" data-filename="${fn}">▶</button>
            </div>
          `;
          list.appendChild(div);
          // Attach play for server file (if we can get the URL)
          div.querySelector('.server-play').addEventListener('click', (e) => {
            const name = e.target.dataset.filename;
            const url = `/static/audio/uploads/${name}`;
            const audio = new Audio(url);
            audio.play();
            audio.onended = () => { /* nothing */ };
          });
        });
      } else {
        list.innerHTML = '<p style="color:#666;">No recordings yet.</p>';
      }
    } catch (e) {
      console.warn('Could not load server recordings:', e);
    }
  }

  static renderSavedRecordings() {
    const list = document.getElementById('savedRecordingsList');
    if (!list) return;
    // Show local recordings (with blobs)
    // We'll also keep server list below.
    // We'll prepend local ones.
    const localDiv = document.createElement('div');
    localDiv.id = 'localRecordings';
    localDiv.innerHTML = '<h4>Local Recordings</h4>';
    this.recordings.forEach((rec, idx) => {
      const div = document.createElement('div');
      div.className = 'saved-recording';
      const sizeKB = (rec.size / 1024).toFixed(0);
      div.innerHTML = `
        <span>🎧 ${rec.date} (${sizeKB} KB)</span>
        <div>
          <button class="btn btn-sm play-local" data-idx="${idx}">▶</button>
          <button class="btn btn-sm delete-local" data-idx="${idx}">🗑️</button>
        </div>
      `;
      localDiv.appendChild(div);
    });
    // Insert before server list
    const serverList = list.querySelector('#serverRecordings');
    if (serverList) {
      list.insertBefore(localDiv, serverList);
    } else {
      list.appendChild(localDiv);
    }
    // Attach events
    localDiv.querySelectorAll('.play-local').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.idx);
        const rec = this.recordings[idx];
        if (!rec) return;
        const url = URL.createObjectURL(rec.blob);
        const audio = new Audio(url);
        audio.play();
        audio.onended = () => URL.revokeObjectURL(url);
      });
    });
    localDiv.querySelectorAll('.delete-local').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.idx);
        this.recordings.splice(idx, 1);
        this.renderSavedRecordings();
      });
    });
  }

  static updateStatus(msg) {
    const el = document.getElementById('recState');
    if (el) el.textContent = msg;
  }
}

// Auto-init after DOM
document.addEventListener('DOMContentLoaded', () => Recorder.init());
