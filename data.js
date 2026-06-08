// ============================================================
// STUDYSHIFT v2 — DATA.JS
// Static fallback schedules + city info for all major cities
// ============================================================

const CITIES = {
  lahore:     { name:'Lahore',           utility:'LESCO',     province:'Punjab',           groups:8, base:[1,1,0,0,0,1,1,1,0,0,0,1,1,1,0,0,0,1,1,1,0,0,0,1], avgOutage:6,  peak:'3–5pm, 9–11pm' },
  karachi:    { name:'Karachi',          utility:'K-Electric',province:'Sindh',             groups:6, base:[1,1,1,0,0,0,1,1,1,0,0,1,1,1,0,0,1,1,1,0,0,0,1,1], avgOutage:5,  peak:'1–4pm, 7–9pm'  },
  islamabad:  { name:'Islamabad/RWP',    utility:'IESCO',     province:'Federal Territory', groups:8, base:[1,1,1,1,0,0,1,1,1,1,0,0,0,1,1,1,0,0,1,1,1,0,0,0], avgOutage:5,  peak:'11am–1pm, 5–7pm'},
  faisalabad: { name:'Faisalabad',       utility:'FESCO',     province:'Punjab',            groups:8, base:[1,1,0,0,1,1,1,0,0,0,1,1,1,1,0,0,0,1,1,0,0,0,1,1], avgOutage:7,  peak:'3–5am, 9am–12pm'},
  multan:     { name:'Multan',           utility:'MEPCO',     province:'Punjab',            groups:8, base:[0,0,1,1,1,0,0,1,1,1,0,0,1,1,1,0,0,0,1,1,1,0,0,1], avgOutage:8,  peak:'12–2am, 10am–12pm'},
  peshawar:   { name:'Peshawar',         utility:'PESCO',     province:'KPK',               groups:7, base:[1,0,0,1,1,1,0,0,0,1,1,1,0,0,0,1,1,1,0,0,1,1,0,0], avgOutage:8,  peak:'2–4am, 2–4pm'  },
  quetta:     { name:'Quetta',           utility:'QESCO',     province:'Balochistan',       groups:6, base:[0,0,0,1,1,1,0,0,1,1,1,0,0,1,1,0,0,0,1,1,1,0,0,0], avgOutage:10, peak:'12–3am, 1–3pm' },
  sialkot:    { name:'Sialkot',          utility:'LESCO',     province:'Punjab',            groups:8, base:[1,1,1,0,0,0,1,1,0,0,1,1,1,0,0,0,1,1,1,0,0,1,1,0], avgOutage:6,  peak:'3–6am, 4–6pm'  },
  gujranwala: { name:'Gujranwala',       utility:'GEPCO',     province:'Punjab',            groups:8, base:[1,0,0,0,1,1,1,0,0,1,1,1,0,0,0,1,1,1,0,0,1,1,0,0], avgOutage:7,  peak:'1–4am, 3–5pm'  },
  hyderabad:  { name:'Hyderabad',        utility:'HESCO',     province:'Sindh',             groups:6, base:[0,0,1,1,0,0,1,1,1,0,0,0,1,1,1,0,0,1,1,0,0,1,1,0], avgOutage:9,  peak:'12–2am, 9–11am' }
};

function getGroupPattern(cityKey, group) {
  const city = CITIES[cityKey];
  if (!city) return Array(24).fill(1);
  const base = city.base;
  const shift = ((parseInt(group) - 1) * 3) % 24;
  return base.map((_, i) => base[(i - shift + 24) % 24]);
}

function getScheduleBlocks(pattern) {
  if (!pattern || pattern.length === 0) return [];
  const blocks = [];
  let cur = { type: pattern[0] === 1 ? 'power' : 'off', start: 0 };
  for (let i = 1; i <= 24; i++) {
    const v = i < 24 ? pattern[i] : -1;
    if (v !== pattern[i-1] || i === 24) {
      blocks.push({ ...cur, end: i });
      if (i < 24) cur = { type: v === 1 ? 'power' : 'off', start: i };
    }
  }
  return blocks;
}

function getPowerStats(pattern) {
  const on = pattern.filter(x => x === 1).length;
  return { power: on, outage: 24 - on };
}

function getBestWindows(pattern, minH = 2) {
  return getScheduleBlocks(pattern)
    .filter(b => b.type === 'power' && (b.end - b.start) >= minH)
    .sort((a,b) => (b.end - b.start) - (a.end - a.start));
}

function fmtHour(h) {
  h = ((h % 24) + 24) % 24;
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h-12}pm`;
}

const SUBJECT_ICONS = {
  study:   'bi-book',
  online:  'bi-laptop',
  writing: 'bi-pencil',
  video:   'bi-play-circle',
  practice:'bi-journal-text',
  other:   'bi-bookmark'
};

const TIPS = [
  'Download study materials during power windows for offline use during outages.',
  'Charge all your devices fully at the start of every power window.',
  'Keep a physical notebook for outage hours — writing reinforces memory.',
  'Plan your hardest tasks for mornings — power is usually more stable before noon.',
  'Set a 15-minute alarm before predicted outages to save your work.',
  'Use offline apps like Anki, Notion offline, or Google Docs offline mode.',
  'The longest uninterrupted power window is your best deep-focus slot.',
  'Group all internet-dependent tasks in a single power window for efficiency.',
  'Solar panels and UPS can extend your study time significantly.',
  'Track your most productive outage-time tasks — many students do better reading offline.'
];
