import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { orgAPI } from '../../services/api';
import { formatCurrency } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

const OwnerDashboard = () => {
  const { org } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orgAPI.getDashboard()
      .then(({ data: res }) => setData(res))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  // Backend returns: { success, org, stats: { totalLeads, totalWorkspaces }, revenueByWorkspace, leadsByWorkspace }
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
      <div className="page-header"><div className="page-title">Organization Overview</div></div>

      {/* Plan / expiry banners */}
      {org?.plan === 'trial' && daysLeft !== null && daysLeft <= 14 && (
        <div style={{ background: daysLeft <= 3 ? 'rgba(239,68,68,0.09)' : 'rgba(245,158,11,0.08)', border: `1px solid ${daysLeft <= 3 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 8, padding: '11px 18px', marginBottom: 20, fontSize: 13, color: daysLeft <= 3 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
          {daysLeft <= 0 ? '⛔ Your free trial has expired. Contact support to continue.' : `⏳ Free trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Contact support to upgrade.`}
        </div>
      )}
      {org?.plan !== 'trial' && daysLeft !== null && daysLeft <= 7 && (
        <div style={{ background: daysLeft <= 2 ? 'rgba(239,68,68,0.09)' : 'rgba(245,158,11,0.08)', border: `1px solid ${daysLeft <= 2 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 8, padding: '11px 18px', marginBottom: 20, fontSize: 13, color: daysLeft <= 2 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
          {daysLeft <= 0 ? '⛔ Your subscription has expired. Contact support to renew.' : `⚠ Plan expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Renew to avoid interruption.`}
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

          {org && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 22, marginBottom: 24, maxWidth: 500 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Plan — <span style={{ color: 'var(--accent)', textTransform: 'capitalize' }}>{org.plan}</span></div>
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
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Revenue by Workspace</div>
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
