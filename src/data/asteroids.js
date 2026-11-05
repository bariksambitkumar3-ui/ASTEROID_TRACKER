/**
 * SAMPLE DATA - replace this file with your own `ASTEROIDS_DATA` and `ASTEROID_STATS`.
 * Keep the same export names; the dashboard reads many common field names
 * (see src/utils/asteroidUtils.js) so your existing shape should work.
 */

// Small deterministic random generator so the sample data is stable between reloads.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const rand = rng(2026);
const CLASSES = [
  { name: 'Apollo', neo: true, w: 0.32 },
  { name: 'Amor', neo: true, w: 0.24 },
  { name: 'Aten', neo: true, w: 0.1 },
  { name: 'Atira', neo: true, w: 0.04 },
  { name: 'Main Belt', neo: false, w: 0.22 },
  { name: 'Trojan', neo: false, w: 0.08 },
];

function pickClass() {
  let r = rand();
  for (const c of CLASSES) {
    if ((r -= c.w) <= 0) return c;
  }
  return CLASSES[0];
}

const DAY = 86400000;

export const ASTEROIDS_DATA = Array.from({ length: 72 }, (_, i) => {
  const cls = pickClass();
  const diameter = Math.round(Math.pow(10, 0.8 + rand() * 2.9)); // ~6 m to ~5 km
  const velocity = +(5 + rand() * 30).toFixed(2);
  const missKm = Math.round((cls.neo ? 0.4 + rand() * 40 : 20 + rand() * 300) * 384400);
  const hazardous = cls.neo && diameter > 140 && missKm < 7480000;
  const year = 2026 + (i % 3 === 0 ? 1 : 0);
  return {
    id: `${year} ${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i * 7) % 26))}${i + 1}`,
    name: `${year} ${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i * 7) % 26))}${i + 1}`,
    classification: cls.name,
    neo: cls.neo,
    hazardous,
    diameter, // metres
    velocity, // km/s
    missDistance: missKm, // km
    approachDate: new Date(Date.now() + (i * 1.7 + 0.6) * DAY).toISOString(),
  };
});

const list = ASTEROIDS_DATA;
export const ASTEROID_STATS = {
  total: 1456823,
  neos: 39842,
  phas: 2419,
  tracked: list.length,
  comets: 4123,
  lastUpdated: new Date().toISOString(),
};
