import { useState } from 'react';
import type { Result } from './authStore';

// Icone inline (utente / lucchetto / occhio) per non aggiungere dipendenze.
const UserIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const LockIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const KeyIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M21 2l-2 2m-3.5 3.5a4.5 4.5 0 1 0-6 6l-5 5V22h3l1-1h2v-2h2v-2l1.5-1.5" />
  </svg>
);

// Modal di login admin (classi .auth-*). Due modalità: login e recupero password
// tramite codice. Le azioni arrivano dal genitore (authStore).
export function LoginForm({
  onLogin,
  error,
  onGuest,
  onRecover,
}: {
  onLogin: (username: string, password: string) => void | Promise<void>;
  error?: string | null;
  onGuest?: () => void;
  onRecover?: (username: string, recoveryCode: string, newPassword: string) => Promise<Result>;
}) {
  const [mode, setMode] = useState<'login' | 'recover'>('login');

  // login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);

  // recover
  const [rUser, setRUser] = useState('');
  const [rCode, setRCode] = useState('');
  const [rNew, setRNew] = useState('');
  const [rError, setRError] = useState<string | null>(null);
  const [rDone, setRDone] = useState(false);
  const [rBusy, setRBusy] = useState(false);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || busy) return;
    setBusy(true);
    await onLogin(username, password);
    setBusy(false);
  };

  const submitRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRecover || rBusy) return;
    setRError(null);
    setRBusy(true);
    const res = await onRecover(rUser.trim(), rCode.trim(), rNew);
    setRBusy(false);
    if (res.ok) setRDone(true);
    else setRError(res.error ?? 'Reset failed');
  };

  return (
    <div
      className="auth-overlay"
      style={{ display: 'flex' }}
      role="dialog"
      aria-label="Admin access"
    >
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#a8ff00" />
            <path d="M16 5L7 27h4.5l1.5-5h6l1.5 5H25L16 5zm-1.5 14l1.5-6 1.5 6h-3z" fill="#000" />
          </svg>
          <div className="auth-logo-text">
            MONSTER <span>VAULT</span>
          </div>
        </div>

        {mode === 'login' ? (
          <>
            <div className="auth-title">Admin access</div>
            <div className="auth-sub">
              Enter your credentials to manage the collection.
              <br />
              Others can browse in read-only mode.
            </div>
            <form className="auth-form" onSubmit={submitLogin}>
              <label className="auth-label" htmlFor="auth-username">
                Username
              </label>
              <div className="auth-field">
                <span className="auth-field-icon">
                  <UserIcon />
                </span>
                <input
                  id="auth-username"
                  className="auth-input"
                  aria-label="Username"
                  placeholder="Username"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <label className="auth-label" htmlFor="auth-password">
                Password
              </label>
              <div className="auth-field">
                <span className="auth-field-icon">
                  <LockIcon />
                </span>
                <input
                  id="auth-password"
                  className="auth-input"
                  aria-label="Password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))}
                />
                <button
                  type="button"
                  className="auth-pw-eye"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  aria-pressed={showPw}
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {caps && <p className="auth-caps">⚠ Caps Lock is on</p>}

              {error && (
                <p className="auth-required-msg" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="auth-google-btn"
                disabled={busy || !username || !password}
              >
                {busy ? <span className="auth-spinner" aria-hidden="true" /> : 'Sign in'}
              </button>
            </form>

            {onRecover && (
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setMode('recover');
                  setRUser(username);
                }}
              >
                Forgot password?
              </button>
            )}
            {onGuest && (
              <button type="button" className="auth-public-btn" onClick={onGuest}>
                Continue in read-only mode &rarr;
              </button>
            )}
          </>
        ) : (
          <>
            <div className="auth-title">Reset password</div>
            <div className="auth-sub">
              Enter your <b>recovery code</b> and a new password.
              <br />
              The code is the one you saved when you generated it.
            </div>
            {rDone ? (
              <>
                <p className="auth-success" role="status">
                  ✓ Password updated. You can sign in now.
                </p>
                <button
                  type="button"
                  className="auth-google-btn"
                  onClick={() => {
                    setMode('login');
                    setRDone(false);
                    setRCode('');
                    setRNew('');
                  }}
                >
                  Back to sign in
                </button>
              </>
            ) : (
              <form className="auth-form" onSubmit={submitRecover}>
                <div className="auth-field">
                  <span className="auth-field-icon">
                    <UserIcon />
                  </span>
                  <input
                    className="auth-input"
                    aria-label="Username"
                    placeholder="Username"
                    autoComplete="username"
                    value={rUser}
                    onChange={(e) => setRUser(e.target.value)}
                  />
                </div>
                <div className="auth-field">
                  <span className="auth-field-icon">
                    <KeyIcon />
                  </span>
                  <input
                    className="auth-input"
                    aria-label="Recovery code"
                    placeholder="MV-XXXX-XXXX-XXXX"
                    value={rCode}
                    onChange={(e) => setRCode(e.target.value)}
                  />
                </div>
                <div className="auth-field">
                  <span className="auth-field-icon">
                    <LockIcon />
                  </span>
                  <input
                    className="auth-input"
                    aria-label="New password"
                    type="password"
                    placeholder="New password (min 8 chars)"
                    autoComplete="new-password"
                    value={rNew}
                    onChange={(e) => setRNew(e.target.value)}
                  />
                </div>
                {rError && (
                  <p className="auth-required-msg" role="alert">
                    {rError}
                  </p>
                )}
                <button
                  type="submit"
                  className="auth-google-btn"
                  disabled={rBusy || !rUser || !rCode || rNew.length < 8}
                >
                  {rBusy ? <span className="auth-spinner" aria-hidden="true" /> : 'Reset password'}
                </button>
              </form>
            )}
            <button type="button" className="auth-link" onClick={() => setMode('login')}>
              &larr; Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
