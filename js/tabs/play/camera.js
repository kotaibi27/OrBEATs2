/* MATCH THE MELODY: camera and hand gestures.
 *
 * Uses MediaPipe HandLandmarker from the local vendor/mediapipe/ folder, so it
 * works offline. The video is processed in the browser only: nothing is
 * recorded and nothing is uploaded.
 *
 *   RIGHT hand: height = pitch,    left to right = tempo
 *   LEFT hand:  height = loudness, left to right = brightness
 *   open hand = play and steer, fist = fade out and stop
 *   pinch (1 s) = lock in, point (0.4 s) = replay target,
 *   peace (0.4 s) = hear mine, thumbs up (0.6 s) = start / next
 *
 * Only an OPEN hand steers. In any other pose the four values stay frozen.
 * A gesture must be held for its time, then there is a cooldown, and it can
 * fire again only after a hand has returned to an open palm.
 *
 * hooks (all called by this file):
 *   setValue(key, value)   a control changed (value 0..1)
 *   onGate(state)          'open' (a hand is open), 'fist', or 'none' (no hand visible)
 *   onGesture(name)        'lock', 'replay', 'hear' or 'next' was held long enough.
 *                          Return the label to show near the hand, or nothing if it does not apply now.
 *   onPractice(info)       { active, step, done[], text } during the gesture practice
 *   onMessage(text)        text for the line under the camera view
 */
