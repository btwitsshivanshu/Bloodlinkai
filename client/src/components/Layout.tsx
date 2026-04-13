import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useSocket } from '../context/SocketContext';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  activeView?: string;
  onSwitchView?: (view: string) => void;
}

const icons: Record<string, React.ReactNode> = {
  dashboard: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" /></svg>,
  requests: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  history: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  map: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  chat: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  ai: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.59-.659L5 14.5m14 0V5a2 2 0 00-2-2H7a2 2 0 00-2 2v9.5" /></svg>,
  donors: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  add: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
  search: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  insights: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  bell: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
  profile: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
};

function getIcon(id: string) {
  const map: Record<string, string> = {
    admin: 'insights', donor: 'dashboard', receiver: 'dashboard',
    requests: 'requests', history: 'history', nearby: 'map',
    chat: 'chat', chatbot: 'ai', 'donors-list': 'donors',
    'ai-insights': 'ai', 'new-request': 'add', 'my-requests': 'requests',
    'find-donors': 'search', onboarding: 'dashboard', 'edit-profile': 'profile',
  };
  return icons[map[id] || 'dashboard'] || icons.dashboard;
}

export default function Layout({ children, currentPage, onNavigate, activeView, onSwitchView }: LayoutProps) {
  const { user, logout, notifications, clearNotifications, markNotificationRead, refreshNotifications } = useApp();
  const { socket } = useSocket();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

  const effectiveView = activeView || user?.role;

  // Listen for real-time notification events
  useEffect(() => {
    if (!socket) return;
    const handleNew = () => refreshNotifications();
    socket.on('blood-request-alert', handleNew);
    socket.on('donor-response', handleNew);
    socket.on('new-notification', handleNew);
    return () => {
      socket.off('blood-request-alert', handleNew);
      socket.off('donor-response', handleNew);
      socket.off('new-notification', handleNew);
    };
  }, [socket, refreshNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    }
    if (showNotifs) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifs]);

  function timeAgo(ts: string) {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  }

  const navItems = effectiveView === 'admin' ? [
    { id: 'admin', label: 'Dashboard' },
    { id: 'requests', label: 'Requests' },
    { id: 'donors-list', label: 'All Donors' },
    { id: 'ai-insights', label: 'AI Insights' },
    { id: 'chat', label: 'Messages' },
  ] : effectiveView === 'donor' ? [
    { id: 'donor', label: 'Dashboard' },
    { id: 'requests', label: 'Blood Requests' },
    { id: 'history', label: 'My History' },
    { id: 'nearby', label: 'Nearby Map' },
    { id: 'chat', label: 'Messages' },
    { id: 'chatbot', label: 'AI Assistant' },
    { id: 'edit-profile', label: 'Edit Profile' },
  ] : [
    { id: 'receiver', label: 'Dashboard' },
    { id: 'new-request', label: 'New Request' },
    { id: 'my-requests', label: 'My Requests' },
    { id: 'find-donors', label: 'Find Donors' },
    { id: 'nearby', label: 'Nearby Map' },
    { id: 'chat', label: 'Messages' },
    { id: 'chatbot', label: 'AI Assistant' },
    { id: 'edit-profile', label: 'Edit Profile' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-[72px]'} bg-white border-r border-gray-200 flex flex-col transition-all duration-200 flex-shrink-0`}>
        <div className="h-16 flex items-center px-4 border-b border-gray-100">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex items-center gap-2.5 w-full hover:opacity-80 transition">
            <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C12 2 5 10.5 5 15a7 7 0 0014 0C19 10.5 12 2 12 2z"/></svg>
            </div>
            {sidebarOpen && (
              <span className="font-semibold text-lg text-gray-900 tracking-tight">BloodLink AI</span>
            )}
          </button>
        </div>

        <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-sm ${
                currentPage === item.id
                  ? 'bg-red-50 text-red-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className={`flex-shrink-0 ${currentPage === item.id ? 'text-red-600' : 'text-gray-400'}`}>
                {getIcon(item.id)}
              </span>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* View switcher for non-admin users */}
        {user?.role !== 'admin' && onSwitchView && (
          <div className={`px-3 pb-2 ${sidebarOpen ? '' : 'flex justify-center'}`}>
            {sidebarOpen ? (
              <div className="bg-gray-100 rounded-lg p-1 flex gap-1">
                <button
                  onClick={() => onSwitchView('donor')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${effectiveView === 'donor' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  🩸 Donor
                </button>
                <button
                  onClick={() => onSwitchView('receiver')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${effectiveView === 'receiver' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  🏥 Receiver
                </button>
              </div>
            ) : (
              <button
                onClick={() => onSwitchView(effectiveView === 'donor' ? 'receiver' : 'donor')}
                title={`Switch to ${effectiveView === 'donor' ? 'Receiver' : 'Donor'} view`}
                className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-sm transition"
              >
                {effectiveView === 'donor' ? '🏥' : '🩸'}
              </button>
            )}
          </div>
        )}

        {user && (
          <div className="p-3 border-t border-gray-100">
            <div className={`flex items-center ${sidebarOpen ? 'gap-2.5' : 'justify-center'} mb-2`}>
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-sm overflow-hidden shrink-0">
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-semibold text-xs">{user.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              {sidebarOpen && (
                <div className="min-w-0">
                  <p className="font-medium text-[13px] text-gray-900 truncate">{user.name}</p>
                  <p className="text-[11px] text-gray-400 capitalize">{effectiveView}</p>
                </div>
              )}
            </div>
            {sidebarOpen && (
              <button
                onClick={logout}
                className="w-full py-1.5 text-[12px] text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition"
              >
                Sign Out
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <h2 className="text-[15px] font-semibold text-gray-900">
            {navItems.find(i => i.id === currentPage)?.label || 'Dashboard'}
          </h2>
          <div className="flex items-center gap-3">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative p-2 hover:bg-gray-50 rounded-lg transition text-gray-500"
              >
                {icons.bell}
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 top-11 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 flex flex-col" style={{ maxHeight: '28rem' }}>
                  <div className="p-3 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                    <h3 className="font-medium text-sm text-gray-900">
                      Notifications
                      {unreadCount > 0 && <span className="ml-1.5 text-xs text-red-600 font-normal">({unreadCount} new)</span>}
                    </h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => { clearNotifications(); setShowNotifs(false); }}
                        className="text-xs text-red-600 hover:text-red-700 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                          {icons.bell}
                        </div>
                        <p className="text-sm text-gray-400">No notifications yet</p>
                      </div>
                    ) : notifications.slice(0, 10).map(n => (
                      <button
                        key={n.id}
                        onClick={() => { markNotificationRead(n.id); }}
                        className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition flex gap-3 ${!n.read ? 'bg-red-50/40' : ''}`}
                      >
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-red-500' : 'bg-transparent'}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm truncate ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{n.message}</p>
                          <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.timestamp)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  {notifications.length > 10 && (
                    <div className="p-2 border-t border-gray-100 text-center flex-shrink-0">
                      <p className="text-xs text-gray-400">Showing latest 10 of {notifications.length}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-red-600 overflow-hidden border border-gray-200">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-semibold text-xs">{user?.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
