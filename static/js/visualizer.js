// visualizer.js — basic FFT visualizer (connect audio engine)
class Visualizer {
  constructor(audioCtx){
    this.ctx = audioCtx;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    this.canvas = null;
    this.canvasCtx = null;
    this.running = false;
  }
  attachTo(node, canvas){
    node.connect(this.analyser);
    this.canvas = canvas;
    this.canvasCtx = canvas.getContext('2d');
  }
  start(){
    if(!this.canvas) return;
    this.running = true;
    const draw = ()=>{
      if(!this.running) return;
      requestAnimationFrame(draw);
      this.analyser.getByteFrequencyData(this.data);
      const w = this.canvas.width, h = this.canvas.height;
      this.canvasCtx.fillStyle = 'rgba(0,0,0,0)';
      this.canvasCtx.clearRect(0,0,w,h);
      const barWidth = w / this.data.length;
      for(let i=0;i<this.data.length;i++){
        const v = this.data[i];
        this.canvasCtx.fillStyle = `rgba(212,175,55,${v/255})`;
        this.canvasCtx.fillRect(i*barWidth, h - (v/255)*h, barWidth, (v/255)*h);
      }
    };
    draw();
  }
  stop(){ this.running = false; }
}