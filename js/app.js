/* ORBEATS shared runtime. Vanilla JavaScript, no dependencies, no build step.
 *
 * Every page loads js/data.js first and then this file. This file:
 *   1. draws the shared parts (skip link, accessibility bar, header,
 *      background video + stars, now-playing bar),
 *   2. remembers the visitor's settings across pages,
 *   3. runs the sound (background music, dataset sounds, level meter),
 *   4. gives teammates a small API: window.ORBEATS (see the README).
 *
 * Page-specific code lives in its own file:
 *   js/explore.js      viewer, picker, catalog, count-up numbers
 *   js/series-sound.js plays a dataset's real measured series as sound
 */
(function () {
  'use strict';

  /* ================= 1. CONFIG: edit these to change the site ================= */

  /* The tabs in the header, in order. To add a tab: add a line here and
   * create the page (copy compose.html). */
  var TABS = [
    { id: 'explore', label: 'Explore', href: 'index.html' },   // Explore IS the homepage
    { id: 'play',    label: 'Play',    href: 'play.html' },
    { id: 'compose', label: 'Compose', href: 'compose.html' }
  ];
  var HOME = 'index.html';

  var TEXT_MIN = 100, TEXT_MAX = 160, TEXT_STEP = 15;   // text size, in percent

  var DATA = window.ORBEATS_DATA;
  var music = DATA.music;
  var datasets = DATA.datasets;

  /* ================= 2. STATE ================= */

  /* Settings the visitor can change. Saved in the browser, so they follow
   * the visitor from page to page. */
  var state = { audio: false, captions: true, volume: 0.12, scale: 100, contrast: false, motion: true };

  var chosen = false;      // has the visitor chosen sound on or off in this visit?
  var blocked = false;     // did the browser refuse to play sound?
  var musicFailed = false; // could the music file not be loaded?
  var current = null;      // the dataset that is playing, or null (then it is the music)
  var sound = null;        // the running dataset sound { position, setVolume, stop }, or null
  var nowPlaying = null;   // { title, caption } set by ORBEATS.setNowPlaying, or null
  var video = null;        // the background <video>: a silent picture only
  var siteMusic = null;    // the ONE <audio id="site-music"> that plays the Caldwell 73 music
  var musicPending = false;
  var musicHold = false;   // true while the game runs: the music is fully paused, whatever the Audio switch says
  var root = document.documentElement;

  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function noop() {}
  function emit(name, detail) { document.dispatchEvent(new CustomEvent(name, { detail: detail })); }
  function prefersReducedMotion() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function findDataset(id) { return datasets.filter(function (d) { return d.id === +id; })[0] || null; }

  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem('orbeats') || '{}');
      ['captions', 'scale', 'contrast', 'motion'].forEach(function (k) { if (k in s) state[k] = s[k]; });
      if (s.volumeV === 3 && 'volume' in s) state.volume = s.volume;      // an older saved (louder) volume is ignored
      /* The sound choice lasts for one visit (one browser tab), so a new
       * visitor at a kiosk always starts fresh. */
      /* Music on/off, saved until the visitor changes it. Nothing saved = not chosen yet (the first click starts it). */
      var a = localStorage.getItem('orbeats-music');
      if (a === 'on' || a === 'off') { chosen = true; state.audio = a === 'on'; }
    } catch (e) {}
  }
  function saveSettings() {
    try {
      localStorage.setItem('orbeats', JSON.stringify({ captions: state.captions, volume: state.volume, volumeV: 3, scale: state.scale, contrast: state.contrast, motion: state.motion }));
      if (chosen) localStorage.setItem('orbeats-music', state.audio ? 'on' : 'off');
    } catch (e) {}
  }

  /* ================= 3. MARKUP FOR THE SHARED PARTS ================= */

  var ICONS = '<svg class="ob-i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>' +
              '<svg class="ob-i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  var LOGO = '<svg class="ob-logo" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21"/><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="9"/><circle class="ob-logo__dot" cx="24" cy="24" r="2.5"/></svg>';

  function switchHtml(key, label) {
    return '<button class="ob-switch" type="button" role="switch" aria-checked="false" data-ob-switch="' + key + '">' +
      '<span class="ob-switch__track"></span><span>' + esc(label) + '</span><span class="ob-switch__state" aria-hidden="true">Off</span></button>';
  }
  function a11yHtml() {
    return '<div class="ob-a11y" role="group" aria-label="Accessibility settings">' +
      '<div class="ob-size"><span class="ob-label" id="ob-size-label">Text size</span>' +
      '<button class="ob-step" type="button" data-ob-size="-1" aria-label="Smaller text">−</button>' +
      '<output data-ob-size-out aria-live="polite" aria-labelledby="ob-size-label">100%</output>' +
      '<button class="ob-step" type="button" data-ob-size="1" aria-label="Larger text">+</button></div>' +
      '<button class="ob-btn ob-btn--quiet ob-motion" type="button" data-ob-action="motion" aria-pressed="false">Pause motion</button>' +
      switchHtml('contrast', 'High contrast') + switchHtml('audio', 'Audio') + switchHtml('captions', 'Captions') + '</div>';
  }
  function headerHtml(active) {
    var links = TABS.map(function (t) {
      return '<a href="' + t.href + '"' + (t.id === active ? ' aria-current="page"' : '') + '>' + esc(t.label) + '</a>';
    }).join('');
    return '<header class="ob-header"><a class="ob-brand" href="' + HOME + '" aria-label="ORBEATS, go to Explore">' + LOGO +
      '<span class="ob-wordmark">ORBEATS</span></a><nav class="ob-nav" aria-label="Main">' + links + '</nav></header>';
  }
  function playerHtml(isStatic) {
    return '<div class="ob-player' + (isStatic ? ' ob-player--static' : '') + '" role="region" aria-label="Now playing">' +
      '<button class="ob-play ob-play--sm" type="button" data-ob-action="music" aria-label="Play the music"></button>' +
      '<div class="ob-player__now"><span class="ob-label">Now playing</span><span class="ob-player__title" data-ob-np-title></span></div>' +
      '<p class="ob-player__caption" data-ob-np-caption aria-live="polite"></p>' +
      '<label class="ob-player__vol"><span class="ob-label">Volume</span><input class="ob-slider" type="range" min="0" max="100" value="12" data-ob-volume></label>' +
      '<span class="ob-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div>';
  }
  /* The big sound button, with a line of text for messages such as
   * "your browser blocked the sound". */
  function musicHtml() {
    return '<div class="ob-music"><button class="ob-btn ob-btn--primary ob-btn--lg" type="button" data-ob-action="music">' +
      '<span data-ob-text>Tap to hear the music</span></button><p class="ob-caption ob-music__msg" data-ob-sound-msg role="status"></p></div>';
  }
  /* Stars and rings on a canvas, with the NASA video on top. The local file
   * is tried first; the NASA URL is the fallback. Phones get the small WebM. */
  function backdropHtml() {
    function sources(where) {
      return '<source src="' + music.mp4[where] + '" type="video/mp4" media="(min-width: 768px)">' +
             '<source src="' + music.webm[where] + '" type="video/webm">';
    }
    return '<canvas data-ob-stars aria-hidden="true"></canvas>' +
      '<video data-ob-video muted loop autoplay playsinline preload="auto" aria-hidden="true" tabindex="-1">' +
      sources('local') + sources('remote') + '<source src="' + music.mp4.remote + '" type="video/mp4"></video>';
  }

  /* Replace each <div data-ob-part="..."> placeholder in the page with the real part. */
  function renderParts(scope) {
    $$('[data-ob-part]', scope).forEach(function (el) {
      var part = el.getAttribute('data-ob-part');
      if (part === 'skip') el.outerHTML = '<a class="ob-skip" href="#content">Skip to content</a>';
      else if (part === 'top') { el.classList.add('ob-top'); el.innerHTML = a11yHtml() + headerHtml(el.getAttribute('data-active')); }
      else if (part === 'a11y') el.outerHTML = a11yHtml();
      else if (part === 'header') el.outerHTML = headerHtml(el.getAttribute('data-active'));
      else if (part === 'player') el.outerHTML = playerHtml(el.hasAttribute('data-static'));
      else if (part === 'backdrop') { el.classList.add('ob-backdrop'); el.innerHTML = backdropHtml(); }
      else if (part === 'music') el.outerHTML = musicHtml();
      else if (part === 'switch') el.outerHTML = switchHtml(el.getAttribute('data-key'), el.getAttribute('data-label'));
      else if (part === 'logo') el.outerHTML = LOGO;
      if (el.parentNode) el.removeAttribute('data-ob-part');
    });
    $$('.ob-play', scope).forEach(function (b) { if (!b.firstElementChild) b.innerHTML = ICONS; });
    $$('.ob-slider', scope).forEach(fillSlider);
  }

  /* Paint the part of a slider track that is "filled". */
  function fillSlider(input) {
    var min = +input.min || 0, max = +input.max || 100;
    input.style.setProperty('--ob-fill', ((input.value - min) / (max - min) * 100) + '%');
  }

  /* ================= 4. BACKGROUND: STARS, RINGS, VIDEO ================= */

  /* Stars drifting outward with slow pulsing rings. Drawn behind the video so
   * the screen is never still. It keeps moving for everyone, including people
   * who prefer reduced motion; the "Pause motion" button stops it. */
  function starfield(canvas) {
    var ctx = canvas.getContext('2d'); if (!ctx) return;
    var cs = getComputedStyle(root);
    var cNeon = cs.getPropertyValue('--neon').trim() || '#4cc9ff';
    var cCyan = cs.getPropertyValue('--cyan').trim() || '#7ae7ff';
    var cInk = cs.getPropertyValue('--ink').trim() || '#c9d6ea';
    var w = 0, h = 0, stars = [], last = 0, clock = 0, running = false;
    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.max(1, w * dpr); canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(clock, 0);
    }
    function spawn(s, anywhere) {
      s.a = Math.random() * Math.PI * 2;
      s.r = anywhere ? Math.random() : Math.random() * 0.04;
      s.v = 0.006 + Math.random() * 0.014;
      s.z = 0.4 + Math.random() * 1.0;
      s.p = Math.random() * 6.28;
      s.c = Math.random() < 0.2 ? cCyan : (Math.random() < 0.25 ? cNeon : cInk);
    }
    for (var i = 0; i < 240; i++) { var s = {}; spawn(s, true); stars.push(s); }
    function draw(t, dt) {
      var cx = w / 2, cy = h / 2, R = Math.sqrt(w * w + h * h) / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1; ctx.strokeStyle = cNeon;
      for (var i = 0; i < 4; i++) {                       // four slow rings
        var k = (t * 0.022 + i / 4) % 1;
        ctx.globalAlpha = (1 - k) * 0.2 * (0.65 + 0.35 * Math.sin(t * 0.9 + i * 1.7));
        ctx.beginPath(); ctx.arc(cx, cy, 24 + k * R * 0.9, 0, Math.PI * 2); ctx.stroke();
      }
      for (var j = 0; j < stars.length; j++) {            // the stars
        var s = stars[j];
        s.r += s.v * dt * (0.25 + s.r * 1.6);
        if (s.r > 1.05) spawn(s, false);
        ctx.globalAlpha = Math.min(1, s.r * 4) * (0.45 + 0.4 * Math.sin(t * 1.3 + s.p));
        ctx.fillStyle = s.c;
        ctx.beginPath(); ctx.arc(cx + Math.cos(s.a) * s.r * R, cy + Math.sin(s.a) * s.r * R, s.z * (0.5 + s.r), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function frame(now) {
      if (!state.motion) { running = false; return; }     // paused: keep the last picture
      var t = now / 1000, dt = Math.min(0.05, t - last); last = t; clock += dt;
      draw(clock, dt);
      requestAnimationFrame(frame);
    }
    function start() {
      if (running || !state.motion) return;
      running = true;
      requestAnimationFrame(function (now) { last = now / 1000; frame(now); });
    }
    size();
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(canvas); else window.addEventListener('resize', size);
    document.addEventListener('orbeats:settings', start);
    start();
  }

  /* The video is a silent picture. The music is the separate <audio> below. */
  function initVideo(v) {
    video = v;
    v.muted = true; v.defaultMuted = true;
    v.addEventListener('volumechange', function () { if (!v.muted) v.muted = true; });
    function ready() { v.classList.add('is-ready'); }
    if (v.readyState >= 2) ready(); else v.addEventListener('canplay', ready, { once: true });
  }

  /* The ONE music element. Only this code touches it. */
  function logMusic(what) {
    var a = siteMusic;
    console.log('[site-music] ' + what + ' readyState=' + a.readyState + ' paused=' + a.paused + ' volume=' + a.volume +
      ' time=' + a.currentTime.toFixed(1) + (a.error ? ' error=' + a.error.code + ' ' + (a.error.message || '') : ''));
  }
  function initMusic() {
    var a = siteMusic = document.createElement('audio');
    a.id = 'site-music'; a.loop = true; a.preload = 'auto';
    a.innerHTML = '<source src="' + music.audio.m4a + '" type="audio/mp4"><source src="' + music.audio.ogg + '" type="audio/ogg">';
    document.body.appendChild(a);
    ['loadedmetadata', 'canplay', 'play', 'playing', 'pause', 'volumechange', 'stalled', 'waiting', 'ended', 'error'].forEach(function (ev) {
      a.addEventListener(ev, function () { logMusic(ev); });
    });
    /* A <source> that fails does not bubble; if none works the music cannot load. */
    a.addEventListener('error', function () {
      setTimeout(function () { if (a.networkState === 3 || a.error) { musicFailed = true; apply(); } }, 0);
    }, true);
    /* Carry on from where the music was on the previous page. */
    a.addEventListener('loadedmetadata', function () {
      try {
        var t = parseFloat(localStorage.getItem('orbeats-music-time'));
        if (t > 0 && t < a.duration - 1 && a.currentTime < 1) a.currentTime = t;
      } catch (e) {}
    }, { once: true });
    a.addEventListener('timeupdate', function () {
      try { localStorage.setItem('orbeats-music-time', a.currentTime.toFixed(1)); } catch (e) {}
    });
    /* Keep the silent picture in step with the music. */
    a.addEventListener('playing', function () {
      if (video && video.duration && isFinite(video.duration) && video.seekable && video.seekable.length) {
        try { video.currentTime = a.currentTime % video.duration; } catch (e) {}
      }
      if (video && video.paused) { var q = video.play(); if (q && q.catch) q.catch(noop); }
    });
  }

  /* ================= 5. SOUND ================= */

  /* One shared AudioContext for the whole page.
   *   everything  ->  master (volume + mute)  ->  analyser (level meter)  ->  speakers */
  var actx = null, master = null, analyser = null, videoNode = null;

  function getAudio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      master = actx.createGain();
      analyser = actx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      master.connect(analyser);
      analyser.connect(actx.destination);
      master.gain.value = state.audio ? state.volume : 0;
      actx.onstatechange = attachVideoToMeter;
    }
    if (actx.state === 'suspended') actx.resume().then(attachVideoToMeter, noop);
    attachVideoToMeter();
    return { context: actx, output: master };
  }

  /* The music plays straight from the <video> element (no Web Audio routing),
   * so nothing can silence it. The level meter shows its animation for it. */
  function attachVideoToMeter() {}

  /* Keep the music in step with the settings. Called from apply(), which runs
   * inside the visitor's click, so play() is allowed. */
  function syncMusic() {
    var a = siteMusic; if (!a) return;
    a.volume = state.volume;
    if (video && video.paused) { var q = video.play(); if (q && q.catch) q.catch(noop); }
    var want = state.audio && !musicHold && (!current || current.reference);   // a dataset's sound replaces the music
    if (!want) { if (!a.paused) a.pause(); return; }
    if (!a.paused || musicPending) return;
    musicPending = true;
    var p = a.play();
    Promise.resolve(p).then(function () { musicPending = false; musicFailed = false; blocked = false; apply(); }, function (err) {
      musicPending = false;
      logMusic('play() rejected: ' + (err && err.name));
      if (err && err.name === 'NotAllowedError') {
        /* Blocked. Wait for the visitor's next click or key press. */
        blocked = true; chosen = false; state.audio = false;
        apply();
        announce('Sound is blocked. Tap again.');
      } else if (err && err.name !== 'AbortError') { musicFailed = true; apply(); }
    });
  }

  /* Turn all sound on or off. */
  function setAudio(on) {
    on = !!on;
    chosen = true; blocked = false;
    state.audio = on;
    if (on) getAudio(); else stopSound();
    apply();
    emit('orbeats:play', { playing: on });
  }

  function stopSound() {
    var was = current;
    if (sound) sound.stop();
    sound = null; current = null;
    if (was) emit('orbeats:dataset', { id: was.id, playing: false });
  }

  /* Play a real sound file for a dataset (used when the dataset has `sound`
   * in js/data.js). It offers the same controls as the demo sound. */
  function fileSound(dataset, options) {
    var a = new Audio(dataset.sound);
    var vol = options.volume == null ? 0.8 : options.volume;
    a.loop = options.loop !== false;
    a.playbackRate = options.rate || 1;
    a.volume = vol * state.volume;
    a.addEventListener('loadedmetadata', function () { if (options.offset) a.currentTime = options.offset * a.duration; });
    a.addEventListener('ended', function () { if (options.onEnd) options.onEnd(); });
    var p = a.play(); if (p && p.catch) p.catch(noop);
    return {
      position: function () { return a.duration ? a.currentTime / a.duration : 0; },
      setVolume: function (v) { vol = v; a.volume = v * state.volume; },
      stop: function () { a.pause(); }
    };
  }

  /* The honest label shown under every dataset player. */
  function labelFor(d) { return 'Sound generated from NASA\u2019s published visualization frames, SVS ' + d.id + '.'; }
  /* What the sound of a dataset represents, in plain words, plus the label. */
  function captionFor(d) {
    if (d.reference) return music.caption;
    if (d.series && d.series.placeholder) return d.series.placeholder;
    return (d.sonify || '[Caption placeholder]') + ' ' + labelFor(d);
  }

  /* Play one dataset. Earth datasets play their real measured series
   * (data/series/<id>.json) through js/series-sound.js. The Caldwell 73
   * reference entry plays the real music from the background video. */
  function playDataset(id, options) {
    var d = findDataset(id); if (!d) return;
    options = options || {};
    stopSound();
    chosen = true; blocked = false; state.audio = true;
    current = d;
    if (!d.reference) {
      var audio = getAudio();
      var userEnd = options.onEnd;
      options.onEnd = function () { stopDataset(); if (userEnd) userEnd(); };
      if (d.sound) sound = fileSound(d, options);
      else if (d.series && !d.series.placeholder && audio && window.ORBEATS_seriesSound) sound = window.ORBEATS_seriesSound(d, audio.context, audio.output, options);
      else if (!d.series) announce('The NASA series for this dataset is still loading. Try again in a moment.');
      else announce('There is no sound for this dataset yet.');
    } else {
      getAudio();
    }
    apply();
    emit('orbeats:play', { playing: true });
    if (current) emit('orbeats:dataset', { id: d.id, playing: true });
  }
  function stopDataset() {
    if (!current) return;
    stopSound();
    apply();
  }

  /* The level meter: five thin bars that follow the real sound. */
  var meterData = null;
  function meterLoop() {
    var live = !!(state.audio && analyser && actx.state === 'running' && (sound || videoNode));
    if (!live && root.classList.contains('ob-meter-live')) $$('.ob-meter i').forEach(function (bar) { bar.style.transform = ''; });
    root.classList.toggle('ob-meter-live', live);
    if (live) {
      if (!meterData) meterData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(meterData);
      $$('.ob-meter').forEach(function (m) {
        for (var i = 0; i < m.children.length; i++) {
          var sum = 0;
          for (var j = 0; j < 4; j++) sum += meterData[i * 4 + j];       // 4 frequency bins per bar
          m.children[i].style.transform = 'scaleY(' + Math.max(0.12, Math.min(1, sum / 4 / 200)).toFixed(2) + ')';
        }
      });
    }
    requestAnimationFrame(meterLoop);
  }

  /* ================= 6. APPLY THE STATE TO THE PAGE ================= */

  function apply() {
    root.classList.toggle('ob-on', state.audio);
    root.classList.toggle('ob-still', !state.motion);
    root.style.setProperty('--ob-scale', state.scale / 100);
    if (state.contrast) root.setAttribute('data-theme', 'contrast');
    else if (root.getAttribute('data-theme') === 'contrast') root.setAttribute('data-theme', 'space');

    $$('[data-ob-switch]').forEach(function (b) {
      var on = !!state[b.getAttribute('data-ob-switch')];
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      var s = b.querySelector('.ob-switch__state'); if (s) s.textContent = on ? 'On' : 'Off';
    });
    $$('[data-ob-action="music"]').forEach(function (b) {
      var t = b.querySelector('[data-ob-text]');
      b.disabled = musicHold;
      if (t) { t.textContent = musicHold ? 'Music paused during game' : (state.audio ? 'Mute the music' : 'Tap to hear the music'); b.classList.toggle('is-on', state.audio && !musicHold); }
      else { b.setAttribute('data-on', state.audio && !musicHold ? 'true' : 'false'); b.setAttribute('aria-label', musicHold ? 'Music paused during game' : (state.audio ? 'Pause all sound' : 'Play the music')); }
    });
    $$('[data-ob-action="motion"]').forEach(function (b) {
      b.textContent = state.motion ? 'Pause motion' : 'Play motion';
      b.setAttribute('aria-pressed', state.motion ? 'false' : 'true');
    });
    $$('[data-ob-sound-msg]').forEach(function (p) {
      p.textContent = blocked ? 'Sound is blocked. Tap again.' : (musicFailed ? 'The music file could not be loaded. Check media/caldwell73.m4a.' : '');
    });

    /* Now-playing bar: title and caption. */
    var title = music.title, caption = state.audio ? music.caption : (blocked ? 'Sound is blocked. Tap again.' : 'Music is off.');
    if (current && !current.reference) {
      title = current.title;
      caption = captionFor(current);
    }
    if (nowPlaying && state.audio) { title = nowPlaying.title; caption = nowPlaying.caption || ''; }
    $$('[data-ob-np-title]').forEach(function (el) { if (el.textContent !== title) el.textContent = title; });
    $$('[data-ob-np-caption]').forEach(function (el) { el.hidden = !state.captions; if (el.textContent !== caption) el.textContent = caption; });
    $$('[data-ob-caption]').forEach(function (el) { el.hidden = !state.captions; });

    $$('[data-ob-size-out]').forEach(function (o) { o.textContent = state.scale + '%'; });
    $$('[data-ob-volume]').forEach(function (i) { i.value = Math.round(state.volume * 100); fillSlider(i); });
    if (master) master.gain.setTargetAtTime(state.audio ? state.volume : 0, actx.currentTime, 0.03);
    syncMusic();
    saveSettings();
    emit('orbeats:settings', settings());
  }

  /* A copy of the settings, for teammates. */
  function settings() {
    return {
      audio: state.audio,
      captions: state.captions,
      textScale: state.scale,                                   // 100 to 160
      contrast: state.contrast,
      reducedMotion: !state.motion || prefersReducedMotion()    // true = keep your own motion calm
    };
  }

  /* Say something to screen-reader users without moving the focus. */
  var announcer = null;
  function announce(text) {
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.className = 'ob-sr';
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      document.body.appendChild(announcer);
    }
    announcer.textContent = '';
    setTimeout(function () { announcer.textContent = text; }, 60);
  }

  /* ================= 7. CLICKS AND KEYS ================= */

  function bind() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : e.target.parentElement; if (!t) return;
      var first = !chosen;                 // is this the visitor's first click?

      var sw = t.closest('[data-ob-switch]');
      if (sw) {
        var k = sw.getAttribute('data-ob-switch');
        if (k === 'audio') setAudio(!state.audio); else { state[k] = !state[k]; apply(); }
      }
      else if (t.closest('[data-ob-action="music"]')) setAudio(!state.audio);
      else if (t.closest('[data-ob-action="motion"]')) { state.motion = !state.motion; apply(); announce(state.motion ? 'Background motion is playing.' : 'Background motion is paused.'); }
      else {
        var sz = t.closest('[data-ob-size]');
        if (sz) { state.scale = Math.max(TEXT_MIN, Math.min(TEXT_MAX, state.scale + TEXT_STEP * +sz.getAttribute('data-ob-size'))); apply(); }
      }
      /* The first click anywhere turns on the music (unless that click
       * already chose a sound setting, which is handled above). */
      if (first && !chosen) setAudio(true);
    });

    /* The first key press turns on the music too. */
    document.addEventListener('keydown', function (e) {
      if (chosen) return;
      if (/^(Shift|Control|Alt|Meta|CapsLock|Escape)$/.test(e.key)) return;
      /* Enter or Space on a button is followed by a click, handled above. */
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('a, button, input, select, textarea')) return;
      /* Some keys do not count as "the visitor asked for sound" in the browser. Wait for one that does. */
      if (navigator.userActivation && !navigator.userActivation.isActive) return;
      setAudio(true);
    });

    document.addEventListener('input', function (e) {
      var t = e.target; if (!t.classList || !t.classList.contains('ob-slider')) return;
      fillSlider(t);
      if (t.hasAttribute('data-ob-volume')) { state.volume = t.value / 100; apply(); }
    });

    /* Tell the page how tall the now-playing bar is, so it never covers content. */
    var bar = document.querySelector('.ob-player:not(.ob-player--static)');
    if (bar && 'ResizeObserver' in window) {
      new ResizeObserver(function () { root.style.setProperty('--ob-player-h', bar.offsetHeight + 'px'); }).observe(bar);
    }
  }

  /* ================= 8. PLUG-IN POINTS FOR TEAMMATES ================= */

  var tabs = {};       // name -> { mount, unmount }
  var game = null;     // { id, title, mount, unmount }
  var mounted = [];    // things to unmount when the page closes

  function mountInto(host, thing) {
    if (!host || host._obMounted) return;
    host._obMounted = thing;
    host.innerHTML = '';                 // remove the bracketed placeholder
    host.classList.add('is-mounted');
    mounted.push(thing);
    thing.mount(host);
  }

  /* ORBEATS.registerTab('compose', { mount(container), unmount() }) */
  function registerTab(name, tab) {
    if (!tab || typeof tab.mount !== 'function') { console.warn('ORBEATS.registerTab: the tab needs a mount(container) function.'); return; }
    tabs[name] = tab;
    mountInto(document.querySelector('[data-ob-tab="' + name + '"]'), tab);
  }

  /* ORBEATS.registerGame({ id, title, mount(container), unmount() }) */
  function registerGame(g) {
    if (!g || typeof g.mount !== 'function') { console.warn('ORBEATS.registerGame: the game needs a mount(container) function.'); return; }
    if (game) { console.warn('ORBEATS.registerGame: there is already a game. Only one game fits on the Play page.'); return; }
    game = g;
    var host = document.querySelector('[data-ob-game]');
    if (!host) return;
    if (g.title) $$('[data-ob-game-title]').forEach(function (el) { el.textContent = g.title; });
    mountInto(host, g);
  }

  /* The Controls selector on the Play page: 'camera', 'keyboard' or 'touch'. */
  function controls() {
    var r = document.querySelector('input[name="controls"]:checked');
    return r ? r.value : 'keyboard';
  }
  function setCameraStatus(text) {
    $$('[data-ob-camera-status]').forEach(function (el) { el.textContent = text; });
  }

  window.addEventListener('pagehide', function () {
    mounted.forEach(function (m) { try { if (m.unmount) m.unmount(); } catch (e) {} });
    mounted = [];
  });

  /* ================= 9. START ================= */

  function init() {
    if (root.getAttribute('data-theme') === 'contrast') state.contrast = true;
    loadSettings();
    renderParts(document);
    $$('[data-ob-stars]').forEach(starfield);
    initMusic();
    $$('[data-ob-video]').forEach(initVideo);
    bind();
    document.addEventListener('change', function (e) {
      if (e.target.name === 'controls') emit('orbeats:controls', { controls: e.target.value });
    });
    if (state.audio) getAudio();          // sound was on, on the previous page: carry on
    apply();
    requestAnimationFrame(meterLoop);
  }

  /* The public API. See the README for examples. */
  window.ORBEATS = {
    /* data */
    datasets: datasets,
    music: music,
    gallery: DATA.gallery,
    /* settings: read-only snapshot { audio, captions, textScale, contrast, reducedMotion } */
    get settings() { return settings(); },
    /* now-playing bar */
    setNowPlaying: function (title, caption) {
      nowPlaying = title ? { title: String(title), caption: caption ? String(caption) : '' } : null;
      apply();
    },
    /* screen readers */
    announce: announce,
    /* sound */
    getAudio: getAudio,             // -> { context, output } or null
    setAudio: setAudio,             // turn all sound on or off
    /* Fully pause the background music while the game runs (true), and let it resume (false). The Audio switch is never changed. */
    holdMusic: function (on) { musicHold = !!on; apply(); },
    playDataset: playDataset,
    stopDataset: stopDataset,
    get playing() { return current ? current.id : null; },      // SVS number, or null
    get sound() { return sound; },                              // the running dataset sound, or null
    /* plug-in points */
    registerTab: registerTab,
    registerGame: registerGame,
    get controls() { return controls(); },
    setCameraStatus: setCameraStatus,
    /* helpers for page scripts */
    render: renderParts,
    findDataset: findDataset,
    captionFor: captionFor,
    labelFor: labelFor
  };

  init();
})();
