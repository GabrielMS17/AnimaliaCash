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
import { supabase } from '../../supabase';

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
      style={styles.mainWrapper}
    >
      {Platform.OS === 'web' && (
        <style type="text/css">{`
          html, body, #root {
            margin: 0 !important;
            padding: 0 !important;
            width: 100%;
            height: 100%;
            background-color: #F8FAFC;
          }
        `}</style>
      )}

      {/* Header Institucional Padronizado */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.brandTitle}>
            Animalia<Text style={styles.brandSubtitle}>Cash</Text>
          </Text>
          <Text style={styles.brandTagline}>SOLUÇÕES FINANCEIRAS</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
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

          {/* Botão de Entrar (Ação Primária em Verde ACCENT_GREEN) */}
          <TouchableOpacity
            style={styles.buttonPrimary}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Rodapé Corporativo */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} Animalia Cash — Soluções Financeiras
          </Text>
          <Text style={styles.footerSubtext}>Todos os direitos reservados.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const PRIMARY_DARK = '#0C2D48';
const ACCENT_GREEN = '#00A86B';
const BG_LIGHT = '#F8FAFC';

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  headerContainer: {
    backgroundColor: PRIMARY_DARK,
    paddingTop: Platform.OS === 'ios' ? 44 : 15,
    paddingBottom: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    alignItems: 'center',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    color: ACCENT_GREEN,
  },
  brandTagline: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: -2,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    padding: 28,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 5,
    borderLeftColor: ACCENT_GREEN,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardMobile: {
    width: '100%',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: PRIMARY_DARK,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY_DARK,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: PRIMARY_DARK,
  },
  buttonPrimary: {
    backgroundColor: ACCENT_GREEN,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footerContainer: {
    marginTop: 32,
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  footerSubtext: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
});