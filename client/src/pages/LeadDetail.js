import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import { leadsAPI, followupsAPI, appointmentsAPI, quotationsAPI, communicationAPI, usersAPI } from '../services/api';
import { formatDateTime, getStatusColor, getPriorityColor, ENUMS, timeAgo } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import './LeadDetail.css';

const ACTIVITY_ICONS = { created: '🌱', call_logged: '📞', whatsapp_sent: '💬', email_sent: '✉️', status_changed: '🔄', note_added: '📝', quotation_created: '📋', invoice_generated: '🧾', payment_received: '💰', followup_set: '⏰', duplicate_detected: '⚠️', assigned: '👤', csv_imported: '📁', webhook_received: '🔗' };

const SYSTEM_META_KEYS = new Set([
  'metaLeadId', 'metaFormId', 'metaFormName', 'metaPageId', 'rawFields', 'createdTime',
  'meta_page_id', 'meta_form_id', 'meta_ad_id', 'meta_leadgen_id',
  'google_gclid', 'google_campaign', 'google_adgroup', 'google_form', 'google_adid',
  'waMessageId', 'initialMessage',
]);
const STANDARD_FIELDS = new Set([
  'full_name', 'first_name', 'last_name', 'name', 'phone_number', 'phone', 'mobile', 'mobile_number', 'email',
]);

const formatFieldKey = (key) =>
  key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const getFormAnswers = (lead) => {
  const meta = lead.metadata || {};
  if (meta.rawFields && typeof meta.rawFields === 'object') {
    return Object.entries(meta.rawFields).filter(([k, v]) =>
      !STANDARD_FIELDS.has(k.toLowerCase()) && v && String(v).trim()
    );
  }
  return Object.entries(meta).filter(([k, v]) =>
    !SYSTEM_META_KEYS.has(k) && !STANDARD_FIELDS.has(k.toLowerCase()) && v && String(v).trim()
  );
};

const LeadDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [showCall, setShowCall] = useState(false);
  const [callForm, setCallForm] = useState({ duration: '', note: '', outcome: '', callType: 'outbound', nextFollowup: '' });
  const [showFollowup, setShowFollowup] = useState(false);
  const [followupForm, setFollowupForm] = useState({ scheduledAt: '', note: '' });
  const [showEmail, setShowEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({ subject: '', body: '' });
  const [showAppointment, setShowAppointment] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({ title: '', startTime: '', endTime: '', type: 'Meeting', location: '', description: '' });
  const [showQuotation, setShowQuotation] = useState(false);
  const emptyQItem = () => ({ description: '', subDescription: '', subItems: [], totalPrice: '' });
  const [quotationForm, setQuotationForm] = useState({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '', clientGST: '', gstPercent: 18, terms: [], notes: '', validUntil: '', items: [emptyQItem()] });
  const [saving, setSaving] = useState(false);

  const loadLead = async () => {
    try {
      const { data } = await leadsAPI.get(id);
      setLead(data.lead);
      setEditForm({ name: data.lead.name, phone: data.lead.phone || '', email: data.lead.email || '', source: data.lead.source, priority: data.lead.priority, status: data.lead.status, assignedTo: data.lead.assignedTo || '', city: data.lead.city || '', clientAddress: data.lead.clientAddress || '', clientGST: data.lead.clientGST || '', clientType: data.lead.clientType || 'Other', campaign: data.lead.campaign || '' });
    } catch { toast.error('Lead not found'); navigate('/leads'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadLead(); }, [id]);
  useEffect(() => { if (user?.role === 'admin') usersAPI.getAll({ role: 'employee', limit: 100 }).then(({ data }) => setAgents(data.data || [])).catch(() => {}); }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await leadsAPI.update(id, editForm);
      toast.success('Lead updated');
      setEditing(false);
      loadLead();
    } catch { toast.error('Failed to update'); } finally { setSaving(false); }
  };

  const handleNote = async () => {
    if (!note.trim()) return;
    try {
      await leadsAPI.addNote(id, note);
      toast.success('Note added');
      setNote('');
      setShowNote(false);
      loadLead();
    } catch { toast.error('Failed to add note'); }
  };

  const handleCall = async () => {
    setSaving(true);
    try {
      await communicationAPI.logCall({ leadId: parseInt(id), ...callForm, duration: parseInt(callForm.duration) || 0 });
      toast.success('Call logged');
      setShowCall(false);
      setCallForm({ duration: '', note: '', outcome: '', callType: 'outbound', nextFollowup: '' });
      loadLead();
    } catch { toast.error('Failed to log call'); } finally { setSaving(false); }
  };

  const handleFollowup = async () => {
    if (!followupForm.scheduledAt) return toast.error('Scheduled time required');
    setSaving(true);
    try {
      await followupsAPI.create({ leadId: parseInt(id), ...followupForm });
      toast.success('Followup scheduled');
      setShowFollowup(false);
      setFollowupForm({ scheduledAt: '', note: '' });
      loadLead();
    } catch { toast.error('Failed to schedule followup'); } finally { setSaving(false); }
  };

  const handleAppointment = async () => {
    if (!appointmentForm.title.trim()) return toast.error('Title is required');
    if (!appointmentForm.startTime) return toast.error('Start time is required');
    if (!appointmentForm.endTime) return toast.error('End time is required');
    setSaving(true);
    try {
      await appointmentsAPI.create({ leadId: parseInt(id), ...appointmentForm });
      toast.success('Appointment scheduled');
      setShowAppointment(false);
      setAppointmentForm({ title: '', startTime: '', endTime: '', type: 'Meeting', location: '', description: '' });
      navigate('/appointments');
    } catch { toast.error('Failed to schedule appointment'); } finally { setSaving(false); }
  };

  const handleCreateQuotation = async () => {
    if (!quotationForm.clientName.trim()) return toast.error('Client name is required');
    if (!quotationForm.clientPhone.trim()) return toast.error('Phone is required');
    if (!quotationForm.clientEmail.trim()) return toast.error('Email is required');
    if (!quotationForm.clientAddress.trim()) return toast.error('Address is required');
    const validItems = quotationForm.items.filter((i) => i.description?.trim());
    if (!validItems.length) return toast.error('At least one item with description is required');
    setSaving(true);
    try {
      await quotationsAPI.create({ leadId: parseInt(id), ...quotationForm, terms: JSON.stringify(quotationForm.terms.filter(t => t.trim())), items: validItems });
      toast.success('Quotation created');
      setShowQuotation(false);
      setQuotationForm({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '', clientGST: '', gstPercent: 18, terms: [], notes: '', validUntil: '', items: [emptyQItem()] });
      navigate('/quotations');
    } catch { toast.error('Failed to create quotation'); } finally { setSaving(false); }
  };

  const updateQItem = (i, field, val) => { const items = [...quotationForm.items]; items[i] = { ...items[i], [field]: val }; setQuotationForm({ ...quotationForm, items }); };
  const addQSubItem = (i) => { const items = [...quotationForm.items]; items[i] = { ...items[i], subItems: [...(items[i].subItems || []), { label: '', qty: '' }] }; setQuotationForm({ ...quotationForm, items }); };
  const removeQSubItem = (i, j) => { const items = [...quotationForm.items]; items[i] = { ...items[i], subItems: items[i].subItems.filter((_, k) => k !== j) }; setQuotationForm({ ...quotationForm, items }); };
  const updateQSubItem = (i, j, field, val) => { const items = [...quotationForm.items]; const subItems = [...(items[i].subItems || [])]; subItems[j] = { ...subItems[j], [field]: val }; items[i] = { ...items[i], subItems }; setQuotationForm({ ...quotationForm, items }); };

  const handleEmail = async () => {
    if (!emailForm.subject || !emailForm.body) return toast.error('Subject and body required');
    setSaving(true);
    try {
      await communicationAPI.sendEmail({ leadId: parseInt(id), ...emailForm });
      toast.success('Email sent');
      setShowEmail(false);
      setEmailForm({ subject: '', body: '' });
      loadLead();
    } catch { toast.error('Failed to send email'); } finally { setSaving(false); }
  };

  const waLink = lead?.phone ? `https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${lead.name}! `)}` : null;

  if (loading) return <Layout title="Lead"><div className="loading-spinner"><div className="spinner" /></div></Layout>;
  if (!lead) return null;

  return (
    <Layout title={lead.name}>
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/leads')}>← Back to Leads</button>
      </div>

      <div className="lead-header-card">
        <div className="lead-name-row">
          <h1 className="lead-name-big">{lead.name}</h1>
          {lead.isHot && <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>🔥 HOT</span>}
          {lead.isDuplicate && <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Duplicate ×{lead.repeatCount}</span>}
          <span style={{ background: `rgba(${getStatusColor(lead.status).slice(1).match(/.{2}/g)?.map((x) => parseInt(x,16)).join(',')},0.15)`, color: getStatusColor(lead.status), padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{lead.status}</span>
          <span style={{ background: `rgba(${getPriorityColor(lead.priority).slice(1).match(/.{2}/g)?.map((x) => parseInt(x,16)).join(',')},0.15)`, color: getPriorityColor(lead.priority), padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{lead.priority}</span>
          <span style={{ background: '#1e1e3a', padding: '3px 10px', borderRadius: 20, fontSize: 11, color: '#7c3aed' }}>Score: {lead.score}</span>
        </div>
        <div className="lead-meta-row">
          {lead.phone && <div className="lead-meta-item">📞 {lead.phone}</div>}
          {lead.email && <div className="lead-meta-item">✉️ {lead.email}</div>}
          <div className="lead-meta-item">📢 {lead.source}</div>
          {lead.assignedAgent && <div className="lead-meta-item">👤 {lead.assignedAgent.name}</div>}
          <div className="lead-meta-item">🕒 {timeAgo(lead.createdAt)}</div>
        </div>
        <div className="quick-actions">
          {lead.phone && <a href={`tel:${lead.phone}`} className="btn btn-ghost btn-sm">📞 Call</a>}
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ color: '#25d366', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCall(true)}>📋 Log Call</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowNote(true)}>📝 Note</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowFollowup(true)}>⏰ Followup</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAppointment(true)}>📅 Appointment</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setQuotationForm({ clientName: lead.name || '', clientEmail: lead.email || '', clientPhone: lead.phone || '', clientAddress: lead.clientAddress || '', clientGST: lead.clientGST || '', gstPercent: 18, terms: [], notes: '', validUntil: '', items: [emptyQItem()] }); setShowQuotation(true); }}>📋 Quotation</button>
          {lead.email && <button className="btn btn-ghost btn-sm" onClick={() => setShowEmail(true)}>✉️ Email</button>}
          {!editing ? <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>✏️ Edit</button> : (
            <>
              <button className="btn btn-success btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : '✅ Save'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            </>
          )}
        </div>
      </div>

      <div className="lead-detail-grid">
        <div>
          {editing && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h4 style={{ marginBottom: 16 }}>Edit Lead</h4>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Name</label><input className="form-control" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/[^0-9+]/g, '') })} placeholder="+91 9876543210" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email</label><input className="form-control" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Campaign</label><input className="form-control" value={editForm.campaign} onChange={(e) => setEditForm({ ...editForm, campaign: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>{ENUMS.LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Priority</label><select className="form-control" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>{ENUMS.LEAD_PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Source</label><select className="form-control" value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}>{ENUMS.LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Client Type</label><select className="form-control" value={editForm.clientType} onChange={(e) => setEditForm({ ...editForm, clientType: e.target.value })}>{ENUMS.CLIENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
              </div>
              {user?.role === 'admin' && agents.length > 0 && <div className="form-group"><label className="form-label">Assign To</label><select className="form-control" value={editForm.assignedTo} onChange={(e) => setEditForm({ ...editForm, assignedTo: e.target.value })}><option value="">Unassigned</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
              <div className="form-row">
                <div className="form-group"><label className="form-label">City</label><input className="form-control" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} placeholder="e.g. Mumbai" /></div>
                <div className="form-group"><label className="form-label">GST Number</label><input className="form-control" value={editForm.clientGST} onChange={(e) => setEditForm({ ...editForm, clientGST: e.target.value })} /></div>
              </div>
              <div className="form-group"><label className="form-label">Client Address</label><textarea className="form-control" rows={2} value={editForm.clientAddress} onChange={(e) => setEditForm({ ...editForm, clientAddress: e.target.value })} /></div>
            </div>
          )}

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><h3 className="card-title">Activity Timeline</h3></div>
            <div className="activity-timeline">
              {(!lead.activities || lead.activities.length === 0) ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No activities yet</div>
              ) : (
                lead.activities.map((a) => (
                  <div className="activity-item" key={a.id}>
                    <div className="activity-dot">{ACTIVITY_ICONS[a.type] || '📌'}</div>
                    <div className="activity-content">
                      <div className="activity-desc">{a.description}</div>
                      <div className="activity-meta">{a.user?.name && `by ${a.user.name} · `}{timeAgo(a.createdAt)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="info-section">
              <h4>Lead Information</h4>
              {[
                ['Source', lead.source], ['Campaign', lead.campaign], ['Client Type', lead.clientType],
                ['City', lead.city || (() => { const m = lead.metadata || {}; for (const k of Object.keys(m)) { if (/^city$/i.test(k) && m[k]) return m[k]; } if (m.rawFields) { for (const k of Object.keys(m.rawFields)) { if (/^city$/i.test(k) && m.rawFields[k]) return m.rawFields[k]; } } return null; })()], ['Address', lead.clientAddress], ['GST', lead.clientGST],
                ['Next Followup', lead.nextFollowup ? formatDateTime(lead.nextFollowup) : null],
                ['Last Note', lead.lastCallNote],
                ['Created', formatDateTime(lead.createdAt)],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div className="info-row" key={k}><span className="info-key">{k}</span><span className="info-val">{v}</span></div>
              ))}
            </div>
          </div>

          {(() => {
            const formAnswers = getFormAnswers(lead);
            return formAnswers.length > 0 ? (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="info-section">
                  <h4>Form Responses</h4>
                  {formAnswers.map(([k, v]) => (
                    <div className="info-row" key={k}>
                      <span className="info-key" style={{ textTransform: 'none' }}>{formatFieldKey(k)}</span>
                      <span className="info-val">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {lead.quotations?.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><h3 className="card-title">Quotations</h3></div>
              {lead.quotations.map((q) => (
                <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1a1a2e', fontSize: 13 }}>
                  <span>{q.quotationNumber}</span>
                  <span style={{ color: getStatusColor(q.status) }}>{q.status}</span>
                  <span>₹{parseFloat(q.totalAmount).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}

          {lead.invoices?.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="card-title">Invoices</h3></div>
              {lead.invoices.map((inv) => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1a1a2e', fontSize: 13 }}>
                  <span>{inv.invoiceNumber}</span>
                  <span style={{ color: getStatusColor(inv.status) }}>{inv.status}</span>
                  <span>₹{parseFloat(inv.totalAmount).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showNote && (
        <div className="modal-overlay" onClick={() => setShowNote(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h3>Add Note</h3>
            <button className="modal-close" onClick={() => setShowNote(false)}>×</button>
            <div className="form-group"><textarea className="form-control" rows={4} placeholder="Enter note..." value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setShowNote(false)}>Cancel</button><button className="btn btn-primary" onClick={handleNote}>Save Note</button></div>
          </div>
        </div>
      )}

      {showCall && (
        <div className="modal-overlay" onClick={() => setShowCall(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Log Call</h3>
            <button className="modal-close" onClick={() => setShowCall(false)}>×</button>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Call Type</label><select className="form-control" value={callForm.callType} onChange={(e) => setCallForm({ ...callForm, callType: e.target.value })}><option value="outbound">Outbound</option><option value="inbound">Inbound</option></select></div>
              <div className="form-group"><label className="form-label">Duration (seconds)</label><input className="form-control" type="number" min="0" value={callForm.duration} onChange={(e) => setCallForm({ ...callForm, duration: e.target.value })} placeholder="120" /></div>
            </div>
            <div className="form-group"><label className="form-label">Outcome</label><input className="form-control" value={callForm.outcome} onChange={(e) => setCallForm({ ...callForm, outcome: e.target.value })} placeholder="e.g., Interested, Will call back..." /></div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={3} value={callForm.note} onChange={(e) => setCallForm({ ...callForm, note: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Next Followup</label><input className="form-control" type="datetime-local" value={callForm.nextFollowup} onChange={(e) => setCallForm({ ...callForm, nextFollowup: e.target.value })} /></div>
            <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setShowCall(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCall} disabled={saving}>{saving ? 'Saving...' : 'Log Call'}</button></div>
          </div>
        </div>
      )}

      {showFollowup && (
        <div className="modal-overlay" onClick={() => setShowFollowup(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h3>Schedule Followup</h3>
            <button className="modal-close" onClick={() => setShowFollowup(false)}>×</button>
            <div className="form-group"><label className="form-label">Scheduled Time *</label><input className="form-control" type="datetime-local" value={followupForm.scheduledAt} onChange={(e) => setFollowupForm({ ...followupForm, scheduledAt: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Note</label><textarea className="form-control" rows={3} value={followupForm.note} onChange={(e) => setFollowupForm({ ...followupForm, note: e.target.value })} /></div>
            <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setShowFollowup(false)}>Cancel</button><button className="btn btn-primary" onClick={handleFollowup} disabled={saving}>{saving ? 'Saving...' : 'Schedule'}</button></div>
          </div>
        </div>
      )}

      {showEmail && (
        <div className="modal-overlay" onClick={() => setShowEmail(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Send Email to {lead.name}</h3>
            <button className="modal-close" onClick={() => setShowEmail(false)}>×</button>
            <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 12 }}>To: {lead.email}</div>
            <div className="form-group"><label className="form-label">Subject</label><input className="form-control" value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Message</label><textarea className="form-control" rows={6} value={emailForm.body} onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })} /></div>
            <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setShowEmail(false)}>Cancel</button><button className="btn btn-primary" onClick={handleEmail} disabled={saving}>{saving ? 'Sending...' : 'Send Email'}</button></div>
          </div>
        </div>
      )}

      {showAppointment && (
        <div className="modal-overlay" onClick={() => setShowAppointment(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Schedule Appointment</h3>
            <button className="modal-close" onClick={() => setShowAppointment(false)}>×</button>
            <div className="form-group"><label className="form-label">Title *</label><input className="form-control" value={appointmentForm.title} onChange={(e) => setAppointmentForm({ ...appointmentForm, title: e.target.value })} placeholder="e.g. Product Demo" /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Start Time *</label><input className="form-control" type="datetime-local" value={appointmentForm.startTime} onChange={(e) => setAppointmentForm({ ...appointmentForm, startTime: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">End Time *</label><input className="form-control" type="datetime-local" value={appointmentForm.endTime} onChange={(e) => setAppointmentForm({ ...appointmentForm, endTime: e.target.value })} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Type</label><select className="form-control" value={appointmentForm.type} onChange={(e) => setAppointmentForm({ ...appointmentForm, type: e.target.value })}>{['Call', 'Meeting', 'Demo', 'Site Visit', 'Follow-up', 'Other'].map((t) => <option key={t}>{t}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Location</label><input className="form-control" value={appointmentForm.location} onChange={(e) => setAppointmentForm({ ...appointmentForm, location: e.target.value })} placeholder="Office / Google Meet / ..." /></div>
            </div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={2} value={appointmentForm.description} onChange={(e) => setAppointmentForm({ ...appointmentForm, description: e.target.value })} /></div>
            <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setShowAppointment(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAppointment} disabled={saving}>{saving ? 'Saving...' : 'Schedule'}</button></div>
          </div>
        </div>
      )}

      {showQuotation && (
        <div className="modal-overlay" onClick={() => setShowQuotation(false)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <h3>Create Quotation for {lead.name}</h3>
            <button className="modal-close" onClick={() => setShowQuotation(false)}>×</button>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Client Name *</label><input className="form-control" value={quotationForm.clientName} onChange={(e) => setQuotationForm({ ...quotationForm, clientName: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Phone *</label><input className="form-control" value={quotationForm.clientPhone} onChange={(e) => setQuotationForm({ ...quotationForm, clientPhone: e.target.value })} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Email *</label><input className="form-control" value={quotationForm.clientEmail} onChange={(e) => setQuotationForm({ ...quotationForm, clientEmail: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">GST Number</label><input className="form-control" value={quotationForm.clientGST} onChange={(e) => setQuotationForm({ ...quotationForm, clientGST: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">Address *</label><textarea className="form-control" rows={2} value={quotationForm.clientAddress} onChange={(e) => setQuotationForm({ ...quotationForm, clientAddress: e.target.value })} /></div>
            <h4 style={{ margin: '16px 0 10px', fontSize: 13, color: 'var(--text-muted)' }}>Line Items</h4>
            <div className="items-table-wrap"><table className="items-table">
              <thead><tr><th>Service</th><th style={{ width: 200 }}>Deliverables</th><th style={{ width: 130 }}>Package Price</th><th style={{ width: 40 }}></th></tr></thead>
              <tbody>
                {quotationForm.items.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <input value={item.description} onChange={(e) => updateQItem(i, 'description', e.target.value)} placeholder="Item / service name" />
                      <textarea value={item.subDescription} onChange={(e) => updateQItem(i, 'subDescription', e.target.value)} placeholder="Description / what's included" rows={2} style={{ marginTop: 4, width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', color: 'var(--text)', fontSize: 12, resize: 'vertical', outline: 'none' }} />
                    </td>
                    <td>
                      {(item.subItems || []).map((si, j) => (
                        <div key={j} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                          <input value={si.label} onChange={(e) => updateQSubItem(i, j, 'label', e.target.value)} placeholder="Item name" style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 12, outline: 'none' }} />
                          <input type="number" min="0" value={si.qty} onChange={(e) => updateQSubItem(i, j, 'qty', e.target.value)} placeholder="0" style={{ width: 90, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', color: 'var(--text)', fontSize: 12, outline: 'none', textAlign: 'center' }} />
                          <button type="button" onClick={() => removeQSubItem(i, j)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 15, padding: '0 2px' }}>×</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addQSubItem(i)} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, padding: '3px 8px', cursor: 'pointer', marginTop: 2 }}>+ Add Deliverable</button>
                    </td>
                    <td><input type="number" min="0" step="0.01" value={item.totalPrice} onChange={(e) => updateQItem(i, 'totalPrice', e.target.value)} placeholder="0" style={{ textAlign: 'right' }} /></td>
                    <td><button type="button" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }} onClick={() => setQuotationForm({ ...quotationForm, items: quotationForm.items.filter((_, j) => j !== i) })}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setQuotationForm({ ...quotationForm, items: [...quotationForm.items, emptyQItem()] })}>+ Add Item</button>
            <div className="totals-box">
              {(() => { const sub = quotationForm.items.reduce((s, i) => s + parseFloat(i.totalPrice || 0), 0); const gst = (sub * parseFloat(quotationForm.gstPercent || 0)) / 100; return (<>
                <div className="total-row"><span>Subtotal</span><span>{sub.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                <div className="total-row"><span>GST <input type="number" value={quotationForm.gstPercent} onChange={(e) => setQuotationForm({ ...quotationForm, gstPercent: e.target.value })} style={{ width: 50, background: 'transparent', border: '1px solid #2a2a4a', color: 'var(--text)', borderRadius: 4, padding: '2px 4px', fontSize: 12 }} />%</span><span>{gst.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
                <div className="total-row grand"><span>Total</span><span>{(sub + gst).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
              </>); })()}
            </div>
            <div className="form-group" style={{ marginTop: 16 }}><label className="form-label">Valid Until</label><input className="form-control" type="date" value={quotationForm.validUntil} onChange={(e) => setQuotationForm({ ...quotationForm, validUntil: e.target.value })} /></div>
            <div className="form-group">
              <label className="form-label">Terms & Conditions</label>
              {(quotationForm.terms || []).map((term, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  <input className="form-control" style={{ margin: 0 }} value={term} onChange={(e) => { const t = [...quotationForm.terms]; t[i] = e.target.value; setQuotationForm({ ...quotationForm, terms: t }); }} placeholder={`Term ${i + 1}`} />
                  <button type="button" onClick={() => setQuotationForm({ ...quotationForm, terms: quotationForm.terms.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18, flexShrink: 0 }}>×</button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 2 }} onClick={() => setQuotationForm({ ...quotationForm, terms: [...(quotationForm.terms || []), ''] })}>+ Add Term</button>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={quotationForm.notes} onChange={(e) => setQuotationForm({ ...quotationForm, notes: e.target.value })} /></div>
            <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setShowQuotation(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCreateQuotation} disabled={saving}>{saving ? 'Creating...' : 'Create Quotation'}</button></div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default LeadDetail;
