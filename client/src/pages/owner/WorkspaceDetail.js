import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { orgAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/helpers';

const WorkspaceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [removingUser, setRemovingUser] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await orgAPI.getWorkspace(id);
      setWorkspace(data.workspace);
      setEditForm({ name: data.workspace.name, description: data.workspace.description || '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Workspace not found');
      navigate('/owner/workspaces');
    } finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editForm.name.trim()) return toast.error('Name required');
    setSaving(true);
    try {
      await orgAPI.updateWorkspace(id, editForm);
      toast.success('Workspace updated');
      setEditing(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleToggleSuspend = async () => {
    const action = workspace.isActive ? 'suspend' : 'activate';
    try {
      await orgAPI.updateWorkspace(id, { isActive: !workspace.isActive });
      toast.success(`Workspace ${action}d`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action}`);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await orgAPI.deleteWorkspace(id);
      toast.success('Workspace deleted');
      await refreshUser();
      navigate('/owner/workspaces');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete workspace');
      setShowDelete(false);
    } finally { setSaving(false); }
  };

  const handleRemoveUser = async () => {
    setRemoving(true);
    try {
      await orgAPI.removeUserFromWorkspace(id, removingUser.id);
      toast.success(`${removingUser.name} removed from workspace`);
      setRemovingUser(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove user');
    } finally { setRemoving(false); }
  };

  const ROLE_COLORS = { admin: '#7c3aed', agent: '#0ea5e9', designer: '#f59e0b', owner: '#e94560' };

  if (loading) return <Layout title="Workspace"><div className="loading-spinner"><div className="spinner" /></div></Layout>;
  if (!workspace) return null;

  return (
    <Layout title={workspace.name}>
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/owner/workspaces')}>← Back to Workspaces</button>
      </div>

      {/* Header Card */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{workspace.name}</h2>
              <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: workspace.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: workspace.isActive ? '#22c55e' : '#ef4444' }}>
                {workspace.isActive ? 'Active' : 'Suspended'}
              </span>
            </div>
            {workspace.description && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{workspace.description}</div>}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Slug: <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: 4 }}>{workspace.slug}</code>
              &nbsp;·&nbsp;Created {new Date(workspace.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!editing ? (
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
            ) : (
              <>
                <button className="btn btn-success btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setEditForm({ name: workspace.name, description: workspace.description || '' }); }}>Cancel</button>
              </>
            )}
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: workspace.isActive ? '#f59e0b' : '#22c55e' }}
              onClick={handleToggleSuspend}
            >
              {workspace.isActive ? 'Suspend' : 'Activate'}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => setShowDelete(true)}>Delete</button>
          </div>
        </div>

        {editing && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Name *</label>
                <input className="form-control" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} autoFocus />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Description</label>
                <input className="form-control" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Users', value: workspace.userCount || 0, icon: '👥', color: '#7c3aed' },
          { label: 'Leads', value: workspace.leadCount || 0, icon: '🎯', color: '#0ea5e9' },
          { label: 'Revenue', value: formatCurrency(workspace.totalRevenue || 0), icon: '💰', color: '#22c55e' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{stat.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Users in this Workspace</div>
        {!workspace.users || workspace.users.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No users assigned to this workspace.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Email', 'Role', 'Status', 'Joined', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workspace.users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{u.name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{u.email}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `rgba(${ROLE_COLORS[u.role] ? ROLE_COLORS[u.role].slice(1).match(/.{2}/g).map(x => parseInt(x, 16)).join(',') : '100,100,100'},0.12)`, color: ROLE_COLORS[u.role] || 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: u.isActive ? 'rgba(34,197,94,0.10)' : 'rgba(107,114,128,0.10)', color: u.isActive ? '#22c55e' : '#6b7280' }}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                    {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {u.role !== 'owner' && (
                      <button
                        style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', cursor: 'pointer' }}
                        onClick={() => setRemovingUser(u)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Remove User Confirmation Modal */}
      {removingUser && (
        <div className="modal-overlay" onClick={() => setRemovingUser(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3>Remove User from Workspace</h3>
            <button className="modal-close" onClick={() => setRemovingUser(null)}>×</button>
            <div style={{ marginBottom: 20, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Remove <strong style={{ color: 'var(--text)' }}>{removingUser.name}</strong> from this workspace?
              <br />Their account will remain in the organisation but they will no longer be assigned here.
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setRemovingUser(null)}>Cancel</button>
              <button
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', cursor: 'pointer', fontSize: 13 }}
                disabled={removing}
                onClick={handleRemoveUser}
              >
                {removing ? 'Removing...' : 'Remove User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3>Delete Workspace</h3>
            <button className="modal-close" onClick={() => setShowDelete(false)}>×</button>
            <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Are you sure you want to permanently delete <strong style={{ color: 'var(--text)' }}>{workspace.name}</strong>?
              <br />The workspace must have no users or leads to proceed.
            </div>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
              <strong style={{ color: '#ef4444' }}>This cannot be undone.</strong>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowDelete(false)}>Cancel</button>
              <button style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', cursor: 'pointer', fontSize: 13 }} disabled={saving} onClick={handleDelete}>
                {saving ? 'Deleting...' : 'Delete Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default WorkspaceDetail;
