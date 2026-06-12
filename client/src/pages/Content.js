import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import Pagination from '../components/common/Pagination';
import UpgradeModal from '../components/common/UpgradeModal';
import { contentAPI, usersAPI, orgAPI } from '../services/api';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import './Content.css';

const STATUS_COLORS = {
  'Overdue': '#ef4444', 'To Do Today': '#0ea5e9', 'In Progress': '#a78bfa',
  'Done': '#22c55e', 'Review': '#f59e0b', 'Approved': '#10b981', 'Not Approved': '#ef4444',
};
const CHIP_CLASS = {
  'Overdue': 'status-not-approved', 'To Do Today': 'status-todo-today', 'In Progress': 'status-in-progress',
  'Done': 'status-approved', 'Review': 'status-review', 'Approved': 'status-approved', 'Not Approved': 'status-not-approved',
};

const BASE_STATUSES = ['Overdue', 'To Do Today', 'In Progress', 'Done', 'Cancelled'];
const APPROVAL_STATUSES = ['Overdue', 'To Do Today', 'In Progress', 'Review', 'Approved', 'Not Approved', 'Cancelled'];
const ALL_FILTER_STATUSES = ['Overdue', 'To Do Today', 'In Progress', 'Done', 'Review', 'Approved', 'Not Approved'];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptyForm = () => ({
  title: '', description: '', dueDate: '', dueTime: '',
  assignedTo: '', workspaceId: '', priority: 'Medium', notes: '', requiresApproval: true,
});

const fmtDueTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const ApprovalToggle = ({ value, onChange }) => (
  <div className="form-group">
    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer', flexShrink: 0,
          background: value ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: value ? 19 : 3, width: 14, height: 14,
          borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
        }} />
      </div>
      <span>Requires Approval <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(adds Review → Approved/Not Approved flow)</span></span>
    </label>
  </div>
);

