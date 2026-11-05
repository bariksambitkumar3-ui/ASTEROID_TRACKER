import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchRealtimeAsteroids, getNasaApiKey } from '../services/asteroidService.js';
import { ASTEROIDS_DATA, ASTEROID_STATS } from '../data/asteroids.js';
import { computeStats, getAsteroids } from '../utils/asteroidUtils.js';

const AsteroidContext = createContext(null);

export function AsteroidProvider({ children }) {
  const [asteroids, setAsteroids] = useState(() => getAsteroids(ASTEROIDS_DATA));
  const [stats, setStats] = useState(() => computeStats(getAsteroids(ASTEROIDS_DATA), ASTEROID_STATS));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState('initializing');
  const [isRealtime, setIsRealtime] = useState(false);
  const [isCustomKey, setIsCustomKey] = useState(false);
  const [keyUsed, setKeyUsed] = useState('DEMO_KEY');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Fetching real-time Near-Earth Objects from NASA...');
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
      setIsRealtime(res.source === 'api' || res.source === 'cache');
      setIsCustomKey(res.isCustomKey);
      setKeyUsed(res.keyUsed);
      setLastUpdated(res.fetchedAt || new Date());
      setStatusMessage(res.message);
      if (res.error) setError(res.error);
    } catch (err) {
      console.error('[ASTRA] Error in loadData:', err);
      setError(err.message || 'Failed to fetch live asteroid data');
      setStatusMessage('Showing reference baseline catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
    // Refresh automatically every 15 minutes
    const interval = setInterval(() => loadData(false), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const refresh = useCallback(() => {
    return loadData(true);
  }, [loadData]);

  // Find currently selected asteroid
  const selectedAsteroid = asteroids.find((a) => a.id === selectedId) || asteroids[0] || null;

  const value = {
    asteroids,
    stats,
    loading,
    error,
    source,
    isRealtime,
    isCustomKey,
    keyUsed,
    lastUpdated,
    statusMessage,
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
