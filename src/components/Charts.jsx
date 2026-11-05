import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PALETTE = ['#10B981', '#38BDF8', '#B91C1C', '#0EA5E9', '#059669', '#EF4444', '#7E2A4C', '#34D399'];
const RED = '#EF4444';
const YELLOW = '#EAB308';
const GREEN = '#10B981';
const BLUE = '#38BDF8';

const tooltipStyle = {
  contentStyle: {
    background: '#0a0d13',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 12,
  },
  itemStyle: { color: '#e2e8f0' },
  labelStyle: { color: '#94a3b8' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
};

const axis = { stroke: '#64748b', fontSize: 11, tickLine: false, axisLine: { stroke: 'rgba(255,255,255,0.1)' } };

function ChartCard({ title, subtitle, children, empty }) {
  return (
    <div className="panel p-5">
      <h3 className="panel-title">{title}</h3>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4 h-64">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">No data available</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export default function Charts({ stats }) {
  const classification = stats.classification || [];
  const sizes = stats.sizes || [];

  const threatData = [
    { name: 'Dangerous (Red)', value: stats.dangerousCount || stats.phas || 0, color: RED },
    { name: 'Medium Caution (Yellow)', value: stats.mediumCount || 0, color: YELLOW },
    { name: 'Safe (Green)', value: stats.safeCount || 0, color: GREEN },
  ].filter((d) => d.value > 0);

  const hasData = (stats.tracked || 0) > 0;

  return (
    <section aria-label="Charts" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 1. Real-time Threat Level Distribution */}
      <ChartCard
        title="Real-Time Threat Level Assessment"
        subtitle="Dangerous (Red) • Medium (Yellow) • Safe (Green)"
        empty={!hasData || threatData.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={threatData}
              dataKey="value"
              nameKey="name"
              innerRadius="48%"
              outerRadius="80%"
              paddingAngle={3}
              stroke="#04060a"
            >
              {threatData.map((t) => (
                <Cell key={t.name} fill={t.color} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2. Asteroid classification */}
      <ChartCard title="Asteroid classification" subtitle="Tracked asteroids by orbital class" empty={!hasData || !classification.length}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={classification}
              dataKey="count"
              nameKey="name"
              innerRadius="48%"
              outerRadius="80%"
              paddingAngle={2}
              stroke="#04060a"
            >
              {classification.map((c, i) => (
                <Cell key={c.name} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3. Size distribution */}
      <ChartCard title="Size distribution" subtitle="Estimated diameter ranges" empty={!hasData || !sizes.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sizes} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" {...axis} />
            <YAxis allowDecimals={false} {...axis} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="count" name="Asteroids" radius={[6, 6, 0, 0]}>
              {sizes.map((s, i) => (
                <Cell key={s.label} fill={i >= 3 ? RED : i === 2 ? YELLOW : GREEN} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 4. Average velocity */}
      <ChartCard title="Average velocity" subtitle="km/s by classification" empty={!hasData || !classification.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={classification} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
            <XAxis type="number" {...axis} unit=" km/s" />
            <YAxis type="category" dataKey="name" width={80} {...axis} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="avgVelocity" name="Avg velocity (km/s)" fill={BLUE} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  );
}
