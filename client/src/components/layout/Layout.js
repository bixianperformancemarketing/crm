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
    { to: '/owner/notifications', icon: '🔔', label: 'Notifications' },
    { to: '/owner/settings', icon: '⚙️', label: 'Settings' },
  ],
  admin: [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/leads', icon: '👥', label: 'Leads' },
    { to: '/pipeline', icon: '🔄', label: 'Pipeline' },
    { to: '/followups', icon: '📞', label: 'Followups' },
    { to: '/appointments', icon: '📅', label: 'Appointments' },
    { to: '/quotations', icon: '📋', label: 'Quotations' },
    { to: '/invoices', icon: '🧾', label: 'Invoices' },
    { to: '/payments', icon: '💰', label: 'Payments' },
    { to: '/content', icon: '✅', label: 'Tasks', feature: 'canUseContentCalendar' },
    { to: '/reports', icon: '📈', label: 'Reports', feature: 'canUseAdvancedReports' },
    { to: '/users', icon: '👤', label: 'Users' },
    { to: '/notifications', icon: '🔔', label: 'Notifications' },
    { to: '/settings', icon: '⚙️', label: 'Settings' },
  ],
  employee: [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/leads', icon: '👥', label: 'My Leads', assignType: 'leads' },
    { to: '/pipeline', icon: '🔄', label: 'Pipeline', assignType: 'leads' },
    { to: '/followups', icon: '📞', label: 'Followups', assignType: 'leads' },
    { to: '/appointments', icon: '📅', label: 'Appointments', assignType: 'leads' },
    { to: '/quotations', icon: '📋', label: 'Quotations', assignType: 'leads' },
    { to: '/invoices', icon: '🧾', label: 'Invoices', assignType: 'leads' },
    { to: '/content', icon: '✅', label: 'Tasks', feature: 'canUseContentCalendar', assignType: 'tasks' },
    { to: '/notifications', icon: '🔔', label: 'Notifications' },
  ],
};

const Layout = ({ children, title }) => {
  const { user, org, workspace, logout, hasFeature } = useAuth();
  const { unreadCount, resetUnread } = useSocket();
  const [collapsed, setCollapsed] = useState(window.innerWidth < 860);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notifRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const role = user?.role;
  const navItems = (NAV_ITEMS[role] || []).filter((item) => {
    if (item.feature && !hasFeature(item.feature)) return false;
    if (item.assignType && user?.assignType && user.assignType !== item.assignType) return false;
    return true;
  });
  const initials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">CRM</div>
          {!collapsed && <span className="logo-text">{org?.name || 'Agency CRM'}</span>}
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            {!collapsed && <div className="nav-section-title">Navigation</div>}
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title={collapsed ? item.label : undefined}>
                <span className="nav-icon">{item.icon}</span>
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{initials}</div>
            {!collapsed && (
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
          <h1 className="header-title">{pageTitle}</h1>
          <div className="header-actions">
            {workspace && !collapsed && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: '6px' }}>
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
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
