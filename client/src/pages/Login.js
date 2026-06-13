import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/ui/PasswordInput';
import BixianLogo from '../assets/logo/BixianLogo.png';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      const { role } = data.user;
      if (role === 'superadmin') navigate('/superadmin/dashboard');
      else if (role === 'owner') navigate('/owner/dashboard');
      else navigate('/dashboard');
      toast.success(`Welcome back, ${data.user.name}!`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Nav */}
      <div style={styles.topNav}>
        <div style={styles.topNavBrand}>
          <div style={styles.logoIcon}><img src={BixianLogo} alt="Bixian" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
          <span style={styles.logoText}>Bixian CRM</span>
        </div>
        <div style={styles.topNavActions}>
          <Link to="/pricing" style={styles.navLink}>Plans</Link>
          <Link to="/register" style={styles.navRegisterBtn}>Register</Link>
        </div>
      </div>

      <div style={styles.box}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}><img src={BixianLogo} alt="Bixian" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
          <h1 style={styles.logoText}>Bixian CRM</h1>
          <p style={styles.logoSub}>Digital Marketing Management Platform</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-control" type="email" placeholder="yourname@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <PasswordInput className="form-control" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="current-password" />
          </div>
          <button className={`btn btn-primary${loading ? ' btn-loading' : ''}`} type="submit" disabled={loading} style={{ width: '100%', padding: '12px', fontSize: 14, marginTop: 8, justifyContent: 'center' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
          <Link to="/forgot-password" style={{ color: '#e94560', textDecoration: 'none' }}>Forgot your password?</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#3a3a5c' }}>
          Secure multi-tenant CRM platform
        </p>
      </div>
      <style>{`
        .form-control { background: #0a0a17 !important; }
      `}</style>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', background: '#0d0d1a' },
  topNav: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', borderBottom: '1px solid #1e1e3a', boxSizing: 'border-box' },
  topNavBrand: { display: 'flex', alignItems: 'center', gap: 10 },
  topNavActions: { display: 'flex', alignItems: 'center', gap: 12 },
  navLink: { color: '#9ca3af', fontSize: 14, textDecoration: 'none', padding: '8px 14px', borderRadius: 8 },
  navRegisterBtn: { background: 'linear-gradient(135deg, #e94560, #7c3aed)', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', padding: '8px 18px', borderRadius: 8 },
  box: { width: '100%', maxWidth: 400, background: '#12121f', border: '1px solid #1e1e3a', borderRadius: 16, padding: 40, margin: 'auto' },
  logo: { textAlign: 'center', marginBottom: 32 },
  logoIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  logoText: { fontSize: 22, fontWeight: 700, color: '#e2e2f0', marginBottom: 6 },
  logoSub: { fontSize: 13, color: '#6b7280' },
};

export default Login;
