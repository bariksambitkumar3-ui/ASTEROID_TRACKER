/**
 * REFERENCE CATALOG — static fallback data used ONLY when the NASA API is
 * completely unreachable AND no cached real data exists.
 *
 * This data is NEVER presented as live/real-time. The dashboard labels it
 * clearly as "Reference Catalog" with no fake retrieval timestamp.
 *
 * The approach dates below are computed relative to the current date so they
 * look plausible, but the data is deterministic (same seed = same objects).
 * No hardcoded years — the seed uses a fixed orbit constant, not a calendar year.
 */

// Deterministic pseudo-random generator (fixed seed = reproducible data)
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Fixed orbital constant as seed — NOT tied to any calendar year
const rand = rng(0x4f726269); // 0x4f726269 = ASCII "Orbi"

const CLASSES = [
  { name: 'Apollo',    neo: true,  w: 0.32 },
  { name: 'Amor',      neo: true,  w: 0.24 },
  { name: 'Aten',      neo: true,  w: 0.10 },
  { name: 'Atira',     neo: true,  w: 0.04 },
  { name: 'Main Belt', neo: false, w: 0.22 },
  { name: 'Trojan',    neo: false, w: 0.08 },
];

function pickClass() {
  let r = rand();
  for (const c of CLASSES) {
    if ((r -= c.w) <= 0) return c;
  }
  return CLASSES[0];
}

const DAY_MS = 86_400_000;

// Approach dates are offsets from "now" so they always look upcoming,
// regardless of which year the app is run. No hardcoded year values.
export const ASTEROIDS_DATA = Array.from({ length: 72 }, (_, i) => {
  const cls = pickClass();
  const diameter   = Math.round(Math.pow(10, 0.8 + rand() * 2.9)); // ~6 m – 5 km
  const velocity   = +(5 + rand() * 30).toFixed(2);                 // km/s
  const missKm     = Math.round((cls.neo ? 0.4 + rand() * 40 : 20 + rand() * 300) * 384_400);
  const hazardous  = cls.neo && diameter > 140 && missKm < 7_480_000;

  // Sequential designations using generic NEO naming (no year embedded)
  const letter1 = String.fromCharCode(65 + (i % 26));
  const letter2 = String.fromCharCode(65 + ((i * 7) % 26));
  const desig   = `REF-${letter1}${letter2}${String(i + 1).padStart(2, '0')}`;

  return {
    id:             desig,
    name:           desig,
    classification: cls.name,
    neo:            cls.neo,
    hazardous,
    diameter,                                                 // metres
    velocity,                                                 // km/s
    missDistance:   missKm,                                   // km
    // Approach date = relative to actual current time — no hardcoded year
    approachDate:   new Date(Date.now() + (i * 1.7 + 0.6) * DAY_MS).toISOString(),
  };
});

// Cumulative NASA catalog totals (historical — not today's NEO count)
export const ASTEROID_STATS = {
  total:   1_456_823, // All known small bodies (historical)
  neos:       39_842, // Known NEOs (historical)
  phas:        2_419, // Known PHAs (historical)
  tracked:  ASTEROIDS_DATA.length,
  comets:      4_123,
  lastUpdated: null,  // null = not from a live fetch
};
