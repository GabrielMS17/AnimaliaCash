import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CustosETaxasScreen({ goToLogin }) {
  const [tab, setTab] = useState('custos');

  // Dados fictícios de Custos Fixos
  const custosFixos = [
    { id: '1', nome: 'Aluguel do Imóvel', categoria: 'Estrutura', valor: 'R$ 4.500,00' },
    { id: '2', nome: 'Energia Elétrica', categoria: 'Utilidades', valor: 'R$ 1.200,00' },
    { id: '3', nome: 'Folha Salarial Fixa', categoria: 'Pessoal', valor: 'R$ 12.800,00' },
    { id: '4', nome: 'Serviços Contábeis', categoria: 'Administrativo', valor: 'R$ 850,00' },
  ];

  // Dados fictícios de Taxas de Pagamento
  const taxasPagamento = [
    { id: '1', bandeira: 'PIX', forma: 'À vista / Instantâneo', taxa: '0,99%' },
    { id: '2', bandeira: 'Cartão de Débito', forma: 'Débito', taxa: '1,49%' },
    { id: '3', bandeira: 'Cartão de Crédito', forma: 'Crédito à vista', taxa: '3,19%' },
    { id: '4', bandeira: 'Cartão de Crédito', forma: 'Crédito Parcelado (2x a 6x)', taxa: '4,89%' },
  ];

  return (
    <View style={styles.mainWrapper}>
      {/* Header Institucional Padronizado */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.brandTitle}>
            Animalia<Text style={styles.brandSubtitle}>Cash</Text>
          </Text>
          <Text style={styles.brandTagline}>SOLUÇÕES FINANCEIRAS</Text>
        </View>

        {goToLogin && (
          <TouchableOpacity onPress={goToLogin} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Sair</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Conteúdo Principal */}
      <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
        <View style={styles.pageHeader}>
          <Text style={styles.sectionTitle}>Custos Fixos e Taxas</Text>
          <Text style={styles.sectionSubtitle}>
            Gerencie custos operacionais, cálculo de hora/sala e taxas de meios de pagamento.
          </Text>
        </View>

        {/* Métrica / Indicador do Cálculo Hora/Sala */}
        <View style={styles.card}>
          <View style={styles.metricRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metricTitle}>Hora/Sala Operacional Calculada</Text>
              <Text style={styles.metricSub}>Baseado na estrutura e custos fixos mensais cadastrados</Text>
            </View>
            <Text style={styles.metricValue}>R$ 42,50 / h</Text>
          </View>
        </View>

        {/* Botão de Ação Primário */}
        <TouchableOpacity style={styles.buttonPrimary}>
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

        {/* Tabela de Custos Fixos / Taxas */}
        {tab === 'custos' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Custos Fixos Cadastrados</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.columnHeader, { flex: 2 }]}>Nome / Descrição</Text>
              <Text style={[styles.columnHeader, { flex: 1 }]}>Categoria</Text>
              <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Valor Mensal</Text>
            </View>

            {custosFixos.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.cellTextBold, { flex: 2 }]}>{item.nome}</Text>
                <Text style={[styles.cellText, { flex: 1 }]}>{item.categoria}</Text>
                <Text style={[styles.cellCost, { flex: 1, textAlign: 'right' }]}>{item.valor}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Taxas de Pagamento Cadastradas</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.columnHeader, { flex: 1.5 }]}>Meio / Bandeira</Text>
              <Text style={[styles.columnHeader, { flex: 2 }]}>Forma de Pagamento</Text>
              <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Taxa (%)</Text>
            </View>

            {taxasPagamento.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.cellTextBold, { flex: 1.5 }]}>{item.bandeira}</Text>
                <Text style={[styles.cellText, { flex: 2 }]}>{item.forma}</Text>
                <Text style={[styles.cellBadge, { flex: 1, textAlign: 'right' }]}>{item.taxa}</Text>
              </View>
            ))}
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
  headerContainer: {
    backgroundColor: PRIMARY_DARK,
    paddingTop: 15,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextGroup: { justifyContent: 'center' },
  brandTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  brandSubtitle: { color: ACCENT_GREEN },
  brandTagline: { color: '#94A3B8', fontSize: 9, fontWeight: '600', letterSpacing: 1.5, marginTop: -2 },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoutButtonText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
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