import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { notificationsAPI } from '../../services/api';
import { timeAgo } from '../../utils/helpers';
import './Layout.css';

const NAV_ITEMS = {
  superadmin: [
    { to: '/superadmin/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/superadmin/organizations', icon: '🏢', label: 'Organizations' },
    { to: '/superadmin/plans', icon: '💎', label: 'Plans' },
  ],
  owner: [
    { to: '/owner/dashboard', icon: '📊', label: 'Overview' },
    { to: '/owner/workspaces', icon: '🏗️', label: 'Workspaces' },
    { to: '/owner/users', icon: '👥', label: 'Users' },
    { to: '/leads', icon: '🎯', label: 'Leads' },
    { to: '/pipeline', icon: '🔄', label: 'Pipeline' },
    { to: '/followups', icon: '📞', label: 'Followups' },
    { to: '/appointments', icon: '📅', label: 'Appointments', feature: 'canUseAppointments' },
    { to: '/quotations', icon: '📋', label: 'Quotations', feature: 'canUseQuotations' },
    { to: '/invoices', icon: '🧾', label: 'Invoices', feature: 'canUseInvoices' },
    { to: '/payments', icon: '💰', label: 'Payments', feature: 'canUseInvoices' },
    { to: '/content', icon: '✅', label: 'Tasks', feature: 'canUseContentCalendar' },
    { to: '/reports', icon: '📈', label: 'Reports', feature: 'canUseAdvancedReports' },
    { to: '/team-activity', icon: '🕵️', label: 'Team Activity' },
    { to: '/owner/notifications', icon: '🔔', label: 'Notifications' },
    { to: '/owner/settings', icon: '⚙️', label: 'Settings' },
  ],
  admin: [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/leads', icon: '👥', label: 'Leads' },
    { to: '/pipeline', icon: '🔄', label: 'Pipeline' },
    { to: '/followups', icon: '📞', label: 'Followups' },
    { to: '/appointments', icon: '📅', label: 'Appointments', feature: 'canUseAppointments' },
    { to: '/quotations', icon: '📋', label: 'Quotations', feature: 'canUseQuotations' },
    { to: '/invoices', icon: '🧾', label: 'Invoices', feature: 'canUseInvoices' },
    { to: '/payments', icon: '💰', label: 'Payments', feature: 'canUseInvoices' },
    { to: '/content', icon: '✅', label: 'Tasks', feature: 'canUseContentCalendar' },
    { to: '/reports', icon: '📈', label: 'Reports', feature: 'canUseAdvancedReports' },
    { to: '/team-activity', icon: '🕵️', label: 'Team Activity' },
    { to: '/users', icon: '👤', label: 'Users' },
    { to: '/notifications', icon: '🔔', label: 'Notifications' },
    { to: '/settings', icon: '⚙️', label: 'Settings' },
  ],
  employee: [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/leads', icon: '👥', label: 'My Leads' },
    { to: '/pipeline', icon: '🔄', label: 'Pipeline' },
    { to: '/followups', icon: '📞', label: 'Followups' },
    { to: '/appointments', icon: '📅', label: 'Appointments', feature: 'canUseAppointments' },
    { to: '/quotations', icon: '📋', label: 'Quotations', feature: 'canUseQuotations' },
    { to: '/invoices', icon: '🧾', label: 'Invoices', feature: 'canUseInvoices' },
    { to: '/content', icon: '✅', label: 'Tasks', feature: 'canUseContentCalendar' },
    { to: '/notifications', icon: '🔔', label: 'Notifications' },
  ],
};

const Layout = ({ children, title }) => {
  const { user, org, workspace, logout, hasFeature } = useAuth();
  const { unreadCount, resetUnread } = useSocket();
  const [collapsed, setCollapsed] = useState(window.innerWidth < 900);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('crm-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    return saved;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('crm-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  const [notifications, setNotifications] = useState([]);
  const notifRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const role = user?.role;
  const navItems = (NAV_ITEMS[role] || []).filter((item) => {
    if (item.feature && !hasFeature(item.feature)) return false;
    return true;
  });
  const initials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 600) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const openNotifs = async () => {
    setShowNotifs((s) => !s);
    if (!showNotifs) {
      try {
        const { data } = await notificationsAPI.getRecent();
        setNotifications(data.notifications || []);
      } catch {}
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      resetUnread();
      setNotifications((ns) => ns.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

  const pageTitle = title || location.pathname.split('/').pop()?.replace(/-/g, ' ') || 'Dashboard';

  return (
    <div className="layout">
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">CRM</div>
          {(!collapsed || mobileOpen) && <span className="logo-text">{org?.name || 'Bixian CRM'}</span>}
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            {(!collapsed || mobileOpen) && <div className="nav-section-title">Navigation</div>}
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title={collapsed && !mobileOpen ? item.label : undefined} onClick={() => setMobileOpen(false)}>
                <span className="nav-icon">{item.icon}</span>
                {(!collapsed || mobileOpen) && <span className="nav-label">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{initials}</div>
            {(!collapsed || mobileOpen) && (
              <div className="user-info">
                <div className="user-name">{user?.name}</div>
                <div className="user-role">{user?.label || user?.role}</div>
              </div>
            )}
          </div>
          <button className="sidebar-collapse-btn" onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? '→' : '←'}
          </button>
        </div>
      </aside>

      <div className={`main-content${collapsed ? ' collapsed' : ''}`}>
        <header className="header">
          <button className="hamburger-btn" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
            <span /><span /><span />
          </button>
          <h1 className="header-title">{pageTitle}</h1>
          <div className="header-actions">
            {workspace && !collapsed && (
              <span className="workspace-label">
                {workspace.name}
              </span>
            )}
            <div className="notif-dropdown-wrap" ref={notifRef}>
              <button className="notif-btn" onClick={openNotifs} aria-label="Notifications">
                🔔
                {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {showNotifs && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <h4>Notifications</h4>
                    {unreadCount > 0 && <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No notifications</div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={`notif-item${!n.isRead ? ' unread' : ''}`} onClick={() => { navigate(role === 'owner' ? '/owner/notifications' : '/notifications'); setShowNotifs(false); }}>
                          <div className="notif-item-title">{n.title}</div>
                          <div className="notif-item-msg">{n.message}</div>
                          <div className="notif-item-time">{timeAgo(n.createdAt)}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="notif-footer">
                    <button className="btn btn-ghost btn-sm" onClick={() => { navigate(role === 'owner' ? '/owner/notifications' : '/notifications'); setShowNotifs(false); }}>View All</button>
                  </div>
                </div>
              )}
            </div>
            <button className="theme-toggle-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </div>
        </header>
        {role === 'admin' && org?.settings && !org.settings?.smtp?.host && (
          <div style={{ background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.25)', padding: '8px 20px', fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>⚠️ <strong>SMTP not configured</strong> — email features (quotations, invoices, lead emails) are disabled until you set up SMTP.</span>
            <button onClick={() => navigate('/settings?tab=smtp')} style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Set up now →
            </button>
          </div>
        )}
        <main className="page">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
