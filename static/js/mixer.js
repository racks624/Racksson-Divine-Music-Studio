// mixer.js — mixer controls & basic EQ wiring using Web Audio API
class Mixer {
   constructor(engine) {
      this.engine = engine; // expects AudioEngine instance
   }
   setMasterVolume(val) {
      this.engine.setMasterVolume(val);
   }
   setEq(low, mid, high) {
      this.engine.setEq(low, mid, high);
   }
}