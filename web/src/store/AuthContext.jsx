import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext(null);

// Login real pelo Supabase, com as mesmas contas do app em React Native.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async (identifier, password) => {
    const value = identifier.trim();
    const email = value.includes('@') ? value : `${value.replace(/\s+/g, '').toLowerCase()}@veterinaria.com`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const logout = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, sessionLoaded, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
