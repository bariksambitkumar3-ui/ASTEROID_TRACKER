import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CloudRain,
  Crosshair,
  Droplets,
  Gauge,
  Key,
  MapPin,
  RefreshCw,
  Search,
  Thermometer,
  Wind,
} from 'lucide-react';
import { getDefaultCity, getLiveWeather, getWeatherApiKey } from '../services/weatherService.js';

export default function EarthWeather() {
  const [cityInput, setCityInput] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loc, setLoc] = useState(() => ({ name: getDefaultCity(), lat: 18.5204, lon: 73.8567 }));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const { hasKey } = getWeatherApiKey();

  const load = useCallback(async (targetLoc, signal) => {
    setLoading(true);
    setError('');
    try {
      const result = await getLiveWeather(targetLoc, signal);
      setData(result);
    } catch (e) {
      if (e.name !== 'AbortError') {
        setError(e.message || 'Could not load real-time weather');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(loc, ctrl.signal);
    // Auto-refresh every 10 minutes
    const t = setInterval(() => load(loc, ctrl.signal), 10 * 60 * 1000);
    return () => {
      ctrl.abort();
      clearInterval(t);
    };
  }, [loc, load]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!cityInput.trim()) return;
    const newLoc = { name: cityInput.trim(), lat: null, lon: null };
    setLoc(newLoc);
    setShowSearch(false);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoc({
          name: 'My Location',
          lat: +p.coords.latitude.toFixed(3),
          lon: +p.coords.longitude.toFixed(3),
        });
      },
      (err) => {
        setError('Location permission denied. Showing default city.');
        setLoading(false);
      },
      { timeout: 8000 }
    );
  };

  const Row = ({ icon: Icon, label, value }) => (
    <div className="flex items-center justify-between rounded-lg bg-black/40 px-3 py-2 border border-white/5">
      <span className="flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-4 w-4 text-nasa-blue" />
        {label}
      </span>
      <span className="font-mono text-sm text-slate-100">{value}</span>
    </div>
  );

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="panel-title flex items-center gap-2">
            <span>Earth Weather</span>
            {hasKey ? (
              <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-medium text-sky-400 border border-sky-500/30">
                <Key className="h-2.5 w-2.5" /> API Key
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/30">
                Free Open-Meteo
              </span>
            )}
          </h3>
          <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
            <MapPin className="h-3 w-3 text-slate-500" />
            <span className="font-medium text-slate-300">{data?.locationName || loc.name}</span>
            <span className="text-slate-500">• {data?.provider || 'Live'}</span>
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch((s) => !s)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            aria-label="Search city"
            title="Search city"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={locate}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-emerald-green transition"
            aria-label="Use my GPS location"
            title="Use my location"
          >
            <Crosshair className="h-4 w-4" />
          </button>
          <button
            onClick={() => load(loc)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            aria-label="Refresh weather"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* City Search Field */}
      {showSearch && (
        <form onSubmit={handleSearch} className="mt-3 flex gap-2">
          <input
            type="text"
            className="input-dark !py-1.5 !text-xs flex-1"
            placeholder="Type city name (e.g. New York, London, Tokyo)"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            className="rounded-lg bg-sky-500/20 border border-sky-500/40 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/30"
          >
            Search
          </button>
        </form>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-crimson-red/40 bg-crimson-red/10 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!data && loading && <div className="mt-6 h-40 animate-pulse rounded-lg bg-white/5" />}

      {data && (
        <div className="mt-4">
          <div className="flex items-end justify-between">
            <div className="flex items-end gap-3">
              <span className="font-heading text-5xl font-bold text-white tracking-tight">{data.temperature}°</span>
              <span className="pb-1 text-sm font-medium text-slate-300">{data.condition}</span>
            </div>
            {data.fetchedAt && (
              <span className="pb-1 text-[11px] text-slate-500 font-mono">
                {data.fetchedAt instanceof Date
                  ? data.fetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Row icon={Thermometer} label="Feels like" value={`${data.feelsLike}°C`} />
            <Row icon={Droplets} label="Humidity" value={`${data.humidity}%`} />
            <Row icon={Wind} label="Wind" value={`${data.windSpeed} km/h`} />
            <Row icon={Gauge} label="Pressure" value={`${data.pressure} hPa`} />
            <Row icon={CloudRain} label="Precipitation" value={`${data.precipitation} mm`} />
          </div>
        </div>
      )}
    </div>
  );
}
