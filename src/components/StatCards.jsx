import { AlertTriangle, Crosshair, Gauge, Globe2, Orbit, Ruler, ShieldAlert, ShieldCheck, Telescope } from 'lucide-react';
import { fmtNum } from '../utils/asteroidUtils.js';

const TONES = {
  green: {
    ring: 'border-emerald-500/30',
    icon: 'text-emerald-400 bg-emerald-500/15',
    glow: 'from-emerald-500/10',
    badge: 'text-emerald-400',
  },
  yellow: {
    ring: 'border-amber-500/30',
    icon: 'text-amber-400 bg-amber-500/15',
    glow: 'from-amber-500/10',
    badge: 'text-amber-400',
  },
  red: {
    ring: 'border-red-500/30',
    icon: 'text-red-400 bg-red-500/15',
    glow: 'from-red-500/15',
    badge: 'text-red-400',
  },
  blue: {
    ring: 'border-nasa-blue/30',
    icon: 'text-nasa-blue bg-nasa-blue/15',
    glow: 'from-nasa-blue/10',
    badge: 'text-sky-400',
  },
};

function Card({ icon: Icon, label, value, sub, tone = 'green' }) {
  const t = TONES[tone] || TONES.green;
  return (
    <div className={`panel relative overflow-hidden border ${t.ring} p-4 transition duration-200 hover:-translate-y-0.5 hover:border-white/30`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.glow} to-transparent`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-2 truncate font-heading text-2xl font-bold text-white sm:text-3xl">{value}</p>
          {sub && <p className="mt-1 truncate text-xs text-slate-400 font-medium">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 shrink-0 ${t.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function StatCards({ stats }) {
  const dangerousCount = stats.dangerousCount || stats.phas || 0;
  const mediumCount = stats.mediumCount || 0;
  const safeCount = stats.safeCount || (stats.tracked - dangerousCount) || 0;

  return (
    <section aria-label="Key statistics" className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        icon={Telescope}
        tone="blue"
        label="Tracked Asteroids"
        value={fmtNum(stats.tracked || stats.total)}
        sub={stats.isRealtime ? 'Live NASA real-time catalog' : 'Tracked small bodies'}
      />
      <Card
        icon={ShieldAlert}
        tone="red"
        label="Dangerous (Red)"
        value={fmtNum(dangerousCount)}
        sub="Potentially Hazardous / Close Threat"
      />
      <Card
        icon={AlertTriangle}
        tone="yellow"
        label="Medium Caution (Yellow)"
        value={fmtNum(mediumCount)}
        sub="Moderate size or <12M km flyby"
      />
      <Card
        icon={ShieldCheck}
        tone="green"
        label="Safe (Green)"
        value={fmtNum(safeCount)}
        sub="Safe flyby trajectory & non-hazardous"
      />
      <Card
        icon={Crosshair}
        tone="red"
        label="Closest Approach"
        value={stats.closest ? `${fmtNum(stats.closest.missKm)} km` : '—'}
        sub={stats.closest ? `${stats.closest.name} (${stats.closest.missAu || 0} AU)` : 'Calculating…'}
      />
      <Card
        icon={Gauge}
        tone="blue"
        label="Avg. Relative Velocity"
        value={`${fmtNum(stats.avgVelocity, 1)} km/s`}
        sub="Velocity relative to Earth"
      />
      <Card
        icon={Ruler}
        tone="green"
        label="Avg. Est. Diameter"
        value={`${fmtNum(stats.avgDiameter, 0)} m`}
        sub={stats.largest ? `Largest: ${stats.largest.name} (${fmtNum(stats.largest.diameter)} m)` : undefined}
      />
      <Card
        icon={Globe2}
        tone="blue"
        label="Near-Earth Objects (NEO)"
        value={fmtNum(stats.neos || stats.tracked)}
        sub="Within Earth orbital neighborhood"
      />
    </section>
  );
}
