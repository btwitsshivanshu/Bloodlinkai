// ============================================================
// BloodLink AI - Application State Context
// Manages auth, data, and state across the app
// Wired to backend API with localStorage cache
// ============================================================

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, BloodRequest, Notification, ChatMessage, ChatConversation, DonorProfile } from '../types';
import { api, BASE } from '../utils/api';
import { socketReconnect } from './SocketContext';

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  login: (userData: User, token: string) => void;
  logout: () => void;
  // Data
  donors: DonorProfile[];
  requests: BloodRequest[];
  notifications: Notification[];
  conversations: ChatConversation[];
  messages: Record<string, ChatMessage[]>;
  unreadNotifCount: number;
  // Loading
  loading: boolean;
  // Actions
  toggleAvailability: () => void;
  addRequest: (req: Omit<BloodRequest, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  updateRequestStatus: (id: string, status: BloodRequest['status']) => void;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  startConversation: (otherUserId: string, otherUserName: string) => Promise<string>;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  createDonorProfile: (profile: DonorProfile) => void;
  completeDonation: (requestId: string, donorId: string) => void;
  updateUser: (updates: Partial<User>) => Promise<void>;
  updateDonorProfile: (updates: Partial<DonorProfile>) => Promise<void>;
  refreshRequests: () => Promise<void>;
  refreshDonors: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

// ============================================================
// Transformers: backend shape → frontend shape
// ============================================================
function toFrontendRequest(r: any): BloodRequest {
  return {
    id: r._id || r.id,
    receiverId: typeof r.receiverId === 'object' ? r.receiverId._id : r.receiverId,
    receiverName: typeof r.receiverId === 'object' ? r.receiverId.name : (r.receiverName || ''),
    bloodGroup: r.bloodGroup,
    units: r.units,
    urgency: r.urgency || 'normal',
    status: r.status || 'open',
    lat: r.location?.coordinates?.[1] ?? r.lat ?? 0,
    lng: r.location?.coordinates?.[0] ?? r.lng ?? 0,
    address: r.address || '',
    hospital: r.hospital || '',
    description: r.description || '',
    createdAt: r.createdAt || new Date().toISOString(),
    matchedDonorId: typeof r.matchedDonorId === 'object' ? r.matchedDonorId?._id : r.matchedDonorId,
  };
}

function toFrontendDonor(d: any): DonorProfile {
  const user = d.userId && typeof d.userId === 'object' ? d.userId : null;
  return {
    userId: user?._id || d.userId,
    name: user?.name || d.name || '',
    email: user?.email || d.email || '',
    bloodGroup: d.bloodGroup,
    lat: d.location?.coordinates?.[1] ?? d.lat ?? 0,
    lng: d.location?.coordinates?.[0] ?? d.lng ?? 0,
    address: d.address || '',
    available: d.available ?? true,
    lastDonationDate: d.lastDonationDate || '',
    totalDonations: d.totalDonations || 0,
    donationHistory: (d.donationHistory || []).map((h: any) => ({
      id: h._id || h.id || '',
      date: h.date || '',
      location: h.location || '',
      receiverName: h.receiverName || '',
      bloodGroup: h.bloodGroup || '',
      units: h.units || 1,
    })),
    healthScore: d.healthScore || 85,
    age: d.age || 0,
    weight: d.weight || 0,
  };
}

function toFrontendConv(c: any, userId: string): ChatConversation {
  const unread = c.unreadCount instanceof Map
    ? c.unreadCount.get(userId) || 0
    : (typeof c.unreadCount === 'object' ? (c.unreadCount?.[userId] || 0) : 0);
  return {
    id: c._id || c.id,
    participantIds: (c.participants || []).map((p: any) => typeof p === 'object' ? p._id : p),
    participantNames: c.participantNames || (c.participants || []).map((p: any) => typeof p === 'object' ? p.name : ''),
    lastMessage: c.lastMessage || '',
    lastTimestamp: c.lastMessageAt || c.lastTimestamp || c.updatedAt || '',
    unreadCount: unread,
  };
}

function toFrontendMsg(m: any): ChatMessage {
  return {
    id: m._id || m.id,
    senderId: typeof m.senderId === 'object' ? m.senderId._id : m.senderId,
    senderName: m.senderName || '',
    receiverId: typeof m.receiverId === 'object' ? m.receiverId._id : (m.receiverId || ''),
    content: m.content,
    timestamp: m.createdAt || m.timestamp || '',
    read: m.read ?? false,
  };
}

function toFrontendNotif(n: any): Notification {
  return {
    id: n._id || n.id,
    userId: typeof n.userId === 'object' ? n.userId._id : n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    read: n.read ?? false,
    timestamp: n.createdAt || n.timestamp || '',
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [donors, setDonors] = useState<DonorProfile[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // ============================================================
  // Data Fetchers
  // ============================================================
  const refreshRequests = useCallback(async () => {
    try {
      // Fetch user's own requests + all open requests (for donor view), merge & deduplicate
      const [myData, allData] = await Promise.allSettled([
        api<{ requests: any[] }>('/requests/my'),
        api<{ requests: any[] }>('/requests?status=open'),
      ]);
      const myReqs = myData.status === 'fulfilled' ? myData.value.requests : [];
      const allReqs = allData.status === 'fulfilled' ? allData.value.requests : [];
      const merged = [...myReqs];
      for (const r of allReqs) {
        if (!merged.find(m => (m._id || m.id) === (r._id || r.id))) merged.push(r);
      }
      setRequests(merged.map(toFrontendRequest));
    } catch { /* silently fail — user might not be authed yet */ }
  }, []);

  const refreshDonors = useCallback(async () => {
    try {
      const data = await api<{ donors: any[] }>('/donors/all');
      setDonors(data.donors.map(toFrontendDonor));
    } catch {
      // Non-admin: try fetching nearby donors with broad radius
      try {
        const data = await api<{ donors: any[] }>('/donors/nearby?lat=0&lng=0&radius=200');
        setDonors(data.donors.map(toFrontendDonor));
      } catch { /* ok */ }
    }

    // Always fetch own donor profile so onboarding check works
    try {
      const own = await api<{ profile: any }>('/donors/profile');
      if (own.profile) {
        const mapped = toFrontendDonor(own.profile);
        setDonors(prev => {
          if (prev.find(d => d.userId === mapped.userId)) return prev;
          return [...prev, mapped];
        });
      }
    } catch { /* no profile yet — donor needs onboarding */ }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await api<{ notifications: any[]; unreadCount: number }>('/notifications');
      setNotifications(data.notifications.map(toFrontendNotif));
      setUnreadNotifCount(data.unreadCount);
    } catch { /* ok */ }
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const data = await api<{ conversations: any[] }>('/chat/conversations');
      const uid = user?.id || '';
      setConversations(data.conversations.map(c => toFrontendConv(c, uid)));
    } catch { /* ok */ }
  }, [user?.id]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const data = await api<{ messages: any[] }>(`/chat/conversations/${conversationId}/messages`);
      setMessages(prev => ({
        ...prev,
        [conversationId]: data.messages.map(toFrontendMsg),
      }));
    } catch { /* ok */ }
  }, []);

  // ============================================================
  // Auth: restore from localStorage on mount — verify token is still valid
  // ============================================================
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser && token) {
      try {
        const parsed = JSON.parse(storedUser);
        if (!parsed?.id || !parsed?.name || !parsed?.email || !parsed?.role) throw new Error('bad');
        // Verify token is still accepted by backend before restoring session
        fetch(`${BASE}/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(res => {
          if (res.ok) {
            setUser(parsed);
          } else {
            // Token rejected (expired, wrong secret, etc.) — clear stale session
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            setLoading(false);
          }
        }).catch(() => {
          // Network error — still restore session optimistically so offline users aren't logged out
          setUser(parsed);
        });
        return;
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    // No valid session — nothing to fetch
    setLoading(false);
  }, []);

  // Fetch all data when user is set
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      refreshRequests(),
      refreshDonors(),
      refreshNotifications(),
      refreshConversations(),
    ]).finally(() => setLoading(false));
  }, [user, refreshRequests, refreshDonors, refreshNotifications, refreshConversations]);

  // ============================================================
  // Auth Actions
  // ============================================================
  const login = useCallback((userData: User, token: string) => {
    setLoading(true); // prevent Onboarding flash while data fetches
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    socketReconnect();
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setDonors([]);
    setRequests([]);
    setNotifications([]);
    setConversations([]);
    setMessages({});
    setUnreadNotifCount(0);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    socketReconnect();
  }, []);

  // ============================================================
  // Donor Actions
  // ============================================================
  const toggleAvailability = useCallback(async () => {
    if (!user) return;
    try {
      await api('/donors/toggle-availability', { method: 'PUT' });
      setDonors(prev => prev.map(d =>
        d.userId === user.id ? { ...d, available: !d.available } : d
      ));
    } catch { /* ok */ }
  }, [user]);

  const createDonorProfile = useCallback((profile: DonorProfile) => {
    setDonors(prev => {
      if (prev.find(d => d.userId === profile.userId)) return prev;
      return [...prev, profile];
    });
  }, []);

  // ============================================================
  // Request Actions — now calls backend
  // ============================================================
  const addRequest = useCallback(async (req: Omit<BloodRequest, 'id' | 'createdAt' | 'status'>) => {
    const data = await api<{ request: any }>('/requests', {
      method: 'POST',
      body: {
        bloodGroup: req.bloodGroup,
        units: req.units,
        lat: req.lat,
        lng: req.lng,
        address: req.address,
        hospital: req.hospital,
        description: req.description,
      },
    });
    setRequests(prev => [toFrontendRequest(data.request), ...prev]);
  }, []);

  const updateRequestStatus = useCallback(async (id: string, status: BloodRequest['status']) => {
    try {
      await api(`/requests/${id}/status`, { method: 'PUT', body: { status } });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch { /* ok */ }
  }, []);

  const completeDonation = useCallback(async (requestId: string, donorId: string) => {
    // Optimistic update — reflect verified status immediately in UI
    setRequests(prev => prev.map(r =>
      r.id === requestId ? { ...r, status: 'fulfilled', matchedDonorId: donorId } : r
    ));
    try {
      await api(`/requests/${requestId}/match`, { method: 'PUT', body: { donorId } });
      await api(`/requests/${requestId}/status`, { method: 'PUT', body: { status: 'fulfilled' } });
      // Refresh donor profiles so updated stats (totalDonations, lastDonationDate) are reflected
      await refreshDonors();
    } catch {
      // Revert on failure
      setRequests(prev => prev.map(r =>
        r.id === requestId ? { ...r, status: 'open', matchedDonorId: undefined } : r
      ));
    }
  }, [refreshDonors]);

  // ============================================================
  // Chat Actions — now calls backend
  // ============================================================
  const sendMessage = useCallback(async (conversationId: string, content: string) => {
    if (!user) return;
    const data = await api<{ message: any }>(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: { content },
    });
    const msg = toFrontendMsg(data.message);
    setMessages(prev => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), msg],
    }));
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c, lastMessage: content, lastTimestamp: new Date().toISOString() } : c
    ));
  }, [user]);

  const startConversation = useCallback(async (otherUserId: string, _otherUserName: string): Promise<string> => {
    if (!user) return '';
    const data = await api<{ conversation: any; existing?: boolean }>('/chat/conversations', {
      method: 'POST',
      body: { participantId: otherUserId },
    });
    const conv = toFrontendConv(data.conversation, user.id);
    setConversations(prev => {
      if (prev.find(c => c.id === conv.id)) return prev;
      return [conv, ...prev];
    });
    return conv.id;
  }, [user]);

  // ============================================================
  // Notification Actions — now calls backend
  // ============================================================
  const markNotificationRead = useCallback(async (id: string) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadNotifCount(prev => Math.max(0, prev - 1));
    } catch { /* ok */ }
  }, []);

  const clearNotifications = useCallback(async () => {
    try {
      await api('/notifications/read-all', { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadNotifCount(0);
    } catch { /* ok */ }
  }, []);

  // ============================================================
  // Profile Actions — now persists to backend
  // ============================================================
  const updateUser = useCallback(async (updates: Partial<User>) => {
    try {
      await api('/users/profile', { method: 'PUT', body: updates });
    } catch { /* ok, still apply locally */ }
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateDonorProfile = useCallback(async (updates: Partial<DonorProfile>) => {
    if (!user) return;
    try {
      await api('/donors/profile', { method: 'PUT', body: updates });
    } catch { /* ok */ }
    setDonors(prev => prev.map(d =>
      d.userId === user.id ? { ...d, ...updates } : d
    ));
  }, [user]);

  return (
    <AppContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      logout,
      donors,
      requests,
      notifications,
      conversations,
      messages,
      unreadNotifCount,
      loading,
      toggleAvailability,
      addRequest,
      updateRequestStatus,
      sendMessage,
      startConversation,
      markNotificationRead,
      clearNotifications,
      createDonorProfile,
      completeDonation,
      updateUser,
      updateDonorProfile,
      refreshRequests,
      refreshDonors,
      refreshNotifications,
      refreshConversations,
      fetchMessages,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
