import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import SuperAdminLayout from '../../components/layout/SuperAdminLayout';
import { superAdminAPI } from '../../services/api';

const OrganizationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [plans, setPlans] = useState([]);
  const [editForm, setEditForm] = useState({
    plan: '', planExpiresAt: '', isActive: true, isSuspended: false,
    maxWorkspaces: '', maxUsersPerWorkspace: '', maxLeadsTotal: '',
    canUseWebhooks: false, canUsePDF: false, canUseCSVImport: false,
    canUseContentCalendar: false, canUseAdvancedReports: false,
    canUseQuotations: true, canUseInvoices: true, canUseAppointments: true,
  });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([superAdminAPI.getOrganization(id), superAdminAPI.getPlans()])
      .then(([orgRes, plansRes]) => {
        const o = orgRes.data.organization;
        setOrg(o);
        setWorkspaces(orgRes.data.workspaces || []);
        setPlans(plansRes.data.plans || []);
        setEditForm({
          plan: o.plan,
          planExpiresAt: o.planExpiresAt?.split('T')[0] || '',
          isActive: o.isActive,
          isSuspended: o.isSuspended,
          maxWorkspaces: o.maxWorkspaces,
          maxUsersPerWorkspace: o.maxUsersPerWorkspace,
          maxLeadsTotal: o.maxLeadsTotal,
          canUseWebhooks: o.canUseWebhooks,
          canUsePDF: o.canUsePDF,
          canUseCSVImport: o.canUseCSVImport,
          canUseContentCalendar: o.canUseContentCalendar,
          canUseAdvancedReports: o.canUseAdvancedReports,
          canUseQuotations: o.canUseQuotations ?? true,
          canUseInvoices: o.canUseInvoices ?? true,
          canUseAppointments: o.canUseAppointments ?? true,
        });
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await superAdminAPI.updateOrganization(id, editForm);
      toast.success('Organization updated');
      setShowEdit(false);
      load();
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const handleSuspend = async () => {
    if (!window.confirm(org.isSuspended ? 'Unsuspend?' : 'Suspend this organization?')) return;
    try {
      if (org.isSuspended) await superAdminAPI.unsuspendOrganization(id);
      else await superAdminAPI.suspendOrganization(id);
      toast.success('Status updated');
      load();
    } catch { toast.error('Failed'); }
  };

  if (loading) return <SuperAdminLayout title="Organization"><div className="loading-spinner"><div className="spinner" /></div></SuperAdminLayout>;
  if (!org) return <SuperAdminLayout title="Not Found"><div className="empty-state"><div className="empty-title">Organization not found</div></div></SuperAdminLayout>;

  const status = org.isSuspended ? 'suspended' : org.isActive ? 'active' : 'inactive';
  const statusColor = { active: '#22c55e', suspended: '#ef4444', inactive: '#6b7280' };

  return (
    <SuperAdminLayout title={org.name}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/superadmin/organizations')}>← Back</button>
          <div className="page-title">{org.name}</div>
          <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: `${statusColor[status]}22`, color: statusColor[status] }}>{status}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setShowEdit(true)}>Edit</button>
          <button className="btn btn-ghost" style={{ color: org.isSuspended ? 'var(--success)' : 'var(--danger)' }} onClick={handleSuspend}>
            {org.isSuspended ? 'Unsuspend' : 'Suspend'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Plan', value: org.plan, color: '#a78bfa' },
          { label: 'Owner', value: org.ownerName || '—', color: 'var(--text)' },
          { label: 'Owner Email', value: org.ownerEmail || '—', color: 'var(--text-muted)' },
          { label: 'Max Workspaces', value: org.maxWorkspaces, color: 'var(--text)' },
          { label: 'Max Users per Workspace', value: org.maxUsersPerWorkspace, color: 'var(--text)' },
          { label: 'Max Leads', value: org.maxLeadsTotal, color: 'var(--text)' },
          { label: 'Plan Expires', value: org.planExpiresAt ? new Date(org.planExpiresAt).toLocaleDateString('en-IN') : 'Never', color: 'var(--text-muted)' },
          { label: 'Created', value: new Date(org.createdAt).toLocaleDateString('en-IN'), color: 'var(--text-muted)' },
        ].map((item, i) => (
          <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontWeight: 700, color: item.color, textTransform: 'capitalize', fontSize: 13, wordBreak: 'break-word' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Features & Limits</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { key: 'canUseQuotations', label: 'Quotations' },
            { key: 'canUseInvoices', label: 'Invoices' },
            { key: 'canUseAppointments', label: 'Appointments' },
            { key: 'canUsePDF', label: 'PDF / Email / WhatsApp' },
            { key: 'canUseCSVImport', label: 'CSV Import' },
            { key: 'canUseContentCalendar', label: 'Tasks' },
            { key: 'canUseAdvancedReports', label: 'Advanced Reports' },
            { key: 'canUseWebhooks', label: 'Webhooks & Lead Integrations' },
          ].map(({ key, label }) => (
            <span key={key} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: org[key] ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.1)', color: org[key] ? '#22c55e' : '#6b7280', fontWeight: 600 }}>
              {org[key] ? '✓' : '✗'} {label}
            </span>
          ))}
        </div>
      </div>

      {workspaces.length > 0 && (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Workspaces ({workspaces.length})</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Status</th></tr></thead>
              <tbody>
                {workspaces.map(w => (
                  <tr key={w.id}>
                    <td style={{ fontWeight: 500 }}>{w.name}</td>
                    <td><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: w.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: w.isActive ? '#22c55e' : '#6b7280' }}>{w.isActive ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h3>Update Organization</h3>
            <button className="modal-close" onClick={() => setShowEdit(false)}>×</button>
            <form onSubmit={handleUpdate}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Plan</label>
                  <select className="form-control" value={editForm.plan} onChange={e => {
                    const selected = plans.find(p => p.name === e.target.value);
                    setEditForm(f => ({
                      ...f,
                      plan: e.target.value,
                      maxWorkspaces: selected?.maxWorkspaces ?? f.maxWorkspaces,
                      maxUsersPerWorkspace: selected?.maxUsersPerWorkspace ?? f.maxUsersPerWorkspace,
                      maxLeadsTotal: selected?.maxLeadsTotal ?? f.maxLeadsTotal,
                      canUseWebhooks: selected?.canUseWebhooks ?? f.canUseWebhooks,
                      canUsePDF: selected?.canUsePDF ?? f.canUsePDF,
                      canUseCSVImport: selected?.canUseCSVImport ?? f.canUseCSVImport,
                      canUseContentCalendar: selected?.canUseContentCalendar ?? f.canUseContentCalendar,
                      canUseAdvancedReports: selected?.canUseAdvancedReports ?? f.canUseAdvancedReports,
                    }));
                  }}>
                    {plans.map(p => <option key={p.id} value={p.name}>{p.displayName || p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Plan Expires At</label>
                  <input className="form-control" type="date" value={editForm.planExpiresAt} onChange={e => setEditForm({ ...editForm, planExpiresAt: e.target.value })} />
                  <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                    {[{ label: '+5d', days: 5 }, { label: '+1w', days: 7 }, { label: '+15d', days: 15 }, { label: '+30d', days: 30 }, { label: '+90d', days: 90 }].map(({ label, days }) => (
                      <button key={days} type="button" onClick={() => {
                        const base = editForm.planExpiresAt ? new Date(editForm.planExpiresAt) : new Date();
                        if (isNaN(base)) return;
                        base.setDate(base.getDate() + days);
                        setEditForm({ ...editForm, planExpiresAt: base.toISOString().split('T')[0] });
                      }} style={{ padding: '3px 9px', fontSize: 11, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 10px', textTransform: 'uppercase', letterSpacing: 1 }}>Custom Limits (overrides plan defaults)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Max Workspaces</label>
                  <input className="form-control" type="number" min="1" value={editForm.maxWorkspaces} onChange={e => setEditForm({ ...editForm, maxWorkspaces: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Users/Workspace</label>
                  <input className="form-control" type="number" min="1" value={editForm.maxUsersPerWorkspace} onChange={e => setEditForm({ ...editForm, maxUsersPerWorkspace: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Max Leads</label>
                  <input className="form-control" type="number" min="1" value={editForm.maxLeadsTotal} onChange={e => setEditForm({ ...editForm, maxLeadsTotal: e.target.value })} />
                </div>
              </div>

              <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Features</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  { key: 'canUseQuotations', label: 'Quotations' },
                  { key: 'canUseInvoices', label: 'Invoices' },
                  { key: 'canUseAppointments', label: 'Appointments' },
                  { key: 'canUsePDF', label: 'PDF / Email / WhatsApp' },
                  { key: 'canUseCSVImport', label: 'CSV Import' },
                  { key: 'canUseContentCalendar', label: 'Tasks' },
                  { key: 'canUseAdvancedReports', label: 'Advanced Reports' },
                  { key: 'canUseWebhooks', label: 'Webhooks & Lead Integrations' },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!editForm[key]} onChange={e => setEditForm({ ...editForm, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
};

export default OrganizationDetail;
