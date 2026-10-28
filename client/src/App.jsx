import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { Footer } from './components/Footer.jsx';
import { LiveNotificationToast } from './components/LiveNotificationToast.jsx';

// Pages
import { HomePage } from './pages/HomePage.jsx';
import { FileTicketPage } from './pages/FileTicketPage.jsx';
import { TrackCasePage } from './pages/TrackCasePage.jsx';
import { TransparencyPage } from './pages/TransparencyPage.jsx';
import { StudentDashboard } from './pages/StudentDashboard.jsx';
import { OfficerDashboard } from './pages/OfficerDashboard.jsx';
import { AdminDashboard } from './pages/AdminDashboard.jsx';
import { TicketDetailPage } from './pages/TicketDetailPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';

function AppContent() {
  const { isAuthenticated, isStudent, isOfficer, isAdmin, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState(
    (window.location.pathname || '/') + (window.location.search || '')
  );

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath((window.location.pathname || '/') + (window.location.search || ''));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Separate pathname and search query string
  const [pathname, queryString] = (currentPath || '/').split('?');
  const urlParams = new URLSearchParams(
    queryString !== undefined ? queryString : window.location.search
  );
  const initialReceiptToken = urlParams.get('token') || urlParams.get('receipt') || '';

  // Determine which page to render based on path
  const renderPage = () => {
    if (loading) {
      return (
        <div className="py-24 text-center text-silver-500">
          <div className="w-8 h-8 border-4 border-marigold-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold tracking-wider uppercase text-silver-600">
            Initialising Open Case...
          </p>
        </div>
      );
    }

    // Match /tickets/:id
    const ticketMatch = pathname.match(/^\/tickets\/([a-zA-Z0-9-]+)/);
    if (ticketMatch) {
      return <TicketDetailPage ticketId={ticketMatch[1]} onNavigate={navigate} />;
    }

    switch (pathname) {
      case '/':
        return <HomePage onNavigate={navigate} />;
      case '/file':
        if (isOfficer) return <OfficerDashboard onNavigate={navigate} />;
        if (isAdmin) return <AdminDashboard onNavigate={navigate} />;
        return <FileTicketPage onNavigate={navigate} />;
      case '/track':
        return <TrackCasePage initialToken={initialReceiptToken} onNavigate={navigate} />;
      case '/transparency':
        return <TransparencyPage onNavigate={navigate} />;
      case '/login':
        return <LoginPage onNavigate={navigate} />;
      case '/register':
        return <RegisterPage onNavigate={navigate} />;
      case '/dashboard':
        return <StudentDashboard onNavigate={navigate} />;
      case '/officer':
        return <OfficerDashboard onNavigate={navigate} />;
      case '/admin':
        return <AdminDashboard onNavigate={navigate} />;
      default:
        return <HomePage onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#EBEAE5] text-aubergine-950 selection:bg-marigold-200 selection:text-aubergine-950 font-sans">
      <Navbar currentPath={pathname} onNavigate={navigate} />

      <main className="flex-1">
        {renderPage()}
      </main>

      <Footer onNavigate={navigate} />

      {/* Real-time SSE notification banner */}
      <LiveNotificationToast onSelectTicket={(id) => navigate(`/tickets/${id}`)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}
