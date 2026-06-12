/* static/js/studio.js
   Racksson — AudioEngine, Sequencer, ProjectDB, Recorder, UI bindings
   Drop into static/js/ and ensure it's referenced from base.html (it is).
*/

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.eqLow = null;
    this.eqMid = null;
    this.eqHigh = null;
    this.trackGains = {}; // per-track gain nodes
    this.buffers = {};
    this.chakraOsc = {};
    this.dest = null;
    this.isInitialized = false;
    this.fx = { reverb: 0.3, delay: 0.12, mix: 0.25 };
  }

  async init() {
    if (this.isInitialized) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    // create master chain
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9;
    this.eqLow = this.ctx.createBiquadFilter(); this.eqLow.type = 'lowshelf'; this.eqLow.frequency.value = 200;
    this.eqMid = this.ctx.createBiquadFilter(); this.eqMid.type = 'peaking'; this.eqMid.frequency.value = 1000; this.eqMid.Q.value = 1;
    this.eqHigh = this.ctx.createBiquadFilter(); this.eqHigh.type = 'highshelf'; this.eqHigh.frequency.value = 4000;

    this.eqLow.connect(this.eqMid); this.eqMid.connect(this.eqHigh); this.eqHigh.connect(this.master);
    this.master.connect(this.ctx.destination);

    // media stream destination for recording master output
    if (this.ctx.createMediaStreamDestination) {
      this.dest = this.ctx.createMediaStreamDestination();
      this.eqHigh.connect(this.dest); // connect after EQ so recorder hears final
    }

    this.isInitialized = true;
    console.log('AudioEngine initialized');
  }

  setMasterVolume(v){ if(this.master) this.master.gain.value = v; }
  setEq(low, mid, high){
    if(this.eqLow) this.eqLow.gain.value = low;
    if(this.eqMid) this.eqMid.gain.value = mid;
    if(this.eqHigh) this.eqHigh.gain.value = high;
  }

  createTrackGain(trackId){
    if(this.trackGains[trackId]) return this.trackGains[trackId];
    const g = this.ctx.createGain(); g.gain.value = 1.0;
    g.connect(this.eqLow);
    this.trackGains[trackId] = g;
    return g;
  }

  async loadSample(key, url){
    if(this.buffers[key]) return this.buffers[key];
    try {
      const resp = await fetch(url);
      const arr = await resp.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(arr);
      this.buffers[key] = buffer;
      return buffer;
    } catch(e){
      console.warn('Failed to load sample', key, url, e);
      return null;
    }
  }

  playSample(key, when=0, gain=1, trackId=null){
    const buf = this.buffers[key];
    if(!buf){ console.warn('Missing buffer', key); return; }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(g);
    // if trackId, route to track gain (allow per-track volume)
    if(trackId){
      const trackGain = this.createTrackGain(trackId);
      g.connect(trackGain);
    } else {
      g.connect(this.eqLow);
    }
    src.start(this.ctx.currentTime + when);
  }

  // Chakra oscillator controls
  startChakra(id, frequency){
    if(!this.isInitialized) this.init();
    if(this.chakraOsc[id]) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(this.eqLow);
    osc.start();
    gain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 0.25);
    this.chakraOsc[id] = {osc, gain};
  }
  stopChakra(id){
    const n = this.chakraOsc[id];
    if(!n) return;
    n.gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.35);
    setTimeout(()=>{ try{ n.osc.stop(); }catch(e){}; delete this.chakraOsc[id]; }, 450);
  }

  getMediaStream(){ return this.dest ? this.dest.stream : null; }

  // Simple FX placeholder (client-side convolver/reverb would require impulse files)
  applyFx({reverb, delay, mix}){
    this.fx = {reverb, delay, mix};
    console.log('FX updated', this.fx);
  }
}

/* ----------------------------
   ProjectDB — IndexedDB wrapper
   ---------------------------- */
