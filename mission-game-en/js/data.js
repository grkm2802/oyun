'use strict';
/* =========================================================================
   MISSION CONTROL: Design · Launch · Discover
   Game data. All numbers are simplified but chosen to keep real-world
   proportions (inverse-square sunlight & radio, rocket equation, etc.).
   Units: mass kg · power W · cost $M · data Mbit/day · time months
   ========================================================================= */

const G0 = 9.80665;

const ROLES = {
  MM: { id: 'MM', name: 'Mission Manager', icon: '🧭', color: 'var(--role-mm)',
        goal: 'Keep at least 10% of the budget unspent as reserve',
        short: 'Budget reserve ≥ 10%' },
  SE: { id: 'SE', name: 'Spacecraft Engineer', icon: '🔧', color: 'var(--role-se)',
        goal: 'Power margin ≥ 15% and launch mass margin ≥ 10%',
        short: 'Power ≥ 15% · Mass ≥ 10% margin' },
  SL: { id: 'SL', name: 'Science Lead', icon: '🔬', color: 'var(--role-sl)',
        goal: 'Instrument capability ≥ 70% on every primary objective',
        short: 'Primary objectives ≥ 70% capable' },
  CL: { id: 'CL', name: 'Communications Lead', icon: '📡', color: 'var(--role-cl)',
        goal: 'Downlink capacity ≥ 100% of the science data generated',
        short: 'Downlink ≥ data generated' },
};

/* How roles are shared depending on team size */
const ROLE_SPLIT = {
  1: [['MM', 'SE', 'SL', 'CL']],
  2: [['MM', 'SL'], ['SE', 'CL']],
  3: [['MM'], ['SE'], ['SL', 'CL']],
  4: [['MM'], ['SE'], ['SL'], ['CL']],
};

const DIFFICULTY = {
  easy:    { name: 'Cadet',     icon: '🟢', budgetMult: 1.3,  eventRate: 0.07, relPenalty: 0,    scoreMult: 0.8,  hideAdv: true,  hints: true,
             desc: 'Bigger budget, fewer surprises, simpler parts and helpful hints.' },
  normal:  { name: 'Engineer',  icon: '🟡', budgetMult: 1.0,  eventRate: 0.11, relPenalty: 0,    scoreMult: 1.0,  hideAdv: false, hints: true,
             desc: 'Realistic budget and the full parts catalogue.' },
  hard:    { name: 'Flight Director', icon: '🟥', budgetMult: 0.85, eventRate: 0.17, relPenalty: 0.02, scoreMult: 1.25, hideAdv: false, hints: false,
             desc: 'Tight budget, more anomalies, less reliable rockets, no hints.' },
  sandbox: { name: 'Sandbox',   icon: '🧪', budgetMult: null, eventRate: 0.0,  relPenalty: 0,    scoreMult: 0,    hideAdv: false, hints: true,
             desc: 'Unlimited budget and no random events. Experiment freely (not ranked).' },
};

