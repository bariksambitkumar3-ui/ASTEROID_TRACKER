import { useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { fmtNum, THREAT_CONFIG } from '../utils/asteroidUtils.js';

export default function CatalogTable({ list }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE = 10;

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter((a) => {
      if (filter === 'dangerous' && a.threatLevel !== 'dangerous') return false;
      if (filter === 'medium' && a.threatLevel !== 'medium') return false;
      if (filter === 'safe' && a.threatLevel !== 'safe') return false;
      if (filter === 'hazardous' && !a.hazardous) return false;
      if (filter === 'neo' && !a.neo) return false;
      return !s || a.name.toLowerCase().includes(s) || (a.type && a.type.toLowerCase().includes(s));
    });
  }, [list, q, filter]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = rows.slice(cur * PAGE, cur * PAGE + PAGE);

  return (
    <section className="panel p-5" aria-label="Asteroid catalog">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="panel-title">Asteroid Catalog</h3>
          <p className="mt-1 text-xs text-slate-400">
            Real-time tracked near-Earth objects with 3-tier threat assessment
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="input-dark !py-2 sm:w-56"
              placeholder="Search by name or class…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/70"
          >
            <option value="all">All Threat Levels</option>
            <option value="dangerous">🔴 Dangerous (Red)</option>
            <option value="medium">🟡 Medium Caution (Yellow)</option>
            <option value="safe">🟢 Safe (Green)</option>
            <option value="neo">NEOs Only</option>
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[11px] uppercase tracking-widest text-slate-500">
              <th className="py-2.5 pr-3">Name</th>
              <th className="py-2.5 pr-3">Class</th>
              <th className="py-2.5 pr-3 text-right">Diameter</th>
              <th className="py-2.5 pr-3 text-right">Velocity</th>
              <th className="py-2.5 pr-3 text-right">Miss Distance</th>
              <th className="py-2.5 pr-3 text-right">Approach Date</th>
              <th className="py-2.5 text-right">Threat Assessment</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((a) => {
              const threat = THREAT_CONFIG[a.threatLevel] || THREAT_CONFIG.safe;
              return (
                <tr key={a.id} className="border-b border-white/5 text-slate-300 hover:bg-white/[0.04] transition">
                  <td className="py-2.5 pr-3 font-medium text-white flex items-center gap-1.5">
                    <span>{a.name}</span>
                    {a.nasaJplUrl && (
                      <a
                        href={a.nasaJplUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-500 hover:text-sky-400"
                        title="View on NASA JPL Small-Body Database"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-400">{a.type || 'NEO'}</td>
                  <td className="py-2.5 pr-3 text-right font-mono">{fmtNum(a.diameter, 0)} m</td>
                  <td className="py-2.5 pr-3 text-right font-mono">{fmtNum(a.velocity, 1)} km/s</td>
                  <td className="py-2.5 pr-3 text-right font-mono">
                    {a.missKm ? `${fmtNum(a.missKm)} km` : '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-xs font-mono text-slate-400">
                    {a.date ? new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—'}
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${threat.twBg} ${threat.twText} ${threat.twBorder}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${threat.twDot}`} />
                      {threat.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!slice.length && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No asteroids match your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>
          Showing {slice.length} of {rows.length} asteroids
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={cur === 0}
            onClick={() => setPage(cur - 1)}
            className="rounded border border-white/10 px-3 py-1 hover:bg-white/10 text-slate-200 disabled:opacity-40 transition"
          >
            Prev
          </button>
          <span className="font-mono text-slate-300">
            {cur + 1} / {pages}
          </span>
          <button
            disabled={cur >= pages - 1}
            onClick={() => setPage(cur + 1)}
            className="rounded border border-white/10 px-3 py-1 hover:bg-white/10 text-slate-200 disabled:opacity-40 transition"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
