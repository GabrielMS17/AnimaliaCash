import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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

  // Estados para o Pop-up de Erro Customizado
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const handleLogin = async () => {
    if (!identifier || !password) {
      setErrorMessage('Por favor, preencha todos os campos.');
      setErrorModalVisible(true);
      return;
    }

    setLoading(true);
    const rejectAuthenticatedSession = async () => {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) console.error('Erro ao encerrar uma sessão sem permissões:', signOutError);
    };

    let emailInput = identifier.trim();
    if (!emailInput.includes('@')) {
      emailInput = `${emailInput.replace(/\s+/g, '').toLowerCase()}@veterinaria.com`;
    }

    try {
      // 1. Efetua a autenticação padrão pelo Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: password,
      });

      if (error) throw error;

      const user = data.user;

      if (user) {
        // 2. Consulta a tabela profiles para verificar o status e permissões do colaborador
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('status, role')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Erro ao consultar o perfil após autenticação:', profileError);
        }

        if (profile?.status === 'Inativo') {
          await rejectAuthenticatedSession();
          throw new Error('Acesso negado. Esta conta encontra-se inativa no sistema.');
        }

        const role = profile?.role ?? user.user_metadata?.role ?? 'Veterinário';
        
        // Permite o acesso para Administrador, Veterinário e Esteticista Animal
        if (role !== 'Administrador' && role !== 'Veterinário' && role !== 'Esteticista Animal') {
          await rejectAuthenticatedSession();
          throw new Error('Não foi possível identificar seu perfil de acesso. Solicite ajuda a um administrador.');
        }
      }

      console.log('Login efetuado com sucesso:', data);

      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error) {
      console.error('Erro de Autenticação:', error);
      
      // Traduz mensagens técnicas do Supabase para uma linguagem amigável
      let mensagem = error.message;
      if (mensagem.includes('Invalid login credentials')) {
        mensagem = 'E-mail ou senha incorretos. Verifique os seus dados e tente novamente.';
      }

      setErrorMessage(mensagem || 'Ocorreu um erro ao conectar.');
      setErrorModalVisible(true);
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
            Entre com seu E-mail e senha para continuar
          </Text>

          {/* Campo Identificador */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="exemplo@veterinaria.com"
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

        {/* MODAL / POP-UP DE ERRO CUSTOMIZADO */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={errorModalVisible}
          onRequestClose={() => setErrorModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.errorModalContent}>
              <View style={styles.errorIconCircle}>
                <Text style={styles.errorCheckmark}>!</Text>
              </View>

              <Text style={styles.errorTitle}>Atenção</Text>
              <Text style={styles.errorMessageText}>{errorMessage}</Text>

              <TouchableOpacity
                style={styles.errorButton}
                activeOpacity={0.8}
                onPress={() => setErrorModalVisible(false)}
              >
                <Text style={styles.errorButtonText}>Tentar Novamente</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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

  // Estilos do Modal de Erro Customizado
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 4,
  },
  errorIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorCheckmark: {
    color: '#DC2626',
    fontSize: 26,
    fontWeight: '800',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY_DARK,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessageText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: PRIMARY_DARK,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorButtonText: {
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