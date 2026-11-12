import { createClient } from '@supabase/supabase-js';

// Mesmo projeto padrão do app em React Native, para as duas versões usarem o mesmo banco.
// Para usar outro projeto, defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em web/.env.local.
const DEFAULT_SUPABASE_URL = 'https://egluyuudrfmkeqrcpnbw.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbHV5dXVkcmZta2VxcmNwbmJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MjkxNzAsImV4cCI6MjEwNjMwNTE3MH0.ofgRw0BPa8SZQZ81DteeWMB13N6VxdkFptLBl9enLB0';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cliente sem sessão salva, usado só para criar contas de colaboradores:
// o cadastro não troca a sessão de quem está logado (no app ela é restaurada depois).
export const signUpClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'animalia-signup' },
});
