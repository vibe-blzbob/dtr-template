# SPEC-web-passcode-gate: Web Passcode Gatekeeper

## 1. Objective
Add a lightweight, client-side shared passcode login gate for web deployments (Netlify) to prevent unauthorized public access to the DTR template converter, while permitting Electron desktop application users to bypass the gate automatically.

## 2. Authentication Logic
- **Electron Detection**: Check `!!window.electronAPI`. If true, bypass authentication entirely (`isAuthenticated = true`).
- **Web Session Authentication**:
  - State persisted via `sessionStorage.getItem('dtr_auth') === 'true'`.
  - Passcode configured via `import.meta.env.VITE_APP_PASSCODE` (fallback default: `'dtr2026'`).
  - Correct passcode sets `sessionStorage.setItem('dtr_auth', 'true')`.
  - Logout clears `sessionStorage.removeItem('dtr_auth')` and returns the user to the login screen.

## 3. UI Components
- **`LoginPage.tsx`**:
  - Centered responsive card matching existing dark/light mode palette.
  - Password input field with error feedback for incorrect attempts.
  - Unlock button.
- **`App.tsx`**:
  - Evaluates authentication state on mount.
  - Renders `<LoginPage />` if unauthenticated on web, or `<DtrUploader />` when authenticated.
- **`DtrUploader.tsx`**:
  - Displays a "Log Out" button in the top action bar when running in web mode (`!window.electronAPI`).

## 4. Verification Commands
- `npm run build`: Type-checks and compiles production bundle with Vite.
- `npm run preview`: Verifies web login gate in browser without Electron APIs.

