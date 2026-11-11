# SPEC-pretty-urls: Clean URLs & Tracking Parameter Cleanup

## 1. Objective
Enable clean HTML5 History URLs on the Netlify web deployment (removing `/#/`), define explicit subpaths (`/login` and `/`), automatically strip external social/advertising tracking parameters (`?fbclid=*`, `utm_*`) from the browser address bar upon load, and preserve `HashRouter` compatibility for the Electron desktop application.

## 2. Routing Architecture
- **Dual Router Selection**:
  - **Web (`!window.electronAPI`)**: Uses `BrowserRouter` for standard clean pathnames (`/`, `/login`).
  - **Desktop (`!!window.electronAPI`)**: Uses `HashRouter` to ensure complete asset and protocol compatibility under Electron's `file://` scheme.
- **Explicit Subpaths**:
  - `/login`: Renders `LoginPage`. If user is already authenticated (or running Electron), redirects to `/`.
  - `/`: Renders `DtrUploader` (converter). If user is unauthenticated on web, redirects to `/login`.
  - `*`: Catch-all route redirecting to `/`.
- **Navigation & Auth Transitions**:
  - Successful passcode submission navigates to `/`.
  - Manual logout or 30-minute idle session timeout clears session tokens and navigates to `/login` (displaying the session timeout notice if triggered by idle timer).

## 3. Tracking Parameter Cleanup
- **Scope**: Executed on application mount in web environments.
- **Behavior**: Inspects `window.location.search`. If query parameters matching tracking keys (e.g. `fbclid`, `utm_*`) are present:
  - Removes matching parameters using URLSearchParams.
  - Updates address bar in place using `window.history.replaceState({}, document.title, cleanPath)` without causing page reload or router reinitialization.

## 4. Netlify SPA Rewrite
- Existing `netlify.toml` already ensures all subpaths rewrite to `/index.html`:
  ```toml
  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
  ```

## 5. Verification
- `npm run build`: Verifies TypeScript compilation and production bundle generation.
- `npm run preview`: Verifies routing, URL cleanliness, parameter sanitization, and auth transitions in standard browser environment.

