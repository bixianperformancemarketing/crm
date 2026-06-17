import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import Pagination from '../components/common/Pagination';
import { notificationsAPI } from '../services/api';
import { timeAgo } from '../utils/helpers';
import PlansModal from '../components/common/PlansModal';
import { useSocket } from '../context/SocketContext';
import './Notifications.css';

const TYPE_ICONS = {
  lead_assigned: '👤', new_lead: '🎯', followup_due: '📋', appointment_reminder: '📅',
  payment_received: '💰', quotation_approved: '✅', plan_expiring: '⚠️', workspace_limit: '🚫', general: '🔔',
};

const TYPES = ['', 'lead_assigned', 'new_lead', 'followup_due', 'appointment_reminder', 'payment_received', 'quotation_approved', 'plan_expiring'];
const TYPE_LABELS = { '': 'All', lead_assigned: 'Assigned', new_lead: 'New Lead', followup_due: 'Followup', appointment_reminder: 'Appointment', payment_received: 'Payment', quotation_approved: 'Quotation', plan_expiring: 'Plan' };

const PLAN_MODAL_TYPES = new Set(['plan_expiring', 'workspace_limit_reached']);

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const { resetUnread, decrementUnread } = useSocket();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (typeFilter) params.type = typeFilter;
      if (unreadOnly) params.unreadOnly = true;
      const { data } = await notificationsAPI.getAll(params);
      setNotifications(data.data || []);
      setPagination(data.pagination);
    } catch { toast.error('Failed to load notifications'); }
    finally { setLoading(false); }
  }, [page, typeFilter, unreadOnly]);

  // Mark all as read when the page first loads so the bell count clears
  useEffect(() => {
    notificationsAPI.markAllRead().catch(() => {});
    resetUnread();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      resetUnread();
      toast.success('All marked as read');
      load();
    } catch { toast.error('Failed to update'); }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      decrementUnread();
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <Layout title="Notifications">
      {showPlansModal && <PlansModal onClose={() => setShowPlansModal(false)} />}
      <div className="page-header">
        <div className="page-title">Notifications {unreadCount > 0 && <span style={{ fontSize: 13, background: 'var(--accent)', color: '#fff', padding: '2px 8px', borderRadius: 20, marginLeft: 8 }}>{unreadCount}</span>}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn btn-ghost btn-sm${unreadOnly ? ' active' : ''}`} style={unreadOnly ? { background: 'rgba(233,69,96,0.15)', color: 'var(--accent)' } : {}} onClick={() => { setUnreadOnly(!unreadOnly); setPage(1); }}>
            Unread Only
          </button>
          {unreadCount > 0 && <button className="btn btn-ghost btn-sm" onClick={handleMarkAllRead}>Mark All Read</button>}
        </div>
      </div>

      <div className="notif-filter-bar">
        {TYPES.map(t => (
          <button key={t || 'all'} onClick={() => { setTypeFilter(t); setPage(1); }}
            style={{ padding: '4px 12px', borderRadius: 7, background: typeFilter === t ? 'var(--accent)' : 'var(--card-bg)', border: '1px solid var(--border)', color: typeFilter === t ? '#fff' : 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : notifications.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🔔</div><div className="empty-title">No notifications</div></div>
      ) : (
        <>
          <div className="notif-list">
            {notifications.map(n => (
              <div key={n.id} className={`notif-item${!n.isRead ? ' unread' : ''}${PLAN_MODAL_TYPES.has(n.type) ? ' clickable' : ''}`} style={PLAN_MODAL_TYPES.has(n.type) ? { cursor: 'pointer' } : {}} onClick={() => { if (!n.isRead) handleMarkRead(n.id); if (PLAN_MODAL_TYPES.has(n.type)) setShowPlansModal(true); }}>
                <div className="notif-icon">{TYPE_ICONS[n.type] || '🔔'}</div>
                <div className="notif-body">
                  <div className="notif-title">
                    {n.title}
                    <span className="notif-type-chip">{(n.type || '').replace(/_/g, ' ')}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 4px' }}>{n.message}</div>
                  <div className="notif-meta">{timeAgo(n.createdAt)}</div>
                </div>
                {!n.isRead && <div className="notif-dot" title="Unread" />}
              </div>
            ))}
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </Layout>
  );
};

export default Notifications;
