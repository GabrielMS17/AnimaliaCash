import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    login(identifier);
  };

  return (
    <div className="login-page">
      <header className="app-header app-header-center">
        <div className="brand">
          <span className="brand-title">Animalia<em>Cash</em></span>
          <span className="brand-tagline">SOLUÇÕES FINANCEIRAS</span>
        </div>
      </header>

      <main className="login-main">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <h1>Acesse a Plataforma</h1>
          <p className="muted">Entre com seu E-mail / CRMV e senha para continuar</p>

          {error && <div className="error-banner" role="alert">{error}</div>}

          <label className="field">
            <span className="field-label">E-mail ou CRMV</span>
            <input
              type="text"
              autoComplete="username"
              placeholder="exemplo@veterinaria.com ou CRMV 1234"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button type="submit" className="btn btn-login">Entrar</button>

          <p className="demo-note">Versão de demonstração: o acesso é simulado e os dados ficam só neste navegador. Não use uma senha real.</p>
        </form>

        <footer className="app-footer">
          <strong>© {new Date().getFullYear()} Animalia Cash — Soluções Financeiras</strong>
          <span>Todos os direitos reservados.</span>
        </footer>
      </main>
    </div>
  );
}
