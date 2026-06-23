import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import TaskNotesSection from '../components/common/TaskNotesSection';
import { contentAPI, usersAPI, orgAPI } from '../services/api';
import { getPriorityColor, getInitials } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import './Pipeline.css';

const APPROVAL_RESTRICTED = new Set(['Approved', 'Not Approved']);

const COLUMNS = ['Overdue', 'To Do Today', 'In Progress', 'Done', 'Review', 'Approved', 'Not Approved'];
const COL_COLORS = {
  Overdue: '#ef4444',
  'To Do Today': '#0ea5e9',
  'In Progress': '#a78bfa',
  Done: '#22c55e',
  Review: '#f59e0b',
  Approved: '#10b981',
  'Not Approved': '#ef4444',
};

const ARCHIVABLE = new Set(['Done', 'Approved', 'Not Approved']);

const fmtDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const TasksPipeline = () => {
  const { user, isRole } = useAuth();
  const isAdmin = isRole('admin');
  const isOwner = isRole('owner');
  const isEmployee = isRole('employee');
  const canApprove = isOwner || isAdmin;
  const canSelfCreate = isEmployee || isAdmin;

  const [pipeline, setPipeline] = useState({});
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'Medium', dueDate: '', dueTime: '', scheduledFor: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [notesTask, setNotesTask] = useState(null);
  const [apiUsers, setApiUsers] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceFilter, setWorkspaceFilter] = useState('');
  const [filterUser, setFilterUser] = useState('');

  useEffect(() => {
    if (isAdmin || isOwner) {
      usersAPI.getAll({ limit: 200 }).then(({ data }) => setApiUsers(data.data || [])).catch(() => {});
    }
    if (isOwner) {
      orgAPI.getWorkspaces().then(({ data }) => setWorkspaces(data.workspaces || [])).catch(() => {});
    }
  }, [isAdmin, isOwner]);

  useEffect(() => {
    if (isOwner) setFilterUser('');
  }, [workspaceFilter, isOwner]);

  const users = useMemo(() => {
    let list = apiUsers;
    if (isOwner && workspaceFilter) {
      list = list.filter(u => String(u.workspaceId) === String(workspaceFilter));
    }
    if (list.length > 0) return list;
    const seen = new Set();
    const result = [];
    COLUMNS.forEach(col => {
      (pipeline[col] || []).forEach(task => {
        if (task.assignee && !seen.has(task.assignee.id)) {
          seen.add(task.assignee.id);
          result.push(task.assignee);
        }
      });
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [apiUsers, pipeline, workspaceFilter, isOwner]);

  const loadPipeline = useCallback(async () => {
    try {
      const params = {};
      if (filterUser) params.assignedTo = filterUser;
      if (isOwner && workspaceFilter) params.workspaceId = workspaceFilter;
      const { data } = await contentAPI.getPipeline(params);
      setPipeline(data.pipeline || {});
    } catch { toast.error('Failed to load tasks pipeline'); }
    finally { setLoading(false); }
  }, [filterUser, workspaceFilter, isOwner]);

  useEffect(() => { loadPipeline(); }, [loadPipeline]);

  const findTask = (id) => {
    for (const col of COLUMNS) {
      const found = (pipeline[col] || []).find(t => String(t.id) === String(id));
      if (found) return found;
    }
    return null;
  };

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination || source.droppableId === destination.droppableId) return;

    const dest = destination.droppableId;
    const task = findTask(draggableId);

    if (task) {
      const needsApproval = task.requiresApproval !== false;
      if (needsApproval && dest === 'Done') {
        return toast.error('This task requires approval — move it to Review first');
      }
      if (!needsApproval && APPROVAL_RESTRICTED.has(dest)) {
        return toast.error('This task has no approval flow — mark it as Done instead');
      }
    }

    if (APPROVAL_RESTRICTED.has(dest)) {
      if (!canApprove) return toast.error('Only admins and owners can approve or reject tasks');
      if (task && String(task.assignedTo) === String(user?.id)) return toast.error('You cannot approve or reject a task assigned to you');
    }

    const newPipeline = { ...pipeline };
    const src = [...(newPipeline[source.droppableId] || [])];
    const dst = [...(newPipeline[destination.droppableId] || [])];
    const [moved] = src.splice(source.index, 1);
    dst.splice(destination.index, 0, { ...moved, status: destination.droppableId });
    newPipeline[source.droppableId] = src;
    newPipeline[destination.droppableId] = dst;
    setPipeline(newPipeline);

    try {
      await contentAPI.update(draggableId, { status: destination.droppableId });
      toast.success(`Moved to ${destination.droppableId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
      loadPipeline();
    }
  };

  const handleArchive = async (e, taskId) => {
    e.stopPropagation();
    setArchiving(taskId);
    try {
      await contentAPI.archive(taskId);
      toast.success('Task archived');
      loadPipeline();
    } catch { toast.error('Failed to archive task'); }
    finally { setArchiving(null); }
  };

  const handleClearCompleted = async () => {
    const completedCount = ['Done', 'Approved', 'Not Approved'].reduce((n, col) => n + (pipeline[col]?.length || 0), 0);
    if (completedCount === 0) return toast('No completed tasks to clear');
    if (!window.confirm(`Archive ${completedCount} completed task(s)? They can be viewed in the Archived tab.`)) return;
    setClearing(true);
    try {
      const params = (isOwner && workspaceFilter) ? { workspaceId: workspaceFilter } : {};
      const { data } = await contentAPI.archiveBulk(params);
      toast.success(data.message || 'Completed tasks archived');
      loadPipeline();
    } catch { toast.error('Failed to clear completed tasks'); }
    finally { setClearing(false); }
  };

  const handleQuickAdd = async () => {
    if (!quickTitle.trim()) return;
    setQuickSaving(true);
    try {
      await contentAPI.create({ title: quickTitle.trim(), assignedTo: user?.id, requiresApproval: isEmployee });
      setQuickAdd(false);
      setQuickTitle('');
      loadPipeline();
      toast.success('Task added');
    } catch { toast.error('Failed to create task'); }
    finally { setQuickSaving(false); }
  };

  const handleDeleteTask = async (e, taskId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    try {
      await contentAPI.delete(taskId);
      toast.success('Task deleted');
      loadPipeline();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete task'); }
  };

  const openEdit = (e, task) => {
    e.stopPropagation();
    setEditTask(task);
    setEditForm({ title: task.title || '', description: task.description || '', priority: task.priority || 'Medium', dueDate: task.dueDate || '', dueTime: task.dueTime || '', scheduledFor: task.scheduledFor ? task.scheduledFor.slice(0, 16) : '' });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editForm.title.trim()) return toast.error('Title is required');
    if (editForm.scheduledFor && editForm.dueDate && editForm.dueDate < editForm.scheduledFor.slice(0, 10)) return toast.error('Due date cannot be before the scheduled date');
    setEditSaving(true);
    try {
      await contentAPI.update(editTask.id, editForm);
      toast.success('Task updated');
      setEditTask(null);
      loadPipeline();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update task'); }
    finally { setEditSaving(false); }
  };

  const completedCount = ['Done', 'Approved', 'Not Approved'].reduce((n, col) => n + (pipeline[col]?.length || 0), 0);

  if (loading) return <Layout title="Tasks Pipeline"><div className="loading-spinner"><div className="spinner" /></div></Layout>;

  return (
    <Layout title="Tasks Pipeline">
      <div className="page-header">
        <div className="page-title">Tasks Pipeline</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

          {/* Admin: My Tasks / All Tasks pill toggle */}
          {isAdmin && (
            <div style={{ display: 'flex', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, gap: 2 }}>
              <button
                onClick={() => setFilterUser(String(user.id))}
                style={{
                  padding: '5px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: filterUser === String(user.id) ? 'var(--accent)' : 'transparent',
                  color: filterUser === String(user.id) ? '#fff' : 'var(--text-muted)',
                }}
              >
                My Tasks
              </button>
              <button
                onClick={() => setFilterUser('')}
                style={{
                  padding: '5px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: filterUser === '' ? 'var(--accent)' : 'transparent',
                  color: filterUser === '' ? '#fff' : 'var(--text-muted)',
                }}
              >
                All Tasks
              </button>
            </div>
          )}

          {/* Owner: Workspace + User dropdowns */}
          {isOwner && (
            <>
              <select
                className="filter-select"
                value={workspaceFilter}
                onChange={(e) => setWorkspaceFilter(e.target.value)}
              >
                <option value="">All Workspaces</option>
                {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
              </select>
              <select
                className="filter-select"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
              >
                <option value="">All Users</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </>
          )}

          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Drag cards to update status</div>
          {completedCount > 0 && (
            <button
              onClick={handleClearCompleted}
              disabled={clearing}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#e94560',
                background: 'rgba(233,69,96,0.1)',
                border: '1px solid rgba(233,69,96,0.35)',
                borderRadius: 8,
                padding: '6px 14px',
                cursor: clearing ? 'not-allowed' : 'pointer',
                opacity: clearing ? 0.6 : 1,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!clearing) { e.currentTarget.style.background = 'rgba(233,69,96,0.18)'; e.currentTarget.style.borderColor = 'rgba(233,69,96,0.6)'; }}}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(233,69,96,0.1)'; e.currentTarget.style.borderColor = 'rgba(233,69,96,0.35)'; }}
            >
              {clearing ? 'Clearing...' : `🗂 Clear Completed (${completedCount})`}
            </button>
          )}
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="pipeline-board">
          {COLUMNS.map((col) => {
            const tasks = pipeline[col] || [];
            const color = COL_COLORS[col];
            return (
              <div className="pipeline-column" key={col}>
                <div className="pipeline-col-header">
                  <div className="pipeline-col-title" style={{ color }}>{col}</div>
                  <div className="pipeline-col-count">{tasks.length}</div>
                </div>
                <Droppable droppableId={col}>
                  {(provided, snapshot) => (
                    <div
                      className="pipeline-col-body"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{ background: snapshot.isDraggingOver ? `${color}0a` : undefined }}
                    >
                      {tasks.map((task, index) => (
                        <Draggable key={String(task.id)} draggableId={String(task.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`kanban-card${snapshot.isDragging ? ' dragging' : ''}`}
                              style={{ ...provided.draggableProps.style, borderLeft: `3px solid ${color}` }}
                              onClick={() => !snapshot.isDragging && setNotesTask(task)}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                                <div className="kc-name" style={{ flex: 1 }}>{task.title}</div>
                                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setNotesTask(task); }}
                                    title="View notes"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: (task.notes || task.assigneeNotes) ? 'var(--accent)' : 'var(--text-muted)', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
                                  >
                                    📝
                                  </button>
                                  {String(task.createdBy) === String(user?.id) && (
                                    <>
                                      <button
                                        onClick={(e) => openEdit(e, task)}
                                        title="Edit task"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={(e) => handleDeleteTask(e, task.id)}
                                        title="Delete task"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
                                      >
                                        🗑️
                                      </button>
                                    </>
                                  )}
                                  {ARCHIVABLE.has(col) && (
                                    <button
                                      onClick={(e) => handleArchive(e, task.id)}
                                      disabled={archiving === task.id}
                                      title="Archive task"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
                                    >
                                      {archiving === task.id ? '…' : '📦'}
                                    </button>
                                  )}
                                </div>
                              </div>
                              {task.scheduledFor && new Date(task.scheduledFor) > new Date() && (
                                <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  🕐 {new Date(task.scheduledFor).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                              {task.lead && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                                  🔗 {task.lead.name}
                                </div>
                              )}
                              {!task.requiresApproval && (
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>No approval needed</div>
                              )}
                              <div className="kc-meta">
                                {task.dueDate && (
                                  <span className="kc-source">📅 {fmtDate(task.dueDate)}</span>
                                )}
                                {task.priority && (
                                  <span style={{
                                    fontSize: 10,
                                    background: `rgba(${getPriorityColor(task.priority).slice(1).match(/.{2}/g)?.map((x) => parseInt(x, 16)).join(',')},0.15)`,
                                    color: getPriorityColor(task.priority),
                                    padding: '1px 6px', borderRadius: 10, fontWeight: 700,
                                  }}>{task.priority}</span>
                                )}
                                {task.assignee && (
                                  <div className="kc-agent">
                                    <div className="kc-agent-dot">{getInitials(task.assignee.name)}</div>
                                    <span>{task.assignee.name.split(' ')[0]}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {tasks.length === 0 && !snapshot.isDraggingOver && !(col === 'To Do Today' && canSelfCreate) && (
                        <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)', fontSize: 12 }}>No tasks</div>
                      )}
                      {col === 'To Do Today' && canSelfCreate && (
                        <div style={{ padding: '4px 4px 4px' }}>
                          {quickAdd ? (
                            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                              <textarea
                                autoFocus
                                rows={2}
                                placeholder="Enter task title..."
                                value={quickTitle}
                                onChange={e => setQuickTitle(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickAdd(); } if (e.key === 'Escape') { setQuickAdd(false); setQuickTitle(''); } }}
                                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', color: 'var(--text)', fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                              />
                              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                <button
                                  onClick={handleQuickAdd}
                                  disabled={quickSaving || !quickTitle.trim()}
                                  style={{ flex: 1, padding: '5px 0', background: '#0ea5e9', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: quickSaving ? 'not-allowed' : 'pointer', opacity: quickSaving ? 0.7 : 1 }}
                                >
                                  {quickSaving ? 'Adding...' : 'Add Task'}
                                </button>
                                <button
                                  onClick={() => { setQuickAdd(false); setQuickTitle(''); }}
                                  style={{ padding: '5px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
                                >
                                  Cancel
                                </button>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                                Approval required · Assigned to you · Press Enter to add
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setQuickAdd(true)}
                              style={{ width: '100%', padding: '8px 12px', background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.4)', borderRadius: 8, color: '#0ea5e9', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.22)'; e.currentTarget.style.borderColor = '#0ea5e9'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.12)'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.4)'; }}
                            >
                              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Task
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {notesTask && (
        <div className="modal-overlay" onClick={() => setNotesTask(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setNotesTask(null)}>×</button>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${COL_COLORS[notesTask.status] || '#6b7280'}22`, color: COL_COLORS[notesTask.status] || '#6b7280', fontWeight: 600 }}>{notesTask.status}</span>
              {notesTask.assignee && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→ {notesTask.assignee.name}</span>}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{notesTask.title}</div>
            {notesTask.description && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {notesTask.description}
              </div>
            )}
            <TaskNotesSection
              task={notesTask}
              user={user}
              onUpdate={(updates) => {
                setNotesTask(prev => ({ ...prev, ...updates }));
                setPipeline(prev => {
                  const col = notesTask.status;
                  return {
                    ...prev,
                    [col]: (prev[col] || []).map(t => t.id === notesTask.id ? { ...t, ...updates } : t),
                  };
                });
              }}
            />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setNotesTask(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {editTask && (
        <div className="modal-overlay" onClick={() => setEditTask(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h3>Edit Task</h3>
            <button className="modal-close" onClick={() => setEditTask(null)}>×</button>
            <form onSubmit={handleEditSave}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-control" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="Task title..." required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={3} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="What needs to be done..." style={{ resize: 'vertical' }} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-control" value={editForm.priority} onChange={e => setEditForm({ ...editForm, priority: e.target.value })}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input className="form-control" type="date" value={editForm.dueDate} onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Due Time <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}>(Optional)</span></label>
                <input className="form-control" type="time" value={editForm.dueTime} onChange={e => setEditForm({ ...editForm, dueTime: e.target.value })} />
              </div>
              {(isAdmin || isOwner) && (
                <div className="form-group">
                  <label className="form-label">
                    Schedule For
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>(assignee won't see until this date &amp; time)</span>
                  </label>
                  <input className="form-control" type="datetime-local" value={editForm.scheduledFor} onChange={e => setEditForm({ ...editForm, scheduledFor: e.target.value })} />
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditTask(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>{editSaving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default TasksPipeline;
