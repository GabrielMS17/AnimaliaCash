import { useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Banho from './pages/BanhoTosa';
import Cadastros from './pages/Cadastros';
import Cirurgia from './pages/Cirurgia';
import Configuracoes from './pages/Configuracoes';
import Custos from './pages/Custos';
import Estoque from './pages/Estoque';
import Internacao from './pages/Internacao';
import Login from './pages/Login';
import Templates from './pages/Templates';
import { useAuth } from './store/AuthContext';
import { canAccessRoute, isKnownRole, landingRoute } from './utils/accessControl';

function UnknownRole() {
  const { logout } = useAuth();
  const [error, setError] = useState('');

  const leave = async () => {
    setError('');
    const { error: signOutError } = await logout();
    if (signOutError) setError('Não foi possível encerrar a sessão. Tente novamente.');
  };

  return (
    <div className="page-loading page-blocked" role="alert">
      <p>Seu perfil não está configurado para acessar o Animalia Cash. Entre em contato com um administrador.</p>
      <button type="button" className="btn btn-login" onClick={leave}>Voltar ao login</button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

// Exige login e libera só as telas do perfil (Administrador ou Veterinário), como no app
function RequireAuth() {
  const { user, sessionLoaded, role, roleLoaded } = useAuth();
  const { pathname } = useLocation();

  if (!sessionLoaded || (user && !roleLoaded)) return <div className="page-loading" role="status">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isKnownRole(role)) return <UnknownRole />;
  if (!canAccessRoute(role, pathname)) return <Navigate to={landingRoute(role)} replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/cadastros" element={<Cadastros />} />
          <Route path="/custos" element={<Custos />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/banho-tosa" element={<Banho />} />
          <Route path="/cirurgia" element={<Cirurgia />} />
          <Route path="/internacao" element={<Internacao />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
