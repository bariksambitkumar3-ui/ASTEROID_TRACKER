import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, RefreshCw, Sun, Wind } from 'lucide-react';

const PLASMA = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json';
const KP = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';

// NOAA returns either [header, ...rows] arrays or arrays of objects; handle both.
function rowsToObjects(json) {
  if (!Array.isArray(json) || !json.length) return [];
  if (Array.isArray(json[0])) {
    const [header, ...rows] = json;
    return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
  }
  return json;
}

function lastValid(rows, key) {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = parseFloat(rows[i][key]);
    if (!isNaN(v)) return { value: v, time: rows[i].time_tag };
  }
  return null;
}

function kpInfo(kp) {
  if (kp == null) return { label: 'Unknown', color: 'text-slate-400', bar: 'bg-slate-600' };
  if (kp < 4) return { label: 'Quiet', color: 'text-emerald-green', bar: 'bg-emerald-green' };
  if (kp < 5) return { label: 'Unsettled', color: 'text-nasa-blue', bar: 'bg-nasa-blue' };
  if (kp < 7) return { label: `Storm G${Math.floor(kp) - 4}`, color: 'text-amber-400', bar: 'bg-amber-400' };
  return { label: `Severe storm G${Math.min(5, Math.floor(kp) - 4)}`, color: 'text-crimson-red', bar: 'bg-crimson-red' };
}

function windInfo(v) {
  if (v == null) return 'Unknown';
  if (v < 400) return 'Slow';
  if (v < 600) return 'Moderate';
  return 'Fast';
}

export default function SpaceWeather() {
  const [wind, setWind] = useState(null);
  const [kp, setKp] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);

  const load = useCallback(async (signal) => {
    setLoading(true);
    const errs = {};
    const [plasma, kIdx] = await Promise.allSettled([
      fetch(PLASMA, { signal }).then((r) => {
        if (!r.ok) throw new Error(`NOAA returned ${r.status}`);
        return r.json();
      }),
      fetch(KP, { signal }).then((r) => {
        if (!r.ok) throw new Error(`NOAA returned ${r.status}`);
        return r.json();
      }),
    ]);

    if (plasma.status === 'fulfilled') {
      const v = lastValid(rowsToObjects(plasma.value), 'speed');
      if (v) setWind(v);
      else errs.wind = 'No recent solar wind readings';
    } else if (plasma.reason?.name !== 'AbortError') errs.wind = plasma.reason?.message || 'Solar wind unavailable';

    if (kIdx.status === 'fulfilled') {
      const rows = rowsToObjects(kIdx.value);
      const v = lastValid(rows, 'Kp') || lastValid(rows, 'kp_index') || lastValid(rows, 'estimated_kp');
      if (v) setKp(v);
      else errs.kp = 'No recent K-index readings';
    } else if (kIdx.reason?.name !== 'AbortError') errs.kp = kIdx.reason?.message || 'K-index unavailable';

    setErrors(errs);
    setUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    const t = setInterval(() => load(ctrl.signal), 60 * 1000);
    return () => {
      ctrl.abort();
      clearInterval(t);
    };
  }, [load]);

  const k = kpInfo(kp?.value);
  const kpPct = kp ? Math.min(100, (kp.value / 9) * 100) : 0;

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="panel-title">Space weather</h3>
        <button onClick={() => load()} className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">NOAA SWPC · {updated ? `updated ${updated.toLocaleTimeString()}` : 'loading…'}</p>

      <div className="mt-4 space-y-3">
        {/* Solar wind */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-4">
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
            <span className="flex items-center gap-2"><Wind className="h-4 w-4 text-nasa-blue" /> Solar wind speed</span>
            <Sun className="h-4 w-4 text-amber-400" />
          </div>
          {errors.wind && !wind ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-red-300"><AlertTriangle className="h-4 w-4" />{errors.wind}</p>
          ) : (
            <>
              <p className="mt-2 font-heading text-3xl font-bold text-white">
                {wind ? Math.round(wind.value) : '—'} <span className="text-sm font-medium text-slate-400">km/s</span>
              </p>
              <p className="text-xs text-slate-500">{windInfo(wind?.value)} · typical range 300–800 km/s</p>
              {errors.wind && <p className="mt-1 text-[11px] text-amber-400">Showing last known value ({errors.wind})</p>}
            </>
          )}
        </div>

        {/* K-index */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-4">
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
            <span className="flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-green" /> Geomagnetic K-index</span>
            <span className={`font-semibold normal-case tracking-normal ${k.color}`}>{k.label}</span>
          </div>
          {errors.kp && !kp ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-red-300"><AlertTriangle className="h-4 w-4" />{errors.kp}</p>
          ) : (
            <>
              <p className="mt-2 font-heading text-3xl font-bold text-white">
                {kp ? kp.value.toFixed(1) : '—'} <span className="text-sm font-medium text-slate-400">/ 9</span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full transition-all ${k.bar}`} style={{ width: `${kpPct}%` }} />
              </div>
              {errors.kp && <p className="mt-1 text-[11px] text-amber-400">Showing last known value ({errors.kp})</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
