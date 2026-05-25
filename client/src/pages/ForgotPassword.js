import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      setSent(true);
    } catch {
      toast.error('Failed to send reset email. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>CRM</div>
          <h1 style={styles.logoText}>Reset Password</h1>
          <p style={styles.logoSub}>Enter your email to receive a reset link</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>Check your email</div>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24, lineHeight: 1.6 }}>
              If <strong style={{ color: '#e2e2f0' }}>{email}</strong> is registered, a reset link has been sent. Check your inbox and spam folder.
            </p>
            <Link to="/login" style={{ color: '#e94560', fontSize: 13, textDecoration: 'none' }}>← Back to Login</Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  className="form-control"
                  type="email"
                  placeholder="you@agency.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <button
                className={`btn btn-primary${loading ? ' btn-loading' : ''}`}
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '12px', fontSize: 14, marginTop: 8, justifyContent: 'center' }}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>
              <Link to="/login" style={{ color: '#e94560', textDecoration: 'none' }}>← Back to Login</Link>
            </p>
          </>
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

export default ForgotPassword;
