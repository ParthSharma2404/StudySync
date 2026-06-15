import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, UserPlus, Info } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { fetchApi } from '../utils/api';

const NotificationsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const socket = useSocket();

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
    
    const handleNewNotification = () => {
      fetchNotifications();
    };

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
      // Mark all as read when opening
      try {
        await fetchApi('/api/notifications/mark-read', { method: 'POST' });
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      } catch (err) {
        console.error('Failed to mark read', err);
      }
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await fetchApi('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      fetchNotifications();
    } catch (err) { console.error(err); }
  };

  const handleReject = async (requestId) => {
    try {
      await fetchApi('/api/friends/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      fetchNotifications();
    } catch (err) { console.error(err); }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        onClick={handleToggle}
        className="nav-link" 
        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center' }}
      >
        <Bell size={20} color={unreadCount > 0 ? '#6366f1' : 'var(--color-text-muted)'} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: '#ef4444', color: 'white', fontSize: '0.65rem',
            fontWeight: 'bold', width: '16px', height: '16px',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '12px',
          width: '320px', maxHeight: '400px', overflowY: 'auto',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 1000
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-text-title)' }}>
            Notifications
          </div>
          
          {notifications.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              No notifications yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {notifications.map(notif => (
                <div key={notif.id} style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
                  background: notif.is_read ? 'transparent' : 'rgba(99,102,241,0.05)',
                  display: 'flex', gap: '12px', alignItems: 'flex-start'
                }}>
                  <div style={{ marginTop: '2px' }}>
                    {notif.type === 'friend_request' ? <UserPlus size={16} color="#6366f1" /> : <Info size={16} color="#10b981" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>{notif.message}</p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                    
                    {notif.type === 'friend_request' && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleAccept(notif.related_id); }}
                          style={{ background: '#10b981', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Check size={14} /> Accept
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleReject(notif.related_id); }}
                          style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <X size={14} /> Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsDropdown;
