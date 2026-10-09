import { useRouter } from 'expo-router';
import { supabase } from '../supabase';

// Encerra a sessão no Supabase e volta para a tela de login
export function useLogout() {
  const router = useRouter();

  return async () => {
    await supabase.auth.signOut();
    router.replace('/Login');
  };
}
