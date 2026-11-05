import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { SECTIONS } from './ui';

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const leave = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="avatar"
        aria-label={`Conta de ${user.email}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {user.email.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div className="user-dropdown">
          <div className="user-dropdown-head">
            <span>Conectado como</span>
            <strong>{user.email}</strong>
          </div>
          <button type="button" onClick={leave}>Entrar com outro usuário</button>
          <button type="button" className="danger-text" onClick={leave}>Sair</button>
        </div>
      )}
    </div>
  );
}

/** Moldura das telas: cabeçalho, navegação entre módulos, conteúdo e rodapé. */
export default function Layout() {
  const { pathname } = useLocation();
  const section = SECTIONS.find((item) => item.path === pathname) ?? SECTIONS[0];

  return (
    <div className="app" style={{ '--accent': section.accent, '--accent-soft': section.soft }}>
      <header className="app-header">
        <Link to="/" className="brand" aria-label="Ir para a tela inicial">
          <span className="brand-title">Animalia<em>Cash</em></span>
          <span className="brand-tagline">SOLUÇÕES FINANCEIRAS</span>
        </Link>
        <UserMenu />
      </header>

      <nav className="module-nav" aria-label="Módulos">
        {SECTIONS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end
            style={item.path === pathname ? { borderBottomColor: item.accent } : undefined}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="content">
        <Outlet />
      </main>

      <footer className="app-footer">
        <strong>© {new Date().getFullYear()} Animalia Cash — Soluções Financeiras</strong>
        <span>Todos os direitos reservados.</span>
      </footer>
    </div>
  );
}
