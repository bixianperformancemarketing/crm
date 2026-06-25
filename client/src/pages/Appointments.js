import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import Pagination from '../components/common/Pagination';
import { appointmentsAPI, usersAPI, leadsAPI } from '../services/api';
import { formatDateTime, formatDate, formatTime, getStatusColor, ENUMS } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import DateFilter from '../components/common/DateFilter';
import './Appointments.css';

const BLANK_FORM = { title: '', description: '', startTime: '', endTime: '', type: 'Meeting', assignedTo: '', leadId: '', location: '', meetingLink: '', notes: '' };

const AppointmentForm = ({ formData, setFormData, onSubmit, onCancel, isSaving, title, submitLabel, agents, user }) => (
  <div className="modal-overlay" onClick={onCancel}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <h3>{title}</h3>
      <button className="modal-close" onClick={onCancel}>×</button>
      <form onSubmit={onSubmit}>
        <div className="form-group"><label className="form-label">Title *</label><input className="form-control" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Start Time *</label><input className="form-control" type="datetime-local" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} required /></div>
          <div className="form-group"><label className="form-label">End Time *</label><input className="form-control" type="datetime-local" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} required /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Type</label><select className="form-control" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>{ENUMS.APPOINTMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          {(user?.role === 'admin' || user?.role === 'owner') && agents.length > 0 && (
            <div className="form-group"><label className="form-label">Assign To</label><select className="form-control" value={formData.assignedTo} onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}><option value="">Self</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          )}
        </div>
        <div className="form-group"><label className="form-label">Location</label><input className="form-control" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Meeting Link</label><input className="form-control" value={formData.meetingLink} onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })} placeholder="https://meet.google.com/..." /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Saving...' : submitLabel}</button>
        </div>
      </form>
    </div>
  </div>
);

