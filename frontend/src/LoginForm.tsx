import { useState } from 'react';

// Form di login controllato; comunica le credenziali al genitore via onLogin.
export function LoginForm({
  onLogin,
  error,
}: {
  onLogin: (username: string, password: string) => void;
  error?: string | null;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form
      className="login"
      onSubmit={(e) => {
        e.preventDefault();
        onLogin(username, password);
      }}
    >
      <input aria-label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input
        aria-label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Accedi</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
