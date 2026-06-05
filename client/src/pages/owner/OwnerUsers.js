import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { orgAPI, employeeLabelsAPI } from '../../services/api';
import api from '../../services/api';
import PasswordInput from '../../components/ui/PasswordInput';
import { getInitials } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

const ROLE_COLORS = { admin: '#7c3aed', employee: '#0ea5e9' };

const OwnerUsers = () => {
  const { org, hasFeature } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWs, setSelectedWs] = useState(null);
  const [users, setUsers] = useState([]);
  const [loadingWs, setLoadingWs] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [labels, setLabels] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', label: '', assignType: '', phone: '', canUseContentCalendar: false });

  const loadWorkspaces = useCallback(async () => {
    setLoadingWs(true);
    try {
      const { data } = await orgAPI.getWorkspaces();
      const ws = data.workspaces || [];
      setWorkspaces(ws);
      if (ws.length > 0) setSelectedWs(ws[0]);
    } catch { toast.error('Failed to load workspaces'); }
    finally { setLoadingWs(false); }
  }, []);

  useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);
  useEffect(() => { employeeLabelsAPI.getAll().then(({ data }) => setLabels(data.labels || [])).catch(() => {}); }, []);

  const loadUsers = useCallback(async () => {
    if (!selectedWs) return;
    setLoadingUsers(true);
    try {
      const { data } = await api.get('/users', { params: { workspaceId: selectedWs.id } });
      setUsers(data.data || []);
    } catch { toast.error('Failed to load users'); }
    finally { setLoadingUsers(false); }
  }, [selectedWs]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error('Name, email, and password required');
    if (form.role === 'employee' && !form.assignType) return toast.error('Please select what this employee will handle: Leads or Tasks');
    setSaving(true);
    try {
      await api.post('/users', form, { headers: { 'x-workspace-id': String(selectedWs.id) } });
      toast.success('User created');
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'employee', label: '', assignType: '', phone: '', canUseContentCalendar: false });
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally { setSaving(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/users/${editUser.id}`, { name: form.name, phone: form.phone, label: form.label, assignType: form.assignType, canUseContentCalendar: form.canUseContentCalendar });
      toast.success('User updated');
      setEditUser(null);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (u) => {
    if (!window.confirm(u.isActive ? 'Deactivate this user?' : 'Reactivate this user?')) return;
    try {
      await api.put(`/users/${u.id}`, { isActive: !u.isActive });
      toast.success(u.isActive ? 'User deactivated' : 'User reactivated');
      loadUsers();
    } catch { toast.error('Failed to update user'); }
  };

  const openEdit = (u) => {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, label: u.label || '', assignType: u.assignType || '', phone: u.phone || '', canUseContentCalendar: !!u.canUseContentCalendar });
    setEditUser(u);
  };

  return (
    <Layout title="Users">
      <div className="page-header">
        <div className="page-title">Team Members</div>
        {selectedWs && (
          <button className="btn btn-primary" onClick={() => { setForm({ name: '', email: '', password: '', role: 'employee', label: '', assignType: '', phone: '', canUseContentCalendar: false }); setShowCreate(true); }}>
            + Add Employee
          </button>
        )}
      </div>

      {loadingWs ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : workspaces.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏗️</div>
          <div className="empty-title">No workspaces yet</div>
          <div className="empty-subtitle">Create a workspace first before adding users</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {workspaces.map(ws => (
              <button key={ws.id} onClick={() => setSelectedWs(ws)}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: '1px solid', fontSize: 13, cursor: 'pointer',
                  fontWeight: selectedWs?.id === ws.id ? 700 : 400,
                  background: selectedWs?.id === ws.id ? 'var(--accent)' : 'var(--card-bg)',
                  color: selectedWs?.id === ws.id ? '#fff' : 'var(--text-muted)',
                  borderColor: selectedWs?.id === ws.id ? 'var(--accent)' : 'var(--border)',
                }}>
                {ws.name}
                <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.75 }}>({ws.userCount || 0})</span>
              </button>
            ))}
          </div>

          {org && selectedWs && (
            <div style={{ background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.15)', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#0ea5e9' }}>
              {selectedWs.userCount || 0} / {org.maxUsersPerWorkspace} users in <strong>{selectedWs.name}</strong> on <strong style={{ textTransform: 'capitalize' }}>{org.plan}</strong> plan
            </div>
          )}

          {loadingUsers ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : users.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-title">No users in this workspace</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>User</th><th>Role</th><th>Label</th><th>Phone</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.5 }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${ROLE_COLORS[u.role]}33`, color: ROLE_COLORS[u.role], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                            {getInitials(u.name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{u.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ background: `${ROLE_COLORS[u.role] || '#6b7280'}22`, color: ROLE_COLORS[u.role] || '#6b7280', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        {u.label ? (
                          <span style={{ background: `${labels.find(l=>l.name===u.label)?.color||'#6b7280'}22`, color: labels.find(l=>l.name===u.label)?.color||'#6b7280', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{u.label}</span>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.phone || '—'}</td>
                      <td>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: u.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: u.isActive ? '#22c55e' : '#6b7280' }}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Edit</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: u.isActive ? 'var(--danger)' : 'var(--success)' }} onClick={() => handleToggleActive(u)}>
                            {u.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {(showCreate || editUser) && (
        <div className="modal-overlay" onClick={() => { setShowCreate(false); setEditUser(null); }}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <h3>{showCreate ? `Add User to ${selectedWs?.name}` : 'Edit User'}</h3>
            <button className="modal-close" onClick={() => { setShowCreate(false); setEditUser(null); }}>×</button>
            <form onSubmit={showCreate ? handleCreate : handleUpdate}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
              </div>
              {showCreate && (
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-control" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@agency.com" />
                </div>
              )}
              {showCreate && (
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <PasswordInput className="form-control" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" />
                </div>
              )}
              <div className="form-row">
                {showCreate && (
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select className="form-control" value={form.role} onChange={e => setForm({ ...form, role: e.target.value, label: e.target.value === 'admin' ? '' : form.label, assignType: e.target.value === 'admin' ? '' : form.assignType })}>
                      {['admin', 'employee'].map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Label {form.role === 'employee' ? '*' : ''}</label>
                  <select className="form-control" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} disabled={form.role === 'admin'}>
                    <option value="">{form.role === 'admin' ? 'N/A' : 'Select label...'}</option>
                    {labels.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              {form.role === 'employee' && (
                <div className="form-group">
                  <label className="form-label">What will this employee handle? *</label>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    {['leads', 'tasks'].map(opt => (
                      <button key={opt} type="button" onClick={() => setForm({ ...form, assignType: opt })}
                        style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `2px solid ${form.assignType === opt ? (opt === 'leads' ? '#0ea5e9' : '#8b5cf6') : 'var(--border)'}`, background: form.assignType === opt ? (opt === 'leads' ? 'rgba(14,165,233,0.1)' : 'rgba(139,92,246,0.1)') : 'transparent', color: form.assignType === opt ? (opt === 'leads' ? '#0ea5e9' : '#8b5cf6') : 'var(--text-muted)', fontWeight: form.assignType === opt ? 700 : 400, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
                        {opt === 'leads' ? '👥 Leads' : '✅ Tasks'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/[^0-9+]/g, '') })} placeholder="+91 9876543210" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => { setShowCreate(false); setEditUser(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : showCreate ? 'Add User' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default OwnerUsers;
