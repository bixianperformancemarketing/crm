import React, { useState, useEffect, useCallback } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import UpgradeModal from '../components/common/UpgradeModal';
import { reportsAPI } from '../services/api';
import { formatCurrency, buildMonthlyChartData } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import './Reports.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend);

const COLORS = ['#e94560', '#7c3aed', '#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#f97316'];

const Reports = () => {
  const { org, hasFeature } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgradeModal, setUpgradeModal] = useState(null);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const today = new Date();
  const [startDate, setStartDate] = useState(`${today.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.getAttribute('data-theme') || 'dark'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const tc = theme === 'light' ? '#374151' : '#9ca3af';
  const gc = theme === 'light' ? '#e5e7eb' : '#1e1e3a';
  const CHART_OPTS = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc, boxWidth: 12 } } }, scales: { x: { ticks: { color: tc, font: { size: 11 } }, grid: { color: gc } }, y: { ticks: { color: tc, font: { size: 11 } }, grid: { color: gc } } } };
  const PIE_OPTS = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: tc, boxWidth: 12, font: { size: 11 } } } } };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await reportsAPI.getAdvanced({ startDate, endDate });
      if (res.upgradeRequired) { setUpgradeModal(res); setLoading(false); return; }
      setData(res);
    } catch (err) {
      const d = err.response?.data;
      if (d?.upgradeRequired) { setUpgradeModal(d); setLoading(false); return; }
      toast.error('Failed to load reports');
    } finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  if (!hasFeature('canUseAdvancedReports')) {
    return (
      <Layout title="Reports">
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-title">Advanced Reports</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 400, textAlign: 'center' }}>Upgrade to Growth or Agency plan to access advanced reports with agent performance, revenue analytics, and conversion tracking.</div>
          {upgradeModal && <UpgradeModal message={upgradeModal.message} limitType={upgradeModal.limitType} plan={org?.plan} onClose={() => setUpgradeModal(null)} />}
        </div>
      </Layout>
    );
  }

  const sourceChart = data ? {
    labels: (data.leadBySource || []).map(s => s.source),
    datasets: [{ data: (data.leadBySource || []).map(s => parseInt(s.count || 0)), backgroundColor: COLORS }],
  } : null;

  const revenueMonthly = buildMonthlyChartData(data?.revenueByMonth || [], 12);
  const revenueChart = {
    labels: revenueMonthly.labels,
    datasets: [{ label: 'Revenue (₹)', data: revenueMonthly.values, backgroundColor: 'rgba(233,69,96,0.6)', borderColor: '#e94560', borderWidth: 2 }],
  };

  const contentChart = data?.contentStats ? {
    labels: Object.keys(data.contentStats),
    datasets: [{ data: Object.values(data.contentStats), backgroundColor: COLORS }],
  } : null;

  return (
    <Layout title="Reports">
      <div className="reports-header">
        <div className="page-title">Advanced Reports</div>
        <div className="reports-date-filter">
          <span style={{ color: 'var(--text-muted)' }}>From</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span style={{ color: 'var(--text-muted)' }}>To</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <button className="btn btn-primary btn-sm" onClick={load} disabled={loading}>{loading ? '...' : 'Apply'}</button>
        </div>
      </div>

      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : !data ? null : (
        <>
          <div className="reports-grid">
            <div className="report-chart-card">
              <div className="report-chart-title">Revenue by Month</div>
              <div className="report-chart-container"><Bar data={revenueChart} options={CHART_OPTS} /></div>
            </div>
            {sourceChart && (
              <div className="report-chart-card">
                <div className="report-chart-title">Leads by Source</div>
                <div className="report-chart-container"><Doughnut data={sourceChart} options={PIE_OPTS} /></div>
              </div>
            )}
            {contentChart && (
              <div className="report-chart-card">
                <div className="report-chart-title">Content Tasks by Status</div>
                <div className="report-chart-container"><Doughnut data={contentChart} options={PIE_OPTS} /></div>
              </div>
            )}
          </div>

          {data.agentStats && data.agentStats.length > 0 && (
            <>
              <div className="reports-section-title">Agent Performance</div>
              <div className="table-wrap">
                <table className="agent-table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Total Leads</th>
                      <th>Won</th>
                      <th>Lost</th>
                      <th>Active</th>
                      <th>Conversion Rate</th>
                      <th>Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.agentStats.map((a, i) => {
                      const conv = parseFloat(a.conversionRate || 0);
                      return (
                        <tr key={i}>
                          <td>
                            <div style={{ fontWeight: 500 }}>{a.agentName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.agentEmail}</div>
                          </td>
                          <td style={{ fontWeight: 700 }}>{a.totalLeads}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>{a.wonLeads}</td>
                          <td style={{ color: 'var(--danger)' }}>{a.lostLeads}</td>
                          <td style={{ color: '#0ea5e9' }}>{a.activeLeads}</td>
                          <td>
                            <span style={{ fontWeight: 700, color: conv >= 50 ? 'var(--success)' : conv >= 25 ? '#f59e0b' : 'var(--text-muted)' }}>
                              {conv.toFixed(1)}%
                            </span>
                          </td>
                          <td>
                            <div className="perf-bar-wrap">
                              <div className="perf-bar" style={{ width: `${Math.min(conv, 100)}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {data.revenueByMonth && (
            <>
              <div className="reports-section-title">Revenue Summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                {[
                  { label: 'Total Revenue', value: formatCurrency(data.totalRevenue || 0), color: 'var(--success)' },
                  { label: 'Total Invoices', value: data.totalInvoices || 0, color: 'var(--accent)' },
                  { label: 'Paid Invoices', value: data.paidInvoices || 0, color: '#22c55e' },
                  { label: 'Pending Amount', value: formatCurrency(data.pendingAmount || 0), color: '#f59e0b' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {upgradeModal && <UpgradeModal message={upgradeModal.message} limitType={upgradeModal.limitType} plan={org?.plan} onClose={() => setUpgradeModal(null)} />}
    </Layout>
  );
};

export default Reports;
