// Helpers that turn ASTEROIDS_DATA / ASTEROID_STATS (whatever their exact shape) into
// the values the dashboard and 3D scenes need. Existing data is never modified.

const pick = (o, keys, d) => {
  for (const k of keys) {
    if (o && o[k] !== undefined && o[k] !== null) return o[k];
  }
  return d;
};

const NEO_CLASSES = ['apollo', 'aten', 'amor', 'atira', 'neo'];

/**
 * Visual styling and metadata for threat levels:
 * - Red for dangerous
 * - Yellow for medium
 * - Green for safe
 */
export const THREAT_CONFIG = {
  dangerous: {
    level: 'dangerous',
    label: 'Dangerous',
    badge: 'Dangerous',
    hex: '#ef4444',
    rgb: [239, 68, 68],
    threeHex: 0xef4444,
    twText: 'text-red-400',
    twBg: 'bg-red-500/15',
    twBorder: 'border-red-500/30',
    twDot: 'bg-red-500',
    glow: 'rgba(239, 68, 68, 0.95)',
    dimGlow: 'rgba(239, 68, 68, 0.25)',
    description: 'Potentially Hazardous Asteroid (PHA) or high impact/close approach risk',
  },
  medium: {
    level: 'medium',
    label: 'Medium Caution',
    badge: 'Medium',
    hex: '#eab308',
    rgb: [234, 179, 8],
    threeHex: 0xeab308,
    twText: 'text-amber-400',
    twBg: 'bg-amber-500/15',
    twBorder: 'border-amber-500/30',
    twDot: 'bg-amber-400',
    glow: 'rgba(234, 179, 8, 0.95)',
    dimGlow: 'rgba(234, 179, 8, 0.25)',
    description: 'Moderate size or within 12M km flyby distance',
  },
  safe: {
    level: 'safe',
    label: 'Safe',
    badge: 'Safe',
    hex: '#10b981',
    rgb: [16, 185, 129],
    threeHex: 0x10b981,
    twText: 'text-emerald-400',
    twBg: 'bg-emerald-500/15',
    twBorder: 'border-emerald-500/30',
    twDot: 'bg-emerald-400',
    glow: 'rgba(16, 185, 129, 0.95)',
    dimGlow: 'rgba(16, 185, 129, 0.25)',
    description: 'Comfortable flyby distance & non-hazardous small body',
  },
};

/**
 * Determine asteroid threat category:
 * - 'dangerous' (Red)
 * - 'medium' (Yellow)
 * - 'safe' (Green)
 */
export function getThreatLevel(a) {
  const isHazardous = Boolean(
    pick(a, ['hazardous', 'isHazardous', 'is_potentially_hazardous_asteroid', 'pha', 'potentiallyHazardous'], false)
  );

  const diameter = Number(pick(a, ['diameter', 'diameterM', 'size', 'estimatedDiameter'], 0)) || 0;
  const missKm = Number(pick(a, ['missKm', 'missDistance', 'distance', 'miss_distance_km'], 0)) || 0;
  const velocity = Number(pick(a, ['velocity', 'velocityKmS', 'speed', 'relativeVelocity'], 0)) || 0;

  // 1. Red (Dangerous): Flagged hazardous, or NASA PHA threshold (diameter >= 140m & miss distance <= 7,500,000 km)
  if (isHazardous || (diameter >= 140 && missKm > 0 && missKm <= 7500000)) {
    return 'dangerous';
  }

  // 2. Yellow (Medium): Moderate risk threshold (close flyby < 12M km, or moderate size >= 60m, or fast close approach)
  if ((missKm > 0 && missKm <= 12000000) || diameter >= 60 || (velocity >= 25 && missKm > 0 && missKm <= 20000000)) {
    return 'medium';
  }

  // 3. Green (Safe): Safe small body / distant flyby
  return 'safe';
}

export function normalizeAsteroid(a, i) {
  const type = String(
    pick(a, ['classification', 'class', 'orbitClass', 'orbit_class', 'orbitalClass', 'type'], 'Unknown')
  );
  const neoRaw = pick(a, ['neo', 'isNeo', 'is_neo', 'nearEarth'], undefined);
  const diameter =
    Number(pick(a, ['diameter', 'diameterM', 'diameter_m', 'size', 'estimatedDiameter'], 0)) || 0;
  const hazardous = Boolean(
    pick(a, ['hazardous', 'isHazardous', 'pha', 'is_potentially_hazardous', 'is_potentially_hazardous_asteroid', 'potentiallyHazardous'], false)
  );
  const missKm =
    Number(pick(a, ['missDistance', 'missKm', 'distance', 'miss_distance_km', 'distanceKm'], 0)) || 0;
  const velocity =
    Number(pick(a, ['velocity', 'velocityKmS', 'speed', 'relativeVelocity', 'velocity_kms'], 0)) || 0;
  const date = pick(a, ['approachDate', 'date', 'closeApproachDate', 'close_approach_date'], null);

  const threatLevel = a.threatLevel || getThreatLevel({ hazardous, diameter, missKm, velocity });
  const threatInfo = THREAT_CONFIG[threatLevel] || THREAT_CONFIG.safe;

  return {
    id: pick(a, ['id', 'designation', 'name'], i),
    name: String(pick(a, ['name', 'fullname', 'designation', 'id'], `Asteroid ${i + 1}`)).replace(/[()]/g, '').trim(),
    type,
    diameter,
    velocity,
    hazardous,
    neo: neoRaw === undefined ? NEO_CLASSES.includes(type.toLowerCase()) : Boolean(neoRaw),
    missKm,
    missAu: Number(pick(a, ['missAu', 'miss_distance_au'], missKm ? +(missKm / 149597870.7).toFixed(4) : 0)),
    date,
    threatLevel,
    threatColor: threatInfo.hex,
    threatLabel: threatInfo.label,
    isRealtime: Boolean(a.isRealtime),
    nasaJplUrl: a.nasaJplUrl || null,
  };
}

