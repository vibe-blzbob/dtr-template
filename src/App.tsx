import { HashRouter, Routes, Route } from 'react-router-dom';
import { DtrUploader } from './features/dtr/components/DtrUploader';
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
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<DtrUploader />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;

