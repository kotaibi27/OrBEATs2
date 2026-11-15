/* ORBEATS Explore: the interactive ocean experience (SVS 3912).
 *
 * Written by Reem (her js/ocean-experience.js). The sound logic,
 * the calibrated color key, the wording and the controls are hers, unchanged.
 * Only the wiring was adapted for this site:
 *   - wrapped in a function scope and exposed as ORBEATS_EXPLORE.ocean(root, host)
 *   - the notes play through the site's shared AudioContext (host.audio()), so the
 *     Audio switch, the now-playing volume and the level meter all apply
 *   - host.onState() tells js/explore.js when playback starts or stops
 */
(function () {
"use strict";
window.ORBEATS_EXPLORE = window.ORBEATS_EXPLORE || {};
window.ORBEATS_EXPLORE.ocean = function (root, host) {

  // Calibrated from the temperature legend in ocean-interactive.mp4.
  // This avoids reading an incorrect color key from a startup frame.
  const TEMPERATURE_COLORS = [
    [0.161022,0.416933,1],[0.167934,0.421736,1],
    [0.162512,0.441243,1],[0.166559,0.447487,1],
    [0.163756,0.476442,1],[0.169663,0.478261,1],
    [0.143866,0.516303,1],[0.154533,0.523163,1],
    [0.140609,0.541011,1],[0.148259,0.54461,1],
    [0.157222,0.588459,1],[0.165463,0.590299,1],
    [0.180556,0.634259,1],[0.18491,0.636203,1],
    [0.176971,0.687153,1],[0.181885,0.689249,1],
    [0.196929,0.74357,1],[0.205693,0.748008,1],
    [0.208317,0.802879,1],[0.205776,0.802246,1],
    [0.189109,0.863656,1],[0.205553,0.863241,1],
    [0.206721,0.907699,1],[0.213834,0.908899,1],
    [0.224935,0.965126,1],[0.230203,0.966681,1],
    [0.217014,1,0.964844],[0.22088,1,0.964625],
    [0.207781,1,0.899102],[0.212495,1,0.900977],
    [0.210154,1,0.851852],[0.218017,1,0.856026],
    [0.204961,1,0.826759],[0.212535,1,0.828847],
    [0.213018,1,0.77002],[0.218039,1,0.772549],
    [0.212471,1,0.712471],[0.215979,1,0.71445],
    [0.208491,1,0.690296],[0.216817,1,0.692308],
    [0.215288,1,0.631832],[0.219897,1,0.634361],
    [0.213406,1,0.577899],[0.223923,1,0.582414],
    [0.20798,1,0.553319],[0.208818,1,0.554145],
    [0.203289,1,0.53254],[0.206189,1,0.53338],
    [0.207931,1,0.497241],[0.208477,1,0.497588],
    [0.203285,1,0.433607],[0.203285,1,0.433607],
    [0.193306,1,0.408811],[0.193306,1,0.408811],
    [0.203072,1,0.401706],[0.203072,1,0.401706],
    [0.212235,1,0.392344],[0.212235,1,0.392344],
    [0.21702,1,0.344839],[0.21702,1,0.344839],
    [0.235133,1,0.302461],[0.237398,1,0.307221],
    [0.270105,1,0.275195],[0.272481,1,0.279243],
    [0.306358,1,0.255695],[0.306122,1,0.255442],
    [0.338377,1,0.231774],[0.347411,1,0.240123],
    [0.395538,1,0.218729],[0.403743,1,0.228944],
    [0.458432,1,0.200606],[0.460248,1,0.203287],
    [0.518109,1,0.178404],[0.520374,1,0.181697],
    [0.594504,1,0.149464],[0.595922,1,0.152406],
    [0.64995,1,0.138415],[0.654165,1,0.145702],
    [0.701264,1,0.125083],[0.703765,1,0.1321],
    [0.751161,1,0.106503],[0.751887,1,0.114211],
    [0.82293,1,0.11498],[0.823396,1,0.126377],
    [0.884142,1,0.126214],[0.885484,1,0.129677],
    [0.945832,1,0.097957],[0.947232,1,0.100032],
    [0.989945,1,0.089199],[0.989433,1,0.099584],
    [1,0.970865,0.100877],[1,0.970791,0.09799],
    [1,0.948655,0.093102],[1,0.949262,0.099016],
    [1,0.941896,0.098777],[1,0.939515,0.092723],
    [1,0.922604,0.09613],[1,0.922886,0.089192],
    [1,0.881868,0.113858],[1,0.878545,0.104809],
    [1,0.843465,0.104863],[1,0.838779,0.091554],
    [1,0.801887,0.079428],[1,0.795855,0.062481],
    [1,0.759158,0.061966],[1,0.756083,0.052356],
    [1,0.702262,0.085671],[1,0.684873,0.057073],
    [1,0.635017,0.079226],[1,0.628589,0.066585],
    [1,0.594979,0.082577],[1,0.586448,0.072318],
    [1,0.54485,0.086379],[1,0.526187,0.061256],
    [1,0.484574,0.08288],[1,0.46978,0.065934],
    [1,0.431866,0.082549],[1,0.412917,0.0603],
    [1,0.375,0.083942],[1,0.34757,0.052925],
    [1,0.303326,0.078425],[1,0.286468,0.056797],
    [1,0.227521,0.080802],[1,0.193874,0.042943],
    [1,0.136927,0.057931],[1,0.121643,0.038863],
    [1,0.096531,0.097134],[1,0.098341,0.098944]
  ];

  const MUSIC = {
    baseFrequency: 130.8128,
    octaves: 3,
    noteIntervalMs: 320,
    harpWaveform: "triangle",
    arpeggioRatios: [1, 1.25, 1.5, 2, 1.5, 1.25, 1.125, 1.5],
    chordRatios: [0.5, 0.625, 0.75]
  };

  const $ = id => root.querySelector("#ocean-" + id);

  const v = $("video");
  const overlay = $("overlay");
  const o = overlay.getContext("2d");
  const graph = $("graph");
  const g = graph.getContext("2d");

  const sample = document.createElement("canvas");
  sample.width = 960;
  sample.height = 540;

  const s = sample.getContext("2d", {
    willReadFrequently: true
  });

  const presets = {
    atlantic: [300 / 960, 180 / 540, 130 / 960, 60 / 540],
    pacific: [0.025, 0.425, 0.19, 0.11],
    indian: [0.64, 0.43, 0.13, 0.14],
    southern: [0.12, 0.73, 0.70, 0.09]
  };

  let active = false;
  let timers = [];
  let playbackRequest = 0;
  const voices = new Set();

  // The toolbar Audio button represents play/pause during a journey.
  // Do not interpret its paused state as a separate mute setting.
  let mediaPromise = null;
  let mediaError = "";
  let analysisError = "";
  let audioError = "";

  const localFile =
    window.location && window.location.protocol === "file:";

  let rect = presets.atlantic.slice();
  let history = new Map();
  let estimate = null;
  let lastSample = -1;
  let drag = null;
  let ctx = null;
  let master = null;
  let ready = false;
  let lastAnnounce = 0;

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const fmt = t =>
    Math.floor(t / 60) +
    ":" +
    String(Math.floor(t % 60)).padStart(2, "0");

  function loadMedia() {
    if (mediaPromise) return mediaPromise;

    mediaPromise = (async () => {
      if (localFile) {
        // Local-file fallback from the previous update.
        // When using localhost, the separate MP4 is used instead.
        if (!window.ORBEATS_OCEAN_VIDEO_BASE64) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "js/ocean-media.js";
            script.onload = resolve;
            script.onerror = () => reject(new Error(
              "The local ocean media helper could not load. " +
              "Copy js/ocean-media.js into the website, " +
              "or open the website through a local web server."
            ));
            document.head.appendChild(script);
          });
        }

        const raw = atob(window.ORBEATS_OCEAN_VIDEO_BASE64);
        const bytes = new Uint8Array(raw.length);

        for (let i = 0; i < raw.length; i++) {
          bytes[i] = raw.charCodeAt(i);
        }

        v.src = URL.createObjectURL(
          new Blob([bytes], { type: "video/mp4" })
        );
      } else {
        v.src = v.dataset.src;
      }

      v.load();
    })().catch(error => {
      mediaPromise = null;
      mediaError = error.message;
      $("status").textContent = mediaError;
      throw error;
    });

    return mediaPromise;
  }

  function fields() {
    ["rx", "ry", "rw", "rh"].forEach((id, i) => {
      $(id).value = (rect[i] * 100).toFixed(1);
    });
  }

  function drawBox(box = rect) {
    o.clearRect(0, 0, 960, 540);

    const [x, y, w, h] = box.map(
      (q, i) => q * (i % 2 === 0 ? 960 : 540)
    );

    o.fillStyle = "rgba(96,232,221,0.07)";
    o.fillRect(x, y, w, h);

    o.strokeStyle = "#68fff0";
    o.lineWidth = 2;
    o.strokeRect(x, y, w, h);

    const by = y > 25 ? y - 25 : y + h + 4;

    o.fillStyle = "#081b25";
    o.fillRect(x, by, 110, 22);

    o.font = "14px system-ui";
    o.fillStyle = "#efffff";
    o.fillText("Listening area", x + 6, by + 16);
  }

  function changeArea(next, name) {
    rect = next;
    history.clear();
    estimate = null;
    lastSample = -1;

    fields();
    drawBox();

    $("status").textContent =
      (name || "Custom selection") +
      " selected. The trace has been reset.";

    measure(true);
    plot();
  }

  function measure(force = false) {
    if (!active || v.readyState < 2 || v.seeking) return;

    ready = true;

    if (!force && Math.abs(v.currentTime - lastSample) < 0.115) {
      return;
    }

    try {
      s.drawImage(v, 0, 0, 960, 540);

      const x = Math.floor(rect[0] * 960);
      const y = Math.floor(rect[1] * 540);
      const w = Math.max(
        1,
        Math.min(960 - x, Math.floor(rect[2] * 960))
      );
      const h = Math.max(
        1,
        Math.min(540 - y, Math.floor(rect[3] * 540))
      );

      const pixels = s.getImageData(x, y, w, h).data;
      const step = w * h > 45000 ? 3 : 1;

      let sum = 0;
      let count = 0;
      let colored = 0;

      for (let i = 0; i < pixels.length; i += 4 * step) {
        const r = pixels[i] / 255;
        const green = pixels[i + 1] / 255;
        const b = pixels[i + 2] / 255;

        const hi = Math.max(r, green, b);
        const lo = Math.min(r, green, b);

        // Exclude dark background and approximately gray land.
        if (
          hi < 0.09 ||
          hi - lo < 0.055 ||
          (hi - lo) / hi < 0.35
        ) {
          continue;
        }

        colored++;

        const rgb = [r / hi, green / hi, b / hi];

        let best = Infinity;
        let index = 0;

        for (let j = 0; j < TEMPERATURE_COLORS.length; j++) {
          const c = TEMPERATURE_COLORS[j];

          const distance =
            (c[0] - rgb[0]) ** 2 +
            (c[1] - rgb[1]) ** 2 +
            (c[2] - rgb[2]) ** 2;

          if (distance < best) {
            best = distance;
            index = j;
          }
        }

        if (best < 0.09) {
          sum += index / (TEMPERATURE_COLORS.length - 1) * 32;
          count++;
        }
      }

      lastSample = v.currentTime;
      analysisError = "";
      estimate = count >= 20 ? sum / count : null;

      $("temp").textContent =
        estimate === null ? "— °C" : "~" + estimate.toFixed(1) + " °C";

      if (count >= 20) {
        $("coverage").textContent =
          "Estimated from " +
          (count * step).toLocaleString() +
          " colored pixels";
      } else if (colored >= 20) {
        $("coverage").textContent =
          "Colored pixels found, but too few match this " +
          "video’s calibrated temperature key.";
      } else {
        $("coverage").textContent =
          "Too few colored pixels — choose an ocean area";
      }

      history.set(Math.round(v.currentTime * 8) / 8, estimate);
      plot();

      if (performance.now() - lastAnnounce > 5000) {
        $("live").textContent =
          estimate === null
            ? "No estimate for this area."
            : "Estimated temperature " +
              estimate.toFixed(1) +
              " degrees Celsius.";

        lastAnnounce = performance.now();
      }
    } catch (error) {
      estimate = null;

      analysisError =
        error.name === "SecurityError"
          ? "The browser blocked video color analysis. " +
            "Open the website through a local web server " +
            "and keep the ocean video on the same website."
          : "Video color analysis could not run: " + error.message;

      $("temp").textContent = "— °C";
      $("coverage").textContent =
        "Temperature unavailable — see the message below.";
      $("status").textContent = analysisError;
    }
  }

  function plot() {
    const bounds = graph.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const W = Math.max(bounds.width, 240);
    const H = 220;

    graph.width = W * ratio;
    graph.height = H * ratio;

    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, W, H);

    const L = 55;
    const R = W - 15;
    const T = 18;
    const B = 176;
    const D = v.duration || 40.8333;

    const x = time => L + time / D * (R - L);
    const y = temp => B - temp / 32 * (B - T);

    const theme = getComputedStyle(root);

    g.font = "12px system-ui";
    g.strokeStyle = theme.getPropertyValue("--line").trim();
    g.fillStyle = theme.getPropertyValue("--muted").trim();
    g.lineWidth = 1;

    for (const temperature of [0, 8, 16, 24, 32]) {
      g.beginPath();
      g.moveTo(L, y(temperature));
      g.lineTo(R, y(temperature));
      g.stroke();
      g.fillText(temperature + "°", 12, y(temperature) + 4);
    }

    const ticks =
      W < 450 ? [0, 20, 40] : [0, 10, 20, 30, 40];

    for (const time of ticks) {
      g.fillText(
        time + "s",
        clamp(x(time) - 9, L, R - 24),
        B + 20
      );
    }

    g.fillText(
      "Video time (seconds)",
      Math.max(L, (W - 125) / 2),
      H - 3
    );
    g.fillText("°C", 15, 11);

    g.strokeStyle = theme.getPropertyValue("--sea").trim();
    g.lineWidth = 2;
    g.beginPath();

    let previous = null;

    for (const [time, temperature] of [...history].sort(
      (a, b) => a[0] - b[0]
    )) {
      if (temperature === null) {
        previous = null;
        continue;
      }

      if (previous === null || time - previous > 0.65) {
        g.moveTo(x(time), y(temperature));
      } else {
        g.lineTo(x(time), y(temperature));
      }

      previous = time;
    }

    g.stroke();

    const cursor = x(v.currentTime || 0);

    g.strokeStyle = "#7d99aa";
    g.beginPath();
    g.moveTo(cursor, T);
    g.lineTo(cursor, B);
    g.stroke();

    if (estimate !== null) {
      g.fillStyle = "#f6faff";
      g.beginPath();
      g.arc(cursor, y(estimate), 4, 0, Math.PI * 2);
      g.fill();
    }

    graph.setAttribute(
      "aria-label",
      "Color-derived temperature estimate versus video time, " +
      "fixed 0 to 32 degrees Celsius." +
      (estimate === null
        ? " No current estimate."
        : " Current estimate " +
          estimate.toFixed(1) +
          " degrees Celsius.")
    );
  }

  async function unlock() {
    if (!ctx) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        $("status").textContent =
          "Audio is unavailable in this browser. The graph still works.";
        return;
      }

      // The site's one shared AudioContext: master volume, Audio switch, level meter.
      const shared = host.audio();

      if (!shared) {
        $("status").textContent =
          "Audio is unavailable in this browser. The graph still works.";
        return;
      }

      ctx = shared.context;
      master = ctx.createGain();

      const compressor = ctx.createDynamicsCompressor();

      master.connect(compressor);
      compressor.connect(shared.output);
    }

    await ctx.resume();
    volume();
  }

  function volume() {
    if (!master) return;

    const muted =
      !active || v.paused || !$("sound").checked;

    master.gain.setTargetAtTime(
      muted ? 0 : Number($("volume").value) / 100,
      ctx.currentTime,
      0.03
    );
  }

  function voice(
    hz,
    start,
    duration,
    level,
    type = "sine",
    attack = 0.015
  ) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = hz;

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + attack);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + duration
    );

    oscillator.connect(gain);
    gain.connect(master);

    voices.add(oscillator);

    oscillator.onended = () => {
      voices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };

    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function note() {
    if (
      !active ||
      !ctx ||
      ctx.state !== "running" ||
      v.paused ||
      !$("sound").checked ||
      estimate === null
    ) {
      return;
    }

    const q = clamp(estimate / 32, 0, 1);
    const hz = MUSIC.baseFrequency * 2 ** (q * MUSIC.octaves);
    const now = ctx.currentTime;

    if ($("style").value === "tone") {
      voice(hz, now, 0.48, 0.13 + 0.10 * q);
      return;
    }

    const beat = Math.floor(
      v.currentTime / (MUSIC.noteIntervalMs / 1000)
    );

    const ratios = MUSIC.arpeggioRatios;
    const pitch = hz * ratios[beat % ratios.length];

    voice(
      pitch,
      now,
      0.85,
      0.060 + 0.040 * q,
      MUSIC.harpWaveform,
      0.009
    );

    voice(
      pitch * 2,
      now,
      0.38,
      0.016 + 0.010 * q,
      "sine",
      0.006
    );

    if (beat % 4 === 0) {
      MUSIC.chordRatios.forEach((ratio, i) => {
        voice(
          hz * ratio,
          now + i * 0.035,
          1.48,
          (0.026 + 0.013 * q) / (i ? 1.3 : 1),
          "sine",
          0.11
        );
      });
    }
  }

  async function play() {
    if (!active) return;

    const request = ++playbackRequest;

    try {
      if ($("sound").checked) {
        const attempt = unlock();
        attempt.catch(() => {});

        await loadMedia();
        await attempt;
      } else {
        await loadMedia();
      }

      if (!active || request !== playbackRequest) return;

      if (v.ended) v.currentTime = 0;

      await v.play();
    } catch (error) {
      if (!active || error.name === "AbortError") return;

      audioError = error.message || "Playback was blocked";

      $("status").textContent =
        mediaError ||
        "Playback could not start. Press Play & listen " +
        "to try again. " + audioError;

      host.onState();
    }
  }

  function pause() {
    playbackRequest++;
    v.pause();
    volume();
  }

  function stopVoices() {
    for (const oscillator of voices) {
      try {
        oscillator.stop();
      } catch (error) {
        // The note may already have stopped.
      }
    }

    voices.clear();
  }

  $("play").onclick = () => {
    if (v.paused) {
      play();
    } else {
      pause();
    }
  };

  $("restart").onclick = () => {
    if (!ready || !active) return;

    history.clear();
    estimate = null;
    stopVoices();

    v.currentTime = 0;
    lastSample = -1;

    plot();
    play();
  };

  v.addEventListener("play", () => {
    if (!active) {
      v.pause();
      return;
    }

    $("play").textContent = "Pause";

    host.onState();

    $("status").textContent =
      "Playing — drag a new area to change what you hear.";

    volume();
  });

  v.addEventListener("pause", () => {
    stopVoices();

    host.onState();

    $("play").textContent =
      v.ended ? "Play again" : "Play & listen";

    volume();
  });

  v.addEventListener("ended", () => {
    volume();
    $("status").textContent =
      "End of clip. Replay, or choose another area.";
  });

  v.addEventListener("loadeddata", () => {
    ready = true;

    $("play").disabled = false;
    $("play").textContent = "Play & listen";
    $("seek").max = v.duration;
    $("duration").textContent = fmt(v.duration);

    $("status").textContent =
      "Ready. Choose an area, then press Play & listen.";

    measure(true);
  });

  v.addEventListener("error", () => {
    mediaError =
      "The ocean video could not load. Check " +
      "media/explore/video/ocean-interactive.mp4 and use " +
      "a browser that supports MP4 playback.";

    $("status").textContent = mediaError;
  });

  ["canplay", "playing", "timeupdate"].forEach(event => {
    v.addEventListener(event, () => {
      if (active && v.readyState >= 2) {
        ready = true;
        measure();
      }
    });
  });

  v.addEventListener("seeking", () => {
    estimate = null;
    stopVoices();
  });

  v.addEventListener("seeked", () => {
    lastSample = -1;
    measure(true);
  });

  $("seek").oninput = () => {
    v.currentTime = Number($("seek").value);
    $("elapsed").textContent = fmt(v.currentTime);
  };

  $("speed").onchange = () => {
    v.playbackRate = Number($("speed").value);
  };

  $("sound").onchange = async () => {
    if ($("sound").checked) {
      try {
        await unlock();
        audioError = "";
      } catch (error) {
        audioError = error.message;

        $("status").textContent =
          "Sound could not start: " + audioError;
      }
    }

    volume();
  };

  $("volume").oninput = () => {
    const host = document.getElementById("np-vol");

    if (host) {
      host.value = $("volume").value;
      host.dispatchEvent(new Event("input", { bubbles: true }));
    }

    volume();
  };

  $("preset").onchange = () => {
    const preset = presets[$("preset").value];

    if (preset) {
      changeArea(
        preset.slice(),
        $("preset").selectedOptions[0].text
      );
    }
  };

  $("apply").onclick = () => {
    const numbers = ["rx", "ry", "rw", "rh"].map(id => {
      const value = $(id).value.trim();
      return value === "" ? NaN : Number(value);
    });

    if (
      !numbers.every(Number.isFinite) ||
      numbers[0] < 0 ||
      numbers[1] < 0 ||
      numbers[2] < 2 ||
      numbers[3] < 2 ||
      numbers[0] + numbers[2] > 100 ||
      numbers[1] + numbers[3] > 100
    ) {
      $("status").textContent =
        "Use a width and height of at least 2%, " +
        "and keep the selection inside the frame.";
      return;
    }

    $("preset").value = "custom";

    changeArea(
      numbers.map(number => number / 100),
      "Custom area"
    );
  };

  function pos(event) {
    const bounds = overlay.getBoundingClientRect();

    return [
      clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      clamp((event.clientY - bounds.top) / bounds.height, 0, 1)
    ];
  }

  overlay.onpointerdown = event => {
    drag = pos(event);
    overlay.setPointerCapture(event.pointerId);
  };

  overlay.onpointermove = event => {
    if (!drag) return;

    const p = pos(event);

    drawBox([
      Math.min(drag[0], p[0]),
      Math.min(drag[1], p[1]),
      Math.abs(drag[0] - p[0]),
      Math.abs(drag[1] - p[1])
    ]);
  };

  overlay.onpointerup = event => {
    if (!drag) return;

    const p = pos(event);

    let box = [
      Math.min(drag[0], p[0]),
      Math.min(drag[1], p[1]),
      Math.abs(drag[0] - p[0]),
      Math.abs(drag[1] - p[1])
    ];

    if (box[2] < 0.02 || box[3] < 0.02) {
      box = [
        clamp(p[0] - 0.04, 0, 0.92),
        clamp(p[1] - 0.04, 0, 0.92),
        0.08,
        0.08
      ];
    }

    drag = null;
    $("preset").value = "custom";
    changeArea(box, "Custom area");
  };

  overlay.onpointercancel = () => {
    drag = null;
    drawBox();
  };

  new ResizeObserver(() => {
    if (active) plot();
  }).observe(graph);

  fields();
  drawBox();

  root.oceanDiagnostics = () => ({
    version: "calibrated-colors-3",
    readyState: v.readyState,
    videoWidth: v.videoWidth,
    videoHeight: v.videoHeight,
    estimate,
    audioState: ctx ? ctx.state : "not started",
    analysisError,
    mediaError,
    audioError
  });

  return {
    open() {
      active = true;
      root.hidden = false;

      loadMedia().catch(() => {});

      const host = document.getElementById("np-vol");

      if (host) {
        $("volume").value = host.value;
      }

      if (!timers.length) {
        timers.push(setInterval(() => {
          if (active) {
            $("seek").value = v.currentTime;
            $("elapsed").textContent = fmt(v.currentTime);
            measure();
          }
        }, 125));

        timers.push(
          setInterval(note, MUSIC.noteIntervalMs)
        );
      }

      requestAnimationFrame(() => {
        drawBox();
        measure(true);
        plot();
      });
    },

    close() {
      active = false;
      pause();
      stopVoices();

      if (master) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(0, ctx.currentTime);
      }

      timers.forEach(clearInterval);
      timers = [];
      root.hidden = true;
    },

    toggle() {
      if (v.paused) {
        play();
      } else {
        pause();
      }
    },

    pause,

    isPlaying() {
      return active && !v.paused && !v.ended;
    },

    setVolume(value) {
      $("volume").value = clamp(value, 0, 1) * 100;
      volume();
    },

    level() {
      return 0;
    },

    getState() {
      return {
        version: "calibrated-colors-3",
        active,
        ready,
        estimate,
        rect: rect.slice(),
        samples: history.size,
        paused: v.paused,
        hasAudio: !!ctx,
        audioState: ctx ? ctx.state : "not started",
        readyState: v.readyState,
        mediaError,
        analysisError,
        audioError
      };
    }
  };
};
})();
