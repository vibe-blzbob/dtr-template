import React, { useState } from 'react';
import { Button } from '../../../components/Button';
import { Lock } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);

  const expectedPasscode = import.meta.env.VITE_APP_PASSCODE || 'dtr2026';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === expectedPasscode) {
      sessionStorage.setItem('dtr_auth', 'true');
      onLogin();
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-sm w-full border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
            <Lock size={24} />
          </div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">DTR Template</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter passcode to access converter</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              autoFocus
              placeholder="Enter passcode"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                if (error) setError(false);
              }}
              className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md shadow-sm p-2.5 text-sm border focus:ring-blue-500 focus:border-blue-500"
            />
            {error && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 font-medium">
                Incorrect passcode. Please try again.
              </p>
            )}
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            Unlock
          </Button>
        </form>
      </div>
    </div>
  );
};

