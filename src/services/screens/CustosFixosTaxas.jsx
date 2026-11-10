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

export default function CustosETaxasScreen() {
  const [tab, setTab] = useState('custos');
  const [custosFixos, setCustosFixos] = useState([]);
  const [taxasPagamento, setTaxasPagamento] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados do Modal de Cadastro / Edição
  const [modalVisible, setModalVisible] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [nomeInput, setNomeInput] = useState('');
  const [categoriaInput, setCategoriaInput] = useState('Estrutura');
  const [valorInput, setValorInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Estados do Modal de Confirmação de Exclusão (Personalizado)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemParaDeletarId, setItemParaDeletarId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const categoriasCustos = ['Estrutura', 'Utilidades', 'Pessoal', 'Administrativo', 'Manutenção'];
  const formasTaxas = ['À vista / Instantâneo', 'Débito', 'Crédito à vista', 'Crédito Parcelado (2x a 6x)'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: custosData, error: custosError } = await supabase
        .from('custos_fixos')
        .select('*')
        .order('nome', { ascending: true });

      if (custosError) throw custosError;

      const { data: taxasData, error: taxasError } = await supabase
        .from('taxas_pagamento')
        .select('*')
        .order('bandeira', { ascending: true });

      if (taxasError) throw taxasError;

      setCustosFixos(custosData || []);
      setTaxasPagamento(taxasData || []);
    } catch (error) {
      console.error('Erro ao carregar dados financeiros:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModalCriacao = () => {
    setEditandoId(null);
    setNomeInput('');
    setCategoriaInput(tab === 'custos' ? 'Estrutura' : 'À vista / Instantâneo');
    setValorInput('');
    setModalVisible(true);
  };

  const handleOpenModalEdicao = (item) => {
    setEditandoId(item.id);
    if (tab === 'custos') {
      setNomeInput(item.nome);
      setCategoriaInput(item.categoria || 'Estrutura');
      setValorInput(String(item.valor));
    } else {
      setNomeInput(item.bandeira);
      setCategoriaInput(item.forma || 'À vista / Instantâneo');
      setValorInput(String(item.taxa));
    }
    setModalVisible(true);
  };

  const handleSaveItem = async () => {
    if (!nomeInput || !valorInput) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setSubmitting(true);
    try {
      const valorFormatado = parseFloat(valorInput.replace(',', '.')) || 0;

      if (tab === 'custos') {
        if (editandoId) {
          const { error } = await supabase
            .from('custos_fixos')
            .update({ nome: nomeInput, categoria: categoriaInput, valor: valorFormatado })
            .eq('id', editandoId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('custos_fixos').insert([
            { nome: nomeInput, categoria: categoriaInput || 'Geral', valor: valorFormatado },
          ]);
          if (error) throw error;
        }
      } else {
        if (editandoId) {
          const { error } = await supabase
            .from('taxas_pagamento')
            .update({ bandeira: nomeInput, forma: categoriaInput, taxa: valorFormatado })
            .eq('id', editandoId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('taxas_pagamento').insert([
            { bandeira: nomeInput, forma: categoriaInput || 'Geral', taxa: valorFormatado },
          ]);
          if (error) throw error;
        }
      }

      setModalVisible(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Funções do Modal de Exclusão Personalizado
  const promptDelete = (id) => {
    setItemParaDeletarId(id);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!itemParaDeletarId) return;
    const tabela = tab === 'custos' ? 'custos_fixos' : 'taxas_pagamento';

    setDeleting(true);
    try {
      const { error } = await supabase.from(tabela).delete().eq('id', itemParaDeletarId);
      if (error) throw error;
      setDeleteModalVisible(false);
      setItemParaDeletarId(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert(`Erro ao excluir: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const totalCustosFixos = custosFixos.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const horaSalaCalculada = totalCustosFixos > 0 ? totalCustosFixos / 160 : 0;
  
  const taxaMediaCadastrada = taxasPagamento.length > 0
    ? taxasPagamento.reduce((acc, item) => acc + Number(item.taxa || 0), 0) / taxasPagamento.length
    : 2.5;

  const avaliarSaudeFinanceiraIA = () => {
    if (totalCustosFixos === 0) return { status: 'Aguardando Dados', cor: '#94A3B8', msg: 'Cadastre custos fixos para iniciar a análise.' };
    
    if (totalCustosFixos > 20000 || taxaMediaCadastrada > 4.0) {
      return { 
        status: 'Risco / Alerta Vermelho', 
        cor: '#EF4444', 
        msg: 'Custos fixos elevados (> R$ 20.000) ou taxas de cartão acima da média ideal.' 
      };
    } else if (totalCustosFixos > 10000 || taxaMediaCadastrada > 2.8) {
      return { 
        status: 'Estável com Atenção', 
        cor: '#F59E0B', 
        msg: 'Operação equilibrada. Incentive pagamentos via Pix para reter margem.' 
      };
    } else {
      return { 
        status: 'Saudável e Otimizada', 
        cor: '#00A86B', 
        msg: 'Sua estrutura de custos e taxas está perfeitamente alinhada para uma clínica nova.' 
      };
    }
  };

  const diagnosticoIA = avaliarSaudeFinanceiraIA();

  const formatCurrency = (value) => {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <View style={styles.mainWrapper}>
      <AppHeader />

      <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
        <View style={styles.pageHeader}>
          <Text style={styles.sectionTitle}>Custos Fixos e Taxas</Text>
          <Text style={styles.sectionSubtitle}>
            Gerencie custos operacionais, cálculo de hora/sala e taxas de meios de pagamento em tempo real.
          </Text>
        </View>

        {/* Métrica / Indicador do Cálculo Hora/Sala Dinâmico */}
        <View style={styles.card}>
          <View style={styles.metricRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metricTitle}>Hora/Sala Operacional Calculada</Text>
              <Text style={styles.metricSub}>Baseado no total de {formatCurrency(totalCustosFixos)} em custos mensais</Text>
            </View>
            <Text style={styles.metricValue}>{formatCurrency(horaSalaCalculada)} / h</Text>
          </View>
        </View>

        {/* CARD DO DIAGNÓSTICO FINANCEIRO POR MACHINE LEARNING */}
        <View style={styles.card}>
          <View style={styles.aiHeaderRow}>
            <Text style={styles.aiBadgeText}>🤖 DIAGNÓSTICO INTELIGENTE DA CLÍNICA (IA)</Text>
          </View>
          <Text style={styles.aiCardDesc}>
            O modelo analisa dinamicamente o volume dos seus custos fixos e as taxas médias cadastradas para auditar a saúde financeira.
          </Text>

          <View style={styles.aiResultBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiResultSub}>Taxa Média Aplicada: {taxaMediaCadastrada.toFixed(2)}%</Text>
              <Text style={[styles.aiResultTitle, { color: diagnosticoIA.cor, fontSize: 15, marginTop: 4 }]}>
                {diagnosticoIA.status}
              </Text>
              <Text style={styles.aiMessageText}>{diagnosticoIA.msg}</Text>
            </View>
          </View>

          {/* Legenda Explicativa */}
          <View style={styles.legendaContainer}>
            <Text style={styles.legendaTitle}>Critérios de Diagnóstico da IA:</Text>
            
            <View style={styles.legendaItem}>
              <View style={[styles.legendaDot, { backgroundColor: '#00A86B' }]} />
              <Text style={styles.legendaText}>
                <Text style={{ fontWeight: '700', color: PRIMARY_DARK }}>Saudável:</Text> Custos baixos e taxa média até 2.8%.
              </Text>
            </View>

            <View style={styles.legendaItem}>
              <View style={[styles.legendaDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendaText}>
                <Text style={{ fontWeight: '700', color: PRIMARY_DARK }}>Estável:</Text> Custos moderados (R$ 10k a R$ 20k) ou taxa entre 2.8% e 4.0%.
              </Text>
            </View>

            <View style={styles.legendaItem}>
              <View style={[styles.legendaDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendaText}>
                <Text style={{ fontWeight: '700', color: PRIMARY_DARK }}>Risco:</Text> Custos fixos {'>'} R$ 20.000,00 ou taxa média {'>'} 4.0%.
              </Text>
            </View>
          </View>
        </View>

        {/* Botão de Ação Primario */}
        <TouchableOpacity
          style={styles.buttonPrimary}
          activeOpacity={0.8}
          onPress={handleOpenModalCriacao}
        >
          <Text style={styles.buttonText}>
            {tab === 'custos' ? '+ Novo Custo Fixo' : '+ Nova Taxa'}
          </Text>
        </TouchableOpacity>

        {/* Filtros / Tabs Estilizados */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'custos' && styles.tabButtonActive]}
            onPress={() => setTab('custos')}
          >
            <Text style={[styles.tabText, tab === 'custos' && styles.tabTextActive]}>
              Custos Fixos Mensais
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === 'taxas' && styles.tabButtonActive]}
            onPress={() => setTab('taxas')}
          >
            <Text style={[styles.tabText, tab === 'taxas' && styles.tabTextActive]}>
              Taxas de Meios de Pagamento
            </Text>
          </TouchableOpacity>
        </View>

        {/* Conteúdo das Tabelas */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ACCENT_GREEN} />
            <Text style={styles.loadingText}>Carregando dados financeiros...</Text>
          </View>
        ) : tab === 'custos' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Custos Fixos Cadastrados</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.columnHeader, { flex: 2 }]}>Nome / Descrição</Text>
              <Text style={[styles.columnHeader, { flex: 1.2 }]}>Categoria</Text>
              <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Valor Mensal</Text>
              <Text style={[styles.columnHeader, { flex: 1, textAlign: 'center' }]}>Ações</Text>
            </View>

            {custosFixos.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum custo fixo cadastrado.</Text>
            ) : (
              custosFixos.map((item) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={[styles.cellTextBold, { flex: 2 }]}>{item.nome}</Text>
                  <Text style={[styles.cellText, { flex: 1.2 }]}>{item.categoria}</Text>
                  <Text style={[styles.cellCost, { flex: 1, textAlign: 'right' }]}>
                    {formatCurrency(item.valor)}
                  </Text>
                  <View style={styles.actionsCell}>
                    <TouchableOpacity onPress={() => handleOpenModalEdicao(item)} style={styles.actionButtonEdit}>
                      <Text style={styles.actionEditText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => promptDelete(item.id)} style={styles.actionButtonDelete}>
                      <Text style={styles.actionDeleteText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Taxas de Pagamento Cadastradas</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.columnHeader, { flex: 1.5 }]}>Meio / Bandeira</Text>
              <Text style={[styles.columnHeader, { flex: 1.8 }]}>Forma de Pagamento</Text>
              <Text style={[styles.columnHeader, { flex: 0.8, textAlign: 'right' }]}>Taxa</Text>
              <Text style={[styles.columnHeader, { flex: 1, textAlign: 'center' }]}>Ações</Text>
            </View>

            {taxasPagamento.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma taxa cadastrada.</Text>
            ) : (
              taxasPagamento.map((item) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={[styles.cellTextBold, { flex: 1.5 }]}>{item.bandeira}</Text>
                  <Text style={[styles.cellText, { flex: 1.8 }]}>{item.forma}</Text>
                  <Text style={[styles.cellBadge, { flex: 0.8, textAlign: 'right' }]}>
                    {Number(item.taxa).toFixed(2)}%
                  </Text>
                  <View style={styles.actionsCell}>
                    <TouchableOpacity onPress={() => handleOpenModalEdicao(item)} style={styles.actionButtonEdit}>
                      <Text style={styles.actionEditText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => promptDelete(item.id)} style={styles.actionButtonDelete}>
                      <Text style={styles.actionDeleteText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Modal de Cadastro / Edição */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editandoId 
                  ? (tab === 'custos' ? 'Editar Custo Fixo' : 'Editar Taxa')
                  : (tab === 'custos' ? 'Adicionar Novo Custo Fixo' : 'Adicionar Nova Taxa')}
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{tab === 'custos' ? 'Nome do Custo' : 'Meio / Bandeira'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={tab === 'custos' ? 'Ex: Aluguel, Energia...' : 'Ex: PIX, Cartão de Crédito'}
                  placeholderTextColor="#94A3B8"
                  value={nomeInput}
                  onChangeText={setNomeInput}
                  autoFocus={true}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  {tab === 'custos' ? 'Selecione a Categoria' : 'Forma de Pagamento'}
                </Text>
                <View style={styles.chipContainer}>
                  {(tab === 'custos' ? categoriasCustos : formasTaxas).map((opcao) => {
                    const selecionado = categoriaInput === opcao;
                    return (
                      <TouchableOpacity
                        key={opcao}
                        style={[styles.chipButton, selecionado && styles.chipButtonActive]}
                        onPress={() => setCategoriaInput(opcao)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, selecionado && styles.chipTextActive]}>
                          {opcao}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{tab === 'custos' ? 'Valor Mensal (R$)' : 'Taxa (%)'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={valorInput}
                  onChangeText={setValorInput}
                />
              </View>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSave]}
                  onPress={handleSaveItem}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.modalButtonSaveText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* NOVO: Modal de Confirmação de Exclusão Personalizado */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={deleteModalVisible}
          onRequestClose={() => setDeleteModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: 360, alignItems: 'center' }]}>
              <View style={styles.deleteIconContainer}>
                <Text style={{ fontSize: 24 }}>⚠️</Text>
              </View>
              <Text style={[styles.modalTitle, { textAlign: 'center', marginTop: 8 }]}>Excluir Item</Text>
              <Text style={styles.deleteModalText}>
                Tem certeza que deseja excluir permanentemente este registo? Esta ação não pode ser desfeita.
              </Text>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setDeleteModalVisible(false)}
                  disabled={deleting}
                >
                  <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirmDelete]}
                  onPress={confirmDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.modalButtonConfirmDeleteText}>Sim, Excluir</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Rodapé Corporativo */}
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
  pageHeader: { marginBottom: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: PRIMARY_DARK },
  sectionSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
  },
  aiHeaderRow: {
    marginBottom: 6,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY_DARK,
    letterSpacing: 0.5,
  },
  aiCardDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 16,
  },
  aiResultBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  aiResultSub: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
    fontWeight: '600',
  },
  aiResultTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  aiMessageText: {
    fontSize: 12,
    color: '#334155',
    marginTop: 6,
    lineHeight: 16,
  },
  legendaContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    marginTop: 4,
  },
  legendaTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  legendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendaText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 14 },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricTitle: { fontWeight: '700', fontSize: 15, color: PRIMARY_DARK },
  metricSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  metricValue: { fontSize: 18, fontWeight: '800', color: ACCENT_GREEN },
  buttonPrimary: {
    backgroundColor: ACCENT_GREEN,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    marginRight: 6,
  },
  tabButtonActive: {
    backgroundColor: PRIMARY_DARK,
    borderColor: PRIMARY_DARK,
  },
  tabText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  cellTextBold: {
    fontWeight: '700',
    color: PRIMARY_DARK,
    fontSize: 13,
  },
  cellText: {
    color: '#64748B',
    fontSize: 13,
  },
  cellCost: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY_DARK,
  },
  cellBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT_GREEN,
  },
  actionsCell: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonEdit: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  actionEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: PRIMARY_DARK,
  },
  actionButtonDelete: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  actionDeleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    paddingVertical: 20,
    fontSize: 13,
  },
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
  deleteIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  deleteModalText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
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
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipButtonActive: {
    backgroundColor: PRIMARY_DARK,
    borderColor: PRIMARY_DARK,
  },
  chipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  modalButtonCancelText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  modalButtonSave: { backgroundColor: ACCENT_GREEN },
  modalButtonSaveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  modalButtonConfirmDelete: { backgroundColor: '#EF4444' },
  modalButtonConfirmDeleteText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
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