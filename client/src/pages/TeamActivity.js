import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import Pagination from '../components/common/Pagination';
import { teamActivityAPI } from '../services/api';
import { timeAgo } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import DateFilter from '../components/common/DateFilter';

const ACTIVITY_ICONS = {
  created: '🌱', call_logged: '📞', whatsapp_sent: '💬', email_sent: '✉️',
  status_changed: '🔄', note_added: '📝', quotation_created: '📋',
  invoice_generated: '🧾', payment_received: '💰', followup_set: '⏰',
  duplicate_detected: '⚠️', assigned: '👤', csv_imported: '📁', webhook_received: '🔗',
};

const ACTION_LABELS = {
  created: 'Lead Created', call_logged: 'Call Logged', whatsapp_sent: 'WhatsApp Sent',
  email_sent: 'Email Sent', status_changed: 'Status Changed', note_added: 'Note Added',
  quotation_created: 'Quotation Created', invoice_generated: 'Invoice Generated',
  payment_received: 'Payment Received', followup_set: 'Followup Set',
  duplicate_detected: 'Duplicate', assigned: 'Assigned', csv_imported: 'CSV Import',
  webhook_received: 'Webhook',
};

const LEAD_STAT_CARDS = [
  { key: 'totalLeads',       label: 'Total Leads',       icon: '👥', color: '#0ea5e9', currency: false },
  { key: 'activeLeads',      label: 'Active Leads',      icon: '🔥', color: '#f59e0b', currency: false },
  { key: 'wonLeads',         label: 'Won Leads',         icon: '✅', color: '#22c55e', currency: false },
  { key: 'hotLeads',         label: 'Hot Leads',         icon: '⚡', color: '#ef4444', currency: false },
  { key: 'totalRevenue',     label: 'Total Revenue',     icon: '💰', color: '#22c55e', currency: true  },
  { key: 'pendingRevenue',   label: 'Pending Revenue',   icon: '⏳', color: '#f59e0b', currency: true  },
  { key: 'overdueInvoices',  label: 'Overdue Invoices',  icon: '🧾', color: '#ef4444', currency: false },
  { key: 'todayAppts',       label: "Today's Appts",     icon: '📅', color: '#7c3aed', currency: false },
  { key: 'pendingFollowups', label: 'Pending Followups', icon: '📞', color: '#0ea5e9', currency: false },
  { key: 'overdueFollowups', label: 'Overdue Followups', icon: '⏰', color: '#ef4444', currency: false },
  { key: 'conversionRate',   label: 'Conversion Rate',   icon: '📈', color: '#22c55e', currency: false, pct: true },
  { key: 'avgDealSize',      label: 'Avg Deal Size',     icon: '💎', color: '#7c3aed', currency: true  },
];

const TASK_STAT_CARDS = [
  { key: 'totalTasks',      label: 'Total Tasks',      icon: '📋', color: '#0ea5e9', currency: false },
  { key: 'pendingTaskCount',label: 'Pending Tasks',    icon: '⏳', color: '#f59e0b', currency: false },
  { key: 'inProgressTasks', label: 'In Progress',      icon: '⚙️', color: '#7c3aed', currency: false },
  { key: 'reviewTasks',     label: 'In Review',        icon: '🔍', color: '#0ea5e9', currency: false },
  { key: 'overdueTasks',    label: 'Overdue Tasks',    icon: '⏰', color: '#ef4444', currency: false },
];

const formatCurrency = (v) => `₹${Number(v).toLocaleString('en-IN')}`;

