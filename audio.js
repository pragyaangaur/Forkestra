/* Forkestra: builds a playable arrangement out of a year of contributions.
   One day is one eighth note. Commit counts write the melody. Weekly totals
   move the bass under it, and the chord turns over every four weeks. */
(function (global) {
  'use strict';

  var mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  var MINOR_PENT = [0, 3, 5, 7, 10];
  var MAJOR_PENT = [0, 2, 4, 7, 9];
  var DORIAN     = [0, 2, 3, 5, 7, 9, 10];

  var MINOR_PROG = [
    { b: 0,  n: [0, 3, 7] },    // i
    { b: -4, n: [8, 12, 15] },  // VI
    { b: -9, n: [3, 7, 10] },   // III
    { b: -7, n: [5, 8, 12] }    // iv
  ];
  var MAJOR_PROG = [
    { b: 0,  n: [0, 4, 7] },    // I
    { b: -3, n: [9, 12, 16] },  // vi
    { b: -7, n: [5, 9, 12] },   // IV
    { b: -5, n: [7, 11, 14] }   // V
  ];

  var MOODS = {
    dawn:  { root: 62, scale: MAJOR_PENT, prog: MAJOR_PROG, lead: 'triangle', sub: 'sine',
             detune: 6, cutoff: 4200, decay: 0.9, reverb: 0.26, delay: 0.20, padGain: 0.16, drumGain: 0.8 },
    dusk:  { root: 57, scale: MINOR_PENT, prog: MINOR_PROG, lead: 'triangle', sub: 'sine',
             detune: 9, cutoff: 3000, decay: 1.1, reverb: 0.34, delay: 0.26, padGain: 0.20, drumGain: 0.85 },
    neon:  { root: 54, scale: DORIAN,     prog: MINOR_PROG, lead: 'sawtooth', sub: 'square',
             detune: 14, cutoff: 2600, decay: 0.55, reverb: 0.18, delay: 0.34, padGain: 0.22, drumGain: 1.0 },
    glass: { root: 64, scale: MAJOR_PENT, prog: MAJOR_PROG, lead: 'sine',     sub: 'sine',
             detune: 3, cutoff: 6000, decay: 2.2, reverb: 0.52, delay: 0.30, padGain: 0.14, drumGain: 0.4 }
  };

  function CommitSynth() {
    this.ctx = null;
    this.days = [];
    this.step = 0;
    this.playing = false;
    this.bpm = 116;
    this.mood = 'dusk';
    this.drums = true;
    this.volume = 0.8;
    this.onstep = null;
    this.onend = null;
    this._timer = null;
    this._nextTime = 0;
    this._voices = [];
  }

  CommitSynth.prototype._init = function () {
    if (this.ctx) return;
    var C = global.AudioContext || global.webkitAudioContext;
    var ctx = this.ctx = new C();

    this.master = ctx.createGain();
    this.master.gain.value = this.volume;

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 24;
    comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;

    this.master.connect(comp);
    comp.connect(ctx.destination);

    // Reverb from a decaying noise impulse, so nothing external has to load.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.6, 2.4);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.3;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.master);

    // Ping-pong-ish feedback delay.
    this.delay = ctx.createDelay(1.5);
    this.delayFb = ctx.createGain();
    this.delayFb.gain.value = 0.34;
    this.delayTone = ctx.createBiquadFilter();
    this.delayTone.type = 'lowpass';
    this.delayTone.frequency.value = 2400;
    this.delayGain = ctx.createGain();
    this.delayGain.gain.value = 0.25;
    this.delay.connect(this.delayTone);
    this.delayTone.connect(this.delayFb);
    this.delayFb.connect(this.delay);
    this.delay.connect(this.delayGain);
    this.delayGain.connect(this.master);
    this.delayGain.connect(this.reverb);
  };

  CommitSynth.prototype._impulse = function (dur, decay) {
    var ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * dur);
    var buf = ctx.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  };

  /* ---- arrangement -------------------------------------------------- */

  CommitSynth.prototype.load = function (days) {
    this.days = days.slice();
    this.step = 0;

    var counts = [], i;
    for (i = 0; i < days.length; i++) if (days[i].count > 0) counts.push(days[i].count);
    counts.sort(function (a, b) { return a - b; });
    // Robust ceiling so one 90-commit Saturday doesn't flatten the whole year.
    this.ceiling = counts.length ? Math.max(1, counts[Math.floor(counts.length * 0.92)]) : 1;
    this.busyDay = counts.length ? counts[Math.floor(counts.length * 0.5)] : 0;

    // Consecutive-day streak at each index.
    var streak = 0;
    this.streaks = days.map(function (d) {
      streak = d.count > 0 ? streak + 1 : 0;
      return streak;
    });

    // Weekly and monthly totals (weeks are 7-day blocks aligned to the graph).
    this.weekTotal = [];
    for (i = 0; i < days.length; i += 7) {
      var t = 0;
      for (var j = i; j < Math.min(i + 7, days.length); j++) t += days[j].count;
      this.weekTotal.push(t);
    }
    var wk = this.weekTotal.slice().sort(function (a, b) { return a - b; });
    this.weekMid = wk.length ? wk[Math.floor(wk.length / 2)] : 0;
    return this;
  };

  CommitSynth.prototype.duration = function () {
    return this.days.length * this._stepDur() + 2.5;
  };
  CommitSynth.prototype._stepDur = function () { return 30 / this.bpm; }; // eighth note

  /* ---- transport ---------------------------------------------------- */

  CommitSynth.prototype.play = function () {
    this._init();
    var self = this;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.playing) return;
    if (this.step >= this.days.length) this.step = 0;

    var m = MOODS[this.mood];
    this.reverbGain.gain.value = m.reverb;
    this.delayGain.gain.value = m.delay;
    this.delay.delayTime.value = this._stepDur() * 1.5;

    this.playing = true;
    this._nextTime = this.ctx.currentTime + 0.08;
    this._timer = setInterval(function () { self._schedule(); }, 25);
    this._schedule();
  };

  CommitSynth.prototype.pause = function () {
    this.playing = false;
    clearInterval(this._timer);
    this._timer = null;
    this._silence();
  };

  CommitSynth.prototype.toggle = function () { this.playing ? this.pause() : this.play(); };

  CommitSynth.prototype.seek = function (frac) {
    var was = this.playing;
    if (was) this.pause();
    this.step = Math.max(0, Math.min(this.days.length - 1, Math.round(frac * this.days.length)));
    if (this.onstep) this.onstep(this.step);
    if (was) this.play();
  };

  CommitSynth.prototype.setVolume = function (v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  };

  CommitSynth.prototype._silence = function () {
    var now = this.ctx ? this.ctx.currentTime : 0;
    this._voices.forEach(function (g) {
      try { g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0, now, 0.04); } catch (e) {}
    });
    this._voices = [];
  };

  CommitSynth.prototype._schedule = function () {
    var ahead = 0.12;
    while (this._nextTime < this.ctx.currentTime + ahead) {
      if (this.step >= this.days.length) {
        this.pause();
        this.step = this.days.length;
        if (this.onstep) this.onstep(this.step);
        if (this.onend) this.onend();
        return;
      }
      this._playStep(this.step, this._nextTime);
      var s = this.step, t = this._nextTime, self = this;
      var lag = Math.max(0, (t - this.ctx.currentTime) * 1000);
      setTimeout(function () { if (self.onstep) self.onstep(s); }, lag);
      this._nextTime += this._stepDur();
      this.step++;
    }
  };

  /* ---- one day ------------------------------------------------------ */

  CommitSynth.prototype._playStep = function (i, t) {
    var m = MOODS[this.mood];
    var day = this.days[i];
    var week = Math.floor(i / 7);
    var month = Math.floor(week / 4);
    var chord = m.prog[month % m.prog.length];
    var busyMonth = this.weekTotal[week] > this.weekMid;
    var dur = this._stepDur();

    // Chords land on the first day of every 4-week block.
    if (i % 28 === 0) this._pad(t, m, chord, busyMonth, dur * 28);

    // Bass moves once a week; louder weeks push it forward.
    if (i % 7 === 0) {
      var wt = this.weekTotal[week] || 0;
      if (wt > 0) {
        var lift = wt > this.weekMid * 2 ? 12 : 0;
        this._bass(t, m, m.root - 12 + chord.b + lift, dur * 7 * 0.9,
                   0.28 + Math.min(0.22, wt / (this.weekMid * 6 + 1)));
      }
    }

    if (day.count > 0) {
      var norm = Math.min(1, day.count / this.ceiling);
      var span = m.scale.length * 3;                       // ~3 octaves of the scale
      var deg = Math.round(Math.pow(norm, 0.8) * (span - 1));
      var semis = m.scale[deg % m.scale.length] + 12 * Math.floor(deg / m.scale.length);
      var note = m.root + chord.b + semis;
      this._lead(t, m, note, 0.16 + norm * 0.34, dur * (0.6 + norm * 1.6));
      // Loud days get a fifth stacked on top.
      if (norm > 0.7) this._lead(t + 0.012, m, note + 7, 0.10, dur * 0.9);
    }

    if (this.drums) this._drums(i, t, m, day);
  };

  /* ---- voices ------------------------------------------------------- */

  CommitSynth.prototype._lead = function (t, m, midi, amp, dur) {
    var ctx = this.ctx, f = mtof(midi);
    var g = ctx.createGain();
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(Math.min(12000, m.cutoff + f * 3), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(400, m.cutoff * 0.4), t + dur);
    filt.Q.value = 3;

    var a = ctx.createOscillator(), b = ctx.createOscillator();
    a.type = m.lead; b.type = m.sub;
    a.frequency.value = f; b.frequency.value = f;
    b.detune.value = m.detune;

    var bg = ctx.createGain(); bg.gain.value = 0.45;
    a.connect(filt); b.connect(bg); bg.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    g.connect(this.reverb);
    g.connect(this.delay);

    var rel = dur * m.decay;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rel);
    a.start(t); b.start(t);
    a.stop(t + rel + 0.05); b.stop(t + rel + 0.05);
    this._track(g, a, t + rel + 0.05);
  };

  CommitSynth.prototype._bass = function (t, m, midi, dur, amp) {
    var ctx = this.ctx;
    var o = ctx.createOscillator();
    o.type = m.lead === 'sawtooth' ? 'sawtooth' : 'triangle';
    o.frequency.value = mtof(midi);
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 320; filt.Q.value = 6;
    var g = ctx.createGain();
    o.connect(filt); filt.connect(g); g.connect(this.master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
    this._track(g, o, t + dur + 0.05);
  };

  CommitSynth.prototype._pad = function (t, m, chord, rich, dur) {
    var self = this;
    var notes = chord.n.slice();
    if (rich) notes.push(chord.n[0] + 14);           // busy month → add the 9th
    notes.forEach(function (n, k) {
      var ctx = self.ctx;
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m.root + chord.b + n - 12);
      o.detune.value = (k % 2 ? 7 : -7);
      var filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 900;
      var g = ctx.createGain();
      o.connect(filt); filt.connect(g);
      g.connect(self.master); g.connect(self.reverb);
      var amp = m.padGain / notes.length;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + dur * 0.25);
      g.gain.setValueAtTime(amp, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
      self._track(g, o, t + dur + 0.05);
    });
  };

  CommitSynth.prototype._drums = function (i, t, m, day) {
    var streak = this.streaks[i];
    var beat = i % 8;
    if (beat === 0 || (beat === 6 && day.count > this.busyDay)) this._kick(t, m.drumGain);
    if (streak >= 3 && beat === 4) this._snare(t, m.drumGain);
    if (streak >= 7 || (day.count > 0 && beat % 2 === 0)) {
      this._hat(t, m.drumGain * (streak >= 12 ? 0.9 : 0.6), streak >= 12 && beat === 7);
    }
  };

  CommitSynth.prototype._kick = function (t, gain) {
    var ctx = this.ctx;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9 * gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.3);
    this._track(g, o, t + 0.3);
  };

  CommitSynth.prototype._noise = function (t, dur, type, freq, amp, send) {
    var ctx = this.ctx;
    var len = Math.max(1, Math.ceil(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var filt = ctx.createBiquadFilter(); filt.type = type; filt.frequency.value = freq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    if (send) g.connect(this.reverb);
    src.start(t); src.stop(t + dur);
    this._track(g, src, t + dur);
  };

  CommitSynth.prototype._snare = function (t, gain) {
    this._noise(t, 0.18, 'bandpass', 1800, 0.34 * gain, true);
    var ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.1);
    g.gain.setValueAtTime(0.22 * gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.16);
    this._track(g, o, t + 0.16);
  };

  CommitSynth.prototype._hat = function (t, gain, open) {
    this._noise(t, open ? 0.22 : 0.045, 'highpass', 8000, 0.14 * gain, open);
  };

  CommitSynth.prototype._track = function (g, node, endTime) {
    var self = this;
    this._voices.push(g);
    node.onended = function () {
      var k = self._voices.indexOf(g);
      if (k >= 0) self._voices.splice(k, 1);
      try { g.disconnect(); } catch (e) {}
    };
  };

  global.CommitSynth = CommitSynth;
  global.CommitSynth.MOODS = MOODS;
})(window);