const Content = () => {
  const { org, isRole } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [calTasks, setCalTasks] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [archivedPagination, setArchivedPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [archivedPage, setArchivedPage] = useState(1);
  const [view, setView] = useState('list');
  const [statusFilter, setStatusFilter] = useState('');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [showCreate, setShowCreate] = useState(false);
  const [showTask, setShowTask] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [upgradeModal, setUpgradeModal] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [editSaving, setEditSaving] = useState(false);
  const [archivingId, setArchivingId] = useState(null);
  const [unarchivingId, setUnarchivingId] = useState(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (statusFilter) params.status = statusFilter;
      const { data } = await contentAPI.getAll(params);
      setTasks(data.data || []);
      setPagination(data.pagination);
    } catch { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  const loadCal = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await contentAPI.getCalendar({ year: calYear, month: calMonth });
      setCalTasks(data.tasks || []);
    } catch { toast.error('Failed to load calendar'); }
    finally { setLoading(false); }
  }, [calYear, calMonth]);

  const loadArchived = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await contentAPI.getArchived({ page: archivedPage });
      setArchivedTasks(data.data || []);
      setArchivedPagination(data.pagination);
    } catch { toast.error('Failed to load archived tasks'); }
    finally { setLoading(false); }
  }, [archivedPage]);

  useEffect(() => {
    if (view === 'list') loadList();
    else if (view === 'cal') loadCal();
    else if (view === 'archived') loadArchived();
  }, [view, loadList, loadCal, loadArchived]);

  useEffect(() => {
    usersAPI.getAll({ role: 'employee', limit: 100 }).then(({ data }) => setUsers(data.data || [])).catch(() => {});
    if (isRole('owner')) orgAPI.getWorkspaces().then(({ data }) => setWorkspaces(data.workspaces || [])).catch(() => {});
  }, [isRole]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title || !form.dueDate) return toast.error('Title and due date required');
    if (isRole('owner') && !form.workspaceId) return toast.error('Workspace is required');
    setSaving(true);
    try {
      const { data } = await contentAPI.create(form);
      if (data.upgradeRequired) { setUpgradeModal(data); return; }
      toast.success('Task created');
      setShowCreate(false);
      setForm(emptyForm());
      view === 'list' ? loadList() : loadCal();
    } catch (err) {
      const d = err.response?.data;
      if (d?.upgradeRequired) { setUpgradeModal(d); return; }
      toast.error(d?.message || 'Failed to create task');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await contentAPI.update(id, { status });
      toast.success('Status updated');
      view === 'list' ? loadList() : loadCal();
      if (showTask) setShowTask({ ...showTask, status });
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await contentAPI.delete(id);
      toast.success('Deleted');
      setShowTask(null);
      view === 'list' ? loadList() : loadCal();
    } catch { toast.error('Failed to delete'); }
  };

  const handleArchive = async (id) => {
    setArchivingId(id);
    try {
      await contentAPI.archive(id);
      toast.success('Task archived');
      setShowTask(null);
      view === 'list' ? loadList() : loadCal();
    } catch { toast.error('Failed to archive'); }
    finally { setArchivingId(null); }
  };

  const handleUnarchive = async (id) => {
    setUnarchivingId(id);
    try {
      await contentAPI.unarchive(id);
      toast.success('Task restored to active');
      loadArchived();
    } catch { toast.error('Failed to restore task'); }
    finally { setUnarchivingId(null); }
  };

  const openEdit = (e, t) => {
    e.stopPropagation();
    setEditForm({
      title: t.title || '',
      description: t.description || '',
      dueDate: t.dueDate ? t.dueDate.split('T')[0] : '',
      dueTime: t.dueTime || '',
      assignedTo: t.assignedTo ? String(t.assignedTo) : '',
      workspaceId: t.workspaceId ? String(t.workspaceId) : '',
      priority: t.priority || 'Medium',
      notes: t.notes || '',
      requiresApproval: t.requiresApproval !== false,
    });
    setEditTask(t);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editForm.title || !editForm.dueDate) return toast.error('Title and due date required');
    setEditSaving(true);
    try {
      await contentAPI.update(editTask.id, editForm);
      toast.success('Task updated');
      setEditTask(null);
      view === 'list' ? loadList() : loadCal();
    } catch { toast.error('Failed to update task'); }
    finally { setEditSaving(false); }
  };

  const prevMonth = () => {
    if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const buildCalCells = () => {
    const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const daysInPrev = new Date(calYear, calMonth - 1, 0).getDate();
    const today = new Date();
    const cells = [];
    for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, current: false, date: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = today.getFullYear() === calYear && today.getMonth() + 1 === calMonth && today.getDate() === d;
      cells.push({ day: d, current: true, date: dateStr, isToday });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) cells.push({ day: d, current: false, date: null });
    return cells;
  };

  const tasksByDate = calTasks.reduce((acc, t) => {
    const d = t.dueDate?.split('T')[0];
    if (!acc[d]) acc[d] = [];
    acc[d].push(t);
    return acc;
  }, {});

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const cells = buildCalCells();
  const canManage = isRole('owner') || isRole('admin');
  const isArchivable = (status) => ['Done', 'Approved', 'Not Approved', 'Cancelled'].includes(status);

  const getStatusOptions = (task) => {
    const all = task?.requiresApproval !== false ? APPROVAL_STATUSES : BASE_STATUSES;
    return all.filter(s => s !== task?.status);
  };

  const TaskFormFields = ({ f, setF, isOwner }) => (
    <>
      <div className="form-group"><label className="form-label">Title *</label><input className="form-control" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Task title" /></div>
      <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={2} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="What needs to be done..." /></div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Due Date *</label><input className="form-control" type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Due Time</label><input className="form-control" type="time" value={f.dueTime} onChange={e => setF({ ...f, dueTime: e.target.value })} /></div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Priority</label>
          <select className="form-control" value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}>
            {['Low', 'Medium', 'High'].map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
      {isOwner && (
        <div className="form-group">
          <label className="form-label">Workspace *</label>
          <select className="form-control" value={f.workspaceId} onChange={e => setF({ ...f, workspaceId: e.target.value, assignedTo: '' })}>
            <option value="">— Select Workspace —</option>
            {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Assign To</label>
        <select className="form-control" value={f.assignedTo} onChange={e => {
          const selected = users.find(u => String(u.id) === e.target.value);
          setF({ ...f, assignedTo: e.target.value, workspaceId: selected?.workspaceId ? String(selected.workspaceId) : f.workspaceId });
        }}>
          <option value="">— Unassigned —</option>
          {users.filter(u => u.canUseContentCalendar !== false && (!isOwner || !f.workspaceId || String(u.workspaceId) === String(f.workspaceId))).map(u => <option key={u.id} value={u.id}>{u.name} ({u.label || u.role})</option>)}
        </select>
      </div>
      <ApprovalToggle value={f.requiresApproval} onChange={v => setF({ ...f, requiresApproval: v })} />
      <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Additional notes..." /></div>
    </>
  );

  return (
    <Layout title="Tasks">
      <div className="page-header">
        <div className="page-title">Tasks</div>
        <div className="content-toolbar">
          <div className="view-toggle">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
            <button className={view === 'cal' ? 'active' : ''} onClick={() => setView('cal')}>Calendar</button>
            <button className={view === 'archived' ? 'active' : ''} onClick={() => setView('archived')}>Archived</button>
          </div>
          {canManage && view !== 'archived' && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Task</button>}
        </div>
      </div>

      {view === 'list' && (
        <>
          <div className="content-filter-bar" style={{ marginBottom: 16 }}>
            {['', ...ALL_FILTER_STATUSES].map((s) => (
              <button key={s || 'all'} onClick={() => { setStatusFilter(s); setPage(1); }}
                style={{ padding: '5px 12px', borderRadius: 7, background: statusFilter === s ? 'var(--accent)' : 'var(--card-bg)', border: '1px solid var(--border)', color: statusFilter === s ? '#fff' : 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                {s || 'All'}
              </button>
            ))}
          </div>
          {loading ? <div className="loading-spinner"><div className="spinner" /></div> : tasks.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">✅</div><div className="empty-title">No tasks yet</div></div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Title</th><th>Assigned To</th><th>Due Date</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setShowTask(t)}>
                        <td style={{ fontWeight: 500 }}>
                          {t.title}
                          {t.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t.description}</div>}
                          {!t.requiresApproval && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>No approval</div>}
                        </td>
                        <td style={{ fontSize: 12 }}>{t.assignee?.name || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.dueDate ? `${formatDate(t.dueDate)}${t.dueTime ? ` ${fmtDueTime(t.dueTime)}` : ''}` : '—'}</td>
                        <td><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: t.priority === 'High' ? 'rgba(239,68,68,0.15)' : t.priority === 'Medium' ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)', color: t.priority === 'High' ? '#ef4444' : t.priority === 'Medium' ? '#f59e0b' : '#6b7280' }}>{t.priority}</span></td>
                        <td><span className="task-status-badge" style={{ background: `${STATUS_COLORS[t.status] || '#6b7280'}22`, color: STATUS_COLORS[t.status] || '#6b7280' }}>{t.status}</span></td>
                        <td onClick={e => e.stopPropagation()}>
                          {canManage && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" onClick={(e) => openEdit(e, t)}>Edit</button>
                              {isArchivable(t.status) && (
                                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleArchive(t.id); }} disabled={archivingId === t.id} style={{ color: 'var(--text-muted)' }}>Archive</button>
                              )}
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}>Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination pagination={pagination} onPageChange={setPage} />
            </>
          )}
        </>
      )}

      {view === 'cal' && (
        <div className="content-calendar">
          <div className="cal-header">
            <div className="cal-nav">
              <button onClick={prevMonth}>&#8249;</button>
              <div className="cal-month-label">{MONTH_NAMES[calMonth - 1]} {calYear}</div>
              <button onClick={nextMonth}>&#8250;</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{calTasks.length} tasks this month</div>
          </div>
          <div className="cal-grid">
            {DAY_LABELS.map(d => <div key={d} className="cal-day-label">{d}</div>)}
            {cells.map((cell, idx) => {
              const dayTasks = cell.date ? (tasksByDate[cell.date] || []) : [];
              const visible = dayTasks.slice(0, 3);
              const extra = dayTasks.length - visible.length;
              return (
                <div key={idx} className={`cal-cell${!cell.current ? ' other-month' : ''}${cell.isToday ? ' today' : ''}`}>
                  <div className="cal-date">{cell.day}</div>
                  {visible.map(t => (
                    <div key={t.id} className={`cal-task-chip ${CHIP_CLASS[t.status] || ''}`} onClick={() => setShowTask(t)} title={t.title}>
                      {t.title}
                    </div>
                  ))}
                  {extra > 0 && <div className="cal-more">+{extra} more</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'archived' && (
        <>
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>Completed tasks that have been archived. Restore them to make them active again.</div>
          {loading ? <div className="loading-spinner"><div className="spinner" /></div> : archivedTasks.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📦</div><div className="empty-title">No archived tasks</div></div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Title</th><th>Assigned To</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {archivedTasks.map((t) => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 500, opacity: 0.7 }}>{t.title}</td>
                        <td style={{ fontSize: 12 }}>{t.assignee?.name || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.dueDate ? formatDate(t.dueDate) : '—'}</td>
                        <td><span className="task-status-badge" style={{ background: `${STATUS_COLORS[t.status] || '#6b7280'}22`, color: STATUS_COLORS[t.status] || '#6b7280' }}>{t.status}</span></td>
                        <td>
                          {canManage && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => handleUnarchive(t.id)} disabled={unarchivingId === t.id}>{unarchivingId === t.id ? 'Restoring...' : 'Restore'}</button>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(t.id)}>Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination pagination={archivedPagination} onPageChange={setArchivedPage} />
            </>
          )}
        </>
      )}

      {showTask && (
        <div className="modal-overlay" onClick={() => setShowTask(null)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowTask(null)}>×</button>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="task-status-badge" style={{ background: `${STATUS_COLORS[showTask.status] || '#6b7280'}22`, color: STATUS_COLORS[showTask.status] || '#6b7280' }}>{showTask.status}</span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: showTask.priority === 'High' ? 'rgba(239,68,68,0.15)' : showTask.priority === 'Medium' ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)', color: showTask.priority === 'High' ? '#ef4444' : showTask.priority === 'Medium' ? '#f59e0b' : '#6b7280' }}>{showTask.priority}</span>
              {!showTask.requiresApproval && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>No approval needed</span>}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{showTask.title}</div>
            {showTask.description && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{showTask.description}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 13, marginBottom: 16 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Due:</span> {showTask.dueDate ? `${formatDate(showTask.dueDate)}${showTask.dueTime ? ` at ${fmtDueTime(showTask.dueTime)}` : ''}` : '—'}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Assigned To:</span> {showTask.assignee?.name || '—'}</div>
              {showTask.creator && <div><span style={{ color: 'var(--text-muted)' }}>Created By:</span> {showTask.creator.name}</div>}
            </div>
            {showTask.notes && <div style={{ background: '#0a0a17', borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 16, color: 'var(--text-muted)' }}>{showTask.notes}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {getStatusOptions(showTask).map(s => (
                <button key={s} className="btn btn-ghost btn-sm" onClick={() => handleStatusChange(showTask.id, s)}>→ {s}</button>
              ))}
            </div>
            <div className="modal-actions">
              {canManage && isArchivable(showTask.status) && (
                <button className="btn btn-ghost" onClick={() => handleArchive(showTask.id)} disabled={archivingId === showTask.id} style={{ color: 'var(--text-muted)' }}>
                  {archivingId === showTask.id ? 'Archiving...' : 'Archive'}
                </button>
              )}
              {canManage && <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(showTask.id)}>Delete</button>}
              <button className="btn btn-ghost" onClick={() => setShowTask(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h3>New Task</h3>
            <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            <form onSubmit={handleCreate}>
              <TaskFormFields f={form} setF={setForm} isOwner={isRole('owner')} />
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Task'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTask && (
        <div className="modal-overlay" onClick={() => setEditTask(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h3>Edit Task</h3>
            <button className="modal-close" onClick={() => setEditTask(null)}>×</button>
            <form onSubmit={handleUpdate}>
              <TaskFormFields f={editForm} setF={setEditForm} isOwner={isRole('owner')} />
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditTask(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>{editSaving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {upgradeModal && <UpgradeModal message={upgradeModal.message} limitType={upgradeModal.limitType} plan={org?.plan} onClose={() => setUpgradeModal(null)} />}
    </Layout>
  );
};

export default Content;
