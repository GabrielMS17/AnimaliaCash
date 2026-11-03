import { createContext, useContext, useState } from 'react';
import { readStorage, writeStorage } from './storage';

const KEY = 'animalia_web_user';
const AuthContext = createContext(null);

// Login simulado: esta versão ainda não usa banco de dados, então qualquer usuário preenchido entra.
// A senha não é conferida nem guardada. Fica aqui o ponto de troca pelo login real (Supabase).
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStorage(KEY));

  const login = (identifier) => {
    const value = identifier.trim();
    const email = value.includes('@') ? value : `${value.replace(/\s+/g, '').toLowerCase()}@veterinaria.com`;
    const next = { email };
    writeStorage(KEY, next);
    setUser(next);
  };

  const logout = () => {
    writeStorage(KEY, null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
