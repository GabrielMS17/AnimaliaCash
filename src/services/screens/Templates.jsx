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
import { useIsWide } from '../../components/ui';
import { supabase } from '../../supabase';

export default function TemplatesScreen() {
  const isWide = useIsWide();
  const [tab, setTab] = useState('todos');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados do Modal de Cadastro
  const [modalVisible, setModalVisible] = useState(false);
  const [nomeInput, setNomeInput] = useState('');
  const [categoriaInput, setCategoriaInput] = useState('Estética'); // Valor padrão
  const [tempoInput, setTempoInput] = useState('');
  const [insumosInput, setInsumosInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Opções pré-definidas de categorias para os chips do modal
  const categoriasOpcoes = ['Estética', 'Cirúrgico', 'Clínico'];

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('templates_procedimentos')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Erro ao buscar templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Função para salvar novo template no Supabase
  const handleSaveTemplate = async () => {
    if (!nomeInput || !tempoInput || !insumosInput) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('templates_procedimentos').insert([
        {
          nome: nomeInput,
          categoria: categoriaInput,
          tempo_estimado: tempoInput.includes('min') ? tempoInput : `${tempoInput} min`,
          insumos_count: parseInt(insumosInput, 10) || 0,
        },
      ]);

      if (error) throw error;

      // Limpa os campos, fecha o modal e recarrega os dados
      setNomeInput('');
      setCategoriaInput('Estética');
      setTempoInput('');
      setInsumosInput('');
      setModalVisible(false);
      fetchTemplates();
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      alert(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtragem por Categoria
  const templatesFiltrados = templates.filter((item) => {
    if (tab === 'banho') return item.categoria === 'Estética';
    if (tab === 'cirurgia') return item.categoria === 'Cirúrgico';
    if (tab === 'clinico') return item.categoria === 'Clínico';
    return true; // 'todos'
  });

  return (
    <View style={styles.mainWrapper}>
      <AppHeader />

      {/* Conteúdo Principal */}
      <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
        <View style={styles.pageHeader}>
          <Text style={styles.sectionTitle}>Templates e Fichas Técnicas</Text>
          <Text style={styles.sectionSubtitle}>
            Pré-configure insumos médios consumidos por procedimento para padronizar custos e lançamentos.
          </Text>
        </View>

        {/* Card de Métrica / Resumo */}
        <View style={[styles.card, !isWide && styles.cardCompact]}>
          <View style={[styles.metricRow, !isWide && styles.metricRowCompact]}>
            <View style={[styles.metricDetails, !isWide && styles.metricDetailsCompact]}>
              <Text style={styles.metricTitle}>Templates de Serviços Ativos</Text>
              <Text style={styles.metricSub}>Padronização de consumo e agilidade na operação diária</Text>
            </View>
            <Text style={[styles.metricValue, !isWide && styles.metricValueCompact]}>
              {templates.length} ativos
            </Text>
          </View>
        </View>

        {/* Botão de Ação Primário com Abertura de Modal */}
        <TouchableOpacity
          style={styles.buttonPrimary}
          activeOpacity={0.8}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.buttonText}>+ Criar Novo Template</Text>
        </TouchableOpacity>

        {/* Filtros / Tabs Estilizados */}
        <View style={[styles.tabContainer, !isWide && styles.tabContainerCompact]}>
          <TouchableOpacity
            style={[styles.tabButton, !isWide && styles.tabButtonCompact, tab === 'todos' && styles.tabButtonActive]}
            onPress={() => setTab('todos')}
          >
            <Text style={[styles.tabText, tab === 'todos' && styles.tabTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, !isWide && styles.tabButtonCompact, tab === 'banho' && styles.tabButtonActive]}
            onPress={() => setTab('banho')}
          >
            <Text style={[styles.tabText, tab === 'banho' && styles.tabTextActive]}>
              Estética
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, !isWide && styles.tabButtonCompact, tab === 'cirurgia' && styles.tabButtonActive]}
            onPress={() => setTab('cirurgia')}
          >
            <Text style={[styles.tabText, tab === 'cirurgia' && styles.tabTextActive]}>
              Cirúrgicos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, !isWide && styles.tabButtonCompact, tab === 'clinico' && styles.tabButtonActive]}
            onPress={() => setTab('clinico')}
          >
            <Text style={[styles.tabText, tab === 'clinico' && styles.tabTextActive]}>
              Clínicos
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tabela de Templates / Conteúdo */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ACCENT_GREEN} />
            <Text style={styles.loadingText}>Carregando templates...</Text>
          </View>
        ) : (
          <View style={[styles.card, !isWide && styles.cardCompact]}>
            <Text style={styles.cardTitle}>Procedimentos Padronizados</Text>
            {templatesFiltrados.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum template encontrado nesta categoria.</Text>
            ) : isWide ? (
              <>
                <View style={styles.tableHeader}>
                  <Text style={[styles.columnHeader, { flex: 2 }]}>Nome do Procedimento</Text>
                  <Text style={[styles.columnHeader, { flex: 1.2 }]}>Categoria</Text>
                  <Text style={[styles.columnHeader, { flex: 1, textAlign: 'center' }]}>Insumos</Text>
                  <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Tempo Est.</Text>
                </View>

                {templatesFiltrados.map((item) => (
                  <View key={item.id} style={styles.tableRow}>
                    <Text style={[styles.cellTextBold, { flex: 2 }]}>{item.nome}</Text>
                    <Text style={[styles.cellText, { flex: 1.2 }]}>{item.categoria}</Text>
                    <Text style={[styles.cellText, { flex: 1, textAlign: 'center' }]}>
                      {item.insumos_count} itens
                    </Text>
                    <Text style={[styles.cellBadge, { flex: 1, textAlign: 'right' }]}>
                      {item.tempo_estimado}
                    </Text>
                  </View>
                ))}
              </>
            ) : (
              <View style={styles.compactTemplateList}>
                {templatesFiltrados.map((item) => (
                  <View key={item.id} style={styles.compactTemplateRow}>
                    <Text style={styles.compactTemplateName}>{item.nome}</Text>
                    <View style={styles.compactTemplateDetail}>
                      <Text style={styles.compactDetailLabel}>Categoria</Text>
                      <Text style={styles.compactDetailValue}>{item.categoria}</Text>
                    </View>
                    <View style={styles.compactTemplateDetail}>
                      <Text style={styles.compactDetailLabel}>Insumos</Text>
                      <Text style={styles.compactDetailValue}>{item.insumos_count} itens</Text>
                    </View>
                    <View style={styles.compactTemplateDetail}>
                      <Text style={styles.compactDetailLabel}>Tempo estimado</Text>
                      <Text style={styles.compactDetailValue}>{item.tempo_estimado}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Modal para Criar Novo Template */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Criar Novo Template de Procedimento</Text>

              {/* Nome do Procedimento */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Nome do Procedimento</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Consulta Cardiológica, Castração..."
                  placeholderTextColor="#94A3B8"
                  value={nomeInput}
                  onChangeText={setNomeInput}
                  autoFocus={true}
                />
              </View>

              {/* Categoria com Chips Pré-definidos */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Categoria</Text>
                <View style={styles.chipContainer}>
                  {categoriasOpcoes.map((cat) => {
                    const selecionado = categoriaInput === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.chipButton, selecionado && styles.chipButtonActive]}
                        onPress={() => setCategoriaInput(cat)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, selecionado && styles.chipTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Tempo Estimado */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Tempo Estimado</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 45 min"
                  placeholderTextColor="#94A3B8"
                  value={tempoInput}
                  onChangeText={setTempoInput}
                />
              </View>

              {/* Quantidade de Insumos */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Quantidade de Insumos Vinculados</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 4"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={insumosInput}
                  onChangeText={setInsumosInput}
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
                  onPress={handleSaveTemplate}
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
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} Animalia Cash — Soluções Financeiras
          </Text>
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
  cardCompact: { padding: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 14 },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricDetails: { flex: 1, minWidth: 0 },
  metricDetailsCompact: { flex: 0, width: '100%' },
  metricRowCompact: { flexDirection: 'column', alignItems: 'flex-start', gap: 8 },
  metricValueCompact: { alignSelf: 'flex-start' },
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
  tabContainerCompact: { flexWrap: 'wrap', gap: 6 },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    marginRight: 6,
  },
  tabButtonCompact: { flexBasis: '45%', flexGrow: 1, minWidth: 0, marginRight: 0 },
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
  compactTemplateList: { gap: 12 },
  compactTemplateRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  compactTemplateName: { fontSize: 14, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 8 },
  compactTemplateDetail: { marginBottom: 6 },
  compactDetailLabel: { fontSize: 10, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' },
  compactDetailValue: { fontSize: 13, color: PRIMARY_DARK, marginTop: 2 },
  cellTextBold: {
    fontWeight: '700',
    color: PRIMARY_DARK,
    fontSize: 13,
  },
  cellText: {
    color: '#64748B',
    fontSize: 13,
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
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
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