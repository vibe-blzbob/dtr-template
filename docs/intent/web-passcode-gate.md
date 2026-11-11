# Intent: Web Passcode Gate

- **Outcome**: Add a lightweight passcode login screen that protects the web version on Netlify while allowing the Electron desktop app to bypass it automatically.
- **User**: Authorized staff accessing the public Netlify deployment.
- **Why now**: The web version will be publicly hosted online and needs access control so arbitrary internet visitors cannot view or use the converter.
- **Success**: Web visitors must enter the correct passcode (configurable via environment variable `VITE_APP_PASSCODE` with a default fallback) to access `DtrUploader`; authenticated state persists in `sessionStorage` with a logout button; Electron desktop app detects `window.electronAPI` and bypasses the login screen entirely.
- **Constraint**: Minimal diff adhering to `/ponytail`, zero backend dependencies, no database, purely client-side verification.
- **Out of scope**: Multi-user account management, database authentication, OAuth, or password recovery flows.

