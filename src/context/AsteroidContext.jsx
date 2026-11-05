import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchRealtimeAsteroids, getNasaApiKey } from '../services/asteroidService.js';
import { ASTEROIDS_DATA, ASTEROID_STATS } from '../data/asteroids.js';
import { computeStats, getAsteroids } from '../utils/asteroidUtils.js';

const AsteroidContext = createContext(null);

export function AsteroidProvider({ children }) {
  const [asteroids, setAsteroids] = useState(() => getAsteroids(ASTEROIDS_DATA));
  const [stats, setStats] = useState(() =>
    computeStats(getAsteroids(ASTEROIDS_DATA), ASTEROID_STATS)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState('initializing');

  // isRealtime = true only when data actually came from NASA (live or cached)
  const [isRealtime, setIsRealtime] = useState(false);
  const [isCustomKey, setIsCustomKey] = useState(false);
  const [keyUsed, setKeyUsed] = useState('DEMO_KEY');

  // fetchedAt is a real Date from the actual API response — null when unavailable
  const [lastUpdated, setLastUpdated] = useState(null);

  const [statusMessage, setStatusMessage] = useState(
    'Fetching Near-Earth Objects from NASA NeoWs…'
  );
  const [dateRange, setDateRange] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [threatFilter, setThreatFilter] = useState('all');

  const loadData = useCallback(async (bypassCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRealtimeAsteroids(bypassCache);

      setAsteroids(res.list);
      setStats(res.stats);
      setSource(res.source);

      // isRealtime = true only for data that actually came from NASA
      setIsRealtime(res.source === 'api' || res.source === 'cache');

      setIsCustomKey(res.isCustomKey);
      setKeyUsed(res.keyUsed);

      // fetchedAt is null when falling back to the reference catalog
      // — do NOT replace null with new Date() here (that would be a fake timestamp)
      setLastUpdated(res.fetchedAt instanceof Date ? res.fetchedAt : null);

      setStatusMessage(res.message);
      setDateRange(res.dateRange || null);

      if (res.error) setError(res.error);
    } catch (err) {
      console.error('[ASTRA] loadData error:', err);
      setError(err.message || 'Failed to fetch live asteroid data');
      setStatusMessage('⚠ NASA API unavailable — showing reference catalog only.');
      setIsRealtime(false);
      setLastUpdated(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load
    loadData(false);

    // Auto-refresh every 15 minutes
    const interval = setInterval(() => loadData(false), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const refresh = useCallback(() => loadData(true), [loadData]);

  const selectedAsteroid =
    asteroids.find((a) => a.id === selectedId) || asteroids[0] || null;

  const value = {
    asteroids,
    stats,
    loading,
    error,
    source,
    isRealtime,
    isCustomKey,
    keyUsed,
    lastUpdated,   // Date | null — null means "no real data retrieved"
    statusMessage,
    dateRange,     // e.g. "2026-11-05 → 2026-11-11"
    selectedId,
    selectedAsteroid,
    setSelectedId,
    threatFilter,
    setThreatFilter,
    refresh,
    nasaKeyInfo: getNasaApiKey(),
  };

  return <AsteroidContext.Provider value={value}>{children}</AsteroidContext.Provider>;
}

export function useAsteroids() {
  const ctx = useContext(AsteroidContext);
  if (!ctx) throw new Error('useAsteroids must be used within an AsteroidProvider');
  return ctx;
}
