import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { cadastrarProduto, listarProdutos, registrarEntradaLote } from '../../EstoqueService';
import AppHeader from '../../components/AppHeader';
import { notify } from '../../components/ui';

export default function EstoqueScreen() {
  const [menuAtivo, setMenuAtivo] = useState('estoque');
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form Produto
  const [nome, setNome] = useState('');
  const [marca, setMarca] = useState('');
  const [tipo, setTipo] = useState('ML');
  const [estoqueMinimo, setEstoqueMinimo] = useState('');

  // Form Lote
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState('');
  const [numeroLote, setNumeroLote] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [valorTotal, setValorTotal] = useState('');

  const modulos = [
    { id: 'principal', label: 'Início' },
    { id: 'atendimentos', label: 'Atendimentos' },
    { id: 'estoque', label: 'Estoque' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'fichas', label: 'Fichas Técnicas' },
    { id: 'relatorios', label: 'Relatórios' },
  ];

  useEffect(() => {
    carregarProdutos();
  }, []);

  async function carregarProdutos() {
    try {
      setLoading(true);
      const dados = await listarProdutos();
      setProdutos(dados || []);
      if (dados && dados.length > 0 && !produtoSelecionadoId) {
        setProdutoSelecionadoId(dados[0].id); // Seleciona o primeiro produto por padrão
      }
    } catch (error) {
      notify('Erro', 'Não foi possível carregar os produtos: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCadastrarProduto() {
    if (!nome.trim()) {
      notify('Atenção', 'Informe o nome do produto.');
      return;
    }

    try {
      setLoading(true);
      await cadastrarProduto({
        nome,
        marca,
        tipo_fracionamento: tipo,
        estoque_minimo: estoqueMinimo,
      });

      notify('Sucesso', 'Produto cadastrado!');
      setNome('');
      setMarca('');
      setEstoqueMinimo('');
      carregarProdutos();
    } catch (error) {
      notify('Erro ao cadastrar', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegistrarLote() {
    if (!produtoSelecionadoId || !quantidade || !valorTotal) {
      notify('Atenção', 'Selecione um produto e preencha a quantidade e valor total.');
      return;
    }

    const qtdNum = parseFloat(quantidade.toString().replace(',', '.'));
    const valorNum = parseFloat(valorTotal.toString().replace(',', '.'));

    if (isNaN(qtdNum) || isNaN(valorNum)) {
      notify('Atenção', 'Quantidade e Valor Total devem ser números válidos.');
      return;
    }

    try {
      setLoading(true);
      await registrarEntradaLote({
        produto_id: produtoSelecionadoId,
        numero_lote: numeroLote,
        quantidade_adquirida: qtdNum,
        valor_total_lote: valorNum,
      });

      notify('Sucesso', 'Lote registrado e Custo Médio recalculado!');
      setNumeroLote('');
      setQuantidade('');
      setValorTotal('');
      carregarProdutos();
    } catch (error) {
      notify('Erro ao registrar lote', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.mainWrapper}>
      <AppHeader />

      {/* Menu com Módulos */}
      <View style={styles.menuContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuScroll}>
          {modulos.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuButton, menuAtivo === item.id && styles.menuButtonActive]}
              onPress={() => setMenuAtivo(item.id)}
            >
              <Text style={[styles.menuText, menuAtivo === item.id && styles.menuTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Conteúdo Principal */}
      <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
        {menuAtivo === 'estoque' ? (
          <>
            <View style={styles.pageHeader}>
              <Text style={styles.sectionTitle}>Gestão de Estoque</Text>
            </View>

            {/* 1. Cadastrar Produto */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>1. Novo Produto / Insumo</Text>
              
              <Text style={styles.inputLabel}>Nome do Item</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: Anestésico X, Seringa 5ml..." 
                placeholderTextColor="#94A3B8"
                value={nome} 
                onChangeText={setNome} 
              />
              
              <Text style={styles.inputLabel}>Marca / Fabricante</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: Zoetis, Ourofino..." 
                placeholderTextColor="#94A3B8"
                value={marca} 
                onChangeText={setMarca} 
              />
              
              <Text style={styles.inputLabel}>Tipo de Fracionamento</Text>
              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.btnType, tipo === 'ML' && styles.btnTypeSelected]} 
                  onPress={() => setTipo('ML')}
                >
                  <Text style={[styles.btnTypeText, tipo === 'ML' && styles.btnTypeTextSelected]}>Líquido (ML)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.btnType, tipo === 'UNIDADE' && styles.btnTypeSelected]} 
                  onPress={() => setTipo('UNIDADE')}
                >
                  <Text style={[styles.btnTypeText, tipo === 'UNIDADE' && styles.btnTypeTextSelected]}>Unidade / Peça</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Estoque Mínimo Alerta</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: 10" 
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={estoqueMinimo} 
                onChangeText={setEstoqueMinimo} 
              />

              <TouchableOpacity style={styles.buttonPrimary} onPress={handleCadastrarProduto} disabled={loading}>
                <Text style={styles.buttonText}>Cadastrar Produto</Text>
              </TouchableOpacity>
            </View>

            {/* 2. Registrar Lote (Agora com seletor de produto) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>2. Dar Entrada em Compra (Lote)</Text>
              
              <Text style={styles.inputLabel}>Selecione o Produto</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productSelectScroll}>
                {produtos.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.productChip,
                      produtoSelecionadoId === p.id && styles.productChipSelected
                    ]}
                    onPress={() => setProdutoSelecionadoId(p.id)}
                  >
                    <Text style={[
                      styles.productChipText,
                      produtoSelecionadoId === p.id && styles.productChipTextSelected
                    ]}>
                      {p.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Número do Lote</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: LOTE-2026-X" 
                placeholderTextColor="#94A3B8"
                value={numeroLote} 
                onChangeText={setNumeroLote} 
              />

              <Text style={styles.inputLabel}>Quantidade Adquirida</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: 50" 
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={quantidade} 
                onChangeText={setQuantidade} 
              />

              <Text style={styles.inputLabel}>Valor Total Pago (R$)</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: 250.00" 
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={valorTotal} 
                onChangeText={setValorTotal} 
              />

              <TouchableOpacity 
                style={[styles.buttonSecondary, (!produtoSelecionadoId || loading) && styles.buttonDisabled]} 
                onPress={handleRegistrarLote} 
                disabled={loading || !produtoSelecionadoId}
              >
                <Text style={styles.buttonText}>Registrar Lote e Recalcular Custo</Text>
              </TouchableOpacity>
            </View>

            {/* 3. Listagem apenas informativa (Sem clique) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>3. Insumos Cadastrados</Text>
              {loading && <ActivityIndicator size="small" color="#00A86B" style={{ marginVertical: 12 }} />}
              
              {produtos.length === 0 && !loading ? (
                <Text style={styles.emptyText}>Nenhum produto cadastrado no sistema.</Text>
              ) : (
                produtos.map((item) => (
                  <View key={item.id} style={styles.productItem}>
                    <View style={styles.prodHeader}>
                      <Text style={styles.prodName}>{item.nome}</Text>
                      <Text style={styles.badgeType}>{item.tipo_fracionamento}</Text>
                    </View>

                    <View style={styles.prodRow}>
                      <Text style={styles.prodDetail}>
                        Saldo Atual: <Text style={styles.bold}>{item.saldo_estoque ?? 0}</Text> {item.tipo_fracionamento}
                      </Text>
                      <Text style={styles.prodCost}>
                        Custo Médio: <Text style={styles.bold}>R$ {Number(item.custo_medio_unitario || 0).toFixed(4)}</Text>
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ) : (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderTitle}>
              Módulo {modulos.find(m => m.id === menuAtivo)?.label}
            </Text>
            <Text style={styles.placeholderSub}>Em desenvolvimento...</Text>
          </View>
        )}

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
  menuContainer: {
    backgroundColor: PRIMARY_DARK,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  menuScroll: { paddingHorizontal: 12, paddingBottom: 12 },
  menuButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, marginRight: 6 },
  menuButtonActive: { backgroundColor: ACCENT_GREEN },
  menuText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  menuTextActive: { color: '#FFFFFF', fontWeight: '700' },
  container: { flex: 1 },
  contentPadding: { padding: 16, paddingBottom: 32 },
  pageHeader: { marginBottom: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: PRIMARY_DARK },
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
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: PRIMARY_DARK,
    marginBottom: 12,
  },
  productSelectScroll: { flexDirection: 'row', marginBottom: 14 },
  productChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8,
  },
  productChipSelected: {
    backgroundColor: 'rgba(0, 168, 107, 0.15)',
    borderColor: ACCENT_GREEN,
  },
  productChipText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  productChipTextSelected: { color: ACCENT_GREEN, fontWeight: '700' },
  row: { flexDirection: 'row', marginBottom: 12 },
  btnType: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 3,
    backgroundColor: '#F8FAFC',
  },
  btnTypeSelected: { backgroundColor: 'rgba(0, 168, 107, 0.1)', borderColor: ACCENT_GREEN },
  btnTypeText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  btnTypeTextSelected: { color: ACCENT_GREEN, fontWeight: '700' },
  buttonPrimary: { backgroundColor: ACCENT_GREEN, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  buttonSecondary: { backgroundColor: PRIMARY_DARK, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 16 },
  productItem: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  prodHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  prodName: { fontSize: 15, fontWeight: '700', color: PRIMARY_DARK },
  badgeType: {
    fontSize: 10,
    fontWeight: '700',
    color: PRIMARY_DARK,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  prodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  prodDetail: { fontSize: 12, color: '#64748B' },
  prodCost: { fontSize: 12, color: ACCENT_GREEN },
  bold: { fontWeight: '700', color: PRIMARY_DARK },
  placeholderContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 20,
  },
  placeholderTitle: { fontSize: 18, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 6 },
  placeholderSub: { fontSize: 13, color: '#94A3B8' },
  footerContainer: { marginTop: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0', alignItems: 'center' },
  footerText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  footerSubtext: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
});