/* ------------------------------------------------------------------ */
/* SCIENCE INSTRUMENTS                                                  */
/* kind: imaging (needs resolution + sunlight) · thermal · radar · insitu */
/* ------------------------------------------------------------------ */
const INSTRUMENTS = {
  camera:       { name: 'High-resolution camera', icon: '📷', kind: 'imaging', mass: 25, power: 30, cost: 22, data: 30000, dev: 4, fine: true,
                  desc: 'Sharp visible-light pictures. Great detail, but huge data volume and needs very steady pointing.' },
  multispec:    { name: 'Multispectral imager', icon: '🌈', kind: 'imaging', mass: 15, power: 20, cost: 15, data: 12000, dev: 3,
                  desc: 'Images in several colour bands incl. near-infrared — reveals plant health, minerals and water.' },
  thermal:      { name: 'Thermal infrared imager', icon: '🔥', kind: 'thermal', mass: 20, power: 35, cost: 20, data: 6000, dev: 4,
                  desc: 'Sees heat. Detects fires and warm spots and works at night.' },
  sar:          { name: 'Synthetic aperture radar', icon: '🛰️', kind: 'radar', mass: 110, power: 450, cost: 60, data: 50000, dev: 8,
                  desc: 'Bounces radio waves off the ground. Sees through clouds, smoke and darkness — but heavy and power-hungry.' },
  spectrometer: { name: 'Imaging spectrometer', icon: '🧪', kind: 'imaging', mass: 30, power: 40, cost: 35, data: 18000, dev: 6, fine: true,
                  desc: 'Splits light into hundreds of colours to identify chemicals: water, CO₂, minerals, organics.' },
  altimeter:    { name: 'Laser altimeter', icon: '📏', kind: 'radar', mass: 15, power: 35, cost: 15, data: 300, dev: 4,
                  desc: 'Fires laser pulses and times the echo to measure surface height — builds 3-D maps.' },
  neutron:      { name: 'Neutron spectrometer', icon: '💧', kind: 'insitu', mass: 8, power: 10, cost: 9, data: 20, dev: 3,
                  desc: 'Counts neutrons leaking from the surface. Hydrogen (water ice) absorbs them, so it "smells" buried ice.' },
  radar_sounder:{ name: 'Ice-penetrating radar sounder', icon: '🧊', kind: 'radar', mass: 35, power: 80, cost: 30, data: 4000, dev: 6,
                  desc: 'Low-frequency radar that sees kilometres into ice and dry soil to find layers and buried water.' },
  magnetometer: { name: 'Magnetometer', icon: '🧲', kind: 'insitu', mass: 5, power: 4, cost: 6, data: 10, dev: 2,
                  desc: 'Measures magnetic fields. A salty ocean under ice produces a tell-tale induced field.' },
  particles:    { name: 'Radiation & particle detector', icon: '☢️', kind: 'insitu', mass: 6, power: 8, cost: 7, data: 20, dev: 2,
                  desc: 'Measures charged particles and radiation dose — vital knowledge for astronauts.' },
  atmo:         { name: 'Atmospheric sounder', icon: '🌫️', kind: 'thermal', mass: 40, power: 45, cost: 30, data: 2500, dev: 5,
                  desc: 'Measures temperature, dust and water vapour at many heights in the atmosphere.' },
  gravity:      { name: 'Radio-science package', icon: '🌀', kind: 'insitu', mass: 3, power: 10, cost: 6, data: 5, dev: 2,
                  desc: 'Uses tiny Doppler shifts in the radio signal to map gravity — revealing hidden mass and interiors.' },
};

const TIER = {
  1: { name: 'Basic',    m: 1,   p: 1,   c: 1,   d: 1,   q: 1,    dev: 0 },
  2: { name: 'Advanced', m: 1.6, p: 1.6, c: 1.9, d: 2.5, q: 1.35, dev: 3 },
};

