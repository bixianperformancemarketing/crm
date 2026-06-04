import React, { useState, useEffect, useCallback } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import Pagination from '../components/common/Pagination';
import { paymentsAPI } from '../services/api';
import { formatCurrency, formatDateTime, buildMonthlyChartData } from '../utils/helpers';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([paymentsAPI.getAll({ page }), paymentsAPI.getStats()]);
      setPayments(listRes.data.data || []);
      setPagination(listRes.data.pagination);
      setStats(statsRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const monthlyData = buildMonthlyChartData(stats?.monthly || [], 6);
  const modeChart = {
    labels: (stats?.byMode || []).map((m) => m.mode),
    datasets: [{ data: (stats?.byMode || []).map((m) => parseFloat(m.total || 0)), backgroundColor: ['#e94560', '#7c3aed', '#0ea5e9', '#22c55e', '#f59e0b'] }],
  };
  const revenueChart = {
    labels: monthlyData.labels,
    datasets: [{ label: 'Revenue', data: monthlyData.values, backgroundColor: 'rgba(233,69,96,0.7)', borderColor: '#e94560', borderWidth: 1 }],
  };

  const tickColor = theme === 'light' ? '#374151' : '#cbd5e1';
  const gridColor = theme === 'light' ? '#e5e7eb' : '#1e1e3a';
  const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tickColor } } }, scales: { x: { ticks: { color: tickColor }, grid: { color: gridColor } }, y: { ticks: { color: tickColor }, grid: { color: gridColor } } } };
  const pieOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickColor } } } };

  return (
    <Layout title="Payments">
      <div className="page-header"><div className="page-title">Payment History</div></div>
      {stats && (
        <div className="charts-grid">
          <div className="chart-card"><div className="chart-title">Revenue by Month</div><div className="chart-container"><Bar data={revenueChart} options={opts} /></div></div>
          <div className="chart-card"><div className="chart-title">Revenue by Payment Mode</div><div className="chart-container"><Doughnut data={modeChart} options={pieOpts} /></div></div>
        </div>
      )}
      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : payments.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">💰</div><div className="empty-title">No payments yet</div></div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Invoice</th><th>Client</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Received By</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(p.receivedAt)}</td>
                    <td style={{ color: 'var(--accent)' }}>{p.invoice?.invoiceNumber}</td>
                    <td>{p.invoice?.clientName}</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(p.amount)}</td>
                    <td><span style={{ background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>{p.mode}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.reference || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.receiver?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </Layout>
  );
};

export default Payments;
