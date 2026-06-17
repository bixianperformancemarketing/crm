import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { orgAPI, reportsAPI } from '../../services/api';
import { formatCurrency, PLAN_LABELS } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import PlansModal from '../../components/common/PlansModal';

const PERIODS = [
  { value: 'this_month',   label: 'This Month' },
  { value: 'last_month',   label: 'Last Month' },
  { value: 'this_week',    label: 'This Week' },
  { value: 'last_week',    label: 'Last Week' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year',    label: 'This Year' },
  { value: 'overall',      label: 'Overall' },
  { value: 'custom',       label: 'Custom Range' },
];

const MetricCard = ({ label, value, color, sub }) => (
  <div style={{ background: 'var(--card-bg)', border: `1px solid ${color}33`, borderRadius: 10, padding: '14px 16px' }}>
    <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginTop: 4 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color, marginTop: 2 }}>{sub}</div>}
  </div>
);

const OwnerDashboard = () => {
  const { org } = useAuth();
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [data, setData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [apiParams, setApiParams] = useState({ period: 'this_month' });

  useEffect(() => {
    if (data !== null) setRefreshing(true);
    Promise.all([
      orgAPI.getDashboard(apiParams),
      reportsAPI.getDashboard(apiParams),
    ])
      .then(([orgRes, metricsRes]) => {
        setData(orgRes.data);
        setMetrics(metricsRes.data);
      })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiParams]);

  const handlePeriodChange = (val) => {
    setPeriod(val);
    if (val !== 'custom') setApiParams({ period: val });
  };

  const applyCustomRange = () => {
    if (!customFrom || !customTo || customFrom > customTo) return;
    setApiParams({ from: customFrom, to: customTo });
  };

  const periodLabel = apiParams.from
    ? `${apiParams.from}  →  ${apiParams.to}`
    : PERIODS.find(p => p.value === period)?.label;

  const stats = data?.stats || {};
  const cards = data ? [
    { label: 'Total Workspaces', value: stats.totalWorkspaces || 0, color: '#7c3aed', icon: '📁' },
    { label: 'Total Leads', value: stats.totalLeads || 0, color: '#e94560', icon: '🎯' },
    { label: 'Leads Limit', value: stats.leadsLimit || org?.maxLeadsTotal || 0, color: '#0ea5e9', icon: '📊' },
    { label: 'Workspaces Limit', value: stats.workspacesLimit || org?.maxWorkspaces || 0, color: '#a78bfa', icon: '🗂️' },
  ] : [];

  const daysLeft = org?.planExpiresAt ? Math.ceil((new Date(org.planExpiresAt) - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const wsUsed = data?.stats?.totalWorkspaces || 0;
  const wsLimit = data?.stats?.workspacesLimit || org?.maxWorkspaces || 1;
  const leadsUsed = data?.stats?.totalLeads || 0;
  const leadsLimit = data?.stats?.leadsLimit || org?.maxLeadsTotal || 1;

  return (
    <Layout title="Owner Dashboard">
      {showPlansModal && <PlansModal onClose={() => setShowPlansModal(false)} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Organization Overview</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Period:</span>
          <select
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="filter-select"
          >
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {period === 'custom' && (
            <>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="form-control"
                style={{ width: 'auto' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="form-control"
                style={{ width: 'auto' }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={applyCustomRange}
                disabled={!customFrom || !customTo || customFrom > customTo}
              >
                Apply
              </button>
            </>
          )}
        </div>
      </div>

      {/* Plan / expiry banners */}
      {org?.plan === 'trial' && daysLeft !== null && daysLeft <= 14 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: daysLeft <= 3 ? 'rgba(239,68,68,0.09)' : 'rgba(245,158,11,0.08)', border: `1px solid ${daysLeft <= 3 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 8, padding: '11px 18px', marginBottom: 20, fontSize: 13, color: daysLeft <= 3 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
          <span>{daysLeft <= 0 ? '⛔ Your free trial has expired.' : `⏳ Free trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`}</span>
          <button onClick={() => setShowPlansModal(true)} style={{ marginLeft: 16, padding: '5px 14px', borderRadius: 6, border: 'none', background: daysLeft <= 3 ? '#ef4444' : '#f59e0b', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>View Plans</button>
        </div>
      )}
      {org?.plan !== 'trial' && daysLeft !== null && daysLeft <= 7 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: daysLeft <= 2 ? 'rgba(239,68,68,0.09)' : 'rgba(245,158,11,0.08)', border: `1px solid ${daysLeft <= 2 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 8, padding: '11px 18px', marginBottom: 20, fontSize: 13, color: daysLeft <= 2 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
          <span>{daysLeft <= 0 ? '⛔ Your subscription has expired.' : `⚠ Plan expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Renew to avoid interruption.`}</span>
          <button onClick={() => setShowPlansModal(true)} style={{ marginLeft: 16, padding: '5px 14px', borderRadius: 6, border: 'none', background: daysLeft <= 2 ? '#ef4444' : '#f59e0b', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Renew Now</button>
        </div>
      )}
      {!loading && wsUsed >= wsLimit && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '11px 18px', marginBottom: 20, fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
          ⚠ Workspace limit reached ({wsUsed}/{wsLimit}). Upgrade your plan to add more workspaces.
        </div>
      )}
      {!loading && leadsUsed >= leadsLimit && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '11px 18px', marginBottom: 20, fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
          ⚠ Lead limit reached ({leadsUsed}/{leadsLimit}). Upgrade your plan to capture more leads.
        </div>
      )}

      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
        <>
          <div className="stats-grid" style={{ marginBottom: 28 }}>
            {cards.map((c, i) => (
              <div key={i} className="stat-card">
                <div className="stat-icon" style={{ background: `${c.color}22`, color: c.color }}>{c.icon}</div>
                <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
                <div className="stat-label">{c.label}</div>
              </div>
            ))}
          </div>

          {metrics && (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                Live Org Metrics
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>— {periodLabel}</span>
                {refreshing && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Updating...</span>}
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Leads & Revenue</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                <MetricCard label="Total Leads" value={metrics.stats?.totalLeads ?? 0} color="#10b981" />
                <MetricCard label="Active Leads" value={metrics.stats?.activeLeads ?? 0} color="#6366f1" />
                <MetricCard label="Won Leads" value={metrics.stats?.wonLeads ?? 0} color="#22c55e" />
                <MetricCard label="Hot Leads" value={metrics.stats?.hotLeads ?? 0} color="#ef4444" />
                <MetricCard label="Total Revenue" value={formatCurrency(metrics.stats?.totalRevenue ?? 0)} color="#22c55e" />
                <MetricCard label="Pending Revenue" value={formatCurrency(metrics.stats?.pendingRevenue ?? 0)} color="#f59e0b" />
                <MetricCard label="Overdue Invoices" value={metrics.stats?.overdueInvoices ?? 0} color="#ef4444" />
                <MetricCard label="Overdue Followups" value={metrics.stats?.overdueFollowups ?? 0} color="#ef4444" />
                <MetricCard label="Pending Followups" value={metrics.stats?.pendingFollowups ?? 0} color="#f59e0b" />
                <MetricCard label="Today's Appointments" value={metrics.stats?.todayAppts ?? 0} color="#6366f1" />
                <MetricCard label="Conversion Rate" value={`${metrics.stats?.conversionRate ?? 0}%`} color="#10b981" />
                <MetricCard label="Avg Deal Size" value={formatCurrency(metrics.stats?.avgDealSize ?? 0)} color="#a78bfa" />
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Tasks</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
                <MetricCard label="Total Tasks" value={metrics.stats?.totalTasks ?? 0} color="#a78bfa" />
                <MetricCard label="Overdue" value={metrics.stats?.overviewTasks ?? 0} color="#ef4444" />
                <MetricCard label="To Do Today" value={metrics.stats?.todoTodayTasks ?? 0} color="#0ea5e9" />
                <MetricCard label="In Progress" value={metrics.stats?.inProgressTasks ?? 0} color="#a78bfa" />
                <MetricCard label="In Review" value={metrics.stats?.reviewTasks ?? 0} color="#f59e0b" />
                <MetricCard label="Approved" value={metrics.stats?.approvedTasks ?? 0} color="#22c55e" />
                <MetricCard label="Not Approved" value={metrics.stats?.notApprovedTasks ?? 0} color="#ef4444" />
                <MetricCard label="Done" value={metrics.stats?.doneTasks ?? 0} color="#22c55e" />
                <MetricCard label="Cancelled" value={metrics.stats?.cancelledTasks ?? 0} color="#6b7280" />
              </div>
            </>
          )}

          {org && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 22, marginBottom: 24, maxWidth: 500 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Plan — <span style={{ color: 'var(--accent)' }}>{PLAN_LABELS[org.plan] || org.plan}</span></div>
              {[
                { label: 'Leads', used: stats.totalLeads || 0, max: stats.leadsLimit || org.maxLeadsTotal || 1 },
                { label: 'Workspaces', used: stats.totalWorkspaces || 0, max: stats.workspacesLimit || org.maxWorkspaces || 1 },
              ].map(item => {
                const pct = Math.min(100, Math.round((item.used / item.max) * 100));
                return (
                  <div key={item.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                      <span style={{ fontWeight: 600 }}>{item.used} / {item.max}</span>
                    </div>
                    <div style={{ background: '#1a1a2e', borderRadius: 20, height: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: 8, borderRadius: 20, background: pct >= 90 ? 'var(--danger)' : pct >= 70 ? '#f59e0b' : 'var(--accent)', transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Plan expires: <strong>{org.planExpiresAt ? new Date(org.planExpiresAt).toLocaleDateString('en-IN') : 'Never'}</strong>
              </div>
            </div>
          )}

          {data?.revenueByWorkspace?.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                Revenue by Workspace
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>— {periodLabel}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Workspace</th><th>Leads</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {data.revenueByWorkspace.map((w, i) => {
                      const leadsEntry = data.leadsByWorkspace?.find(l => l.workspaceId === w.workspaceId);
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{w.workspace}</td>
                          <td>{leadsEntry?.count || 0}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(w.total || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </Layout>
  );
};

export default OwnerDashboard;
