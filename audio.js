/* Forkestra: builds a playable arrangement out of a year of contributions.
   One day is one eighth note. Commit counts write the melody. Weekly totals
   move the bass under it, and the chord turns over every four weeks.

   The instruments are rendered from scratch when the page first plays: plucked
   strings by Karplus-Strong, piano and bells from inharmonic partial stacks,
   bowed strings and winds from harmonic banks with vibrato and breath noise.
   Each one is built at two or three pitches and transposed from there, the way
   a sampler works, so a whole orchestra costs a few hundred milliseconds and
   no downloads. */
(function (global) {
  'use strict';

  var mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  /* ---- fast sine ---------------------------------------------------- */

  var TBL = new Float32Array(8192);
  for (var ti = 0; ti < 8192; ti++) TBL[ti] = Math.sin(ti / 8192 * Math.PI * 2);
  function sinT(p) {                       // p in turns, not radians
    p -= Math.floor(p);
    var x = p * 8192, i = x | 0, f = x - i;
    return TBL[i] + (TBL[(i + 1) & 8191] - TBL[i]) * f;
  }

  /* ---- tone rendering ----------------------------------------------- */

  // Plucked string. A noise burst chased around a delay line that loses its
  // high end on every lap, which is what makes a harp sound like a harp.
  function renderPluck(d, sr, f, damp, tone) {
    var N = Math.max(2, Math.round(sr / f));
    var line = new Float32Array(N), i;
    var prev = 0;
    for (i = 0; i < N; i++) {              // soften the pick with a one pole
      var w = Math.random() * 2 - 1;
      prev = prev + (w - prev) * tone;
      line[i] = prev;
    }
    var idx = 0, last = 0;
    for (i = 0; i < d.length; i++) {
      var cur = line[idx];
      d[i] = cur;
      line[idx] = (cur + last) * 0.5 * damp;
      last = cur;
      idx = (idx + 1) % N;
    }
    fadeOut(d, sr, 0.06);
  }

  // Struck and rung things. Partials are placed off the harmonic series and
  // given their own decay rates, so the top of the note dies before the body.
  function renderStruck(d, sr, f, spec) {
    var parts = spec.parts, n = d.length, i, k;
    for (k = 0; k < parts.length; k++) {
      var p = parts[k];
      var pf = f * p[0];
      if (pf > sr * 0.45) continue;
      var inc = pf / sr, amp = p[1], dec = p[2], ph = Math.random();
      for (i = 0; i < n; i++) {
        d[i] += sinT(ph + inc * i) * amp * Math.exp(-dec * i / sr);
      }
    }
    if (spec.knock) {                      // hammer or mallet contact noise
      var kl = Math.round(sr * spec.knock);
      for (i = 0; i < kl; i++) d[i] += (Math.random() * 2 - 1) * 0.5 * (1 - i / kl);
    }
    fadeOut(d, sr, 0.06);
  }

  // Bowed and blown notes. A harmonic bank with vibrato, plus a little drift
  // per copy so a string section never sounds like one player.
  function renderSustained(d, sr, f, spec) {
    var n = d.length, i, k, v;
    var copies = spec.copies || 1;
    var atk = spec.attack * sr;
    var bright = spec.bright || 0;
    for (v = 0; v < copies; v++) {
      var det = copies === 1 ? 1 : Math.pow(2, ((v - (copies - 1) / 2) * spec.spread) / 1200);
      var drift = (Math.random() * 2 - 1) * 0.4;
      var vibRate = spec.vibRate * (1 + drift * 0.12);
      var vibPh = Math.random();
      var phases = [];
      for (k = 0; k < spec.harm.length; k++) phases.push(Math.random());
      for (i = 0; i < n; i++) {
        var tsec = i / sr;
        var vib = sinT(vibPh + vibRate * tsec) * spec.vibDepth *
                  Math.min(1, tsec / (spec.vibDelay || 0.25));
        var ff = f * det * (1 + vib);
        // Brass and winds open up as the note settles rather than starting bright.
        var open = bright ? Math.min(1, 0.35 + tsec / 0.18) : 1;
        var s = 0;
        for (k = 0; k < spec.harm.length; k++) {
          var hf = ff * (k + 1);
          if (hf > sr * 0.45) break;
          var ha = spec.harm[k] * (k > 1 ? Math.pow(open, k - 1) : 1);
          phases[k] += hf / sr;
          s += sinT(phases[k]) * ha;
        }
        var env = i < atk ? Math.pow(i / atk, spec.curve || 1) : 1;
        d[i] += s * env / copies;
      }
    }
    if (spec.breath) {                     // air across the mouthpiece
      var lp = 0, hp = 0;
      for (i = 0; i < n; i++) {
        var w = Math.random() * 2 - 1;
        lp += (w - lp) * 0.28;
        hp = lp - hp * 0.02;
        var e = i < atk ? i / atk : 1;
        d[i] += lp * spec.breath * (0.55 + 0.45 * Math.exp(-i / sr * 6)) * e;
      }
    }
    fadeOut(d, sr, 0.25);
  }

  // Timpani: a membrane, so the partials sit at odd ratios and the head bends
  // downward in pitch as it settles.
  function renderTimpani(d, sr, f) {
    var n = d.length, ratios = [1, 1.5, 1.98, 2.44, 2.89];
    var amps = [1, 0.5, 0.3, 0.18, 0.1];
    for (var k = 0; k < ratios.length; k++) {
      var ph = Math.random();
      for (var i = 0; i < n; i++) {
        var tsec = i / sr;
        var bend = 1 + 0.22 * Math.exp(-tsec * 26);
        ph += f * ratios[k] * bend / sr;
        d[i] += sinT(ph) * amps[k] * Math.exp(-tsec * (2.2 + k * 1.6));
      }
    }
    var thump = Math.round(sr * 0.02);
    for (var j = 0; j < thump; j++) d[j] += (Math.random() * 2 - 1) * 0.4 * (1 - j / thump);
    fadeOut(d, sr, 0.1);
  }

  function fadeOut(d, sr, tail) {
    var n = d.length, len = Math.min(n, Math.round(sr * tail));
    for (var i = 0; i < len; i++) d[n - len + i] *= 1 - i / len;
  }

  function normalize(d, peak) {
    var m = 0, i;
    for (i = 0; i < d.length; i++) { var a = d[i] < 0 ? -d[i] : d[i]; if (a > m) m = a; }
    if (m > 0.0001) { var g = peak / m; for (i = 0; i < d.length; i++) d[i] *= g; }
  }

  /* ---- the instrument list ------------------------------------------ */

  var INSTRUMENTS = {
    harp: {
      zones: [45, 64, 81], len: 2.4, peak: 0.85,
      make: function (d, sr, f) { renderPluck(d, sr, f, 0.9968, 0.5); }
    },
    pizz: {
      zones: [40, 57], len: 0.9, peak: 0.8,
      make: function (d, sr, f) { renderPluck(d, sr, f, 0.982, 0.75); }
    },
    piano: {
      zones: [48, 65, 79], len: 2.8, peak: 0.85,
      make: function (d, sr, f) {
        var parts = [], B = 0.0005;
        for (var n = 1; n <= 12; n++) {
          var ratio = n * Math.sqrt(1 + B * n * n);
          parts.push([ratio, Math.pow(n, -1.35), 1.6 + n * 0.85]);
        }
        renderStruck(d, sr, f, { parts: parts, knock: 0.004 });
      }
    },
    bell: {
      zones: [72, 84], len: 3.0, peak: 0.7,
      make: function (d, sr, f) {
        renderStruck(d, sr, f, {
          parts: [[1, 1, 1.1], [2.01, 0.6, 1.6], [3.02, 0.4, 2.2],
                  [4.21, 0.25, 3.0], [5.43, 0.15, 4.0], [6.79, 0.1, 5.0]],
          knock: 0.002
        });
      }
    },
    marimba: {
      zones: [55, 72], len: 1.2, peak: 0.8,
      make: function (d, sr, f) {
        renderStruck(d, sr, f, {
          parts: [[1, 1, 5], [3.93, 0.35, 11], [9.2, 0.12, 20]], knock: 0.003
        });
      }
    },
    strings: {
      zones: [50, 64, 76], len: 3.0, loop: [1.1, 2.5], peak: 0.7,
      make: function (d, sr, f) {
        renderSustained(d, sr, f, {
          harm: [1, 0.55, 0.42, 0.3, 0.22, 0.16, 0.12, 0.09, 0.07, 0.05],
          attack: 0.16, curve: 1.6, copies: 4, spread: 16,
          vibRate: 5.2, vibDepth: 0.0035, vibDelay: 0.4
        });
      }
    },
    cello: {
      zones: [33, 45], len: 3.0, loop: [1.1, 2.5], peak: 0.75,
      make: function (d, sr, f) {
        renderSustained(d, sr, f, {
          harm: [1, 0.7, 0.5, 0.34, 0.24, 0.17, 0.12, 0.08],
          attack: 0.1, curve: 1.4, copies: 2, spread: 10,
          vibRate: 4.6, vibDepth: 0.003, vibDelay: 0.5
        });
      }
    },
    brass: {
      zones: [50, 62, 74], len: 2.6, loop: [0.9, 2.1], peak: 0.75,
      make: function (d, sr, f) {
        renderSustained(d, sr, f, {
          harm: [1, 0.8, 0.62, 0.5, 0.38, 0.28, 0.2, 0.14, 0.1],
          attack: 0.07, curve: 0.8, copies: 2, spread: 8, bright: 1,
          vibRate: 5, vibDepth: 0.0022, vibDelay: 0.45
        });
      }
    },
    flute: {
      zones: [67, 79], len: 2.2, loop: [0.8, 1.8], peak: 0.7,
      make: function (d, sr, f) {
        renderSustained(d, sr, f, {
          harm: [1, 0.16, 0.09, 0.04],
          attack: 0.06, curve: 1.2, copies: 1, spread: 0, breath: 0.055,
          vibRate: 5.6, vibDepth: 0.004, vibDelay: 0.3
        });
      }
    },
    horn: {
      zones: [45, 57], len: 3.0, loop: [1.0, 2.4], peak: 0.7,
      make: function (d, sr, f) {
        renderSustained(d, sr, f, {
          harm: [1, 0.5, 0.3, 0.18, 0.1, 0.06],
          attack: 0.18, curve: 1.5, copies: 3, spread: 12, bright: 1,
          vibRate: 4.4, vibDepth: 0.002, vibDelay: 0.6
        });
      }
    },
    timp: {
      zones: [36, 45], len: 2.0, peak: 0.9,
      make: function (d, sr, f) { renderTimpani(d, sr, f); }
    }
  };

  /* ---- ensembles ----------------------------------------------------- */

  var MINOR_PENT = [0, 3, 5, 7, 10];
  var MAJOR_PENT = [0, 2, 4, 7, 9];
  var DORIAN     = [0, 2, 3, 5, 7, 9, 10];

  var MINOR_PROG = [
    { b: 0,  n: [0, 3, 7] },
    { b: -4, n: [8, 12, 15] },
    { b: -9, n: [3, 7, 10] },
    { b: -7, n: [5, 8, 12] }
  ];
  var MAJOR_PROG = [
    { b: 0,  n: [0, 4, 7] },
    { b: -3, n: [9, 12, 16] },
    { b: -7, n: [5, 9, 12] },
    { b: -5, n: [7, 11, 14] }
  ];

  var ENSEMBLES = {
    chamber: {
      root: 62, scale: MAJOR_PENT, prog: MAJOR_PROG,
      lead: 'flute', counter: 'harp', bass: 'cello', pad: 'strings',
      leadOct: 0, reverb: 0.34, delay: 0.12, padGain: 0.30, percGain: 0.7, hall: 2.8
    },
    strings: {
      root: 57, scale: MINOR_PENT, prog: MINOR_PROG,
      lead: 'harp', counter: 'bell', bass: 'cello', pad: 'strings',
      leadOct: 0, reverb: 0.42, delay: 0.18, padGain: 0.32, percGain: 0.5, hall: 3.2
    },
    brass: {
      root: 54, scale: DORIAN, prog: MINOR_PROG,
      lead: 'brass', counter: 'pizz', bass: 'cello', pad: 'horn',
      leadOct: 0, reverb: 0.30, delay: 0.10, padGain: 0.26, percGain: 1.0, hall: 2.6
    },
    keys: {
      root: 60, scale: MAJOR_PENT, prog: MAJOR_PROG,
      lead: 'piano', counter: 'bell', bass: 'cello', pad: 'strings',
      leadOct: 0, reverb: 0.36, delay: 0.14, padGain: 0.24, percGain: 0.6, hall: 3.0
    }
  };

  /* ---- the synth ----------------------------------------------------- */

  function CommitSynth() {
    this.ctx = null;
    this.days = [];
    this.step = 0;
    this.playing = false;
    this.bpm = 116;
    this.mood = 'chamber';
    this.drums = true;
    this.volume = 0.8;
    this.trim = 1;
    this.onstep = null;
    this.onend = null;
    this.ready = false;
    this._timer = null;
    this._nextTime = 0;
    this._live = [];
    this._cache = {};
  }

  CommitSynth.prototype._init = function () {
    if (this.ctx) return;
    var C = global.AudioContext || global.webkitAudioContext;
    var ctx = this.ctx = new C();

    this.master = ctx.createGain();
    this.master.gain.value = this.volume * (this.trim || 1);

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 26;
    comp.ratio.value = 3.5; comp.attack.value = 0.006; comp.release.value = 0.28;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(3.0, 2.6);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.34;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.master);

    this.delay = ctx.createDelay(1.5);
    this.delayFb = ctx.createGain(); this.delayFb.gain.value = 0.26;
    this.delayTone = ctx.createBiquadFilter();
    this.delayTone.type = 'lowpass'; this.delayTone.frequency.value = 2200;
    this.delayGain = ctx.createGain(); this.delayGain.gain.value = 0.14;
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
      var d = buf.getChannelData(ch), lp = 0;
      for (var i = 0; i < len; i++) {
        lp += ((Math.random() * 2 - 1) - lp) * 0.5;      // darker tail, less hiss
        d[i] = lp * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  };

  // Builds every instrument an ensemble needs. Runs once, then it is cached.
  CommitSynth.prototype.warm = function (which) {
    this._init();
    var e = ENSEMBLES[which || this.mood];
    var names = [e.lead, e.counter, e.bass, e.pad, 'timp'];
    for (var i = 0; i < names.length; i++) this._samples(names[i]);
    this.ready = true;
  };

  CommitSynth.prototype._samples = function (name) {
    if (this._cache[name]) return this._cache[name];
    var def = INSTRUMENTS[name], ctx = this.ctx, sr = ctx.sampleRate;
    var set = [];
    for (var z = 0; z < def.zones.length; z++) {
      var midi = def.zones[z];
      var buf = ctx.createBuffer(1, Math.round(sr * def.len), sr);
      var d = buf.getChannelData(0);
      def.make(d, sr, mtof(midi));
      normalize(d, def.peak);
      set.push({ midi: midi, buf: buf });
    }
    this._cache[name] = { def: def, zones: set };
    return this._cache[name];
  };

  /* ---- arrangement --------------------------------------------------- */

  CommitSynth.prototype.load = function (days) {
    this.days = days.slice();
    this.step = 0;

    var counts = [], i;
    for (i = 0; i < days.length; i++) if (days[i].count > 0) counts.push(days[i].count);
    counts.sort(function (a, b) { return a - b; });
    this.ceiling = counts.length ? Math.max(1, counts[Math.floor(counts.length * 0.92)]) : 1;
    this.busyDay = counts.length ? counts[Math.floor(counts.length * 0.5)] : 0;

    // How full the year is. A sparse graph gets a more exposed, slower
    // arrangement so it plays as spacious rather than as empty.
    this.density = days.length ? counts.length / days.length : 0;
    this.sparse = this.density < 0.32;
    this.full = this.density > 0.55;
    // A light year has fewer notes to fill the room, so it is lifted to sit at
    // the same weight as a packed one.
    this.trim = Math.max(1, Math.min(1.9, 1 + (0.5 - this.density) * 1.8));

    var streak = 0;
    this.streaks = days.map(function (d) {
      streak = d.count > 0 ? streak + 1 : 0;
      return streak;
    });

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
  CommitSynth.prototype._stepDur = function () { return 30 / this.bpm; };

  /* ---- transport ----------------------------------------------------- */

  CommitSynth.prototype.play = function () {
    this._init();
    var self = this;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.playing) return;
    if (this.step >= this.days.length) this.step = 0;

    this.warm();
    var e = ENSEMBLES[this.mood];
    this.reverbGain.gain.value = e.reverb * (this.sparse ? 1.25 : 1);
    this.delayGain.gain.value = e.delay;
    this.delay.delayTime.value = this._stepDur() * 1.5;

    this.master.gain.setTargetAtTime(this.volume * (this.trim || 1), this.ctx.currentTime, 0.05);

    this.playing = true;
    this._nextTime = this.ctx.currentTime + 0.1;
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
    if (this.master) {
      this.master.gain.setTargetAtTime(v * (this.trim || 1), this.ctx.currentTime, 0.02);
    }
  };

  CommitSynth.prototype._silence = function () {
    var now = this.ctx ? this.ctx.currentTime : 0;
    this._live.forEach(function (g) {
      try { g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0, now, 0.05); } catch (e) {}
    });
    this._live = [];
  };

  CommitSynth.prototype._schedule = function () {
    var ahead = 0.14;
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

  /* ---- one day -------------------------------------------------------- */

  CommitSynth.prototype._playStep = function (i, t) {
    var e = ENSEMBLES[this.mood];
    var day = this.days[i];
    var week = Math.floor(i / 7);
    var month = Math.floor(week / 4);
    var chord = e.prog[month % e.prog.length];
    var heavy = (this.weekTotal[week] || 0) > this.weekMid;
    var dur = this._stepDur();

    if (i % 28 === 0) this._pad(t, e, chord, heavy, dur * 28);

    if (i % 7 === 0) {
      var wt = this.weekTotal[week] || 0;
      if (wt > 0) {
        var lift = wt > this.weekMid * 2 ? 12 : 0;
        this._note(e.bass, t, e.root - 24 + chord.b + lift, dur * 7 * 0.85,
                   0.36 + Math.min(0.24, wt / (this.weekMid * 6 + 1)), 0.9);
      } else if (this.sparse) {
        // Even an empty week keeps a floor under the piece.
        this._note(e.bass, t, e.root - 24 + chord.b, dur * 7 * 0.8, 0.18, 0.7);
      }
    }

    if (day.count > 0) {
      var norm = Math.min(1, day.count / this.ceiling);
      var span = e.scale.length * 2 + 1;              // a shade over two octaves
      var deg = Math.round(Math.pow(norm, 0.85) * (span - 1));
      var semis = e.scale[deg % e.scale.length] + 12 * Math.floor(deg / e.scale.length);
      var note = e.root + chord.b + semis + e.leadOct * 12;
      var amp = 0.30 + norm * 0.40;
      var hold = dur * (this.sparse ? 2.4 : 1.3) * (0.6 + norm);
      this._note(e.lead, t, note, hold, amp, 0.55 + norm * 0.45);

      // A standout day gets answered a beat later by the second instrument.
      if (norm > 0.72) {
        this._note(e.counter, t + dur * 0.5, note - 12, dur * 2, 0.20, 0.6);
      }
      // A packed year is thick enough to carry an inner line underneath.
      if (this.full && day.count > this.busyDay && i % 2 === 0) {
        this._note(e.counter, t, note - 12, dur * 1.6, 0.14, 0.5);
      }
    } else if (this.sparse && i % 4 === 0) {
      // Quiet stretches are given a chord tone rather than dead air, so a
      // light year plays as an open, unhurried piece.
      var tone = chord.n[(i / 4) % chord.n.length];
      this._note(e.counter, t, e.root + chord.b + tone, dur * 3, 0.11, 0.45);
    }

    if (this.drums) this._percussion(i, t, e, day, chord);
  };

  /* ---- voices ---------------------------------------------------------- */

  CommitSynth.prototype._note = function (name, t, midi, dur, amp, bright) {
    var ctx = this.ctx;
    var set = this._samples(name), def = set.def, zones = set.zones;
    var zone = zones[0], best = 1e9;
    for (var z = 0; z < zones.length; z++) {
      var dist = Math.abs(zones[z].midi - midi);
      if (dist < best) { best = dist; zone = zones[z]; }
    }

    var src = ctx.createBufferSource();
    src.buffer = zone.buf;
    src.playbackRate.value = mtof(midi) / mtof(zone.midi);
    var natural = def.len / src.playbackRate.value;
    if (def.loop && dur > natural * 0.8) {
      src.loop = true;
      src.loopStart = def.loop[0];
      src.loopEnd = def.loop[1];
    }

    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = Math.min(15000, 900 + mtof(midi) * (3 + (bright || 0.6) * 9));
    filt.Q.value = 0.4;

    var g = ctx.createGain();
    var atk = def.loop ? 0.03 : 0.004;
    var rel = def.loop ? Math.min(0.6, dur * 0.45) : Math.min(0.5, dur * 0.5);
    var end = t + dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + atk);
    g.gain.setValueAtTime(amp, Math.max(t + atk, end - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, end);

    src.connect(filt); filt.connect(g);
    g.connect(this.master);
    g.connect(this.reverb);
    if (!def.loop) g.connect(this.delay);

    src.start(t);
    src.stop(end + 0.05);
    this._track(g, src);
  };

  CommitSynth.prototype._pad = function (t, e, chord, rich, dur) {
    var notes = chord.n.slice();
    if (rich) notes.push(chord.n[0] + 14);
    var gain = e.padGain * (this.sparse ? 1.15 : 1) / notes.length;
    for (var k = 0; k < notes.length; k++) {
      this._note(e.pad, t + k * 0.05, e.root + chord.b + notes[k] - 12,
                 dur, gain, 0.35);
    }
  };

  CommitSynth.prototype._percussion = function (i, t, e, day, chord) {
    var streak = this.streaks[i];
    var beat = i % 8;
    var gain = e.percGain * (this.sparse ? 0.6 : 1);

    if (beat === 0 && (this.weekTotal[Math.floor(i / 7)] || 0) > 0) {
      this._note('timp', t, e.root - 24 + chord.b, 0.9, 0.34 * gain, 0.35);
    }
    if (day.count > this.ceiling * 0.9) {
      this._note('timp', t, e.root - 17 + chord.b, 0.7, 0.26 * gain, 0.4);
    }
    if (streak >= 3 && beat === 4) this._sideDrum(t, gain);
    if (streak >= 7 && beat % 2 === 0) this._tambourine(t, gain * 0.5);
    if (streak >= 14 && beat === 0) this._cymbal(t, gain * 0.35);
  };

  CommitSynth.prototype._noise = function (t, dur, type, freq, amp, q, send) {
    var ctx = this.ctx;
    var len = Math.max(1, Math.ceil(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var filt = ctx.createBiquadFilter();
    filt.type = type; filt.frequency.value = freq; filt.Q.value = q || 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    if (send) g.connect(this.reverb);
    src.start(t); src.stop(t + dur);
    this._track(g, src);
  };

  CommitSynth.prototype._sideDrum = function (t, gain) {
    this._noise(t, 0.13, 'bandpass', 1900, 0.30 * gain, 0.9, true);
    this._noise(t, 0.05, 'highpass', 4200, 0.16 * gain, 1, false);
  };

  CommitSynth.prototype._tambourine = function (t, gain) {
    this._noise(t, 0.06, 'highpass', 7000, 0.13 * gain, 1, false);
  };

  CommitSynth.prototype._cymbal = function (t, gain) {
    this._noise(t, 1.1, 'highpass', 5200, 0.16 * gain, 1, true);
  };

  CommitSynth.prototype._track = function (g, node) {
    var self = this;
    this._live.push(g);
    node.onended = function () {
      var k = self._live.indexOf(g);
      if (k >= 0) self._live.splice(k, 1);
      try { g.disconnect(); } catch (e) {}
    };
  };

  global.CommitSynth = CommitSynth;
  global.CommitSynth.ENSEMBLES = ENSEMBLES;
})(window);
