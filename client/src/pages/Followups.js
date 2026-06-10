import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import Pagination from '../components/common/Pagination';
import { followupsAPI } from '../services/api';
import { formatDateTime, getStatusColor } from '../utils/helpers';
import './Followups.css';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
];

const Followups = () => {
  const [searchParams] = useSearchParams();
  const defaultFilter = searchParams.get('filter') || 'all';
  const [filter, setFilter] = useState(defaultFilter);
  const [followups, setFollowups] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showComplete, setShowComplete] = useState(null);
  const [completeForm, setCompleteForm] = useState({ outcome: '', nextFollowupDate: '' });
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await followupsAPI.getAll({ filter, page });
      setFollowups(data.data || []);
      setPagination(data.pagination);
    } catch { toast.error('Failed to load followups'); }
    finally { setLoading(false); }
  }, [filter, page]);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await followupsAPI.complete(showComplete.id, completeForm);
      toast.success('Followup completed!');
      setShowComplete(null);
      setCompleteForm({ outcome: '', nextFollowupDate: '' });
      load();
    } catch { toast.error('Failed to complete followup'); }
    finally { setCompleting(false); }
  };

  const handleCancel = async (id) => {
    try {
      await followupsAPI.cancel(id);
      toast.success('Followup cancelled');
      load();
    } catch { toast.error('Failed to cancel'); }
  };

  return (
    <Layout title="Followups">
      <div className="page-header">
        <div className="page-title">Followups</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{pagination?.total || 0} followups</div>
      </div>

      <div className="followup-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`followup-tab${filter === t.key ? ' active' : ''}`} onClick={() => { setFilter(t.key); setPage(1); }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : followups.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📞</div><div className="empty-title">No followups</div></div>
      ) : (
        <>
          {followups.map((f) => (
            <div className="followup-card" key={f.id} style={{ borderLeft: `3px solid ${getStatusColor(f.status)}` }}>
              <div style={{ fontSize: 20 }}>{f.status === 'overdue' ? '⚠️' : f.status === 'completed' ? '✅' : '📞'}</div>
              <div className="fc-content">
                <div className="fc-lead">
                  {f.lead ? <Link to={`/leads/${f.lead.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{f.lead.name}</Link> : 'Unknown Lead'}
                  {f.lead?.phone && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>{f.lead.phone}</span>}
                  {f.lead?.assignedAgent?.name && (
                    <span style={{ marginLeft: 8, fontSize: 11, background: 'rgba(14,165,233,0.12)', color: '#0ea5e9', padding: '1px 8px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      👤 {f.lead.assignedAgent.name}
                    </span>
                  )}
                </div>
                <div className="fc-time">{formatDateTime(f.scheduledAt)}</div>
                {f.note && <div className="fc-note">"{f.note}"</div>}
                {f.outcome && <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>Outcome: {f.outcome}</div>}
              </div>
              <div className="fc-actions">
                <span className="fc-status" style={{ background: `${getStatusColor(f.status)}22`, color: getStatusColor(f.status) }}>{f.status}</span>
                {f.lead?.phone && <a href={`tel:${f.lead.phone}`} className="btn btn-ghost btn-sm">📞</a>}
                {f.status !== 'completed' && f.status !== 'cancelled' && (
                  <>
                    <button className="btn btn-success btn-sm" onClick={() => setShowComplete(f)}>✅ Complete</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleCancel(f.id)}>Cancel</button>
                  </>
                )}
              </div>
            </div>
          ))}
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}

      {showComplete && (
        <div className="modal-overlay" onClick={() => setShowComplete(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h3>Complete Followup</h3>
            <button className="modal-close" onClick={() => setShowComplete(null)}>×</button>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Lead: {showComplete.lead?.name}</p>
            <div className="form-group"><label className="form-label">Outcome *</label><textarea className="form-control" rows={3} placeholder="What happened on this followup?" value={completeForm.outcome} onChange={(e) => setCompleteForm({ ...completeForm, outcome: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Schedule Next Followup</label><input className="form-control" type="datetime-local" value={completeForm.nextFollowupDate} onChange={(e) => setCompleteForm({ ...completeForm, nextFollowupDate: e.target.value })} /></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowComplete(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleComplete} disabled={completing}>{completing ? 'Saving...' : 'Mark Complete'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Followups;
