import { useState } from 'react';
import { useAuthStore } from './authStore';

// Pannello "Account & security" (admin): cambio password + generazione del codice
// di recupero (mostrato una sola volta). Riusa il guscio modale di Stats.
export function AccountPanel({ onClose }: { onClose: () => void }) {
  const changePassword = useAuthStore((s) => s.changePassword);
  const generateRecoveryCode = useAuthStore((s) => s.generateRecoveryCode);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const [code, setCode] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const submitPw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    setPwBusy(true);
    const res = await changePassword(current, next);
    setPwBusy(false);
    if (res.ok) {
      setPwMsg({ ok: true, text: 'Password changed ✓' });
      setCurrent('');
      setNext('');
    } else {
      setPwMsg({ ok: false, text: res.error ?? 'Something went wrong' });
    }
  };

  const genCode = async () => {
    setCodeBusy(true);
    const c = await generateRecoveryCode();
    setCodeBusy(false);
    setCode(c);
    setCopied(false);
  };

  return (
    <div
      className="modal-backdrop open"
      role="dialog"
      aria-modal="true"
      aria-label="Account & security"
    >
      <div className="stats-modal">
        <div className="modal-header">
          <div className="modal-title">Account &amp; security</div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="chart-section">
            <div className="chart-title">Change password</div>
            <form className="account-form" onSubmit={submitPw}>
              <input
                className="account-input"
                type="password"
                aria-label="Current password"
                placeholder="Current password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
              <input
                className="account-input"
                type="password"
                aria-label="New password"
                placeholder="New password (min 8 chars)"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              {pwMsg && (
                <p className={pwMsg.ok ? 'auth-success' : 'auth-required-msg'} role="status">
                  {pwMsg.text}
                </p>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={pwBusy || !current || next.length < 8}
              >
                {pwBusy ? 'Saving…' : 'Change password'}
              </button>
            </form>
          </div>

          <div className="chart-section">
            <div className="chart-title">Recovery code</div>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>
              A one-time code to reset your password if you get locked out. It is shown once — save
              it somewhere safe. Generating a new one replaces the previous.
            </p>
            {code ? (
              <div className="recovery-code-box">
                <code className="recovery-code">{code}</code>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    void navigator.clipboard?.writeText(code);
                    setCopied(true);
                  }}
                >
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
                <p className="auth-caps">⚠ Save it now — you won’t see it again.</p>
              </div>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={genCode} disabled={codeBusy}>
                {codeBusy ? 'Generating…' : 'Generate recovery code'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
