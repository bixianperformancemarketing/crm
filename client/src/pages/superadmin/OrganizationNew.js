import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import SuperAdminLayout from '../../components/layout/SuperAdminLayout';
import { superAdminAPI } from '../../services/api';

const OrganizationNew = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const [form, setForm] = useState({
    name: '', ownerName: '', ownerEmail: '', ownerPhone: '', plan: 'trial', planExpiresAt: '',
  });

  useEffect(() => {
    superAdminAPI.getPlans()
      .then(({ data }) => {
        const list = data.plans || [];
        setPlans(list);
        if (list.length) setForm(f => ({ ...f, plan: list[0].name }));
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.ownerName || !form.ownerEmail || !form.ownerPhone) return toast.error('Name, owner name, email, and phone are required');
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.planExpiresAt) delete payload.planExpiresAt;
      const { data } = await superAdminAPI.createOrganization(payload);
      setCreated(data);
      toast.success('Organization created!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create organization');
    } finally { setSaving(false); }
  };

  if (created) {
    return (
      <SuperAdminLayout title="Organization Created">
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e', marginBottom: 16 }}>✅ Organization Created!</div>
            <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Organization:</span> <strong>{created.organization?.name}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Owner Email:</span> <strong>{created.organization?.ownerEmail}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Temporary Password:</span> <code style={{ background: '#0a0a17', padding: '2px 8px', borderRadius: 4, color: 'var(--accent)', fontSize: 14 }}>{created.tempPassword}</code></div>
              <div style={{ marginTop: 8, color: '#f59e0b', fontSize: 12 }}>⚠️ Share these credentials securely. The password is only shown once.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => navigate(`/superadmin/organizations/${created.organization?.id}`)}>View Organization</button>
            <button className="btn btn-ghost" onClick={() => navigate('/superadmin/organizations')}>All Organizations</button>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout title="New Organization">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/superadmin/organizations')}>← Back</button>
          <div className="page-title">New Organization</div>
        </div>
      </div>

      <div style={{ maxWidth: 560 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Organization Info</div>
          <div className="form-group"><label className="form-label">Organization Name *</label><input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Sunrise Digital" /></div>

          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', margin: '18px 0 10px', textTransform: 'uppercase', letterSpacing: 1 }}>Owner Account</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Owner Name *</label><input className="form-control" value={form.ownerName} onChange={e => setForm({ ...form, ownerName: e.target.value })} placeholder="Ravi Kumar" /></div>
            <div className="form-group"><label className="form-label">Owner Email *</label><input className="form-control" type="email" value={form.ownerEmail} onChange={e => setForm({ ...form, ownerEmail: e.target.value })} placeholder="ravi@company.com" /></div>
          </div>
          <div className="form-group"><label className="form-label">Owner Phone *</label><input className="form-control" type="tel" value={form.ownerPhone} onChange={e => setForm({ ...form, ownerPhone: e.target.value })} placeholder="+91 98765 43210" /></div>

          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', margin: '18px 0 10px', textTransform: 'uppercase', letterSpacing: 1 }}>Plan</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Plan</label>
              <select className="form-control" value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}>
                {plans.map(p => <option key={p.id} value={p.name}>{p.displayName || p.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Plan Expires At</label><input className="form-control" type="date" value={form.planExpiresAt} onChange={e => setForm({ ...form, planExpiresAt: e.target.value })} /></div>
          </div>

          <div className="modal-actions" style={{ marginTop: 24, justifyContent: 'flex-start' }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/superadmin/organizations')}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Organization'}</button>
          </div>
        </form>
      </div>
    </SuperAdminLayout>
  );
};

export default OrganizationNew;