const Appointments = () => {
  const { user } = useAuth();
  const [view, setView] = useState('list');
  const [appointments, setAppointments] = useState([]);
  const [calendarData, setCalendarData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);
  const [agents, setAgents] = useState([]);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  const [editAppt, setEditAppt] = useState(null);
  const [editForm, setEditForm] = useState(BLANK_FORM);
  const [editSaving, setEditSaving] = useState(false);

  const [confirmAppt, setConfirmAppt] = useState(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const { data } = await appointmentsAPI.getAll(params);
      setAppointments(data.data || []);
      setPagination(data.pagination);
    } catch { toast.error('Failed to load appointments'); }
    finally { setLoading(false); }
  }, [page, dateFrom, dateTo]);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await appointmentsAPI.getCalendar({ month, year });
      setCalendarData(data.appointments || []);
    } catch {}
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { if (view === 'list') loadList(); else loadCalendar(); }, [view, loadList, loadCalendar]);
  useEffect(() => { if (user?.role === 'admin' || user?.role === 'owner') usersAPI.getAll({ role: 'employee', limit: 100 }).then(({ data }) => setAgents(data.data || [])).catch(() => {}); }, [user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.startTime || !form.endTime) return toast.error('Start and end time required');
    setSaving(true);
    try {
      await appointmentsAPI.create({ ...form, leadId: form.leadId || undefined, assignedTo: form.assignedTo || user.id });
      toast.success('Appointment created');
      setShowCreate(false);
      setForm(BLANK_FORM);
      if (view === 'list') loadList(); else loadCalendar();
    } catch { toast.error('Failed to create appointment'); }
    finally { setSaving(false); }
  };

  const openEdit = (a) => {
    setEditAppt(a);
    setEditForm({
      title: a.title || '',
      description: a.description || '',
      startTime: a.startTime ? a.startTime.slice(0, 16) : '',
      endTime: a.endTime ? a.endTime.slice(0, 16) : '',
      type: a.type || 'Meeting',
      assignedTo: a.assignedTo || '',
      leadId: a.leadId || '',
      location: a.location || '',
      meetingLink: a.meetingLink || '',
      notes: a.notes || '',
    });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editForm.startTime || !editForm.endTime) return toast.error('Start and end time required');
    setEditSaving(true);
    try {
      await appointmentsAPI.update(editAppt.id, { ...editForm, leadId: editForm.leadId || undefined, assignedTo: editForm.assignedTo || user.id });
      toast.success('Appointment updated');
      setEditAppt(null);
      if (view === 'list') loadList(); else loadCalendar();
    } catch { toast.error('Failed to update appointment'); }
    finally { setEditSaving(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await appointmentsAPI.updateStatus(id, { status });
      toast.success(`Marked as ${status}`);
      setConfirmAppt(null);
      loadList();
    } catch { toast.error('Failed to update'); }
  };

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();

  const calByDay = {};
  calendarData.forEach((a) => {
    const d = new Date(a.startTime).getDate();
    if (!calByDay[d]) calByDay[d] = [];
    calByDay[d].push(a);
  });

  const canEdit = (a) => user?.role === 'owner' || user?.role === 'admin' || String(a.createdBy) === String(user?.id);

  return (
    <Layout title="Appointments">
      <div className="page-header">
        <div className="page-title">Appointments</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="followup-tabs" style={{ marginBottom: 0 }}>
            {['list', 'calendar'].map((v) => (
              <button key={v} className={`followup-tab${view === v ? ' active' : ''}`} onClick={() => setView(v)} style={{ textTransform: 'capitalize' }}>{v}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New</button>
        </div>
      </div>
      {view === 'list' && (
        <div style={{ marginBottom: 14 }}>
          <DateFilter onChange={({ dateFrom: df, dateTo: dt }) => { setDateFrom(df); setDateTo(dt); setPage(1); }} />
        </div>
      )}

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : view === 'list' ? (
        <>
          {appointments.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📅</div><div className="empty-title">No appointments</div></div>
          ) : (
            appointments.map((a) => (
              <div className="appt-card" key={a.id} style={{ borderLeft: `3px solid ${getStatusColor(a.status)}` }}>
                <div className="appt-time-col">
                  <div className="appt-time-date">{formatDate(a.startTime)}</div>
                  <div className="appt-time-time">{formatTime(a.startTime)}</div>
                </div>
                <div className="appt-content">
                  <div className="appt-title">{a.title}</div>
                  <div className="appt-meta">
                    <span>📋 {a.type}</span>
                    {a.lead && <Link to={`/leads/${a.lead.id}`} style={{ color: 'var(--info)' }}>👤 {a.lead.name}</Link>}
                    {a.assignee && <span>🧑 {a.assignee.name}</span>}
                    {a.location && <span>📍 {a.location}</span>}
                  </div>
                  {a.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{a.description}</div>}
                </div>
                <div className="appt-actions">
                  <span style={{ fontSize: 11, background: `${getStatusColor(a.status)}22`, color: getStatusColor(a.status), padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{a.status}</span>
                  {a.status === 'Scheduled' && (
                    <>
                      <button className="btn btn-success btn-sm" title="Mark as Completed" onClick={() => setConfirmAppt(a)}>✅</button>
                      <button className="btn btn-ghost btn-sm" title="Cancel appointment" onClick={() => updateStatus(a.id, 'Cancelled')}>✕</button>
                    </>
                  )}
                  {canEdit(a) && a.status === 'Scheduled' && (
                    <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(a)}>✏️</button>
                  )}
                  {a.meetingLink && <a href={a.meetingLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">🔗 Join</a>}
                </div>
              </div>
            ))
          )}
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { if (month === 1) { setMonth(12); setYear((y) => y - 1); } else setMonth((m) => m - 1); }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { if (month === 12) { setMonth(1); setYear((y) => y + 1); } else setMonth((m) => m + 1); }}>›</button>
          </div>
          <div className="calendar-grid">
            {DAYS.map((d) => <div key={d} className="cal-day-header">{d}</div>)}
            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} className="cal-day other-month" />)}
            {Array(daysInMonth).fill(null).map((_, i) => {
              const dayNum = i + 1;
              const isToday = dayNum === new Date().getDate() && month === new Date().getMonth() + 1 && year === new Date().getFullYear();
              return (
                <div key={dayNum} className={`cal-day${isToday ? ' today' : ''}`}>
                  <div className="cal-day-num" style={{ color: isToday ? 'var(--accent)' : undefined }}>{dayNum}</div>
                  {(calByDay[dayNum] || []).map((a) => (
                    <div key={a.id} className="cal-appt-chip" title={a.title}>{a.title}</div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCreate && (
        <AppointmentForm
          formData={form}
          setFormData={setForm}
          onSubmit={handleCreate}
          onCancel={() => { setShowCreate(false); setForm(BLANK_FORM); }}
          isSaving={saving}
          title="New Appointment"
          submitLabel="Create"
          agents={agents}
          user={user}
        />
      )}

      {editAppt && (
        <AppointmentForm
          formData={editForm}
          setFormData={setEditForm}
          onSubmit={handleEditSave}
          onCancel={() => setEditAppt(null)}
          isSaving={editSaving}
          title="Edit Appointment"
          submitLabel="Save Changes"
          agents={agents}
          user={user}
        />
      )}

      {confirmAppt && (
        <div className="modal-overlay" onClick={() => setConfirmAppt(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3>Mark as Completed?</h3>
            <button className="modal-close" onClick={() => setConfirmAppt(null)}>×</button>
            <p style={{ color: 'var(--text-muted)', marginTop: 8, marginBottom: 20 }}>
              Are you sure you want to mark <strong style={{ color: 'var(--text)' }}>{confirmAppt.title}</strong> as Completed? This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmAppt(null)}>Cancel</button>
              <button className="btn btn-success" onClick={() => updateStatus(confirmAppt.id, 'Completed')}>Yes, Mark Completed</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Appointments;
