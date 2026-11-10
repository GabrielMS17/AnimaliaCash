import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import AppHeader from '../../components/AppHeader';
import { supabase } from '../../supabase';

export default function CadastrosScreen() {
  const [perfis, setPerfis] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados do Modal de Cadastro
  const [modalVisible, setModalVisible] = useState(false);
  const [nomeInput, setNomeInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [roleInput, setRoleInput] = useState('Veterinário');
  const [crmvInput, setCrmvInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Estado para o Pop-up de Sucesso Customizado
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  const rolesOpcoes = ['Administrador', 'Veterinário'];

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setPerfis(data || []);
    } catch (error) {
      console.error('Erro ao buscar perfis:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!nomeInput || !emailInput || !senhaInput) {
      alert('Por favor, preencha o Nome, o E-mail institucional e a Senha provisória.');
      return;
    }

    if (senhaInput.length < 6) {
      alert('A senha provisória deve conter pelo menos 6 caracteres.');
      return;
    }

    if (roleInput === 'Veterinário' && !crmvInput.trim()) {
      alert('O CRMV é obrigatório para cadastros com o perfil de Veterinário.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Guarda a sessão atual (Administrador) para restaurá-la depois do cadastro
      const { data: currentSessionData } = await supabase.auth.getSession();
      const adminSession = currentSessionData?.session;

      // 2. Cria o utilizador no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailInput.trim(),
        password: senhaInput,
        options: {
          data: {
            nome: nomeInput,
            role: roleInput,
          },
        },
      });

      if (authError) throw authError;

      const userId = authData.user ? authData.user.id : null;

      if (!userId) {
        throw new Error('Não foi possível obter o ID de autenticação do utilizador.');
      }

      // 3. Insere os dados complementares na tabela profiles usando o mesmo UUID do Auth
      const payload = {
        id: userId,
        nome: nomeInput,
        email: emailInput.trim(),
        role: roleInput,
        crmv: roleInput === 'Veterinário' ? crmvInput.trim() : null,
        status: 'Ativo',
      };

      const { error: profileError } = await supabase.from('profiles').insert([payload]);

      if (profileError) throw profileError;

      // 4. RESTAURA A SESSÃO DO ADMINISTRADOR ORIGINAL (Evita que o admin vire o novo usuário)
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      }

      // Limpa os campos e fecha o modal de cadastro
      setNomeInput('');
      setEmailInput('');
      setSenhaInput('');
      setRoleInput('Veterinário');
      setCrmvInput('');
      setModalVisible(false);

      // Exibe o pop-up de sucesso customizado
      setSuccessModalVisible(true);

      fetchProfiles();
    } catch (error) {
      console.error('Erro ao cadastrar perfil:', error);
      alert(`Erro ao cadastrar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Função para alternar o status entre Ativo e Inativo
  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Inativo' ? 'Ativo' : 'Inativo';
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      fetchProfiles();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert(`Erro ao atualizar status: ${error.message}`);
    }
  };

  const getRoleColor = (role) => {
    if (role === 'Administrador') return '#0284C7';
    return ACCENT_GREEN;
  };

  const ativosCount = perfis.filter(p => p.status !== 'Inativo').length;

  return (
    <View style={styles.mainWrapper}>
      <AppHeader />

      <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
        {/* Banner de Cabeçalho */}
        <View style={styles.heroBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Gestão de Colaboradores</Text>
            <Text style={styles.heroSubtitle}>
              Controle de acessos, credenciais de login e ativação de contas.
            </Text>
          </View>
          <View style={styles.heroCounterBox}>
            <Text style={styles.heroCounterNumber}>{ativosCount}</Text>
            <Text style={styles.heroCounterLabel}>Ativos</Text>
          </View>
        </View>

        {/* Botão de Ação */}
        <TouchableOpacity
          style={styles.buttonPrimary}
          activeOpacity={0.8}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.buttonText}>+ Adicionar Novo Colaborador</Text>
        </TouchableOpacity>

        {/* Listagem */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ACCENT_GREEN} />
            <Text style={styles.loadingText}>Carregando perfis...</Text>
          </View>
        ) : perfis.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyTitle}>Nenhum perfil encontrado</Text>
            <Text style={styles.emptyText}>
              Ainda não existem colaboradores registados na tabela profiles. Clique no botão acima para começar.
            </Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {perfis.map((p) => {
              const isInactive = p.status === 'Inativo';
              const roleColor = getRoleColor(p.role);

              return (
                <View key={p.id} style={[styles.profileCard, isInactive && styles.profileCardInactive]}>
                  <View style={[styles.cardIndicator, { backgroundColor: isInactive ? '#94A3B8' : roleColor }]} />
                  <View style={styles.cardContentInner}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardTopLeft}>
                        <View style={[styles.avatarCircle, isInactive && styles.avatarCircleInactive]}>
                          <Text style={[styles.avatarText, isInactive && { color: '#94A3B8' }]}>
                            {p.nome ? p.nome.charAt(0).toUpperCase() : 'U'}
                          </Text>
                        </View>
                        <View style={[styles.roleBadge, { backgroundColor: roleColor + '15', borderColor: roleColor }]}>
                          <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                            {p.role || 'Colaborador'}
                          </Text>
                        </View>
                      </View>

                      {/* Botão de Ativar/Desativar */}
                      <TouchableOpacity
                        style={[styles.statusToggleBtn, isInactive ? styles.btnActivate : styles.btnDeactivate]}
                        onPress={() => handleToggleStatus(p.id, p.status)}
                      >
                        <Text style={[styles.statusToggleText, isInactive ? styles.textActivate : styles.textDeactivate]}>
                          {isInactive ? 'Ativar' : 'Desativar'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.profileName, isInactive && styles.textStrikethrough]} numberOfLines={1}>
                      {p.nome}
                    </Text>
                    <Text style={styles.profileEmail} numberOfLines={1}>{p.email || 'E-mail não registado'}</Text>

                    {/* Exibe o CRMV se for Veterinário */}
                    {p.role === 'Veterinário' && (
                      <View style={styles.cardFooterRow}>
                        <Text style={styles.crmvLabel}>CRMV:</Text>
                        <Text style={styles.crmvValue}>{p.crmv ? p.crmv : 'Não informado'}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Modal de Cadastro */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Cadastrar Novo Colaborador</Text>

              {/* Nome */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Nome Completo *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Dra. Amanda Silva"
                  placeholderTextColor="#94A3B8"
                  value={nomeInput}
                  onChangeText={setNomeInput}
                  autoFocus={true}
                />
              </View>

              {/* E-mail Institucional */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>E-mail Institucional *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="amanda@animaliacash.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={emailInput}
                  onChangeText={setEmailInput}
                />
              </View>

              {/* Senha Provisória */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Senha Provisória de Acesso *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo de 6 caracteres"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  value={senhaInput}
                  onChangeText={setSenhaInput}
                />
              </View>

              {/* Função / Role */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Função / Perfil *</Text>
                <View style={styles.chipContainer}>
                  {rolesOpcoes.map((op) => {
                    const selecionado = roleInput === op;
                    return (
                      <TouchableOpacity
                        key={op}
                        style={[styles.chipButton, selecionado && styles.chipButtonActive]}
                        onPress={() => setRoleInput(op)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, selecionado && styles.chipTextActive]}>
                          {op}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* CRMV Obrigatório apenas se Veterinário */}
              {roleInput === 'Veterinário' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>CRMV * (Obrigatório para Veterinário)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: SP-12345"
                    placeholderTextColor="#94A3B8"
                    value={crmvInput}
                    onChangeText={setCrmvInput}
                  />
                </View>
              )}

              {/* Botões do Modal */}
              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSave]}
                  onPress={handleSaveProfile}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.modalButtonSaveText}>Criar Conta e Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL DE SUCESSO CUSTOMIZADO */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={successModalVisible}
          onRequestClose={() => setSuccessModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.successModalContent}>
              <View style={styles.successIconCircle}>
                <Text style={styles.successCheckmark}>✓</Text>
              </View>

              <Text style={styles.successTitle}>Colaborador Cadastrado!</Text>
              <Text style={styles.successMessage}>
                O registo foi efetuado com sucesso e a conta de acesso já está habilitada para realizar o login no sistema.
              </Text>

              <TouchableOpacity
                style={styles.successButton}
                activeOpacity={0.8}
                onPress={() => setSuccessModalVisible(false)}
              >
                <Text style={styles.successButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Rodapé */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>© {new Date().getFullYear()} Animalia Cash — Soluções Financeiras</Text>
          <Text style={styles.footerSubtext}>Todos os direitos reservados.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const PRIMARY_DARK = '#0C2D48';
const ACCENT_GREEN = '#00A86B';
const BG_LIGHT = '#F8FAFC';

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: BG_LIGHT },
  container: { flex: 1 },
  contentPadding: { padding: 16, paddingBottom: 32 },
  
  heroBanner: {
    backgroundColor: PRIMARY_DARK,
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
  },
  heroTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  heroSubtitle: { fontSize: 12, color: '#94A3B8', marginTop: 4, lineHeight: 16 },
  heroCounterBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroCounterNumber: { fontSize: 20, fontWeight: '800', color: ACCENT_GREEN },
  heroCounterLabel: { fontSize: 10, color: '#CBD5E1', fontWeight: '600', textTransform: 'uppercase' },

  buttonPrimary: {
    backgroundColor: ACCENT_GREEN,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: ACCENT_GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  gridContainer: { gap: 12 },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  profileCardInactive: {
    backgroundColor: '#F1F5F9',
    opacity: 0.75,
  },
  cardIndicator: { width: 6 },
  cardContentInner: { flex: 1, padding: 16 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  avatarCircleInactive: {
    backgroundColor: '#E2E8F0',
  },
  avatarText: { color: PRIMARY_DARK, fontSize: 16, fontWeight: '800' },
  roleBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1 },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  
  statusToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  btnDeactivate: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  textDeactivate: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },
  btnActivate: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  textActivate: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '700',
  },

  profileName: { fontSize: 16, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 2 },
  textStrikethrough: { color: '#64748B', textDecorationLine: 'line-through' },
  profileEmail: { fontSize: 13, color: '#64748B', marginBottom: 8 },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  crmvLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginRight: 6 },
  crmvValue: { fontSize: 12, color: PRIMARY_DARK, fontWeight: '700' },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyEmoji: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 4 },
  emptyText: { fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 18 },

  loadingContainer: { padding: 30, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, fontSize: 13, color: '#64748B', fontWeight: '600' },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 16 },
  inputContainer: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 6 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: PRIMARY_DARK,
  },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipButtonActive: { backgroundColor: PRIMARY_DARK, borderColor: PRIMARY_DARK },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  modalButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  modalButtonCancelText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  modalButtonSave: { backgroundColor: ACCENT_GREEN },
  modalButtonSaveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  successModalContent: {
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
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#86EFAC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successCheckmark: {
    color: '#16A34A',
    fontSize: 26,
    fontWeight: '800',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY_DARK,
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: ACCENT_GREEN,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  successButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  footerContainer: {
    marginTop: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },
  footerText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  footerSubtext: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
});