/* ------------------------------------------------------------------ */
/* ORBITS                                                               */
/* insertDv: Δv the spacecraft itself must provide (m/s)                */
/* skDv: station-keeping Δv per year · natLife: years before decay/crash */
/* res: resolution factor · light: sunlight quality for optical imaging */
/* contact: multiplier on ground-contact hours · rad: krad / year        */
/* ------------------------------------------------------------------ */
const ORBITS = {
  leo400: { name: 'Low Earth Orbit · 400 km', short: 'LEO 400 km', insertDv: 0, skDv: 70, natLife: 1.5, eclipse: 0.38, eclipseH: 0.6,
            res: 1.25, light: 1, contact: 1, rad: 0.3, viz: { a: 1.12, e: 0 },
            desc: 'Close to Earth → sharp images. But thin air drags the satellite down within ~1–2 years unless thrusters keep boosting it. Does not pass over the poles.',
            pros: ['Sharpest images', 'Cheapest to reach'], cons: ['Air drag: needs propellant', 'No polar coverage'] },
  sso:    { name: 'Sun-synchronous orbit · 600 km', short: 'SSO 600 km', insertDv: 0, skDv: 8, natLife: 15, eclipse: 0.35, eclipseH: 0.6,
            res: 1.0, light: 1.1, contact: 1, rad: 1, rideshare: true, viz: { a: 1.18, e: 0 },
            desc: 'Crosses every place at the same local time (~10:30 am), so lighting is always consistent. Covers the whole globe. The classic Earth-observation orbit.',
            pros: ['Consistent lighting', 'Global coverage', 'Rideshare available'], cons: ['Daily eclipses need batteries'] },
  ddsso:  { name: 'Dawn–dusk SSO · 700 km', short: 'Dawn–dusk SSO', insertDv: 0, skDv: 5, natLife: 30, eclipse: 0.02, eclipseH: 0.3,
            res: 0.95, light: 0.5, contact: 1, rad: 1.2, viz: { a: 1.22, e: 0 },
            desc: 'Rides the line between day and night: almost always in sunlight (great for power) — but the ground below is at sunrise/sunset, with long shadows. Poor for optical images.',
            pros: ['Almost no eclipse', 'Small batteries are fine'], cons: ['Low sun → weak optical images'] },
  geo:    { name: 'Geostationary orbit · 35,786 km', short: 'GEO', launchClass: 'GEO', insertDv: 1500, skDv: 50, natLife: 99, eclipse: 0.01, eclipseH: 1.2,
            res: 0.15, light: 1, contact: 3, rad: 5, viz: { a: 2.6, e: 0 },
            desc: 'Orbits once per day, so it hovers over one spot and watches a whole hemisphere non-stop — but from ~90× farther away than LEO, so images are blurry.',
            pros: ['Continuous watch, instant alerts', '24 h ground contact'], cons: ['Low resolution', 'Big orbit-raising burn'] },

  llo50:  { name: 'Low lunar polar orbit · 50 km', short: 'LLO 50 km', insertDv: 900, skDv: 160, natLife: 0.4, eclipse: 0.45, eclipseH: 0.8,
            res: 1.4, light: 1, contact: 0.9, rad: 3, viz: { a: 1.08, e: 0 },
            desc: 'Skims 50 km above the surface. Best detail, but the Moon\'s lumpy gravity ("mascons") pulls the orbit down fast — lots of propellant, or you crash within months.',
            pros: ['Best resolution', 'Best gravity mapping'], cons: ['Unstable: heavy station-keeping'] },
  lpo100: { name: 'Lunar polar orbit · 100 km', short: 'LPO 100 km', insertDv: 850, skDv: 60, natLife: 1, eclipse: 0.42, eclipseH: 0.8,
            res: 1.0, light: 1, contact: 0.9, rad: 3, viz: { a: 1.15, e: 0 },
            desc: 'The proven workhorse orbit. Sees the entire Moon including the polar craters.',
            pros: ['Global coverage', 'Balanced'], cons: ['Regular station-keeping'] },
  nrho:   { name: 'Near-rectilinear halo orbit', short: 'NRHO', insertDv: 450, skDv: 6, natLife: 15, eclipse: 0.03, eclipseH: 1.2,
            res: 0.3, light: 1, contact: 1.6, rad: 3, viz: { a: 2.4, e: 0.75 },
            desc: 'A long, stretched orbit like the one planned for the Gateway station. Very stable and always in view of Earth, but spends most of its time far from the surface.',
            pros: ['Very stable, cheap to keep', 'Constant Earth contact'], cons: ['Far away → low detail'] },

  mlo:    { name: 'Low Mars polar orbit · 300 km', short: 'Low Mars orbit', insertDv: 1450, skDv: 10, natLife: 20, eclipse: 0.4, eclipseH: 0.75,
            res: 1.2, light: 1, contact: 1, rad: 3, aerobrake: true, viz: { a: 1.12, e: 0 },
            desc: 'Circular, low orbit over the poles — sees all of Mars every few days in high resolution. Needs the biggest braking burn, unless you aerobrake.',
            pros: ['High resolution', 'Global coverage'], cons: ['Big insertion burn'] },
  melip:  { name: 'Elliptical Mars orbit', short: 'Elliptical', insertDv: 850, skDv: 5, natLife: 50, eclipse: 0.15, eclipseH: 1.2,
            res: 0.55, light: 1, contact: 1, rad: 3, viz: { a: 2.2, e: 0.65 },
            desc: 'A cheaper capture orbit: dives close once per orbit, then swings far out. Mixed near and far views.',
            pros: ['Cheaper insertion', 'Wide views'], cons: ['Mostly far from the surface'] },
  areo:   { name: 'Areostationary orbit · 17,000 km', short: 'Areostationary', insertDv: 1300, skDv: 30, natLife: 99, eclipse: 0.01, eclipseH: 1.1,
            res: 0.25, light: 1, contact: 1, rad: 3, viz: { a: 2.6, e: 0 },
            desc: 'Mars\' version of geostationary: hovers over one longitude and watches the weather non-stop.',
            pros: ['Continuous weather watch'], cons: ['Low resolution', 'One hemisphere only'] },

  jflyby: { name: 'Jupiter orbit with ~45 Europa flybys', short: 'Europa flybys', insertDv: 900, skDv: 45, natLife: 99, eclipse: 0.02, eclipseH: 3,
            res: 1.0, light: 1, contact: 1, rad: 120, duty: 0.15, viz: { a: 2.4, e: 0.6 },
            desc: 'Orbit Jupiter and dive past Europa again and again, escaping the worst radiation between passes. Science happens mainly during each flyby.',
            pros: ['Much lower radiation dose', 'Good coverage over time'], cons: ['Long mission needed', 'Data only near flybys'] },
  eorbit: { name: 'Orbit Europa · 100 km', short: 'Europa orbit', insertDv: 2300, skDv: 30, natLife: 99, eclipse: 0.45, eclipseH: 1.8,
            res: 1.4, light: 1, contact: 0.9, rad: 900, viz: { a: 1.12, e: 0 },
            desc: 'Constant close-up science, but you live inside Jupiter\'s radiation belts. Electronics die quickly without heavy shielding.',
            pros: ['Best science per day'], cons: ['Extreme radiation', 'Huge braking burn'] },
  single: { name: 'Single fast flyby', short: 'Flyby', insertDv: 40, skDv: 0, natLife: 99, eclipse: 0, eclipseH: 0,
            res: 0.6, light: 1, contact: 1, rad: 30, flyby: true, maxOps: 1, viz: { a: 0, e: 1 },
            desc: 'Zoom past without stopping. Cheapest and lightest — but you only get hours of close-up observations.',
            pros: ['Cheap & light'], cons: ['Almost no observing time'] },
};

