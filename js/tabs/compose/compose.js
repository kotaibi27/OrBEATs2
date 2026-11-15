/* COMPOSE TAB: Planet Opera.
 * Builds the page markup, then runs the lab (js/tabs/compose/compose-lab.js, built from src/p1..p7)
 * inside the Compose mount box. The site's own header, Text size, Contrast, Audio, Captions,
 * Volume and now-playing bar are used; this file adds only the Earth, the controls and the dashboard.
 * Load order on compose.html: vendor/three/three.bundle.js, compose-lab.js, then this file. */
(function () {
  'use strict';
  var ORBEATS = window.ORBEATS;

  var NOTE = 'A living globe wrapped in flowing light. Each variable changes a visual layer and a musical voice.';

  function markup() {
    return '' +
    '<div class="po">' +
      '<div class="po__canvas">' +
        '<canvas id="universe" role="img" aria-label="Interactive three dimensional Earth made from NASA imagery, wrapped in luminous flowing strands, with the Moon in orbit. When you move a variable, musical notes travel from that control to the region of Earth it describes. Drag to rotate Earth; use the controls to change its layers and music."></canvas>' +
        '<div id="labels-layer"></div>' +
        '<div class="po-launch" id="launch"><h2 class="ob-h3">Play the Earth.</h2>' +
          '<p class="ob-small">Every control you move sends its notes to Earth.<br>Your controls compose the music.</p>' +
          '<button class="ob-btn ob-btn--primary ob-btn--lg" id="start" type="button">▶ Play music</button></div>' +
      '</div>' +

      '<aside class="po-dash" id="dash" aria-label="What is happening on Earth">' +
        '<div class="dash-top"><div><p class="ob-label">Live dashboard</p><h2 class="ob-h3">What’s happening</h2></div>' +
        '<button class="ob-btn ob-btn--quiet" id="dash-toggle" type="button" aria-expanded="true">Hide</button></div>' +
        '<div class="dlast" id="dash-last"><p class="ob-label">Last change</p><div class="dtitle">Nothing yet</div><p>Move any slider on the right. This box tells you, in plain words, what changes on Earth and in the music.</p></div>' +
        '<div class="drows" id="dash-rows"></div>' +
        '<p class="dfoot">Bars are creative levels, 0–100. Drag Earth to rotate it. Tap Earth to play a note.</p>' +
      '</aside>' +

      '<section class="po-panel" id="controls" aria-label="Earth variables and visual effects" tabindex="-1">' +
        '<div class="po-transport">' +
          '<button class="ob-play ob-play--sm" id="play" type="button" aria-pressed="false" aria-label="Play music">▶</button>' +
          '<div><p class="ob-label" id="music-state" role="status">Ready to play</p><p class="ob-caption" id="score-state">Eight variables · four musical voices</p></div>' +
        '</div>' +
        '<p class="ob-label po-title">Explore the layers</p>' +
        '<label for="chapter" class="ob-sr">Choose an Earth scene</label>' +
        '<select id="chapter"><option value="all">Living Earth · all systems</option><option value="ocean">Ocean currents &amp; temperature</option><option value="deep">Perpetual Ocean · deep flows</option><option value="aerosols">Aerosols in motion</option><option value="air">Air quality</option><option value="carbon">Carbon dioxide</option><option value="water">Atmospheric rivers</option><option value="forest">Forest height</option><option value="night">Earth at night</option></select>' +
        '<p id="chapter-note" class="ob-caption">' + NOTE + '</p>' +
        '<div class="variables" id="variables"></div>' +
        '<div class="layer-list"><label><input id="threads" type="checkbox" checked>Flowing strands</label><label><input id="particles" type="checkbox" checked>Traveling particles</label><label><input id="glow" type="checkbox" checked>Atmosphere glow</label><label><input id="labels" type="checkbox" checked>Region labels</label><label><input id="spin" type="checkbox" checked>Auto rotation</label><label><input id="notes" type="checkbox" checked>Flying notes</label><label><input id="follow" type="checkbox" checked>Earth turns to notes</label><label><input id="cycle" type="checkbox" checked>Day–night cycle</label></div>' +
        '<div class="visual-controls"><button class="ob-btn" id="reset" type="button">Reset Earth</button><button class="ob-btn tog" id="motion" type="button" aria-pressed="false">Reduce motion</button><button class="ob-btn" id="describe" type="button">Describe scene</button><button class="ob-btn tog" id="voice" type="button" aria-pressed="false">Voice: off</button><button class="ob-btn" id="zoom-out" type="button">Zoom out −</button><button class="ob-btn" id="zoom-in" type="button">Zoom in +</button><button class="ob-btn" id="sources" type="button">NASA sources</button><button class="ob-btn" id="fullscreen" type="button">Full screen</button></div>' +
        '<p class="under-controls ob-caption">Drag Earth to rotate · scroll or pinch to zoom · tap Earth to play a note<br>Values are creative levels, 0–100; they are not live NASA measurements. Flowing strands interpret Earth processes.</p>' +
      '</section>' +

      /* The site's now-playing bar shows the scene name and caption; the lab also writes them here, for screen readers. */
      '<span class="ob-sr" id="scene-name">Living Earth</span><span class="ob-sr" id="caption">Press play, then move a variable to hear what it does.</span>' +
      '<div class="ob-sr" id="feedback" aria-hidden="true"></div><div class="ob-sr" id="announcement" role="status" aria-live="polite" aria-atomic="true"></div>' +
      '<div class="ob-sr" id="meter" aria-hidden="true"></div>' +

      '<dialog id="source-dialog" aria-labelledby="source-title"><div class="dialog-head"><div><p class="ob-label">The science behind the experience</p><h2 class="ob-h3" id="source-title">NASA source collection</h2></div><button class="ob-btn" id="close-sources" type="button">Close</button></div>' +
        '<p>Only the base Earth imagery is NASA-derived: the globe uses NASA Blue Marble and Black Marble imagery (from the open-source three-globe example set), served from this site. The strands, surface effects, clouds, Moon and music are creative interpretations, not live NASA measurements. The original NASA visuals below retain their scientific context. The music is generated from your controls, not extracted from NASA datasets.</p>' +
        '<div class="source-grid" id="source-grid"></div>' +
        '<p class="source-foot">Collection: <a href="https://svs.gsfc.nasa.gov/gallery/earth-information-center/" target="_blank" rel="noopener">NASA Earth Information Center</a>. Original media needs an internet connection. The interactive scene and its music run locally.</p></dialog>' +
    '</div>';
  }

  var host = null;

  function mount(container) {
    host = container;
    container.innerHTML = markup();
    if (!window.THREE) { container.querySelector('#launch').innerHTML = '<p class="ob-small">The 3D library could not be loaded. Reload the page to try again.</p>'; return; }
    try { window.ORBEATS_COMPOSE(container, ORBEATS); }
    catch (e) { if (!/WebGL 2/.test(String(e && e.message))) console.error(e); }   // no WebGL 2: the lab shows its own message and the music still works
  }

  function unmount() {
    if (host && host.__poStop) host.__poStop();   // stops the music, the animation loop and all listeners
    host = null;
  }

  /* Coming back with the Back button restores a frozen copy of the page: start fresh instead. */
  window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });

  ORBEATS.registerTab('compose', { mount: mount, unmount: unmount });
})();
