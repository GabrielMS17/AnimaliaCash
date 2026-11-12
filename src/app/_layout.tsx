import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AnimaliaDataProvider, useAnimaliaData } from '../store/AnimaliaDataContext';
import { supabase } from '../supabase';
import { canAccessRoute, isKnownRole } from '../utils/accessControl';

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
  const { session, sessionLoaded, role, roleLoaded, roleUserId } = useAnimaliaData();
  const router = useRouter();
  const segments = useSegments();
  const [logoutError, setLogoutError] = useState('');
  const currentRoute = segments.length > 0 ? `/${segments[0]}` : '/';
  const roleLoadedForSession = !session || (roleLoaded && roleUserId === session.user.id);

  useEffect(() => {
    if (!sessionLoaded || !LOGIN_OBRIGATORIO) return;

    const inAuthGroup = segments[0] === 'Login';

    if (!session && !inAuthGroup) {
      router.replace('/Login');
    } else if (session && roleLoadedForSession) {
      if (inAuthGroup || !canAccessRoute(role, currentRoute)) {
        router.replace(role === 'Veterinário' ? '/banho-tosa' : '/');
      }
    }
  }, [session, sessionLoaded, role, roleLoadedForSession, currentRoute, segments, router]);

  if (LOGIN_OBRIGATORIO && (!sessionLoaded || (session && !roleLoadedForSession))) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (LOGIN_OBRIGATORIO && session && !isKnownRole(role)) {
    const handleLogout = async () => {
      setLogoutError('');
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        router.replace('/Login');
      } catch (error) {
        console.error('Erro ao sair de um perfil sem permissões:', error);
        setLogoutError('Não foi possível encerrar a sessão. Tente novamente.');
      }
    };

    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0F172A' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
          Seu perfil não está configurado para acessar o Animalia Cash. Entre em contato com um administrador.
        </Text>
        <Pressable onPress={handleLogout} style={{ paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#10B981', borderRadius: 8 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Voltar ao login</Text>
        </Pressable>
        {logoutError ? <Text style={{ color: '#FCA5A5', marginTop: 12 }}>{logoutError}</Text> : null}
      </View>
    );
  }

  if (LOGIN_OBRIGATORIO && session && !canAccessRoute(role, currentRoute)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return <Slot />;
}
