import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, UserPlus, UserCheck, Info, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { fetchApi } from '../utils/api';

const NotificationsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(null);
  const dropdownRef = useRef(null);
  const socket = useSocket();
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await fetchApi('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.notifications.filter(n => !n.is_read).length);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleNewNotification = () => fetchNotifications();
    socket.on('new-notification', handleNewNotification);
    return () => socket.off('new-notification', handleNewNotification);
  }, [socket]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = async () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      try {
        await fetchApi('/api/notifications/mark-read', { method: 'POST' });
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      } catch (err) {
        console.error('Failed to mark read', err);
      }
    }
  };

  const handleAccept = async (requestId, notifId) => {
    setActionLoading(notifId);
    try {
      const res = await fetchApi('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (err) { console.error(err); }
    setActionLoading(null);
  };

  const handleReject = async (requestId, notifId) => {
    setActionLoading(notifId);
    try {
      const res = await fetchApi('/api/friends/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (err) { console.error(err); }
    setActionLoading(null);
  };

  const getNotifIcon = (notif) => {
    if (notif.type === 'friend_request') return <UserPlus size={18} color="#6366f1" />;
    if (notif.type === 'friend_accept') return <UserCheck size={18} color="#10b981" />;
    if (notif.type === 'room_invite') return <LogIn size={18} color="#f59e0b" />;
    return <Info size={18} color="#64748b" />;
  };

  const isPendingRequest = (notif) => {
    return notif.type === 'friend_request' && notif.friendship_status === 'pending';
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        onClick={handleToggle}
        className="nav-link" 
        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', padding: '8px' }}
      >
        <Bell size={20} color={unreadCount > 0 ? '#818cf8' : '#94a3b8'} fill={unreadCount > 0 ? 'rgba(129,140,248,0.15)' : 'none'} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '0px', right: '0px',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', fontSize: '0.6rem',
            fontWeight: 'bold', minWidth: '16px', height: '16px',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)', border: '2px solid #0f172a'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: '-40px',
          width: '360px', maxHeight: '440px',
          background: '#1a1b2e', 
          border: '1px solid rgba(99, 102, 241, 0.15)',
          borderRadius: '16px', 
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ 
            padding: '16px 20px', 
            borderBottom: '1px solid rgba(255,255,255,0.06)', 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(99, 102, 241, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={16} color="#818cf8" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>Notifications</span>
            </div>
            {notifications.length > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                {notifications.length} total
              </span>
            )}
          </div>
          
          {/* Body */}
          <div style={{ overflowY: 'auto', maxHeight: '380px' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <Bell size={32} color="#334155" style={{ marginBottom: '12px' }} />
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div key={notif.id} style={{
                  padding: '14px 20px', 
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: notif.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.06)',
                  display: 'flex', gap: '12px', alignItems: 'flex-start',
                  transition: 'background 0.2s'
                }}>
                  {/* Icon */}
                  <div style={{ 
                    width: '36px', height: '36px', borderRadius: '10px', 
                    background: notif.type === 'friend_request' ? 'rgba(99, 102, 241, 0.12)' : notif.type === 'room_invite' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: '2px'
                  }}>
                    {getNotifIcon(notif)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                      {notif.message}
                    </p>
                    <span style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px', display: 'block' }}>
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                    
                    {/* Accept / Decline for pending friend requests */}
                    {isPendingRequest(notif) && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <button 
                          disabled={actionLoading === notif.id}
                          onClick={(e) => { e.stopPropagation(); handleAccept(notif.related_id, notif.id); }}
                          style={{ 
                            background: 'linear-gradient(135deg, #10b981, #059669)', 
                            color: '#fff', border: 'none', 
                            padding: '6px 14px', borderRadius: '8px', 
                            fontSize: '0.8rem', fontWeight: 600,
                            cursor: actionLoading === notif.id ? 'wait' : 'pointer', 
                            display: 'flex', alignItems: 'center', gap: '4px',
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                            transition: 'all 0.2s',
                            opacity: actionLoading === notif.id ? 0.6 : 1
                          }}
                        >
                          <Check size={14} /> Accept
                        </button>
                        <button 
                          disabled={actionLoading === notif.id}
                          onClick={(e) => { e.stopPropagation(); handleReject(notif.related_id, notif.id); }}
                          style={{ 
                            background: 'rgba(255,255,255,0.06)', 
                            color: '#94a3b8', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            padding: '6px 14px', borderRadius: '8px', 
                            fontSize: '0.8rem', fontWeight: 600,
                            cursor: actionLoading === notif.id ? 'wait' : 'pointer', 
                            display: 'flex', alignItems: 'center', gap: '4px',
                            transition: 'all 0.2s',
                            opacity: actionLoading === notif.id ? 0.6 : 1
                          }}
                        >
                          <X size={14} /> Decline
                        </button>
                      </div>
                    )}

                    {/* Join Room action for room invites */}
                    {notif.type === 'room_invite' && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setIsOpen(false);
                            navigate(`/room/${notif.related_id}`);
                          }}
                          style={{ 
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
                            color: '#fff', border: 'none', 
                            padding: '6px 14px', borderRadius: '8px', 
                            fontSize: '0.8rem', fontWeight: 600,
                            cursor: 'pointer', 
                            display: 'flex', alignItems: 'center', gap: '4px',
                            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                            transition: 'all 0.2s'
                          }}
                        >
                          <LogIn size={14} /> Join Room
                        </button>
                      </div>
                    )}

                    {/* Show "Accepted" label for already accepted friend requests */}
                    {notif.type === 'friend_request' && notif.friendship_status === 'accepted' && (
                      <div style={{ 
                        marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
                        padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600
                      }}>
                        <Check size={12} /> Accepted
                      </div>
                    )}
                  </div>

                  {/* Unread dot */}
                  {!notif.is_read && (
                    <div style={{ 
                      width: '8px', height: '8px', borderRadius: '50%', 
                      background: '#6366f1', flexShrink: 0, marginTop: '6px',
                      boxShadow: '0 0 8px rgba(99, 102, 241, 0.5)'
                    }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsDropdown;
