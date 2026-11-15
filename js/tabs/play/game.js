/* MATCH THE MELODY: the game on the Play tab.
 *
 * A random 8-note tune plays as the target. The player matches it with four
 * sound controls, each tied to a NASA variable (see js/tabs/play/config.js).
 *
 * Three input modes share ONE state object (`state` below):
 *   camera  hand gestures      (js/tabs/play/camera.js)
 *   keys    keyboard and mouse (thin slide bars)
 *   touch   large vertical sliders and big buttons
 *
 * Load order: config.js, sound.js, camera.js, then this file.
 */
(function () {
  'use strict';

  var ORBEATS = window.ORBEATS;
  var CFG = window.ORBEATS_PLAY_CONFIG;
  var sound = window.ORBEATS_PLAY_SOUND(CFG);
  var SVS = 'https://svs.gsfc.nasa.gov/';

  /* ================= the shared state ================= */

  var state = {
    mode: null,            // 'camera', 'keys', 'touch', or null (the start screen)
    phase: 'idle',         // 'idle' -> 'target' -> 'adjust' -> 'result' -> ... -> 'final'
    round: 0,
    tune: null,            // the 8 notes of this round
    target: null,          // the values to find
    values: { pitch: 0.5, tempo: 0.5, loudness: 0.5, brightness: 0.5 },   // the player's controls, 0..1
    playing: false,        // is the player's live version playing?
    relaxed: false,        // wider tolerance
    guide: true,           // the "warmer/colder" tone
    meters: true,          // camera mode: show the four meters
    roundScores: [],       // overall match of each finished round
    help: true             // is the "How to play" card open?
  };

  var root = null, area = null, camera = null, timers = [], refreshTimer = 0;

  function $(sel) { return root.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function control(key) { return CFG.controls.filter(function (c) { return c.key === key; })[0]; }
  function after(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  /* ================= scoring ================= */

  /* How far one control is from the target: negative = too low, positive = too high. */
  function difference(key) {
    if (key === 'pitch') return (sound.pitchStep(state.values) - sound.pitchStep(state.target)) / CFG.pitchSteps;
    return state.values[key] - state.target[key];
  }
  /* 0 to 100 for one control. */
  function scoreOf(key) {
    var rule = state.relaxed ? CFG.relaxed : CFG.scoring;
    var d = Math.abs(difference(key));
    if (d <= rule.perfect) return 100;
    return Math.max(0, Math.round(100 * (1 - (d - rule.perfect) / (rule.range - rule.perfect))));
  }
  function overall() {
    var sum = 0;
    CFG.controls.forEach(function (c) { sum += scoreOf(c.key); });
    return Math.round(sum / CFG.controls.length);
  }

  /* ================= words ================= */

  function status(text) { var el = $('[data-mm-status]'); if (el) el.textContent = text; }
  function say(text) { status(text); ORBEATS.announce(text); }
  function nowPlaying(caption) {
    ORBEATS.setNowPlaying(CFG.title + (state.round ? ' · Round ' + state.round + ' of ' + CFG.rounds : ''), caption);
  }
  /* Read text aloud with the browser's voice, then call done(). */
  function speak(text, done, maxMs) {
    var finished = false;
    function end() { if (!finished) { finished = true; done(); } }
    if (!CFG.speakFeedback || !window.speechSynthesis || !ORBEATS.settings.audio) { end(); return; }
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.onend = end; u.onerror = end;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      after(maxMs || 9000, end);              // never wait forever
    } catch (e) { end(); }
  }
  /* A relative word for a control position (no numbers). */
  function word(v) { return v < 0.2 ? 'very low' : v < 0.4 ? 'low' : v <= 0.6 ? 'middle' : v <= 0.8 ? 'high' : 'very high'; }

  /* ================= the round ================= */

  /* ---------- the site's music: fully paused while the game runs ---------- */

  var held = false, turnedAudioOn = false;
  function holdMusic() {
    if (held) return;
    held = true;
    ORBEATS.holdMusic(true);                       // pauses #site-music; the Audio switch is not touched
  }
  /* Let the music come back, but only if the player had it on. */
  function releaseMusic() {
    if (!held) return;
    held = false;
    ORBEATS.holdMusic(false);                      // resumes only if the Audio switch is on
    if (turnedAudioOn) { turnedAudioOn = false; ORBEATS.setAudio(false); }     // the game switched Audio on itself: put it back
  }
  function ensureAudio() {
    if (!ORBEATS.settings.audio) { turnedAudioOn = true; ORBEATS.setAudio(true); }     // the game needs sound
  }

  /* The main button does a different thing in each phase. */
  function primary() {
    if (state.phase === 'idle' || state.phase === 'final') startGame();
    else if (state.phase === 'adjust') lockIn();
    else if (state.phase === 'result') nextRound();
  }
  function howText() {
    return 'How to play. ' + CFG.howTo.map(function (t, i) { return (i + 1) + '. ' + t; }).join(' ') + ' ' + (CFG.howToMode[state.mode] || '');
  }
  function startGame() {
    if (camera) camera.skipPractice();
    holdMusic();                                   // pause the music first, however the game was started
    ensureAudio();
    state.round = 0; state.roundScores = []; state.help = false;
    var first = false;
    try { first = !sessionStorage.getItem('orbeats-play-explained'); sessionStorage.setItem('orbeats-play-explained', '1'); } catch (e) {}
    if (first && CFG.speakFeedback && window.speechSynthesis) explain(); else nextRound();
  }
  /* The first time: read the explanation aloud. Skip goes straight to the game. */
  function explain() {
    state.phase = 'explain';
    nowPlaying('Reading the instructions.');
    say('Reading the instructions aloud. Press Skip to start now.');
    refresh();
    function go() {
      if (state.phase !== 'explain') return;
      speechSynthesis.cancel();
      nextRound();
    }
    state.skip = go;
    speak(howText(), go, 40000);
  }
  /* Stop the game: silence, back to the start, music resumes if it was on. */
  function endGame() {
    clearTimers();
    sound.stopAll();
    if (window.speechSynthesis) speechSynthesis.cancel();
    state.phase = 'idle'; state.round = 0; state.roundScores = []; state.playing = false; state.help = true;
    var box = $('[data-mm-result]'); if (box) box.hidden = true;
    ORBEATS.setNowPlaying(null);
    releaseMusic();
  }
  function nextRound() {
    holdMusic(); ensureAudio();
    if (!sound.ready()) { say('This browser cannot play the game sound.'); return; }
    clearTimers(); sound.stopAll();
    if (window.speechSynthesis) speechSynthesis.cancel();
    state.round++;
    state.tune = sound.randomTune();                         // a NEW random tune
    state.target = {
      pitch: Math.floor(Math.random() * (CFG.pitchSteps + 1)) / CFG.pitchSteps,
      tempo: 0.1 + Math.random() * 0.8, loudness: 0.15 + Math.random() * 0.8, brightness: 0.1 + Math.random() * 0.8
    };
    if (state.mode !== 'camera') CFG.controls.forEach(function (c) { state.values[c.key] = 0.5; });
    $('[data-mm-result]').hidden = true;
    playTarget(function () {
      state.phase = 'adjust';
      sound.startLive(state.tune, function () { return state.values; });
      state.playing = true;
      if (camera && camera.gate() !== 'open') setPlaying(false);      // camera mode: wait for an open hand
      say(state.mode === 'camera' ? 'Now match it with your hands. Pinch and hold to lock in.' : 'Now match it. Move the four controls, then lock in.');
      nowPlaying('Your version is playing. Match the target tune.');
      refresh();
    });
  }
  /* Play the target once, then call done(). */
  function playTarget(done, values, intro, caption) {
    clearTimers();
    state.phase = 'target';
    sound.setLivePlaying(false, 0.15); state.playing = false;
    sound.setGuide(null);
    sound.stopOnce();
    var end = sound.playOnce(state.tune, values || state.target, sound.now() + 0.3);
    say(intro || 'Round ' + state.round + ' of ' + CFG.rounds + '. Listen: this is the target tune.');
    nowPlaying(caption || 'The target tune is playing. Listen carefully.');
    refresh();
    after((end - sound.now()) * 1000 + 350, done);
  }
  function replayTarget() {
    if (state.phase !== 'adjust') return;
    playTarget(function () {
      state.phase = 'adjust';
      setPlaying(true);
      say('Your version again. Keep matching.');
      refresh();
    });
  }
  /* Play the player's current version once, to compare with the target. */
  function hearMine() {
    if (state.phase !== 'adjust') return;
    var mine = { pitch: state.values.pitch, tempo: state.values.tempo, loudness: state.values.loudness, brightness: state.values.brightness };
    playTarget(function () {
      state.phase = 'adjust';
      setPlaying(true);
      say('That was your version. Keep matching.');
      refresh();
    }, mine, 'Listen: this is your version.', 'Your version is playing once.');
  }
  function setPlaying(on, fade) {
    if (state.phase !== 'adjust' || state.playing === on) return;
    state.playing = on;
    sound.setLivePlaying(on, fade);
    if (!on) sound.setGuide(null);
    refresh();
  }

  function lockIn() {
    if (state.phase !== 'adjust') return;
    clearTimers();
    sound.stopLive(); sound.setGuide(null); state.playing = false;
    var total = overall(), lines = [], html = '';
    CFG.controls.forEach(function (c) {
      var s = scoreOf(c.key), d = difference(c.key), rule = state.relaxed ? CFG.relaxed : CFG.scoring;
      var text = Math.abs(d) <= rule.perfect ? c.label + ' matches.' : (d > 0 ? c.tooHigh : c.tooLow);
      if (Math.abs(d) > rule.perfect) lines.push(text);
      html += '<li><span class="ob-label">' + c.label + '</span><span class="mm-score__bar"><i style="width:' + s + '%"></i></span>' +
        '<span class="mm-score__num">' + s + '</span><span class="ob-small">' + text + '</span></li>';
    });
    state.roundScores.push(total);
    var last = state.round >= CFG.rounds;
    var final = Math.round(state.roundScores.reduce(function (a, b) { return a + b; }, 0) / state.roundScores.length);
    var spoken = 'Match: ' + total + ' percent. ' + (lines.length ? lines.join(' ') : 'A perfect match!') +
      (last ? ' Final score: ' + final + ' percent.' : '');
    var box = $('[data-mm-result]');
    box.innerHTML = '<p class="mm-result__big"><span class="ob-label">Round ' + state.round + ' match</span> ' + total + '%</p>' +
      '<ul class="mm-score">' + html + '</ul>' +
      (last ? '<p class="mm-result__big"><span class="ob-label">Final score, ' + CFG.rounds + ' rounds</span> ' + final + '%</p>' : '');
    box.hidden = false;
    state.phase = last ? 'final' : 'result';
    status(spoken); ORBEATS.announce(spoken);
    nowPlaying('Round ' + state.round + ' match: ' + total + ' percent.');
    refresh();
    /* Then the two versions back to back: the target first, then the player's. */
    var mine = { pitch: state.values.pitch, tempo: state.values.tempo, loudness: state.values.loudness, brightness: state.values.brightness };
    var tune = state.tune, target = state.target;
    speak(spoken, function () {
      if (state.phase !== 'result' && state.phase !== 'final') return;
      var endTarget = sound.playOnce(tune, target, sound.now() + 0.3);
      var endMine = sound.playOnce(tune, mine, endTarget + 0.7);
      status(spoken + ' Now the target, then your version.');
      after((endMine - sound.now()) * 1000 + 300, function () {
        status(spoken + (last ? ' Press Play again for a new tune.' : ' Press Next round.'));
        if (last) { ORBEATS.setNowPlaying(null); releaseMusic(); refresh(); }     // the game is over: the music may come back
      });
    });
  }

  /* ================= markup ================= */

  function switchHtml(key, label) {
    return '<button class="ob-switch" type="button" role="switch" aria-checked="false" data-mm-switch="' + key + '">' +
      '<span class="ob-switch__track"></span><span>' + label + '</span><span class="ob-switch__state" aria-hidden="true">Off</span></button>';
  }
  function sourceLink(c) {
    return '<a href="' + SVS + c.svs + '/" target="_blank" rel="noopener">NASA SVS ' + c.svs + '</a>';
  }
  /* One custom slide bar. `vertical` is used by Touch mode. Works with mouse, touch and keys. */
  function sliderHtml(c, vertical) {
    return '<div class="mm-slider ' + (vertical ? 'mm-slider--v' : 'mm-slider--h') + '" role="slider" tabindex="0" data-mm-slider="' + c.key + '"' +
      ' aria-label="' + c.label + ': ' + c.variable + '" aria-orientation="' + (vertical ? 'vertical' : 'horizontal') + '"' +
      ' aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><span class="mm-slider__track"><span class="mm-slider__fill"></span></span>' +
      '<span class="mm-slider__handle"></span></div>';
  }
  function actionsHtml(big) {
    var size = big ? ' mm-btn--touch' : ' ob-btn--lg';
    var main = big
      ? '<button class="ob-btn ob-btn--primary' + size + '" type="button" data-mm-act="lock">Lock in</button>' +
        '<button class="ob-btn' + size + '" type="button" data-mm-act="next">Next</button>'
      : '<button class="ob-btn ob-btn--primary' + size + '" type="button" data-mm-act="primary">Play game</button>';
    return '<div class="mm-actions">' + main +
      '<button class="ob-btn' + size + '" type="button" data-mm-act="skip" hidden>Skip</button>' +
      '<button class="ob-btn' + size + '" type="button" data-mm-act="replay">Replay target</button>' +
      '<button class="ob-btn' + size + '" type="button" data-mm-act="hear">Hear mine</button>' +
      '<button class="ob-btn' + size + '" type="button" data-mm-act="toggle">Pause</button></div>';
  }

  function shellHtml() {
    var caption = CFG.controls.map(function (c) {
      return '<strong>' + c.label + '</strong>: ' + c.dataset + '. It stands for ' + c.variable + ' (' + c.high + '; ' + c.low + '). Source: ' + sourceLink(c) + '.';
    }).join('<br>');
    return '<div class="mm">' +
      '<div class="mm-bar"><p class="ob-label" data-mm-round></p><div class="mm-bar__opts">' +
      switchHtml('relaxed', 'Relaxed') + switchHtml('guide', 'Warmer/colder tone') +
      '<button class="ob-btn ob-btn--quiet" type="button" data-mm-act="help" aria-expanded="true" hidden>How to play</button>' +
      '<button class="ob-btn" type="button" data-mm-act="stop" hidden>Stop game</button>' +
      '<button class="ob-btn" type="button" data-mm-act="change">Change controls</button></div></div>' +
      '<div class="mm-how" data-mm-how><h2 class="mm-how__title">How to play</h2><ol class="mm-how__steps">' +
      CFG.howTo.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>' +
      '<p class="mm-how__mode" data-mm-modeline></p></div>' +
      '<button class="ob-btn ob-btn--primary ob-btn--lg mm-startbtn" type="button" data-mm-act="start">Start</button>' +
      '<div class="mm-area" data-mm-area></div>' +
      '<p class="mm-status" data-mm-status></p>' +
      '<p class="ob-caption" data-mm-audio hidden>Audio is off. Turn on the Audio switch at the top to hear the game.</p>' +
      '<div class="mm-result" data-mm-result hidden></div>' +
      '<details class="mm-why" data-ob-caption="game"><summary class="ob-small">Why these sounds?</summary>' +
      '<p class="ob-caption mm-caption">' + caption + '<br>The words are relative: the game uses no NASA numbers.</p></details></div>';
  }
  function startHtml() {
    return '<div class="mm-start"><h2 class="ob-h3">How do you want to play?</h2><div class="mm-start__grid">' +
      '<button class="ob-btn ob-btn--xl" type="button" data-mm-mode="camera"><span>Camera</span><span class="ob-caption">Hand gestures</span></button>' +
      '<button class="ob-btn ob-btn--xl" type="button" data-mm-mode="keys"><span>Keyboard and mouse</span><span class="ob-caption">Slide bars and shortcuts</span></button>' +
      '<button class="ob-btn ob-btn--xl" type="button" data-mm-mode="touch"><span>Touch</span><span class="ob-caption">Large sliders and buttons</span></button>' +
      '</div><p class="ob-caption">The camera picture stays in your browser. Nothing is recorded or uploaded.</p></div>';
  }
  function keysHtml() {
    return '<div class="mm-keys"><div class="mm-sliders">' + CFG.controls.map(function (c) {
      return '<div class="mm-ctl"><div class="mm-ctl__head"><span class="ob-h3">' + c.label + '</span>' +
        '<span class="ob-small">' + c.plain + '</span></div>' + sliderHtml(c, false) +
        '<p class="ob-caption mm-ctl__var">' + c.variable + ' · ' + sourceLink(c) + '</p></div>';
    }).join('') + '</div>' + actionsHtml(false) +
      '<p class="ob-caption">Keys: Tab to a slide bar, arrow keys to move it (hold Shift for bigger steps). Space plays or pauses. T replays the target. H plays yours once. Enter locks in. N starts or goes to the next round.</p></div>';
  }
  function touchHtml() {
    return '<div class="mm-touch"><div class="mm-touch__sliders">' + CFG.controls.map(function (c) {
      return '<div class="mm-tctl"><span class="ob-caption">High</span>' + sliderHtml(c, true) +
        '<span class="ob-caption">Low</span><span class="mm-tctl__name">' + c.label + '</span>' +
        '<span class="ob-small">' + c.plain + '</span>' +
        '<span class="ob-caption">' + c.variable + '<br>' + sourceLink(c) + '</span></div>';
    }).join('') + '</div>' + actionsHtml(true) + '</div>';
  }
  /* Simple line drawings for the gesture legend: [drawing, name, meaning]. */
  var PALM = '<rect x="7" y="12" width="10" height="9" rx="3"/>';
  var LEGEND = [
    [PALM + '<path d="M8.5 12V5M11 12V3.5M13.5 12V4M16 12V6M7 14l-3-3"/>', 'Open hand', 'play and steer'],
    ['<rect x="6" y="9" width="12" height="11" rx="4"/><path d="M9 9v3M12 9v3M15 9v3"/>', 'Fist', 'stop'],
    ['<rect x="7" y="13" width="10" height="8" rx="3"/><circle cx="9" cy="9" r="2.6"/><circle cx="14" cy="9" r="2.6"/>', 'Pinch', 'lock in'],
    [PALM + '<path d="M11 12V3M15 12v1M8 12v1"/>', 'Point', 'replay target'],
    [PALM + '<path d="M9.5 12L8 4M14 12l2-8M17 13v1"/>', 'Peace', 'hear mine'],
    ['<rect x="7" y="11" width="10" height="9" rx="3"/><path d="M8 11V4.5a1.5 1.5 0 0 1 3 0V11"/>', 'Thumbs up', 'start or next']
  ];
  function cameraHtml() {
    return '<div class="mm-cam"><div class="mm-cam__view" data-mm-view><video playsinline muted aria-hidden="true" tabindex="-1"></video>' +
      '<canvas aria-hidden="true"></canvas><p class="mm-cam__badge">Camera is on, nothing is recorded</p>' +
      '<div class="mm-practice" data-mm-practice hidden><p class="ob-label">Gesture practice</p><ul>' +
      '<li>Point: replay</li><li>Peace: hear mine</li><li>Thumbs up: start or next</li><li>Pinch: lock in</li></ul>' +
      '<button class="ob-btn" type="button" data-mm-act="skippractice">Skip practice</button></div>' +
      '<p class="mm-cam__msg" data-mm-cam-msg></p></div>' +
      '<div class="mm-cam__side">' + actionsHtml(false) +
      '<div><h3 class="ob-label">Gestures</h3><ul class="mm-legend ob-small">' + LEGEND.map(function (g) {
        return '<li><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' + g[0] + '</svg><span><strong>' + g[1] + '</strong> ' + g[2] + '</span></li>';
      }).join('') + '</ul><p class="ob-caption">Right hand: height is pitch, side is tempo. Left hand: height is loudness, side is brightness.</p></div>' +
      '<div class="mm-meters" data-mm-meters>' + CFG.controls.map(function (c) {
        return '<div class="mm-meter"><span class="ob-label">' + c.label + '</span><span class="mm-meter__bar"><i data-mm-meter="' + c.key + '"></i></span></div>';
      }).join('') + '</div>' +
      '<div class="mm-actions"><button class="ob-btn ob-btn--quiet" type="button" data-mm-act="meters">Hide meters</button>' +
      '<button class="ob-btn ob-btn--quiet" type="button" data-mm-act="calibrate">Calibrate again</button></div></div></div>';
  }

  /* ================= switching between the three modes ================= */

  /* Swap the whole play area. mode = null shows the start screen. */
  function showMode(mode) {
    if (camera) { camera.stop(); camera = null; }
    ORBEATS.setCameraStatus('Camera is off.');
    setPlaying(false);
    state.mode = mode;
    try { if (mode) localStorage.setItem('orbeats-play-mode', mode); } catch (e) {}
    area.innerHTML = mode === 'camera' ? cameraHtml() : mode === 'keys' ? keysHtml() : mode === 'touch' ? touchHtml() : startHtml();
    root.querySelector('.mm').setAttribute('data-mode', mode || 'start');
    if (mode === 'camera') startCamera();
    else if (mode && state.phase === 'adjust') setPlaying(true);
    var line = $('[data-mm-modeline]'); if (line) line.textContent = mode ? CFG.howToMode[mode] : 'Choose how you want to play below.';
    if (state.phase === 'idle') status(mode ? 'Press Start to hear a new tune.' : 'Choose how you want to play.');
    refresh();
  }

  /* A camera gesture was held long enough. Returns the label to show, or nothing if it does not apply now. */
  function onGesture(name) {
    if (name === 'tick') { sound.gestureTone('tick'); return null; }       // practice: a gesture was done
    var p = state.phase, label = null;
    if (name === 'lock' && p === 'adjust') { label = 'Locking in'; lockIn(); }
    else if (name === 'replay' && p === 'adjust') { label = 'Replaying target'; replayTarget(); }
    else if (name === 'hear' && p === 'adjust') { label = 'Hearing yours'; hearMine(); }
    else if (name === 'next' && (p === 'idle' || p === 'result' || p === 'final')) { label = p === 'idle' ? 'Starting' : p === 'final' ? 'Playing again' : 'Next round'; primary(); }
    if (label) { sound.gestureTone(name); ORBEATS.announce(label + '.'); }
    return label;
  }
  /* The gesture practice: prompts (written, spoken) and ticks. */
  var practiceStepShown = -2;
  function onPractice(info) {
    var box = $('[data-mm-practice]'); if (!box) return;
    box.hidden = !info.active;
    $$('[data-mm-practice] li').forEach(function (li, i) { li.classList.toggle('is-done', !!info.done[i]); li.classList.toggle('is-now', i === info.step); });
    var el = $('[data-mm-cam-msg]'); if (el) el.textContent = info.text;
    if (info.step !== practiceStepShown) {
      practiceStepShown = info.step;
      ORBEATS.announce(info.text);
      if (CFG.speakFeedback && window.speechSynthesis && ORBEATS.settings.audio && state.phase === 'idle') {
        try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(info.text)); } catch (e) {}
      }
    }
  }

  function startCamera() {
    camera = window.ORBEATS_PLAY_CAMERA(CFG, {
      setValue: function (key, v) { state.values[key] = v; },
      onGate: function (gate) {
        if (state.phase !== 'adjust') return;
        if (gate === 'open') setPlaying(true, 0.4);                 // open hand: fade in
        else if (gate === 'fist') setPlaying(false, 0.6);           // fist: fade out and stop
        else { setPlaying(false, 0.3); sound.softTone(); ORBEATS.announce('No hand visible. The music is paused.'); }
      },
      onGesture: onGesture,
      onPractice: onPractice,
      onMessage: function (text) { var el = $('[data-mm-cam-msg]'); if (el) el.textContent = text; }
    });
    var mine = camera;
    var practiced = false;
    try { practiced = !!sessionStorage.getItem('orbeats-play-practiced'); sessionStorage.setItem('orbeats-play-practiced', '1'); } catch (e) {}
    camera.start($('[data-mm-view]'), { practice: !practiced }).then(function () {
      if (camera !== mine) return;
      ORBEATS.setCameraStatus('Camera is on, nothing is recorded.');
      ORBEATS.announce('Camera is on, nothing is recorded. Hold your open hand at chest height.');
    }, function () {
      if (camera !== mine) return;
      /* Denied, missing, or the hand tracker did not load: use the keyboard instead. */
      showMode('keys');
      say('The camera is not available, so the game switched to keyboard and mouse.');
    });
  }

  /* ================= keeping the screen in step with the state ================= */

  function refresh() {
    if (!root) return;
    var p = state.phase;
    $('[data-mm-round]').textContent = state.round ? 'Round ' + state.round + ' of ' + CFG.rounds : CFG.rounds + ' rounds';
    $('[data-mm-audio]').hidden = ORBEATS.settings.audio || p === 'idle';
    $$('[data-mm-switch]').forEach(function (b) {
      var on = !!state[b.getAttribute('data-mm-switch')];
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.querySelector('.ob-switch__state').textContent = on ? 'On' : 'Off';
    });
    $$('[data-mm-act="primary"]').forEach(function (b) {
      b.textContent = p === 'adjust' ? 'Lock in' : p === 'result' ? 'Next round' : p === 'final' ? 'Play again' : p === 'target' ? 'Listen…' : 'Play game';
      b.disabled = p === 'target' || p === 'explain';
      b.hidden = p === 'idle';                                  // before the game the big Start button is used
    });
    var running = p !== 'idle';
    $$('[data-mm-act="skip"]').forEach(function (b) { b.hidden = p !== 'explain'; });
    $$('[data-mm-act="stop"]').forEach(function (b) { b.hidden = !running; });
    $$('[data-mm-act="help"]').forEach(function (b) { b.hidden = state.help; b.setAttribute('aria-expanded', state.help ? 'true' : 'false'); });
    $$('[data-mm-how]').forEach(function (el) { el.hidden = !state.help; });
    $$('[data-mm-act="start"]').forEach(function (b) { b.hidden = !(state.help && state.mode && p === 'idle'); });
    $$('[data-mm-act="replay"], [data-mm-act="hear"]').forEach(function (b) { b.disabled = p !== 'adjust'; });
    $$('[data-mm-act="lock"]').forEach(function (b) { b.disabled = p !== 'adjust'; b.hidden = p === 'idle'; });
    $$('[data-mm-act="next"]').forEach(function (b) {
      b.textContent = p === 'final' ? 'Play again' : 'Next';
      b.disabled = !(p === 'result' || p === 'final'); b.hidden = p === 'idle';
    });
    $$('[data-mm-act="toggle"]').forEach(function (b) { b.disabled = p !== 'adjust'; b.textContent = state.playing ? 'Pause' : 'Play'; });
    $$('[data-mm-act="meters"]').forEach(function (b) { b.textContent = state.meters ? 'Hide meters' : 'Show meters'; });
    $$('[data-mm-meters]').forEach(function (el) { el.hidden = !state.meters; });
    refreshValues();
  }
  /* Sliders, meters and the warmer/colder tone follow the values. Runs often. */
  function refreshValues() {
    if (!root) return;
    $$('[data-mm-slider]').forEach(function (el) {
      var key = el.getAttribute('data-mm-slider'), v = state.values[key], c = control(key);
      el.style.setProperty('--v', v);
      el.setAttribute('aria-valuenow', Math.round(v * 100));
      el.setAttribute('aria-valuetext', word(v) + ' (' + (v > 0.5 ? c.high : c.low) + ')');
    });
    $$('[data-mm-meter]').forEach(function (el) { el.style.width = (state.values[el.getAttribute('data-mm-meter')] * 100) + '%'; });
    if (state.phase === 'adjust' && state.playing) sound.setGuide(state.guide ? overall() / 100 : null);
  }
  function setValue(key, v) {
    state.values[key] = Math.max(0, Math.min(1, v));
    refreshValues();
  }

  /* ================= clicks, pointers and keys ================= */

  function onClick(e) {
    var t = e.target.closest('[data-mm-act], [data-mm-mode], [data-mm-switch]');
    if (!t || !root.contains(t)) return;
    var act = t.getAttribute('data-mm-act');
    if (t.hasAttribute('data-mm-mode')) showMode(t.getAttribute('data-mm-mode'));
    else if (t.hasAttribute('data-mm-switch')) {
      var key = t.getAttribute('data-mm-switch');
      state[key] = !state[key];
      if (key === 'guide' && !state.guide) sound.setGuide(null);
      ORBEATS.announce(t.textContent.replace(/O(n|ff)$/, '') + (state[key] ? ' on.' : ' off.'));
      refresh();
    }
    else if (act === 'primary') primary();
    else if (act === 'replay') replayTarget();
    else if (act === 'hear') hearMine();
    else if (act === 'lock') lockIn();
    else if (act === 'next') { if (state.phase === 'result' || state.phase === 'final') primary(); }
    else if (act === 'skippractice' && camera) camera.skipPractice();
    else if (act === 'toggle') setPlaying(!state.playing);
    else if (act === 'start') primary();
    else if (act === 'skip') { if (state.skip) state.skip(); }
    else if (act === 'stop') { endGame(); status('Game stopped. Press Start to play again.'); ORBEATS.announce('Game stopped.'); refresh(); }
    else if (act === 'help') { state.help = !state.help; refresh(); }
    else if (act === 'change') { endGame(); showMode(null); }
    else if (act === 'meters') { state.meters = !state.meters; refresh(); }
    else if (act === 'calibrate' && camera) camera.calibrate();
  }

  /* Dragging a slide bar with the mouse or a finger. */
  function valueFromPointer(el, e) {
    var r = el.getBoundingClientRect();
    if (el.classList.contains('mm-slider--v')) return 1 - (e.clientY - r.top) / r.height;
    return (e.clientX - r.left) / r.width;
  }
  function onPointerDown(e) {
    var el = e.target.closest('[data-mm-slider]'); if (!el) return;
    e.preventDefault();
    el.focus();
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    el._dragging = true;
    setValue(el.getAttribute('data-mm-slider'), valueFromPointer(el, e));
  }
  function onPointerMove(e) {
    var el = e.target.closest('[data-mm-slider]');
    if (el && el._dragging) setValue(el.getAttribute('data-mm-slider'), valueFromPointer(el, e));
  }
  function onPointerUp(e) {
    var el = e.target.closest('[data-mm-slider]');
    if (el) el._dragging = false;
  }

  function onKey(e) {
    if (!root || !state.mode || e.ctrlKey || e.altKey || e.metaKey) return;
    var t = e.target;
    /* Arrow keys on a slide bar. */
    var slider = t.closest && t.closest('[data-mm-slider]');
    if (slider) {
      var key = slider.getAttribute('data-mm-slider'), step = e.shiftKey ? CFG.bigStep : CFG.step, v = state.values[key];
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v += step;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v -= step;
      else if (e.key === 'Home') v = 0;
      else if (e.key === 'End') v = 1;
      else slider = null;
      if (slider) { e.preventDefault(); setValue(key, v); return; }
    }
    /* Game shortcuts, when the focus is in the game or nowhere in particular. */
    if (t !== document.body && !root.contains(t)) return;
    if (t.closest && t.closest('button, a, input, select, textarea')) return;       // let buttons and links do their own thing
    if (e.key === ' ') { e.preventDefault(); if (state.phase === 'adjust') setPlaying(!state.playing); }
    else if (e.key === 't' || e.key === 'T') replayTarget();
    else if (e.key === 'h' || e.key === 'H') hearMine();
    else if (e.key === 'n' || e.key === 'N') { if (state.phase === 'idle' || state.phase === 'result' || state.phase === 'final') primary(); }
    else if (e.key === 'Enter') { e.preventDefault(); primary(); }
  }

  /* ================= start and stop ================= */

  function mount(container) {
    root = container;
    root.innerHTML = shellHtml();
    area = $('[data-mm-area]');
    root.addEventListener('click', onClick);
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerUp);
    document.addEventListener('keydown', onKey);
    document.addEventListener('orbeats:settings', refresh);
    refreshTimer = setInterval(refreshValues, 80);          // camera values change all the time
    var saved = null;
    try { saved = localStorage.getItem('orbeats-play-mode'); } catch (e) {}
    showMode(saved === 'camera' || saved === 'keys' || saved === 'touch' ? saved : null);     // the choice is remembered
  }

  function unmount() {
    clearTimers(); clearInterval(refreshTimer);
    if (camera) { camera.stop(); camera = null; }
    sound.stopAll();
    if (window.speechSynthesis) speechSynthesis.cancel();
    releaseMusic();
    ORBEATS.setNowPlaying(null);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('orbeats:settings', refresh);
    root = null;
  }

  ORBEATS.registerGame({ id: 'match-the-melody', title: CFG.title, mount: mount, unmount: unmount });
})();
