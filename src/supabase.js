import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const DEFAULT_SUPABASE_URL = 'https://egluyuudrfmkeqrcpnbw.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbHV5dXVkcmZta2VxcmNwbmJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MjkxNzAsImV4cCI6MjEwNjMwNTE3MH0.ofgRw0BPa8SZQZ81DteeWMB13N6VxdkFptLBl9enLB0';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isUsingDefaultSupabase = SUPABASE_URL === DEFAULT_SUPABASE_URL;

const secureStorageAdapter = {
  getItem: async (key) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      return localStorage.setItem(key, value);
    }
    return await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      return localStorage.removeItem(key);
    }
    return await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});