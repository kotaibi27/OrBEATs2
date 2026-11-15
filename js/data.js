/* ORBEATS data. This is the ONE file that holds every dataset.
 *
 * To add, remove or reorder a dataset, edit the `datasets` list below.
 * The Explore viewer, the dataset picker, the data catalog and the count-up
 * number all read from this list.
 *
 * The Explore wording (title, intro, period, seeing, listening, why, the
 * sound guides and the now-playing captions) was written by Reem
 * and is copied here word for word from her js/experiences-data.js and
 * js/explore.js. Do not rewrite it.
 *
 * RULE: never invent a dataset, a number, a date or a caption. `nasaTitle`
 * and `released` are the real title and release date of the NASA Scientific
 * Visualization Studio (SVS) page. If something is missing, write a bracketed
 * placeholder such as "[Description placeholder]".
 */
(function () {
  'use strict';

  var SVS = 'https://svs.gsfc.nasa.gov/';
  var VIS = SVS + 'vis/';
  var IMG = 'media/explore/img/';
  var VID = 'media/explore/video/';

  /* The movie files made by tools/build-explore-media.py for one of her videos. */
  function movie(name) { return { webm: VID + name + '.webm', mp4: VID + name + '.mp4', poster: VID + name + '.webp' }; }

  /* HONEST SOUND LABELS. Each dataset says exactly where its sound comes from.
   * None of the Explore sounds is made from raw NASA data values. */
  var SOUND = {
    nasaSonification: { type: 'NASA sonification',
      label: 'Sound: NASA’s own sonification of this Hubble image, by SYSTEM Sounds. It is the soundtrack of the NASA video.' },
    nasaNarration: { type: 'NASA narrated film',
      label: 'Sound: the soundtrack of NASA’s narrated film (spoken narration and background music). It is not a sonification of data.' },
    framesLive: { type: 'NASA visualization frames',
      label: 'Sound: a sonification by Reem, made live in your browser from the colors of NASA’s visualization frames. It is not made from raw NASA data.' },
    imageLive: { type: 'NASA visualization image',
      label: 'Sound: a sonification by Reem, made live in your browser from the colors of NASA’s still image. It is not made from raw NASA data.' },
    framesVideo: { type: 'NASA visualization frames',
      label: 'Sound: a sonification by Reem that follows the colors of NASA’s visualization frames. The soundtrack is supplied in the video. It is not made from raw NASA data.' },
    own: { type: 'Musical interpretation', label: '' }    // no line is shown for these (removed at the team's request)
  };

  /* Her default listening guide, used when a dataset has no `listening` text of its own. */
  var DEFAULT_LISTENING = 'Your video pairs this NASA visualization with a musical interpretation. Sound is an added representation of the visual information, not a recording of Earth. Use pause, replay, and volume controls to explore at your own pace.';
  var DEFAULT_CAPTION = 'Sonified NASA Earth visualization.';

  window.ORBEATS_DATA = {

    /* The NASA gallery all the Earth entries come from. */
    gallery: SVS + 'gallery/earth-information-center/',

    /* The site's background video and music. Facts from the SVS 13786 page.
     * `local` files are made by tools/download-media.py. If a local file is
     * missing, the browser moves on to the NASA URL. */
    music: {
      id: 13786,
      title: 'Data Sonification: Caldwell 73',
      url: SVS + '13786/',
      mp4: { local: 'media/Caldwell73_2K_Final.mp4', remote: VIS + 'a010000/a013700/a013786/Caldwell73_2K_Final.mp4' },
      webm: { local: 'media/Caldwell73_2K_Final.webm', remote: VIS + 'a010000/a013700/a013786/Caldwell73_2K_Final.webm' },
      audio: { m4a: 'media/caldwell73.m4a', ogg: 'media/caldwell73.ogg' },   // the music, taken from the video's soundtrack (tools/extract-music.py)
      caption: 'Each star in this Hubble image becomes a note. Stars farther from the center sound higher.',
      credit: 'Video and sonification: NASA Scientific Visualization Studio, SVS 13786.',
      sonifiedBy: 'Sonification credit: SYSTEM Sounds (M. Russo, A. Santaguida).'
    },

    /* The three kinds of experience, with her labels. */
    formats: {
      music: { label: 'Music & sound', action: 'Watch & listen' },
      interactive: { label: 'Interactive', action: 'Explore & interact' },
      narrated: { label: 'Narrated', action: 'Watch with narration' }
    },
    defaultListening: DEFAULT_LISTENING,

    /* The catalog, in her display order.
     *
     *   id            SVS page number (the source link is built from it unless `sourceUrl` is given)
     *   nasaTitle     the real title of the NASA page
     *   released      the real release date of the NASA page
     *   category, title, intro, period, seeing, listening, why      her wording
     *   format        'music', 'interactive' or 'narrated' (see `formats` above)
     *   thumb         her card picture, as WebP
     *   media         { webm, mp4, poster } for a video experience (WebM is offered first, unless first: 'mp4')
     *   interactive   'ocean' or 'aerosols': an experience that makes its sound in the browser (js/explore/)
     *   views         several videos for one dataset, each with its own guide and `soundMap`
     *   soundSource   where the sound comes from (one of the SOUND labels above)
     *   caption       her one-line caption for the now-playing bar
     *   transcriptUrl NASA's narration transcript, when there is one
     *   reference     true = shown with a "Reference" tag and not counted as Earth data.
     *                 Its Play button plays the site's own Caldwell 73 music.
     */
    datasets: [
      { id: 13786, reference: true,
        nasaTitle: 'Data Sonification: Caldwell 73', released: 'December 23, 2020',
        category: 'Beyond Earth',
        title: 'Listen to a star cluster',
        intro: 'Enter Caldwell 73. Hear a radar-like sweep transform a Hubble image into a choir, marimba, and glockenspiel.',
        period: 'NASA sonification reference',
        seeing: 'Caldwell 73, also called NGC 1851, is a globular cluster about 40,000 light-years from Earth in the constellation Columba. In this Hubble image, stars are concentrated toward the center.',
        listening: 'As the scan turns around the cluster, stars farther from the image center sound higher in pitch. A choir represents the full image, a marimba represents orange and red stars, and a glockenspiel represents blue stars. These are mapped sounds, not recorded sounds from space.',
        why: 'This NASA sonification demonstrates how spatial information and color can be translated into sound. It is an astronomy reference alongside the Earth journeys. Visual credit: NASA’s Goddard Space Flight Center. Sonification: SYSTEM Sounds (M. Russo and A. Santaguida).',
        color: 'violet', format: 'music',
        thumb: IMG + 'caldwell-73.webp',
        /* Her video is the same file as the site's background video, so the viewer reuses that one. */
        media: { webm: 'media/Caldwell73_2K_Final.webm', mp4: 'media/Caldwell73_2K_Final.mp4', poster: IMG + 'caldwell-73.webp',
                 remote: VIS + 'a010000/a013700/a013786/Caldwell73_2K_Final.mp4' },
        soundSource: SOUND.nasaSonification,
        caption: 'NASA astronomy sonification: radius maps to pitch; star colors map to instruments.' },

      { id: 3912,
        nasaTitle: 'Global Sea Surface Currents and Temperature', released: 'March 16, 2012',
        category: 'Ocean',
        title: 'Follow the ocean’s flowing patterns',
        intro: 'Choose an ocean region or draw your own area. Play the currents, hear their changing colors, and follow a temperature trace.',
        interactive: 'ocean',
        listening: 'Select an ocean region or draw a box over the animation. Warmer color-derived estimates produce higher, slightly louder notes on a shared 0–32 °C scale. Gentle harp and chords add musical texture; single-tone mode gives a direct comparison. Estimates come from visible colored current pixels, not original model fields or an area-weighted ocean mean. The colors do not establish dangerous conditions. The trace resets when you choose a new area.',
        period: 'March 2007–March 2008',
        seeing: 'This ECCO2 visualization shows ocean surface flows colored by sea surface temperature. It combines model output informed by satellite and in-situ observations. Only surface flows are shown.',
        why: 'Ocean currents move heat and carbon. The eddies and narrow streams reveal a complex, connected ocean.',
        color: 'blue', format: 'interactive',
        thumb: IMG + 'ocean-currents-temperature.webp',
        soundSource: SOUND.framesLive,
        caption: 'Select a region. Warmer color-derived estimates produce higher notes; the graph follows your selection.' },

      { id: 5425,
        nasaTitle: 'Perpetual Ocean 2: Western Boundary Currents', released: 'February 27, 2025',
        category: 'Ocean',
        title: 'Drift along ocean highways',
        intro: 'Take a narrated journey through Earth’s ocean highways. Follow the currents and discover how they carry heat, carbon, and nutrients around the globe.',
        period: 'NASA narrated film · 5 min 17 sec',
        seeing: 'NASA’s An Ocean in Motion uses the ECCO model, informed by spacecraft, buoys, and other observations. White streams show currents closer to the surface; blue streams show deeper flow. The narration explores the Kuroshio, Agulhas, and Gulf Stream, alongside eddies, upwelling, downwelling, and the roles of temperature and salinity.',
        why: 'Ocean circulation redistributes heat, carbon, and nutrients. It connects marine ecosystems with climate and moves water between surface and deeper layers.',
        color: 'blue',
        sourceUrl: 'https://svs.gsfc.nasa.gov/14745/',
        transcriptUrl: 'https://svs.gsfc.nasa.gov/vis/a010000/a014700/a014745/script_37940_00.html',
        listening: 'Listen to spoken narration explaining ocean circulation, accompanied by background music. This soundtrack is a narrated film, not a mapping of ocean measurements to pitch or rhythm. Music credit: Universal Music Production — “Playing with the Narrative Instrumental” and “What Was Reported As Is Instrumental.” Film credit: NASA’s Goddard Space Flight Center; producer Kathleen Gaeta Greer, scientist Josh Willis, and visualizers Greg Shirah and Atousa Saberi.',
        format: 'narrated',
        thumb: IMG + 'western-boundary-currents.webp',
        /* This film's MP4 (720p) is better than its WebM (540p), so the MP4 is offered first. */
        media: { webm: VID + 'western-boundary-currents.webm', mp4: VID + 'western-boundary-currents.mp4', poster: VID + 'western-boundary-currents.webp', first: 'mp4' },
        soundSource: SOUND.nasaNarration,
        caption: 'NASA narrated ocean film with background music. Read the complete transcript in About this experience.' },

      { id: 5196,
        nasaTitle: 'DYAMOND Global Carbon Dioxide', released: 'July 22, 2024',
        category: 'Atmosphere',
        title: 'Hear Earth’s carbon heartbeat',
        intro: 'Watch carbon dioxide pulse across the planet and hear our heartbeat-inspired soundtrack bring that rhythm into focus. Discover the daily cycles behind the pattern.',
        period: 'January–March 2020',
        seeing: 'NASA’s DYAMOND visualization shows modeled CO₂ moving through the atmosphere during January–March 2020. Why the pulse? Fires generally intensify during the day and weaken at night. Plants take up CO₂ through daytime photosynthesis; respiration releases CO₂, including at night. Photosynthesis and respiration are different processes. Daily heating also deepens the atmospheric boundary layer, while nighttime cooling makes it shallower, changing how CO₂ mixes. These overlapping cycles help create the visible pulses. Southern Hemisphere summer growth makes the pattern especially noticeable in the tropics and South America.',
        listening: 'Our heartbeat-inspired sound represents the pulsing pattern visible in the animation. Listen for the repeating beats as you watch the CO₂ patterns change. This is an artistic way to experience the rhythm, not a literal heartbeat or a direct measurement of concentration. The daily cycles are compressed into the video’s playback time.',
        why: 'The apparent heartbeat connects daily fire activity, vegetation, and atmospheric mixing. It does not mean the planet is becoming warmer with each beat. CO₂ traps heat, and understanding its sources, transport, and uptake helps explain the carbon cycle.',
        color: 'gold',
        sourceUrl: 'https://svs.gsfc.nasa.gov/5196/',
        format: 'music',
        thumb: IMG + 'dyamond-carbon-dioxide.webp',
        media: movie('dyamond-carbon-dioxide'),
        soundSource: SOUND.own },

      { id: 5533,
        nasaTitle: 'Air Quality Model Runs', released: 'May 5, 2025',
        category: 'Atmosphere',
        title: 'Follow the air we share',
        intro: 'Explore how pollutants travel through the atmosphere, crossing the boundaries we draw on maps.',
        period: 'July–August 2024',
        seeing: 'NASA’s GEOS-CF visualization follows modeled carbon monoxide, fine particles, ozone, and nitrogen oxides during July–August 2024, an active fire season in North America.',
        why: 'Models help scientists understand pollutant sources and transport and improve air quality predictions. This animation is not a live local air quality reading.',
        color: 'gold', format: 'music',
        thumb: IMG + 'air-quality-model-runs.webp',
        media: movie('air-quality-model-runs'),
        soundSource: SOUND.own },

      { id: 4960,
        nasaTitle: 'A 3D View of an Atmospheric River from an Earth System Model', released: 'January 25, 2022',
        category: 'Water',
        title: 'Journey along a river in the sky',
        intro: 'Follow a river of moisture across the sky with NASA’s narrated film. Discover how winds carry water toward land and how mountains turn that moisture into rain and snow.',
        period: 'NASA narrated film · MERRA-2',
        seeing: 'An atmospheric river is a narrow corridor transporting large amounts of water vapor. This three-dimensional NASA visualization uses MERRA-2, which combines a weather model with satellite and conventional observations. Blue shading reveals moisture transport. The example follows a “Pineapple Express” atmospheric river originating near Hawaiʻi toward the western United States.',
        why: 'As moist air rises over mountains, it cools and can produce rain or snow. Atmospheric rivers replenish water supplies and snowpack, but intense events can cause flooding and mudslides. They occur around the world, not only along North America’s west coast.',
        color: 'blue',
        listening: 'Listen to NASA’s spoken narration as it explains the movement of moisture, the winds and pressure systems guiding it, and the formation of precipitation. The explanation follows the visualization; this is a narrated science film rather than a soundtrack that converts data values into musical notes. Pause and replay to follow each step. Credit: NASA’s Scientific Visualization Studio.',
        format: 'narrated',
        thumb: IMG + 'atmospheric-river.webp',
        media: movie('atmospheric-river'),
        soundSource: SOUND.nasaNarration },

      { id: 5313,
        nasaTitle: 'Change in Night Lights between 2012 and 2023 - EIC Version', released: 'June 14, 2024',
        category: 'Human footprint',
        title: 'Hear Earth’s changing night lights',
        intro: 'Watch a decade of light unfold. See and hear how nighttime illumination changed around the world between 2012 and 2023.',
        period: '2012–2023',
        seeing: 'NASA’s animation begins with annual averages of nighttime lights, then compares 2012 with 2023. Purple indicates more light; orange indicates less light. Regional views include India, Ukraine, Western Europe, and the Eastern Mediterranean.',
        why: 'Nighttime illumination reveals patterns of human activity. Changes in detected light do not, on their own, explain the cause.',
        color: 'violet', format: 'music',
        thumb: IMG + 'night-lights.webp',
        media: movie('night-lights'),
        soundSource: SOUND.own },

      { id: 5669,
        nasaTitle: 'GEOS Aerosols (2025)', released: 'August 10, 2026',
        category: 'Atmosphere',
        title: 'Meet the particles in our sky',
        intro: 'Move across a NASA aerosol image and hear four distinct tones. Isolate a layer, compare colors, and explore with a mouse, touch, or keyboard.',
        period: 'August 19, 2025 · 20:00 UTC',
        seeing: 'Explore a still image of aerosols with the supplied color legend: orange-red for black carbon, purple for dust, blue-gray for sea salt, and green for sulfate. The image represents a snapshot, not changes over time.',
        why: 'Aerosols can travel long distances and affect visibility and air quality far from their sources. A moving camera over a still image does not show changes over time.',
        color: 'violet',
        interactive: 'aerosols',
        listening: 'Each color category has a distinct tone: black carbon uses a low C3 bass, dust a G3 reed-like tone, sea salt an E4 airy tone, and sulfate a C5 shimmering tone. Loudness follows color prominence in a small image patch, not measured concentration or danger. Preview each tone, enable sound, and explore the map using arrow keys, the direction buttons, or your pointer. Overlapping and pale colors may be ambiguous.',
        format: 'interactive',
        thumb: IMG + 'geos-aerosols.webp',
        soundSource: SOUND.imageLive,
        caption: 'Interactive aerosol sound map. Four tones represent image colors, not concentration or danger.' },

      { id: 4950,
        nasaTitle: 'GEDI Forest Height', released: 'October 29, 2021',
        category: 'Land',
        title: 'Rise through Earth’s forests',
        intro: 'Start among the forest-height observations over Goddard Space Flight Center in Maryland, then explore Earth’s canopy from a global perspective. Two views, two musical interpretations.',
        period: 'GEDI · Maryland & global views',
        seeing: 'GEDI laser measurements from the International Space Station reveal forest height. Brown and dark green indicate shorter vegetation; bright green and white indicate taller vegetation. Heights are exaggerated to make differences visible at a global scale.',
        why: 'Forest structure provides information beyond a flat map of vegetation and helps scientists understand Earth’s ecosystems.',
        color: 'green',
        views: [
          { label: '1 · Maryland closeup',
            title: 'Maryland closeup · Hear relative forest height',
            intro: 'Move through forest-height observations over NASA’s Goddard Space Flight Center in Maryland. Listen for a changing sequence of notes representing relative height categories.',
            seeing: 'GEDI laser observations reveal vegetation height. Brown and dark green indicate shorter vegetation; bright green and white indicate taller vegetation. The displayed vertical heights are exaggerated. Camera motion can reveal existing observations and should not be interpreted as new data being collected at that moment.',
            listening: 'The closeup sonification follows height-mark colors within a small central sampling window. Several marks form a short sequence of notes, creating a changing melody. Pitch conveys relative height while volume stays fairly consistent. Use the colors rather than apparent spike length to interpret height. This version has no visible color bar, so the guide describes relative categories, without claiming exact heights in meters. The soundtrack is supplied in the video; this page does not sample pixels live.',
            why: 'Listening to relative categories offers another way to explore differences in forest structure. Silence means water or no identifiable observations in the sampling window; it does not establish zero vegetation height.',
            soundMap: [
              ['Brown / darker-green height marks', 'Lower notes'],
              ['Brighter-green height marks', 'Higher notes'],
              ['White height marks', 'Highest, bell-like notes'],
              ['Water / no identifiable observations', 'Silence']
            ],
            media: movie('gedi-forest-height-closeup'),
            soundSource: SOUND.framesVideo },
          { label: '2 · Whole globe',
            title: 'Forest Heights | The Sound of Earth’s Canopy',
            intro: 'Explore Earth’s forests through a musical interpretation of NASA’s GEDI observations. Deep wooden tones symbolize shorter vegetation, while ascending flute melodies and shimmering bells represent taller forest canopies.',
            seeing: 'This global NASA visualization shows forest height from GEDI observations collected aboard the International Space Station. Brown and dark green represent shorter vegetation; bright green and white represent taller vegetation. Displayed heights are exaggerated to reveal differences at this scale.',
            listening: 'Low wooden notes symbolize shorter vegetation. Rising flute melodies represent taller forests, and high bells represent towering canopies. This soundtrack illustrates forest-height differences; it is not directly generated from measured height values.',
            why: 'A musical interpretation can introduce the variety of Earth’s forest canopy. GEDI helps reveal the three-dimensional structure of vegetation, supporting studies of ecosystems and the carbon cycle.',
            soundMap: [
              ['Low wooden notes', 'Shorter vegetation'],
              ['Rising flute melodies', 'Taller forests'],
              ['High bells', 'Towering canopies']
            ],
            media: movie('gedi-forest-height'),
            soundSource: SOUND.own }
        ],
        format: 'music',
        thumb: IMG + 'gedi-forest-height.webp',
        soundSource: SOUND.own },

      { id: 5011,
        nasaTitle: 'Lightning Events Detected from the International Space Station (ISS) 2017-2023', released: 'October 19, 2023',
        category: 'Atmosphere',
        title: 'Discover a world of lightning',
        intro: 'Explore lightning detected from orbit, across changing places and seasons.',
        period: 'January 2017–July 2023',
        seeing: 'The Lightning Imaging Sensor aboard the ISS detected lightning in tropical and mid-latitude regions. This visualization uses quality-controlled observations with a moving 10-day window.',
        why: 'The observations reveal how lightning is distributed and varies over time. They do not cover every flash everywhere on Earth.',
        color: 'gold', format: 'music',
        thumb: IMG + 'lightning-events-iss.webp',
        media: movie('lightning-events-iss'),
        soundSource: SOUND.own },

      /* New in the catalog: built by Reem. NASA page checked: SVS 4616, "Disappearing Ice". */
      { id: 4616,
        nasaTitle: 'Disappearing Ice', released: 'March 13, 2018',
        category: 'Ice & polar regions',
        title: 'Disappearing Ice | The Sound of a Changing Arctic',
        intro: 'Experience the changing Arctic through sound. Deep, low tones symbolize older sea ice, while lighter, higher notes represent younger ice. As deeper musical layers fade, they tell the story of disappearing oldest ice.',
        period: 'Arctic sea ice age · 1984–2016',
        seeing: 'NASA’s Disappearing Ice visualization shows Arctic sea ice moving under winds and ocean currents. In the ice-age sequence, younger ice is dark blue and the oldest ice is bright white. The age record spans 1984–2016, revealing changes in the amount of older ice. This experience uses your closeup version.',
        listening: 'Sound guide: Low tones = older ice. High tones = younger ice. Fading deeper layers = loss of older ice. This musical interpretation represents the changing balance of ice ages; the tones are not recorded sounds from the ice. Follow the low layers as they recede and compare them with the younger-ice notes.',
        why: 'Ice that survives multiple years can become older and thicker. NASA describes how Arctic ice once circulated for years in the Beaufort Sea before leaving toward warmer waters near Greenland. Increased summer melting can remove ice before it ages. Losing older ice changes the Arctic’s store of long-lived sea ice.',
        color: 'blue',
        sourceUrl: 'https://svs.gsfc.nasa.gov/4616/',
        format: 'music',
        thumb: IMG + 'disappearing-ice.webp',
        media: movie('disappearing-ice'),
        soundSource: SOUND.own }
    ]
  };

  window.ORBEATS_DATA.datasets.forEach(function (d) {
    /* The source link: her link when she gave one, otherwise built from the SVS number. */
    d.url = d.sourceUrl || (SVS + d.id + '/');
    if (!d.listening) d.listening = DEFAULT_LISTENING;
    if (!d.caption) d.caption = DEFAULT_CAPTION;
    /* The shared runtime (js/app.js) plays a dataset through its "series" hook.
     * This marker tells it the sound is ready; js/explore.js supplies the player. */
    if (!d.reference) d.series = { explore: true };
  });
})();
