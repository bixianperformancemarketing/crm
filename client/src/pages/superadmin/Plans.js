import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import SuperAdminLayout from '../../components/layout/SuperAdminLayout';
import { superAdminAPI } from '../../services/api';

const FEATURE_LABELS = {
  canUseQuotations: 'Quotations',
  canUseInvoices: 'Invoices',
  canUseAppointments: 'Appointments',
  canUsePDF: 'PDF / Email / WhatsApp',
  canUseCSVImport: 'CSV Import',
  canUseContentCalendar: 'Tasks',
  canUseAdvancedReports: 'Advanced Reports',
  canUseWebhooks: 'Webhooks & Lead Integrations',
};

const Plans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editPlan, setEditPlan] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    superAdminAPI.getPlans()
      .then(({ data }) => setPlans(data.plans || []))
      .catch(() => toast.error('Failed to load plans'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openEdit = (p) => {
    setForm({
      displayName: p.displayName || p.name,
      price: p.price,
      maxWorkspaces: p.maxWorkspaces,
      maxUsersPerWorkspace: p.maxUsersPerWorkspace,
      maxLeadsTotal: p.maxLeadsTotal,
      canUsePDF: p.canUsePDF,
      canUseWebhooks: p.canUseWebhooks,
      canUseAdvancedReports: p.canUseAdvancedReports,
      canUseContentCalendar: p.canUseContentCalendar,
      canUseCSVImport: p.canUseCSVImport,
      canUseQuotations: p.canUseQuotations ?? true,
      canUseInvoices: p.canUseInvoices ?? true,
      canUseAppointments: p.canUseAppointments ?? true,
    });
    setEditPlan(p);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await superAdminAPI.updatePlan(editPlan.id, form);
      toast.success('Plan updated');
      setEditPlan(null);
      load();
    } catch { toast.error('Failed to update plan'); }
    finally { setSaving(false); }
  };

  return (
    <SuperAdminLayout title="Plans">
      <div className="page-header"><div className="page-title">Subscription Plans</div></div>

      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {plans.map(p => (
            <div key={p.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, textTransform: 'capitalize' }}>{p.displayName || p.name}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
                    {p.price === 0 ? 'Free' : `₹${Number(p.price || 0).toLocaleString('en-IN')}/mo`}
                  </div>
                </div>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(124,58,237,0.12)', color: '#a78bfa', textTransform: 'uppercase' }}>{p.name}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 2, marginBottom: 16 }}>
                <div>👥 {p.maxUsersPerWorkspace} users/workspace</div>
                <div>🎯 {p.maxLeadsTotal} leads total</div>
                <div>📁 {p.maxWorkspaces} workspaces</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                  <span key={key} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: p[key] ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.1)', color: p[key] ? '#22c55e' : '#6b7280' }}>
                    {p[key] ? '✓' : '✗'} {label}
                  </span>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit Plan</button>
            </div>
          ))}
        </div>
      )}

      {editPlan && (
        <div className="modal-overlay" onClick={() => setEditPlan(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h3>Edit Plan: {editPlan.displayName || editPlan.name}</h3>
            <button className="modal-close" onClick={() => setEditPlan(null)}>×</button>
            <form onSubmit={handleSave}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Display Name</label><input className="form-control" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Price (₹/mo)</label><input className="form-control" type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group"><label className="form-label">Max Workspaces</label><input className="form-control" type="number" min="1" value={form.maxWorkspaces} onChange={e => setForm({ ...form, maxWorkspaces: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Users/Workspace</label><input className="form-control" type="number" min="1" value={form.maxUsersPerWorkspace} onChange={e => setForm({ ...form, maxUsersPerWorkspace: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Max Leads</label><input className="form-control" type="number" min="1" value={form.maxLeadsTotal} onChange={e => setForm({ ...form, maxLeadsTotal: e.target.value })} /></div>
              </div>
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', margin: '12px 0 10px', textTransform: 'uppercase', letterSpacing: 1 }}>Features</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!form[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditPlan(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Plan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
};

export default Plans;
