import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Select } from '../../components/ui';
import { supabase } from '../../supabase';
import {
  buildCrmv,
  CFMV_CONSULTA_URL,
  formatCrmv,
  onlyCrmvDigits,
  parseCrmv,
  UFS,
  validateCrmv,
  verificationLabel,
} from '../../utils/crmv';

export default function CadastrosScreen() {
  const [perfis, setPerfis] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados do Modal de Cadastro
  const [modalVisible, setModalVisible] = useState(false);
  const [nomeInput, setNomeInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [roleInput, setRoleInput] = useState('Veterinário');
  const [crmvUfInput, setCrmvUfInput] = useState('');
  const [crmvInput, setCrmvInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Estados para Pop-ups Customizados
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const rolesOpcoes = ['Administrador', 'Veterinário', 'Esteticista Animal'];

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

  const showAlert = (msg) => {
    setAlertMessage(msg);
    setAlertModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!nomeInput || !emailInput || !senhaInput) {
      showAlert('Por favor, preencha o Nome, o E-mail institucional e a Senha provisória.');
      return;
    }

    // Validação de senha: mínimo 10 caracteres, 1 Maiúscula e 1 caractere especial
    if (senhaInput.length < 10) {
      showAlert('A senha provisória deve conter no mínimo 10 caracteres.');
      return;
    }
    if (!/[A-Z]/.test(senhaInput)) {
      showAlert('A senha provisória deve conter pelo menos uma letra maiúscula.');
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(senhaInput)) {
      showAlert('A senha provisória deve conter pelo menos um caractere especial.');
      return;
    }

    // Validação do CRMV para Veterinário: UF do conselho regional + número (só dígitos)
    if (roleInput === 'Veterinário') {
      const crmvError = validateCrmv(crmvUfInput, crmvInput);
      if (crmvError) {
        showAlert(crmvError);
        return;
      }
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
        crmv: roleInput === 'Veterinário' ? buildCrmv(crmvUfInput, crmvInput) : null,
        status: 'Ativo',
      };

      const { error: profileError } = await supabase.from('profiles').insert([payload]);

      if (profileError) throw profileError;

      // 4. RESTAURA A SESSÃO DO ADMINISTRADOR ORIGINAL
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
      setCrmvUfInput('');
      setCrmvInput('');
      setModalVisible(false);

      // Exibe o pop-up de sucesso customizado
      setSuccessModalVisible(true);

      fetchProfiles();
    } catch (error) {
      console.error('Erro ao cadastrar perfil:', error);
      showAlert(`Erro ao cadastrar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Abre a consulta oficial do CFMV para conferir se o registro existe e está ativo
  const handleOpenCfmv = (perfil) => {
    const { uf, number } = parseCrmv(perfil.crmv);
    const conselho = uf ? ` (conselho CRMV-${uf})` : '';
    showAlert(`Na consulta do CFMV, busque pelo número ${number}${conselho} e confira se o nome bate e se o registro está ativo. Depois volte e toque em "Marcar como verificado".`);
    Linking.openURL(CFMV_CONSULTA_URL).catch(() => {
      showAlert(`Não foi possível abrir o navegador. Acesse ${CFMV_CONSULTA_URL} e busque pelo número ${number}.`);
    });
  };

  // Marca (ou desmarca) que um administrador conferiu o CRMV no site do CFMV
  const handleSetVerified = async (perfil, verified) => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const changes = verified
        ? { crmv_verificado_em: new Date().toISOString(), crmv_verificado_por: auth.user?.id ?? null }
        : { crmv_verificado_em: null, crmv_verificado_por: null };
      const { error } = await supabase.from('profiles').update(changes).eq('id', perfil.id);
      if (error) throw error;
      fetchProfiles();
    } catch (error) {
      const missingColumn = error.code === '42703' || error.code === 'PGRST204';
      showAlert(missingColumn
        ? 'A verificação do CRMV ainda não foi criada no banco (falta rodar supabase/atendimentos.sql).'
        : `Erro ao salvar a verificação: ${error.message}`);
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
      showAlert(`Erro ao atualizar status: ${error.message}`);
    }
  };

  const getRoleColor = (role) => {
    if (role === 'Administrador') return '#0284C7';
    if (role === 'Esteticista Animal') return '#D946EF';
    return ACCENT_GREEN;
  };

  const ativosCount = perfis.filter(p => p.status !== 'Inativo').length;

  return (
    <View style={styles.mainWrapper}>
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
                    </View>

                    <Text style={[styles.profileName, isInactive && styles.textStrikethrough]}>
                      {p.nome}
                    </Text>
                    <Text style={styles.profileEmail}>{p.email || 'E-mail não registado'}</Text>

                    {/* Exibe o CRMV se for Veterinário */}
                    {p.role === 'Veterinário' && (
                      <View style={styles.crmvBlock}>
                        <View style={styles.cardFooterRow}>
                          <Text style={styles.crmvLabel}>CRMV:</Text>
                          <Text style={styles.crmvValue}>{formatCrmv(p.crmv)}</Text>
                        </View>
                        <Text style={[styles.crmvBadge, p.crmv_verificado_em ? styles.crmvBadgeOk : styles.crmvBadgePending]}>
                          {p.crmv_verificado_em ? `✓ ${verificationLabel(p.crmv_verificado_em)}` : 'Não verificado no CFMV'}
                        </Text>
                        {p.crmv ? (
                          <View style={styles.crmvActions}>
                            <TouchableOpacity style={styles.crmvButton} onPress={() => handleOpenCfmv(p)}>
                              <Text style={styles.crmvButtonText}>Conferir no CFMV ↗</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.crmvButton, !p.crmv_verificado_em && styles.crmvButtonPrimary]}
                              onPress={() => handleSetVerified(p, !p.crmv_verificado_em)}
                            >
                              <Text style={[styles.crmvButtonText, !p.crmv_verificado_em && styles.crmvButtonPrimaryText]}>
                                {p.crmv_verificado_em ? 'Remover verificação' : 'Marcar como verificado'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.statusToggleBtn, isInactive ? styles.btnActivate : styles.btnDeactivate]}
                      onPress={() => handleToggleStatus(p.id, p.status)}
                    >
                      <Text style={[styles.statusToggleText, isInactive ? styles.textActivate : styles.textDeactivate]}>
                        {isInactive ? 'Ativar' : 'Desativar'}
                      </Text>
                    </TouchableOpacity>
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
                <Text style={styles.inputSubLabel}>Mínimo 10 caracteres, 1 letra maiúscula e 1 caractere especial</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Senha@12345"
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
                  <Text style={styles.inputLabel}>CRMV * (UF do conselho e número)</Text>
                  <Text style={styles.inputSubLabel}>Apenas números, até 6 dígitos. Ex: CRMV-SP nº 12345</Text>
                  <View style={styles.crmvRow}>
                    <Select
                      value={crmvUfInput}
                      placeholder="UF"
                      options={UFS.map((uf) => ({ value: uf, label: uf }))}
                      onChange={setCrmvUfInput}
                      style={styles.crmvUf}
                    />
                    <TextInput
                      style={[styles.input, styles.crmvNumber]}
                      placeholder="Ex: 12345"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      inputMode="numeric"
                      maxLength={6}
                      value={crmvInput}
                      onChangeText={(text) => setCrmvInput(onlyCrmvDigits(text))}
                    />
                  </View>
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

        {/* MODAL DE AVISO / ERRO ESTILIZADO */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={alertModalVisible}
          onRequestClose={() => setAlertModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.successModalContent}>
              <Text style={styles.successTitle}>Atenção</Text>
              <Text style={styles.successMessage}>{alertMessage}</Text>

              <TouchableOpacity
                style={styles.successButton}
                activeOpacity={0.8}
                onPress={() => setAlertModalVisible(false)}
              >
                <Text style={styles.successButtonText}>OK</Text>
              </TouchableOpacity>
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
  cardContentInner: { flex: 1, minWidth: 0, padding: 16 },
  cardTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardTopLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexShrink: 0,
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
  roleBadge: { maxWidth: '100%', flexShrink: 1, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1 },
  roleBadgeText: { fontSize: 11, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  
  statusToggleBtn: {
    alignSelf: 'flex-end',
    marginTop: 10,
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

  profileName: { fontSize: 16, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 2, flexShrink: 1 },
  textStrikethrough: { color: '#64748B', textDecorationLine: 'line-through' },
  profileEmail: { fontSize: 13, color: '#64748B', marginBottom: 8, flexShrink: 1 },
  cardFooterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  crmvLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginRight: 6 },
  crmvValue: { fontSize: 12, color: PRIMARY_DARK, fontWeight: '700', flexShrink: 1 },
  crmvBlock: { gap: 6 },
  crmvBadge: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden' },
  crmvBadgeOk: { backgroundColor: '#ECFDF5', color: '#047857' },
  crmvBadgePending: { backgroundColor: '#FEF3C7', color: '#B45309' },
  crmvActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  crmvButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' },
  crmvButtonText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  crmvButtonPrimary: { backgroundColor: ACCENT_GREEN, borderColor: ACCENT_GREEN },
  crmvButtonPrimaryText: { color: '#FFFFFF' },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
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
  inputLabel: { fontSize: 12, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 4 },
  inputSubLabel: { fontSize: 10, color: '#64748B', marginBottom: 6 },
  crmvRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  crmvUf: { width: 96 },
  crmvNumber: { flex: 1 },
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
    width: '100%',
    marginTop: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },
  footerText: { width: '100%', fontSize: 11, lineHeight: 15, fontWeight: '600', color: '#64748B', textAlign: 'center' },
  footerSubtext: { width: '100%', fontSize: 10, lineHeight: 14, color: '#94A3B8', marginTop: 2, textAlign: 'center' },
});