/* MATCH THE MELODY: all the sound, made with the Web Audio API (no audio files).
 *
 *   notes -> filter (brightness) -> gain (loudness) -> fade -> game bus -> limiter -> the site's output
 *
 * The site's output already follows the site volume and the Audio switch.
 * Timing uses the Web Audio clock (ctx.currentTime), so the beat stays steady.
 *
 * A "tune" is a list of scale steps. "values" is { pitch, tempo, loudness, brightness },
 * each from 0 to 1.
 */
window.ORBEATS_PLAY_SOUND = function (CFG) {
  'use strict';
  var ctx = null, bus = null;
  var oneShots = [];        // chains of tunes that were scheduled ahead (target, playback)
  var live = null;          // the player's looping version
  var guide = null;         // the "warmer/colder" tone

  /* Start the audio (call this from a click or key press). */
  function ready() {
    if (ctx) return true;
    var audio = window.ORBEATS.getAudio();
    if (!audio) return false;
    ctx = audio.context;
    bus = ctx.createGain();
    var limiter = ctx.createDynamicsCompressor();      // stops the sound from ever getting too loud
    limiter.threshold.value = -8; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.003; limiter.release.value = 0.2;
    bus.connect(limiter); limiter.connect(audio.output);
    return true;
  }
  function now() { return ctx ? ctx.currentTime : 0; }

  /* ---------- turning values into sound ---------- */

  function beatOf(v) { return CFG.slowBeat + (CFG.fastBeat - CFG.slowBeat) * v.tempo; }            // seconds per note
  function gainOf(v) { return CFG.quiet + (CFG.loud - CFG.quiet) * v.loudness; }
  function cutoffOf(v) { return CFG.dark * Math.pow(CFG.bright / CFG.dark, v.brightness); }        // hertz
  function pitchStep(v) { return Math.round(v.pitch * CFG.pitchSteps); }                           // snaps to the scale
  function frequency(step) {
    var n = CFG.scale.length;
    return CFG.baseNote * Math.pow(2, (CFG.scale[step % n] + 12 * Math.floor(step / n)) / 12);
  }
  /* How long one pass of the tune takes, in seconds. */
  function lengthOf(v) { return beatOf(v) * CFG.notes; }

  /* A new random tune: a line that wanders up and down the scale. */
  function randomTune() {
    var tune = [], step = 1 + Math.floor(Math.random() * 4);
    for (var i = 0; i < CFG.notes; i++) {
      tune.push(step);
      step = Math.max(0, Math.min(6, step + Math.floor(Math.random() * 5) - 2));
    }
    return tune;
  }

  /* One set of filter + gain + fade, for one version of the tune. */
  function makeChain(v) {
    var filter = ctx.createBiquadFilter(), gain = ctx.createGain(), fade = ctx.createGain();
    filter.type = 'lowpass'; filter.Q.value = 1;
    filter.frequency.value = cutoffOf(v);
    gain.gain.value = gainOf(v);
    filter.connect(gain); gain.connect(fade); fade.connect(bus);
    return { filter: filter, gain: gain, fade: fade };
  }
  function dropChain(chain) {
    chain.fade.gain.setTargetAtTime(0, now(), 0.03);
    setTimeout(function () { chain.fade.disconnect(); }, 300);
  }

  /* One note. */
  function note(chain, hertz, when, beat) {
    var osc = ctx.createOscillator(), env = ctx.createGain();
    var length = Math.min(beat * 0.92, 0.5);
    osc.type = 'sawtooth';
    osc.frequency.value = hertz;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(1, when + 0.012);
    env.gain.exponentialRampToValueAtTime(0.001, when + length);
    osc.connect(env); env.connect(chain.filter);
    osc.start(when); osc.stop(when + length + 0.02);
  }

  /* ---------- play a tune once (the target, and the playback after lock in) ---------- */

  /* Schedules the whole tune to start at `when`. Returns the time it ends. */
  function playOnce(tune, v, when) {
    if (!ready()) return 0;
    var chain = makeChain(v), beat = beatOf(v), shift = pitchStep(v);
    when = Math.max(when || 0, now() + 0.06);
    for (var i = 0; i < tune.length; i++) note(chain, frequency(tune[i] + shift), when + i * beat, beat);
    oneShots.push(chain);
    return when + tune.length * beat;
  }
  function stopOnce() { oneShots.forEach(dropChain); oneShots = []; }

  /* ---------- the player's live version: loops and follows the controls ---------- */

  /* getValues() is called for every note, so changes are heard straight away. */
  function startLive(tune, getValues) {
    if (!ready()) return;
    stopLive();
    live = { tune: tune, getValues: getValues, chain: makeChain(getValues()), next: now() + 0.08, i: 0, playing: true };
    live.timer = setInterval(liveTick, 40);
  }
  function liveTick() {
    if (!live) return;
    var v = live.getValues(), t = now();
    live.chain.filter.frequency.setTargetAtTime(cutoffOf(v), t, 0.04);
    live.chain.gain.gain.setTargetAtTime(gainOf(v), t, 0.04);
    if (!live.playing) return;
    while (live.next < t + 0.12) {
      var beat = beatOf(v);
      if (live.i < live.tune.length) note(live.chain, frequency(live.tune[live.i] + pitchStep(v)), live.next, beat);
      live.next += beat;
      live.i = (live.i + 1) % (live.tune.length + 2);       // two silent beats before the tune repeats
    }
  }
  /* Fade the live version in or out (used by Pause and by the fist gesture). */
  function setLivePlaying(on, fadeSeconds) {
    if (!live || live.playing === on) return;
    live.playing = on;
    if (on) { live.next = now() + 0.08; live.i = 0; }
    live.chain.fade.gain.setTargetAtTime(on ? 1 : 0, now(), (fadeSeconds || 0.3) / 3);
  }
  function stopLive() {
    if (!live) return;
    clearInterval(live.timer);
    dropChain(live.chain);
    live = null;
  }

  /* ---------- the "warmer/colder" tone ---------- */

  /* closeness: 0 (far) to 1 (matched), or null to switch the tone off.
   * Two soft notes: far away they clash and beat; a match is a clean, calm fifth. */
  function setGuide(closeness) {
    if (!ready()) return;
    if (!guide) {
      guide = { a: ctx.createOscillator(), b: ctx.createOscillator(), gain: ctx.createGain() };
      guide.a.frequency.value = 110; guide.b.frequency.value = 165;
      guide.gain.gain.value = 0;
      guide.a.connect(guide.gain); guide.b.connect(guide.gain); guide.gain.connect(bus);
      guide.a.start(); guide.b.start();
    }
    var t = now();
    if (closeness == null) { guide.gain.gain.setTargetAtTime(0, t, 0.08); return; }
    guide.gain.gain.setTargetAtTime(0.05, t, 0.1);
    guide.b.frequency.setTargetAtTime(165 + (1 - closeness) * 24, t, 0.08);
  }

  /* A soft falling tone: "the music paused because no hand is visible". */
  function softTone() {
    if (!ready()) return;
    var osc = ctx.createOscillator(), env = ctx.createGain(), t = now();
    osc.frequency.setValueAtTime(392, t);
    osc.frequency.exponentialRampToValueAtTime(196, t + 0.35);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.08, t + 0.03);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(env); env.connect(bus);
    osc.start(t); osc.stop(t + 0.45);
  }

  /* A short, distinct blip for each gesture. */
  var GESTURE_TONES = { replay: 523, hear: 659, next: 784, lock: 988, tick: 1175 };
  function gestureTone(name) {
    if (!ready()) return;
    var osc = ctx.createOscillator(), env = ctx.createGain(), t = now(), f = GESTURE_TONES[name] || 660;
    osc.type = 'sine'; osc.frequency.value = f;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.12, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(env); env.connect(bus);
    osc.start(t); osc.stop(t + 0.26);
  }

  function stopAll() { stopOnce(); stopLive(); if (guide) setGuide(null); }

  return {
    ready: ready, now: now, randomTune: randomTune, lengthOf: lengthOf, pitchStep: pitchStep,
    playOnce: playOnce, stopOnce: stopOnce,
    startLive: startLive, setLivePlaying: setLivePlaying, stopLive: stopLive,
    setGuide: setGuide, softTone: softTone, gestureTone: gestureTone, stopAll: stopAll
  };
};
