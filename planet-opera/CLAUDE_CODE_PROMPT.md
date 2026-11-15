# Prompt to paste into Claude Code

I have a finished interactive page called "Planet Opera" (the Play page for ORBEATS). Add it to this website as the **Play** page, using the website's existing header, nav, accessibility bar, and now-playing bar instead of the ones in the demo.

The folder `planet-opera/` contains:
- `Planet_Opera_Draft_04_ORBEATS.html`: the working demo, one self-contained file (open it in Chrome to see the target behaviour).
- `shell.html`: the demo's HTML and CSS. It has a demo copy of the site header, text-size / contrast / audio / captions buttons and bottom dock that must be replaced by the site's real ones.
- `p1_state_audio.js` ... `p7_dashboard.js`: the page logic, to be concatenated in numeric order into one script (`build.py` shows how). p1 = variables, scenes, sliders, Web Audio music. p2 = region data and labels. p3 = shaders. p4 = Earth and strands. p5 = Moon, note source points, meter. p6 = flying notes and main loop. p7 = "What's happening" dashboard.
- `three.bundle.js`: a trimmed three.js that exposes `window.THREE`. `tex/*.jpg`: four NASA-derived Earth textures that `build.py` embeds as base64 in `const TEX={day,lights,water,topo}`.

## What to do
1. Look at how this site is structured (framework, routing, global CSS, existing header/dock/accessibility code). Follow its conventions.
2. Create the Play page and mount the Earth canvas, the right-hand control panel (`#controls`), and the left dashboard (`#dash`) inside it.
3. Reuse the site's own header, text size, contrast, audio and captions controls, and now-playing bar. Connect them to the page script by keeping the element IDs the script expects (list below), or by editing the small handlers in `p1_state_audio.js` (the `mute`, `contrast`, `captions`, `ts-*`, `play`, `volume` handlers).
4. Serve the textures as normal static files instead of base64 if the site prefers, by changing how `TEX` is defined. Load `three.bundle.js` before the page script.
5. Keep the page's CSS scoped so it does not clash with the site's styles (the demo uses `:root` variables such as `--bg`, `--accent`, `--serif`; map them to the site's tokens).
6. Make sure the canvas is sized from the free area between the site header and dock: `layoutCamera()` in `p4_objects.js` reads `.site` height and `#dock` height. Update those selectors to the site's real elements.
7. Test on desktop and a phone-sized viewport. Make sure there are no console errors and that the page works when the user leaves and returns (stop audio and the animation loop on unmount).

## DOM IDs the script requires
announcement caption captions chapter chapter-note close-sources contrast controls cycle dash dash-last dash-rows dash-toggle describe dock feedback follow fullscreen glow labels labels-layer launch meter motion music-state mute notes particles play reset scene-name score-state source-dialog source-grid sources spin start threads ts-minus ts-plus ts-val universe variables voice volume zoom-in zoom-out
Also needed: an element with class `.site` (the header, used for layout height).

## Do not change
- The behaviour: moving a slider sends notes from that slider's row to the matching Earth region; the dashboard explains each change in plain words; the Moon orbits Earth.
- The honesty text: only the base Earth imagery is NASA-derived. The effect layers, strands, clouds and Moon are creative interpretations, not live NASA data. Keep the "NASA sources" dialog and the "creative levels" wording.

## Later (optional)
Replace the hand-made layers with real NASA datasets (GIBS tiles): MODIS sea surface temperature, MERRA-2 aerosols, TEMPO NO2, OCO-2 CO2, GEDI canopy height. Layers are built in `buildLayers()` in `p2_world.js`.
