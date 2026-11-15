/* ORBEAT BOARD: record a piece, share it, like the best one of the week.
 * Plain JavaScript. It talks to the Compose lab only through window.ORBEATS.compose
 * (getState, setState, isPlaying, play, pause, on) and to storage only through window.ORBEAT_STORE (store.js).
 * It records from window.ORBEATS.tap (js/audio-tap.js): a copy of everything the page sends to the speakers.
 * Load order on compose.html: js/audio-tap.js FIRST (before js/app.js), then store.js, then this file, after js/tabs/compose/compose.js. */
(function () {
  'use strict';
  var ORBEATS = window.ORBEATS, store = window.ORBEAT_STORE;
  var host = document.querySelector('[data-ob-board]');
  if (!host || !ORBEATS || !store) return;
  if (!ORBEATS.tap) ORBEATS.tap = window.ORBEATS_TAP || null;          // js/audio-tap.js loads before js/app.js creates ORBEATS

  var CFG = window.ORBEAT_CONFIG || {};                                // settings live in config.js
  var STAFF_PIN = String(CFG.staffPin || '0000');
  var MAX_SECONDS = 30;
  var BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'slut', 'nazi', 'whore'];   // a simple filter; add words here

  /* ---------- tiny helpers ---------- */
  function lab() { return ORBEATS.compose || null; }
  function say(text) { ORBEATS.announce(text); }
  /* h('button', { class: 'x', onclick: fn, text: 'Hi' }, [children]). Typed text always goes in as text, never as HTML. */
  function h(tag, props, kids) {
    var el = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  /* A short waveform picture from the stored peaks (0..1). */
  function waveform(peaks) {
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 96 28'); svg.setAttribute('class', 'ob-wave'); svg.setAttribute('aria-hidden', 'true');
    (peaks || []).forEach(function (p, i) {
      var r = document.createElementNS(NS, 'rect'), hh = Math.max(2, p * 26);
      r.setAttribute('x', i * 2); r.setAttribute('width', 1.2); r.setAttribute('y', 14 - hh / 2); r.setAttribute('height', hh);
      svg.appendChild(r);
    });
    return svg;
  }
  function peaksOf(data, n) {
    var step = Math.max(1, Math.floor(data.length / n)), out = [], max = 0.0001, i, j;
    for (i = 0; i < n; i++) { var m = 0; for (j = i * step; j < (i + 1) * step && j < data.length; j++) m = Math.max(m, Math.abs(data[j])); out.push(m); max = Math.max(max, m); }
    return out.map(function (m) { return +(m / max).toFixed(2); });
  }

  /* ---------- the recipe: what moved, and when ---------- */
  /* The state of the sliders at second t, rebuilt from the recipe. */
  function stateAt(recipe, t, info) {
    var scene = recipe.start.scene, values = {}, k;
    for (k in recipe.start.values) values[k] = recipe.start.values[k];
    recipe.events.forEach(function (e) {
      if (e.t > t) return;
      if (e.type === 'scene') { scene = e.scene; var sv = info.scenes[scene]; if (sv) for (k in sv.values) values[k] = sv.values[k]; }
      else values[e.k] = e.v;
    });
    return { scene: scene, values: values };
  }
  /* Plain-text description, for example "30 seconds. Started with Ocean currents, then raised Carbon dioxide." */
  function describe(recipe, info) {
    var names = {}; info.variables.forEach(function (v) { names[v.k] = v.n; });
    var cur = {}, k, steps = [], byVar = {};
    for (k in recipe.start.values) cur[k] = recipe.start.values[k];
    recipe.events.forEach(function (e) {
      if (e.type === 'scene') { var s = info.scenes[e.scene]; steps.push({ scene: s ? s.name : e.scene }); byVar = {}; if (s) for (k in s.values) cur[k] = s.values[k]; return; }
      if (!byVar[e.k]) { byVar[e.k] = { k: e.k, from: cur[e.k] }; steps.push(byVar[e.k]); }
      byVar[e.k].to = e.v; cur[e.k] = e.v;
    });
    var phrases = [];
    steps.forEach(function (s) {
      if (s.scene) phrases.push('switched to ' + s.scene);
      else if (s.to > s.from) phrases.push('raised ' + names[s.k]);
      else if (s.to < s.from) phrases.push('lowered ' + names[s.k]);
    });
    var first = info.scenes[recipe.start.scene] ? info.scenes[recipe.start.scene].name : 'the scene';
    var text = Math.round(recipe.dur) + ' seconds. Started with ' + first;
    if (!phrases.length) return text + ' and played it as it was.';
    return text + ', then ' + phrases.slice(0, 4).join(', then ') + (phrases.length > 4 ? ', and more' : '') + '.';
  }

  /* ---------- keeping the Caldwell music quiet while we record or play ---------- */
  var recording = false, playerActive = false;
  function hold(on) {
    if (on) { ORBEATS.holdMusic(true); return; }
    var L = lab();
    if (recording || playerActive || (L && L.isPlaying())) return;     // something of ours is still sounding
    ORBEATS.holdMusic(false);                                          // the site music returns only if the Audio switch is on
  }

  /* ---------- the player ----------
     Two normal <audio controls> elements: one for the preview, one for board pieces. Both play a blob URL straight to the
     speakers at full volume, so the site's Volume slider and Audio switch cannot silence them. Only #site-music is paused (hold). */
  var previewEl = document.createElement('audio'), boardEl = document.createElement('audio');
  previewEl.controls = true; previewEl.className = 'ob-rec__audio'; previewEl.setAttribute('aria-label', 'Preview of your recording');
  boardEl.controls = true; boardEl.className = 'ob-rec__audio ob-board__audio'; boardEl.setAttribute('aria-label', 'Board player'); boardEl.hidden = true;
  [previewEl, boardEl].forEach(function (el) { el.muted = false; el.volume = 1; el.preload = 'auto'; });
  var audio = boardEl, currentId = null, currentUrl = null, current = null;
  var saved = null, lastKey = '', replayOn = true, raf = 0;
  var listeners = [], rowListeners = [];                               // functions to call when playing state changes (fixed ones, and ones for rows that get rebuilt)

  function changed() { listeners.concat(rowListeners).forEach(function (f) { f(); }); }

  function stopReplay() {
    cancelAnimationFrame(raf); raf = 0;
    var L = lab();
    if (saved && L && L.setState) L.setState(saved.values, saved.scene);   // put the Earth back as it was
    saved = null; lastKey = '';
  }
  function tick() {
    var L = lab();
    if (current && replayOn && L && L.setState && !audio.paused) {
      if (!saved) { saved = L.getState(); }
      var st = stateAt(current.recipe, audio.currentTime, saved);
      var key = st.scene + JSON.stringify(st.values);
      if (key !== lastKey) { lastKey = key; L.setState(st.values, st.scene); }
    }
    changed();
    raf = audio.paused ? 0 : requestAnimationFrame(tick);
  }
  function afterStop() { playerActive = false; stopReplay(); changed(); hold(false); }
  function wire(el) {
    el.addEventListener('play', function () {
      if (audio !== el) { var old = audio; audio = el; stopReplay(); if (!old.paused) old.pause(); }   // only one thing plays at a time
      if (el === previewEl) { current = draft; currentId = 'preview'; }
      var L = lab(); if (L && L.isPlaying()) L.pause();               // the live Earth music would overlap
      playerActive = true; hold(true);
      if (!raf) raf = requestAnimationFrame(tick);
      changed();
    });
    el.addEventListener('pause', function () { if (audio === el) afterStop(); });
    el.addEventListener('ended', function () { if (audio === el) afterStop(); });
  }
  wire(previewEl); wire(boardEl);
  /* A fresh MediaRecorder file does not know its length (duration = Infinity), so the preview's scrub bar would not work.
     Jump to the end and back once to learn it. (Only the preview: it is not playing yet. A board piece starts playing at once.) */
  previewEl.addEventListener('loadedmetadata', function () {
    if (previewEl.duration !== Infinity) return;
    previewEl.currentTime = 1e101;
    previewEl.addEventListener('timeupdate', function fix() { previewEl.removeEventListener('timeupdate', fix); previewEl.currentTime = 0; });
  });

  /* Play or pause a board piece { id, blob, recipe }. A second press on the same piece pauses it. */
  function toggleItem(item) {
    if (recording) { say('Stop recording first.'); return; }
    if (currentId === item.id && current && audio === boardEl) { if (boardEl.paused) boardEl.play(); else boardEl.pause(); return; }
    stopReplay();
    if (!previewEl.paused) previewEl.pause();
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(item.blob); currentId = item.id; current = item;
    boardEl.hidden = false; boardEl.muted = false; boardEl.volume = 1;
    boardEl.setAttribute('aria-label', 'Board player: ' + (item.title || 'piece'));
    boardEl.src = currentUrl;
    boardEl.play().catch(function () { say('This piece could not be played.'); });
  }
  function isPlaying(id) { return currentId === id && audio === boardEl && !boardEl.paused; }
  /* getItem() returns { id, blob, recipe } when the button is pressed; list is where its state-updater is kept. */
  function playButton(id, getItem, label, list) {
    var b = h('button', { class: 'ob-play ob-play--sm', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Play ' + label, onclick: function () { var it = getItem(); if (it) toggleItem(it); } },
      [h('span', { 'aria-hidden': 'true', text: '▶' })]);
    list.push(function () {
      var on = isPlaying(id);
      b.setAttribute('aria-pressed', on); b.firstChild.textContent = on ? '❚❚' : '▶';
      b.setAttribute('aria-label', (on ? 'Pause ' : 'Play ') + label);
    });
    return b;
  }

  /* ---------- 1. RECORD ---------- */
  var rec = null, chunks = [], tapAnalyser = null, t0 = 0, timerId = 0, meterRaf = 0, peakIn = 0, capturing = false;
  var events = [], startState = null, offChange = null, draft = null, previewUrl = null;
  var PLAY_FIRST = 'Press Play on the Earth music first', NO_SOUND = 'No sound was captured. Press Play on the Earth music, then record again';

  var ui = {};
  function buildRecordPanel() {
    ui.btn = h('button', { class: 'ob-btn ob-btn--primary', type: 'button', onclick: toggleRecord }, ['Record']);
    ui.dot = h('span', { class: 'ob-rec__dot', 'aria-hidden': 'true' });
    ui.time = h('span', { class: 'ob-rec__time', role: 'timer', 'aria-label': 'Recording time', text: '0:00 / ' + mmss(MAX_SECONDS) });
    ui.level = h('span', { class: 'ob-level__fill' });
    ui.levelBox = h('span', { class: 'ob-level', hidden: true, title: 'Sound level going into the recording', 'aria-hidden': 'true' }, [ui.level]);
    ui.msg = h('p', { class: 'ob-caption ob-rec__msg', role: 'status' });
    ui.desc = h('p', { class: 'ob-small', 'data-ob-caption': 'board' });
    ui.title = h('input', { type: 'text', maxlength: '40', id: 'ob-title', autocomplete: 'off' });
    ui.nick = h('input', { type: 'text', maxlength: '20', id: 'ob-nick', autocomplete: 'off' });
    ui.post = h('button', { class: 'ob-btn ob-btn--primary', type: 'button', onclick: postDraft }, ['Post to the Board']);
    ui.discard = h('button', { class: 'ob-btn', type: 'button', onclick: discardDraft }, ['Discard']);
    ui.preview = h('div', { class: 'ob-rec__preview', hidden: true }, [
      previewEl,
      ui.desc,
      h('div', { class: 'ob-rec__fields' }, [
        h('label', { for: 'ob-title' }, ['Title (up to 40 characters)']), ui.title,
        h('label', { for: 'ob-nick' }, ['Nickname (up to 20 characters)']), ui.nick,
        h('p', { class: 'ob-caption' }, ['Use a nickname. Do not type your real name, email or phone number. Posted pieces are public.'])
      ]),
      h('div', { class: 'ob-rec__actions' }, [ui.post, ui.discard])
    ]);
    return h('div', { class: 'ob-rec' }, [
      h('h3', { class: 'ob-label', text: 'Record and share' }),
      h('p', { class: 'ob-small', text: 'Press Play on the Earth music, then Record. Move the sliders, then press Stop. Only the lab’s own music is recorded, never your microphone. Up to ' + MAX_SECONDS + ' seconds.' }),
      h('div', { class: 'ob-rec__bar' }, [ui.btn, ui.dot, ui.time, ui.levelBox]),
      ui.msg, ui.preview
    ]);
  }

  function setBusy(on) {
    recording = on; host.classList.toggle('is-recording', on); ui.btn.textContent = on ? 'Stop' : 'Record'; ui.btn.setAttribute('aria-pressed', on);
    ui.levelBox.hidden = !on;
  }
  function warn(text) { ui.msg.textContent = text; say(text); }

  function toggleRecord() { if (recording) stopRecord(); else startRecord(); }

  /* ----- capture: the ONE way sound gets into a piece (your recording and the sample pieces both use it) -----
     It records ORBEATS.tap: a copy of whatever the page sends to the speakers, so it does not depend on how the lab is wired. */
  function siteVolume() { var i = document.querySelector('[data-ob-volume]'); return i ? i.value / 100 : 1; }
  /* The site's Volume slider sits before the speakers. Undo it on the copy, so a piece is recorded at full level whatever the slider says. */
  function matchGain() { var v = siteVolume(); if (ORBEATS.tap) ORBEATS.tap.setGain(v > 0 ? 1 / v : 1); }
  document.addEventListener('input', function (e) { if (capturing && e.target.hasAttribute && e.target.hasAttribute('data-ob-volume')) matchGain(); });

  /* Start capturing. Resolves to '' when it started, or to the message to show when it could not. */
  async function beginCapture() {
    var L = lab(), tap = ORBEATS.tap;
    if (!L) return 'The Compose lab is not ready yet.';
    if (!tap || !L.isPlaying()) return PLAY_FIRST;
    if (!ORBEATS.settings.audio) return 'The site Audio switch is off, so the Earth music is silent. Turn Audio on, press Play on the Earth music, then Record.';
    var ctx = tap.getContext();
    if (!ctx) return PLAY_FIRST;
    try { await ctx.resume(); } catch (e) {}                          // called inside the click, and we wait for it
    if (!tap.isActive()) return PLAY_FIRST;                           // the engine must be running, with sound going to the speakers
    matchGain();
    tapAnalyser = tap.getAnalyser();
    /* The piece is saved as a plain WAV file, read sample by sample from the tap. WAV plays in every browser;
       WebM/Opus recordings (MediaRecorder) played back silent on the kiosk machine. */
    try {
      rec = { ctx: ctx, src: tapAnalyser, proc: ctx.createScriptProcessor(4096, 2, 1) };
      rec.proc.onaudioprocess = function (e) {
        if (!capturing) return;
        var a = e.inputBuffer.getChannelData(0), b = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : a, m = new Float32Array(a.length);
        for (var i = 0; i < a.length; i++) m[i] = (a[i] + b[i]) / 2;
        chunks.push(m);
      };
      chunks = []; peakIn = 0; capturing = true;
      rec.src.connect(rec.proc); tap.sink(rec.proc);
    } catch (e) { capturing = false; rec = null; return 'Recording could not start here.'; }
    t0 = performance.now();
    drawLevel();
    return '';
  }
  /* The live level meter, drawn from the tap's AnalyserNode. It also remembers the highest level seen. */
  function drawLevel() {
    if (!capturing || !tapAnalyser) return;
    var buf = new Uint8Array(tapAnalyser.fftSize), i, peak = 0;
    tapAnalyser.getByteTimeDomainData(buf);
    for (i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128) / 128);
    peakIn = Math.max(peakIn, peak); ui.level.style.width = Math.min(100, Math.round(peak * 140)) + '%';
    meterRaf = requestAnimationFrame(drawLevel);
  }
  /* 16-bit mono WAV from the captured samples. */
  function wavBlob(parts, rate) {
    var n = 0, i, j, o = 44;
    for (i = 0; i < parts.length; i++) n += parts[i].length;
    var buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), all = new Float32Array(n), at = 0;
    function str(p, t) { for (var k = 0; k < t.length; k++) v.setUint8(p + k, t.charCodeAt(k)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
    for (i = 0; i < parts.length; i++) for (j = 0; j < parts[i].length; j++, o += 2) {
      var x = Math.max(-1, Math.min(1, parts[i][j])); all[at++] = x; v.setInt16(o, x * 32767, true);
    }
    return { blob: new Blob([buf], { type: 'audio/wav' }), data: all };
  }
  /* Stop capturing. Resolves to { blob, peak, peaks, ok }. ok is false for a silent or empty capture. */
  function endCapture() {
    capturing = false; cancelAnimationFrame(meterRaf); ui.level.style.width = '0';
    if (!rec) return Promise.resolve({ ok: false, peak: 0, peaks: [], blob: new Blob([]) });
    try { rec.src.disconnect(rec.proc); rec.proc.disconnect(); } catch (e) {}
    rec.proc.onaudioprocess = null;
    var wav = wavBlob(chunks, rec.ctx.sampleRate), samplePeak = 0, i;
    for (i = 0; i < wav.data.length; i++) samplePeak = Math.max(samplePeak, Math.abs(wav.data[i]));
    var peak = Math.max(peakIn, samplePeak), ok = wav.blob.size >= 2000 && samplePeak >= 0.01;
    console.log('Orbeat recording: ' + (wav.data.length / rec.ctx.sampleRate).toFixed(1) + ' s, ' + wav.blob.size + ' bytes (WAV), peak level ' + samplePeak.toFixed(3) + (ok ? '' : ' (refused: no sound captured)'));
    rec = null; chunks = [];
    return Promise.resolve({ ok: ok, blob: wav.blob, peak: peak, peaks: ok ? peaksOf(wav.data, 48) : [] });
  }

  async function startRecord() {
    if (capturing) return;
    ui.btn.disabled = true;
    var problemText = await beginCapture();
    ui.btn.disabled = false;
    if (problemText) { warn(problemText); return; }
    var L = lab();
    if (draft) discardDraft(true);
    if (!audio.paused) audio.pause();
    events = []; startState = L.getState();
    offChange = L.on('change', function (e) { var ev = { t: +((performance.now() - t0) / 1000).toFixed(2), type: e.type }; if (e.type === 'scene') ev.scene = e.scene; else { ev.k = e.k; ev.v = e.v; } events.push(ev); });
    hold(true); setBusy(true);
    ui.msg.textContent = 'Recording. Move the sliders.'; say('Recording started. Up to ' + MAX_SECONDS + ' seconds.');
    timerId = setInterval(function () {
      var s = (performance.now() - t0) / 1000; ui.time.textContent = mmss(s) + ' / ' + mmss(MAX_SECONDS);
      if (s >= MAX_SECONDS) stopRecord();
    }, 200);
  }
  async function stopRecord() {
    if (!recording) return;
    var dur = Math.min(MAX_SECONDS, (performance.now() - t0) / 1000);
    clearInterval(timerId); if (offChange) offChange(); offChange = null;
    var got = await endCapture();
    setBusy(false); hold(false);
    if (!got.ok) { warn(NO_SOUND); ui.time.textContent = '0:00 / ' + mmss(MAX_SECONDS); return; }   // Record stays available
    var info = lab() ? lab().getState() : startState;
    var recipe = { v: 1, dur: +dur.toFixed(1), start: { scene: startState.scene, values: startState.values }, events: events };
    draft = { id: 'preview', blob: got.blob, recipe: recipe, peaks: got.peaks, dur: recipe.dur, desc: describe(recipe, info) };
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(got.blob); previewEl.src = previewUrl; previewEl.muted = false; previewEl.volume = 1;
    ui.time.textContent = mmss(dur) + ' / ' + mmss(MAX_SECONDS);
    ui.desc.textContent = draft.desc; ui.desc.hidden = !ORBEATS.settings.captions;
    ui.title.value = ''; ui.nick.value = ''; ui.preview.hidden = false;
    ui.msg.textContent = 'Recorded ' + mmss(dur) + '. Listen, name it, then post or discard.';
    say('Recording finished. ' + draft.desc + ' Preview, name it, then post or discard.');
    previewEl.focus();
  }

  function discardDraft(quiet) {
    if (!previewEl.paused) previewEl.pause();
    if (currentId === 'preview') { currentId = null; current = null; }
    previewEl.removeAttribute('src'); previewEl.load();
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    draft = null; ui.preview.hidden = true; ui.time.textContent = '0:00 / ' + mmss(MAX_SECONDS);
    if (quiet !== true) { ui.msg.textContent = 'Recording discarded.'; say('Recording discarded.'); }
  }

  /* Check what people type. Returns a message, or '' if it is fine. */
  function problem(text, label, isNick) {
    var t = text.trim(), flat = t.toLowerCase().replace(/[^a-z]/g, '');
    if (!t) return 'Please give your piece a ' + label + '.';
    if (/@|https?:|www\./i.test(t) || /\d[\d\s().-]{6,}/.test(t)) return 'The ' + label + ' looks like an email, link or phone number. Please remove it.';
    if (BAD_WORDS.some(function (w) { return flat.indexOf(w) > -1; })) return 'Please choose a different ' + label + '.';
    return '';
  }
  async function postDraft() {
    if (!draft) return;
    var msg = problem(ui.title.value, 'title') || problem(ui.nick.value, 'nickname', true);
    if (msg) { ui.msg.textContent = msg; say(msg); return; }
    ui.post.disabled = true;
    try {
      await store.addPiece({ title: ui.title.value.trim().slice(0, 40), nick: ui.nick.value.trim().slice(0, 20), desc: draft.desc, recipe: draft.recipe, dur: draft.dur, peaks: draft.peaks, audio: draft.blob });
      discardDraft(true);
      ui.msg.textContent = 'Posted to the Board. It is public.'; say('Posted to the Orbeat Board.');
      setRange('week'); refresh();
    } catch (e) { ui.msg.textContent = 'Could not save your piece on this device.'; }
    ui.post.disabled = false;
  }

  /* ---------- 2. THE BOARD ---------- */
  var range = 'week', RANGES = [['week', 'This week'], ['last', 'Last week'], ['all', 'All time']];
  var listEl, tabEls = {}, bannerEl, countEl, winnerEl, sampleBtn, emptyEl;

  function buildBoard() {
    countEl = h('p', { class: 'ob-board__count', role: 'timer' });
    winnerEl = h('div', { class: 'ob-board__winner' });
    bannerEl = h('div', { class: 'ob-board__banner' }, [
      h('p', { class: 'ob-label', text: 'Orbeat of the Week' }),
      h('p', { class: 'ob-small', text: 'Every week, the piece with the most likes becomes the Orbeat of the Week.' }),
      countEl, winnerEl
    ]);
    var tabs = h('div', { class: 'ob-board__tabs', role: 'group', 'aria-label': 'Which pieces to show' }, RANGES.map(function (r) {
      return (tabEls[r[0]] = h('button', { class: 'ob-btn', type: 'button', 'aria-pressed': String(r[0] === range), onclick: function () { setRange(r[0]); refresh(); say('Showing ' + r[1] + '.'); } }, [r[1]]));
    }));
    var replay = h('label', { class: 'ob-board__replay' }, [
      h('input', { type: 'checkbox', checked: true, onchange: function (e) { replayOn = e.target.checked; if (!replayOn) stopReplay(); } }), ' Show the Earth change while a piece plays']);
    listEl = h('ol', { class: 'ob-board__list' });
    emptyEl = h('p', { class: 'ob-small', hidden: true, text: 'Nothing here yet. Record a piece, or load the sample pieces.' });
    sampleBtn = h('button', { class: 'ob-btn', type: 'button', onclick: loadSamples }, ['Load 3 sample pieces']);
    return h('div', { class: 'ob-board__main' }, [
      h('h2', { class: 'ob-h3', id: 'ob-board-title', text: 'The Orbeat Board' }),
      bannerEl, tabs, replay, boardEl, emptyEl, listEl,
      h('div', { class: 'ob-board__foot' }, [sampleBtn,
        h('p', { class: 'ob-caption', text: 'Every like counts. Likes are counted on this kiosk.' }),
        h('button', { class: 'ob-linkbtn', type: 'button', onclick: openStaff }, ['Staff'])])
    ]);
  }
  function setRange(r) { range = r; Object.keys(tabEls).forEach(function (k) { tabEls[k].setAttribute('aria-pressed', k === r); }); }

  /* A plain thumbs-up outline in electric blue (set in CSS). */
  function thumb() {
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), path = document.createElementNS(NS, 'path');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'ob-like__icon'); svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('d', 'M7 11v9H4v-9h3zm0 0l4-8c1.5 0 2.5 1 2.5 2.5V9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7');
    svg.appendChild(path); return svg;
  }

  /* Count up from one number to another. Skipped when the visitor wants reduced motion. */
  function countUp(el, from, to) {
    if (ORBEATS.settings.reducedMotion) { el.textContent = String(to); return; }
    var t0 = performance.now(), len = 300;
    el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump');
    (function step(now) {
      var k = Math.min(1, ((now || performance.now()) - t0) / len);
      el.textContent = String(Math.round(from + (to - from) * k));
      if (k < 1) requestAnimationFrame(step);
    })();
  }

  /* The Like button. Every press adds exactly one like; there is no limit. Two guards only:
     a held key does not repeat, and a double-fire within 120 ms counts once. */
  var refreshTimer = 0;
  function likeControl(p) {
    var shown = p.likes, lastPress = 0;
    var num = h('span', { class: 'ob-like__n', 'aria-hidden': 'true', text: String(shown) });
    var b = h('button', { class: 'ob-like__btn', type: 'button', 'data-pid': p.id }, [thumb(), h('span', { text: 'Like' })]);
    function name() { b.setAttribute('aria-label', 'Like ' + p.title + ', currently ' + plural(shown, 'like')); }
    name();
    b.addEventListener('keydown', function (e) { if (e.repeat) e.preventDefault(); });          // holding a key down is still one like
    b.addEventListener('click', function () {
      var now = performance.now(); if (now - lastPress < 120) return; lastPress = now;
      var thisWeek = range !== 'last';                                                           // a new like belongs to this week, not last week
      if (thisWeek) { var from = shown; shown += 1; countUp(num, from, shown); name(); say(plural(shown, 'like')); }
      store.like(p.id).then(function (total) {
        if (!thisWeek) say(plural(total, 'like'));
      }, function (e) { say(e.message || 'Could not save the like.'); });
      clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 2500);                      // re-sort the list once the clicking stops
    });
    return h('span', { class: 'ob-like' }, [b, num]);
  }

  function pieceRow(p, rank) {
    var item = { id: p.id, blob: p.audio, recipe: p.recipe, title: p.title };
    var actions = [];
    if (p.sample) actions.push(h('span', { class: 'ob-board__badge', text: 'Sample piece' }));
    actions.push(h('button', { class: 'ob-btn ob-btn--quiet', type: 'button', 'aria-label': 'Report ' + p.title + ' and hide it until staff check it', onclick: function () { report(p); } }, ['Report']));
    return h('li', { class: 'ob-board__item' }, [
      h('span', { class: 'ob-board__rank', 'aria-label': 'Rank ' + rank, text: String(rank) }),
      playButton(p.id, function () { return item; }, p.title, rowListeners),
      h('div', { class: 'ob-board__info' }, [
        h('p', { class: 'ob-board__title', text: p.title }),
        h('p', { class: 'ob-caption', text: 'by ' + p.nick + ' · ' + mmss(p.dur) }),
        h('p', { class: 'ob-caption', 'data-ob-caption': 'board', hidden: !ORBEATS.settings.captions, text: p.desc })]),
      waveform(p.peaks), likeControl(p), h('div', { class: 'ob-board__actions' }, actions)
    ]);
  }

  function refresh() {
    clearTimeout(refreshTimer);
    var af = document.activeElement, keep = af && af.getAttribute && listEl.contains(af) ? af.getAttribute('data-pid') : null;   // keep keyboard focus on the same Like button
    rowListeners.length = 0;                                               // rebuilt rows register their own play buttons
    return store.listPieces(range).then(function (list) {
      listEl.textContent = '';
      list.forEach(function (p, i) { listEl.appendChild(pieceRow(p, i + 1)); });
      emptyEl.hidden = list.length > 0;
      if (keep) { var nb = listEl.querySelector('button[data-pid="' + keep + '"]'); if (nb) nb.focus(); }
      return store.hasSamples();
    }).then(function (has) { sampleBtn.hidden = has; changed(); refreshWinner(); });
  }

  function report(p) {
    store.hidePiece(p.id).then(function () { if (currentId === p.id) audio.pause(); say('Reported. The piece is hidden until staff check it.'); refresh(); });
  }

  /* ---------- 3. ORBEAT OF THE WEEK ---------- */
  function refreshWinner() {
    store.getWeeklyWinner().then(function (w) {
      winnerEl.textContent = '';
      if (!w) { winnerEl.appendChild(h('p', { class: 'ob-small', text: 'Last week’s winner: No winner yet.' })); return; }
      var item = { id: 'win-' + w.id, pid: w.id, blob: w.audio, recipe: w.recipe, title: w.title };
      winnerEl.appendChild(h('div', { class: 'ob-board__winnerrow' }, [playButton(item.id, function () { return item; }, w.title, rowListeners),
        h('p', { class: 'ob-small' }, ['Last week’s winner: ', h('strong', { text: w.title }), ' by ' + w.nick + ' · ' + plural(w.likes, 'like')])]));
    });
  }
  function tickCountdown() {
    var ms = Math.max(0, store.weekEnd() - Date.now()), d = Math.floor(ms / 86400000), hh = Math.floor(ms % 86400000 / 3600000), m = Math.floor(ms % 3600000 / 60000);
    countEl.textContent = 'This week ends in ' + (d ? plural(d, 'day') + ' ' + plural(hh, 'hour') : plural(hh, 'hour') + ' ' + plural(m, 'minute')) + ' (Kuwait time).';
  }

  /* ---------- 4. SAMPLE PIECES (clearly labeled) ----------
     Each sample is a short real recording of the Planet Opera, made with the same capture as a visitor's piece,
     so it is stored and played in exactly the same way. Making the three takes about 20 seconds, and you hear them being made. */
  var SAMPLE_SECONDS = 6;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function loadSamples() {
    var L = lab(); if (!L || recording || capturing) return;
    var info = L.getState(), base = info.scenes.all.values, before = { values: info.values, scene: info.scene }, wasPlaying = L.isPlaying();
    var defs = [
      ['Sample piece: Ocean currents', 'ocean', [{ t: 2, type: 'slider', k: 'co2', v: 80 }, { t: 4, type: 'slider', k: 'forest', v: 20 }]],
      ['Sample piece: Night lights', 'night', [{ t: 3, type: 'slider', k: 'city', v: 60 }]],
      ['Sample piece: Slow forest', 'forest', [{ t: 2, type: 'slider', k: 'flow', v: 20 }, { t: 4, type: 'slider', k: 'water', v: 90 }]]
    ];
    sampleBtn.disabled = true; ui.btn.disabled = true;
    if (!audio.paused) audio.pause();
    try {
      if (!wasPlaying) await L.play();                                  // this press on the button is what lets the music start
      for (var i = 0; i < defs.length; i++) {
        var d = defs[i], start = { scene: d[1], values: (info.scenes[d[1]] && info.scenes[d[1]].values) || base };
        ui.msg.textContent = 'Making sample piece ' + (i + 1) + ' of ' + defs.length + ' from the Earth music\u2026';
        L.setState(start.values, start.scene);
        await sleep(400);
        var problemText = await beginCapture();
        if (problemText) { warn(problemText); break; }
        hold(true); ui.levelBox.hidden = false;
        for (var j = 0, at = 0; j < d[2].length; j++) {                 // move the sliders at the times in the recipe
          await sleep((d[2][j].t - at) * 1000); at = d[2][j].t;
          var one = {}; one[d[2][j].k] = d[2][j].v; L.setState(one);
        }
        await sleep((SAMPLE_SECONDS - at) * 1000);
        var got = await endCapture();
        ui.levelBox.hidden = true;
        if (!got.ok) { warn(NO_SOUND); break; }
        var recipe = { v: 1, dur: SAMPLE_SECONDS, start: start, events: d[2] };
        await store.addPiece({ title: d[0], nick: 'Sample', sample: true, desc: describe(recipe, info), recipe: recipe, dur: SAMPLE_SECONDS, peaks: got.peaks, audio: got.blob });
        if (i === defs.length - 1) { ui.msg.textContent = 'Three sample pieces added.'; say('Three sample pieces added. They are demo pieces, not real likes.'); }
      }
    } finally {
      L.setState(before.values, before.scene);                          // put the Earth back as it was
      if (!wasPlaying) L.pause();
      sampleBtn.disabled = false; ui.btn.disabled = false; hold(false);
      setRange('week'); refresh();
    }
  }

  /* ---------- the staff view (PIN is in config.js) ---------- */
  var staffDlg = null;
  function openStaff() {
    if (!staffDlg) {
      staffDlg = h('dialog', { class: 'ob-staff', 'aria-labelledby': 'ob-staff-title' });
      staffDlg.addEventListener('close', function () { staffDlg.textContent = ''; });          // closing locks it again
      host.appendChild(staffDlg);
    }
    showPin(); staffDlg.showModal();
  }
  function staffHead(text) { return h('h3', { class: 'ob-h3', id: 'ob-staff-title', tabindex: '-1', text: text }); }
  function showPin() {
    var input = h('input', { type: 'password', id: 'ob-pin', inputmode: 'numeric', autocomplete: 'off', maxlength: '12' });
    var msg = h('p', { class: 'ob-caption', role: 'status' });
    var form = h('form', { class: 'ob-staff__form', onsubmit: function (e) {
      e.preventDefault();
      if (input.value === STAFF_PIN) { showTools(); say('Staff view open.'); }
      else { msg.textContent = 'Wrong PIN.'; input.value = ''; input.focus(); }
    } }, [h('label', { for: 'ob-pin' }, ['Staff PIN']), input, msg,
      h('div', { class: 'ob-rec__actions' }, [h('button', { class: 'ob-btn ob-btn--primary', type: 'submit' }, ['Open']),
        h('button', { class: 'ob-btn', type: 'button', onclick: function () { staffDlg.close(); } }, ['Cancel'])])]);
    staffDlg.textContent = ''; staffDlg.appendChild(staffHead('Staff')); staffDlg.appendChild(form); input.focus();
  }
  function showTools() {
    store.listPieces('all', { includeHidden: true }).then(function (list) {
      var ul = h('ul', { class: 'ob-staff__list' });
      list.forEach(function (p) {
        ul.appendChild(h('li', {}, [
          h('span', { text: p.title + ' \u00b7 by ' + p.nick + ' \u00b7 ' + plural(p.likesTotal, 'like') + (p.hidden ? ' \u00b7 HIDDEN' : '') }),
          h('button', { class: 'ob-btn', type: 'button', 'aria-label': (p.hidden ? 'Restore ' : 'Hide ') + p.title, onclick: function () {
            store.setHidden(p.id, !p.hidden).then(function () {
              if (!p.hidden && currentId === p.id) audio.pause();
              say(p.title + (p.hidden ? ' restored.' : ' hidden.')); refresh(); showTools();
            });
          } }, [p.hidden ? 'Restore' : 'Hide'])]));
      });
      var reset = h('button', { class: 'ob-btn', type: 'button' }, ['Reset this week\u2019s likes']);
      reset.addEventListener('click', function () {                                          // two presses, to avoid accidents
        if (!reset.dataset.sure) { reset.dataset.sure = '1'; reset.textContent = 'Press again to confirm'; say('Press again to confirm resetting this week\u2019s likes.'); return; }
        store.resetWeekLikes().then(function () { say('This week\u2019s likes were reset.'); refresh(); showTools(); });
      });
      var exp = h('button', { class: 'ob-btn', type: 'button', onclick: exportCsv }, ['Export CSV']);
      staffDlg.textContent = '';
      staffDlg.appendChild(staffHead('Staff'));
      staffDlg.appendChild(list.length ? ul : h('p', { class: 'ob-small', text: 'No pieces yet.' }));
      staffDlg.appendChild(h('div', { class: 'ob-rec__actions' }, [reset, exp, h('button', { class: 'ob-btn', type: 'button', onclick: function () { staffDlg.close(); } }, ['Close'])]));
      staffDlg.querySelector('h3').focus();
    });
  }
  function exportCsv() {
    store.exportCsv().then(function (csv) {
      var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), a = h('a', { href: url, download: 'orbeat-board.csv' });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      say('CSV exported.');
    });
  }

  /* ---------- start and stop ---------- */
  function mount() {
    host.textContent = '';
    host.appendChild(h('div', { class: 'ob-board__grid' }, [buildRecordPanel(), buildBoard()]));
    tickCountdown(); var cd = setInterval(tickCountdown, 30000);
    refresh();
    window.addEventListener('pagehide', function stop() {
      clearInterval(cd); clearInterval(timerId); clearTimeout(refreshTimer); cancelAnimationFrame(meterRaf); cancelAnimationFrame(raf);
      if (rec) { try { rec.src.disconnect(rec.proc); rec.proc.disconnect(); } catch (e) {} }
      capturing = false;
      if (offChange) offChange();
      previewEl.pause(); boardEl.pause(); stopReplay(); recording = false; playerActive = false;
      hold(false);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    });
  }
  mount();
})();
