// audio.js — all sound is synthesized with WebAudio: no audio files, no network.
export function makeAudio() {
  const audio = {
    ctx: null, master: null, engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
    muted: false, started: false,
    init() {
      if (this.started) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        // Engine hum: two detuned saws through a lowpass.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        const engineOsc2 = this.ctx.createOscillator();
        engineOsc2.type = 'sawtooth';
        engineOsc2.frequency.value = 58;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 320;
        this.engineOsc.connect(filter); engineOsc2.connect(filter);
        filter.connect(this.engineGain); this.engineGain.connect(this.master);
        this.engineOsc.start(); engineOsc2.start();
        this.engineOsc2 = engineOsc2;
        // Police siren: triangle sweeping between two tones.
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 700;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        this.started = true;
      } catch (e) { /* audio unavailable: the game stays silent */ }
    },
    setEngine(speedRatio, driving) {
      if (!this.started || this.muted) return;
      const f = 50 + speedRatio * 140;
      this.engineOsc.frequency.value = f;
      this.engineOsc2.frequency.value = f * 1.01;
      this.engineGain.gain.value = driving ? 0.05 + speedRatio * 0.06 : 0.015;
    },
    setSiren(wanted, t) {
      if (!this.started || this.muted) return;
      if (wanted > 0) {
        this.sirenOsc.frequency.value = 650 + 260 * Math.sin(t * 4.4);
        this.sirenGain.gain.value = 0.045;
      } else {
        this.sirenGain.gain.value = 0;
      }
    },
    play(name) {
      if (!this.started || this.muted) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      if (name === 'shot') {
        const dur = 0.12;
        const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const g = ctx.createGain(); g.gain.value = 0.35;
        src.connect(g); g.connect(this.master); src.start(now);
      } else if (name === 'cash' || name === 'pickup') {
        [880, 1320].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.25, now + i * 0.09);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.25);
          o.connect(g); g.connect(this.master);
          o.start(now + i * 0.09); o.stop(now + i * 0.09 + 0.3);
        });
      } else if (name === 'crash') {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 90;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        o.connect(g); g.connect(this.master);
        o.start(now); o.stop(now + 0.3);
      } else if (name === 'busted' || name === 'wasted') {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(320, now);
        o.frequency.linearRampToValueAtTime(70, now + 0.9);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1);
        o.connect(g); g.connect(this.master);
        o.start(now); o.stop(now + 1);
      }
    },
    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
      return this.muted;
    },
  };
  return audio;
}
