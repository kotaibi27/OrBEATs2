# Compose tab: Planet Opera

The Compose page is Planet Opera: an Earth with the Moon in orbit, eight data sliders, a live
"What's happening" dashboard and a generated score. It uses the site's own header, Text size,
Contrast, Audio, Captions, Volume and now-playing bar.

| File | What it is |
|---|---|
| `compose.js` | Registers the tab, writes the page markup, starts and stops the lab. |
| `compose-lab.js` | **Generated.** The seven parts below, joined and wrapped in one function. Do not edit. |
| `src/p1..p7_*.js` | The page logic. p1 variables, scenes, sliders, Web Audio score. p2 region data and labels. p3 shaders. p4 Earth and strands. p5 Moon, note source points. p6 flying notes and the main loop. p7 dashboard. |
| `../../../css/compose.css` | All the CSS, scoped under `.po`, using the site's tokens. |
| `../../../vendor/three/three.bundle.js` | A trimmed three.js (window.THREE). |
| `../../../media/compose/*.jpg` | The four NASA-derived Earth pictures (day, lights, water, topo). |

After editing anything in `src/`, rebuild from the NASA folder: `python tools/build-compose.py`.

How it plugs into the site
- Volume and the Audio switch: the score plays through the shared output from `ORBEATS.getAudio()`. Pressing Play turns Audio on if needed and pauses the site's background music (`holdMusic`); Pause or the Audio switch stops it.
- Now-playing bar: `ORBEATS.setNowPlaying('Compose · <scene>', <caption>)` while playing.
- Captions and reduced motion follow the `orbeats:settings` event. Text size and Contrast are the site's.
- Leaving the page: `unmount()` runs `host.__poStop()`, which stops the score, the animation loop, the WebGL context and every listener.

Honesty: only the base Earth imagery is NASA-derived. The strands, effect layers, clouds, Moon and music
are creative interpretations, not live NASA data. Keep the "NASA sources" dialog and the "creative levels" wording.
To use real datasets later (GIBS tiles), replace the hand-made layers in `buildLayers()` in `src/p2_world.js`.