window.ORBEATS_PLAY_CAMERA = function (CFG, hooks) {
  'use strict';
  var C = CFG.camera;
  var BASE = new URL('vendor/mediapipe/', document.baseURI).href;
  /* Which landmarks to join with lines to draw the hand skeleton. */
  var BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
               [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

  var video = null, canvas = null, draw = null, stream = null, landmarker = null;
  var running = false, frame = 0, lastVideoTime = -1;
  var neutral = C.neutralY;                 // chest height, 0 (top) to 1 (bottom)
  var calibration = null;                   // { until, sum, count } while calibrating
  var hands = { left: newHand(), right: newHand() };
  var gate = '', lastSeen = 0;
  var armed = true, cooldownUntil = 0;      // a gesture can fire only when armed (a hand was open since the last one)
  var holdInfo = null, flash = null;        // progress ring and the short label near the hand
  var practice = null, wantPractice = false;

  /* The gestures that do something, and the pose each one needs. */
  var GESTURES = {
    pinch: { name: 'lock',   hold: C.pinchHold },
    point: { name: 'replay', hold: C.pointHold },
    peace: { name: 'hear',   hold: C.peaceHold },
    thumb: { name: 'next',   hold: C.thumbHold }
  };
  var PRACTICE = [
    { pose: 'point', text: 'Point your index finger to replay the tune.' },
    { pose: 'peace', text: 'Make a peace sign to hear your version.' },
    { pose: 'thumb', text: 'Give a thumbs up to start or go to the next round.' },
    { pose: 'pinch', text: 'Pinch your thumb and finger, and hold, to lock in.' }
  ];

  function newHand() {
    return { v: 0.5, h: 0.5, fist: false, pinch: false, seen: false, ext: [false, false, false, false], pinchRaw: false,
             pose: 'none', since: 0, cand: 'none', candN: 0, candSince: 0, fired: false };
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function clamp(x) { return Math.max(0, Math.min(1, x)); }

  /* Load the MediaPipe code. A plain import() is tried first; if the server
   * sends the wrong file type for .mjs, the file is fetched and imported as a blob. */
  function loadVision() {
    var url = BASE + 'vision_bundle.mjs';
    return import(url).catch(function () {
      return fetch(url).then(function (r) { return r.text(); }).then(function (code) {
        return import(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
      });
    });
  }
  function makeLandmarker(vision, files, delegate) {
    return vision.HandLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: BASE + 'hand_landmarker.task', delegate: delegate },
      runningMode: 'VIDEO', numHands: 2
    });
  }

  /* Turn the camera on inside `view` (an element holding a <video> and a <canvas>).
   * Returns a promise; it fails if the camera is denied or missing. */
  function start(view, opts) {
    wantPractice = !!(opts && opts.practice);
    video = view.querySelector('video'); canvas = view.querySelector('canvas'); draw = canvas.getContext('2d');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject(new Error('no camera support'));
    hooks.onMessage('Starting the camera…');
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(function (s) {
        stream = s;
        video.srcObject = s;
        return video.play();
      })
      .then(function () {
        if (video.videoWidth) view.style.aspectRatio = video.videoWidth + ' / ' + video.videoHeight;
        hooks.onMessage('Loading the hand tracker…');
        return landmarker ? null : loadVision().then(function (vision) {
          return vision.FilesetResolver.forVisionTasks(BASE + 'wasm').then(function (files) {
            return makeLandmarker(vision, files, 'GPU').catch(function () { return makeLandmarker(vision, files, 'CPU'); });
          });
        }).then(function (lm) { landmarker = lm; });
      })
      .then(function () {
        if (!stream) return;                 // stopped while loading
        running = true;
        calibrate();
        frame = requestAnimationFrame(loop);
      })
      .catch(function (err) { stop(); throw err; });
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frame);
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null;
    if (video) video.srcObject = null;
    gate = '';
  }

  /* Ask the player to hold a hand at chest height; that height becomes "neutral". */
  function calibrate() {
    calibration = { until: performance.now() + C.calibrateSeconds * 1000, sum: 0, count: 0 };
  }

  /* ---------- reading one hand ---------- */

  /* Palm centre, in the MIRRORED view (x = 0 is the left edge the player sees). */
  function palm(lm) {
    var x = 0, y = 0;
    [0, 5, 9, 13, 17].forEach(function (i) { x += lm[i].x; y += lm[i].y; });
    return { x: 1 - x / 5, y: y / 5 };
  }
  /* Height: 0.5 inside the neutral band (the dead zone), up to 1 near the top, down to 0 near the bottom. */
  function heightValue(y) {
    var d = neutral - y, edge = 0.08;
    if (Math.abs(d) <= C.deadZone) return 0.5;
    if (d > 0) return clamp(0.5 + 0.5 * (d - C.deadZone) / Math.max(0.05, neutral - C.deadZone - edge));
    return clamp(0.5 - 0.5 * (-d - C.deadZone) / Math.max(0.05, 1 - edge - neutral - C.deadZone));
  }
  /* Left to right inside the hand's own half of the view. */
  function sideValue(x, side) {
    var start = side === 'right' ? 0.5 : 0, edge = 0.05;
    return clamp((x - start - edge) / (0.5 - 2 * edge));
  }
  /* Which pose is this hand making? Fingers are "extended" when the tip is
   * farther from the wrist than the middle joint (with a little hysteresis). */
  var TIPS = [8, 12, 16, 20], PIPS = [6, 10, 14, 18];
  function classify(lm, hand, t) {
    var size = dist(lm[0], lm[9]) || 0.001, e = hand.ext, i;
    for (i = 0; i < 4; i++) {
      var r = dist(lm[TIPS[i]], lm[0]) / (dist(lm[PIPS[i]], lm[0]) || 0.001);
      e[i] = e[i] ? r > C.extOff : r > C.extOn;
    }
    var gap = dist(lm[4], lm[8]) / size;
    hand.pinchRaw = hand.pinchRaw ? gap < C.pinchOff : gap < C.pinchOn;
    var thumbUp = lm[4].y < lm[8].y - C.thumbUp * size && lm[4].y < lm[2].y - C.thumbUp * size;
    var raw;
    if (hand.pinchRaw) raw = 'pinch';
    else if (!e[0] && !e[1] && !e[2] && !e[3]) raw = thumbUp ? 'thumb' : 'fist';
    else if (e[0] && !e[1] && !e[2] && !e[3]) raw = 'point';
    else if (e[0] && e[1] && !e[2] && !e[3]) raw = 'peace';
    else if (e[0] && e[1] && e[2]) raw = 'open';
    else raw = 'other';
    /* A pose counts only after it has been seen for a few frames in a row. */
    if (raw === hand.cand) hand.candN++; else { hand.cand = raw; hand.candN = 1; hand.candSince = t; }
    if (hand.candN >= C.stableFrames && hand.cand !== hand.pose) { hand.pose = hand.cand; hand.since = hand.candSince; hand.fired = false; }
  }
  function readHand(lm, side, t) {
    var hand = hands[side], p = palm(lm);
    hand.seen = true; hand.palm = p; hand.lm = lm;
    classify(lm, hand, t);
    hand.fist = hand.pose === 'fist'; hand.pinch = hand.pose === 'pinch';
    if (hand.pose !== 'open' || calibration) return;         // only an OPEN hand steers; every other pose freezes the values
    hand.v += (heightValue(p.y) - hand.v) * C.smooth;        // smoothing
    hand.h += (sideValue(p.x, side) - hand.h) * C.smooth;
    if (side === 'right') { hooks.setValue('pitch', hand.v); hooks.setValue('tempo', hand.h); }
    else { hooks.setValue('loudness', hand.v); hooks.setValue('brightness', hand.h); }
  }

  /* ---------- gestures: hold, fire, cooldown ---------- */

  /* The hand that has held a gesture pose the longest (either hand works). */
  function longestHold(t, wanted) {
    var best = null, held = -1;
    ['left', 'right'].forEach(function (side) {
      var h = hands[side];
      if (!h.seen || h.fired || !GESTURES[h.pose] || (wanted && h.pose !== wanted)) return;
      if (t - h.since > held) { held = t - h.since; best = side; }
    });
    return best ? { side: best, held: held, g: GESTURES[hands[best].pose] } : null;
  }
  function gestures(t) {
    holdInfo = null;
    if (hands.left.pose === 'open' || hands.right.pose === 'open') armed = true;    // back to an open palm: ready again
    if (practice) { practiceStep(t); return; }
    if (!armed || t < cooldownUntil) return;
    var b = longestHold(t);
    if (!b) return;
    var k = b.held / (b.g.hold * 1000);
    holdInfo = { side: b.side, k: Math.min(1, k) };
    if (k < 1) return;
    var h = hands[b.side]; h.fired = true;                   // once per pose, even if the action does not apply
    var label = hooks.onGesture(b.g.name);
    if (label) {
      cooldownUntil = t + C.cooldown * 1000; armed = false;
      flash = { text: label, x: h.palm.x, y: h.palm.y, until: t + 1600 };
    }
  }

  /* ---------- gesture practice: try each gesture once ---------- */

  function startPractice(t) {
    practice = { step: 0, done: [false, false, false, false], until: t + C.practiceSeconds * 1000 };
    tellPractice();
  }
  function tellPractice() {
    hooks.onPractice({ active: !!practice, step: practice ? practice.step : -1, done: practice ? practice.done.slice() : [],
                       text: practice ? PRACTICE[practice.step].text : 'Practice finished. Press Start when you are ready.' });
  }
  function practiceStep(t) {
    var want = PRACTICE[practice.step], b = longestHold(t, want.pose);
    if (b) {
      var k = b.held / (GESTURES[want.pose].hold * 1000);
      holdInfo = { side: b.side, k: Math.min(1, k) };
      if (k >= 1) { hands[b.side].fired = true; practice.done[practice.step] = true; hooks.onGesture('tick'); nextPractice(t); return; }
    }
    if (t >= practice.until) nextPractice(t);                // out of time: move on
  }
  function nextPractice(t) {
    practice.step++;
    if (practice.step >= PRACTICE.length) { practice = null; armed = true; cooldownUntil = t + 600; }
    else practice.until = t + C.practiceSeconds * 1000;
    tellPractice();
  }
  function skipPractice() { if (practice) { practice = null; armed = true; tellPractice(); } }

  /* ---------- every video frame ---------- */

  function loop() {
    if (!running) return;
    frame = requestAnimationFrame(loop);
    if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    var t = performance.now(), result;
    try { result = landmarker.detectForVideo(video, t); } catch (e) { return; }
    var found = result.landmarks || [];

    /* Which hand is which. MediaPipe names hands as if the picture were already
     * mirrored; our video is sent un-mirrored, so its "Left" is the player's right. */
    hands.left.seen = false; hands.right.seen = false;
    var sides = found.map(function (lm, i) {
      var name = result.handedness && result.handedness[i] && result.handedness[i][0] ? result.handedness[i][0].categoryName : '';
      var side = name === 'Left' ? 'right' : 'left';
      if (C.swapHands) side = side === 'right' ? 'left' : 'right';
      return side;
    });
    if (found.length === 2 && sides[0] === sides[1]) {        // both named the same: use where they are
      var firstIsRight = palm(found[0]).x > palm(found[1]).x;
      sides = firstIsRight ? ['right', 'left'] : ['left', 'right'];
    }
    found.forEach(function (lm, i) { readHand(lm, sides[i], t); });
    ['left', 'right'].forEach(function (s) {
      var h = hands[s];
      if (!h.seen) { h.fist = false; h.pinch = false; h.pose = 'none'; h.cand = 'none'; h.candN = 0; h.pinchRaw = false; h.fired = false; }
    });

    var any = hands.left.seen || hands.right.seen;
    if (any) lastSeen = t;

    if (calibration) {
      if (hands.left.seen) { calibration.sum += hands.left.palm.y; calibration.count++; }
      if (hands.right.seen) { calibration.sum += hands.right.palm.y; calibration.count++; }
      var left = Math.ceil((calibration.until - t) / 1000);
      hooks.onMessage('Hold your open hand at chest height. ' + Math.max(0, left));
      if (t >= calibration.until) {
        if (calibration.count > 10) neutral = Math.max(0.25, Math.min(0.8, calibration.sum / calibration.count));
        calibration = null;
        hooks.onMessage('Ready. Open hand to steer.');
        if (wantPractice) { wantPractice = false; startPractice(t); }
      }
    } else {
      /* Open hand, fist, or no hand at all (after a short wait, so a flicker does not pause the music).
       * Point, peace, thumbs up and pinch leave the music as it is. */
      var anyOpen = hands.left.pose === 'open' || hands.right.pose === 'open';
      var next = any ? ((hands.left.fist || hands.right.fist) ? 'fist' : (anyOpen ? 'open' : (gate || 'open'))) : (t - lastSeen > 500 ? 'none' : gate);
      if (next && next !== gate) { gate = next; hooks.onGate(gate); }
      gestures(t);
    }
    paint(t);
  }

  /* ---------- drawing: guides and the hand skeleton ---------- */

  function paint(t) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    draw.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw.clearRect(0, 0, w, h);
    var css = getComputedStyle(document.documentElement);
    var neon = css.getPropertyValue('--neon').trim() || '#4cc9ff';
    var ink = css.getPropertyValue('--ink-bright').trim() || '#eef4fc';

    /* Faint guides. */
    draw.fillStyle = neon; draw.globalAlpha = 0.1;
    draw.fillRect(0, (neutral - C.deadZone) * h, w, C.deadZone * 2 * h);         // the neutral band
    draw.globalAlpha = 0.35; draw.strokeStyle = neon; draw.lineWidth = 1;
    draw.setLineDash([4, 8]);
    draw.beginPath(); draw.moveTo(w / 2, 0); draw.lineTo(w / 2, h); draw.stroke();   // left hand | right hand
    draw.setLineDash([]);
    draw.globalAlpha = 0.7; draw.fillStyle = ink;
    draw.font = '12px Inter, system-ui, sans-serif'; draw.textAlign = 'center';
    draw.fillText('HIGHER', w / 2, (neutral - C.deadZone) * h - 10);
    draw.fillText('LOWER', w / 2, (neutral + C.deadZone) * h + 20);
    draw.fillText('LEFT HAND', w * 0.25, h - 12);
    draw.fillText('RIGHT HAND', w * 0.75, h - 12);

    /* Thin neon skeleton, mirrored like the video. */
    ['left', 'right'].forEach(function (side) {
      var hand = hands[side]; if (!hand.seen) return;
      var lm = hand.lm;
      draw.globalAlpha = hand.fist ? 0.45 : 0.95;
      draw.strokeStyle = neon; draw.lineWidth = 1.5;
      draw.beginPath();
      BONES.forEach(function (b) {
        draw.moveTo((1 - lm[b[0]].x) * w, lm[b[0]].y * h);
        draw.lineTo((1 - lm[b[1]].x) * w, lm[b[1]].y * h);
      });
      draw.stroke();
      draw.fillStyle = neon;
      lm.forEach(function (p) { draw.beginPath(); draw.arc((1 - p.x) * w, p.y * h, 2, 0, 6.283); draw.fill(); });
    });
    /* Progress ring around the hand that is holding a gesture. */
    if (holdInfo && hands[holdInfo.side].palm) {
      var pm = hands[holdInfo.side].palm;
      draw.globalAlpha = 1; draw.lineWidth = 3; draw.strokeStyle = ink;
      draw.beginPath(); draw.arc(pm.x * w, pm.y * h, 30, -1.5708, -1.5708 + holdInfo.k * 6.283); draw.stroke();
    }
    /* A short label near the hand after a gesture fired. */
    if (flash && t < flash.until) {
      var life = (flash.until - t) / 1600;
      draw.globalAlpha = Math.min(1, life * 3);
      draw.font = '600 18px Inter, system-ui, sans-serif'; draw.textAlign = 'center';
      var tw = draw.measureText(flash.text).width + 24, fx = Math.max(tw / 2 + 4, Math.min(w - tw / 2 - 4, flash.x * w)), fy = Math.max(40, flash.y * h - 50);
      draw.fillStyle = 'rgba(3, 6, 12, 0.8)'; draw.fillRect(fx - tw / 2, fy - 22, tw, 32);
      draw.strokeStyle = neon; draw.lineWidth = 1; draw.strokeRect(fx - tw / 2, fy - 22, tw, 32);
      draw.fillStyle = ink; draw.fillText(flash.text, fx, fy);
    }
    draw.globalAlpha = 1;
  }

  return { start: start, stop: stop, calibrate: calibrate, skipPractice: skipPractice, gate: function () { return gate; } };
};
