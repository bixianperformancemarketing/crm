import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import SuperAdminLayout from '../../components/layout/SuperAdminLayout';
import Pagination from '../../components/common/Pagination';
import { superAdminAPI } from '../../services/api';
import { formatCurrency } from '../../utils/helpers';

const STATUS_COLORS = { active: '#22c55e', suspended: '#ef4444', inactive: '#6b7280' };
const getStatus = (o) => o.isSuspended ? 'suspended' : o.isActive ? 'active' : 'inactive';

const Organizations = () => {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (search) params.search = search;
      if (planFilter) params.plan = planFilter;
      const { data } = await superAdminAPI.getOrganizations(params);
      setOrgs(data.data || []);
      setPagination(data.pagination);
    } catch { toast.error('Failed to load organizations'); }
    finally { setLoading(false); }
  }, [page, search, planFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSuspend = async (id, currentStatus) => {
    const isSuspended = currentStatus === 'suspended';
    if (!window.confirm(isSuspended ? 'Unsuspend this organization?' : 'Suspend this organization?')) return;
    try {
      if (isSuspended) await superAdminAPI.unsuspendOrganization(id);
      else await superAdminAPI.suspendOrganization(id);
      toast.success(isSuspended ? 'Organization unsuspended' : 'Organization suspended');
      load();
    } catch { toast.error('Failed to update status'); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await superAdminAPI.deleteOrganization(id);
      toast.success('Organization deleted');
      setOrgs(prev => prev.filter(o => o.id !== id));
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <SuperAdminLayout title="Organizations">
      <div className="page-header">
        <div className="page-title">Organizations</div>
        <button className="btn btn-primary" onClick={() => navigate('/superadmin/organizations/new')}>+ New Organization</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-control" style={{ maxWidth: 260, fontSize: 13 }} placeholder="Search by name or email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="form-control" style={{ maxWidth: 140, fontSize: 13 }} value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }}>
          <option value="">All Plans</option>
          {['trial', 'starter', 'growth', 'agency'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : orgs.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🏢</div><div className="empty-title">No organizations</div></div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Organization</th><th>Plan</th><th>Status</th><th>Users</th><th>Leads</th><th>Revenue</th><th>Actions</th></tr></thead>
              <tbody>
                {orgs.map(o => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/superadmin/organizations/${o.id}`)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.slug}</div>
                    </td>
                    <td><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(124,58,237,0.12)', color: '#a78bfa', textTransform: 'capitalize' }}>{o.plan}</span></td>
                    <td>{(() => { const st = getStatus(o); return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${STATUS_COLORS[st]}22`, color: STATUS_COLORS[st], textTransform: 'capitalize' }}>{st}</span>; })()}</td>
                    <td>{o.userCount || 0}</td>
                    <td>{o.leadCount || 0}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(o.revenue || 0)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/superadmin/organizations/${o.id}`)}>View</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: o.isSuspended ? 'var(--success)' : 'var(--danger)' }} onClick={() => handleSuspend(o.id, o.isSuspended ? 'suspended' : 'active')}>
                          {o.isSuspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(o.id, o.name)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </SuperAdminLayout>
  );
};

export default Organizations;