/* ------------------------------------------------------------------ */
/* MISSION SCENARIOS                                                    */
/* ------------------------------------------------------------------ */
const SCENARIOS = {
  earth: {
    id: 'earth', name: 'Wildfire Watch', body: 'Earth', icon: '🌍', level: 'Beginner', color: '#3b7be0',
    tagline: 'Earth-observation satellite',
    brief: 'Wildfires are becoming more frequent. Design a satellite that spots fires early and tracks the health of forests and farmland.',
    budget: 550, opsPerYear: 4, sunAU: 1, distAU: 0.00002, launchClass: 'LEO', cruise: 0, cruiseRad: 0,
    deadline: 36, window: 0, defaultMonths: 36,
    orbits: ['leo400', 'sso', 'ddsso', 'geo'],
    objectives: [
      { id: 'fire', name: 'Detect active wildfires', primary: true, weight: 40, months: 12,
        needs: { thermal: 0.85, multispec: 0.3, sar: 0.25 }, fit: { geo: 1.25, leo400: 0.85, sso: 1, ddsso: 0.9 } },
      { id: 'veg', name: 'Map vegetation & crop health', primary: true, weight: 30, months: 12,
        needs: { multispec: 0.85, spectrometer: 0.5, camera: 0.25 }, fit: { geo: 0.4, leo400: 0.8, sso: 1.1, ddsso: 0.6 } },
      { id: 'burn', name: 'Map burn scars through smoke & clouds', primary: false, weight: 20, months: 6,
        needs: { sar: 0.85, camera: 0.35, multispec: 0.35, thermal: 0.2 } },
      { id: 'smoke', name: 'Track smoke & air quality', primary: false, weight: 10, months: 6,
        needs: { atmo: 0.85, spectrometer: 0.5, multispec: 0.3 } },
    ],
    discovery: 'A huge wildfire outbreak has started on another continent. Emergency teams ask for urgent images.',
  },
  moon: {
    id: 'moon', name: 'Lunar Ice Hunter', body: 'Moon', icon: '🌕', level: 'Intermediate', color: '#b9bcc4',
    tagline: 'Lunar orbiter',
    brief: 'Astronauts returning to the Moon will need water. Find ice hiding in permanently shadowed polar craters, and map the terrain for safe landing sites.',
    budget: 460, opsPerYear: 8, sunAU: 1, distAU: 0.00257, launchClass: 'MOON', cruise: 1, cruiseRad: 2,
    deadline: 40, window: 0, defaultMonths: 24,
    orbits: ['llo50', 'lpo100', 'nrho'],
    objectives: [
      { id: 'ice', name: 'Map water ice in polar craters', primary: true, weight: 40, months: 12,
        needs: { neutron: 0.85, spectrometer: 0.4, radar_sounder: 0.4, altimeter: 0.2 } },
      { id: 'topo', name: 'Map terrain for landing sites', primary: true, weight: 30, months: 9,
        needs: { altimeter: 0.85, camera: 0.6 } },
      { id: 'rad', name: 'Measure radiation for astronauts', primary: false, weight: 15, months: 12,
        needs: { particles: 0.85, magnetometer: 0.3 } },
      { id: 'grav', name: 'Map the lunar gravity field', primary: false, weight: 15, months: 6,
        needs: { gravity: 0.85, altimeter: 0.3 }, fit: { llo50: 1.2, lpo100: 1, nrho: 0.35 } },
    ],
    discovery: 'Telescopes on Earth saw a bright flash: a fresh meteorite impact near the south pole!',
  },
  mars: {
    id: 'mars', name: 'Red Planet Climate', body: 'Mars', icon: '🔴', level: 'Advanced', color: '#c1502e',
    tagline: 'Mars climate orbiter',
    brief: 'Understand Mars\' weather and climate: planet-wide dust storms, the water cycle and buried ice. Launch windows to Mars open only every 26 months — miss yours and you wait.',
    budget: 780, opsPerYear: 18, sunAU: 1.52, distAU: 1.5, launchClass: 'MARS', cruise: 7, cruiseRad: 2,
    deadline: 40, window: 26, defaultMonths: 36,
    orbits: ['mlo', 'melip', 'areo'],
    objectives: [
      { id: 'weather', name: 'Track dust storms & daily weather', primary: true, weight: 35, months: 12,
        needs: { atmo: 0.85, multispec: 0.35, camera: 0.3, thermal: 0.35 }, fit: { areo: 1.3, mlo: 1, melip: 0.8 } },
      { id: 'water', name: 'Follow water & CO₂ through a full Mars year', primary: true, weight: 30, months: 23,
        needs: { spectrometer: 0.85, atmo: 0.5, neutron: 0.25 } },
      { id: 'ice', name: 'Find buried ice', primary: false, weight: 20, months: 12,
        needs: { radar_sounder: 0.85, neutron: 0.5, thermal: 0.2 }, fit: { areo: 0.3, melip: 0.6 } },
      { id: 'geo', name: 'High-resolution geology', primary: false, weight: 15, months: 12,
        needs: { camera: 0.85, spectrometer: 0.35, multispec: 0.3 } },
    ],
    discovery: 'A new dark streak appeared on a crater wall — maybe briny water flowing on the surface!',
  },
  europa: {
    id: 'europa', name: 'Ocean World Explorer', body: 'Europa', icon: '🔵', level: 'Expert', color: '#d8c8a8',
    tagline: 'Jupiter / Europa probe',
    brief: 'Beneath Europa\'s ice lies a global ocean — one of the best places to look for life beyond Earth. Jupiter is far away, dim and bathed in deadly radiation.',
    budget: 1250, opsPerYear: 40, sunAU: 5.2, distAU: 5.2, launchClass: 'JUPITER', cruise: 66, cruiseRad: 3,
    deadline: 60, window: 13, defaultMonths: 48,
    orbits: ['jflyby', 'eorbit', 'single'],
    objectives: [
      { id: 'shell', name: 'Measure ice-shell thickness', primary: true, weight: 35, months: 18,
        needs: { radar_sounder: 0.85, altimeter: 0.3, gravity: 0.25 } },
      { id: 'ocean', name: 'Confirm the ocean & its saltiness', primary: true, weight: 30, months: 18,
        needs: { magnetometer: 0.85, gravity: 0.4, particles: 0.2 } },
      { id: 'comp', name: 'Surface chemistry & habitability', primary: false, weight: 20, months: 12,
        needs: { spectrometer: 0.85, thermal: 0.3, camera: 0.25 } },
      { id: 'map', name: 'Map future lander sites', primary: false, weight: 15, months: 12,
        needs: { camera: 0.85, altimeter: 0.35 } },
    ],
    discovery: 'Space telescopes hint at a water plume erupting from Europa\'s south pole!',
  },
};

