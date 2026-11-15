/* MATCH THE MELODY: settings.
 *
 * This is the file to edit when you want to change the game.
 * The four sound controls and the NASA variable each one stands for are in
 * `controls` below. Words are relative on purpose ("warmer", "more"): the game
 * does not use or show any NASA numbers.
 */
window.ORBEATS_PLAY_CONFIG = {
  title: 'Match the Melody',
  rounds: 5,              // rounds in one game
  notes: 8,               // notes in one tune
  speakFeedback: true,    // read the feedback aloud with the browser's voice

  /* The "How to play" card (shown before the game starts). */
  howTo: [
    'Listen to the mystery tune.',
    'Now match it. Change pitch, speed, loudness and brightness until yours sounds the same.',
    'Lock in your answer to get a score. Play 5 rounds.'
  ],
  howToMode: {
    camera: 'Open hand to steer. Point to replay the tune. Pinch to lock in.',
    keys: 'Drag the sliders. Press Enter to lock in.',
    touch: 'Slide the bars. Tap Lock in.'
  },

  /* The four controls. Every control is a value from 0 (low) to 1 (high).
   *   key      the name used in the code (do not change)
   *   label    the name of the sound control
   *   plain    a few plain words for it, shown next to the name
   *   svs      NASA SVS page number; the source link is built from it
   *   dataset  short name of the NASA visualization
   *   variable the NASA variable this control stands for
   *   low/high the relative words for the two ends
   *   tooHigh/tooLow  feedback after lock in */
  controls: [
    { key: 'pitch', label: 'Pitch', plain: 'how high', svs: 3912, dataset: 'Global Sea Surface Currents and Temperature',
      variable: 'sea surface temperature', low: 'cooler sea, lower notes', high: 'warmer sea, higher notes',
      tooHigh: 'Pitch is too high.', tooLow: 'Pitch is too low.' },
    { key: 'tempo', label: 'Tempo', plain: 'how fast', svs: 5011, dataset: 'Lightning Events Detected from the ISS',
      variable: 'lightning flash rate', low: 'less lightning, slower beat', high: 'more lightning, faster beat',
      tooHigh: 'Tempo is too fast.', tooLow: 'Tempo is too slow.' },
    { key: 'loudness', label: 'Loudness', plain: 'how loud', svs: 5669, dataset: 'GEOS Aerosols',
      variable: 'aerosol amount', low: 'less aerosol, quieter', high: 'more aerosol, louder',
      tooHigh: 'It is too loud.', tooLow: 'It is too quiet.' },
    { key: 'brightness', label: 'Brightness', plain: 'how sharp', svs: 5533, dataset: 'Air Quality Model Runs',
      variable: 'air quality', low: 'hazier air, darker tone', high: 'clearer air, brighter tone',
      tooHigh: 'The tone is too bright.', tooLow: 'The tone is too dark.' }
  ],

  /* Sound. */
  scale: [0, 2, 4, 7, 9],     // pentatonic scale, in semitones: pitch always snaps to it
  baseNote: 196,              // lowest note, in hertz
  pitchSteps: 8,              // how many scale steps the Pitch control can move the tune
  slowBeat: 0.52,             // seconds per note at the slowest tempo
  fastBeat: 0.17,             // seconds per note at the fastest tempo
  quiet: 0.07,                // volume at the quietest
  loud: 0.6,                  // volume at the loudest
  dark: 350,                  // filter frequency (hertz) at the darkest tone
  bright: 6500,               // filter frequency at the brightest tone

  /* Scoring. A control scores 100 inside `perfect` and falls to 0 at `range`
   * (both are distances on the 0..1 control). Relaxed mode is more forgiving. */
  scoring: { perfect: 0.05, range: 0.5 },
  relaxed: { perfect: 0.1, range: 0.8 },

  /* Keyboard steps. */
  step: 0.02, bigStep: 0.1,

  /* Camera. */
  camera: {
    calibrateSeconds: 5,
    neutralY: 0.55,           // chest height before calibration (0 = top, 1 = bottom)
    deadZone: 0.06,           // half the height of the neutral band
    smooth: 0.25,             // 0..1: smaller = smoother but slower
    extOn: 1.12, extOff: 1.0,        // a finger counts as extended when its tip is this much farther from the wrist than its middle joint (on / off, so it does not flicker)
    thumbUp: 0.45,                   // how far above the fingertips the thumb must point for a thumbs up
    stableFrames: 3,                 // a pose must be seen this many frames in a row
    pinchOn: 0.3, pinchOff: 0.5,     // hysteresis for "pinch" (thumb to index, compared to the palm)
    pinchHold: 1,                    // seconds to hold each gesture before it fires
    pointHold: 0.4, peaceHold: 0.4, thumbHold: 0.6,
    cooldown: 1.5,                   // seconds with no gestures after one fires
    practiceSeconds: 4,              // time for each gesture in the practice (4 gestures)
    swapHands: false          // set true if left and right are the wrong way round on your camera
  }
};
