import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import Pagination from '../components/common/Pagination';
import { appointmentsAPI, usersAPI, leadsAPI } from '../services/api';
import { formatDateTime, formatDate, formatTime, getStatusColor, ENUMS } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import './Appointments.css';

const Appointments = () => {
  const { user } = useAuth();
  const [view, setView] = useState('list');
  const [appointments, setAppointments] = useState([]);
  const [calendarData, setCalendarData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);
  const [agents, setAgents] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', startTime: '', endTime: '', type: 'Meeting', assignedTo: '', leadId: '', location: '', meetingLink: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await appointmentsAPI.getAll({ page });
      setAppointments(data.data || []);
      setPagination(data.pagination);
    } catch { toast.error('Failed to load appointments'); }
    finally { setLoading(false); }
  }, [page]);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await appointmentsAPI.getCalendar({ month, year });
      setCalendarData(data.appointments || []);
    } catch {}
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { if (view === 'list') loadList(); else loadCalendar(); }, [view, loadList, loadCalendar]);
  useEffect(() => { if (user?.role === 'admin') usersAPI.getAll({ role: 'employee', limit: 100 }).then(({ data }) => setAgents(data.data || [])).catch(() => {}); }, [user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.startTime || !form.endTime) return toast.error('Start and end time required');
    setSaving(true);
    try {
      await appointmentsAPI.create({ ...form, leadId: form.leadId || undefined, assignedTo: form.assignedTo || user.id });
      toast.success('Appointment created');
      setShowCreate(false);
      setForm({ title: '', description: '', startTime: '', endTime: '', type: 'Meeting', assignedTo: '', leadId: '', location: '', meetingLink: '', notes: '' });
      if (view === 'list') loadList(); else loadCalendar();
    } catch { toast.error('Failed to create appointment'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await appointmentsAPI.updateStatus(id, { status });
      toast.success(`Marked as ${status}`);
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
                      <button className="btn btn-success btn-sm" onClick={() => updateStatus(a.id, 'Completed')}>✅</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(a.id, 'Cancelled')}>✕</button>
                    </>
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
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New Appointment</h3>
            <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            <form onSubmit={handleCreate}>
              <div className="form-group"><label className="form-label">Title *</label><input className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Start Time *</label><input className="form-control" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">End Time *</label><input className="form-control" type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Type</label><select className="form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{ENUMS.APPOINTMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
                {user?.role === 'admin' && agents.length > 0 && <div className="form-group"><label className="form-label">Assign To</label><select className="form-control" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}><option value="">Self</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
              </div>
              <div className="form-group"><label className="form-label">Location</label><input className="form-control" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Meeting Link</label><input className="form-control" value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} placeholder="https://meet.google.com/..." /></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Appointments;
