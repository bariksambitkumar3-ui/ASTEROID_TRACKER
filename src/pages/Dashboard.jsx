import { useAsteroids } from '../context/AsteroidContext.jsx';
import AsteroidHero from '../components/AsteroidHero.jsx';
import StatCards from '../components/StatCards.jsx';
import Charts from '../components/Charts.jsx';
import EarthWeather from '../components/EarthWeather.jsx';
import SpaceWeather from '../components/SpaceWeather.jsx';
import CatalogTable from '../components/CatalogTable.jsx';
import { AlertTriangle, KeyRound, Radio, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function Dashboard() {
  const {
    asteroids,
    stats,
    loading,
    isRealtime,
    isCustomKey,
    keyUsed,
    lastUpdated,
    statusMessage,
    refresh,
  } = useAsteroids();

  return (
    <div className="dashboard-page">
      <AsteroidHero />

      <div className="dashboard-content mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* Mission Overview & Real-Time Sync Bar */}
        <div id="overview" className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">Mission Dashboard</h2>
            <p className="mt-1 text-sm text-slate-400">
              Live Near-Earth Object tracking, orbital threat classification, Earth & space weather.
            </p>
          </div>

          {/* Real-time Status Capsule */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs backdrop-blur">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isRealtime ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isRealtime ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              </span>
              <span className="font-semibold text-slate-200">
                {isRealtime ? 'Live NASA Feed' : 'Baseline Catalog'}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 font-mono text-[11px]">
                {lastUpdated instanceof Date
                  ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : typeof lastUpdated === 'string'
                  ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Live'}
              </span>
            </div>

            <button
              onClick={() => refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              title="Refresh real-time data from NASA API"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{loading ? 'Fetching…' : 'Sync Live Data'}</span>
            </button>
          </div>
        </div>

        {/* Real-Time Live Feed Banner with Threat Breakdown */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#0b0e17] via-[#0e1322] to-[#0b0e17] p-4 shadow-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-emerald-400 shrink-0">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">Real-Time Threat Telemetry</h4>
                  {isCustomKey ? (
                    <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-400 border border-sky-500/30">
                      <KeyRound className="h-3 w-3" /> Personal NASA API Key Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-white/10" title="Add your free NASA API key in .env for higher rate limits">
                      DEMO_KEY active (.env supported)
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {statusMessage || 'Monitoring current week close approaches and planetary defense telemetry.'}
                </p>
              </div>
            </div>

            {/* Color-Coded Threat Indicators */}
            <div className="flex flex-wrap items-center gap-2 pt-1 lg:pt-0">
              <div className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-400">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>{stats.dangerousCount || 0} Dangerous (Red)</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{stats.mediumCount || 0} Medium (Yellow)</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{stats.safeCount || 0} Safe (Green)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 8 Statistics Cards */}
        <StatCards stats={stats} />

        {/* Charts & Weather Grid */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Charts stats={stats} />
          </div>
          <div id="weather-space" className="grid scroll-mt-6 grid-cols-1 content-start gap-6 md:grid-cols-2 xl:grid-cols-1">
            <EarthWeather />
            <SpaceWeather />
          </div>
        </div>

        {/* Interactive Asteroid Catalog Table */}
        <div id="asteroid-catalog" className="scroll-mt-6">
          <CatalogTable list={asteroids} />
        </div>
      </div>
    </div>
  );
}
