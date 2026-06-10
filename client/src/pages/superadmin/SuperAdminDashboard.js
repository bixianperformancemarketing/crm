import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import SuperAdminLayout from '../../components/layout/SuperAdminLayout';
import { superAdminAPI } from '../../services/api';
import { formatCurrency, PLAN_LABELS } from '../../utils/helpers';

const SuperAdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superAdminAPI.getDashboard()
      .then(({ data: res }) => setData(res))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const s = data?.stats || {};
  const cards = data ? [
    { label: 'Total Organizations', value: s.totalOrgs || 0, color: '#e94560', icon: '🏢' },
    { label: 'Active Organizations', value: s.activeOrgs || 0, color: '#22c55e', icon: '✅' },
    { label: 'Total Users', value: s.totalUsers || 0, color: '#7c3aed', icon: '👥' },
    { label: 'Total Leads', value: s.totalLeads || 0, color: '#0ea5e9', icon: '🎯' },
    { label: 'Suspended Orgs', value: s.suspendedOrgs || 0, color: '#ef4444', icon: '🚫' },
  ] : [];

  const planCounts = data?.planCounts || [];

  const getStatus = (o) => o.isSuspended ? 'suspended' : o.isActive ? 'active' : 'inactive';
  const statusColor = { active: '#22c55e', suspended: '#ef4444', inactive: '#6b7280' };

  return (
    <SuperAdminLayout title="Platform Dashboard">
      <div className="page-header"><div className="page-title">Platform Overview</div></div>

      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 32 }}>
            {cards.map((c, i) => (
              <div key={i} className="stat-card">
                <div className="stat-icon" style={{ background: `${c.color}22`, color: c.color }}>{c.icon}</div>
                <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
                <div className="stat-label">{c.label}</div>
              </div>
            ))}
          </div>

          {planCounts.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Plan Distribution</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
                {planCounts.map((p, i) => (
                  <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 24px', minWidth: 140, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>{p.count}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{PLAN_LABELS[p.plan] || p.plan}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {data?.recentOrgs?.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Recent Organizations</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Plan</th><th>Status</th><th>Joined</th></tr></thead>
                  <tbody>
                    {data.recentOrgs.map(o => {
                      const st = getStatus(o);
                      return (
                        <tr key={o.id}>
                          <td>
                            <div style={{ fontWeight: 500 }}>{o.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.ownerEmail}</div>
                          </td>
                          <td><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(233,69,96,0.12)', color: 'var(--accent)' }}>{PLAN_LABELS[o.plan] || o.plan}</span></td>
                          <td><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${statusColor[st]}22`, color: statusColor[st] }}>{st}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN') : '—'}</td>
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
    </SuperAdminLayout>
  );
};

export default SuperAdminDashboard;
