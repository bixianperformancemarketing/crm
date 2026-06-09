import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [followupReminder, setFollowupReminder] = useState(null);
  const socketRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { notificationsAPI } = require('../services/api');
      const { data } = await notificationsAPI.getCount();
      setUnreadCount(data.count || 0);
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; setSocket(null); }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || '';
    const s = io(SOCKET_URL, { auth: { token }, reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 5 });
    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => { setConnected(true); fetchUnreadCount(); });
    s.on('disconnect', () => setConnected(false));

    s.on('notification', (data) => {
      setUnreadCount((c) => c + 1);
      toast.custom((t) => (
        <div style={{ background: '#1e1e3a', border: '1px solid #e94560', borderRadius: '8px', padding: '12px 16px', color: '#e2e2f0', maxWidth: '350px', cursor: 'pointer' }} onClick={() => toast.dismiss(t.id)}>
          <div style={{ fontWeight: 600, color: '#e94560', marginBottom: 4 }}>{data.title}</div>
          <div style={{ fontSize: '13px', color: '#a0a0c0' }}>{data.message}</div>
        </div>
      ), { duration: 5000 });
    });

    s.on('new_lead', (data) => {
      toast.success(`New lead: ${data.name} via ${data.source}`);
    });

    s.on('followup_reminder', (data) => {
      setFollowupReminder(data);
      toast(`⏰ ${data.message}`, { duration: 8000 });
    });

    s.on('task_reminder', (data) => {
      setFollowupReminder({ ...data, type: 'task' });
      toast(`📋 ${data.message}`, { duration: 8000 });
    });

    s.on('appointment_reminder', (data) => {
      toast(`📅 ${data.message}`, { duration: 10000 });
    });

    fetchUnreadCount();

    return () => { s.disconnect(); setSocket(null); setConnected(false); };
  }, [user, fetchUnreadCount]);

  const decrementUnread = useCallback(() => setUnreadCount((c) => Math.max(0, c - 1)), []);
  const resetUnread = useCallback(() => setUnreadCount(0), []);
  const dismissFollowupReminder = useCallback(() => setFollowupReminder(null), []);

  return (
    <SocketContext.Provider value={{ socket, connected, unreadCount, setUnreadCount, decrementUnread, resetUnread, fetchUnreadCount, followupReminder, dismissFollowupReminder }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};

export default SocketContext;
