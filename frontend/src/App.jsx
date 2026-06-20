import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';

import { Mail, BookOpen, LogOut, Bell, Menu, X } from 'lucide-react';
import { SocketProvider, useSocket } from './context/SocketContext';
import NotificationsDropdown from './components/NotificationsDropdown';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global socket listener to handle invites
  const GlobalSocketListener = () => {
    const socket = useSocket();
    useEffect(() => {
      if (!socket) return;
      
      const handleInvite = ({ roomId, roomName, hostName }) => {
        setGlobalInvite({ roomId, roomName, hostName });
      };

      socket.on('room-invite-received', handleInvite);
      return () => socket.off('room-invite-received', handleInvite);
    }, [socket]);
    return null;
  };

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
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--color-bg-deep)' }}>
          <div className="loader-spinner" style={{ marginBottom: '24px' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BookOpen size={32} color="var(--color-accent)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-title)', margin: 0, letterSpacing: '-0.02em' }}>
              StudySync<span style={{ color: 'var(--color-accent)' }}>.</span>
            </h1>
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '1rem', marginTop: '12px', fontWeight: 500, opacity: 0.8, animation: 'pulseGlow 2s infinite' }}>
            Preparing your workspace...
          </div>
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
    <SocketProvider user={user}>
      <Router>
        <GlobalSocketListener />
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
          <div className="container" style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link to="/" className="navbar-brand" style={{ textDecoration: 'none' }}>
              <span>StudySync</span>
              <span style={{ fontSize: '0.75rem', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', color: '#fff', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold', boxShadow: '0 2px 10px rgba(99,102,241,0.3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                2.0
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="nav-links desktop-nav">
              <Link to="/" className="nav-link">Features</Link>
              {user ? (
                <>
                  <Link to="/dashboard" className="nav-link">Dashboard</Link>
                  <NotificationsDropdown />
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

            {/* Mobile Hamburger Toggle */}
            <button 
              type="button"
              className="mobile-menu-btn" 
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-title)' }}
              onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(!isMobileMenuOpen); }}
            >
              {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>

            {/* Mobile Navigation Drawer */}
            {isMobileMenuOpen && (
              <div className="mobile-drawer">
                <Link to="/" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>Features</Link>
                {user ? (
                  <>
                    <Link to="/dashboard" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>Dashboard</Link>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px dashed var(--color-border-glass)', paddingBottom: '8px' }}>
                      <span className="nav-link" style={{ border: 'none', padding: 0 }}>Notifications</span>
                      <NotificationsDropdown />
                    </div>
                    <button onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)', textAlign: 'left' }}>
                      <LogOut size={18} /> Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>Sign In</Link>
                    <Link to="/register" className="btn btn-primary" style={{ marginTop: '10px' }} onClick={() => setIsMobileMenuOpen(false)}>
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Main Pages Router */}
        <main style={{ minHeight: 'calc(100vh - 70px)' }}>
          <Routes>
            <Route path="/" element={<Landing currentUser={user} />} />
            <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to="/dashboard" replace />} />
            <Route path="/register" element={!user ? <Register setUser={setUser} /> : <Navigate to="/dashboard" replace />} />
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
    </SocketProvider>
  );
}

export default App;