/* ------------------------------------------------------------------ */
/* SPACECRAFT PARTS                                                     */
/* ------------------------------------------------------------------ */
const PARTS = {
  structure: { label: 'Structure', owner: 'SE', options: {
    small:     { name: 'Small-sat bus', frac: 0.12, cost: 3, dev: 0, maxDry: 250, desc: 'Light, standardised frame. Only for spacecraft under 250 kg (dry).' },
    aluminum:  { name: 'Aluminium honeycomb', frac: 0.2, cost: 10, dev: 0, desc: 'Classic, robust and affordable — but heavier than composites.' },
    composite: { name: 'Carbon composite', frac: 0.12, cost: 30, dev: 4, adv: true, desc: 'Very stiff and light, but expensive and slower to qualify.' },
  }},
  computer: { label: 'Flight computer & storage', owner: 'SE', options: {
    cots:    { name: 'Commercial computer', mass: 1, power: 8, cost: 1, dev: 0, storage: 64, radTol: 5, desc: 'Phone-class chip. Cheap and fast, but radiation can corrupt or kill it. 64 Gbit storage.' },
    radtol:  { name: 'Radiation-tolerant', mass: 4, power: 15, cost: 6, dev: 1, storage: 512, radTol: 50, desc: 'Designed to survive moderate radiation. 512 Gbit storage.' },
    radhard: { name: 'Radiation-hardened', mass: 8, power: 25, cost: 18, dev: 2, storage: 2048, radTol: 300, desc: 'Slow but nearly bullet-proof — the kind used on Mars rovers. 2 Tbit storage.' },
  }},
  adcs: { label: 'Attitude control (pointing)', owner: 'SE', options: {
    mtq:     { name: 'Magnetorquers only', mass: 2, power: 5, cost: 1, dev: 0, level: 1, nearEarth: true, desc: 'Push against Earth\'s magnetic field. Cheap but coarse — and useless away from Earth.' },
    rw:      { name: 'Reaction wheels + star tracker', mass: 18, power: 40, cost: 9, dev: 1, level: 2, desc: 'Spinning wheels turn the spacecraft precisely; a star camera tells it where it points.' },
    precise: { name: 'Precision pointing', mass: 35, power: 65, cost: 24, dev: 3, level: 3, adv: true, desc: 'Extra-stable control for the sharpest images and big antennas.' },
  }},
  propulsion: { label: 'Propulsion', owner: 'SE', options: {
    none:   { name: 'No propulsion', mass: 0, power: 0, cost: 0, isp: 0, dev: 0, desc: 'Lightest and simplest — but you cannot change orbit, dodge debris or fight drag.' },
    cold:   { name: 'Cold-gas thrusters', mass: 5, power: 5, cost: 2, isp: 65, dev: 0, desc: 'Puffs of compressed gas. Simple and safe but very inefficient (low Isp).' },
    mono:   { name: 'Monopropellant', mass: 20, power: 15, cost: 6, isp: 225, dev: 1, desc: 'Hydrazine thrusters: the standard for orbit adjustments. Reliable, moderate efficiency.' },
    biprop: { name: 'Bipropellant engine', mass: 45, power: 20, cost: 14, isp: 320, dev: 2, desc: 'Fuel + oxidiser: efficient and powerful. Built for big orbit-insertion burns.' },
    ion:    { name: 'Electric ion engine', mass: 60, power: 0, cost: 35, isp: 3000, dev: 6, adv: true, needsW: 1000, desc: '10× more efficient than chemical, but needs ≥ 1 kW of solar power and thrusts gently — big burns take months.' },
  }},
  propMargin: { label: 'Propellant reserve', owner: 'SE', options: {
    10: { name: '+10%', margin: 0.10, desc: 'Just enough. Little room for surprises.' },
    25: { name: '+25%', margin: 0.25, desc: 'Room for avoidance manoeuvres and retargeting.' },
    50: { name: '+50%', margin: 0.50, desc: 'Plenty for surprises and a possible extended mission — but heavier.' },
  }},
  shielding: { label: 'Radiation shielding', owner: 'SE', options: {
    none:  { name: 'Minimal', mass: 0, cost: 0, factor: 1, dev: 0, desc: 'Only the spacecraft walls protect the electronics.' },
    std:   { name: 'Spot shielding', mass: 15, cost: 3, factor: 0.35, dev: 0, desc: 'Extra metal around the most sensitive boxes. Cuts dose by ~65%.' },
    vault: { name: 'Radiation vault', mass: 150, cost: 25, factor: 0.06, dev: 3, desc: 'A thick titanium box holding all electronics. Cuts dose by ~94%.' },
  }},
  redundancy: { label: 'Redundancy', owner: 'SE', options: {
    single: { name: 'Single string', mult: 1, fail: 1, spares: 0, dev: 0, desc: 'One of everything. Lighter and cheaper — any failure can end the mission.' },
    dual:   { name: 'Fully redundant', mult: 1.35, fail: 1, spares: 2, dev: 4, desc: 'Backup computer, wheels and radio. +35% avionics mass & cost, far more robust.' },
  }},
  power: { label: 'Power source', owner: 'SE', options: {
    body:    { name: 'Body-mounted solar cells', w1: 80, mass: 4, cost: 2, dev: 0, desc: 'Cells glued to the spacecraft body. Simple, but little power.' },
    deploy3: { name: 'Solar array · 3 m²', w1: 900, mass: 18, cost: 9, dev: 0, desc: 'Fold-out panels: ~900 W in Earth\'s sunlight.' },
    deploy10:{ name: 'Solar wings · 10 m²', w1: 3000, mass: 55, cost: 25, dev: 1, desc: 'Two large wings: ~3 kW at Earth.' },
    huge:    { name: 'Giant solar wings · 60 m²', w1: 16000, mass: 300, cost: 80, dev: 3, adv: true, desc: 'Enormous wings (Juno-style) — the only way to use solar power at Jupiter.' },
    rtg:     { name: 'Radioisotope generator (RTG)', rtg: 115, mass: 45, cost: 95, dev: 12, desc: 'Heat from decaying plutonium-238 → steady power anywhere, day or night. Very expensive and slow to approve.' },
    rtg2:    { name: 'Two RTGs', rtg: 230, mass: 90, cost: 180, dev: 12, adv: true, desc: 'Double the nuclear power — and double the price.' },
  }},
  battery: { label: 'Battery', owner: 'SE', options: {
    s:  { name: '150 Wh', wh: 150, mass: 1.5, cost: 0.5, desc: 'Small pack — fine for tiny loads or no eclipses.' },
    m:  { name: '600 Wh', wh: 600, mass: 5, cost: 2, desc: 'Medium pack.' },
    l:  { name: '2,000 Wh', wh: 2000, mass: 16, cost: 5, desc: 'Large pack for long eclipses or hungry instruments.' },
    xl: { name: '6,000 Wh', wh: 6000, mass: 50, cost: 12, desc: 'Huge pack for very long eclipses.' },
  }},
  antenna: { label: 'Antenna & radio', owner: 'CL', options: {
    lga:   { name: 'S-band omni antenna', mass: 2, power: 15, cost: 2, r1: 0.3, max: 2000, level: 0, dev: 0, desc: 'Talks in all directions — no pointing needed — but the signal is very weak over distance.' },
    mga:   { name: 'S-band medium-gain', mass: 6, power: 30, cost: 5, r1: 8, max: 8000, level: 1, dev: 0, desc: 'A small directional antenna. Moderate rate, rough pointing is enough.' },
    xhga:  { name: 'X-band dish · 1.5 m', mass: 25, power: 70, cost: 18, r1: 250, max: 150000, level: 2, dev: 1, desc: 'High-gain dish: focused beam, high data rate. Must be pointed accurately at Earth.' },
    kahga: { name: 'Ka-band dish · 3 m', mass: 55, power: 110, cost: 40, r1: 2500, max: 600000, level: 2, dev: 3, adv: true, desc: 'Large, very high-rate dish. Needs fine pointing and lots of power.' },
  }},
  ground: { label: 'Ground stations', owner: 'CL', options: {
    uni:        { name: 'University station', hours: 1.5, gain: 0.002, perYear: 0.3, desc: 'A small campus dish: a few short passes per day. Far too small for deep space.' },
    commercial: { name: 'Commercial network', hours: 5, gain: 0.02, perYear: 2.5, desc: 'Rented antennas around the world. Many passes per day near Earth.' },
    dsn:        { name: 'Deep Space Network', hours: 8, gain: 1, perYear: 9, desc: 'Giant 34 m dishes in California, Spain and Australia. Essential beyond the Moon — and expensive.' },
  }},
};