class ProjectDB {
  constructor(dbName='racksson-db'){ this.dbName = dbName; this.db = null; }
  open(){
    return new Promise((resolve,reject)=>{
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if(!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', {keyPath: 'id', autoIncrement:true});
        if(!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings', {keyPath:'id', autoIncrement:true});
      };
      req.onsuccess = (e)=>{ this.db = e.target.result; resolve(this.db); };
      req.onerror = (e)=> reject(e);
    });
  }
  async saveProject(payload){
    await this.open();
    return new Promise((resolve,reject)=>{
      const tx = this.db.transaction('projects','readwrite');
      const store = tx.objectStore('projects');
      const req = store.add(payload);
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = (e)=> reject(e);
    });
  }
  async listProjects(){
    await this.open();
    return new Promise((resolve,reject)=>{
      const tx = this.db.transaction('projects','readonly');
      const store = tx.objectStore('projects');
      const all = store.getAll();
      all.onsuccess = ()=> resolve(all.result);
      all.onerror = (e)=> reject(e);
    });
  }
  async saveRecording(blob, meta){
    await this.open();
    return new Promise((resolve,reject)=>{
      const tx = this.db.transaction('recordings','readwrite');
      const store = tx.objectStore('recordings');
      const req = store.add({blob, meta, created: Date.now()});
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = (e)=> reject(e);
    });
  }
}

/* ----------------------------
   Sequencer & Studio glue
   ---------------------------- */

const engine = new AudioEngine();
const db = new ProjectDB();

// tracks configuration
const TRACKS = [
  {id:'drums', label:'Drums', samples: ['kick','snare','hihat','clap']},
  {id:'bass', label:'Bass', samples: ['bass']},
  {id:'lead', label:'Lead', samples: ['lead']},
  {id:'chords', label:'Chords', samples: ['chords']}
];

const SAMPLE_MAP = {
  kick: '/static/audio/kick.ogg',
  snare: '/static/audio/snare.ogg',
  hihat: '/static/audio/hihat.ogg',
  clap: '/static/audio/clap.ogg',
  bass: '/static/audio/bass_808.ogg',
  lead: '/static/audio/lead_synth.ogg',
  chords: '/static/audio/chords_pad.ogg'
};

// sequencer state
let grid = {}; TRACKS.forEach(t=> grid[t.id] = Array(16).fill(false));
let playing=false, stepTimer=null, currentStep=0;

// recorder state
let mediaRecorder = null, recordedChunks = [], lastRecordedBlob = null;

/* UI Builder: creates tracks + grid and binds events used by templates */
async function initStudio(){
  await engine.init();
  // pre-load available samples (non-blocking)
  for(const [k,u] of Object.entries(SAMPLE_MAP)) engine.loadSample(k,u).catch(()=>{});

  // create UI track rows (tracksContainer should exist in studio_pro.html)
  const tracksContainer = document.getElementById('tracksContainer');
  if(!tracksContainer) {
    console.warn('tracksContainer not found; abort UI build');
    return;
  }
  tracksContainer.innerHTML = '';
  TRACKS.forEach(track=>{
    const row = document.createElement('div'); row.style.marginBottom='8px';
    const header = document.createElement('div'); header.style.display='flex'; header.style.gap='8px'; header.style.alignItems='center';
    const lbl = document.createElement('div'); lbl.style.width='80px'; lbl.style.color='#ffdca3'; lbl.textContent = track.label;
    header.appendChild(lbl);
    // pattern control small buttons
    const soloBtn = document.createElement('button'); soloBtn.className='btn'; soloBtn.textContent='Solo'; soloBtn.onclick = ()=>{ alert('Solo toggle (placeholder)'); };
    const muteBtn = document.createElement('button'); muteBtn.className='btn'; muteBtn.textContent='Mute'; muteBtn.onclick = ()=>{ alert('Mute toggle (placeholder)'); };
    header.appendChild(soloBtn); header.appendChild(muteBtn);
    row.appendChild(header);

    const gridDiv = document.createElement('div'); gridDiv.className='seq-grid';
    gridDiv.style.display = 'grid'; gridDiv.style.gridTemplateColumns = 'repeat(16,1fr)'; gridDiv.style.gap='6px'; gridDiv.style.marginTop='8px';
    for(let i=0;i<16;i++){
      const s = document.createElement('div'); s.className='seq-step'; s.innerText = i+1; s.dataset.track = track.id; s.dataset.index = i;
      s.onclick = ()=>{ grid[track.id][i] = !grid[track.id][i]; s.classList.toggle('active', grid[track.id][i]); };
      gridDiv.appendChild(s);
    }
    row.appendChild(gridDiv);
    tracksContainer.appendChild(row);
  });

  // build chakra list if present
  const chakraListEl = document.getElementById('chakraList');
  if(chakraListEl){
    const chakras = [
      {id:'crown', hz:963, color:'#FFD700', label:'Crown 963Hz'},
      {id:'third', hz:852, color:'#7F00FF', label:'Third Eye 852Hz'},
      {id:'solar', hz:528, color:'#FFD966', label:'Solar 528Hz'},
      {id:'root', hz:139, color:'#8B0000', label:'Root 139Hz'},
      {id:'a432', hz:432, color:'#00B894', label:'Natural A 432Hz'}
    ];
    chakraListEl.innerHTML = '';
    chakras.forEach(c=>{
      const node = document.createElement('div'); node.className='chakra-item'; node.style.display='flex'; node.style.justifyContent='space-between'; node.style.alignItems='center';
      node.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><div style="width:10px;height:10px;border-radius:50%;background:${c.color}"></div><div>${c.label}</div></div>
                        <div style="display:flex;gap:6px"><button class="btn" data-hz="${c.hz}">▶ Play</button><button class="btn" data-stop="${c.id}">■ Stop</button></div>`;
      chakraListEl.appendChild(node);
    });
    chakraListEl.querySelectorAll('.btn').forEach(b=>{
      b.onclick = (ev)=>{
        const hz = parseFloat(b.dataset.hz || b.getAttribute('data-hz'));
        const stop = b.dataset.stop || b.getAttribute('data-stop');
        if(hz) engine.startChakra(b.dataset.id || ('c'+hz), hz);
        if(stop) engine.stopChakra(stop);
      };
    });
  }

  // bind recorder buttons if present
  const startRecBtn = document.getElementById('startRec');
  const stopRecBtn = document.getElementById('stopRec');
  const downloadRecBtn = document.getElementById('downloadRec');
  if(startRecBtn) startRecBtn.onclick = ()=> startRecording();
  if(stopRecBtn) stopRecBtn.onclick = ()=> stopRecording();
  if(downloadRecBtn) downloadRecBtn.onclick = ()=> downloadLastRecording();

  console.log('Studio UI initialized');
}

/* Sequencer playback */
function startPlay(){
  if(playing) return;
  playing = true;
  const bpm = Math.max(40, Math.min(240, parseInt(document.getElementById('bpm')?.value || 90)));
  const stepDuration = (60 / bpm) / 4; // seconds per 16th
  currentStep = 0;
  // schedule using setInterval (ok for mobile; for super-tight timing use lookahead scheduling)
  stepTimer = setInterval(()=>{
    // visual highlight
    document.querySelectorAll('.seq-step').forEach(el=>{
      el.style.opacity = (parseInt(el.dataset.index) === currentStep ? '1' : '0.8');
    });
    // play per-track if step active
    TRACKS.forEach(track=>{
      if(grid[track.id][currentStep]){
        // simple mapping: drums use rotating samples to add variety
        if(track.id === 'drums'){
          const idx = currentStep % 4;
          const key = ['kick','snare','hihat','clap'][idx] || 'kick';
          engine.playSample(key, 0, 1, 'drums');
        } else {
          const sampleKey = (track.id in SAMPLE_MAP) ? track.id : Object.keys(SAMPLE_MAP)[0];
          engine.playSample(track.id in SAMPLE_MAP ? track.id : track.id, 0, 1, track.id);
        }
      }
    });
    currentStep = (currentStep + 1) % 16;
  }, stepDuration * 1000);
  document.getElementById('studioStatus') && (document.getElementById('studioStatus').innerText = 'Playing');
}

function stopPlay(){
  if(!playing) return;
  playing = false;
  clearInterval(stepTimer);
  stepTimer = null;
  currentStep = 0;
  document.getElementById('studioStatus') && (document.getElementById('studioStatus').innerText = 'Stopped');
}

/* Recording integration */
async function startRecording(){
  await engine.init();
  const stream = engine.getMediaStream();
  if(!stream){ alert('Recording not available on this device/browser'); return; }
  recordedChunks = [];
  try {
    mediaRecorder = new MediaRecorder(stream);
  } catch(e){
    alert('Recording init failed: ' + e.message);
    return;
  }
  mediaRecorder.ondataavailable = (evt)=>{ if(evt.data && evt.data.size) recordedChunks.push(evt.data); };
  mediaRecorder.onstop = async ()=>{
    const blob = new Blob(recordedChunks, {type: recordedChunks[0]?.type || 'audio/webm'});
    lastRecordedBlob = blob;
    // save to IndexedDB
    try {
      const id = await db.saveRecording(blob, {title: document.getElementById('recTitle')?.value || 'Recording'});
      console.log('saved recording id', id);
      // attempt server upload (FormData)
      const fd = new FormData(); fd.append('audio_data', blob, `recording_${Date.now()}.webm`);
      const resp = await fetch('/api/save-recording', { method:'POST', body: fd });
      const j = await resp.json();
      console.log('server save', j);
      alert('Recording saved locally and uploaded (if server reachable).');
    } catch(e){
      console.warn('save-recording error', e);
      alert('Recording saved locally (IndexedDB), server upload failed.');
    }
  };
  mediaRecorder.start();
  document.getElementById('studioStatus') && (document.getElementById('studioStatus').innerText = 'Recording...');
}

function stopRecording(){
  if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  document.getElementById('studioStatus') && (document.getElementById('studioStatus').innerText = 'Recording stopped');
}

function downloadLastRecording(){
  if(!lastRecordedBlob){ alert('No recording available'); return; }
  const url = URL.createObjectURL(lastRecordedBlob);
  const a = document.createElement('a'); a.href = url; a.download = `racksson_recording_${Date.now()}.webm`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* Project Save to Server / Local */
async function sendProjectToServer(){
  const name = prompt('Project name', document.getElementById('projectName')?.innerText || `project_${Date.now()}`);
  if(!name) return;
  const payload = { name, grid, bpm: document.getElementById('bpm')?.value || 90, tracks: TRACKS.map(t=>t.id), created: Date.now() };
  // try save to server
  try {
    const res = await fetch('/api/save-project', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const j = await res.json();
    if(res.ok){ alert('Saved to server: ' + (j.filename || j.id || 'ok')); return; }
    else { console.warn('server responded non-ok', j); }
  } catch(e){ console.warn('server save failed', e); }

  // fallback to local DB
  try {
    const id = await db.saveProject(payload);
    alert('Saved locally (IndexedDB) id: ' + id);
  } catch(e){
    console.error('local save failed', e);
    alert('Save failed: ' + e.message);
  }
}

/* Entry point */
window.initStudio = async function(){
  await db.open();
  await initStudio();
  // expose engine and db globally for pages
  window.rackEngine = engine;
  window.rackDB = db;
  // attach helper functions to window for templates
  window.startPlay = startPlay;
  window.stopPlay = stopPlay;
  window.sendProjectToServer = sendProjectToServer;
  window.startRec = startRecording;
  window.stopRec = stopRecording;
  window.downloadLastRecording = downloadLastRecording;
};

window.addEventListener('load', ()=>{ /* no auto init to avoid audio autoplay policies */ });