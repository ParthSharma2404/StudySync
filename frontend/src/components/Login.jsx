import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResendStatus('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendStatus('sending');
    setResendMessage('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResendStatus('sent');
      setResendMessage(data.message);
    } catch (err) {
      setResendStatus('error');
      setResendMessage(err.message || 'Failed to send email.');
    }
  };

  const showResendButton = error && error.toLowerCase().includes('verify your email');

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 120px)' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '8px', textAlign: 'center' }}>Welcome Back</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '28px', textAlign: 'center' }}>
          Sign in to access your dashboard and study rooms.
        </p>

        {error && (
          <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem' }}>
            {error}
            {showResendButton && (
              <div style={{ marginTop: '10px' }}>
                {resendStatus === 'sent' ? (
                  <span style={{ color: '#10b981', fontWeight: 600 }}>✓ {resendMessage}</span>
                ) : resendStatus === 'error' ? (
                  <div>
                    <span style={{ color: '#f59e0b', fontWeight: 600, display: 'block', marginBottom: '6px' }}>⚠ {resendMessage}</span>
                    <button
                      onClick={handleResendVerification}
                      style={{
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: '#818cf8',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleResendVerification}
                    disabled={resendStatus === 'sending'}
                    style={{
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: '#818cf8',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}
                  >
                    {resendStatus === 'sending' ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--color-text-title)', fontWeight: '500' }}>Register here</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
