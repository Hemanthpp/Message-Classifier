// Dashboard.jsx — Minimalist overview
import { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { MessageSquare, Calendar, ShieldAlert, Activity } from 'lucide-react';
import { api } from '../api';
import { CATEGORY_LABELS, formatPercent } from '../utils';

const CATEGORY_COLORS = {
  action_required:       '#7c6eff',
  meeting_or_event:      '#22c55e',
  personal_information:  '#06b6d4',
  general_information:   '#52525a',
  promotional:           '#f59e0b',
  sensitive_information: '#ef4444',
};

const RISK_COLORS = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#22c55e',
};

function StatCard({ icon: Icon, value, label }) {
  return (
    <div className="stat-card">
      <div className="stat-icon"><Icon size={16} /></div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <span style={{ color: 'var(--t2)', marginRight: 6 }}>{payload[0].name}</span>
      <strong>{payload[0].value}</strong>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.stats()
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  if (!stats?.total_messages) return (
    <div className="empty-state">Run <code>python pipeline.py</code> to generate results.</div>
  );

  const categoryData = Object.entries(stats.categories || {}).map(([key, val]) => ({
    name: CATEGORY_LABELS[key] || key,
    value: val,
    fill: CATEGORY_COLORS[key] || '#555',
  }));

  const riskData = Object.entries(stats.sensitivity_risks || {}).map(([key, val]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: val,
    fill: RISK_COLORS[key] || '#555',
  }));

  return (
    <div>
      <div className="page-header">
        <h1>Overview</h1>
        <p>{stats.total_messages} messages processed · avg confidence {formatPercent(stats.avg_confidence)}</p>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard icon={MessageSquare} value={stats.total_messages}    label="Classified" />
        <StatCard icon={Calendar}      value={stats.total_tasks_events} label="Tasks & Events" />
        <StatCard icon={ShieldAlert}   value={stats.total_sensitive}    label="Sensitive" />
        <StatCard icon={Activity}      value={formatPercent(stats.avg_confidence)} label="Avg Confidence" />
      </div>

      {/* Charts */}
      <div className="chart-grid">
        {/* Donut — categories */}
        <div className="chart-card">
          <div className="chart-title">By Category</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="value"
                nameKey="name"
                cx="50%" cy="50%"
                outerRadius={80} innerRadius={44}
                paddingAngle={2}
                stroke="none"
              >
                {categoryData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend-row">
            {categoryData.map(d => (
              <div key={d.name} className="legend-item">
                <div className="legend-dot" style={{ background: d.fill }} />
                {d.name} <span style={{ color: 'var(--t1)', fontWeight: 500 }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar — sensitivity risk */}
        <div className="chart-card">
          <div className="chart-title">Sensitive by Risk</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={riskData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--t3)', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--t3)', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {riskData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category table breakdown */}
      <div className="chart-card">
        <div className="chart-title">Category Breakdown</div>
        <div style={{ marginTop: 4 }}>
          {categoryData.map(d => {
            const pct = ((d.value / stats.total_messages) * 100).toFixed(1);
            return (
              <div key={d.name} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.55rem 0',
                borderBottom: '1px solid var(--line)',
              }}>
                <div className="legend-dot" style={{ background: d.fill, width: 7, height: 7 }} />
                <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--t2)' }}>{d.name}</span>
                <div style={{
                  flex: 2,
                  height: 3,
                  background: 'var(--surface-3)',
                  borderRadius: 99,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: d.fill,
                    borderRadius: 99,
                    opacity: 0.7,
                  }} />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--t3)', fontVariantNumeric: 'tabular-nums', width: 36, textAlign: 'right' }}>
                  {pct}%
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--t2)', fontVariantNumeric: 'tabular-nums', width: 28, textAlign: 'right', fontWeight: 500 }}>
                  {d.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