/* ------------------------------------------------------------------ */
/* LAUNCH VEHICLES · cap = kg delivered to each destination class        */
/* ------------------------------------------------------------------ */
const LAUNCHERS = {
  rideshare:  { name: 'Rideshare slot', cost: 4, rel: 0.97, cap: { LEO: 200 }, onlyOrbit: ['sso'],
                desc: 'Share a rocket with dozens of other satellites. Very cheap — but you go where the main customer goes (SSO) and mass is limited.' },
  small:      { name: 'Small launcher', cost: 9, rel: 0.93, cap: { LEO: 350, MOON: 40 },
                desc: 'A dedicated small rocket. You pick the orbit, but it only lifts light spacecraft.' },
  medium:     { name: 'Medium launcher', cost: 70, rel: 0.98, cap: { LEO: 15000, GEO: 5500, MOON: 3000, MARS: 2400 },
                desc: 'A proven workhorse. Plenty for Earth and Moon missions, limited for deep space.' },
  heavy:      { name: 'Heavy launcher', cost: 150, rel: 0.96, cap: { LEO: 50000, GEO: 18000, MOON: 12000, MARS: 9000, JUPITER: 3800 },
                desc: 'Very powerful. Reaches Jupiter using planetary gravity assists (~5.5-year trip).' },
  superheavy: { name: 'Super-heavy launcher', cost: 600, rel: 0.93, cap: { LEO: 95000, GEO: 35000, MOON: 27000, MARS: 20000, JUPITER: 7500 },
                cruiseMult: { JUPITER: 0.45, MARS: 0.85 },
                desc: 'Enormous and new. Sends heavy probes straight to Jupiter (~2.5 years) — at a huge price and with less flight history.' },
};

