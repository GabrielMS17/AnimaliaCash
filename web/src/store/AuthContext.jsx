import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { isKnownRole, VETERINARIAN_ROLE } from '../utils/accessControl';

const AuthContext = createContext(null);

// Login real pelo Supabase, com as mesmas contas e perfis de acesso do app em React Native.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // O perfil (Administrador ou Veterinário) vem da tabela profiles, como no app
  const [roleState, setRoleState] = useState({ userId: null, role: null });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id ?? null;
  const metadataRole = session?.user?.user_metadata?.role ?? null;

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('Erro ao carregar o perfil de acesso:', error);
        if (active) setRoleState({ userId, role: data?.role ?? metadataRole ?? VETERINARIAN_ROLE });
      });
    return () => {
      active = false;
    };
  }, [userId, metadataRole]);

  const login = async (identifier, password) => {
    const value = identifier.trim();
    const email = value.includes('@') ? value : `${value.replace(/\s+/g, '').toLowerCase()}@veterinaria.com`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Mesmas regras do login do app: conta inativa ou perfil desconhecido não entram
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('status, role')
      .eq('id', data.user.id)
      .maybeSingle();
    if (profileError) console.error('Erro ao consultar o perfil após autenticação:', profileError);

    if (profile?.status === 'Inativo') {
      await supabase.auth.signOut();
      throw new Error('Acesso negado. Esta conta encontra-se inativa no sistema.');
    }
    const role = profile?.role ?? data.user.user_metadata?.role ?? VETERINARIAN_ROLE;
    if (!isKnownRole(role)) {
      await supabase.auth.signOut();
      throw new Error('Não foi possível identificar seu perfil de acesso. Solicite ajuda a um administrador.');
    }
  };

  const logout = () => supabase.auth.signOut();

  const roleLoaded = !userId || roleState.userId === userId;
  const role = userId && roleLoaded ? roleState.role : null;

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, sessionLoaded, role, roleLoaded, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
