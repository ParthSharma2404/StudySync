import { fetchApi } from '../utils/api';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Flame, Clock, Award, Users, BookOpen, GraduationCap, X, LogOut, Target, BarChart2, TrendingUp, Info, CheckCircle2, UserPlus, Check, X as XIcon } from 'lucide-react';
import io from 'socket.io-client';

const mockStudyData = [
  { day: 'Mon', hours: 2.5 },
  { day: 'Tue', hours: 3.2 },
  { day: 'Wed', hours: 1.5 },
  { day: 'Thu', hours: 4.0 },
  { day: 'Fri', hours: 2.8 },
  { day: 'Sat', hours: 5.5 },
  { day: 'Sun', hours: 3.0 },
];
const maxHours = Math.max(...mockStudyData.map(d => d.hours));

function Dashboard() {
  const [data, setData] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [showLevelInfo, setShowLevelInfo] = useState(false);
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [friendError, setFriendError] = useState('');
  const [friendSuccess, setFriendSuccess] = useState('');
  const [onlineFriends, setOnlineFriends] = useState([]);
  const navigate = useNavigate();

  

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        // Fetch User profile & badges
        const dashResponse = await fetchApi('/api/user/dashboard', {
          
        });
        if (!dashResponse.ok) throw new Error('Failed to load profile.');
        const dashData = await dashResponse.json();
        setData(dashData);

        // Fetch Study Rooms
        const roomsResponse = await fetchApi('/api/rooms', {
          
        });
        if (!roomsResponse.ok) throw new Error('Failed to load rooms.');
        const roomsData = await roomsResponse.json();
        setRooms(roomsData);

        // Fetch Friends
        const friendsResponse = await fetchApi('/api/friends', {
          
        });
        if (friendsResponse.ok) {
          const friendsData = await friendsResponse.json();
          setFriends(friendsData.friends);
          setIncomingRequests(friendsData.incomingRequests);
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (!data?.user) return;
    const socket = io();
    socket.emit('identify', { userId: data.user.id, username: data.user.username });
    
    socket.on('online-users-updated', (users) => {
      setOnlineFriends(users.map(u => u.userId));
    });

    socket.on('friend-request-received', async () => {
      const res = await fetchApi('/api/friends', {  });
      if (res.ok) {
        const d = await res.json();
        setIncomingRequests(d.incomingRequests);
      }
    });
    
    socket.on('friend-request-accepted', async () => {
      const res = await fetchApi('/api/friends', {  });
      if (res.ok) {
        const d = await res.json();
        setFriends(d.friends);
      }
    });

    return () => socket.disconnect();
  }, [data?.user]);

  const handleSendFriendRequest = async (e) => {
    e.preventDefault();
    setFriendError('');
    setFriendSuccess('');
    if (!friendUsername) return;
    try {
      const res = await fetchApi('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername: friendUsername })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to send request');
      setFriendSuccess('Request sent!');
      setFriendUsername('');
    } catch(err) {
      setFriendError(err.message);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await fetchApi('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      const res = await fetchApi('/api/friends', {  });
      const d = await res.json();
      setFriends(d.friends);
      setIncomingRequests(d.incomingRequests);
    } catch(err) { console.error(err); }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await fetchApi('/api/friends/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      setIncomingRequests(prev => prev.filter(r => r.request_id !== requestId));
    } catch(err) { console.error(err); }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setError('');

    if (!newRoomName) return;

    try {
      const response = await fetchApi('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newRoomName, description: newRoomDesc })
      });
      const roomData = await response.json();

      if (!response.ok) {
        throw new Error(roomData.error || 'Failed to create room.');
      }

      setNewRoomName('');
      setNewRoomDesc('');
      navigate(`/room/${roomData.roomId}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 120px)' }}>
        <h2 style={{ color: '#8b5cf6' }}>Loading your dashboard...</h2>
      </div>
    );
  }

  const { user } = data || {};
  const totalHours = user ? (user.total_study_seconds / 3600).toFixed(1) : '0.0';

  const userXp = user?.xp || 0;
  const currentLevel = Math.floor(userXp / 100) + 1;
  const xpIntoCurrentLevel = userXp % 100;
  const levelProgressPercent = (xpIntoCurrentLevel / 100) * 100;

  const getRankInfo = (level) => {
    if (level < 10) return { title: 'Novice', icon: BookOpen, color: '#6366f1' };
    if (level < 25) return { title: 'Scholar', icon: GraduationCap, color: '#8b5cf6' };
    if (level < 50) return { title: 'Master', icon: Target, color: '#f43f5e' };
    return { title: 'Legend', icon: Flame, color: '#f59e0b' };
  };
  const currentRank = getRankInfo(currentLevel);

  return (
    <div className="container dashboard-container pro-font" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
      {/* Top Welcome Bar */}
      <div className="welcome-header hide-on-mobile" style={{ marginBottom: '40px' }}>
        <h1 style={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-title)', lineHeight: '1.2' }}>
          Welcome back,<br className="mobile-break" /> {user?.username || 'Learner'}.
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '8px' }}>
          Ready to resume your objectives and crush your goals?
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '8px', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      <div className="dashboard-grid">
        {/* Left Column: Profile Card & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="pro-panel profile-card" style={{ padding: '32px 24px', background: 'linear-gradient(180deg, var(--color-bg-slate) 0%, var(--color-bg-deep) 100%)' }}>
            <div style={{ position: 'relative', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
              <div className="avatar-ring" style={{ width: '96px', height: '96px', background: 'rgba(99, 102, 241, 0.1)', borderColor: 'rgba(99, 102, 241, 0.2)', margin: 0 }}>
                <div className="avatar-inner" style={{ color: '#818cf8' }}>
                  <GraduationCap size={40} />
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', color: '#fff', fontSize: '0.85rem', fontWeight: 800, padding: '4px 14px', borderRadius: '50px', border: '3px solid var(--color-bg-slate)', boxShadow: '0 4px 10px rgba(99, 102, 241, 0.4)', textShadow: '0 1px 2px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
                Lv {currentLevel}
              </div>
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-title)' }}>{user?.username}</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>{user?.email}</p>

            <div className="streak-badge" style={{ color: '#fbbf24', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '6px 16px', borderRadius: '50px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 600, margin: '20px 0' }}>
              <Flame size={16} /> {user?.current_streak} Day Streak
            </div>

            <div style={{ borderTop: '1px solid var(--color-border-glass)', width: '100%', marginTop: '8px', paddingTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Best Streak</p>
                <h4 style={{ color: 'var(--color-text-title)', fontSize: '1.4rem', fontWeight: 700, marginTop: '6px' }}>{user?.longest_streak}d</h4>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px solid var(--color-border-glass)' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total XP</p>
                <h4 style={{ color: 'var(--color-text-title)', fontSize: '1.4rem', fontWeight: 700, marginTop: '6px' }}>{userXp}</h4>
              </div>
            </div>
          </div>

          {/* Workspaces Panel */}
          <div className="pro-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-title)' }}>
              <Target size={20} color="#6366f1" /> Workspaces
            </h3>

            {/* Solo Focus */}
            <div style={{ background: 'rgba(99, 102, 241, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
              <h4 style={{ fontSize: '1.05rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <BookOpen size={16} /> Private Workspace
              </h4>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '16px' }}>
                Enter an isolated terminal to track personal timers and complete local objectives.
              </p>
              <Link to="/room/solo-focus" className="pro-btn pro-btn-primary" style={{ width: '100%', padding: '10px', fontSize: '0.9rem' }}>
                Launch Private Workspace
              </Link>
            </div>

            {/* Create Room Form */}
            <div style={{ borderTop: '1px dashed var(--color-border-glass)', paddingTop: '24px' }}>
              <h4 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--color-text-title)' }}>
                <Users size={16} color="#a1a1aa" /> Create Group Room
              </h4>
              <form onSubmit={handleCreateRoom}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Room Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="e.g. Study Group"
                    required
                    style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Description</label>
                  <textarea
                    className="form-input"
                    value={newRoomDesc}
                    onChange={(e) => setNewRoomDesc(e.target.value)}
                    placeholder="Optional details"
                    rows="2"
                    style={{ resize: 'none', fontSize: '0.85rem', padding: '8px 12px' }}
                  />
                </div>
                <button type="submit" className="pro-btn pro-btn-secondary" style={{ width: '100%', padding: '10px', fontSize: '0.9rem' }}>
                  Deploy Room
                </button>
              </form>
            </div>
          </div>

          {/* Live Social Panel */}
          <div className="pro-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-title)' }}>
              <Users size={18} color="#6366f1" /> Live Social
            </h3>

            {/* Add Friend Form */}
            <form onSubmit={handleSendFriendRequest} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input type="text" className="form-input" placeholder="Add by username..." value={friendUsername} onChange={e => setFriendUsername(e.target.value)} style={{ padding: '8px 12px', fontSize: '0.85rem' }} />
              <button type="submit" className="pro-btn pro-btn-primary" style={{ padding: '8px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}><UserPlus size={16} /> Add</button>
            </form>
            {friendError && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '-8px' }}>{friendError}</div>}
            {friendSuccess && <div style={{ color: '#10b981', fontSize: '0.8rem', marginTop: '-8px' }}>{friendSuccess}</div>}

            {/* Incoming Requests */}
            {incomingRequests.length > 0 && (
              <div style={{ background: 'rgba(245, 158, 11, 0.05)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fbbf24', marginBottom: '8px' }}>Friend Requests</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {incomingRequests.map(req => (
                    <div key={req.request_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg-slate)', padding: '8px 12px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-title)' }}>{req.username}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleAcceptRequest(req.request_id)} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '4px', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}><Check size={14} /></button>
                        <button onClick={() => handleRejectRequest(req.request_id)} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '4px', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}><XIcon size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {friends.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '20px 0' }}>No friends added yet.</div>
              ) : (
                friends.map(friend => {
                  const isOnline = onlineFriends.includes(friend.id);
                  return (
                    <div key={friend.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', transition: 'all 0.2s ease' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ position: 'relative' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                            <Users size={20} color="#818cf8" />
                          </div>
                          <div style={{ position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', color: '#fff', fontSize: '0.65rem', fontWeight: 'bold', padding: '1px 6px', borderRadius: '50px', border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', whiteSpace: 'nowrap' }}>
                            Lv {Math.floor((friend.xp || 0) / 100) + 1}
                          </div>
                          <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '10px', height: '10px', borderRadius: '50%', background: isOnline ? '#10b981' : '#9ca3af', border: '2px solid #fff' }}></div>
                        </div>
                        <div style={{ marginLeft: '6px' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-title)' }}>{friend.username}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{isOnline ? 'Online' : 'Offline'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Analytics, Badges, and Room Directory */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Analytics Stats cards */}
          <div className="stats-row" style={{ gap: '24px' }}>
            {/* Card 1: Total Focus Time */}
            <div className="pro-panel stat-card feature-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
              {/* Background Watermark Icon */}
              <Clock size={120} color="rgba(99, 102, 241, 0.04)" style={{ position: 'absolute', right: '-20px', bottom: '-20px', transform: 'rotate(-15deg)', pointerEvents: 'none' }} />
              
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="stat-header" style={{ color: '#818cf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}><Clock size={16} /> Total Focus Time</div>
                <h3 className="stat-num" style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-text-title)', margin: '12px 0 16px 0' }}>
                  {totalHours} <span style={{fontSize: '1.2rem', color: 'var(--color-text-muted)', fontWeight: 600}}>hrs</span>
                </h3>
                <div style={{ marginTop: 'auto', fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <TrendingUp size={16} /> +2.4 hrs this week
                </div>
              </div>
            </div>

            {/* Card 2: Current Level */}
            <div className="pro-panel stat-card feature-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(239, 68, 68, 0.05) 100%)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
              <Flame size={120} color="rgba(245, 158, 11, 0.04)" style={{ position: 'absolute', right: '-20px', bottom: '-20px', transform: 'rotate(10deg)', pointerEvents: 'none' }} />
              
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="stat-header" style={{ color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}><Target size={16} /> Current Rank</div>
                <h3 className="stat-num" style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-text-title)', margin: '12px 0 16px 0' }}>
                  Level {currentLevel}
                </h3>
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)' }}>
                    <div style={{ width: `${levelProgressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #fbbf24, #f59e0b)', borderRadius: '4px' }}></div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{100 - xpIntoCurrentLevel} XP to Level {currentLevel + 1}</div>
                </div>
              </div>
            </div>

            {/* Card 3: Active Rooms */}
            <div className="pro-panel stat-card feature-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(52, 211, 153, 0.05) 100%)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
              <Users size={120} color="rgba(16, 185, 129, 0.04)" style={{ position: 'absolute', right: '-20px', bottom: '-20px', transform: 'rotate(-10deg)', pointerEvents: 'none' }} />
              
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="stat-header" style={{ color: '#34d399', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}><Users size={16} /> Active Rooms</div>
                <h3 className="stat-num" style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-text-title)', margin: '12px 0 16px 0' }}>
                  {rooms.filter(r => r.creator_id === user?.id || r.creator_name).length}
                </h3>
                <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', animation: 'pulseGlow 2s infinite', boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)' }}></div>
                  <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600, letterSpacing: '0.02em' }}>Live Networks</div>
                </div>
              </div>
            </div>
          </div>

          {/* Study Analytics Chart */}
          <div className="pro-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={20} color="#a1a1aa" /> Study Analytics
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', background: 'rgba(0,0,0,0.03)', padding: '4px 12px', borderRadius: '50px', fontWeight: 600 }}>Past 7 Days</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', gap: '12px' }}>
              {(data?.studyAnalytics || mockStudyData).map((d, i) => {
                const currentMaxHours = Math.max(...(data?.studyAnalytics || mockStudyData).map(item => item.hours), 1);
                return (
                  <div key={i} className="chart-bar-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flex: 1, position: 'relative' }}>
                    <div className="tooltip" style={{ position: 'absolute', top: '-30px', opacity: 0, transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)', background: '#2b2b2b', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', zIndex: 10, pointerEvents: 'none' }}>
                      {d.hours}h
                    </div>
                    <div style={{ width: '100%', height: '140px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div className="bar-fill" style={{ width: '100%', height: `${(d.hours / currentMaxHours) * 100}%`, background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '8px 8px 0 0', transition: 'filter 0.2s' }}></div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{d.day}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Level Progress Panel */}
          <div className="pro-panel feature-card" style={{ padding: '32px', position: 'relative', overflow: 'hidden' }}>
            {/* Soft animated background flare */}
            <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle at top right, rgba(139, 92, 246, 0.08) 0%, transparent 50%)', animation: 'pulseGlow 6s infinite', zIndex: 0, pointerEvents: 'none' }}></div>
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-text-title)', letterSpacing: '0.02em', margin: 0 }}>
                  <Flame size={22} color="#f59e0b" style={{ filter: 'drop-shadow(0 2px 4px rgba(245, 158, 11, 0.3))' }} /> RPG Progression
                </h3>
                <button 
                  onClick={() => setShowLevelInfo(true)}
                  style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="How Levels Work"
                >
                  <Info size={20} />
                </button>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
                {/* 3D Shiny Badge */}
                <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'linear-gradient(135deg, #fff 0%, #f1f5f9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '10px 10px 20px rgba(99, 102, 241, 0.15), -5px -5px 15px rgba(255,255,255,0.8), inset 0 0 10px rgba(99, 102, 241, 0.05)', border: '1px solid rgba(255,255,255,1)', transform: 'rotate(5deg)' }}>
                  <currentRank.icon size={40} color={currentRank.color} style={{ filter: `drop-shadow(0 4px 6px ${currentRank.color}4D)` }} />
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1rem', color: currentRank.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '2px', filter: `drop-shadow(0 2px 4px ${currentRank.color}4D)` }}>{currentRank.title} Rank</div>
                  <div style={{ fontSize: '3rem', fontWeight: 900, background: 'linear-gradient(135deg, #4f46e5 0%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: '1', fontStyle: 'italic', letterSpacing: '-0.02em', filter: 'drop-shadow(0 4px 8px rgba(236, 72, 153, 0.15))' }}>
                    LEVEL {currentLevel}
                  </div>
                </div>
                
                <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.6)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,1)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next Rank In</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f59e0b', textShadow: '0 2px 4px rgba(245, 158, 11, 0.2)', marginTop: '2px' }}>{100 - xpIntoCurrentLevel} XP</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ position: 'relative', width: '100%', height: '16px', background: 'rgba(0,0,0,0.05)', borderRadius: '50px', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                {/* Vibrant Gradient Fill */}
                <div style={{ width: `${levelProgressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #f43f5e 100%)', borderRadius: '50px', transition: 'width 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                  {/* Glossy top highlight */}
                  <div style={{ width: '100%', height: '50%', background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%)', borderRadius: '50px 50px 0 0' }}></div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>{userXp} Total XP</span>
                <span>Level {currentLevel + 1}</span>
              </div>
            </div>
          </div>

          {/* Rooms Area */}
          <div className="rooms-grid">
            {/* Rooms List */}
            <div className="pro-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} color="#a1a1aa" /> Study Rooms
              </h3>
              {rooms.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px dashed var(--color-border-glass)' }}>
                  <Users size={32} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>No active rooms. Create one to collaborate with your team.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '380px', overflowY: 'auto', paddingRight: '8px' }}>
                  {rooms.map((room) => (
                    <div key={room.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start', padding: '20px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border-glass)', borderRadius: '12px', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-hover)' }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-glass)' }}>
                      <div style={{ flex: '1 1 200px' }}>
                        <h4 style={{ fontSize: '1.1rem', color: 'var(--color-text-title)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {room.name}
                          {room.creator_id === user?.id && <span style={{ fontSize: '0.7rem', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', padding: '2px 8px', borderRadius: '50px', fontWeight: 600 }}>HOST</span>}
                        </h4>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '6px', lineHeight: '1.5' }}>{room.description || 'No description provided.'}</p>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Users size={12} /> Created by {room.creator_name || 'System'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <Link to={`/room/${room.id}`} className="pro-btn pro-btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                          Enter Room
                        </Link>
                        {room.creator_id === user?.id && (
                          <button onClick={async () => {
                            if (window.confirm('Are you sure you want to close and delete this room?')) {
                              try {
                                const response = await fetchApi(`/api/rooms/${room.id}`, {
                                  method: 'DELETE'
                                });
                                if (response.ok) {
                                  setRooms(rooms.filter(r => r.id !== room.id));
                                } else {
                                  alert('Failed to delete room');
                                }
                              } catch (e) {
                                alert(e.message);
                              }
                            }
                          }} className="pro-btn pro-btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger-bg)' }}>
                            <X size={14} /> Close
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Level Info Modal */}
      {showLevelInfo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }} onClick={() => setShowLevelInfo(false)}>
          <div style={{ background: 'var(--color-bg-deep)', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '650px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative', overflowY: 'auto', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowLevelInfo(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--color-bg-slate)', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}><X size={18} /></button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'linear-gradient(135deg, #fff 0%, #f1f5f9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(99, 102, 241, 0.1)', border: '1px solid rgba(255,255,255,1)' }}>
                <Award size={32} color="#6366f1" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-title)' }}>RPG Progression</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>Level up by earning XP to unlock prestigious ranks.</p>
              </div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)', borderRadius: '16px', padding: '16px', marginBottom: '32px', border: '1px solid rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: '#fff', color: '#6366f1', padding: '8px 12px', borderRadius: '12px', fontWeight: 800, fontSize: '1.1rem', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>100 XP</div>
              <div style={{ color: 'var(--color-text-title)', fontSize: '0.95rem', fontWeight: 500, lineHeight: '1.4' }}>
                Every 100 XP you earn automatically grants you <strong style={{ color: '#6366f1' }}>1 Level Up</strong>. There is no level cap!
              </div>
            </div>

            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-title)', marginBottom: '16px' }}>How to Earn XP</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
              <div style={{ background: 'var(--color-bg-slate)', padding: '16px', borderRadius: '16px', border: '1px solid var(--color-border-glass)' }}>
                <div style={{ color: '#10b981', fontWeight: 800, fontSize: '1.25rem', marginBottom: '4px' }}>+10 XP</div>
                <div style={{ color: 'var(--color-text-title)', fontWeight: 600, fontSize: '0.9rem' }}>Daily Login</div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Awarded once per day.</div>
              </div>
              <div style={{ background: 'var(--color-bg-slate)', padding: '16px', borderRadius: '16px', border: '1px solid var(--color-border-glass)' }}>
                <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: '1.25rem', marginBottom: '4px' }}>+20 XP</div>
                <div style={{ color: 'var(--color-text-title)', fontWeight: 600, fontSize: '0.9rem' }}>Streak Bonus</div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Awarded daily while on a streak.</div>
              </div>
              <div style={{ background: 'var(--color-bg-slate)', padding: '16px', borderRadius: '16px', border: '1px solid var(--color-border-glass)', gridColumn: 'span 2' }}>
                <div style={{ color: '#6366f1', fontWeight: 800, fontSize: '1.25rem', marginBottom: '4px' }}>+60 XP / hr</div>
                <div style={{ color: 'var(--color-text-title)', fontWeight: 600, fontSize: '0.9rem' }}>Study Sessions</div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Earn +1 XP for every minute you spend actively focused in a room.</div>
              </div>
            </div>

            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-title)', marginBottom: '16px' }}>Rank Tiers</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--color-bg-slate)', padding: '12px 16px', borderRadius: '16px', border: '1px solid var(--color-border-glass)' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #fff 0%, #f1f5f9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '4px 4px 10px rgba(99, 102, 241, 0.15), -2px -2px 8px rgba(255,255,255,0.8), inset 0 0 5px rgba(99, 102, 241, 0.05)', border: '1px solid rgba(255,255,255,1)', transform: 'rotate(-4deg)' }}>
                  <BookOpen size={24} color="#6366f1" style={{ filter: 'drop-shadow(0 2px 4px rgba(99, 102, 241, 0.3))' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 700, color: '#6366f1', fontSize: '1.05rem' }}>Novice</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Lv 1 - 9</div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Just starting the journey to mastering focus.</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--color-bg-slate)', padding: '12px 16px', borderRadius: '16px', border: '1px solid var(--color-border-glass)' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #fff 0%, #f1f5f9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '4px 4px 10px rgba(139, 92, 246, 0.15), -2px -2px 8px rgba(255,255,255,0.8), inset 0 0 5px rgba(139, 92, 246, 0.05)', border: '1px solid rgba(255,255,255,1)', transform: 'rotate(4deg)' }}>
                  <GraduationCap size={24} color="#8b5cf6" style={{ filter: 'drop-shadow(0 2px 4px rgba(139, 92, 246, 0.3))' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 700, color: '#8b5cf6', fontSize: '1.05rem' }}>Scholar</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Lv 10 - 24</div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>A dedicated student building consistent habits.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--color-bg-slate)', padding: '12px 16px', borderRadius: '16px', border: '1px solid var(--color-border-glass)' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #fff 0%, #f1f5f9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '4px 4px 10px rgba(244, 63, 94, 0.15), -2px -2px 8px rgba(255,255,255,0.8), inset 0 0 5px rgba(244, 63, 94, 0.05)', border: '1px solid rgba(255,255,255,1)', transform: 'rotate(-4deg)' }}>
                  <Target size={24} color="#f43f5e" style={{ filter: 'drop-shadow(0 2px 4px rgba(244, 63, 94, 0.3))' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 700, color: '#f43f5e', fontSize: '1.05rem' }}>Master</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Lv 25 - 49</div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>A veteran of productivity and time management.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--color-bg-slate)', padding: '12px 16px', borderRadius: '16px', border: '1px solid var(--color-border-glass)' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #fff 0%, #f1f5f9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '4px 4px 10px rgba(245, 158, 11, 0.15), -2px -2px 8px rgba(255,255,255,0.8), inset 0 0 5px rgba(245, 158, 11, 0.05)', border: '1px solid rgba(255,255,255,1)', transform: 'rotate(4deg)' }}>
                  <Flame size={24} color="#f59e0b" style={{ filter: 'drop-shadow(0 2px 4px rgba(245, 158, 11, 0.3))' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '1.05rem' }}>Legend</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Lv 50+</div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Absolute perfection in focus and consistency.</div>
                </div>
              </div>
            </div>
            
            <button onClick={() => setShowLevelInfo(false)} className="pro-btn pro-btn-primary" style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '1.05rem', fontWeight: 700 }}>
              Close Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
