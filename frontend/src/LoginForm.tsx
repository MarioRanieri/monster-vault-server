import { useState } from 'react';

// Modal di login admin (classi .auth-* del vecchio). Le credenziali vanno al
// genitore via onLogin; onGuest = continua in sola lettura.
export function LoginForm({
  onLogin,
  error,
  onGuest,
}: {
  onLogin: (username: string, password: string) => void;
  error?: string | null;
  onGuest?: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

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
        <div className="auth-title">Admin access</div>
        <div className="auth-sub">
          Enter your credentials to manage the collection.
          <br />
          Others can browse in read-only mode.
        </div>
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            onLogin(username, password);
          }}
        >
          <input
            className="auth-input"
            aria-label="Username"
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <div className="auth-pw-wrap">
            <input
              className="auth-input"
              aria-label="Password"
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="auth-pw-eye"
              aria-label={showPw ? 'Hide password' : 'Show password'}
              aria-pressed={showPw}
              onClick={() => setShowPw((v) => !v)}
            >
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
            </button>
          </div>
          {error && (
            <p className="auth-required-msg" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="auth-google-btn">
            Sign in
          </button>
        </form>
        {onGuest && (
          <button type="button" className="auth-public-btn" onClick={onGuest}>
            Continue in read-only mode &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
