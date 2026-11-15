/* ORBEATS Explore page: dataset picker, viewer, "What am I hearing?" strip,
 * data catalog and the count-up numbers. All dataset facts and wording come
 * from js/data.js. The two interactive experiences live in js/explore/.
 * Load after js/app.js.
 *
 * HOW THE SOUND IS WIRED (nothing in js/app.js was changed):
 *   ORBEATS.playDataset(id) pauses the Caldwell music, marks the dataset as
 *   playing and asks window.ORBEATS_seriesSound for the sound. This file
 *   supplies that function. It starts the dataset's video (with its own
 *   soundtrack) or its interactive experience and hands back
 *   { position, setVolume, stop }. ORBEATS.stopDataset(), the Audio switch
 *   and the now-playing bar then all work as they do everywhere else, and
 *   the music comes back only if sound is still on.
 */
(function () {
  'use strict';

  var ORBEATS = window.ORBEATS;
  var DATA = window.ORBEATS_DATA;
  var datasets = ORBEATS.datasets;
  var formats = DATA.formats || {};
  var SPEEDS = [1, 1.5, 2, 0.5];      // the speed button steps through these

  var selected = datasets[0];         // the dataset shown in the viewer
  var view = 0;                       // which of its views (only GEDI has two)
  var speed = 1;
  var volume = 1;                     // the viewer's own volume, 0 to 1
  var boost = null;                   // lifts her Web Audio sounds above the quiet music level (see exploreLevel)
  var NO_SOUND = '[No sound provided for this dataset yet]';
  var offset = 0;                     // where in the video to start, 0 to 1
  var dragging = false;               // is the visitor moving the scrub slider?
  var firstPick = true;               // only the first dataset is preloaded
  var experiences = {};               // 'ocean' / 'aerosols' -> the running experience
  var pending = {};                   // an experience that is still starting
  var stopping = false;               // true while we are the ones stopping an experience

  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function $(sel) { return document.querySelector(sel); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(n) { return Math.max(0, Math.min(1, n)); }
  function fmt(t) { t = isFinite(t) ? t : 0; return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }

  var clip = $('[data-ob-clip]');

  /* The text and media on screen: the dataset, or the chosen view of it. */
  function cur() { return (selected.views && selected.views[view]) || selected; }
  function format(d) { return formats[d.format] || formats.music || { label: '', action: 'Open' }; }
  function npTitle() { return selected.views ? selected.title + ' · ' + cur().label : selected.title; }
  function npCaption() { return selected.views ? cur().listening : selected.caption; }
  /* The now-playing bar's volume, 0 to 1. Videos are plain elements, so we apply it ourselves. */
  function siteVolume() { var i = $('[data-ob-volume]'); return i ? i.value / 100 : 1; }
  /* LOUDNESS. The now-playing volume starts at 12%, which suits background music but
   * made her videos nearly silent and her Web Audio tones inaudible. Explore sounds are
   * the main thing on screen, so they follow the same slider on a gentler curve
   * (cube root): 12% on the slider gives about half volume, 100% gives full, 0 is silent. */
  function exploreLevel() { return Math.cbrt(siteVolume()); }
  function applyClipVolume() {
    if (clip && !selected.reference) clip.volume = clamp(volume * exploreLevel());
    /* Her Web Audio sounds pass through the site's master (which already applies the
     * slider and the Audio switch), so the boost is the difference between the two curves. */
    var v = siteVolume();
    if (boost) boost.gain.value = v > 0 ? exploreLevel() / v : 0;
  }
  /* The shared AudioContext, with the boost in front of the site's master volume. */
  function exploreAudio() {
    var a = ORBEATS.getAudio(); if (!a) return null;
    if (!boost) { boost = a.context.createGain(); boost.connect(a.output); }
    applyClipVolume();
    return { context: a.context, output: boost };
  }
  /* Does this dataset (or view) have a sound made by Reem or NASA? */
  function hasSound(d, c) { return !!(d.reference || d.interactive || (c && c.media)); }

  /* What the Play button says for a dataset. */
  function playLabel(d) {
    if (d.reference) return 'Play the real sonification: ' + d.title;
    if (d.interactive) return 'Play the sound of ' + d.title;
    return 'Play the video and sound of ' + d.title;
  }
  function tag(d) { return d.reference ? '<span class="ob-tag">Reference</span>' : ''; }
  function sourceLabel(d) { return 'Source page for ' + esc(d.title) + ' (opens in a new tab)'; }

  function rowLabel(d) { return hasSound(d, d.views ? d.views[0] : d) ? d.soundSource.label : NO_SOUND; }

  /* ---------- read aloud: the descriptions under the video, spoken by the browser's own voice ---------- */
  var reading = false;
  function readButtons(on) {
    reading = on;
    $$('[data-ex-read]').forEach(function (b) {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.textContent = on ? 'Stop reading' : 'Read the description aloud';
    });
  }
  function stopReading() {
    if (!reading) return;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    readButtons(false);
  }
  function readAloud() {
    if (reading) { stopReading(); return; }
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { ORBEATS.announce('Reading aloud is not available in this browser.'); return; }
    var d = selected, c = cur();
    /* The dataset's own sound would talk over the voice, so it stops first. */
    if (ORBEATS.playing === d.id && !d.reference) ORBEATS.stopDataset();
    var parts = [d.title + '.', c.intro, 'What you are exploring. ' + c.seeing, 'Listening guide. ' + (c.listening || d.listening), 'Why it matters. ' + c.why];
    window.speechSynthesis.cancel();
    readButtons(true);
    parts.forEach(function (t, i) {
      var u = new SpeechSynthesisUtterance(t);
      u.lang = 'en-US'; u.rate = 0.95;
      if (i === parts.length - 1) u.onend = function () { readButtons(false); };
      u.onerror = function () { readButtons(false); };
      window.speechSynthesis.speak(u);
    });
  }
  window.addEventListener('pagehide', function () { if (window.speechSynthesis) window.speechSynthesis.cancel(); });

  /* ---------- markup ---------- */

  /* One catalog row: her picture, format, title, intro, where the sound comes from, source link, Open and Play. */
  function rowHtml(d) {
    var f = format(d);
    return '<li class="ob-row ex-row" data-format="' + esc(d.format || 'music') + '">' +
      '<span class="ex-thumb" aria-hidden="true">' + (d.thumb ? '<img src="' + esc(d.thumb) + '" alt="" loading="lazy" decoding="async" width="96" height="64">' : '') + '</span>' +
      '<div class="ob-row__main"><span class="ob-label">' + esc(f.label) + ' · ' + esc(d.category) + ' · ' + esc(d.period) + '</span>' +
      '<h3 class="ob-h3">' + esc(d.title) + '</h3><p class="ob-small">' + esc(d.intro) + '</p>' +
      (rowLabel(d) ? '<p class="ob-caption">' + esc(rowLabel(d)) + '</p>' : '') +
      '<button class="ob-btn ob-btn--quiet ex-open" type="button" data-ob-open="' + d.id + '" aria-label="' + esc(f.action + ': ' + d.title) + '">' + esc(f.action) + ' <span aria-hidden="true">→</span></button></div>' +
      '<div class="ob-row__meta"><span class="ob-label">SVS ' + d.id + tag(d) + '</span>' +
      '<span class="ob-caption">' + esc(d.nasaTitle) + '</span>' +
      '<span class="ob-caption">Released ' + esc(d.released) + '</span>' +
      '<a class="ob-link" href="' + d.url + '" target="_blank" rel="noopener" aria-label="' + sourceLabel(d) + '">Source page</a></div>' +
      '<button class="ob-play" type="button" aria-pressed="false" data-ob-play="' + d.id + '" aria-label="' + esc(playLabel(d)) + '"></button></li>';
  }
  /* One line in the dataset picker. */
  function pickHtml(d) {
    return '<li><button class="ob-pick" type="button" data-ob-pick="' + d.id + '"><span class="ob-label">' + esc(format(d).label) + ' · ' + esc(d.category) + tag(d) + '</span>' +
      '<span>' + esc(d.title) + '</span></button>' +
      '<a class="ob-link" href="' + d.url + '" target="_blank" rel="noopener" aria-label="' + sourceLabel(d) + '">Source</a></li>';
  }

  /* Numbers that count up when they scroll into view. */
  function countUp(el) {
    var raw = el.getAttribute('data-ob-count');
    var target = raw === 'catalog' ? datasets.filter(function (d) { return !d.reference; }).length : parseFloat(raw);
    var dec = +el.getAttribute('data-decimals') || 0;
    el.textContent = target.toFixed(dec);
    if (ORBEATS.settings.reducedMotion || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      var t0 = performance.now(), dur = 1800;
      (function tick(now) {
        var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = (target * e).toFixed(dec);
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    }, { threshold: 0.6 });
    io.observe(el);
  }

  /* ---------- the interactive experiences (js/explore/ocean.js, js/explore/aerosols.js) ---------- */

  function experience(kind) {
    if (experiences[kind]) return experiences[kind];
    var root = $('[data-ex-panel="' + kind + '"]');
    var make = window.ORBEATS_EXPLORE && window.ORBEATS_EXPLORE[kind];
    if (!root || !make) return null;
    var id = datasets.filter(function (d) { return d.interactive === kind; })[0].id;
    experiences[kind] = make(root, {
      audio: exploreAudio,
      /* Her own buttons start and stop the sound. Keep the site in step with them. */
      onState: function () {
        var ex = experiences[kind];
        if (stopping || !ex) return;
        var on = ex.isPlaying();
        if (on && ORBEATS.playing !== id) ORBEATS.playDataset(id, { volume: volume });
        else if (!on && !pending[kind] && ORBEATS.playing === id) ORBEATS.stopDataset();
      }
    });
    return experiences[kind];
  }

  function startInteractive(d) {
    var kind = d.interactive, ex = experience(kind);
    if (!ex) { ORBEATS.announce('This experience could not be loaded.'); return null; }
    if (!ex.isPlaying()) {
      if (kind === 'ocean') ex.toggle();
      else {
        pending[kind] = true;
        var done = function () { pending[kind] = false; };
        Promise.resolve(ex.start()).then(done, done);
      }
    }
    return {
      position: function () { return 0; },
      setVolume: function () {},                       // her panel has its own volume slider
      stop: function () {
        if (stopping) return;
        stopping = true;
        try { if (kind === 'ocean') ex.pause(); else ex.stop(); } finally { stopping = false; }
      }
    };
  }

  /* ---------- the video ---------- */

  function showError(on) {
    var p = $('[data-ex-error]'); if (!p) return;
    p.hidden = !on;
    p.textContent = on ? 'This video is not available yet. You can explore the science notes below or try another journey.' : '';
    if (on) ORBEATS.announce(p.textContent);
  }

  /* Point the <video> at the chosen dataset (or view). WebM first, MP4 as the fallback. */
  function loadClip(preload) {
    var m = cur().media; if (!clip || !m) return;
    var key = m.mp4 || m.webm;
    if (clip.getAttribute('data-key') === key) return;
    clip.pause();
    clip.setAttribute('data-key', key);
    var webm = m.webm ? '<source src="' + m.webm + '" type="video/webm">' : '';        // VP9 + Opus
    var mp4 = m.mp4 ? '<source src="' + m.mp4 + '" type="video/mp4">' : '';            // H.264 + AAC
    /* MP4 first: on some machines WebM/Opus video plays without sound. WebM stays as the fallback. */
    clip.innerHTML = (selected.reference ? webm + mp4 : mp4 + webm) +     // Caldwell is a silent picture here: the small WebM is enough
      (m.remote ? '<source src="' + m.remote + '" type="video/mp4">' : '');
    clip.preload = preload || 'metadata';
    if (m.poster) clip.poster = m.poster;
    clip.load();
  }

  function seekClip(fraction) {
    if (clip && clip.duration && isFinite(clip.duration)) { try { clip.currentTime = fraction * clip.duration; } catch (e) {} }
  }

  function startVideo(options) {
    var v = clip;
    if (!v || !cur().media) { ORBEATS.announce(NO_SOUND); return null; }
    loadClip('auto');
    showError(false);
    v.hidden = false; v.loop = false; v.muted = false;
    v.playbackRate = options.rate || 1;
    if (options.volume != null) volume = options.volume;
    applyClipVolume();
    var start = options.offset >= 0.995 ? 0 : (options.offset || 0);
    if (v.readyState >= 1) seekClip(start); else v.addEventListener('loadedmetadata', function () { seekClip(start); }, { once: true });
    v.onended = function () { offset = 0; setScrub(0); if (options.onEnd) options.onEnd(); };
    var id = selected.id;
    var p = v.play();
    if (p && p.catch) p.catch(function (err) {
      if (err && err.name === 'AbortError') return;      // paused again before it could start
      showError(true);
      if (ORBEATS.playing === id) ORBEATS.stopDataset();
    });
    return {
      position: function () { return v.duration ? v.currentTime / v.duration : start; },
      setVolume: function (x) { volume = x; applyClipVolume(); },
      stop: function () { v.pause(); }
    };
  }

  /* The plug that js/app.js calls from ORBEATS.playDataset (see the top of this file). */
  window.ORBEATS_seriesSound = function (d, ctx, output, options) {
    if (d !== selected) pick(d.id);
    stopReading();
    var handle = d.interactive ? startInteractive(d) : startVideo(options || {});
    if (handle) {
      ORBEATS.setNowPlaying(npTitle(), npCaption());
      ORBEATS.announce('Now playing: ' + npTitle() + '. ' + npCaption());
    }
    return handle;
  };

  /* ---------- the viewer ---------- */

  function text(sel, value) { $$(sel).forEach(function (el) { el.textContent = value; }); }

  /* Her sound guide table for a view: visual or sound cue, and what it means. */
  function guideHtml(c) {
    if (!c.soundMap) return '';
    return '<h4 class="ob-h3">' + esc(c.title) + '</h4><table class="ex-guide"><caption>Sound guide</caption>' +
      '<thead><tr><th scope="col">Visual / sound cue</th><th scope="col">Meaning / response</th></tr></thead><tbody>' +
      c.soundMap.map(function (pair) { return '<tr><td>' + esc(pair[0]) + '</td><td>' + esc(pair[1]) + '</td></tr>'; }).join('') +
      '</tbody></table>';
  }

  /* Fill in every text of the viewer for the selected dataset and view. */
  function render() {
    var d = selected, c = cur();
    text('[data-ob-now]', d.title);
    text('[data-ex-kicker]', format(d).label + ' · ' + d.category + ' · ' + d.period);
    text('[data-ob-desc]', c.intro);
    var label = hasSound(d, c) ? (c.soundSource || d.soundSource).label : NO_SOUND;
    text('[data-ex-sound]', label);
    $$('[data-ex-sound]').forEach(function (el) { el.hidden = !label; });
    stopReading();
    text('[data-ob-released]', 'NASA SVS ' + d.id + ': “' + d.nasaTitle + '”, released ' + d.released);
    text('[data-ex-see]', c.seeing);
    text('[data-ex-listen]', c.listening || d.listening);
    text('[data-ex-why]', c.why);
    text('[data-ob-caption="viewer"]', npCaption());
    $$('[data-ob-src]').forEach(function (a) { a.href = d.url; });
    $$('[data-ex-transcript]').forEach(function (a) { a.hidden = !d.transcriptUrl; if (d.transcriptUrl) a.href = d.transcriptUrl; });
    $$('[data-ex-guide]').forEach(function (el) { el.innerHTML = guideHtml(c); el.hidden = !c.soundMap; });
    $$('[data-ob-play="selected"]').forEach(function (b) { b.setAttribute('aria-label', playLabel(d)); });
    $$('[data-ex-views] button').forEach(function (b, i) { b.setAttribute('aria-pressed', i === view ? 'true' : 'false'); });

    var img = $('[data-ob-still]');
    if (img && !d.interactive) {
      img.alt = c.seeing;                                   // her description of what the picture shows
      img.src = (c.media && c.media.poster) || d.thumb || '';
    }
    if (clip) clip.setAttribute('aria-label', (c.title || d.title) + ': sonified video');
  }

  /* Show one dataset in the viewer. */
  function pick(id) {
    var d = ORBEATS.findDataset(id); if (!d) return;
    /* Leaving a dataset that is playing: stop it (the Caldwell music is left alone). */
    var playing = ORBEATS.playing !== null && ORBEATS.findDataset(ORBEATS.playing);
    if (playing && playing !== d && !playing.reference) ORBEATS.stopDataset();

    selected = d; view = 0; offset = 0;
    $$('.ob-pick').forEach(function (b) {
      if (+b.getAttribute('data-ob-pick') === d.id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });

    /* Her view buttons (GEDI: Maryland closeup, whole globe). */
    $$('[data-ex-views]').forEach(function (box) {
      box.hidden = !d.views;
      box.innerHTML = (d.views || []).map(function (v, i) {
        return '<button class="ob-btn" type="button" data-ex-view="' + i + '" aria-pressed="' + (i === 0) + '">' + esc(v.label) + '</button>';
      }).join('');
    });

    /* A video dataset shows the stage and its controls; an interactive one shows her own panel. */
    $$('[data-ex-player]').forEach(function (el) { el.hidden = !!d.interactive; });
    Object.keys(experiences).forEach(function (kind) { if (kind !== d.interactive) experiences[kind].close(); });
    $$('[data-ex-panel]').forEach(function (el) { if (el.getAttribute('data-ex-panel') !== d.interactive) el.hidden = true; });
    if (d.interactive) { var ex = experience(d.interactive); if (ex) ex.open(); }

    showError(false);
    if (clip) {
      clip.pause(); clip.hidden = true;
      if (!d.interactive) loadClip(firstPick ? 'auto' : 'metadata');
    }
    firstPick = false;
    /* The reference entry is the site's continuous music, so no scrub or speed. */
    $$('[data-ob-scrub], [data-ob-speed], [data-ob-dataset-volume]').forEach(function (el) { el.disabled = !!d.reference; });
    render();
    setScrub(0);
    sync();
  }

  /* Switch between the views of one dataset. Each view has its own video and guide. */
  function showView(index, autoplay) {
    if (!selected.views || !selected.views[index]) return;
    if (ORBEATS.playing === selected.id) ORBEATS.stopDataset();
    view = index; offset = 0;
    if (clip) { clip.pause(); clip.hidden = true; }
    loadClip('metadata');
    showError(false);
    render();
    setScrub(0);
    if (autoplay) play(selected);
  }

  function setScrub(fraction) {
    var s = $('[data-ob-scrub]'); if (!s) return;
    s.value = Math.round(fraction * 1000);
    var total = clip && isFinite(clip.duration) ? clip.duration : 0;
    s.setAttribute('aria-valuetext', total && !selected.reference ? fmt(fraction * total) + ' of ' + fmt(total) : Math.round(fraction * 100) + ' percent');
    s.style.setProperty('--ob-fill', (fraction * 100) + '%');
    text('[data-ex-time]', total && !selected.reference ? fmt(fraction * total) + ' / ' + fmt(total) : '');
  }

  /* Start the selected dataset with the viewer's speed, volume and position. */
  function play(d) {
    if (d !== selected) pick(d.id);
    ORBEATS.playDataset(d.id, { offset: offset, rate: speed, volume: volume });
  }
  function toggle(d) {
    if (ORBEATS.playing === d.id) {
      if (d.reference) ORBEATS.setAudio(false); else ORBEATS.stopDataset();
    } else play(d);
  }

  /* Make every button and the viewer match what is playing. */
  function sync() {
    var playingId = ORBEATS.settings.audio ? ORBEATS.playing : null;
    var here = playingId === selected.id;                         // is the viewer's dataset playing?
    $$('[data-ob-play]').forEach(function (b) {
      var id = b.getAttribute('data-ob-play');
      b.setAttribute('aria-pressed', (id === 'selected' ? here : +id === playingId) ? 'true' : 'false');
    });
    /* Caldwell 73: the sound is the site's music; the viewer shows the silent picture in step with it. */
    if (clip && selected.reference) {
      clip.muted = true; clip.loop = true;
      if (here && clip.hidden) {
        var m = document.getElementById('site-music');
        clip.hidden = false;
        if (m && clip.duration) seekClip((m.currentTime % clip.duration) / clip.duration);
      }
      if (here) { var p = clip.play(); if (p && p.catch) p.catch(function () {}); } else { clip.pause(); clip.hidden = true; }
    }
    var stage = $('.ob-stage'); if (stage) stage.classList.toggle('is-playing', here);
  }

  /* While a video plays, move the scrub slider along with it. */
  function follow() {
    var s = ORBEATS.sound;
    if (s && ORBEATS.playing === selected.id && !dragging && !selected.interactive) { offset = s.position(); setScrub(offset); }
    requestAnimationFrame(follow);
  }

  /* Her format filter for the catalog. */
  function applyFilter(chosen) {
    var count = 0;
    $$('[data-ob-catalog] .ob-row').forEach(function (row) {
      var visible = chosen === 'all' || row.getAttribute('data-format') === chosen;
      row.hidden = !visible;
      if (visible) count++;
    });
    $$('[data-ex-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ex-filter') === chosen)); });
    var name = chosen === 'all' ? 'All experiences' : formats[chosen].label;
    text('[data-ex-results]', name + ': ' + count + ' experience' + (count === 1 ? '' : 's') + ' showing.');
  }

  /* ---------- start ---------- */

  $$('[data-ob-catalog]').forEach(function (ul) {
    var ids = ul.getAttribute('data-ids');     // optional: show only some rows (used on components.html)
    var list = ids ? datasets.filter(function (d) { return (',' + ids + ',').indexOf(',' + d.id + ',') > -1; }) : datasets;
    ul.innerHTML = list.map(rowHtml).join('');
  });
  $$('[data-ob-picker]').forEach(function (ul) { ul.innerHTML = datasets.map(pickHtml).join(''); });
  ORBEATS.render(document);                    // adds the play icons to the new buttons
  $$('[data-ob-count]').forEach(countUp);
  if ($('[data-ex-filter]')) applyFilter('all');

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : e.target.parentElement; if (!t) return;
    var d;
    var pk = t.closest('[data-ob-pick]');
    if (pk) {
      d = ORBEATS.findDataset(pk.getAttribute('data-ob-pick'));
      var wasPlaying = ORBEATS.playing !== null;
      pick(d.id);
      if (wasPlaying && !d.interactive) play(d);   // already listening: switch to the new one
      return;
    }
    /* A catalog row's "Watch & listen" button: open the dataset in the viewer, as her cards did. */
    var op = t.closest('[data-ob-open]');
    if (op) {
      d = ORBEATS.findDataset(op.getAttribute('data-ob-open'));
      pick(d.id);
      var target = document.getElementById('data'), title = $('[data-ob-now]');
      if (target) target.scrollIntoView({ behavior: ORBEATS.settings.reducedMotion ? 'auto' : 'smooth', block: 'start' });
      if (title) title.focus({ preventScroll: true });
      if (!d.interactive) play(d);
      else ORBEATS.announce(d.title + ' is open. ' + d.caption);
      return;
    }
    var pl = t.closest('[data-ob-play]');
    if (pl) {
      var id = pl.getAttribute('data-ob-play');
      toggle(id === 'selected' ? selected : ORBEATS.findDataset(id));
      return;
    }
    if (t.closest('[data-ex-read]')) { readAloud(); return; }
    var vw = t.closest('[data-ex-view]');
    if (vw) { showView(+vw.getAttribute('data-ex-view'), true); return; }
    var fl = t.closest('[data-ex-filter]');
    if (fl) { applyFilter(fl.getAttribute('data-ex-filter')); return; }
    if (t.closest('[data-ex-fullscreen]')) {
      var box = $('[data-ex-main]');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (box && box.requestFullscreen) box.requestFullscreen().catch(function () {});
      return;
    }
    if (clip && t === clip && !selected.reference) { toggle(selected); return; }   // tap the picture to play or pause
    var sp = t.closest('[data-ob-speed]');
    if (sp) {
      speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
      sp.textContent = speed + '×';
      sp.setAttribute('aria-label', 'Playback speed: ' + speed + ' times. Press to change.');
      if (clip) clip.playbackRate = speed;
    }
  });

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-ob-scrub')) { dragging = true; offset = t.value / 1000; setScrub(offset); if (!selected.reference) seekClip(offset); }
    if (t.hasAttribute('data-ob-dataset-volume')) { volume = t.value / 100; if (ORBEATS.sound) ORBEATS.sound.setVolume(volume); else applyClipVolume(); }
    if (t.hasAttribute('data-ob-volume')) applyClipVolume();       // the now-playing bar's volume
  });
  document.addEventListener('change', function (e) {
    if (e.target.hasAttribute('data-ob-scrub')) dragging = false;
  });
  document.addEventListener('fullscreenchange', function () {
    $$('[data-ex-fullscreen]').forEach(function (b) { b.textContent = document.fullscreenElement ? 'Exit full display' : 'Fill display ↗'; });
  });
  /* A <source> that fails does not bubble; if none of them works, say so. */
  if (clip) clip.addEventListener('error', function () {
    setTimeout(function () { if (clip.networkState === 3 && !selected.interactive && !selected.reference) showError(true); }, 0);
  }, true);

  document.addEventListener('orbeats:dataset', function (e) {
    sync();
    /* A dataset stopped: give the now-playing bar back to the music (unless another one just started). */
    if (e.detail && !e.detail.playing) setTimeout(function () {
      var now = ORBEATS.playing !== null && ORBEATS.findDataset(ORBEATS.playing);
      if (!now || now.reference) ORBEATS.setNowPlaying(null);
    }, 0);
  });
  document.addEventListener('orbeats:play', sync);

  if ($('[data-ob-now]')) { pick(datasets[0].id); requestAnimationFrame(follow); }
})();
