import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DtrUploader } from './features/dtr/components/DtrUploader';
import { LoginPage } from './features/auth/components/LoginPage';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (isElectron) return true;
    return sessionStorage.getItem('dtr_auth') === 'true';
  });

  const handleLogout = () => {
    sessionStorage.removeItem('dtr_auth');
    setIsAuthenticated(false);
  };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <HashRouter>
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <DtrUploader onLogout={isElectron ? undefined : handleLogout} />
              ) : (
                <LoginPage onLogin={() => setIsAuthenticated(true)} />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;
