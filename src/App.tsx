import { useState, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DtrUploader } from './features/dtr/components/DtrUploader';
import { LoginPage } from './features/auth/components/LoginPage';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Automatically strip external tracking parameters (e.g. ?fbclid=*, utm_*) on web
const cleanTrackingParams = () => {
  if (typeof window === 'undefined' || !!window.electronAPI || !window.location.search) return;
  try {
    const url = new URL(window.location.href);
    const trackingPrefixes = ['fbclid', 'utm_', 'gclid'];
    let changed = false;
    for (const key of Array.from(url.searchParams.keys())) {
      if (trackingPrefixes.some((prefix) => key.startsWith(prefix))) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      const cleanSearch = url.searchParams.toString();
      const cleanUrl = url.pathname + (cleanSearch ? `?${cleanSearch}` : '') + url.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  } catch {
    // Ignore URL parsing errors
  }
};

cleanTrackingParams();

const ErrorFallback = ({ error }: FallbackProps) => {
  return (
    <div className="p-4 text-red-500">
      <h2 className="text-lg font-bold">Something went wrong:</h2>
      <pre>{error instanceof Error ? error.message : String(error)}</pre>
    </div>
  );
};

export const App = () => {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  const Router = isElectron ? HashRouter : BrowserRouter;

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (isElectron) return true;
    const isAuth = sessionStorage.getItem('dtr_auth') === 'true';
    const lastActive = Number(sessionStorage.getItem('dtr_last_active') || 0);
    if (isAuth && Date.now() - lastActive < IDLE_TIMEOUT_MS) {
      return true;
    }
    sessionStorage.removeItem('dtr_auth');
    return false;
  });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    cleanTrackingParams();
  }, [isElectron]);

  useEffect(() => {
    if (isElectron || !isAuthenticated) return;

    const recordActivity = () => {
      sessionStorage.setItem('dtr_last_active', String(Date.now()));
    };

    const checkTimeout = () => {
      const lastActive = Number(sessionStorage.getItem('dtr_last_active') || 0);
      if (Date.now() - lastActive >= IDLE_TIMEOUT_MS) {
        sessionStorage.removeItem('dtr_auth');
        sessionStorage.removeItem('dtr_last_active');
        setIsAuthenticated(false);
        setTimedOut(true);
      }
    };

    recordActivity();
    const interval = setInterval(checkTimeout, 10000);
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, recordActivity, { passive: true }));

    return () => {
      clearInterval(interval);
      events.forEach((ev) => window.removeEventListener(ev, recordActivity));
    };
  }, [isElectron, isAuthenticated]);

  const handleLogin = () => {
    sessionStorage.setItem('dtr_auth', 'true');
    sessionStorage.setItem('dtr_last_active', String(Date.now()));
    setIsAuthenticated(true);
    setTimedOut(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('dtr_auth');
    sessionStorage.removeItem('dtr_last_active');
    setIsAuthenticated(false);
    setTimedOut(false);
  };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Router>
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/" replace />
              ) : (
                <LoginPage onLogin={handleLogin} timedOut={timedOut} />
              )
            }
          />
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <DtrUploader onLogout={isElectron ? undefined : handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
