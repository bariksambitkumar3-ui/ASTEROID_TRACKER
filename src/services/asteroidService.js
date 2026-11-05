import { ASTEROIDS_DATA, ASTEROID_STATS } from '../data/asteroids.js';
import {
  computeStats,
  getAsteroids,
  getThreatLevel,
  normalizeAsteroid,
  THREAT_CONFIG,
} from '../utils/asteroidUtils.js';

// Cache version — bump this to invalidate all existing caches on deploy
const CACHE_VERSION = 'v4';

// Cache TTL: 15 minutes
const CACHE_TTL_MS = 15 * 60 * 1000;

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getNasaApiKey() {
  const envKey =
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_NASA_API_KEY : undefined;
  if (envKey && envKey.trim() && envKey !== 'DEMO_KEY') {
    return { key: envKey.trim(), isCustom: true };
  }
  return { key: 'DEMO_KEY', isCustom: false };
}

/**
 * Format a Date object as YYYY-MM-DD using the LOCAL calendar date
 * (not UTC) so the window always matches the user's day.
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns today's local date string (YYYY-MM-DD).
 * Re-computed on every call — no hardcoded year, month or day.
 */
function todayString() {
  return formatDate(new Date());
}

/**
 * Returns the cache key tied to today's local date.
 * When the calendar date changes (including across a year boundary),
 * a new key is generated automatically — old entries are simply not read.
 */
function cacheKey() {
  return `ASTRA_NEO_CACHE_${CACHE_VERSION}_${todayString()}`;
}

// ─── Fallback static dataset ─────────────────────────────────────────────────
// This is ONLY used when the NASA API is unreachable AND there is no cached
// real data. It is clearly labelled as reference/fallback data throughout.
const FALLBACK_LIST = getAsteroids(ASTEROIDS_DATA);

// ─── Main fetch function ─────────────────────────────────────────────────────

/**
 * Fetch real Near-Earth Objects from NASA NeoWs for the current 7-day window.
 *
 * Date window:
 *   start = today (local calendar date, computed at call time — never hardcoded)
 *   end   = today + 6 days  (NASA maximum is 7 calendar days inclusive)
 *
 * The window auto-updates when the date changes (including year boundaries).
 * No manual year/date maintenance is needed.
 *
 * @param {boolean} bypassCache  Pass true to skip cache and force a fresh fetch.
 * @returns {Promise<FetchResult>}
 */
