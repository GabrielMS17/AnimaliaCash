import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// Projeto padrão do repositório. Para usar outro projeto (ex: ambiente de teste),
// defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local.
const DEFAULT_SUPABASE_URL = 'https://egluyuudrfmkeqrcpnbw.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbHV5dXVkcmZta2VxcmNwbmJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MjkxNzAsImV4cCI6MjEwNjMwNTE3MH0.ofgRw0BPa8SZQZ81DteeWMB13N6VxdkFptLBl9enLB0';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isUsingDefaultSupabase = SUPABASE_URL === DEFAULT_SUPABASE_URL;

// Adaptação para evitar o erro 'window is not defined' na Web/SSR
const customStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') return null;
    return AsyncStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (typeof window === 'undefined') return;
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (typeof window === 'undefined') return;
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
