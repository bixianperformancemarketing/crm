import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import Pagination from '../components/common/Pagination';
import UpgradeModal from '../components/common/UpgradeModal';
import ConfirmModal from '../components/common/ConfirmModal';
import { leadsAPI, usersAPI, orgAPI } from '../services/api';
import { formatDateTime, getStatusColor, getPriorityColor, getInitials, ENUMS } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import DateFilter from '../components/common/DateFilter';
import './Leads.css';

const getLeadCity = (lead) => {
  if (lead.city) return lead.city;
  const meta = lead.metadata || {};
  for (const k of Object.keys(meta)) {
    if (/^city$/i.test(k) && meta[k]) return meta[k];
  }
  if (meta.rawFields) {
    for (const k of Object.keys(meta.rawFields)) {
      if (/^city$/i.test(k) && meta.rawFields[k]) return meta.rawFields[k];
    }
  }
  return null;
};

const Leads = () => {
  const { user, org, hasFeature } = useAuth();
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState({ search: '', status: '', source: '', priority: '', assignedTo: '', city: '', callStatus: '', dateFrom: '', dateTo: '', workspaceId: '', sort: '', order: '', page: 1 });
  const [form, setForm] = useState({ name: '', phone: '', email: '', source: 'Website', priority: 'Warm', status: 'New', assignedTo: '', campaign: '', city: '', clientAddress: '', designation: '', workspaceId: '' });
  const [workspaces, setWorkspaces] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [importWorkspaceId, setImportWorkspaceId] = useState('');

  // bulk action state
  const [selected, setSelected] = useState(new Set());
  const [bulkAssignTo, setBulkAssignTo] = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkWorkspaceId, setBulkWorkspaceId] = useState('');
  const [bulkWorkspaceAssigning, setBulkWorkspaceAssigning] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const lastClickedIndex = useRef(null);
  const touchDragStart = useRef(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });
      const { data } = await leadsAPI.getAll(params);
      setLeads(data.data || []);
      setPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'owner') {
      usersAPI.getAll({ role: 'employee', limit: 100 }).then(({ data }) => setAgents(data.data || [])).catch(() => {});
    }
    if (user?.role === 'owner') {
      orgAPI.getWorkspaces().then(({ data }) => setWorkspaces(data.workspaces || data.data || [])).catch(() => {});
    }
  }, [user]);

  // clear selection when page/filters change
  useEffect(() => { setSelected(new Set()); }, [filters]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (!payload.assignedTo) delete payload.assignedTo;
      const { data } = await leadsAPI.create(payload);
      if (data.upgradeRequired) { setUpgradeModal(data); return; }
      toast.success(data.isDuplicate ? 'Duplicate lead detected' : 'Lead created!');
      setShowCreate(false);
      setForm({ name: '', phone: '', email: '', source: 'Website', priority: 'Warm', status: 'New', assignedTo: '', campaign: '', city: '', clientAddress: '', designation: '', workspaceId: '' });
      loadLeads();
    } catch (err) {
      const d = err.response?.data;
      if (d?.upgradeRequired) { setUpgradeModal(d); return; }
      toast.error(d?.message || 'Failed to create lead');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await leadsAPI.delete(confirmDelete.id);
      toast.success('Lead deleted');
      setConfirmDelete(null);
      loadLeads();
    } catch { toast.error('Failed to delete lead'); }
    finally { setDeleting(false); }
  };

  const handleUnassign = async (leadId) => {
    try {
      await leadsAPI.update(leadId, { assignedTo: null });
      toast.success('Lead unassigned');
      loadLeads();
    } catch { toast.error('Failed to unassign lead'); }
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (user?.role === 'owner' && workspaces.length > 0 && !importWorkspaceId) {
      toast.error('Please select a workspace before importing');
      e.target.value = '';
      return;
    }
    setImporting(true);
    setImportResults(null);
    try {
      const { data } = await leadsAPI.importCSV(file, importWorkspaceId || undefined);
      if (data.upgradeRequired) { setUpgradeModal(data); return; }
      setImportResults(data);
      toast.success(`Imported ${data.created} leads`);
      loadLeads();
    } catch (err) {
      const d = err.response?.data;
      if (d?.upgradeRequired) { setUpgradeModal(d); return; }
      toast.error(d?.message || 'Import failed');
    } finally { setImporting(false); e.target.value = ''; }
  };

  const updateFilter = (key, val) => { lastClickedIndex.current = null; setFilters((f) => ({ ...f, [key]: val, page: 1 })); };

  const toggleSort = (col) => {
    lastClickedIndex.current = null;
    setFilters((f) => ({
      ...f,
      sort: col,
      order: f.sort === col && f.order === 'ASC' ? 'DESC' : 'ASC',
      page: 1,
    }));
  };
  const sortArrow = (col) => (filters.sort === col ? (filters.order === 'ASC' ? ' ↑' : ' ↓') : '');

  // selection helpers
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const someSelected = leads.some((l) => selected.has(l.id));

  const toggleSelectAll = () => {
    lastClickedIndex.current = null;
    if (allSelected) {
      setSelected((s) => { const n = new Set(s); leads.forEach((l) => n.delete(l.id)); return n; });
    } else {
      setSelected((s) => { const n = new Set(s); leads.forEach((l) => n.add(l.id)); return n; });
    }
  };

  const toggleSelect = (id, index, shiftKey = false) => {
    if (shiftKey && lastClickedIndex.current !== null) {
      const from = Math.min(lastClickedIndex.current, index);
      const to = Math.max(lastClickedIndex.current, index);
      setSelected((s) => { const n = new Set(s); leads.slice(from, to + 1).forEach((l) => n.add(l.id)); return n; });
    } else {
      setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
      lastClickedIndex.current = index;
    }
  };

  const handleTouchMove = useCallback((e) => {
    if (touchDragStart.current === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = el?.closest('tr[data-lead-index]');
    if (!row) return;
    const endIndex = parseInt(row.dataset.leadIndex, 10);
    const from = Math.min(touchDragStart.current, endIndex);
    const to = Math.max(touchDragStart.current, endIndex);
    setSelected((s) => { const n = new Set(s); leads.slice(from, to + 1).forEach((l) => n.add(l.id)); return n; });
  }, [leads]);

  const handleTouchEnd = useCallback(() => { touchDragStart.current = null; }, []);

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const { data } = await leadsAPI.bulkDelete([...selected]);
      toast.success(data.message);
      setSelected(new Set());
      setConfirmBulkDelete(false);
      loadLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignTo) { toast.error('Please select an employee'); return; }
    if (selected.size === 0) return;
    setBulkAssigning(true);
    try {
      const { data } = await leadsAPI.bulkAssign([...selected], Number(bulkAssignTo));
      toast.success(data.message);
      setSelected(new Set());
      setBulkAssignTo('');
      loadLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk assign failed');
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleBulkWorkspaceAssign = async () => {
    if (!bulkWorkspaceId) { toast.error('Please select a workspace'); return; }
    if (selected.size === 0) return;
    setBulkWorkspaceAssigning(true);
    try {
      const { data } = await leadsAPI.bulkAssignWorkspace([...selected], Number(bulkWorkspaceId));
      toast.success(data.message);
      setSelected(new Set());
      setBulkWorkspaceId('');
      loadLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk workspace assign failed');
    } finally {
      setBulkWorkspaceAssigning(false);
    }
  };

  return (
    <Layout title="Leads">
      <div className="page-header">
        <div>
          <div className="page-title">All Leads</div>
          <div className="page-subtitle">{pagination?.total || 0} total leads</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {hasFeature('canUseCSVImport') && (
            <button className="btn btn-ghost" onClick={() => setShowImport((s) => !s)}>📁 Import CSV</button>
          )}
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Lead</button>
        </div>
      </div>

      {showImport && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16 }}>📁 Import Leads from CSV</h3>
          {user?.role === 'owner' && workspaces.length > 0 && (
            <div className="form-group" style={{ maxWidth: 300 }}>
              <label className="form-label">Workspace *</label>
              <select className="form-control" value={importWorkspaceId} onChange={(e) => setImportWorkspaceId(e.target.value)}>
                <option value="">Select Workspace</option>
                {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
          <label className="import-area" htmlFor="csv-upload">
            {importing ? <span>⏳ Importing...</span> : <span>📎 Click to select CSV file or drag & drop<br /><small style={{ color: 'var(--text-muted)' }}>Headers: name, phone, email, city, source, campaign (and any custom fields)</small></span>}
          </label>
          <input id="csv-upload" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSVImport} disabled={importing} />
          {importResults && (
            <div className="import-results">
              <div>✅ Created: <strong>{importResults.created}</strong> | Duplicates: <strong>{importResults.duplicates}</strong> | Skipped: <strong>{importResults.skipped}</strong></div>
              {importResults.errors?.map((e, i) => <div key={i} className="error">Error: {e}</div>)}
            </div>
          )}
        </div>
      )}

      <div className="filters-bar">
        <input className="search-input" placeholder="🔍 Search name, phone, email..." value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} />
        <select className="filter-select" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
          <option value="">All Statuses</option>
          {ENUMS.LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={filters.priority} onChange={(e) => updateFilter('priority', e.target.value)}>
          <option value="">All Priorities</option>
          {ENUMS.LEAD_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="filter-select" value={filters.source} onChange={(e) => updateFilter('source', e.target.value)}>
          <option value="">All Sources</option>
          {ENUMS.LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="search-input" placeholder="🏙 Filter by city..." value={filters.city} onChange={(e) => updateFilter('city', e.target.value)} style={{ maxWidth: 160 }} />
        <select className="filter-select" value={filters.callStatus} onChange={(e) => updateFilter('callStatus', e.target.value)}>
          <option value="">All Call Statuses</option>
          {ENUMS.CALL_STATUSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {user?.role === 'owner' && workspaces.length > 0 && (
          <select className="filter-select" value={filters.workspaceId} onChange={(e) => setFilters(f => ({ ...f, workspaceId: e.target.value, assignedTo: '', page: 1 }))}>
            <option value="">All Workspaces</option>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
        {(user?.role === 'admin' || user?.role === 'owner') && (
          <select className="filter-select" value={filters.assignedTo} onChange={(e) => updateFilter('assignedTo', e.target.value)}>
            <option value="">All Agents</option>
            <option value="unassigned">Unassigned</option>
            {agents
              .filter(a => !filters.workspaceId || String(a.workspaceId) === String(filters.workspaceId))
              .map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
        <DateFilter onChange={({ dateFrom: df, dateTo: dt }) => setFilters(f => ({ ...f, dateFrom: df, dateTo: dt, page: 1 }))} />
      </div>

      {/* bulk action bar */}
      {(user?.role === 'admin' || user?.role === 'owner') && someSelected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 120 }}>
            {selected.size} lead{selected.size !== 1 ? 's' : ''} selected
          </span>
          {user?.role === 'admin' && (
            <>
              <select
                className="filter-select"
                value={bulkAssignTo}
                onChange={(e) => setBulkAssignTo(e.target.value)}
                style={{ minWidth: 180 }}
              >
                <option value="">Assign to employee...</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleBulkAssign}
                disabled={!bulkAssignTo || bulkAssigning}
              >
                {bulkAssigning ? 'Assigning...' : 'Assign'}
              </button>
            </>
          )}
          {user?.role === 'owner' && workspaces.length > 0 && (
            <>
              <select
                className="filter-select"
                value={bulkWorkspaceId}
                onChange={(e) => setBulkWorkspaceId(e.target.value)}
                style={{ minWidth: 180 }}
              >
                <option value="">Move to workspace...</option>
                {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleBulkWorkspaceAssign}
                disabled={!bulkWorkspaceId || bulkWorkspaceAssigning}
              >
                {bulkWorkspaceAssigning ? 'Moving...' : 'Move'}
              </button>
            </>
          )}
          <button
            className="btn btn-sm"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }}
            onClick={() => setConfirmBulkDelete(true)}
          >
            Delete {selected.size}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSelected(new Set())}
            style={{ marginLeft: 'auto' }}
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : leads.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-title">No leads found</div><div className="empty-desc">Create your first lead or adjust your filters</div></div>
      ) : (
        <>
          <div className="leads-table-wrap">
            <table>
              <thead>
                <tr>
                  {(user?.role === 'admin' || user?.role === 'owner') && (
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        title={allSelected ? 'Deselect all' : 'Select all'}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                  )}
                  <th>Lead</th><th>Phone</th><th>City</th><th>Source</th><th>Priority</th><th>Status</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('lastCallStatus')} title="Sort by call status">Call Status{sortArrow('lastCallStatus')}</th>
                  <th>Agent</th>{user?.role === 'owner' && <th>Workspace</th>}<th>Created</th><th>Actions</th>
                </tr>
              </thead>
              <tbody onTouchMove={user?.role === 'admin' || user?.role === 'owner' ? handleTouchMove : undefined} onTouchEnd={user?.role === 'admin' || user?.role === 'owner' ? handleTouchEnd : undefined}>
                {leads.map((lead, index) => (
                  <tr key={lead.id} data-lead-index={index} style={selected.has(lead.id) ? { background: 'rgba(99,102,241,0.06)' } : {}}>
                    {(user?.role === 'admin' || user?.role === 'owner') && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(lead.id)}
                          onChange={() => {}}
                          onClick={(e) => toggleSelect(lead.id, index, e.shiftKey)}
                          onTouchStart={() => { touchDragStart.current = index; }}
                          style={{ cursor: 'pointer' }}
                          title="Shift+click to select a range"
                        />
                      </td>
                    )}
                    <td>
                      <div className="lead-name-cell">
                        <div className="lead-avatar">{getInitials(lead.name)}</div>
                        <div>
                          <Link to={`/leads/${lead.id}`} style={{ color: 'var(--text)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {lead.name}
                            {lead.isHot && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '1px 6px', borderRadius: 20, fontWeight: 700 }}>HOT</span>}
                          </Link>
                          {lead.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{lead.phone || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{getLeadCity(lead) || '—'}</td>
                    <td style={{ fontSize: 12 }}>{lead.source}</td>
                    <td>
                      <span style={{ background: `rgba(${getPriorityColor(lead.priority).slice(1).match(/.{2}/g).map((x) => parseInt(x, 16)).join(',')},0.15)`, color: getPriorityColor(lead.priority), padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        {lead.priority}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="status-dot" style={{ background: getStatusColor(lead.status) }} />
                        <span style={{ fontSize: 12 }}>{lead.status}</span>
                      </span>
                    </td>
                    <td>
                      {lead.lastCallStatus
                        ? <span style={{ background: `rgba(${getStatusColor(lead.lastCallStatus).slice(1).match(/.{2}/g).map((x) => parseInt(x, 16)).join(',')},0.15)`, color: getStatusColor(lead.lastCallStatus), padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                            {lead.lastCallStatus}
                          </span>
                        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {lead.assignedAgent?.name
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {lead.assignedAgent.name}
                            {(user?.role === 'admin' || user?.role === 'owner') && (
                              <button title="Unassign" onClick={() => handleUnassign(lead.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
                            )}
                          </span>
                        : '—'}
                    </td>
                    {user?.role === 'owner' && <td style={{ fontSize: 12, color: '#7c3aed', fontWeight: 500 }}>{lead.workspace?.name || '—'}</td>}
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDateTime(lead.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link to={`/leads/${lead.id}`} className="btn btn-ghost btn-sm">View</Link>
                        {(user?.role === 'admin' || user?.role === 'owner') && <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => setConfirmDelete(lead)}>Del</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
        </>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New Lead</h3>
            <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            <form onSubmit={handleCreate}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Name *</label><input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^0-9+]/g, '') })} placeholder="+91 9876543210" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Campaign</label><input className="form-control" value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Source</label><select className="form-control" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>{ENUMS.LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Priority</label><select className="form-control" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{ENUMS.LEAD_PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div>
              </div>
              <div className="form-group"><label className="form-label">Designation</label><input className="form-control" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Marketing Manager, CEO" /></div>
              {user?.role === 'owner' && workspaces.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Workspace *</label>
                  <select className="form-control" value={form.workspaceId} onChange={(e) => setForm({ ...form, workspaceId: e.target.value })} required>
                    <option value="">Select Workspace</option>
                    {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              )}
              {(user?.role === 'admin' || user?.role === 'owner') && agents.length > 0 && (
                <div className="form-group"><label className="form-label">Assign To</label><select className="form-control" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}><option value="">Unassigned</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              )}
              <div className="form-row">
                <div className="form-group"><label className="form-label">City</label><input className="form-control" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Mumbai" /></div>
                <div className="form-group"><label className="form-label">Address</label><textarea className="form-control" rows={2} value={form.clientAddress} onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {upgradeModal && <UpgradeModal message={upgradeModal.message} limitType={upgradeModal.limitType} plan={org?.plan} onClose={() => setUpgradeModal(null)} />}
      {confirmDelete && <ConfirmModal title="Delete Lead" message={`Delete ${confirmDelete.name}? This cannot be undone.`} confirmText="Delete" confirmClass="btn-danger" loading={deleting} onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />}
      {confirmBulkDelete && <ConfirmModal title="Delete Leads" message={`Delete ${selected.size} lead${selected.size !== 1 ? 's' : ''}? This cannot be undone.`} confirmText="Delete All" confirmClass="btn-danger" loading={bulkDeleting} onConfirm={handleBulkDelete} onCancel={() => setConfirmBulkDelete(false)} />}
    </Layout>
  );
};

export default Leads;
