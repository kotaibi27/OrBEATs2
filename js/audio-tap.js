/* ORBEATS audio tap: a copy of everything the page sends to the speakers.
 *
 * Load this file BEFORE js/app.js and before every Compose script. It does not
 * care how the page wires its sound:
 *   1. It wraps the AudioContext constructor (and webkitAudioContext), so it
 *      knows about every context the page creates, now or later.
 *   2. It patches AudioNode.prototype.connect. Whenever any node connects to
 *      a context's destination (the speakers), the same node is ALSO connected
 *      to that context's tap. Nothing is disconnected, so playback is unchanged.
 *
 * Each context's tap is:   tap gain -> MediaStreamAudioDestinationNode (for MediaRecorder)
 *                                   -> AnalyserNode (for a level meter)
 *
 * The Orbeat Board uses it as window.ORBEATS.tap (js/app.js creates window.ORBEATS
 * later, so the board copies window.ORBEATS_TAP onto it):
 *   getStream()    the MediaStream to record
 *   getAnalyser()  an AnalyserNode on the same signal
 *   getContext()   the AudioContext being tapped (the newest running one)
 *   isActive()     true when that context is running and something is connected to the speakers
 *   sink(node)     keeps a silent recording node running (it is not copied into the tap)
 *   setGain(g)     level of the copy only. The site's Volume slider sits before the speakers
 *                  (12% by default), so the recorder sets this to 1 / volume and the
 *                  recording comes out at full level. The speakers are not affected.
 */
(function () {
  'use strict';
  var Native = window.AudioContext || window.webkitAudioContext;
  if (!Native || window.ORBEATS_TAP) return;

  var taps = [];                                   // one per AudioContext, oldest first
  var nativeConnect = AudioNode.prototype.connect;

  function tapOf(ctx) {
    for (var i = 0; i < taps.length; i++) if (taps[i].ctx === ctx) return taps[i];
    return null;
  }
  function makeTap(ctx) {
    var t = tapOf(ctx);
    if (t) return t;
    t = { ctx: ctx, sources: 0, gain: ctx.createGain(), dest: ctx.createMediaStreamDestination(), analyser: ctx.createAnalyser() };
    t.analyser.fftSize = 1024;
    nativeConnect.call(t.gain, t.dest);
    nativeConnect.call(t.gain, t.analyser);
    taps.push(t);
    return t;
  }

  AudioNode.prototype.connect = function (target) {
    var result = nativeConnect.apply(this, arguments);
    try {
      var ctx = this.context;
      if (ctx && target === ctx.destination && typeof ctx.createMediaStreamDestination === 'function') {
        var t = makeTap(ctx);
        nativeConnect.call(this, t.gain, arguments[1] || 0);       // the extra copy; the speakers stay connected
        t.sources++;
      }
    } catch (e) {}
    return result;
  };

  function Wrapped(options) {
    var ctx = options === undefined ? new Native() : new Native(options);
    try { makeTap(ctx); } catch (e) {}
    return ctx;                                    // a real AudioContext, so instanceof and every method still work
  }
  Wrapped.prototype = Native.prototype;
  if (window.AudioContext) window.AudioContext = Wrapped;
  if (window.webkitAudioContext) window.webkitAudioContext = Wrapped;

  /* The newest context that is running; if none is running, the newest one. */
  function current() {
    for (var i = taps.length - 1; i >= 0; i--) if (taps[i].ctx.state === 'running') return taps[i];
    return taps[taps.length - 1] || null;
  }

  window.ORBEATS_TAP = {
    getStream: function () { var t = current(); return t ? t.dest.stream : null; },
    getAnalyser: function () { var t = current(); return t ? t.analyser : null; },
    getContext: function () { var t = current(); return t ? t.ctx : null; },
    isActive: function () { var t = current(); return !!(t && t.ctx.state === 'running' && t.sources > 0); },
    setGain: function (g) { var t = current(); if (t) t.gain.gain.value = isFinite(g) && g > 0 ? g : 1; },
    /* Keep a (silent) processing node running: connect it to the speakers WITHOUT copying it back into the tap. */
    sink: function (node) { var t = current(); if (t) nativeConnect.call(node, t.ctx.destination); }
  };
})();
