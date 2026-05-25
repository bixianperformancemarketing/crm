import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './SuperAdminLayout.css';

const SuperAdminLayout = ({ children, title }) => {
  const { logout, user } = useAuth();
  return (
    <div className="sa-layout">
      <aside className="sa-sidebar">
        <div className="sa-logo">
          <h2>⚡ Platform Admin</h2>
          <div className="sa-tag">Super Admin Panel</div>
        </div>
        <nav className="sa-nav">
          <NavLink to="/superadmin/dashboard">📊 Dashboard</NavLink>
          <NavLink to="/superadmin/organizations">🏢 Organizations</NavLink>
          <NavLink to="/superadmin/plans">💎 Plans</NavLink>
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1a1a2e' }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{user?.email}</div>
          <button className="btn btn-ghost btn-sm" onClick={logout} style={{ width: '100%' }}>Logout</button>
        </div>
      </aside>
      <div className="sa-main">
        <header className="sa-header">
          <h1>{title || 'Platform Admin'}</h1>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;
