/* Forkestra: fetches a contribution year, draws it, and hands it to the synth. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var form = $('form'), userIn = $('user'), goBtn = $('go'), statusEl = $('status');
  var stage = $('stage'), avatar = $('avatar'), handle = $('handle'), summary = $('summary');
  var canvas = $('chart'), playBtn = $('play'), bar = $('bar'), fill = $('fill');
  var dateEl = $('date'), clockEl = $('clock');
  var moodSel = $('mood'), bpmIn = $('bpm'), bpmv = $('bpmv');
  var volIn = $('vol'), volv = $('volv'), drumsIn = $('drums'), shareBtn = $('share');

  var synth = new CommitSynth();
  window.forkestra = synth;   // handy for tinkering from the console
  var days = [];
  var current = -1;

  /* ---- input -------------------------------------------------------- */

  function parseUser(raw) {
    var s = (raw || '').trim();
    if (!s) return '';
    s = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    if (s.indexOf('github.com/') === 0) s = s.slice('github.com/'.length);
    s = s.split(/[/?#]/)[0].replace(/^@/, '');
    return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(s) ? s : '';
  }

  function say(msg, isErr) {
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('err', !!isErr);
  }

  /* ---- data --------------------------------------------------------- */

  var SOURCES = [
    {
      url: function (u) { return 'https://github-contributions-api.jogruber.de/v4/' + u + '?y=last'; },
      parse: function (j) {
        if (!j || !Array.isArray(j.contributions)) return null;
        return j.contributions.map(function (d) {
          return { date: d.date, count: d.count | 0, level: d.level | 0 };
        });
      }
    },
    {
      url: function (u) { return 'https://github-contributions.vercel.app/api/v1/' + u; },
      parse: function (j) {
        var list = j && (j.contributions || j.days);
        if (!Array.isArray(list)) return null;
        var flat = Array.isArray(list[0]) ? [].concat.apply([], list) : list;
        return flat.map(function (d) {
          var c = d.count | 0;
          return { date: d.date, count: c, level: c === 0 ? 0 : c < 3 ? 1 : c < 6 ? 2 : c < 10 ? 3 : 4 };
        }).slice(-371);
      }
    }
  ];

  function fetchYear(user) {
    var i = 0;
    function attempt() {
      if (i >= SOURCES.length) {
        return Promise.reject(new Error("Couldn't reach the contribution data. Try again in a moment."));
      }
      var src = SOURCES[i++];
      return fetch(src.url(user), { cache: 'no-store' })
        .then(function (r) {
          if (r.status === 404) throw Object.assign(new Error('no user'), { fatal: true });
          if (!r.ok) throw new Error('bad status ' + r.status);
          return r.json();
        })
        .then(function (j) {
          var out = src.parse(j);
          if (!out || !out.length) throw new Error('empty');
          return out;
        })
        .catch(function (e) {
          if (e.fatal) throw new Error('No GitHub user called "' + user + '".');
          return attempt();
        });
    }
    return attempt();
  }

  /* ---- chart -------------------------------------------------------- */

  var CELL = 11, GAP = 3, PAD = 6;

  function layout() {
    var weeks = Math.ceil(days.length / 7) || 53;
    var w = PAD * 2 + weeks * (CELL + GAP);
    var h = PAD * 2 + 7 * (CELL + GAP);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.aspectRatio = w + ' / ' + h;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  // GitHub's own contribution scales.
  var LEVELS_DARK  = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
  var LEVELS_LIGHT = ['#ebedf0', '#aceebb', '#4ac26b', '#2da44e', '#116329'];

  function draw() {
    var ctx = layout();
    var light = window.matchMedia('(prefers-color-scheme: light)').matches;
    var LEVELS = light ? LEVELS_LIGHT : LEVELS_DARK;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < days.length; i++) {
      var wk = Math.floor(i / 7), dow = i % 7;
      var x = PAD + wk * (CELL + GAP), y = PAD + dow * (CELL + GAP);
      var lvl = days[i].level;
      var played = i <= current;
      ctx.globalAlpha = current < 0 ? 1 : (played ? 1 : (light ? 0.55 : 0.38));
      ctx.fillStyle = LEVELS[Math.min(4, lvl)];
      round(ctx, x, y, CELL, CELL, 2.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (current >= 0 && current < days.length) {
      var cw = Math.floor(current / 7), cd = current % 7;
      var cx = PAD + cw * (CELL + GAP), cy = PAD + cd * (CELL + GAP);
      ctx.fillStyle = light ? 'rgba(9,105,218,0.12)' : 'rgba(88,166,255,0.14)';
      ctx.fillRect(cx - GAP / 2, 0, CELL + GAP, canvas.height);
      ctx.strokeStyle = light ? '#0969da' : '#ffffff';
      ctx.lineWidth = 1.5;
      round(ctx, cx - 1.5, cy - 1.5, CELL + 3, CELL + 3, 3.5);
      ctx.stroke();
    }
  }

  function round(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---- transport UI ------------------------------------------------- */

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  function tick(step) {
    current = Math.min(step, days.length - 1);
    var frac = days.length ? step / days.length : 0;
    fill.style.width = (frac * 100).toFixed(2) + '%';
    var total = days.length * (30 / synth.bpm);
    clockEl.textContent = fmt(frac * total) + ' / ' + fmt(total);
    var d = days[current];
    if (d) {
      dateEl.textContent = new Date(d.date + 'T00:00:00').toLocaleDateString(undefined,
        { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' · ' + d.count + (d.count === 1 ? ' contribution' : ' contributions');
    }
    draw();
  }

  synth.onstep = tick;
  synth.onend = function () { playBtn.classList.remove('on'); };

  playBtn.addEventListener('click', function () {
    if (!days.length) return;
    synth.toggle();
    playBtn.classList.toggle('on', synth.playing);
  });

  bar.addEventListener('click', function (e) {
    var r = bar.getBoundingClientRect();
    synth.seek((e.clientX - r.left) / r.width);
    tick(synth.step);
  });

  canvas.addEventListener('click', function (e) {
    var r = canvas.getBoundingClientRect();
    var scale = r.width / (PAD * 2 + Math.ceil(days.length / 7) * (CELL + GAP));
    var wk = Math.floor(((e.clientX - r.left) / scale - PAD) / (CELL + GAP));
    var dow = Math.floor(((e.clientY - r.top) / scale - PAD) / (CELL + GAP));
    var idx = wk * 7 + Math.max(0, Math.min(6, dow));
    if (idx >= 0 && idx < days.length) { synth.seek(idx / days.length); tick(synth.step); }
  });

  moodSel.addEventListener('change', function () { synth.mood = moodSel.value; });
  bpmIn.addEventListener('input', function () {
    synth.bpm = +bpmIn.value; bpmv.textContent = bpmIn.value; tick(synth.step);
  });
  volIn.addEventListener('input', function () {
    volv.textContent = volIn.value; synth.setVolume(+volIn.value / 100);
  });
  drumsIn.addEventListener('change', function () { synth.drums = drumsIn.checked; });

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && days.length && e.target.tagName !== 'INPUT' &&
        e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      playBtn.click();
    }
  });

  window.addEventListener('resize', function () { if (days.length) draw(); });

  shareBtn.addEventListener('click', function () {
    navigator.clipboard.writeText(location.href).then(function () {
      shareBtn.textContent = 'Copied';
      setTimeout(function () { shareBtn.textContent = 'Copy link'; }, 1600);
    }, function () { say('Copy this page URL to share: ' + location.href); });
  });

  /* ---- run ---------------------------------------------------------- */

  function run(raw, push) {
    var user = parseUser(raw);
    if (!user) { say('That does not look like a GitHub username or profile link.', true); return; }
    userIn.value = user;
    if (synth.playing) { synth.pause(); playBtn.classList.remove('on'); }
    goBtn.disabled = true;
    say('Looking up ' + user + '…');

    fetchYear(user).then(function (data) {
      days = data;
      current = -1;
      var total = data.reduce(function (a, d) { return a + d.count; }, 0);
      var active = data.filter(function (d) { return d.count > 0; }).length;
      var best = data.reduce(function (a, d) { return Math.max(a, d.count); }, 0);

      avatar.src = 'https://github.com/' + user + '.png?size=96';
      avatar.alt = user;
      handle.textContent = '@' + user;
      handle.href = 'https://github.com/' + user;
      summary.textContent = total.toLocaleString() + ' contributions · ' + active +
        ' active days · busiest day ' + best;

      synth.mood = moodSel.value;
      synth.bpm = +bpmIn.value;
      synth.drums = drumsIn.checked;
      synth.setVolume(+volIn.value / 100);
      synth.load(days);

      stage.hidden = false;
      say('');
      tick(0);
      synth.step = 0;

      if (push) {
        var url = location.pathname + '?u=' + encodeURIComponent(user);
        history.pushState({ u: user }, '', url);
      }
      if (total === 0) {
        say('No public contributions in the last year, so this one stays quiet.');
      } else if (push) {
        // Only autostart off a real click; browsers block audio otherwise.
        synth.play();
        playBtn.classList.add('on');
      } else {
        say('Ready. Press play.');
      }
    }).catch(function (e) {
      say(e.message, true);
    }).then(function () {
      goBtn.disabled = false;
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    run(userIn.value, true);
  });

  window.addEventListener('popstate', function () {
    var u = new URLSearchParams(location.search).get('u');
    if (u) run(u, false);
  });

  var initial = new URLSearchParams(location.search).get('u');
  if (initial) { userIn.value = initial; run(initial, false); }
  else { userIn.focus(); }
})();
