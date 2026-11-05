import { ASTEROIDS_DATA, ASTEROID_STATS } from '../data/asteroids.js';
import { computeStats, getAsteroids, getThreatLevel, normalizeAsteroid, THREAT_CONFIG } from '../utils/asteroidUtils.js';

const CACHE_KEY = 'ASTRA_REALTIME_NEOS_CACHE_V2';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function getNasaApiKey() {
  const envKey = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_NASA_API_KEY : undefined;
  if (envKey && envKey.trim() && envKey !== 'DEMO_KEY') {
    return { key: envKey.trim(), isCustom: true };
  }
  return { key: 'DEMO_KEY', isCustom: false };
}

function formatDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Fetch real-time Near-Earth Objects from NASA NeoWs API
 */
export async function fetchRealtimeAsteroids(bypassCache = false) {
  const { key, isCustom } = getNasaApiKey();

  // Check local cache first if not bypassing
  if (!bypassCache) {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS && Array.isArray(parsed.list) && parsed.list.length > 0) {
          const list = parsed.list.map(normalizeAsteroid);
          return {
            success: true,
            source: 'cache',
            isCustomKey: isCustom,
            keyUsed: isCustom ? 'Personal API Key' : 'NASA DEMO_KEY',
            list,
            stats: computeStats(list, { ...ASTEROID_STATS, isRealtime: true, lastUpdated: new Date(parsed.timestamp).toISOString() }),
            message: 'Real-time NASA data (cached within 15m)',
            fetchedAt: new Date(parsed.timestamp),
          };
        }
      }
    } catch (e) {
      console.warn('[ASTRA] Failed to read cached asteroids:', e);
    }
  }

  // Build 7-day query window (NASA feed max is 7 days)
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);

  const startDateStr = formatDate(today);
  const endDateStr = formatDate(nextWeek);

  const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${startDateStr}&end_date=${endDateStr}&api_key=${encodeURIComponent(key)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 429) {
        throw new Error('NASA NeoWs rate limit reached. Add your free personal API key in .env for 1,000 requests/hr.');
      }
      if (res.status === 403) {
        throw new Error('Invalid NASA API Key. Check VITE_NASA_API_KEY in .env or use DEMO_KEY.');
      }
      throw new Error(`NASA API returned HTTP ${res.status}`);
    }

    const json = await res.json();
    const rawNeosByDate = json.near_earth_objects || {};
    const flatList = [];

    Object.keys(rawNeosByDate).sort().forEach((dateKey) => {
      const items = rawNeosByDate[dateKey] || [];
      items.forEach((item) => {
        const diamObj = item.estimated_diameter?.meters;
        const diamMin = diamObj?.estimated_diameter_min || 0;
        const diamMax = diamObj?.estimated_diameter_max || 0;
        const diameter = Math.round((diamMin + diamMax) / 2) || Math.round(diamMin) || 50;

        // Find primary close approach (closest to current date or closest miss distance)
        const approaches = item.close_approach_data || [];
        const approach = approaches[0] || {};
        const velocity = parseFloat(approach.relative_velocity?.kilometers_per_second || 0);
        const missKm = parseFloat(approach.miss_distance?.kilometers || 0);
        const missAu = parseFloat(approach.miss_distance?.astronomical || (missKm ? missKm / 149597870.7 : 0));
        const approachDate = approach.close_approach_date_full || approach.close_approach_date || `${dateKey} 12:00`;

        const hazardous = Boolean(item.is_potentially_hazardous_asteroid);

        // Derive orbital class if not provided
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

    // Deduplicate by ID
    const uniqueMap = new Map();
    flatList.forEach((a) => {
      if (!uniqueMap.has(a.id)) uniqueMap.set(a.id, a);
    });
    const normalizedList = Array.from(uniqueMap.values()).map(normalizeAsteroid);

    // Save to cache
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          list: normalizedList,
          elementCount: json.element_count || normalizedList.length,
        })
      );
    } catch (e) {
      console.warn('[ASTRA] Could not write asteroids to cache:', e);
    }

    const stats = computeStats(normalizedList, {
      total: json.element_count || normalizedList.length,
      neos: normalizedList.length,
      phas: normalizedList.filter((a) => a.threatLevel === 'dangerous').length,
      isRealtime: true,
      lastUpdated: new Date().toISOString(),
    });

    return {
      success: true,
      source: 'api',
      isCustomKey: isCustom,
      keyUsed: isCustom ? 'Personal API Key' : 'NASA DEMO_KEY',
      list: normalizedList,
      stats,
      message: `Live data: ${normalizedList.length} Near-Earth asteroids fetched from NASA NeoWs`,
      fetchedAt: new Date(),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[ASTRA] NASA API fetch failed:', err.message);

    // Try stale cache if available
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.list) && parsed.list.length > 0) {
          const list = parsed.list.map(normalizeAsteroid);
          return {
            success: true,
            source: 'stale-cache',
            isCustomKey: isCustom,
            keyUsed: isCustom ? 'Personal API Key' : 'NASA DEMO_KEY',
            list,
            stats: computeStats(list, { ...ASTEROID_STATS, isRealtime: true, lastUpdated: new Date(parsed.timestamp).toISOString() }),
            message: `Using saved real-time snapshot (${err.message})`,
            fetchedAt: new Date(parsed.timestamp),
          };
        }
      }
    } catch (e) {
      // ignore
    }

    // Fallback to local dataset enriched with threat levels
    const fallbackList = getAsteroids(ASTEROIDS_DATA);
    return {
      success: false,
      source: 'fallback',
      isCustomKey: isCustom,
      keyUsed: isCustom ? 'Personal API Key' : 'NASA DEMO_KEY',
      list: fallbackList,
      stats: computeStats(fallbackList, { ...ASTEROID_STATS, isRealtime: false, lastUpdated: new Date().toISOString() }),
      error: err.message,
      message: `${err.message} — Showing reference asteroid catalog.`,
      fetchedAt: new Date(),
    };
  }
}

export function clearAsteroidCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {
    // ignore
  }
}
