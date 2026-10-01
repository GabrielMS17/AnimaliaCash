import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { supabase } from '../supabase';

export default function LoginScreen({ onLoginSuccess }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const handleLogin = async () => {
    if (!identifier || !password) {
      if (Platform.OS === 'web') alert('Por favor, preencha todos os campos.');
      else Alert.alert('Atenção', 'Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);

    let emailInput = identifier.trim();
    if (!emailInput.includes('@')) {
      emailInput = `${emailInput.replace(/\s+/g, '').toLowerCase()}@veterinaria.com`;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: password,
      });

      if (error) throw error;

      console.log('Login efetuado com sucesso:', data);

      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error) {
      console.error('Erro de Autenticação:', error);
      const mensagem = error.message || 'Ocorreu um erro ao conectar.';
      if (Platform.OS === 'web') {
        alert(`Erro de Autenticação: ${mensagem}`);
      } else {
        Alert.alert('Erro na autenticação', mensagem);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {Platform.OS === 'web' && (
        <style type="text/css">{`
          html, body, #root {
            margin: 0 !important;
            padding: 0 !important;
            width: 100%;
            height: 100%;
            background-color: #F4F7F6;
          }
        `}</style>
      )}

      {/* Navbar Superior */}
      <View style={styles.topBar}>
        <Text style={styles.logoText}>Animalia Cash</Text>
        <Text style={styles.subLogoText}>Clínica Veterinária Vida Animal</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Card do Formulário */}
        <View style={[styles.card, isMobile && styles.cardMobile]}>
          <Text style={styles.title}>Acesse a Plataforma</Text>
          <Text style={styles.subtitle}>
            Entre com seu E-mail / CRMV e senha para continuar
          </Text>

          {/* Campo Identificador */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>E-mail ou CRMV</Text>
            <TextInput
              style={styles.input}
              placeholder="exemplo@veterinaria.com ou CRMV 1234"
              placeholderTextColor="#94A3B8"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Campo Senha */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite sua senha"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Botão de Entrar */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Entrar</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F6',
  },
  topBar: {
    width: '100%',
    backgroundColor: '#0F172A',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
  },
  logoText: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 22,
  },
  subLogoText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 70,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    padding: 28,
    borderLeftWidth: 5,
    borderLeftColor: '#10B981',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardMobile: {
    width: '92%',
    padding: 22,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  primaryButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});