export async function fetchRealtimeAsteroids(bypassCache = false) {
  const { key, isCustom } = getNasaApiKey();
  const KEY = cacheKey(); // date-stamped cache key — auto-expires at midnight

  // ── 1. Check fresh cache ──────────────────────────────────────────────────
  if (!bypassCache) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const age = Date.now() - (parsed.timestamp || 0);
        if (
          age < CACHE_TTL_MS &&
          Array.isArray(parsed.list) &&
          parsed.list.length > 0 &&
          parsed.dateRange // must have been fetched with a date range
        ) {
          const list = parsed.list.map(normalizeAsteroid);
          const fetchedAt = new Date(parsed.timestamp);
          return {
            success: true,
            source: 'cache',
            isCustomKey: isCustom,
            keyUsed: isCustom ? 'Personal API Key' : 'NASA DEMO_KEY',
            list,
            stats: computeStats(list, {
              ...ASTEROID_STATS,
              isRealtime: true,
              lastUpdated: fetchedAt.toISOString(),
            }),
            message: `NASA data (cached ${Math.round(age / 60000)}m ago) · ${parsed.dateRange}`,
            fetchedAt,
            dateRange: parsed.dateRange,
          };
        }
      }
    } catch (e) {
      console.warn('[ASTRA] Cache read error:', e);
    }
  }

  // ── 2. Build dynamic date window ──────────────────────────────────────────
  // Recomputed fresh on every fetch — no hardcoded dates.
  const startDate = new Date();                      // today (local)
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + 6);          // +6 days = 7-day window (NASA max)

  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);
  const dateRange = `${startStr} → ${endStr}`;

  const url =
    `https://api.nasa.gov/neo/rest/v1/feed` +
    `?start_date=${startStr}` +
    `&end_date=${endStr}` +
    `&api_key=${encodeURIComponent(key)}`;

  // ── 3. Fetch from NASA ────────────────────────────────────────────────────
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    // ── HTTP error handling ───────────────────────────────────────────────
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error(
          'NASA rate limit reached (30 req/hr on DEMO_KEY). ' +
            'Add a free personal key at api.nasa.gov as VITE_NASA_API_KEY.'
        );
      }
      if (res.status === 403) {
        throw new Error(
          'NASA API key rejected (403). Check VITE_NASA_API_KEY in .env.'
        );
      }
      throw new Error(`NASA NeoWs returned HTTP ${res.status}`);
    }

    const json = await res.json();
    const rawByDate = json.near_earth_objects || {};

    // ── 4. Parse NASA response ────────────────────────────────────────────
    const flatList = [];

    // Sort date keys chronologically so closest-first ordering is natural
    Object.keys(rawByDate)
      .sort()
      .forEach((dateKey) => {
        (rawByDate[dateKey] || []).forEach((item) => {
          // Diameter — average of min/max estimate in metres
          const diamObj = item.estimated_diameter?.meters ?? {};
          const diamMin = Number(diamObj.estimated_diameter_min) || 0;
          const diamMax = Number(diamObj.estimated_diameter_max) || 0;
          const diameter = Math.round((diamMin + diamMax) / 2) || Math.round(diamMin) || 50;

          // Close approach (first entry = soonest)
          const approaches = item.close_approach_data || [];
          const approach = approaches[0] || {};
          const velocity = parseFloat(approach.relative_velocity?.kilometers_per_second) || 0;
          const missKm = parseFloat(approach.miss_distance?.kilometers) || 0;
          const missAu = parseFloat(
            approach.miss_distance?.astronomical ||
              (missKm ? String(missKm / 149597870.7) : '0')
          );
          const approachDate =
            approach.close_approach_date_full ||
            approach.close_approach_date ||
            `${dateKey} 12:00`;

          const hazardous = Boolean(item.is_potentially_hazardous_asteroid);

          // Orbital classification
          let classification = 'Apollo';
          if (item.orbital_data?.orbit_class?.orbit_class_type) {
            classification = item.orbital_data.orbit_class.orbit_class_type;
          } else if (missAu > 1.017) {
            classification = 'Amor';
          } else if (missAu < 0.983) {
            classification = 'Aten';
          }

          const threatLevel = getThreatLevel({ hazardous, diameter, missKm, velocity });

          flatList.push({
            id: item.id || item.neo_reference_id,
            name: (item.name || `NEO ${item.id}`).replace(/[()]/g, '').trim(),
            classification,
            type: classification,
            neo: true,
            hazardous,
            diameter,
            velocity,
            missKm: Math.round(missKm),
            missAu: +missAu.toFixed(4),
            approachDate,
            date: approachDate,
            threatLevel,
            threatColor: THREAT_CONFIG[threatLevel].hex,
            threatLabel: THREAT_CONFIG[threatLevel].label,
            isRealtime: true,
            nasaJplUrl: item.nasa_jpl_url,
            magnitude: item.absolute_magnitude_h,
          });
        });
      });

    // Deduplicate by NASA ID
    const seen = new Map();
    flatList.forEach((a) => { if (!seen.has(a.id)) seen.set(a.id, a); });
    const normalizedList = Array.from(seen.values()).map(normalizeAsteroid);

    // ── 5. Persist to date-stamped cache ─────────────────────────────────
    const fetchedAt = new Date();
    try {
      // Remove any old cache keys from previous dates / versions to keep
      // localStorage tidy, but never discard historical fetched records.
      const toDelete = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ASTRA_NEO_CACHE_') && k !== KEY) {
          toDelete.push(k);
        }
        // Also clear the old V2/V3 key format
        if (k && k.startsWith('ASTRA_REALTIME_NEOS_CACHE')) {
          toDelete.push(k);
        }
      }
      toDelete.forEach((k) => { try { localStorage.removeItem(k); } catch (_) {} });

      localStorage.setItem(
        KEY,
        JSON.stringify({
          timestamp: fetchedAt.getTime(),
          list: normalizedList,
          elementCount: json.element_count ?? normalizedList.length,
          dateRange,
          fetchedDateStr: todayString(), // human-readable audit trail
        })
      );
    } catch (e) {
      console.warn('[ASTRA] Could not write to cache:', e);
    }

    // ── 6. Compute stats from real data ───────────────────────────────────
    const stats = computeStats(normalizedList, {
      total: json.element_count ?? normalizedList.length,
      neos: normalizedList.length,
      phas: normalizedList.filter((a) => a.threatLevel === 'dangerous').length,
      isRealtime: true,
      lastUpdated: fetchedAt.toISOString(),
    });

    return {
      success: true,
      source: 'api',
      isCustomKey: isCustom,
      keyUsed: isCustom ? 'Personal API Key' : 'NASA DEMO_KEY',
      list: normalizedList,
      stats,
      message: `Live NASA NeoWs · ${normalizedList.length} NEOs · ${dateRange}`,
      fetchedAt,
      dateRange,
    };

  } catch (err) {
    clearTimeout(timeoutId);

    const isAbort = err.name === 'AbortError';
    const reason = isAbort
      ? 'Request timed out (>15 s) — NASA API may be slow. Will retry.'
      : err.message || 'Unknown error';

    console.warn('[ASTRA] NASA API fetch failed:', reason);

    // ── 7. Fall back to stale cache (any age) ────────────────────────────
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.list) && parsed.list.length > 0) {
          const list = parsed.list.map(normalizeAsteroid);
          const fetchedAt = new Date(parsed.timestamp);
          const ageMin = Math.round((Date.now() - parsed.timestamp) / 60000);
          return {
            success: false,
            source: 'stale-cache',
            isCustomKey: isCustom,
            keyUsed: isCustom ? 'Personal API Key' : 'NASA DEMO_KEY',
            list,
            stats: computeStats(list, {
              ...ASTEROID_STATS,
              isRealtime: true,
              lastUpdated: fetchedAt.toISOString(),
            }),
            error: reason,
            message: `Offline snapshot (${ageMin}m old) · ${parsed.dateRange || dateRange} · ${reason}`,
            fetchedAt,
            dateRange: parsed.dateRange || dateRange,
          };
        }
      }
    } catch (_) { /* ignore */ }

    // ── 8. Last resort: labelled reference catalog (NOT live data) ────────
    // Clearly marked as non-realtime so the dashboard never misrepresents it.
    return {
      success: false,
      source: 'fallback',
      isCustomKey: isCustom,
      keyUsed: isCustom ? 'Personal API Key' : 'NASA DEMO_KEY',
      list: FALLBACK_LIST,
      stats: computeStats(FALLBACK_LIST, {
        ...ASTEROID_STATS,
        isRealtime: false,
        lastUpdated: null, // ← null = "not retrieved" — prevents fake timestamps
      }),
      error: reason,
      message: `⚠ NASA API unavailable — showing reference catalog only. ${reason}`,
      fetchedAt: null, // ← explicitly null; dashboard should NOT show a fake live time
      dateRange,
    };
  }
}

/**
 * Remove all ASTRA NEO cache entries from localStorage.
 */
export function clearAsteroidCache() {
  const toDelete = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('ASTRA_NEO_CACHE_') || k.startsWith('ASTRA_REALTIME_NEOS_CACHE'))) {
        toDelete.push(k);
      }
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  } catch (_) { /* ignore */ }
}
