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
import { useAnimaliaData } from '../../store/AnimaliaDataContext';
import { supabase } from '../../supabase';
import { calculateProcedure } from '../../utils/costCalculations';

export default function CustosETaxasScreen() {
  const { procedures, insumosMap, settings } = useAnimaliaData();
  
  const [tab, setTab] = useState('custos'); // 'custos', 'variaveis', 'taxas'
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
            <Text style={styles.metricTitle}>Hora/Sala Calculada</Text>
            <Text style={styles.metricSub}>Baseado nos custos fixos</Text>
            <Text style={[styles.metricValue, { marginTop: 6 }]}>{formatCurrency(horaSalaCalculada)} / h</Text>
          </View>

          <View style={[styles.card, { flex: 1, marginBottom: 0 }]}>
            <Text style={styles.metricTitle}>Total Variável Consolidado</Text>
            <Text style={styles.metricSub}>Cirurgia, Internação, Banho e Tosa</Text>
            <Text style={[styles.metricValue, { color: PRIMARY_DARK, marginTop: 6 }]}>{formatCurrency(totalCustosVariaveis)}</Text>
          </View>
        </View>

        {/* CARD DO DIAGNÓSTICO FINANCEIRO POR MACHINE LEARNING */}
        <View style={[styles.card, { marginTop: 16 }]}>
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
            <Text style={[styles.tabText, tab === 'custos' && styles.tabTextActive]}>Custos Fixos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === 'variaveis' && styles.tabButtonActive]}
            onPress={() => setTab('variaveis')}
          >
            <Text style={[styles.tabText, tab === 'variaveis' && styles.tabTextActive]}>Custos Variáveis</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === 'taxas' && styles.tabButtonActive]}
            onPress={() => setTab('taxas')}
          >
            <Text style={[styles.tabText, tab === 'taxas' && styles.tabTextActive]}>Taxas de Pagamento</Text>
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
            <Text style={styles.cardTitle}>Custos Variáveis por Categoria (Consolidado)</Text>
            <Text style={styles.aiCardDesc}>Clique em uma categoria para ver os itens detalhados calculados.</Text>
            
            <View style={styles.tableHeader}>
              <Text style={[styles.columnHeader, { flex: 2 }]}>Categoria</Text>
              <Text style={[styles.columnHeader, { flex: 1.2, textAlign: 'center' }]}>Qtd. Itens</Text>
              <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Valor Total</Text>
            </View>

            {custosVariaveisConsolidados.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.tableRowClickable}
                activeOpacity={0.7}
                onPress={() => {
                  setCategoriaSelecionadaDetalhes(item.categoria);
                  setDetailsModalVisible(true);
                }}
              >
                <Text style={[styles.cellTextBold, { flex: 2, color: '#0284C7' }]}>{item.nome} 🔍</Text>
                <Text style={[styles.cellText, { flex: 1.2, textAlign: 'center' }]}>{item.qtd} cad.</Text>
                <Text style={[styles.cellCost, { flex: 1, textAlign: 'right' }]}>
                  {formatCurrency(item.valor)}
                </Text>
              </TouchableOpacity>
            ))}
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
                        <View style={{ flex: 2 }}>
                          <Text style={styles.cellTextBold}>{item.name}</Text>
                          <Text style={styles.subDetailText}>
                            {item.targetWeightKg ? `${item.targetWeightKg} kg • ` : ''}
                            Duração: {item.durationMinutes || 60} min
                          </Text>
                        </View>
                        <Text style={[styles.cellCost, { flex: 1, textAlign: 'right' }]}>
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
                    <Text style={styles.inputLabel}>Nome do Custo Variável / Procedimento Extra</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: Exame de sangue extra, Material adicional..."
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
              <View style={styles.deleteIconContainer}>
                <Text style={{ fontSize: 24 }}>⚠️</Text>
              </View>
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
  contentPadding: { padding: 16, paddingBottom: 32 },
  pageHeader: { marginBottom: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: PRIMARY_DARK },
  sectionSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },
  metricsRowContainer: {
    flexDirection: 'row',
    gap: 12,
  },
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
  cardTitle: { fontSize: 16, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 14 },
  metricTitle: { fontWeight: '700', fontSize: 13, color: PRIMARY_DARK },
  metricSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  metricValue: { fontSize: 16, fontWeight: '800', color: ACCENT_GREEN },
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
    gap: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
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
  tableRowClickable: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 4,
    borderRadius: 6,
    marginVertical: 2,
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
  detailsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
    marginBottom: 10,
  },
  detailRowItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  subDetailText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
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