const DEST_NAME = { LEO: 'low Earth orbit', GEO: 'geostationary transfer', MOON: 'the Moon', MARS: 'Mars', JUPITER: 'Jupiter' };

/* ------------------------------------------------------------------ */
/* DESIGN STEPS                                                         */
/* ------------------------------------------------------------------ */
const STEPS = [
  { id: 'mission', name: 'Mission',      icon: '🎯', owner: 'MM' },
  { id: 'orbit',   name: 'Orbit',        icon: '🪐', owner: 'MM' },
  { id: 'payload', name: 'Instruments',  icon: '🔬', owner: 'SL' },
  { id: 'bus',     name: 'Spacecraft',   icon: '🛠️', owner: 'SE' },
  { id: 'power',   name: 'Power',        icon: '⚡', owner: 'SE' },
  { id: 'comms',   name: 'Comms',        icon: '📡', owner: 'CL' },
  { id: 'launch',  name: 'Launch',       icon: '🚀', owner: 'MM' },
  { id: 'review',  name: 'Design review',icon: '✅', owner: 'ALL' },
];

const LEARN = {
  mission: 'Every real mission starts with <b>objectives</b>: what science questions must be answered? <b>Primary</b> objectives define success; secondary ones add value. The mission <b>duration</b> matters too: some phenomena (like seasons) take a long time to observe, but every extra month costs operations money.',
  orbit: 'The orbit decides <b>what you can see</b> (resolution, coverage), <b>how much sunlight</b> you get (eclipses drain batteries), <b>how much propellant</b> you need (Δv, "delta-v" = change in velocity), and how harsh the <b>radiation</b> is. There is no perfect orbit — only trade-offs.',
  payload: 'Instruments are why you fly. Each one adds <b>science value</b>, but also <b>mass, power, cost and data</b>. Advanced versions see more but cost much more. Pick instruments that match your objectives: a camera cannot see buried ice!',
  bus: 'The <b>bus</b> is the spacecraft itself: structure, computer, pointing, propulsion and protection. The <b>rocket equation</b> means propellant mass grows exponentially with Δv — efficient engines (high Isp) need far less fuel. Radiation slowly kills electronics; shielding and hardened parts buy lifetime.',
  power: 'Sunlight weakens with the <b>square of the distance</b> from the Sun: at Mars you get 43% of Earth\'s sunlight, at Jupiter only 3.7%. In <b>eclipse</b> (planet\'s shadow) everything runs on batteries. Far from the Sun, radioisotope generators (RTGs) may be the only option.',
  comms: 'Data you cannot send home is worthless. Radio signals weaken with the <b>square of the distance</b>: Mars is ~60,000× farther than a LEO satellite\'s ground pass, so signals are billions of times weaker. Bigger dishes, higher frequencies (X→Ka band) and bigger ground antennas fight back.',
  launch: 'The rocket must lift your fully-fuelled (<b>wet</b>) mass to the destination. Engineers keep a <b>mass margin</b> because spacecraft always get heavier during development. Planetary missions also have <b>launch windows</b> — miss one and you wait for the planets to line up again.',
  review: 'Before launch, every subsystem lead signs off in a <b>design review</b>. Check that each resource has margin and that the team agrees on the trade-offs. In team mode, each player must approve — negotiate if your goals conflict!',
};

