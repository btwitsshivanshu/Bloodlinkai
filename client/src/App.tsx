import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import DonorDashboard from './pages/DonorDashboard';
import ReceiverDashboard from './pages/ReceiverDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ChatPage from './pages/ChatPage';
import NearbyDonors from './pages/NearbyDonors';
import Chatbot from './pages/Chatbot';
import EditProfile from './pages/EditProfile';

function AppRouter() {
  const { isAuthenticated, user, donors, loading } = useApp();
  const [currentPage, setCurrentPage] = useState('');
  const [activeView, setActiveView] = useState(''); // 'donor' | 'receiver' | 'admin'

  // Derive effective view: default to user's registered role
  const effectiveView = activeView || user?.role || 'receiver';

  const handleSwitchView = (view: string) => {
    setActiveView(view);
    setCurrentPage(''); // reset page when switching view
  };

  // Show landing page when not authenticated
  if (!isAuthenticated || !user) {
    return <Landing />;
  }

  // Wait for data to load before deciding onboarding
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Check if donor needs onboarding
  const isDonorProfileMissing = effectiveView === 'donor' && !donors.find(d => d.userId === user.id);

  if (isDonorProfileMissing) {
    return (
      <Layout currentPage="onboarding" onNavigate={() => {}}>
        <Onboarding />
      </Layout>
    );
  }

  // Set default page based on effective view
  const activePage = currentPage || (
    effectiveView === 'admin' ? 'admin' :
    effectiveView === 'donor' ? 'donor' :
    'receiver'
  );

  // Render page content based on current navigation
  const renderPage = () => {
    switch (activePage) {
      // Donor pages
      case 'donor':
        return <DonorDashboard page="dashboard" onNavigate={setCurrentPage} />;
      case 'requests':
        if (effectiveView === 'admin') return <AdminDashboard page="requests" />;
        return <DonorDashboard page="requests" onNavigate={setCurrentPage} />;
      case 'history':
        return <DonorDashboard page="history" onNavigate={setCurrentPage} />;

      // Receiver pages
      case 'receiver':
          return <ReceiverDashboard page="dashboard" onNavigate={setCurrentPage} />;
        case 'new-request':
          return <ReceiverDashboard page="new-request" onNavigate={setCurrentPage} />;
        case 'my-requests':
          return <ReceiverDashboard page="my-requests" onNavigate={setCurrentPage} />;
        case 'find-donors':
          return <ReceiverDashboard page="find-donors" onNavigate={setCurrentPage} />;
      case 'admin':
        return <AdminDashboard page="admin" />;
      case 'donors-list':
        return <AdminDashboard page="donors-list" />;
      case 'ai-insights':
        return <AdminDashboard page="ai-insights" />;

      // Shared pages
      case 'chat':
        return <ChatPage />;
      case 'nearby':
        return <NearbyDonors onNavigate={setCurrentPage} />;
      case 'chatbot':
        return <Chatbot />;
      case 'edit-profile':
        return <EditProfile />;

      default:
        return <div className="text-center py-20 text-gray-500">Page not found</div>;
    }
  };

  return (
    <Layout currentPage={activePage} onNavigate={setCurrentPage} activeView={effectiveView} onSwitchView={handleSwitchView}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