const TeamActivity = () => {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [summary, setSummary] = useState([]);
  const [feed, setFeed] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef(null);

  const [statsModal, setStatsModal] = useState(null); // { employee, stats } or null
  const [statsLoading, setStatsLoading] = useState(false);

  const openStats = async (e, emp) => {
    e.stopPropagation();
    setStatsLoading(true);
    setStatsModal({ employee: emp, stats: null, canAccessLeads: true, canUseTasks: true });
    try {
      const { data } = await teamActivityAPI.getEmployeeStats(emp.id);
      setStatsModal({ employee: emp, stats: data.stats, canAccessLeads: data.canAccessLeads, canUseTasks: data.canUseTasks });
    } catch { toast.error('Failed to load stats'); setStatsModal(null); }
    finally { setStatsLoading(false); }
  };

  const loadSummary = async () => {
    try {
      const { data } = await teamActivityAPI.getSummary();
      setSummary(data.summary || []);
    } catch { toast.error('Failed to load team summary'); }
    finally { setSummaryLoading(false); }
  };

  const loadFeed = async (pg, empId, type, df, dt) => {
    setFeedLoading(true);
    try {
      const params = { page: pg, limit: 30 };
      if (empId) params.userId = empId;
      if (type) params.type = type;
      if (df) params.dateFrom = df;
      if (dt) params.dateTo = dt;
      const { data } = await teamActivityAPI.getFeed(params);
      setFeed(data.data || []);
      setPagination(data.pagination);
      setPage(pg);
    } catch { toast.error('Failed to load activity feed'); }
    finally { setFeedLoading(false); }
  };

  useEffect(() => {
    loadSummary();
    loadFeed(1, '', '', '', '');
  }, []);

  useEffect(() => {
    loadFeed(1, selectedEmployee, selectedType, dateFrom, dateTo);
  }, [selectedEmployee, selectedType, dateFrom, dateTo]);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadSummary();
        loadFeed(page, selectedEmployee, selectedType, dateFrom, dateTo);
      }, 60000);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, page, selectedEmployee, selectedType, dateFrom, dateTo]);

  const handleRefresh = () => {
    loadSummary();
    loadFeed(page, selectedEmployee, selectedType, dateFrom, dateTo);
  };

  return (
    <Layout title="Team Activity">
      <div className="page-header">
        <div className="page-title">Team Activity</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleRefresh}>↻ Refresh</button>
          <button
            className={`btn btn-sm ${autoRefresh ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setAutoRefresh(v => !v)}
            title="Auto-refresh every 60 seconds"
          >
            {autoRefresh ? '⏸ Live' : '▶ Live'}
          </button>
        </div>
      </div>

      {/* Employee summary cards */}
      {!summaryLoading && (
        <>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--text)' }}>
            Team Overview
            <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
              — click a card to filter the feed
            </span>
          </div>
          {summary.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>No team members found.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12, marginBottom: 28 }}>
              {summary.map(emp => {
                const isSelected = selectedEmployee === String(emp.id);
                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(isSelected ? '' : String(emp.id))}
                    style={{
                      background: 'var(--card-bg)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 10,
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                      boxShadow: isSelected ? '0 0 0 1px var(--accent)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>{emp.label}</div>
                        {isOwner && emp.workspace && (
                          <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>🏗️ {emp.workspace}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 24, fontWeight: 800, color: emp.todayActions > 0 ? '#22c55e' : 'var(--text-muted)', lineHeight: 1 }}>
                            {emp.todayActions}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>actions today</div>
                        </div>
                        <button
                          onClick={(e) => openStats(e, emp)}
                          style={{ fontSize: 10, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          title="View this employee's dashboard stats"
                        >
                          📊 Stats
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${[emp.canAccessLeads, emp.canAccessLeads, emp.canUseTasks].filter(Boolean).length || 1}, 1fr)`, gap: 4 }}>
                      {[
                        emp.canAccessLeads && { label: 'Active', value: emp.activeLeads, color: '#0ea5e9' },
                        emp.canAccessLeads && { label: 'Won',    value: emp.wonThisMonth, color: '#22c55e' },
                        emp.canUseTasks    && { label: 'Tasks',  value: emp.pendingTasks, color: '#f59e0b' },
                      ].filter(Boolean).map(s => (
                        <div key={s.label} style={{ textAlign: 'center', background: 'var(--surface)', borderRadius: 6, padding: '5px 4px' }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {emp.lastActivityAt && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 7 }}>
                        Last active {timeAgo(emp.lastActivityAt)}
                      </div>
                    )}
                    {!emp.lastActivityAt && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 7 }}>
                        No activity recorded
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          className="form-control"
          style={{ maxWidth: 200, fontSize: 13 }}
          value={selectedEmployee}
          onChange={e => setSelectedEmployee(e.target.value)}
        >
          <option value="">All Employees</option>
          {summary.map(e => (
            <option key={e.id} value={e.id}>
              {e.name}{isOwner && e.workspace ? ` (${e.workspace})` : ''}
            </option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ maxWidth: 180, fontSize: 13 }}
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
        >
          <option value="">All Actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <DateFilter onChange={({ dateFrom: df, dateTo: dt }) => { setDateFrom(df); setDateTo(dt); }} />
        {(selectedEmployee || selectedType || dateFrom) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedEmployee(''); setSelectedType(''); setDateFrom(''); setDateTo(''); }}>
            ✕ Clear filters
          </button>
        )}

        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {pagination?.total ?? 0} entries
        </span>
      </div>

      {/* Activity feed */}
      {feedLoading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : feed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-title">No activity found</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {selectedEmployee || selectedType ? 'Try clearing the filters.' : 'Activity will appear here as your team works.'}
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          {feed.map((a, i) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '12px 18px',
                borderBottom: i < feed.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{ fontSize: 18, minWidth: 26, textAlign: 'center', paddingTop: 1 }}>
                {ACTIVITY_ICONS[a.type] || '📌'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{a.description}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {a.user && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>
                      {a.user.name}
                      {a.user.label && <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>({a.user.label})</span>}
                    </span>
                  )}
                  {a.lead && (
                    <Link
                      to={`/leads/${a.lead.id}`}
                      style={{ fontSize: 11, color: '#0ea5e9', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      🎯 {a.lead.name}
                    </Link>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(a.createdAt)}</span>
                </div>
              </div>
              <div className="feed-action-label" style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', paddingTop: 2, flexShrink: 0 }}>
                {ACTION_LABELS[a.type] || a.type}
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <Pagination
          pagination={pagination}
          onPageChange={(p) => loadFeed(p, selectedEmployee, selectedType, dateFrom, dateTo)}
        />
      )}

      {/* Employee stats modal */}
      {statsModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setStatsModal(null)}
        >
          <div
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, width: '100%', maxWidth: 960, maxHeight: '90vh', overflow: 'auto', padding: 'clamp(16px, 4vw, 30px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{statsModal.employee.name}</div>
                <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>{statsModal.employee.label}</div>
              </div>
              <button onClick={() => setStatsModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {statsLoading || !statsModal.stats ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>Loading stats…</div>
            ) : (
              <>
                {statsModal.canAccessLeads && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Lead Stats</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: 10, marginBottom: statsModal.canUseTasks ? 20 : 0 }}>
                      {LEAD_STAT_CARDS.map(card => {
                        const raw = statsModal.stats[card.key] ?? 0;
                        const display = card.currency ? formatCurrency(raw) : card.pct ? `${raw}%` : raw;
                        const isAlert = (card.key === 'overdueInvoices' || card.key === 'overdueFollowups') && raw > 0;
                        return (
                          <div key={card.key} style={{ background: 'var(--surface)', border: `1px solid ${isAlert ? '#ef4444' : 'var(--border)'}`, borderRadius: 12, padding: '18px 16px 14px', textAlign: 'center' }}>
                            <div style={{ fontSize: 26, marginBottom: 8 }}>{card.icon}</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: isAlert ? '#ef4444' : card.color, lineHeight: 1 }}>{display}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 7, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {statsModal.canUseTasks && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Task Stats</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: 10 }}>
                      {TASK_STAT_CARDS.map(card => {
                        const raw = statsModal.stats[card.key] ?? 0;
                        const isAlert = card.key === 'overdueTasks' && raw > 0;
                        return (
                          <div key={card.key} style={{ background: 'var(--surface)', border: `1px solid ${isAlert ? '#ef4444' : 'var(--border)'}`, borderRadius: 12, padding: '18px 16px 14px', textAlign: 'center' }}>
                            <div style={{ fontSize: 26, marginBottom: 8 }}>{card.icon}</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: isAlert ? '#ef4444' : card.color, lineHeight: 1 }}>{raw}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 7, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {!statsModal.canAccessLeads && !statsModal.canUseTasks && (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>No features enabled for this employee.</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <style>{`@media (max-width: 480px) { .feed-action-label { display: none; } }`}</style>
    </Layout>
  );
};

export default TeamActivity;
