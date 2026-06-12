// recorder.js — wraps the engine's media stream into MediaRecorder and upload
let recorder = null;
let recordedChunks = [];

async function startRec(engine){
  const stream = engine.getMediaStream();
  if(!stream) { alert('Recording not supported'); return; }
  recordedChunks = [];
  try {
    recorder = new MediaRecorder(stream);
  } catch(e){
    alert('Recorder init failed: ' + e.message);
    return;
  }
  recorder.ondataavailable = e => { if(e.data && e.data.size) recordedChunks.push(e.data); };
  recorder.onstop = async () => {
    const blob = new Blob(recordedChunks, {type: recordedChunks[0]?.type || 'audio/webm'});
    // save to server via fetch
    const fd = new FormData(); fd.append('audio_data', blob, `recording_${Date.now()}.webm`);
    try {
      const res = await fetch('/api/save-recording', { method:'POST', body: fd });
      const j = await res.json();
      alert('Recording saved: ' + (j.filename || j.id || 'OK'));
    } catch(e){ console.error(e); alert('Upload failed: '+e.message); }
  };
  recorder.start();
}

function stopRec(){
  if(recorder && recorder.state !== 'inactive') recorder.stop();
}