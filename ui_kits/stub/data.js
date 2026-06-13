/* STUB — data: brand, vibe themes, seed party + guests. */
(function () {
  window.STUB = window.STUB || {};

  // One-line brand swap.
  STUB.BRAND = 'Stub';

  // Per-event "vibe" themes — the moments of vibrance. Each drives the
  // invite + collectible pass. accent = punch color, grad = cover, ink = text on accent.
  STUB.THEMES = {
    lime:   { name: 'Citrus',   accent: '#c6f24e', ink: '#14210a', grad: 'linear-gradient(150deg,#d7f96a,#7ec850 55%,#1f6b3a)' },
    coral:  { name: 'Sunset',   accent: '#ff6f61', ink: '#2a0f0b', grad: 'linear-gradient(150deg,#ffb35a,#ff6f61 55%,#b3325a)' },
    violet: { name: 'Afterhrs', accent: '#b18cff', ink: '#1a0f2e', grad: 'linear-gradient(150deg,#c9a9ff,#8a5bff 55%,#3a1d77)' },
    cyan:   { name: 'Pool',     accent: '#57d7e6', ink: '#062028', grad: 'linear-gradient(150deg,#7fe9e6,#37b6d6 55%,#1d4f8a)' },
    pink:   { name: 'Heartrate',accent: '#ff7eb6', ink: '#2a0c1c', grad: 'linear-gradient(150deg,#ffa9cf,#ff5e9e 55%,#7a2a6a)' },
    gold:   { name: 'Goldhour', accent: '#f6c945', ink: '#241a04', grad: 'linear-gradient(150deg,#ffe08a,#f6b73f 55%,#9a5a1f)' },
  };
  STUB.THEME_KEYS = ['lime', 'coral', 'violet', 'cyan', 'pink', 'gold'];

  // Holographic finishes (Balatro-inspired) for the collectible creator.
  STUB.HOLO = ['none', 'foil', 'holo-rb', 'poly', 'glitter', 'gold', 'negative'];
  STUB.HOLO_LABEL = { none: 'Matte', foil: 'Foil', 'holo-rb': 'Holo', poly: 'Polychrome', glitter: 'Glitter', negative: 'Negative', gold: 'Gold' };
  STUB.SHAPES = [
    { id: 'auto', label: 'Fit photo' },
    { id: 'card', label: 'Card' },
    { id: 'ticket', label: 'Ticket' },
    { id: 'square', label: 'Square' },
  ];

  // Animated background scenes shown BEHIND the collectible (Balatro-menu style).
  STUB.SCENES = [
    { id: 'calm',   label: 'Calm',   anim: false },
    { id: 'creme',  label: 'Crème',  anim: false },
    { id: 'stars',  label: 'Stars',  anim: true },
    { id: 'plasma', label: 'Plasma', anim: true },
    { id: 'nebula', label: 'Nebula', anim: true },
    { id: 'lava',   label: 'Lava',   anim: true },
    { id: 'aurora', label: 'Aurora', anim: true },
    { id: 'solar',  label: 'Solar',  anim: true },
    { id: 'steel',  label: 'Steel',  anim: true },
    { id: 'lab',    label: 'Lab',    anim: false },
    { id: 'loop',   label: 'Loop',   anim: true },
    { id: 'loopbw', label: 'Loop B&W', anim: true },

    { id: 'chicot', label: 'Chicot', anim: true },
    { id: 'canio',  label: 'Canio',  anim: true },
  ];

  // Event templates by type — emoji sticker + default theme + copy.
  STUB.TEMPLATES = [
    { type: 'House party', emoji: '🏠', theme: 'violet' },
    { type: 'Birthday',    emoji: '🎂', theme: 'pink' },
    { type: 'Dinner',      emoji: '🍝', theme: 'gold' },
    { type: 'Game night',  emoji: '🎲', theme: 'lime' },
    { type: 'Club night',  emoji: '🪩', theme: 'cyan' },
    { type: 'Cookout',     emoji: '🔥', theme: 'coral' },
  ];

  // Avatar palette (initials chips, no external images).
  STUB.AV_COLORS = ['#ff7eb6', '#57d7e6', '#c6f24e', '#b18cff', '#f6c945', '#ff6f61', '#7fe9a0', '#9ab8ff'];
  STUB.avColor = function (name) {
    var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return STUB.AV_COLORS[h % STUB.AV_COLORS.length];
  };
  STUB.initials = function (name) {
    var p = name.trim().split(/\s+/);
    return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
  };

  // Seed guests for the demo party (host view + "who's going" rows).
  STUB.SEED_GUESTS = [
    { name: 'Maya R.',   status: 'going',  plus: 1 },
    { name: 'Devon K.',  status: 'going',  plus: 0 },
    { name: 'Priya S.',  status: 'going',  plus: 0 },
    { name: 'Theo L.',   status: 'maybe',  plus: 0 },
    { name: 'Jordan A.', status: 'going',  plus: 1 },
    { name: 'Sam W.',    status: 'invited', plus: 0 },
    { name: 'Nina C.',   status: 'maybe',  plus: 0 },
    { name: 'Eli M.',    status: 'invited', plus: 0 },
    { name: 'Cass B.',   status: 'going',  plus: 0 },
  ];

  // The party the demo centers on (host already drafted it).
  STUB.SEED_EVENT = {
    title: 'Rooftop Kickback',
    type: 'House party',
    emoji: '🪩',
    theme: 'violet',
    host: 'You',
    coHost: 'Maya R.',
    date: '2026-06-20',
    time: '21:00',
    place: 'Maya\u2019s rooftop',
    address: '441 Kent Ave · Brooklyn',
    note: 'Lowkey roof hang — bring a drink, good aux privileges to whoever shows first. 🌇',
    capacity: 40,
  };
})();
