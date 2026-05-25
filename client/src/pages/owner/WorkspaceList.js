import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import UpgradeModal from '../../components/common/UpgradeModal';
import { orgAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const WorkspaceList = () => {
  const { org, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await orgAPI.getWorkspaces();
      setWorkspaces(data.workspaces || []);
    } catch { toast.error('Failed to load workspaces'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = workspaces.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Workspace name required');
    setSaving(true);
    try {
      const { data } = await orgAPI.createWorkspace(form);
      if (data.upgradeRequired) { setUpgradeModal(data); return; }
      toast.success('Workspace created');
      setShowCreate(false);
      setForm({ name: '', description: '' });
      await refreshUser();
      load();
    } catch (err) {
      const d = err.response?.data;
      if (d?.upgradeRequired) { setUpgradeModal(d); return; }
      toast.error(d?.message || 'Failed to create workspace');
    } finally { setSaving(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editTarget.name.trim()) return toast.error('Workspace name required');
    setSaving(true);
    try {
      await orgAPI.updateWorkspace(editTarget.id, { name: editTarget.name, description: editTarget.description });
      toast.success('Workspace updated');
      setEditTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update workspace');
    } finally { setSaving(false); }
  };

  const handleToggleSuspend = async (w) => {
    const action = w.isActive ? 'suspend' : 'activate';
    try {
      await orgAPI.updateWorkspace(w.id, { isActive: !w.isActive });
      toast.success(`Workspace ${action}d`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action} workspace`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await orgAPI.deleteWorkspace(deleteTarget.id);
      toast.success('Workspace deleted');
      setDeleteTarget(null);
      await refreshUser();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete workspace');
    } finally { setSaving(false); }
  };

  const activeCount = workspaces.filter(w => w.isActive).length;
  const atLimit = org && activeCount >= org.maxWorkspaces;
  const nearLimit = org && !atLimit && activeCount / org.maxWorkspaces >= 0.8;

  return (
    <Layout title="Workspaces">
      <div className="page-header">
        <div className="page-title">Workspaces</div>
        <button
          className="btn btn-primary"
          onClick={() => atLimit ? setUpgradeModal({ message: `You have reached your workspace limit (${org.maxWorkspaces}) on the ${org.plan} plan.`, limitType: 'workspaces' }) : setShowCreate(true)}
          style={atLimit ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
        >
          {atLimit ? '🔒 Workspace Limit Reached' : '+ New Workspace'}
        </button>
      </div>

      {org && atLimit && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#ef4444', fontWeight: 600 }}>
            ⚠ Workspace limit reached — {activeCount} / {org.maxWorkspaces} used on <span style={{ textTransform: 'capitalize' }}>{org.plan}</span> plan
          </span>
          <button className="btn btn-sm" style={{ background: '#ef4444', color: '#fff', border: 'none', fontSize: 12 }} onClick={() => setUpgradeModal({ message: `Upgrade to add more workspaces.`, limitType: 'workspaces' })}>
            Upgrade Plan
          </button>
        </div>
      )}

      {org && nearLimit && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#f59e0b' }}>
          ⚠ Approaching workspace limit — {activeCount} / {org.maxWorkspaces} used on <strong style={{ textTransform: 'capitalize' }}>{org.plan}</strong> plan
        </div>
      )}

      {org && !atLimit && !nearLimit && (
        <div style={{ background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.15)', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#0ea5e9' }}>
          {activeCount} / {org.maxWorkspaces} workspaces used on <strong style={{ textTransform: 'capitalize' }}>{org.plan}</strong> plan
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <input
          className="form-control"
          placeholder="Search workspaces..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <div className="empty-title">{search ? 'No workspaces match your search' : 'No workspaces'}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(w => (
            <div key={w.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', opacity: w.isActive ? 1 : 0.65 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{w.name}</div>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: w.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: w.isActive ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>
                  {w.isActive ? 'Active' : 'Suspended'}
                </span>
              </div>
              {w.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{w.description}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 14 }}>
                <div style={{ color: 'var(--text-muted)' }}>👥 {w.userCount || 0} users</div>
                <div style={{ color: 'var(--text-muted)' }}>🎯 {w.leadCount || 0} leads</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => navigate(`/owner/workspaces/${w.id}`)}>View</button>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => setEditTarget({ id: w.id, name: w.name, description: w.description || '' })}>Edit</button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, color: w.isActive ? '#f59e0b' : '#22c55e' }}
                  onClick={() => handleToggleSuspend(w)}
                >
                  {w.isActive ? 'Suspend' : 'Activate'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, color: '#ef4444' }}
                  onClick={() => setDeleteTarget(w)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <h3>New Workspace</h3>
            <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            <form onSubmit={handleCreate}>
              <div className="form-group"><label className="form-label">Workspace Name *</label><input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Real Estate Division" autoFocus /></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Workspace'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <h3>Edit Workspace</h3>
            <button className="modal-close" onClick={() => setEditTarget(null)}>×</button>
            <form onSubmit={handleEdit}>
              <div className="form-group"><label className="form-label">Workspace Name *</label><input className="form-control" value={editTarget.name} onChange={e => setEditTarget({ ...editTarget, name: e.target.value })} autoFocus /></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={2} value={editTarget.description} onChange={e => setEditTarget({ ...editTarget, description: e.target.value })} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3>Delete Workspace</h3>
            <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            <div style={{ marginBottom: 20, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{deleteTarget.name}</strong>?
              <br />This action cannot be undone. The workspace must have no users or leads to be deleted.
            </div>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
              <strong style={{ color: '#ef4444' }}>Warning:</strong> All workspace data will be permanently removed.
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ background: '#ef4444', color: '#fff', border: 'none' }} disabled={saving} onClick={handleDelete}>{saving ? 'Deleting...' : 'Delete Workspace'}</button>
            </div>
          </div>
        </div>
      )}

      {upgradeModal && <UpgradeModal message={upgradeModal.message} limitType={upgradeModal.limitType} plan={org?.plan} onClose={() => setUpgradeModal(null)} />}
    </Layout>
  );
};

export default WorkspaceList;
