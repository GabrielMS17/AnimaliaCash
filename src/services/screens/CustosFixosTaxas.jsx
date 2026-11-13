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
import { NumberInput } from '../../components/ui';
import { useAnimaliaData } from '../../store/AnimaliaDataContext';
import { supabase } from '../../supabase';
import { calculateProcedure } from '../../utils/costCalculations';

export default function CustosETaxasScreen() {
  const { procedures, insumosMap, settings, saveSettings } = useAnimaliaData();
  
  const [tab, setTab] = useState('custos'); // 'custos', 'variaveis', 'taxas'
  const [custosFixos, setCustosFixos] = useState([]);
  const [taxasPagamento, setTaxasPagamento] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wasteRateInput, setWasteRateInput] = useState(settings.averageProductWastePercent ?? 0);

  // Estados do Modal de Cadastro / Edição
  const [modalVisible, setModalVisible] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [nomeInput, setNomeInput] = useState('');
  const [categoriaInput, setCategoriaInput] = useState('Estrutura');
  const [valorInput, setValorInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Estados do Modal de Listagem de Itens por Categoria (Custos Variáveis)
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [categoriaSelecionadaDetalhes, setCategoriaSelecionadaDetalhes] = useState(null);

  // Estados do Modal de Confirmação de Exclusão
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemParaDeletar, setItemParaDeletar] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const categoriasCustos = ['Estrutura', 'Utilidades', 'Pessoal', 'Administrativo', 'Manutenção'];
  const categoriasVariaveisOpts = [
    { id: 'cirurgia', label: 'Cirurgias' },
    { id: 'internacao', label: 'Internação' },
    { id: 'banho_tosa', label: 'Banho e Tosa' }
  ];
  const formasTaxas = ['À vista / Instantâneo', 'Débito', 'Crédito à vista', 'Crédito Parcelado (2x a 6x)'];

  useEffect(() => {
    fetchFinancialData();
  }, []);

  useEffect(() => {
    setWasteRateInput(settings.averageProductWastePercent ?? 0);
  }, [settings.averageProductWastePercent]);

  const fetchFinancialData = async () => {
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
      console.error('Erro ao carregar custos fixos e taxas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cálculo dinâmico dos procedimentos usando a store global
  const procedimentosCalculados = (procedures || []).map((proc) => {
    const calc = calculateProcedure(proc, insumosMap, settings);
    return {
      ...proc,
      custoTotalCalculado: calc.breakdown.totalCost || 0
    };
  });

  const totaisPorCategoria = {
    cirurgia: { total: 0, itens: 0 },
    internacao: { total: 0, itens: 0 },
    banho_tosa: { total: 0, itens: 0 }
  };

  procedimentosCalculados.forEach((proc) => {
    const cat = proc.category;
    if (totaisPorCategoria[cat]) {
      totaisPorCategoria[cat].total += proc.custoTotalCalculado;
      totaisPorCategoria[cat].itens += 1;
    }
  });

  const custosVariaveisConsolidados = [
    { id: 'cirurgia', nome: 'Cirurgias', categoria: 'cirurgia', valor: totaisPorCategoria.cirurgia.total, qtd: totaisPorCategoria.cirurgia.itens },
    { id: 'internacao', nome: 'Internação', categoria: 'internacao', valor: totaisPorCategoria.internacao.total, qtd: totaisPorCategoria.internacao.itens },
    { id: 'banho_tosa', nome: 'Banho e Tosa', categoria: 'banho_tosa', valor: totaisPorCategoria.banho_tosa.total, qtd: totaisPorCategoria.banho_tosa.itens }
  ];

  const totalCustosFixos = custosFixos.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const totalCustosVariaveis = custosVariaveisConsolidados.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const horaSalaCalculada = totalCustosFixos > 0 ? totalCustosFixos / 160 : 0;
  
  const taxaMediaCadastrada = taxasPagamento.length > 0
    ? taxasPagamento.reduce((acc, item) => acc + Number(item.taxa || 0), 0) / taxasPagamento.length
    : 2.5;

  const avaliarSaudeFinanceiraIA = () => {
    if (totalCustosFixos === 0 && procedures.length === 0) {
      return { status: 'Aguardando Dados', cor: '#94A3B8', msg: 'Cadastre custos fixos para iniciar a análise.' };
    }
    if (totalCustosFixos > 20000 || taxaMediaCadastrada > 4.0) {
      return { status: 'Risco / Alerta Vermelho', cor: '#EF4444', msg: 'Custos fixos elevados ou taxas acima da média ideal.' };
    } else if (totalCustosFixos > 10000 || taxaMediaCadastrada > 2.8) {
      return { status: 'Estável com Atenção', cor: '#F59E0B', msg: 'Operação equilibrada. Incentive pagamentos via Pix.' };
    } else {
      return { status: 'Saudável e Otimizada', cor: '#00A86B', msg: 'Sua estrutura de custos e taxas está perfeitamente alinhada.' };
    }
  };

  const diagnosticoIA = avaliarSaudeFinanceiraIA();
  const wasteRateChanged = wasteRateInput !== (settings.averageProductWastePercent ?? 0);

  const handleOpenModalCriacao = () => {
    setEditandoId(null);
    setNomeInput('');
    if (tab === 'custos') setCategoriaInput('Estrutura');
    else if (tab === 'variaveis') setCategoriaInput('cirurgia');
    else setCategoriaInput('À vista / Instantâneo');
    setValorInput('');
    setModalVisible(true);
  };

  const handleOpenModalEdicao = (item) => {
    setEditandoId(item.id);
    if (tab === 'custos') {
      setNomeInput(item.nome);
      setCategoriaInput(item.categoria || 'Estrutura');
      setValorInput(String(item.valor));
    } else if (tab === 'taxas') {
      setNomeInput(item.bandeira);
      setCategoriaInput(item.forma || 'À vista / Instantâneo');
      setValorInput(String(item.taxa));
    }
    setModalVisible(true);
  };

  const handleSaveItem = async () => {
    if (!valorInput) {
      alert('Por favor, preencha o valor/taxa.');
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
      } else if (tab === 'variaveis') {
        const nomeProc = nomeInput || `Custo Extra (${formatarCategoriaVariavel(categoriaInput)})`;
        const { error } = await supabase.from('procedures').insert([
          {
            id: `proc_${Date.now()}`,
            name: nomeProc,
            category: categoriaInput,
            description: 'Cadastrado como custo variável extra',
            fixed_overhead_cost: valorFormatado,
            duration_minutes: 60
          },
        ]);
        if (error) throw error;
        alert('Custo variável extra adicionado com sucesso!');
      } else if (tab === 'taxas') {
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
      fetchFinancialData();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveWasteRate = () => {
    if (!Number.isFinite(wasteRateInput) || wasteRateInput < 0) {
      alert('Informe uma taxa média de desperdício válida.');
      return;
    }

    saveSettings({ ...settings, averageProductWastePercent: wasteRateInput });
    alert('Taxa média de desperdício salva como referência. Ela não altera os custos calculados.');
  };

  const promptDelete = (item) => {
    setItemParaDeletar(item);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!itemParaDeletar) return;

    setDeleting(true);
    try {
      if (tab === 'custos') {
        const { error } = await supabase.from('custos_fixos').delete().eq('id', itemParaDeletar.id);
        if (error) throw error;
      } else if (tab === 'taxas') {
        const { error } = await supabase.from('taxas_pagamento').delete().eq('id', itemParaDeletar.id);
        if (error) throw error;
      }

      setDeleteModalVisible(false);
      setItemParaDeletar(null);
      fetchFinancialData();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert(`Erro ao excluir: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (value) => {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatarCategoriaVariavel = (cat) => {
    if (cat === 'cirurgia') return 'Cirurgias';
    if (cat === 'internacao') return 'Internação';
    if (cat === 'banho_tosa') return 'Banho e Tosa';
    return cat;
  };

  return (
    <View style={styles.mainWrapper}>
      <AppHeader />

      <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
        <View style={styles.pageHeader}>
          <Text style={styles.sectionTitle}>Custos e Taxas da Clínica</Text>
          <Text style={styles.sectionSubtitle}>
            Gerencie custos operacionais fixos, consolidação de variáveis, cálculo de hora/sala e taxas de pagamento.
          </Text>
        </View>

        {/* Métricas / Indicadores Dinâmicos */}
        <View style={styles.metricsRowContainer}>
          <View style={[styles.card, { flex: 1, marginBottom: 0 }]}>
            <Text style={styles.metricTitle}>Hora/Sala</Text>
            <Text style={styles.metricSub}>Custos fixos / 160h</Text>
            <Text style={[styles.metricValue, { marginTop: 6, fontSize: 12 }]}>{formatCurrency(horaSalaCalculada)}/h</Text>
          </View>

          <View style={[styles.card, { flex: 1, marginBottom: 0 }]}>
            <Text style={styles.metricTitle}>Total Variável</Text>
            <Text style={styles.metricSub}>Cirurgia, Internação, Banho</Text>
            <Text style={[styles.metricValue, { color: PRIMARY_DARK, marginTop: 6, fontSize: 12 }]}>{formatCurrency(totalCustosVariaveis)}</Text>
          </View>
        </View>

        {/* CARD DO DIAGNÓSTICO FINANCEIRO POR MACHINE LEARNING */}
        <View style={[styles.card, { marginTop: 16 }]}>
          <View style={styles.aiHeaderRow}>
            <Text style={styles.aiBadgeText}>DIAGNÓSTICO INTELIGENTE DA CLÍNICA (IA)</Text>
          </View>
          <Text style={styles.aiCardDesc}>
            O modelo analisa dinamicamente o volume dos seus custos fixos e as taxas médias cadastradas para auditar a saúde financeira.
          </Text>

          <View style={styles.aiResultBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiResultSub}>Taxa Média Aplicada: {taxaMediaCadastrada.toFixed(2)}%</Text>
              <Text style={[styles.aiResultTitle, { color: diagnosticoIA.cor, fontSize: 13, marginTop: 4 }]}>
                {diagnosticoIA.status}
              </Text>
              <Text style={styles.aiMessageText}>{diagnosticoIA.msg}</Text>
            </View>
          </View>
        </View>

        {/* Botão de Ação Dinâmico */}
        <TouchableOpacity
          style={styles.buttonPrimary}
          activeOpacity={0.8}
          onPress={handleOpenModalCriacao}
        >
          <Text style={styles.buttonText}>
            {tab === 'custos' 
              ? '+ Novo Custo Fixo' 
              : tab === 'variaveis' 
              ? '+ Adicionar Custo Variável Extra' 
              : '+ Nova Taxa de Pagamento'}
          </Text>
        </TouchableOpacity>

        {/* Três Abas (Tabs) Estilizadas */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'custos' && styles.tabButtonActive]}
            onPress={() => setTab('custos')}
          >
            <Text style={[styles.tabText, tab === 'custos' && styles.tabTextActive]}>Fixos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === 'variaveis' && styles.tabButtonActive]}
            onPress={() => setTab('variaveis')}
          >
            <Text style={[styles.tabText, tab === 'variaveis' && styles.tabTextActive]}>Variáveis</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === 'taxas' && styles.tabButtonActive]}
            onPress={() => setTab('taxas')}
          >
            <Text style={[styles.tabText, tab === 'taxas' && styles.tabTextActive]}>Taxas</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ACCENT_GREEN} />
            <Text style={styles.loadingText}>Carregando dados financeiros...</Text>
          </View>
        ) : tab === 'custos' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Custos Fixos Cadastrados</Text>

            {custosFixos.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum custo fixo cadastrado.</Text>
            ) : (
              custosFixos.map((item) => (
                <View key={item.id} style={styles.cardItemRow}>
                  <View style={styles.cardItemInfo}>
                    <Text style={styles.cellTextBold} numberOfLines={2}>{item.nome}</Text>
                    <Text style={styles.subCategoryText}>{item.categoria}</Text>
                    <Text style={styles.cellCostMobile} numberOfLines={1}>
                      {formatCurrency(item.valor)}
                    </Text>
                  </View>
                  <View style={styles.actionsCellCard}>
                    <TouchableOpacity onPress={() => handleOpenModalEdicao(item)} style={styles.actionButtonEdit}>
                      <Text style={styles.actionEditText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => promptDelete(item)} style={styles.actionButtonDelete}>
                      <Text style={styles.actionDeleteText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : tab === 'variaveis' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Custos Variáveis por Categoria</Text>
            <View style={styles.wasteRateEditor}>
              <Text style={styles.inputLabel}>Taxa média de desperdício dos produtos (%)</Text>
              <NumberInput
                min={0}
                value={wasteRateInput}
                onChange={setWasteRateInput}
                suffix="%"
              />
              <Text style={styles.wasteRateHelp}>
                Valor informativo; não altera automaticamente os custos calculados.
              </Text>
              <TouchableOpacity
                style={[styles.buttonPrimary, !wasteRateChanged && styles.buttonDisabled]}
                onPress={handleSaveWasteRate}
                disabled={!wasteRateChanged}
              >
                <Text style={styles.buttonText}>Salvar taxa média</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.aiCardDesc}>Toque em uma categoria para ver os itens detalhados.</Text>

            {custosVariaveisConsolidados.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.cardItemRow}
                activeOpacity={0.7}
                onPress={() => {
                  setCategoriaSelecionadaDetalhes(item.categoria);
                  setDetailsModalVisible(true);
                }}
              >
                <View style={styles.cardItemInfo}>
                  <Text style={[styles.cellTextBold, { color: '#0284C7' }]} numberOfLines={1}>{item.nome}</Text>
                  <Text style={styles.subCategoryText}>{item.qtd} itens cadastrados</Text>
                  <Text style={styles.cellCostMobile} numberOfLines={1}>
                    {formatCurrency(item.valor)}
                  </Text>
                </View>
                <View style={styles.actionsCellCard}>
                  <Text style={styles.detailArrowText}>Ver Detalhes</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Taxas de Pagamento Cadastradas</Text>

            {taxasPagamento.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma taxa cadastrada.</Text>
            ) : (
              taxasPagamento.map((item) => (
                <View key={item.id} style={styles.cardItemRow}>
                  <View style={styles.cardItemInfo}>
                    <Text style={styles.cellTextBold} numberOfLines={1}>{item.bandeira}</Text>
                    <Text style={styles.subCategoryText}>{item.forma}</Text>
                    <Text style={styles.cellBadgeMobile} numberOfLines={1}>
                      Taxa: {Number(item.taxa).toFixed(2)}%
                    </Text>
                  </View>
                  <View style={styles.actionsCellCard}>
                    <TouchableOpacity onPress={() => handleOpenModalEdicao(item)} style={styles.actionButtonEdit}>
                      <Text style={styles.actionEditText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => promptDelete(item)} style={styles.actionButtonDelete}>
                      <Text style={styles.actionDeleteText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Modal de Listagem Detalhada de Itens da Categoria */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={detailsModalVisible}
          onRequestClose={() => setDetailsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: 540, maxHeight: '80%' }]}>
              <View style={styles.detailsModalHeader}>
                <Text style={styles.modalTitle}>
                  Itens de {formatarCategoriaVariavel(categoriaSelecionadaDetalhes)}
                </Text>
                <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#64748B' }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ marginVertical: 10 }}>
                {procedimentosCalculados
                  .filter((p) => p.category === categoriaSelecionadaDetalhes)
                  .length === 0 ? (
                  <Text style={styles.emptyText}>Nenhum item cadastrado nesta categoria.</Text>
                ) : (
                  procedimentosCalculados
                    .filter((p) => p.category === categoriaSelecionadaDetalhes)
                    .map((item) => (
                      <View key={item.id} style={styles.detailRowItem}>
                        <View style={{ flex: 1.4 }}>
                          <Text style={styles.cellTextBold}>{item.name}</Text>
                          <Text style={styles.subDetailText}>
                            {item.targetWeightKg ? `${item.targetWeightKg} kg • ` : ''}
                            Duração: {item.durationMinutes || 60} min
                          </Text>
                        </View>
                        <Text style={[styles.cellCost, { flex: 1.0, textAlign: 'right' }]} numberOfLines={1}>
                          {formatCurrency(item.custoTotalCalculado)}
                        </Text>
                      </View>
                    ))
                )}
              </ScrollView>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { marginTop: 12, width: '100%' }]}
                onPress={() => setDetailsModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
                  ? 'Editar Registo' 
                  : tab === 'custos' 
                  ? 'Adicionar Novo Custo Fixo' 
                  : tab === 'variaveis'
                  ? 'Adicionar Custo Variável Extra'
                  : 'Adicionar Nova Taxa'}
              </Text>

              {tab === 'custos' && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Nome do Custo</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: Aluguel, Energia..."
                      placeholderTextColor="#94A3B8"
                      value={nomeInput}
                      onChangeText={setNomeInput}
                      autoFocus={true}
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Selecione a Categoria</Text>
                    <View style={styles.chipContainer}>
                      {categoriasCustos.map((opcao) => {
                        const selecionado = categoriaInput === opcao;
                        return (
                          <TouchableOpacity
                            key={opcao}
                            style={[styles.chipButton, selecionado && styles.chipButtonActive]}
                            onPress={() => setCategoriaInput(opcao)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.chipText, selecionado && styles.chipTextActive]}>{opcao}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}

              {tab === 'variaveis' && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Nome do Custo Variável / Extra</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: Exame extra, Material..."
                      placeholderTextColor="#94A3B8"
                      value={nomeInput}
                      onChangeText={setNomeInput}
                      autoFocus={true}
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Categoria de Destino</Text>
                    <View style={styles.chipContainer}>
                      {categoriasVariaveisOpts.map((opcao) => {
                        const selecionado = categoriaInput === opcao.id;
                        return (
                          <TouchableOpacity
                            key={opcao.id}
                            style={[styles.chipButton, selecionado && styles.chipButtonActive]}
                            onPress={() => setCategoriaInput(opcao.id)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.chipText, selecionado && styles.chipTextActive]}>{opcao.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}

              {tab === 'taxas' && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Meio / Bandeira</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: PIX, Cartão Visa..."
                      placeholderTextColor="#94A3B8"
                      value={nomeInput}
                      onChangeText={setNomeInput}
                      autoFocus={true}
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Forma de Pagamento</Text>
                    <View style={styles.chipContainer}>
                      {formasTaxas.map((opcao) => {
                        const selecionado = categoriaInput === opcao;
                        return (
                          <TouchableOpacity
                            key={opcao}
                            style={[styles.chipButton, selecionado && styles.chipButtonActive]}
                            onPress={() => setCategoriaInput(opcao)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.chipText, selecionado && styles.chipTextActive]}>{opcao}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  {tab === 'taxas' ? 'Taxa (%)' : tab === 'variaveis' ? 'Custo / Valor Base (R$)' : 'Valor / Custo Mensal (R$)'}
                </Text>
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

        {/* Modal de Confirmação de Exclusão */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={deleteModalVisible}
          onRequestClose={() => setDeleteModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: 360, alignItems: 'center' }]}>
              <Text style={[styles.modalTitle, { textAlign: 'center', marginTop: 8 }]}>Excluir Registo</Text>
              <Text style={styles.deleteModalText}>
                Tem certeza que deseja apagar "{itemParaDeletar?.nome || itemParaDeletar?.bandeira}"?
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
  contentPadding: { padding: 10, paddingBottom: 32 },
  pageHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: PRIMARY_DARK },
  sectionSubtitle: { fontSize: 11, color: '#64748B', marginTop: 4, lineHeight: 15 },
  metricsRowContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
  },
  aiHeaderRow: {
    marginBottom: 4,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: PRIMARY_DARK,
    letterSpacing: 0.5,
  },
  aiCardDesc: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 14,
  },
  aiResultBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  aiResultSub: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 2,
    fontWeight: '600',
  },
  aiResultTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  aiMessageText: {
    fontSize: 10,
    color: '#334155',
    marginTop: 3,
    lineHeight: 14,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 10 },
  metricTitle: { fontWeight: '700', fontSize: 11, color: PRIMARY_DARK },
  metricSub: { fontSize: 9, color: '#64748B', marginTop: 2 },
  metricValue: { fontSize: 13, fontWeight: '800', color: ACCENT_GREEN },
  buttonPrimary: {
    backgroundColor: ACCENT_GREEN,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: PRIMARY_DARK,
    borderColor: PRIMARY_DARK,
  },
  tabText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cardItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardItemInfo: {
    flex: 1,
    paddingRight: 8,
  },
  cellTextBold: {
    fontWeight: '700',
    color: PRIMARY_DARK,
    fontSize: 12,
  },
  subCategoryText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  cellCostMobile: {
    fontSize: 12,
    fontWeight: '800',
    color: ACCENT_GREEN,
    marginTop: 4,
  },
  cellBadgeMobile: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY_DARK,
    marginTop: 4,
  },
  actionsCellCard: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  actionButtonEdit: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  actionEditText: {
    fontSize: 11,
    fontWeight: '600',
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
    fontWeight: '600',
    color: '#EF4444',
  },
  detailArrowText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    paddingVertical: 16,
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    marginBottom: 8,
  },
  detailRowItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  subDetailText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  modalTitle: { fontSize: 15, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 10 },
  deleteModalText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 15,
  },
  inputContainer: { marginBottom: 10 },
  inputLabel: { fontSize: 10, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 4 },
  wasteRateEditor: {
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  wasteRateHelp: { fontSize: 10, color: '#64748B', marginTop: 6, marginBottom: 8 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 12,
    color: PRIMARY_DARK,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chipButton: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 5,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipButtonActive: {
    backgroundColor: PRIMARY_DARK,
    borderColor: PRIMARY_DARK,
  },
  chipText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalButtonsRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  modalButton: { flex: 1, paddingVertical: 9, borderRadius: 6, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  modalButtonCancelText: { color: '#475569', fontWeight: '700', fontSize: 11 },
  modalButtonSave: { backgroundColor: ACCENT_GREEN },
  modalButtonSaveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  modalButtonConfirmDelete: { backgroundColor: '#EF4444' },
  modalButtonConfirmDeleteText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  footerContainer: {
    width: '100%',
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },
  footerText: { width: '100%', fontSize: 11, lineHeight: 15, fontWeight: '600', color: '#64748B', textAlign: 'center' },
  footerSubtext: { width: '100%', fontSize: 10, lineHeight: 14, color: '#94A3B8', marginTop: 2, textAlign: 'center' },
});