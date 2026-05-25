import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import PasswordInput from '../components/ui/PasswordInput';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      return toast.error('Passwords do not match');
    }
    if (form.newPassword.length < 8) {
      return toast.error('Password must be at least 8 characters');
    }
    setLoading(true);
    try {
      await authAPI.resetPassword({ token, newPassword: form.newPassword });
      setDone(true);
      toast.success('Password reset successfully!');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>CRM</div>
          <h1 style={styles.logoText}>New Password</h1>
          <p style={styles.logoSub}>Choose a strong password for your account</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>Password updated!</div>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24 }}>Redirecting to login...</p>
            <Link to="/login" style={{ color: '#e94560', fontSize: 13, textDecoration: 'none' }}>Go to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <PasswordInput
                className="form-control"
                placeholder="Min. 8 characters"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                required
                minLength={8}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <PasswordInput
                className="form-control"
                placeholder="Repeat your new password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
              />
            </div>
            <button
              className={`btn btn-primary${loading ? ' btn-loading' : ''}`}
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: 14, marginTop: 8, justifyContent: 'center' }}
            >
              {loading ? 'Resetting...' : 'Set New Password'}
            </button>
            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
              <Link to="/login" style={{ color: '#e94560', textDecoration: 'none' }}>← Back to Login</Link>
            </p>
          </form>
        )}
      </div>
      <style>{`.form-control { background: #0a0a17 !important; }`}</style>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d1a' },
  box: { width: '100%', maxWidth: 400, background: '#12121f', border: '1px solid #1e1e3a', borderRadius: 16, padding: 40 },
  logo: { textAlign: 'center', marginBottom: 32 },
  logoIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, background: 'linear-gradient(135deg, #e94560, #7c3aed)', borderRadius: 14, fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 12 },
  logoText: { fontSize: 22, fontWeight: 700, color: '#e2e2f0', marginBottom: 6 },
  logoSub: { fontSize: 13, color: '#6b7280' },
};

export default ResetPassword;
