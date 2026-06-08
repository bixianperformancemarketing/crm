import React, { useEffect, useState } from 'react';
import { reportsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const Metric = ({ label, value, color }) => (
  <div style={{
    background: 'var(--surface)',
    border: `1px solid ${color}33`,
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  }}>
    <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1.3 }}>{label}</div>
  </div>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
    {children}
  </div>
);

const LoginSummaryModal = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!user || !['admin', 'employee', 'owner'].includes(user.role)) return;
    const key = `briefingShown_${user.id}`;
    if (sessionStorage.getItem(key)) return;
    reportsAPI.getLoginSummary()
      .then(({ data }) => {
        sessionStorage.setItem(key, '1');
        setSummary(data.summary);
        setOpen(true);
      })
      .catch(() => {});
  }, [user]);

  if (!open || !summary) return null;

  const canAccessLeads = user?.role !== 'employee' || user?.canAccessLeads !== false;
  const canUseTasks = user?.role !== 'employee' || !!user?.canUseContentCalendar;

  const overdueFollowups        = summary.overdueFollowups        || [];
  const todayFollowups          = summary.todayFollowups          || [];
  const completedFollowupsToday = summary.completedFollowupsToday ?? 0;
  const activeLeads             = summary.activeLeads             ?? 0;
  const newLeads                = summary.newLeads                ?? 0;
  const convertedToday          = summary.convertedToday          || [];
  const pendingQuotations       = summary.pendingQuotations       ?? 0;
  const todayAppointments       = summary.todayAppointments       || [];
  const totalTasks              = summary.totalTasks              ?? 0;
  const pendingTasks            = summary.pendingTasks            ?? 0;
  const inProgressTasks         = summary.inProgressTasks         ?? 0;
  const reviewTasks             = summary.reviewTasks             ?? 0;
  const doneTasks               = summary.doneTasks               ?? 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)} style={{ zIndex: 1100 }}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setOpen(false)}>×</button>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            {greeting()}, {user.name?.split(' ')[0]}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {user.role === 'owner' ? "Here's your organisation's daily summary" : "Here's your daily summary"}
          </div>
        </div>

        {canAccessLeads && (
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Leads & Followups</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <Metric label="Overdue Followups" value={overdueFollowups.length} color="#ef4444" />
              <Metric label="Followups Today" value={todayFollowups.length} color="#f59e0b" />
              <Metric label="Completed Today" value={completedFollowupsToday} color="#10b981" />
              <Metric label="Active Leads" value={activeLeads} color="#6366f1" />
              <Metric label="New Leads" value={newLeads} color="#10b981" />
              <Metric label="Converted Today" value={convertedToday.length} color="#10b981" />
              <Metric label="Pending Quotations" value={pendingQuotations} color="#f59e0b" />
              <Metric label="Appointments Today" value={todayAppointments.length} color="#6366f1" />
            </div>
          </div>
        )}

        {canUseTasks && (
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Tasks</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <Metric label="Total Tasks" value={totalTasks} color="#a78bfa" />
              <Metric label="Pending" value={pendingTasks} color="#f59e0b" />
              <Metric label="In Progress" value={inProgressTasks} color="#0ea5e9" />
              <Metric label="In Review" value={reviewTasks} color="#7c3aed" />
              <Metric label="Done" value={doneTasks} color="#22c55e" />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => setOpen(false)}>Let's go</button>
        </div>
      </div>
    </div>
  );
};

export default LoginSummaryModal;
