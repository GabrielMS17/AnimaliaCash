import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import DevNavBar from '../components/DevNavBar';
import { AnimaliaDataProvider, useAnimaliaData } from '../store/AnimaliaDataContext';

// Exige login para acessar o app. Use false só para testes locais sem autenticação.
const LOGIN_OBRIGATORIO = true;

export default function RootLayout() {
  return (
    <AnimaliaDataProvider>
      <AuthGate />
    </AnimaliaDataProvider>
  );
}

// A sessão vem do AnimaliaDataProvider, que é a única parte do app que escuta o login do Supabase
function AuthGate() {
  const { session, sessionLoaded } = useAnimaliaData();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!sessionLoaded || !LOGIN_OBRIGATORIO) return;

    const inAuthGroup = segments[0] === 'Login';

    if (!session && !inAuthGroup) {
      // Se não está logado, manda para o Login
      router.replace('/Login');
    } else if (session && inAuthGroup) {
      // Se já está logado e tenta acessar o Login, manda para a tela inicial
      router.replace('/');
    }
  }, [session, sessionLoaded, segments, router]);

  if (!sessionLoaded && LOGIN_OBRIGATORIO) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <DevNavBar />
      <Slot />
    </View>
  );
}