const GLOSSARY = [
  ['Δv (delta-v)', 'The change in velocity a spacecraft can make with its propellant. Every orbit change "costs" Δv.'],
  ['Isp (specific impulse)', 'Engine efficiency. Higher Isp = more Δv from the same propellant. Cold gas ≈ 65 s, hydrazine ≈ 225 s, ion ≈ 3000 s.'],
  ['Rocket equation', 'Propellant mass = dry mass × (e^(Δv / (Isp·g₀)) − 1). Doubling Δv more than doubles the propellant.'],
  ['Wet / dry mass', 'Dry mass is the spacecraft without propellant; wet mass includes it. Rockets must lift the wet mass.'],
  ['Mass margin', 'Spare launch capacity. Spacecraft always grow during development, so engineers keep 10–30% margin.'],
  ['Inverse-square law', 'Sunlight and radio signals spread out with distance: twice as far → one quarter as strong.'],
  ['Eclipse', 'Time spent in a planet\'s shadow. Solar panels produce nothing; batteries must carry the load.'],
  ['Downlink', 'Sending data from the spacecraft to Earth. Limited by antenna size, power, distance and ground-station time.'],
  ['Station-keeping', 'Small regular burns that keep a spacecraft in its orbit against drag or gravity disturbances.'],
  ['Radiation dose (krad)', 'Accumulated radiation absorbed by electronics. When it exceeds a part\'s tolerance, failures become likely.'],
  ['Redundancy', 'Carrying backup units so that a single failure does not end the mission.'],
  ['Launch window', 'The period when planets are aligned for an efficient transfer. Earth→Mars windows occur every ~26 months.'],
  ['Aerobraking', 'Dipping through a planet\'s upper atmosphere to slow down using drag instead of propellant. Saves fuel, costs time.'],
  ['Duty cycle', 'The fraction of time an instrument is switched on and collecting data.'],
  ['RTG', 'Radioisotope Thermoelectric Generator: converts heat from plutonium-238 decay into electricity. Works anywhere, for decades.'],
];