export function getAsteroids(raw) {
  const arr = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
  return arr.map(normalizeAsteroid);
}

const SIZE_BUCKETS = [
  { label: '< 25 m', max: 25 },
  { label: '25–100 m', max: 100 },
  { label: '100–500 m', max: 500 },
  { label: '0.5–1 km', max: 1000 },
  { label: '> 1 km', max: Infinity },
];

export function computeStats(list, stats = {}) {
  const total = list.length;
  const neos = list.filter((a) => a.neo).length;
  const phas = list.filter((a) => a.hazardous || a.threatLevel === 'dangerous').length;
  const mediumCount = list.filter((a) => a.threatLevel === 'medium').length;
  const safeCount = list.filter((a) => a.threatLevel === 'safe').length;

  const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);
  const withDist = list.filter((a) => a.missKm > 0);
  const closest = withDist.length ? withDist.reduce((m, a) => (a.missKm < m.missKm ? a : m)) : null;
  const largest = list.length ? list.reduce((m, a) => (a.diameter > m.diameter ? a : m)) : null;

  const byClass = {};
  list.forEach((a) => {
    byClass[a.type] = byClass[a.type] || { name: a.type, count: 0, velSum: 0 };
    byClass[a.type].count += 1;
    byClass[a.type].velSum += a.velocity;
  });
  const classification = Object.values(byClass)
    .map((c) => ({ name: c.name, count: c.count, avgVelocity: +(c.velSum / c.count).toFixed(2) }))
    .sort((a, b) => b.count - a.count);

  const sizes = SIZE_BUCKETS.map((b) => ({ label: b.label, count: 0 }));
  list.forEach((a) => {
    const idx = SIZE_BUCKETS.findIndex((b) => a.diameter < b.max);
    sizes[idx === -1 ? sizes.length - 1 : idx].count += 1;
  });

  const threatDistribution = [
    { name: 'Dangerous', count: phas, color: THREAT_CONFIG.dangerous.hex, level: 'dangerous' },
    { name: 'Medium Caution', count: mediumCount, color: THREAT_CONFIG.medium.hex, level: 'medium' },
    { name: 'Safe', count: safeCount, color: THREAT_CONFIG.safe.hex, level: 'safe' },
  ];

  return {
    total: pick(stats, ['total', 'totalAsteroids', 'total_asteroids'], total),
    neos: pick(stats, ['neos', 'neo', 'totalNeos', 'total_neos'], neos),
    phas: pick(stats, ['phas', 'pha', 'totalPhas', 'hazardous'], phas),
    dangerousCount: phas,
    mediumCount,
    safeCount,
    threatDistribution,
    comets: pick(stats, ['comets', 'totalComets'], null),
    tracked: total,
    avgVelocity: avg(list.map((a) => a.velocity)),
    avgDiameter: avg(list.map((a) => a.diameter)),
    closest,
    largest,
    hazardousCount: phas,
    classification,
    sizes,
    lastUpdated: pick(stats, ['lastUpdated', 'updatedAt', 'last_updated'], null),
    isRealtime: Boolean(stats.isRealtime || (list.length > 0 && list[0]?.isRealtime)),
  };
}

export const fmtNum = (n, d = 0) =>
  typeof n === 'number' && isFinite(n)
    ? n.toLocaleString('en-US', { maximumFractionDigits: d })
    : '—';

export function upcomingApproaches(list, count = 5) {
  const now = Date.now();
  const withDate = list
    .map((a) => ({ ...a, t: a.date ? new Date(a.date).getTime() : NaN }))
    .filter((a) => !isNaN(a.t) && a.t >= now - 86400000);
  const pool = withDate.length ? withDate : list.map((a) => ({ ...a, t: NaN }));
  // sort by miss distance or approach date
  return [...pool]
    .sort((a, b) => (a.missKm || Infinity) - (b.missKm || Infinity))
    .slice(0, count);
}
