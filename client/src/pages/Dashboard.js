import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import Layout from '../components/layout/Layout';
import { reportsAPI, followupsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatTime, buildMonthlyChartData } from '../utils/helpers';
import './Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [overdueCount, setOverdueCount] = useState(0);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

  const canAccessLeads = user?.role !== 'employee' || user?.canAccessLeads !== false;
  const canUseTasks = user?.role !== 'employee' || !!user?.canUseContentCalendar;

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.getAttribute('data-theme') || 'dark'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, overdueRes] = await Promise.all([
          reportsAPI.getDashboard(),
          followupsAPI.getOverdueCount(),
        ]);
        setData(dashRes.data);
        setOverdueCount(overdueRes?.data?.overdueCount || 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Layout title="Dashboard"><div className="loading-spinner"><div className="spinner" /></div></Layout>;
  if (!data) return <Layout title="Dashboard"><div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">Failed to load dashboard</div></div></Layout>;

  const tc = theme === 'light' ? '#374151' : '#9ca3af';
  const gc = theme === 'light' ? '#e5e7eb' : '#1e1e3a';
  const chartDefaults = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc, font: { size: 11 } } } }, scales: { x: { ticks: { color: tc }, grid: { color: gc } }, y: { ticks: { color: tc }, grid: { color: gc } } } };

  const { stats, charts } = data;
  const monthlyData = buildMonthlyChartData(charts?.monthlyRevenue || [], 12);
  const volumeData = buildMonthlyChartData(charts?.leadVolume || [], 6);

  const revenueChart = {
    labels: monthlyData.labels,
    datasets: [{ label: 'Revenue (₹)', data: monthlyData.values, borderColor: '#e94560', backgroundColor: 'rgba(233,69,96,0.08)', tension: 0.4, fill: true, pointBackgroundColor: '#e94560' }],
  };

  const funnelChart = {
    labels: (charts?.leadByStatus || []).map((l) => l.status),
    datasets: [{ data: (charts?.leadByStatus || []).map((l) => parseInt(l.count)), backgroundColor: ['#0ea5e9', '#f59e0b', '#7c3aed', '#e94560', '#22c55e', '#6b7280'] }],
  };

  const sourceChart = {
    labels: (charts?.leadBySource || []).map((l) => l.source),
    datasets: [{ label: 'Leads', data: (charts?.leadBySource || []).map((l) => parseInt(l.count)), backgroundColor: 'rgba(124,58,237,0.7)', borderColor: '#7c3aed', borderWidth: 1 }],
  };

  const volumeChart = {
    labels: volumeData.labels,
    datasets: [{ label: 'Leads', data: volumeData.values, borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.08)', tension: 0.4, fill: true }],
  };

  const doughnutDefaults = { ...chartDefaults, scales: undefined, plugins: { legend: { position: 'bottom', labels: { color: tc, font: { size: 11 } } } } };

  const leadStatCards = [
    { label: 'Total Leads', value: stats.totalLeads, icon: '👥', color: '#0ea5e9' },
    { label: 'Active Leads', value: stats.activeLeads, icon: '🔥', color: '#f59e0b' },
    { label: 'Won Leads', value: stats.wonLeads, icon: '✅', color: '#22c55e' },
    { label: 'Hot Leads', value: stats.hotLeads, icon: '⚡', color: '#ef4444' },
    { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: '💰', color: '#22c55e' },
    { label: 'Pending Revenue', value: formatCurrency(stats.pendingRevenue), icon: '⏳', color: '#f59e0b' },
    { label: 'Overdue Invoices', value: stats.overdueInvoices, icon: '🧾', color: '#ef4444' },
    { label: "Today's Appts", value: stats.todayAppts, icon: '📅', color: '#7c3aed' },
    { label: 'Pending Followups', value: stats.pendingFollowups, icon: '📞', color: '#0ea5e9' },
    { label: 'Overdue Followups', value: stats.overdueFollowups, icon: '⏰', color: '#ef4444' },
    { label: 'Conversion Rate', value: `${stats.conversionRate}%`, icon: '📈', color: '#22c55e' },
    { label: 'Avg Deal Size', value: formatCurrency(stats.avgDealSize), icon: '💎', color: '#7c3aed' },
  ];

  const taskStatCards = [
    { label: 'Total Tasks', value: stats.totalTasks ?? 0, icon: '✅', color: '#a78bfa' },
    { label: 'Pending Tasks', value: stats.pendingTasks ?? 0, icon: '⏳', color: '#f59e0b' },
    { label: 'In Progress', value: stats.inProgressTasks ?? 0, icon: '🔄', color: '#0ea5e9' },
    { label: 'In Review', value: stats.reviewTasks ?? 0, icon: '🔍', color: '#7c3aed' },
    { label: 'Done', value: stats.doneTasks ?? 0, icon: '🎉', color: '#22c55e' },
  ];

  return (
    <Layout title="Dashboard">
      {canAccessLeads && overdueCount > 0 && (
        <div className="overdue-banner">
          <span className="overdue-icon">⚠️</span>
          <span>You have <strong>{overdueCount}</strong> overdue followup{overdueCount > 1 ? 's' : ''}.</span>
          <Link to="/followups?filter=overdue" style={{ marginLeft: 8 }}>View them →</Link>
        </div>
      )}

      {canAccessLeads && (
        <div style={{ marginBottom: 24 }}>
          {canUseTasks && (
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Leads & Revenue
            </div>
          )}
          <div className="stats-grid">
            {leadStatCards.map((s) => (
              <div className="stat-card" key={s.label}>
                <div className="stat-icon">{s.icon}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {canUseTasks && (
        <div style={{ marginBottom: 24 }}>
          {canAccessLeads && (
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Tasks
            </div>
          )}
          <div className="stats-grid">
            {taskStatCards.map((s) => (
              <div className="stat-card" key={s.label}>
                <div className="stat-icon">{s.icon}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {canAccessLeads && (
        <div className="charts-grid">
          <div className="chart-card">
            <div className="chart-title">Monthly Revenue (Last 12 Months)</div>
            <div className="chart-container"><Line data={revenueChart} options={chartDefaults} /></div>
          </div>
          <div className="chart-card">
            <div className="chart-title">Lead Funnel by Status</div>
            <div className="chart-container"><Doughnut data={funnelChart} options={doughnutDefaults} /></div>
          </div>
          <div className="chart-card">
            <div className="chart-title">Leads by Source</div>
            <div className="chart-container"><Bar data={sourceChart} options={{ ...chartDefaults, plugins: { legend: { display: false } } }} /></div>
          </div>
          <div className="chart-card">
            <div className="chart-title">Lead Volume (Last 6 Months)</div>
            <div className="chart-container"><Line data={volumeChart} options={chartDefaults} /></div>
          </div>
        </div>
      )}

      {canAccessLeads && (
        <div className="dashboard-grid">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">📞 Today's Followups</h3>
              <Link to="/followups" className="btn btn-ghost btn-sm">View All</Link>
            </div>
            {data.todayFollowups?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No followups today</div>
            ) : (
              <div className="timeline-list">
                {(data.todayFollowups || []).map((f) => (
                  <div className="followup-item" key={f.id}>
                    <div>
                      <div className="followup-lead">{f.lead?.name || 'Unknown'}</div>
                      {f.note && <div className="followup-note">{f.note}</div>}
                    </div>
                    <div className="followup-time">{formatTime(f.scheduledAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">📅 Today's Appointments</h3>
              <Link to="/appointments" className="btn btn-ghost btn-sm">View All</Link>
            </div>
            {data.todayAppointments?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No appointments today</div>
            ) : (
              <div className="timeline-list">
                {(data.todayAppointments || []).map((a) => (
                  <div className="followup-item" key={a.id}>
                    <div>
                      <div className="followup-lead">{a.title}</div>
                      <div className="followup-note">{a.type} · {a.assignee?.name}</div>
                    </div>
                    <div className="followup-time">{formatTime(a.startTime)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Dashboard;
