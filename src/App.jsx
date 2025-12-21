import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSupabase } from './contexts/SupabaseContext';
import { useAuth } from './hooks/useAuth';
import { CallProvider } from './context/CallContext';
import { Login, Signup, ForgotPassword, ResetPassword } from './components/auth';
import { Chat } from './components/chat';
import Home from './components/Home';
import Profile from './components/profile';
import Settings from './components/settings';
import News from './components/news';
import Reminders from './components/reminders';
import CreateReminder from './components/reminders/CreateReminder';
import Calls from './components/calls';
import Blocked from './components/blocked';
import UserDetails from './components/UserDetails';
import SharedProfile from './components/shared-profile';
import About from './components/About';
import SupportChat from './components/SupportChat';
import Admin from './components/Admin';
import { QRPage } from './components/qr';
import Intro from './components/Intro';
import CallScreen from './components/CallScreen';
import CallStatusIndicator from './components/CallStatusIndicator';
import { IncomingCallModal } from './components/IncomingCallModal';
import MessagingLoader from './components/MessagingLoader';
import AuthDebug from './components/AuthDebug';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import useResumeRevalidate from './hooks/useResumeRevalidate';

CapacitorUpdater.notifyAppReady();




const ProtectedRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) return <MessagingLoader />;

  if (!isAuthenticated) {
    // Redirect to React login route
    return <Navigate to="/login" replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <MessagingLoader />;

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const CallProviderWrapper = ({ children }) => {
  const { user } = useAuth();

  return (
    <CallProvider currentUser={user}>
      {children}
    </CallProvider>
  );
};

// Home component is now imported

function App() {
  const [showIntro, setShowIntro] = useState(true);
  const { supabase } = useSupabase();
  useResumeRevalidate();

  // Create a client
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: true, // IMPORTANT: Jaise hi app focus me aayega, data refresh hoga
        refetchOnReconnect: true,   // IMPORTANT: Net wapas aate hi refresh
      },
    },
  });
  


  useEffect(() => {
    const { pathname, search } = window.location;
    if (search.startsWith('?/')) {
      const path = search.slice(2).replace(/~and~/g, '&');
      window.history.replaceState(null, '', pathname + path);
    }

    // Handle Google OAuth callback
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('Google OAuth success, redirecting to home');
          // User will be automatically redirected by ProtectedRoute logic
        }
      });

      return () => subscription?.unsubscribe();
    }
  }, [supabase]);

  useEffect(() => {
    const checkPermissions = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Explicitly ask for Camera Permission
          const cameraStatus = await Camera.requestPermissions();

          if (cameraStatus.camera === 'granted' || cameraStatus.camera === 'limited') {
            console.log("Camera Permission Granted by Android!");
            // Ab agar tumhara Web code navigator.mediaDevices.getUserMedia call karega
            // to wo fail nahi hoga.
          } else {
            console.log("Camera Permission Denied!");
          }
        } catch (error) {
          console.error("Error asking permissions:", error);
        }
      }
    };

    checkPermissions();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <CallProviderWrapper>
        {showIntro ? (
          <Intro onComplete={() => setShowIntro(false)} />
        ) : (
          <Routes>
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
            <Route path="/chat/:chatId/:otherUserId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/chat/new/:userId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/call/:callId" element={<ProtectedRoute><CallScreen /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/news" element={<ProtectedRoute><News /></ProtectedRoute>} />
            <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
            <Route path="/create-reminder" element={<ProtectedRoute><CreateReminder /></ProtectedRoute>} />
            <Route path="/calls" element={<ProtectedRoute><Calls /></ProtectedRoute>} />
            <Route path="/qr" element={<ProtectedRoute><QRPage /></ProtectedRoute>} />
            <Route path="/blocked" element={<ProtectedRoute><Blocked /></ProtectedRoute>} />
            <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute><SupportChat /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/user-details/:id" element={<ProtectedRoute><UserDetails /></ProtectedRoute>} />
            <Route path="/shared-profile/:id" element={<ProtectedRoute><SharedProfile /></ProtectedRoute>} />
          </Routes>
        )}

        {/* Global Call Components */}
        <CallStatusIndicator />
        <IncomingCallModal />
        <AuthDebug />
      </CallProviderWrapper>
    </QueryClientProvider>
  );
}

export default App;
