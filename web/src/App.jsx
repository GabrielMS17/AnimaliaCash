import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Banho from './pages/BanhoTosa';
import Cirurgia from './pages/Cirurgia';
import Configuracoes from './pages/Configuracoes';
import Custos from './pages/Custos';
import Estoque from './pages/Estoque';
import Home from './pages/Home';
import Insumos from './pages/Insumos';
import Internacao from './pages/Internacao';
import Login from './pages/Login';
import Templates from './pages/Templates';
import { useAuth } from './store/AuthContext';

function RequireAuth() {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/banho-tosa" element={<Banho />} />
          <Route path="/cirurgia" element={<Cirurgia />} />
          <Route path="/internacao" element={<Internacao />} />
          <Route path="/insumos" element={<Insumos />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/custos" element={<Custos />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
