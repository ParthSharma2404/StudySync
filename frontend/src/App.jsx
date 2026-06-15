import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Mail, BookOpen, LogOut } from 'lucide-react';
import io from 'socket.io-client';
import Landing from './components/Landing';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import StudyRoom from './components/StudyRoom';
import { fetchApi } from './utils/api';

function App() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [globalInvite, setGlobalInvite] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetchApi('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    };
    checkAuth();

    const handleAuthFailed = () => setUser(null);
    window.addEventListener('auth-failed', handleAuthFailed);
    return () => window.removeEventListener('auth-failed', handleAuthFailed);
  }, []);

  // Global Socket connection for invitations
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Connect global socket
    socketRef.current = io('http://localhost:5000', {
      withCredentials: true
    });

    // Identify user to register online presence
    socketRef.current.emit('identify', {
      userId: user.id,
      username: user.username
    });

    // Listen for room invitations
    socketRef.current.on('room-invite-received', ({ roomId, roomName, hostName }) => {
      setGlobalInvite({ roomId, roomName, hostName });
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user]);

  const handleAcceptInvite = (roomId) => {
    setGlobalInvite(null);
    window.location.href = `/room/${roomId}`;
  };

  const handleDeclineInvite = () => {
    setGlobalInvite(null);
  };

  // Protected route wrapper
  const ProtectedRoute = ({ children }) => {
    if (loadingUser) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0b0c10' }}>
          <div style={{ color: '#8b5cf6', fontSize: '1.2rem', fontWeight: 600 }}>Loading StudySync...</div>
        </div>
      );
    }
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  const handleLogout = async () => {
    try {
      await fetchApi('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <Router>
      {/* Global Invite Pop-up Modal */}
      {globalInvite && (
        <div style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 9999, width: '360px' }}>
          <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid var(--color-primary)', background: '#12131a', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            <h4 style={{ color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={16} /> <span>Room Invitation</span>
            </h4>
            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '8px', lineHeight: '1.4' }}>
              <strong>{globalInvite.hostName}</strong> has invited you to join the study room <strong>"{globalInvite.roomName}"</strong>.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button onClick={handleDeclineInvite} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                Decline
              </button>
              <button onClick={() => handleAcceptInvite(globalInvite.roomId)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', textShadow: 'none' }}>
                Join Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="container" style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
          <Link to="/" className="navbar-brand" style={{ textDecoration: 'none' }}>
            <span>StudySync</span>
            <span style={{ fontSize: '0.75rem', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', color: '#fff', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold', boxShadow: '0 2px 10px rgba(99,102,241,0.3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Beta
            </span>
          </Link>

          <div className="nav-links">
            <Link to="/" className="nav-link">Features</Link>
            {user ? (
              <>
                <Link to="/dashboard" className="nav-link">Dashboard</Link>
                <button onClick={handleLogout} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)' }}>
                  <LogOut size={16} /> <span className="hide-on-mobile">Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" style={{ fontSize: '0.9rem', fontWeight: '500' }}>Sign In</Link>
                <Link to="/register" style={{ padding: '8px 16px', fontSize: '0.9rem', fontWeight: '600', background: '#2b2b2b', color: '#fff', borderRadius: '8px', textDecoration: 'none' }}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Pages Router */}
      <main style={{ minHeight: 'calc(100vh - 70px)' }}>
        <Routes>
          <Route path="/" element={<Landing currentUser={user} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard currentUser={user} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/room/:roomId" 
            element={
              <ProtectedRoute>
                <StudyRoom currentUser={user} />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
