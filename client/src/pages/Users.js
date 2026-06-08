import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import { usersAPI, employeeLabelsAPI } from '../services/api';
import PasswordInput from '../components/ui/PasswordInput';
import { getInitials } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const ROLE_COLORS = { owner: '#e94560', admin: '#7c3aed', employee: '#0ea5e9' };

const Users = () => {
  const { user: me, isRole, hasFeature } = useAuth();
  const [users, setUsers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showLabelMgr, setShowLabelMgr] = useState(false);
  const [newLabel, setNewLabel] = useState({ name: '', color: '#6b7280' });
  const [labelSaving, setLabelSaving] = useState(false);

  const allowedRoles = isRole('owner') ? ['admin', 'employee'] : ['employee'];
  const emptyForm = { name: '', email: '', password: '', role: 'employee', label: '', phone: '', canUseContentCalendar: false, canAccessLeads: true };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, labelsRes] = await Promise.all([usersAPI.getAll(), employeeLabelsAPI.getAll()]);
      setUsers(usersRes.data.data || []);
      setLabels(labelsRes.data.labels || []);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadLabels = async () => {
    try {
      const { data } = await employeeLabelsAPI.getAll();
      setLabels(data.labels || []);
    } catch {}
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error('Name, email, and password required');
    setSaving(true);
    try {
      await usersAPI.create(form);
      toast.success('User created');
      setShowCreate(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally { setSaving(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await usersAPI.update(editUser.id, { name: form.name, phone: form.phone, label: form.label, canUseContentCalendar: form.canUseContentCalendar, canAccessLeads: form.canAccessLeads });
      toast.success('User updated');
      setEditUser(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (id, isActive) => {
    if (!window.confirm(isActive ? 'Deactivate this user?' : 'Reactivate this user?')) return;
    try {
      await usersAPI.update(id, { isActive: !isActive });
      toast.success(isActive ? 'User deactivated' : 'User reactivated');
      load();
    } catch { toast.error('Failed to update user'); }
  };

  const openEdit = (u) => {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, label: u.label || '', phone: u.phone || '', canUseContentCalendar: !!u.canUseContentCalendar, canAccessLeads: u.canAccessLeads !== false });
    setEditUser(u);
  };

  const handleCreateLabel = async (e) => {
    e.preventDefault();
    if (!newLabel.name.trim()) return;
    setLabelSaving(true);
    try {
      await employeeLabelsAPI.create(newLabel);
      toast.success('Label created');
      setNewLabel({ name: '', color: '#6b7280' });
      loadLabels();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create label');
    } finally { setLabelSaving(false); }
  };

  const handleDeleteLabel = async (id) => {
    if (!window.confirm('Delete this label?')) return;
    try {
      await employeeLabelsAPI.delete(id);
      toast.success('Label deleted');
      loadLabels();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete this label');
    }
  };

  const getLabelColor = (labelName) => labels.find(l => l.name === labelName)?.color || '#6b7280';

  return (
    <Layout title="Users">
      <div className="page-header">
        <div className="page-title">Team Members</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(isRole('owner') || isRole('admin')) && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowLabelMgr(true)}>🏷️ Manage Labels</button>
          )}
          {(isRole('owner') || isRole('admin')) && (
            <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setShowCreate(true); }}>+ Add Employee</button>
          )}
        </div>
      </div>

      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : users.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-title">No team members</div></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>User</th><th>Role</th><th>Designation</th><th>Phone</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.5 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${ROLE_COLORS[u.role] || '#6b7280'}33`, color: ROLE_COLORS[u.role] || '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {getInitials(u.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{u.name} {u.id === me?.id && <span style={{ fontSize: 10, background: 'rgba(233,69,96,0.15)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 10 }}>You</span>}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span style={{ background: `${ROLE_COLORS[u.role] || '#6b7280'}22`, color: ROLE_COLORS[u.role] || '#6b7280', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{u.role}</span></td>
                  <td>
                    {u.label ? (
                      <span style={{ background: `${getLabelColor(u.label)}22`, color: getLabelColor(u.label), padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{u.label}</span>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.phone || '—'}</td>
                  <td><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: u.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: u.isActive ? '#22c55e' : '#6b7280' }}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    {u.id !== me?.id && (isRole('owner') || isRole('admin')) && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: u.isActive ? 'var(--danger)' : 'var(--success)' }} onClick={() => handleDeactivate(u.id, u.isActive)}>
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit user modal */}
      {(showCreate || editUser) && (
        <div className="modal-overlay" onClick={() => { setShowCreate(false); setEditUser(null); }}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <h3>{showCreate ? 'Add Employee' : 'Edit User'}</h3>
            <button className="modal-close" onClick={() => { setShowCreate(false); setEditUser(null); }}>×</button>
            <form onSubmit={showCreate ? handleCreate : handleUpdate}>
              <div className="form-group"><label className="form-label">Full Name *</label><input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" /></div>
              {showCreate && <div className="form-group"><label className="form-label">Email *</label><input className="form-control" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@agency.com" /></div>}
              {showCreate && <div className="form-group"><label className="form-label">Password *</label><PasswordInput className="form-control" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" /></div>}
              {showCreate && isRole('owner') && (
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-control" value={form.role} onChange={e => setForm({ ...form, role: e.target.value, label: e.target.value === 'admin' ? '' : form.label })}>
                    {allowedRoles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Designation / Cadre</label>
                <input className="form-control" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Sales Executive, Team Lead, BDE..." disabled={form.role === 'admin'} />
              </div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/[^0-9+]/g, '') })} placeholder="+91 9876543210" /></div>
              {form.role === 'employee' && (
                <div className="form-group">
                  <label className="form-label">Feature Access</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={form.canAccessLeads} onChange={e => setForm({ ...form, canAccessLeads: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }} />
                      <div>
                        <div style={{ fontWeight: 500 }}>Leads</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Access leads, pipeline, followups, appointments, quotations, invoices</div>
                      </div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={form.canUseContentCalendar} onChange={e => setForm({ ...form, canUseContentCalendar: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }} />
                      <div>
                        <div style={{ fontWeight: 500 }}>Tasks</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Access the content calendar and task management</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => { setShowCreate(false); setEditUser(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : showCreate ? 'Add Employee' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Label manager modal */}
      {showLabelMgr && (
        <div className="modal-overlay" onClick={() => setShowLabelMgr(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <h3>Manage Employee Labels</h3>
            <button className="modal-close" onClick={() => setShowLabelMgr(false)}>×</button>
            <div style={{ marginBottom: 16 }}>
              {labels.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: l.color }} />
                    <span style={{ fontSize: 13 }}>{l.name}</span>
                    {l.isDefault && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>default</span>}
                  </div>
                  {!l.isDefault && (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: 11 }} onClick={() => handleDeleteLabel(l.id)}>Delete</button>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={handleCreateLabel}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Add Custom Label</div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <input className="form-control" value={newLabel.name} onChange={e => setNewLabel({ ...newLabel, name: e.target.value })} placeholder="Label name (e.g. Campaign Manager)" />
                </div>
                <div className="form-group" style={{ flex: '0 0 60px' }}>
                  <input type="color" style={{ width: '100%', height: 38, padding: 2, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-bg)', cursor: 'pointer' }} value={newLabel.color} onChange={e => setNewLabel({ ...newLabel, color: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={labelSaving || !newLabel.name.trim()}>{labelSaving ? 'Adding...' : '+ Add Label'}</button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Users;
