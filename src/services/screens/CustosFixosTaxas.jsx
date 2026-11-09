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

  // Estados do Modal de Cadastro
  const [modalVisible, setModalVisible] = useState(false);
  const [nomeInput, setNomeInput] = useState('');
  const [categoriaInput, setCategoriaInput] = useState('Estrutura'); // Valor padrão
  const [valorInput, setValorInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Opções pré-definidas para Custo Fixo e Taxas de Pagamento
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

  // Função para salvar novo Custo Fixo ou Taxa no Supabase
  const handleSaveItem = async () => {
    if (!nomeInput || !valorInput) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setSubmitting(true);
    try {
      if (tab === 'custos') {
        const { error } = await supabase.from('custos_fixos').insert([
          {
            nome: nomeInput,
            categoria: categoriaInput || 'Geral',
            valor: parseFloat(valorInput.replace(',', '.')) || 0,
          },
        ]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('taxas_pagamento').insert([
          {
            bandeira: nomeInput,
            forma: categoriaInput || 'Geral',
            taxa: parseFloat(valorInput.replace(',', '.')) || 0,
          },
        ]);
        if (error) throw error;
      }

      // Limpa, fecha o modal e recarrega os dados
      setNomeInput('');
      setCategoriaInput(tab === 'custos' ? 'Estrutura' : 'À vista / Instantâneo');
      setValorInput('');
      setModalVisible(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const totalCustosFixos = custosFixos.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const horaSalaCalculada = totalCustosFixos > 0 ? totalCustosFixos / 160 : 0;

  const formatCurrency = (value) => {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <View style={styles.mainWrapper}>
      <AppHeader />

      {/* Conteúdo Principal */}
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
              <Text style={styles.metricSub}>Baseado no total de R$ {totalCustosFixos.toFixed(2)} em custos mensais</Text>
            </View>
            <Text style={styles.metricValue}>{formatCurrency(horaSalaCalculada)} / h</Text>
          </View>
        </View>

        {/* Botão de Ação Primário com Abertura de Modal */}
        <TouchableOpacity
          style={styles.buttonPrimary}
          activeOpacity={0.8}
          onPress={() => {
            // Ajusta o padrão inicial da categoria/forma ao abrir o modal dependendo da aba ativa
            setCategoriaInput(tab === 'custos' ? 'Estrutura' : 'À vista / Instantâneo');
            setModalVisible(true);
          }}
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
              <Text style={[styles.columnHeader, { flex: 1 }]}>Categoria</Text>
              <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Valor Mensal</Text>
            </View>

            {custosFixos.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum custo fixo cadastrado.</Text>
            ) : (
              custosFixos.map((item) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={[styles.cellTextBold, { flex: 2 }]}>{item.nome}</Text>
                  <Text style={[styles.cellText, { flex: 1 }]}>{item.categoria}</Text>
                  <Text style={[styles.cellCost, { flex: 1, textAlign: 'right' }]}>
                    {formatCurrency(item.valor)}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Taxas de Pagamento Cadastradas</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.columnHeader, { flex: 1.5 }]}>Meio / Bandeira</Text>
              <Text style={[styles.columnHeader, { flex: 2 }]}>Forma de Pagamento</Text>
              <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Taxa (%)</Text>
            </View>

            {taxasPagamento.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma taxa cadastrada.</Text>
            ) : (
              taxasPagamento.map((item) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={[styles.cellTextBold, { flex: 1.5 }]}>{item.bandeira}</Text>
                  <Text style={[styles.cellText, { flex: 2 }]}>{item.forma}</Text>
                  <Text style={[styles.cellBadge, { flex: 1, textAlign: 'right' }]}>
                    {Number(item.taxa).toFixed(2)}%
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* Modal de Cadastro com Seletores Pré-definidos */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {tab === 'custos' ? 'Adicionar Novo Custo Fixo' : 'Adicionar Nova Taxa'}
              </Text>

              {/* Nome / Bandeira */}
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

              {/* Seletor de Categoria por Cliques (Chips) */}
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

              {/* Valor / Taxa */}
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
  // Estilos dos botões de categoria (Chips)
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